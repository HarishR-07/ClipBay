import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from './_lib/auth.js';
import { safeErrorMessage } from './_lib/errors.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Rough spoken-word pacing for natural narration (words per second).
const WORDS_PER_SECOND = 2.3;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401 response

  try {
    const { frames, targetDuration } = req.body;

    const imageBlocks = frames.map((base64) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
    }));

    const targetWordCount = targetDuration
      ? Math.max(5, Math.round(targetDuration * WORDS_PER_SECOND))
      : null;

    const durationInstruction = targetDuration
      ? ` The script must take approximately ${targetDuration} seconds to narrate aloud at a natural pace — that's about ${targetWordCount} words. This is a hard constraint: do not write significantly more or fewer words than that.`
      : ' Write 3-5 sentences.';

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
              text: `These are frames from a video, in order. Classify the overall mood (pick one: emotional, sad, angry, heartwarming, narrative, upbeat, dramatic) and write a short voiceover script matching that mood.${durationInstruction} Respond ONLY as JSON: {"mood": "...", "script": "..."}`,
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
    res.status(500).json({ error: safeErrorMessage(err) });
  }
}
