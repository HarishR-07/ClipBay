import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { command, videoDuration } = req.body;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Parse this video editing command into structured data. The video is ${videoDuration} seconds long.

Command: "${command}"

Determine:
- action: one of "add_overlay", "add_effect", "unknown"
- timestampSeconds: when it should appear (number, or null if not specified — default to 0)
- durationSeconds: how long it should show (number, default 3 if not specified)
- position: one of "top-left", "top-right", "bottom-left", "bottom-right", "center" (default "center" if not specified)
- effectType: if action is "add_effect", this MUST be exactly one of these strings: "black_and_white", "blur", "vignette", "fade", "zoom", "shake". Pick whichever is the closest match to what the user described. If action is not "add_effect", set this to null.

Respond ONLY as JSON: {"action": "...", "timestampSeconds": 0, "durationSeconds": 3, "position": "...", "effectType": null}`,
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
