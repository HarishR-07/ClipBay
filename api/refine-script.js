import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { script, instruction, mood } = req.body;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Here is a voiceover script for a ${mood} video:\n\n"${script}"\n\nRevise it based on this instruction: "${instruction}". Keep the same mood and core message. Respond ONLY as JSON: {"script": "..."}`,
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
