// Sliding-window in-process rate limiter.
// Resets on cold start — not a security guarantee, but protects against
// accidental bursts and runaway clients burning the Anthropic API key.

const windows = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): boolean {
  const now = Date.now();
  const prev = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= limit) return false;
  prev.push(now);
  windows.set(key, prev);
  return true;
}
