import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rate-limiter";
import { CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import { findRecipe } from "@/lib/blade-recipes";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const ClassifySchema = z.object({
  screenName: z.string().min(1).max(200),
  components: z.array(z.string()).default([]),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ClassifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const { screenName, components } = parsed.data;

  // Rate limit by IP (60 requests/min — classify is cheaper)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`classify:${ip}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Rate limit exceeded. Please wait a moment." }, { status: 429 });
  }

  // Fixture mode — no API key needed.
  if (!useLiveAI()) {
    const artifact = findArtifact(screenName);
    return NextResponse.json({
      archetypes: artifact.archetypes,
      scenarios: artifact.scenarios,
      layoutDescription: artifact.layoutDescription,
    });
  }

  // Blade recipe match — skip AI classification entirely.
  const recipe = findRecipe(screenName);
  if (recipe) {
    return NextResponse.json({
      archetypes: recipe.archetypes,
      scenarios: recipe.scenarios,
      layoutDescription: { screenName, components: [] },
    });
  }

  // Live AI classification.
  let message;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      message = await anthropic.messages.create(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: CLASSIFY_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content:
                `Screen name: "${screenName}"` +
                (components.length > 0 ? `\nComponents on screen: ${components.join(", ")}` : ""),
            },
          ],
        },
        { signal: req.signal },
      );
      break;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return NextResponse.json({ error: "Request aborted" }, { status: 499 });
      }
      const status = (err as { status?: number }).status;
      if (status === 529 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  if (!message) throw new Error("All retry attempts failed");

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  try {
    return NextResponse.json(parseJson(text));
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }
}
