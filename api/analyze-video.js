import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { frames } = req.body;

    const imageBlocks = frames.map((base64) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
    }));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `These are frames from a video, in order. Classify the overall mood (pick one: emotional, sad, angry, heartwarming, narrative, upbeat, dramatic) and write a short voiceover script (3-5 sentences) matching that mood. Respond ONLY as JSON: {"mood": "...", "script": "..."}`,
            },
          ],
        },
      ],
    });

    const text = message.content.find((b) => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
