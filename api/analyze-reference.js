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
              text: `These are frames from a reference video. Describe its EDITING STYLE ONLY (not its specific content) so it can be recreated on different footage. Cover: font style used for any on-screen text, color grading mood in words, pacing, transition types, and what genre/mood of background music would fit. ALSO provide numeric color grading values that approximate this look when applied via standard video filters: brightness (-0.3 to 0.3, 0 is neutral), contrast (0.7 to 1.5, 1.0 is neutral), saturation (0.3 to 1.8, 1.0 is neutral), and temperatureKelvin (3500 for very warm/orange, 6500 for neutral, 9500 for very cool/blue).

Respond ONLY as JSON: {"fontStyle": "...", "colorGrading": "...", "pacing": "...", "transitions": "...", "musicMood": "...", "colorValues": {"brightness": 0, "contrast": 1.0, "saturation": 1.0, "temperatureKelvin": 6500}}`,
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
