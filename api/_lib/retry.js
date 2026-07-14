/**
 * Retries a transient-failure-prone async operation with exponential
 * backoff (500ms, 1s, 2s by default). Only retries errors that look
 * transient — network failures, timeouts, HTTP 429/5xx — never retries on
 * 4xx client errors (bad input, auth failures), since retrying those just
 * burns time and API quota on an error that will never succeed.
 */
export async function withRetry(fn, { retries = 2, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === retries) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

function isRetryable(err) {
  // SDK errors (Anthropic, etc.) and our own thrown HTTP errors carry a
  // status code — use it directly when present.
  const status = err?.status || err?.statusCode;
  if (status) {
    return status === 429 || status >= 500;
  }
  // Errors with no status code are usually network-level (fetch rejecting
  // outright, DNS failure, timeout) — safe to retry.
  const message = (err?.message || '').toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout')
  );
}
