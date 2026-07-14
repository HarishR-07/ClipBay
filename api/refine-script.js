import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from './_lib/auth.js';
import { safeErrorMessage } from './_lib/errors.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401 response

  try {
    const { script, instruction, mood } = req.body;

    if (!script || script.length > 3000) {
      return res.status(400).json({ error: 'Script must be under 3000 characters' });
    }
    if (!instruction || instruction.length > 300) {
      return res.status(400).json({ error: 'Instruction must be under 300 characters' });
    }

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
    res.status(500).json({ error: safeErrorMessage(err) });
  }
}
