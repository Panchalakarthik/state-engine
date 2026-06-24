/**
 * Live AI is active when ANTHROPIC_API_KEY is present.
 * Falls back to bundled demo artifacts when the key is missing.
 */
export function useLiveAI(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
