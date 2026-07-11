export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mood } = req.body;
    const clientId = process.env.JAMENDO_CLIENT_ID;

    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=3&fuzzytags=${encodeURIComponent(mood)}&include=musicinfo&ccnc=false&ccnd=false&order=popularity_total`;

    const response = await fetch(url);
    const data = await response.json();

    const tracks = (data.results || []).map((t) => ({
      name: t.name,
      artist: t.artist_name,
      audioUrl: t.audio,
      duration: t.duration,
    }));

    res.status(200).json({ tracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
