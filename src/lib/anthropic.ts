import Anthropic from "@anthropic-ai/sdk";

// Module-level singleton — initialized once per process, reused across all requests.
// Avoids re-reading env vars and re-initializing the HTTP client on every API call.
export const anthropic = new Anthropic();
