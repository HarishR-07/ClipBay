import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

export async function renderVideoWithOverlays(videoFile, overlayCommands, onProgress) {
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

  if (overlaysToRender.length === 0) {
    await ffmpeg.exec(['-i', 'input.mp4', '-c', 'copy', 'output.mp4'])
  } else {
    for (let i = 0; i < overlaysToRender.length; i++) {
      await ffmpeg.writeFile(`overlay${i}.png`, await fetchFile(overlaysToRender[i].overlayImage))
    }

    const positionMap = {
      'top-left': '10:10',
      'top-right': 'W-w-10:10',
      'bottom-left': '10:H-h-10',
      'bottom-right': 'W-w-10:H-h-10',
      center: '(W-w)/2:(H-h)/2',
    }

    const inputs = ['-i', 'input.mp4']
    overlaysToRender.forEach((_, i) => inputs.push('-i', `overlay${i}.png`))

    let filterParts = []
    let lastLabel = '0:v'
    overlaysToRender.forEach((cmd, i) => {
      const pos = positionMap[cmd.position] || positionMap.center
      const start = cmd.timestampSeconds
      const end = start + cmd.durationSeconds
      const outLabel = `v${i + 1}`
      filterParts.push(`[${lastLabel}][${i + 1}:v]overlay=${pos}:enable='between(t,${start},${end})'[${outLabel}]`)
      lastLabel = outLabel
    })

    await ffmpeg.exec([
      ...inputs,
      '-filter_complex', filterParts.join(';'),
      '-map', `[${lastLabel}]`,
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-c:a', 'copy',
      'output.mp4',
    ])
  }

  const data = await ffmpeg.readFile('output.mp4')
  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  return URL.createObjectURL(blob)
}
