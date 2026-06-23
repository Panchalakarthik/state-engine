import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SCENARIO_SYSTEM_PROMPT, ADAPT_SCENARIO_PROMPT } from "@/lib/prompts";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import type { LayoutDescription, Scenario, StateOutput } from "@/lib/types";

function getClient(): Anthropic {
  return new Anthropic();
}

function sanitizeJsx(jsx: string): string {
  let out = jsx
    // Strip invalid `as` props from Box — Box only accepts div/section/etc.
    .replace(/(<Box\b[^>]*?)\s+as="[^"]*"/g, "$1")
    // Strip hex/rgb backgroundColor — Blade Box only accepts design tokens
    .replace(/backgroundColor="(#[^"]+|rgb[^"]+)"/g, 'backgroundColor="surface.background.gray.intense"')
    // Strip single-line style props — Blade doesn't support style={{}}
    .replace(/\bstyle=\{\{[^}]*\}\}/g, "");

  // Fix ListItem children: Blade only accepts ListItemText (not Text/Box) inside ListItem.
  out = out.replace(
    /(<ListItem\b[^>]*>)([\s\S]*?)(<\/ListItem>)/g,
    (_, open, inner, close) =>
      open +
      inner
        .replace(/<Text(\b[^>]*)?>/g, "<ListItemText$1>")
        .replace(/<\/Text>/g, "</ListItemText>") +
      close,
  );

  // Fix "too many re-renders": event handlers with immediate invocations like
  // onClick={handleSubmit()} or onClick={setLoading(true)} — wrap in arrow function.
  // Matches: onXxx={identifier(anything without nested braces or parens)}
  out = out.replace(
    /\b(on[A-Z][a-zA-Z]+)=\{([a-zA-Z_$][a-zA-Z0-9_$]*\([^{()]*\))\}/g,
    "$1={() => $2}",
  );

  return out;
}

function cleanJsx(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:jsx|tsx|js|javascript)?\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/i, "");
  cleaned = cleaned.trim();
  if (!cleaned.endsWith("}")) {
    throw new Error(
      "Generated JSX was truncated (hit token limit). Regenerate or describe a simpler screen.",
    );
  }
  return sanitizeJsx(cleaned);
}

async function callClaude(
  system: string,
  userContent: string,
): Promise<string> {
  let message;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      message = await getClient().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: userContent }],
      });
      break;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 529 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  if (!message) throw new Error("All retry attempts failed");
  return message.content[0].type === "text" ? message.content[0].text : "";
}

/** Pass 1: generate the prototype (fully interactive). */
async function generatePrototype(
  scenario: Scenario,
  layoutDescription: LayoutDescription,
  userInstruction: string | undefined,
): Promise<StateOutput> {
  const userContent = `Layout description:
${JSON.stringify(layoutDescription, null, 2)}

Scenario: "prototype"
What the user sees: ${scenario.description}
${userInstruction ? `\nAdditional instruction: ${userInstruction}` : ""}

Generate the prototype scenario. Output ONLY the GeneratedComponent function.`;

  const raw = await callClaude(SCENARIO_SYSTEM_PROMPT, userContent);
  return { jsx: cleanJsx(raw), description: scenario.description };
}

/** Pass 2: adapt the prototype JSX to a different scenario state. */
async function adaptScenario(
  prototypeJsx: string,
  scenario: Scenario,
): Promise<StateOutput> {
  const userContent = `TEMPLATE JSX (prototype — do not change structure):
${prototypeJsx}

Scenario to adapt: "${scenario.name}"
What the user sees: ${scenario.description}

Adapt the template for this scenario. Output ONLY the GeneratedComponent function.`;

  const raw = await callClaude(ADAPT_SCENARIO_PROMPT, userContent);
  return { jsx: cleanJsx(raw), description: scenario.description };
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
    const states: Record<string, StateOutput> = {};

    if (!live) {
      const artifact = findArtifact(layoutDescription.screenName);
      const fallback = Object.values(artifact.states)[0] ?? {
        jsx: "function GeneratedComponent(){return null;}",
        description: "",
      };
      for (const s of scenarios) {
        states[s.name] = artifact.states[s.name] ?? fallback;
      }
      return NextResponse.json({ states });
    }

    // Pass 1: prototype (always first scenario)
    const protoScenario = scenarios.find((s) => s.name === "prototype") ?? scenarios[0];
    const protoResult = await generatePrototype(protoScenario, layoutDescription, userInstruction);
    states[protoScenario.name] = protoResult;

    // Pass 2: adapt all other scenarios from the prototype template
    for (const s of scenarios) {
      if (s.name === protoScenario.name) continue;
      states[s.name] = await adaptScenario(protoResult.jsx, s);
    }

    return NextResponse.json({ states });
  } catch (err) {
    console.error("generate error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Generation failed" },
      { status: 500 },
    );
  }
}
