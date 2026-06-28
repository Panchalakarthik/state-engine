import { createAnthropic } from "@ai-sdk/anthropic";

// baseURL is hardcoded to prevent ANTHROPIC_BASE_URL env var from overriding with a /v1-less URL
const provider = createAnthropic({ baseURL: "https://api.anthropic.com/v1" });

export const haikuModel = provider("claude-haiku-4-5-20251001");
export const sonnetModel = provider("claude-sonnet-4-6");
