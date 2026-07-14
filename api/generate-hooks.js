import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    const { script } = req.body;

    const prompt = `
You are a viral YouTube Shorts expert.

Generate exactly FIVE hooks for this script.

Categories:

1. Curiosity
2. Emotional
3. Shocking
4. Funny
5. Educational

Return ONLY valid JSON like this:

{
  "hooks":[
    {
      "type":"Curiosity",
      "text":"...",
      "score":95
    }
  ]
}

Script:

${script}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.9,
    });

    const result = JSON.parse(response.choices[0].message.content);

    res.status(200).json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
}
