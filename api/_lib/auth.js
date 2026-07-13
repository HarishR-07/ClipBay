import { createClient } from '@supabase/supabase-js';

// Same public values already used in src/supabaseClient.js — safe to
// duplicate here since the anon key is meant to be public. This client
// is only used to validate tokens, never to bypass row-level security.
const supabaseUrl = 'https://srucmoiejugwbozhnoma.supabase.co';
const supabaseAnonKey = 'sb_publishable__VOl5BNHr2Tc02PQuNunBg_0ugx01Te';

// Checks that the request carries a valid, logged-in Supabase session.
// Returns the authenticated user object if valid.
// If invalid/missing, sends a 401 response itself and returns null —
// callers should immediately `return` when this returns null, since the
// response has already been sent.
export async function requireUser(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    res.status(401).json({ error: 'Invalid or expired session — please log in again' });
    return null;
  }

  return data.user;
}
