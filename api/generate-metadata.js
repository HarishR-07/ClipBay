import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { withRetry } from './_lib/retry.js';
import { safeErrorMessage } from './_lib/errors.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401 response

  const { allowed } = await checkRateLimit(user.id, 'generate-metadata', 20);
  if (!allowed) {
    return res.status(429).json({ error: 'Daily limit reached for this feature — please try again tomorrow.' });
  }

  try {
    const { script, mood } = req.body;

    if (!script || script.length > 3000) {
      return res.status(400).json({ error: 'Script must be under 3000 characters' });
    }

    const message = await withRetry(() => anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `You are a viral short-form video strategist. Here is the voiceover script for a ${mood || 'general'} short-form video:

"${script}"

Generate publishing metadata for this video. Respond with ONLY valid JSON, no markdown fences, in exactly this shape:

{
  "titles": {
    "youtube": [{"text": "...", "ctrScore": 0-100, "seoScore": 0-100}] (exactly 10 items),
    "shorts": [{"text": "...", "ctrScore": 0-100, "seoScore": 0-100}] (exactly 10 items)
  },
  "description": {
    "seo": "keyword-rich, 2-3 sentences",
    "short": "one punchy sentence, under 100 characters",
    "long": "4-6 sentences, tells the full story",
    "cta": "one short call-to-action line, e.g. asking for a follow or comment"
  },
  "hashtags": {
    "trending": ["#tag", ...] (8 items, currently popular general tags),
    "niche": ["#tag", ...] (8 items, specific to this video's topic),
    "broad": ["#tag", ...] (6 items, large general-audience reach tags),
    "platformSpecific": {
      "tiktok": ["#tag", ...] (5 items),
      "instagram": ["#tag", ...] (5 items),
      "youtube": ["#tag", ...] (5 items)
    }
  }
}

Every title must be distinct, under 100 characters, and genuinely reflect the script's content — no generic filler. Scores should vary realistically based on each title's actual hook strength and keyword usage, not be uniform.`,
        },
      ],
    }));

    const text = message.content.find((b) => b.type === 'text')?.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: safeErrorMessage(err) });
  }
}
