// Maps any caught error to a safe, generic message before it's sent to the
// client. Callers should still console.error(err) with the raw error for
// server-side logs — this function is only for what the user sees.
export function safeErrorMessage(err) {
  const message = (err && err.message) || '';
  const lower = message.toLowerCase();

  if (err?.name === 'AbortError' || lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request took too long — please try again.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'This AI service is busy right now — please try again in a moment.';
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentication')) {
    return 'This AI service is temporarily unavailable — please try again shortly.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('econnrefused') || lower.includes('enotfound')) {
    return 'Network error — please try again.';
  }

  // Fallback: never forward raw SDK/database error text to the client.
  return 'Something went wrong on our end — please try again.';
}
