import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://srucmoiejugwbozhnoma.supabase.co';

// Service role key bypasses row-level security — that's intentional here.
// Usage bookkeeping is a backend-only concern, never touched by the browser,
// so it doesn't need to go through the anon-key/RLS path the rest of the
// app uses. Must be set in Vercel's server-side env vars only.
const serviceClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Checks whether `userId` is still under `dailyLimit` calls to `action`
 * today (UTC), and if so, records this call.
 *
 * Fails OPEN (allows the request through) if the check itself errors —
 * a broken rate limiter should never be the reason a feature goes down.
 * The tradeoff: a Supabase outage temporarily disables rate limiting
 * instead of disabling the product. That's the right default for now.
 */
export async function checkRateLimit(userId, action, dailyLimit) {
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { count, error: countError } = await serviceClient
      .from('api_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', startOfDay.toISOString());

    if (countError) throw countError;

    if (count >= dailyLimit) {
      return { allowed: false };
    }

    const { error: insertError } = await serviceClient
      .from('api_usage')
      .insert({ user_id: userId, action });

    if (insertError) throw insertError;

    return { allowed: true };
  } catch (err) {
    console.error('Rate limit check failed, failing open:', err);
    return { allowed: true };
  }
}
