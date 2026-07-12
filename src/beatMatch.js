import { guess } from 'web-audio-beat-detector'

// Analyzes a music track and returns a start offset (in seconds) that lines
// up with a detected beat, so background music kicks in cleanly instead of
// starting mid-note. Falls back to 0 if detection fails (e.g. ambient/beatless tracks).
export async function getBeatAlignedStart(audioUrl) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    const { offset, tempo } = await guess(audioBuffer)
    const beatInterval = 60 / tempo
    let startTime = offset
    while (startTime > 8) startTime -= beatInterval * 4
    return Math.max(0, startTime)
  } catch (err) {
    console.error('Beat detection failed, starting music from 0:', err)
    return 0
  }
}
