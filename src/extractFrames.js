export async function extractFrames(file, count = 5) {
  const video = document.createElement('video')
  const objectUrl = URL.createObjectURL(file)
  video.src = objectUrl
  video.muted = true
  await new Promise((res) => (video.onloadedmetadata = res))

  const duration = video.duration
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = (video.videoHeight / video.videoWidth) * 512
  const ctx = canvas.getContext('2d')

  const frames = []
  for (let i = 0; i < count; i++) {
    const time = (duration / (count + 1)) * (i + 1)
    video.currentTime = time
    await new Promise((res) => (video.onseeked = res))
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1])
  }

  URL.revokeObjectURL(objectUrl)
  return frames
}
