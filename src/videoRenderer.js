import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

export async function renderVideoWithOverlays(videoFile, overlayCommands, audioOptions, colorGrading, onProgress) {
  const { voiceoverUrl, musicUrl } = audioOptions || {}
  const ffmpeg = new FFmpeg()

  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) onProgress(Math.round(progress * 100))
  })

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))

  const overlaysToRender = overlayCommands.filter((c) => c.action === 'add_overlay' && c.overlayImage)

  const inputs = ['-i', 'input.mp4']
  let nextIndex = 1
  const overlayIndices = []

  for (let i = 0; i < overlaysToRender.length; i++) {
    await ffmpeg.writeFile(`overlay${i}.png`, await fetchFile(overlaysToRender[i].overlayImage))
    inputs.push('-i', `overlay${i}.png`)
    overlayIndices.push(nextIndex++)
  }

  let voiceIndex = null
  if (voiceoverUrl) {
    await ffmpeg.writeFile('voice.mp3', await fetchFile(voiceoverUrl))
    inputs.push('-i', 'voice.mp3')
    voiceIndex = nextIndex++
  }

  let musicIndex = null
  if (musicUrl) {
    await ffmpeg.writeFile('music.mp3', await fetchFile(musicUrl))
    inputs.push('-stream_loop', '-1', '-i', 'music.mp3')
    musicIndex = nextIndex++
  }

  const positionMap = {
    'top-left': '10:10',
    'top-right': 'W-w-10:10',
    'bottom-left': '10:H-h-10',
    'bottom-right': 'W-w-10:H-h-10',
    center: '(W-w)/2:(H-h)/2',
  }

  let filterParts = []
  let lastVideoLabel = '0:v'

  if (colorGrading) {
    const { brightness = 0, contrast = 1.0, saturation = 1.0, temperatureKelvin = 6500 } = colorGrading
    filterParts.push(`[0:v]eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation},colortemperature=temperature=${temperatureKelvin}[graded]`)
    lastVideoLabel = 'graded'
  }
  overlaysToRender.forEach((cmd, i) => {
    const pos = positionMap[cmd.position] || positionMap.center
    const start = cmd.timestampSeconds
    const end = start + cmd.durationSeconds
    const outLabel = `v${i + 1}`
    filterParts.push(`[${lastVideoLabel}][${overlayIndices[i]}:v]overlay=${pos}:enable='between(t,${start},${end})'[${outLabel}]`)
    lastVideoLabel = outLabel
  })

  let audioMapArgs = []
  if (voiceIndex !== null && musicIndex !== null) {
    filterParts.push(`[${musicIndex}:a]volume=0.25[music_low]`)
    filterParts.push(`[${voiceIndex}:a][music_low]amix=inputs=2:duration=first[aout]`)
    audioMapArgs = ['-map', '[aout]']
  } else if (voiceIndex !== null) {
    audioMapArgs = ['-map', `${voiceIndex}:a`]
  } else if (musicIndex !== null) {
    filterParts.push(`[${musicIndex}:a]volume=0.6[aout]`)
    audioMapArgs = ['-map', '[aout]']
  } else {
    audioMapArgs = ['-map', '0:a?']
  }

  const args = [...inputs]

  if (filterParts.length > 0) {
    args.push('-filter_complex', filterParts.join(';'))
  }

  const videoWasFiltered = overlaysToRender.length > 0
  args.push('-map', videoWasFiltered ? `[${lastVideoLabel}]` : '0:v')
  args.push(...audioMapArgs)
  args.push('-c:v', 'libx264', '-c:a', 'aac', '-shortest', 'output.mp4')

  await ffmpeg.exec(args)

  const data = await ffmpeg.readFile('output.mp4')
  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  return URL.createObjectURL(blob)
}
