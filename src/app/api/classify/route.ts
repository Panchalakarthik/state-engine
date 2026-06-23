import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import { findRecipe } from "@/lib/blade-recipes";

/** Lazy client so fixtures mode needs no ANTHROPIC_API_KEY. */
function getClient(): Anthropic {
  return new Anthropic();
}

/** Strip ```json fences / stray prose and parse the first JSON object. */
function parseJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const { screenName, components } = (await req.json()) as {
      screenName: string;
      components: string[];
    };

    // Default: bundled artifact (no API key, deterministic demo).
    if (!useLiveAI()) {
      const artifact = findArtifact(screenName);
      return NextResponse.json({
        archetypes: artifact.archetypes,
        scenarios: artifact.scenarios,
        layoutDescription: artifact.layoutDescription,
      });
    }

    // Blade recipe match: use predefined scenarios — no AI classification needed.
    const recipe = findRecipe(screenName);
    if (recipe) {
      return NextResponse.json({
        archetypes: recipe.archetypes,
        scenarios: recipe.scenarios,
        layoutDescription: { screenName, components: [] },
      });
    }

    // Live path (USE_LIVE_AI=true): AI derives scenarios from component props.
    let message;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        message = await getClient().messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: CLASSIFY_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content:
                `Screen name: "${screenName}"` +
                (components.length > 0
                  ? `\nComponents on screen: ${components.join(", ")}`
                  : ""),
            },
          ],
        });
        break;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 529 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    if (!message) throw new Error("All retry attempts failed");

    const text =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("classify error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Classification failed" },
      { status: 500 },
    );
  }
}
