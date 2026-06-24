import { createAnthropic } from "@ai-sdk/anthropic";

const provider = createAnthropic();

export const haikuModel = provider("claude-haiku-4-5-20251001");
export const sonnetModel = provider("claude-sonnet-4-6");
