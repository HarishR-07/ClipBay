export async function extractFrames(file, count = 5) {
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);

  video.src = objectUrl;
  video.muted = true;
  video.preload = "metadata";

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
  });

  const duration = video.duration;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = (video.videoHeight / video.videoWidth) * 512;

  const ctx = canvas.getContext("2d");

  const frames = [];

  for (let i = 0; i < count; i++) {
    const time = (duration / (count + 1)) * (i + 1);

    video.currentTime = time;

    await new Promise((resolve, reject) => {
      video.onseeked = resolve;
      video.onerror = reject;
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    frames.push(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;

  URL.revokeObjectURL(objectUrl);

  return frames;
}

export async function getFrameAt(file, timeSeconds) {
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);

  video.src = objectUrl;
  video.muted = true;
  video.preload = "metadata";

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
  });

  const clampedTime = Math.min(timeSeconds, video.duration - 0.1);

  video.currentTime = Math.max(0, clampedTime);

  await new Promise((resolve, reject) => {
    video.onseeked = resolve;
    video.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = (video.videoHeight / video.videoWidth) * 360;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const image = canvas.toDataURL("image/jpeg", 0.7);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;

  URL.revokeObjectURL(objectUrl);

  return image;
}
