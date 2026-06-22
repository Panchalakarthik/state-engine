import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { STATE_SYSTEM_PROMPTS } from "@/lib/prompts";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import type { LayoutDescription, StateOutput } from "@/lib/types";

/** Lazy client so fixtures mode needs no ANTHROPIC_API_KEY. */
function getClient(): Anthropic {
  return new Anthropic();
}

/** Strip markdown fences / leading language hints from generated JSX. */
function cleanJsx(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:jsx|tsx|js|javascript)?\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/i, "");
  return cleaned.trim();
}

/**
 * Discrete async unit: produce a single state's output. Kept isolated and
 * collected via Promise.all so the collect-then-return can later be swapped for
 * SSE streaming without restructuring. In fixtures mode it resolves from the
 * bundled artifact; in live mode it calls Claude. Same shape either way.
 */
async function generateState(
  stateName: string,
  layoutDescription: LayoutDescription,
  userInstruction: string | undefined,
  live: boolean,
): Promise<StateOutput> {
  if (!live) {
    const artifact = findArtifact(layoutDescription.screenName);
    return (
      artifact.states[stateName] ??
      artifact.states.default ?? {
        jsx: "function GeneratedComponent(){return null;}",
        description: `${stateName} state`,
      }
    );
  }

  const systemPrompt =
    STATE_SYSTEM_PROMPTS[stateName] ?? STATE_SYSTEM_PROMPTS.default;

  const userContent = `Layout description:
${JSON.stringify(layoutDescription, null, 2)}
${userInstruction ? `\nAdditional instruction: ${userInstruction}` : ""}

Generate the ${stateName.toUpperCase()} state. Output ONLY the GeneratedComponent function.`;

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const jsx =
    message.content[0].type === "text" ? cleanJsx(message.content[0].text) : "";

  return {
    jsx,
    description: `${stateName.charAt(0).toUpperCase() + stateName.slice(1)} state`,
  };
}

function stateNamesForArchetypes(archetypes: string[]): string[] {
  // Phase 0 vertical slice: default, loading, error for every archetype.
  void archetypes;
  return ["default", "loading", "error"];
}

export async function POST(req: NextRequest) {
  try {
    const { archetypes, layoutDescription, userInstruction } =
      (await req.json()) as {
        archetypes: string[];
        layoutDescription: LayoutDescription;
        userInstruction?: string;
      };

    const live = useLiveAI();
    const stateNames = stateNamesForArchetypes(archetypes);

    const results = await Promise.all(
      stateNames.map((name) =>
        generateState(name, layoutDescription, userInstruction, live),
      ),
    );

    const states: Record<string, StateOutput> = {};
    stateNames.forEach((name, i) => {
      states[name] = results[i];
    });

    return NextResponse.json({ states });
  } catch (err) {
    console.error("generate error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Generation failed" },
      { status: 500 },
    );
  }
}
