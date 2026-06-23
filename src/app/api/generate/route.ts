import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SCENARIO_SYSTEM_PROMPT } from "@/lib/prompts";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import type { LayoutDescription, Scenario, StateOutput } from "@/lib/types";

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
 * Discrete async unit: produce one scenario's output.
 * Artifacts mode: resolves from bundled JSON (scenario.name → states key, falls back to first state).
 * Live mode: calls Claude with the scenario description as generation context.
 */
async function generateScenario(
  scenario: Scenario,
  layoutDescription: LayoutDescription,
  userInstruction: string | undefined,
  live: boolean,
): Promise<StateOutput> {
  if (!live) {
    const artifact = findArtifact(layoutDescription.screenName);
    const fallback = Object.values(artifact.states)[0] ?? {
      jsx: "function GeneratedComponent(){return null;}",
      description: scenario.description,
    };
    return artifact.states[scenario.name] ?? fallback;
  }

  const userContent = `Layout description:
${JSON.stringify(layoutDescription, null, 2)}

Scenario: "${scenario.name}"
What the user sees: ${scenario.description}
${userInstruction ? `\nAdditional instruction: ${userInstruction}` : ""}

Generate this scenario. Output ONLY the GeneratedComponent function.`;

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SCENARIO_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const jsx =
    message.content[0].type === "text" ? cleanJsx(message.content[0].text) : "";

  return { jsx, description: scenario.description };
}

export async function POST(req: NextRequest) {
  try {
    const { scenarios, layoutDescription, userInstruction } =
      (await req.json()) as {
        scenarios: Scenario[];
        layoutDescription: LayoutDescription;
        userInstruction?: string;
      };

    const live = useLiveAI();

    const results = await Promise.all(
      scenarios.map((s) =>
        generateScenario(s, layoutDescription, userInstruction, live),
      ),
    );

    const states: Record<string, StateOutput> = {};
    scenarios.forEach((s, i) => {
      states[s.name] = results[i];
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
