import { requireUser } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return; // requireUser already sent the 401 response

  try {
    const { mood, videoDuration } = req.body;
    const clientId = process.env.JAMENDO_CLIENT_ID;

    // Fetch a wider pool so we can pick the 3 closest in length to the clip,
    // instead of just the 3 most popular regardless of duration.
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=15&fuzzytags=${encodeURIComponent(mood)}&include=musicinfo&ccnc=false&ccnd=false&order=popularity_total`;

    const response = await fetch(url);
    const data = await response.json();

    let tracks = (data.results || []).map((t) => ({
      name: t.name,
      artist: t.artist_name,
      audioUrl: t.audio,
      duration: t.duration,
    }));

    if (videoDuration) {
      tracks.sort((a, b) => Math.abs(a.duration - videoDuration) - Math.abs(b.duration - videoDuration));
    }

    res.status(200).json({ tracks: tracks.slice(0, 3) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
