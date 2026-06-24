/**
 * Core screen classification logic shared by /api/classify and /api/chat routes.
 */

import { generateText } from "ai";
import { sonnetModel } from "./anthropic";
import { CLASSIFY_SYSTEM_PROMPT } from "./prompts";
import { findRecipe } from "./blade-recipes";
import { findArtifact } from "./artifacts";
import { useLiveAI } from "./ai-mode";
import type { Scenario, LayoutDescription } from "./types";

export interface ClassifyResult {
  archetypes: string[];
  scenarios: Scenario[];
  layoutDescription: LayoutDescription;
}

function parseJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

export async function classifyScreen(
  screenName: string,
  components: string[] = [],
  signal?: AbortSignal,
): Promise<ClassifyResult> {
  if (!useLiveAI()) {
    const artifact = findArtifact(screenName);
    return {
      archetypes: artifact.archetypes,
      scenarios: artifact.scenarios,
      layoutDescription: artifact.layoutDescription,
    };
  }

  const recipe = findRecipe(screenName);
  if (recipe) {
    return {
      archetypes: recipe.archetypes,
      scenarios: recipe.scenarios,
      layoutDescription: { screenName, components: [] },
    };
  }

  const { text } = await generateText({
    model: sonnetModel,
    system: CLASSIFY_SYSTEM_PROMPT,
    prompt:
      `Screen name: "${screenName}"` +
      (components.length > 0 ? `\nComponents on screen: ${components.join(", ")}` : ""),
    maxOutputTokens: 2048,
    abortSignal: signal,
    maxRetries: 3,
  });

  return parseJson(text) as ClassifyResult;
}
