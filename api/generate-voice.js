 import { requireUser } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401 response

  const { script, provider, voice } = req.body;

  if (!script || typeof script !== 'string') {
    return res.status(400).json({ error: 'Script is required' });
  }
  if (script.length > 3000) {
    return res.status(400).json({ error: 'Script is too long (max 3000 characters)' });
  }

  try {
    let base64, mimeType;

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: voice || 'alloy',
          input: script,
        }),
      });

      if (!response.ok) throw new Error('OpenAI TTS failed');

      const buffer = await response.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
      mimeType = 'audio/mpeg';
    } else if (provider === 'elevenlabs') {
      const voiceId = voice || '21m00Tcm4TlvDq8ikWAM';
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2',
        }),
      });

      if (!response.ok) throw new Error('ElevenLabs TTS failed — check your ElevenLabs subscription/API access');

      const buffer = await response.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
      mimeType = 'audio/mpeg';
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // --- NEW: get word-level timestamps so captions can sync to speech ---
    // Uses OpenAI Whisper regardless of which TTS provider generated the
    // audio — it just needs the audio file, not the original text.
    let captions = [];
    try {
      const audioBuffer = Buffer.from(base64, 'base64');
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: mimeType }), 'voice.mp3');
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');

      const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });

      if (transcribeRes.ok) {
        const transcript = await transcribeRes.json();
        captions = groupWordsIntoCaptions(transcript.words || []);
      } else {
        console.error('Whisper transcription failed:', await transcribeRes.text());
      }
    } catch (capErr) {
      // Caption generation is a nice-to-have — never fail the whole
      // voiceover request just because captions couldn't be built.
      console.error('Caption generation failed (non-fatal):', capErr);
    }

    return res.status(200).json({ audio: base64, mimeType, captions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

// Groups individual word timestamps into short caption chunks (~4 words
// each) for Shorts-style burned-in captions, instead of one word at a time
// or one giant subtitle per sentence.
function groupWordsIntoCaptions(words, wordsPerChunk = 3) {
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const group = words.slice(i, i + wordsPerChunk);
    if (group.length === 0) continue;
    chunks.push({
      text: group.map((w) => w.word).join(' ').trim(),
      startSeconds: group[0].start,
      endSeconds: group[group.length - 1].end,
    });
  }
  return chunks;
}
