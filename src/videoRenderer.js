import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

// Escapes text for safe use inside an ffmpeg drawtext textfile.
// (Only needed for characters that break the .txt itself, not for
// drawtext's own escaping — textfile= avoids that whole headache.)
function sanitizeCaptionText(text) {
  return (text || '').replace(/\r/g, '')
}

export async function renderVideoWithOverlays(
  videoFile,
  overlayCommands,
  audioOptions,
  colorGrading,
  videoDuration,
  captions,
  captionPosition,
  captionFontUrl,
  onProgress
) {
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

  // Caption vertical position presets (used for the drawtext y= expression)
  const captionPositionMap = {
    top: '80',
    center: '(h-text_h)/2',
    bottom: 'h-220',
  }

  let filterParts = []
  let lastVideoLabel = '0:v'

  if (colorGrading) {
    const { brightness = 0, contrast = 1.0, saturation = 1.0, temperatureKelvin = 6500 } = colorGrading
    filterParts.push(`[0:v]eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation},colortemperature=temperature=${temperatureKelvin}[graded]`)
    lastVideoLabel = 'graded'
  }
  const effectsToApply = overlayCommands.filter((c) => c.action === 'add_effect')
  effectsToApply.forEach((cmd, i) => {
    const start = cmd.timestampSeconds
    const end = start + cmd.durationSeconds
    const type = (cmd.effectType || '').toLowerCase()
    const outLabel = `fx${i}`
    let filterStr = null

    if (type.includes('black') || type.includes('grey') || type.includes('gray') || type.includes('b&w') || type.includes('white')) {
      filterStr = `hue=s=0:enable='between(t,${start},${end})'`
    } else if (type.includes('blur')) {
      filterStr = `boxblur=5:1:enable='between(t,${start},${end})'`
    } else if (type.includes('vignette')) {
      filterStr = `vignette:enable='between(t,${start},${end})'`
    } else if (type.includes('fade')) {
      filterStr = `fade=t=in:st=${start}:d=${cmd.durationSeconds}`
    } else if (type.includes('zoom')) {
      filterStr = `zoompan=z='if(between(time,${start},${end}),min(zoom+0.0015,1.3),1)':d=1:s=1080x1920:fps=30`
    } else if (type.includes('shake')) {
      filterStr = `crop=iw-20:ih-20:10+10*sin(t*40):10+10*cos(t*35):enable='between(t,${start},${end})'`
    }

    if (filterStr) {
      filterParts.push(`[${lastVideoLabel}]${filterStr}[${outLabel}]`)
      lastVideoLabel = outLabel
    }
  })
  overlaysToRender.forEach((cmd, i) => {
    const pos = positionMap[cmd.position] || positionMap.center
    const start = cmd.timestampSeconds
    const end = start + cmd.durationSeconds
    const outLabel = `v${i + 1}`
    filterParts.push(`[${lastVideoLabel}][${overlayIndices[i]}:v]overlay=${pos}:enable='between(t,${start},${end})'[${outLabel}]`)
    lastVideoLabel = outLabel
  })

  // --- NEW: burn in captions on top of everything else ---
  // --- burn in captions on top of everything else ---
  if (captions && captions.length > 0) {
    await ffmpeg.writeFile('caption-font.ttf', await fetchFile(captionFontUrl || '/fonts/caption-font.ttf'))
    const yPos = captionPositionMap[captionPosition] || captionPositionMap.bottom

    for (let i = 0; i < captions.length; i++) {
      const cap = captions[i]
      const start = cap.startSeconds
      const end = videoDuration ? Math.min(cap.endSeconds, videoDuration) : cap.endSeconds
      const outLabel = `cap${i}`

      await ffmpeg.writeFile(`cap${i}.txt`, sanitizeCaptionText(cap.text))

      filterParts.push(
        `[${lastVideoLabel}]drawtext=fontfile=caption-font.ttf:textfile=cap${i}.txt:fontsize=56:fontcolor=white:` +
        `box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=${yPos}:` +
        `enable='between(t,${start},${end})'[${outLabel}]`
      )
      lastVideoLabel = outLabel
    }
  }
  // --- end captions block ---
  // --- end captions block ---

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

  const videoWasFiltered = filterParts.length > 0
  args.push('-map', videoWasFiltered ? `[${lastVideoLabel}]` : '0:v')
  args.push(...audioMapArgs)
  args.push('-c:v', 'libx264', '-c:a', 'aac', '-shortest', 'output.mp4')

  await ffmpeg.exec(args)

  const data = await ffmpeg.readFile('output.mp4')
  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  return URL.createObjectURL(blob)
}
