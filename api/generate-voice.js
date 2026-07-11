export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { script, provider } = req.body;

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'alloy',
          input: script,
        }),
      });

      if (!response.ok) throw new Error('OpenAI TTS failed');

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ audio: base64, mimeType: 'audio/mpeg' });
    }

    if (provider === 'elevenlabs') {
      const voiceId = '21m00Tcm4TlvDq8ikWAM';
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
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ audio: base64, mimeType: 'audio/mpeg' });
    }

    return res.status(400).json({ error: 'Invalid provider' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
