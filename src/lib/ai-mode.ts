/**
 * When USE_LIVE_AI is truthy, the API routes call the real Anthropic API.
 * Otherwise they serve bundled artifacts (the default — no API key needed).
 */
export function useLiveAI(): boolean {
  const flag = process.env.USE_LIVE_AI?.toLowerCase();
  return flag === "true" || flag === "1";
}
