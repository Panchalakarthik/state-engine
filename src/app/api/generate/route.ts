import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rate-limiter";
import { LRUCache } from "@/lib/lru-cache";
import {
  SCENARIO_SYSTEM_PROMPT,
  ADAPT_SCENARIO_PROMPT,
  TRANSLATE_RECIPE_PROMPT,
  REFINE_PROMPT,
} from "@/lib/prompts";
import { getBladeDocs } from "@/lib/blade-docs";
import { useLiveAI } from "@/lib/ai-mode";
import { findArtifact } from "@/lib/artifacts";
import { findRecipe } from "@/lib/blade-recipes";
import type { LayoutDescription, Scenario, StateOutput, SSEEvent } from "@/lib/types";

// ─── Zod schema ──────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  scenarios: z.array(z.object({ name: z.string(), description: z.string() })),
  layoutDescription: z.object({
    screenName: z.string(),
    components: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        role: z.string(),
        count: z.number().optional(),
      }),
    ),
  }),
  userInstruction: z.string().optional(),
  archetypes: z.array(z.string()).optional(),
  currentPrototypeJsx: z.string().optional(),
});

type GenerateInput = z.infer<typeof GenerateSchema>;

// ─── Recipe translation cache (LRU, keyed by doc content) ────────────────────
// Survives hot reloads; bounded so it can't grow unbounded on a long-running server.

const translationCache = new LRUCache<string, string>(20);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a CSS named color to the closest valid Blade backgroundColor token. */
function remapNamedColor(color: string): string {
  const c = color.toLowerCase();
  if (c === "transparent") return "transparent";
  if (["white", "snow", "ivory", "lightyellow", "beige", "mintcream", "whitesmoke", "ghostwhite"].includes(c))
    return "surface.background.gray.subtle";
  if (["blue", "royalblue", "cornflowerblue", "dodgerblue", "steelblue", "navy", "indigo", "violet", "purple", "darkblue"].includes(c))
    return "surface.background.primary.intense";
  if (["lightblue", "aliceblue", "lavender", "lightsteelblue"].includes(c))
    return "surface.background.primary.subtle";
  if (["green", "darkgreen", "lime", "limegreen", "forestgreen", "seagreen", "mediumseagreen"].includes(c))
    return "surface.background.positive.intense";
  if (["lightgreen", "honeydew", "palegreen"].includes(c))
    return "surface.background.positive.subtle";
  if (["red", "crimson", "firebrick", "darkred", "tomato", "orangered"].includes(c))
    return "surface.background.negative.intense";
  if (["orange", "darkorange", "gold", "yellow"].includes(c))
    return "surface.background.notice.intense";
  return "surface.background.gray.intense";
}

function sanitizeJsx(jsx: string): string {
  let out = jsx
    .replace(/(<Box\b[^>]*?)\s+as="[^"]*"/g, "$1")
    .replace(/backgroundColor="(#[^"]+|rgb[^"]+)"/g, 'backgroundColor="surface.background.gray.intense"')
    .replace(/backgroundColor="([a-zA-Z][a-zA-Z-]*)"/g, (_, color) =>
      `backgroundColor="${remapNamedColor(color)}"`,
    )
    .replace(/\bstyle=\{\{[^}]*\}\}/g, "");

  // Blade only accepts ListItemText inside ListItem — not Text or Box.
  out = out.replace(
    /(<ListItem\b[^>]*>)([\s\S]*?)(<\/ListItem>)/g,
    (_, open, inner, close) =>
      open +
      inner
        .replace(/<Text(\b[^>]*)?>/g, "<ListItemText$1>")
        .replace(/<\/Text>/g, "</ListItemText>") +
      close,
  );

  // Wrap bare function calls in onClick/onChange handlers to prevent "too many re-renders".
  out = out.replace(
    /\b(on[A-Z][a-zA-Z]+)=\{([a-zA-Z_$][a-zA-Z0-9_$]*\([^{()]*\))\}/g,
    "$1={() => $2}",
  );

  // SideNav: force always-expanded + relative position in canvas (no hover CSS available).
  out = out.replace(/(<SideNav\b)(?![^>]*\bisExpanded=)/g, "$1 isExpanded={true}");
  out = out.replace(/(<SideNav\b)(?![^>]*\bposition=)/g, '$1 position="relative"');

  // SideNavLink requires `as` prop — inject RouterLink stub when missing.
  out = out.replace(/(<SideNavLink\b)(?![^>]*\bas=)/g, "$1 as={RouterLink}");

  // icon prop expects a component reference, not a JSX element.
  out = out.replace(/\bicon=\{<([A-Za-z]+Icon)\s*\/>\}/g, "icon={$1}");

  return out;
}

/** Count open/close braces to detect truncated output more reliably than endsWith("}"). */
function isBracketsBalanced(code: string): boolean {
  let depth = 0;
  let inString: '"' | "'" | "`" | null = null;
  let escape = false;
  for (const ch of code) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (inString) { if (ch === inString) inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { if (--depth < 0) return false; }
  }
  return depth === 0;
}

function cleanJsx(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:jsx|tsx|js|javascript)?\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/i, "");
  cleaned = cleaned.trim();
  if (!cleaned.endsWith("}") || !isBracketsBalanced(cleaned)) {
    throw new Error("Generated JSX was truncated. Please try again.");
  }
  return sanitizeJsx(cleaned);
}

// ─── Claude call (shared across all generation functions) ─────────────────────

async function callClaude(
  system: string,
  userContent: string,
  signal?: AbortSignal,
): Promise<string> {
  let message;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      message = await anthropic.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: userContent }],
        },
        { signal },
      );
      break;
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
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

// ─── Generation functions ─────────────────────────────────────────────────────

async function translateRecipeDoc(
  patternDoc: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const docPath = join(
    process.cwd(),
    "node_modules/@razorpay/blade-mcp/knowledgebase/patterns",
    `${patternDoc}.md`,
  );
  let docContent: string;
  try {
    docContent = readFileSync(docPath, "utf8");
  } catch {
    return null;
  }

  const cached = translationCache.get(docContent);
  if (cached) return cached;

  const raw = await callClaude(TRANSLATE_RECIPE_PROMPT, docContent, signal);
  const jsx = cleanJsx(raw);
  translationCache.set(docContent, jsx);
  return jsx;
}

async function generatePrototype(
  scenario: Scenario,
  layoutDescription: LayoutDescription,
  userInstruction: string | undefined,
  archetypes: string[],
  signal?: AbortSignal,
): Promise<StateOutput> {
  const bladeDocs = getBladeDocs(archetypes);
  const system = bladeDocs
    ? `${SCENARIO_SYSTEM_PROMPT}\n\n---\n\n## BLADE REFERENCE DOCS\n\n${bladeDocs}`
    : SCENARIO_SYSTEM_PROMPT;

  const userContent = `Layout description:
${JSON.stringify(layoutDescription, null, 2)}

Scenario: "prototype"
What the user sees: ${scenario.description}
${userInstruction ? `\nAdditional instruction: ${userInstruction}` : ""}

Generate the prototype scenario. Output ONLY the GeneratedComponent function.`;

  const raw = await callClaude(system, userContent, signal);
  return { jsx: cleanJsx(raw), description: scenario.description };
}

async function adaptScenario(
  prototypeJsx: string,
  scenario: Scenario,
  signal?: AbortSignal,
): Promise<StateOutput> {
  const userContent = `TEMPLATE JSX (prototype — do not change structure):
${prototypeJsx}

Scenario to adapt: "${scenario.name}"
What the user sees: ${scenario.description}

Adapt the template for this scenario. Output ONLY the GeneratedComponent function.`;

  const raw = await callClaude(ADAPT_SCENARIO_PROMPT, userContent, signal);
  return { jsx: cleanJsx(raw), description: scenario.description };
}

async function refinePrototype(
  currentJsx: string,
  instruction: string,
  signal?: AbortSignal,
): Promise<StateOutput> {
  const userContent = `EXISTING JSX:
${currentJsx}

APPLY THIS CHANGE: ${instruction}

Output ONLY the modified GeneratedComponent function.`;

  const raw = await callClaude(REFINE_PROMPT, userContent, signal);
  return { jsx: cleanJsx(raw), description: instruction };
}

// ─── Core generation orchestrator ────────────────────────────────────────────

async function runGeneration(
  data: GenerateInput,
  signal: AbortSignal,
  send: (event: SSEEvent) => void,
): Promise<void> {
  const { scenarios, layoutDescription, userInstruction, archetypes, currentPrototypeJsx } = data;

  // Fixture mode — no API key needed, serves bundled artifacts.
  if (!useLiveAI()) {
    const artifact = findArtifact(layoutDescription.screenName);
    const fallback = Object.values(artifact.states)[0] ?? {
      jsx: "function GeneratedComponent(){return null;}",
      description: "",
    };
    for (const s of scenarios) {
      const state = artifact.states[s.name] ?? fallback;
      send({ type: "state", name: s.name, jsx: state.jsx, description: state.description });
    }
    send({ type: "done" });
    return;
  }

  const protoScenario = scenarios.find((s) => s.name === "prototype") ?? scenarios[0];
  const recipe = findRecipe(layoutDescription.screenName);

  // ── Pass 1: prototype ─────────────────────────────────────────────────────
  let protoResult: StateOutput;

  if (currentPrototypeJsx && userInstruction) {
    // Refine path: apply delta to existing JSX, preserving all handlers/structure.
    protoResult = await refinePrototype(currentPrototypeJsx, userInstruction, signal);
  } else if (recipe && !userInstruction) {
    if (recipe.patternDoc) {
      // Option B: translate blade-mcp pattern doc to canvas JSX (cached).
      const translated = await translateRecipeDoc(recipe.patternDoc, signal);
      protoResult = translated
        ? { jsx: translated, description: protoScenario.description }
        : await generatePrototype(protoScenario, layoutDescription, undefined, archetypes ?? [], signal);
    } else if (recipe.prototypeJsx) {
      // Hardcoded fallback (e.g. Login — no blade-mcp pattern doc exists).
      protoResult = { jsx: recipe.prototypeJsx, description: protoScenario.description };
    } else {
      protoResult = await generatePrototype(protoScenario, layoutDescription, undefined, archetypes ?? [], signal);
    }
  } else {
    protoResult = await generatePrototype(protoScenario, layoutDescription, userInstruction, archetypes ?? [], signal);
  }

  // Emit prototype immediately so the canvas can render without waiting for other states.
  send({ type: "state", name: protoScenario.name, jsx: protoResult.jsx, description: protoResult.description });

  // ── Pass 2: adapt remaining scenarios in PARALLEL ─────────────────────────
  // Each state is emitted as soon as it resolves — not all at once at the end.
  // Promise.allSettled ensures one failing state doesn't block the others.
  const rest = scenarios.filter((s) => s.name !== protoScenario.name);

  await Promise.allSettled(
    rest.map(async (s) => {
      try {
        const result = await adaptScenario(protoResult.jsx, s, signal);
        send({ type: "state", name: s.name, jsx: result.jsx, description: result.description });
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err;
        send({ type: "state_error", name: s.name, message: (err as Error).message ?? "Failed" });
      }
    }),
  );

  send({ type: "done" });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request", details: parsed.error.issues }), {
      status: 400,
    });
  }

  // Rate limit by IP (30 requests/min)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`generate:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
      status: 429,
    });
  }

  // Stream SSE
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  function send(event: SSEEvent) {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {});
  }

  void runGeneration(parsed.data, req.signal, send)
    .catch((err) => {
      if ((err as Error).name !== "AbortError") {
        send({ type: "error", message: (err as Error).message ?? "Generation failed" });
      }
    })
    .finally(() => writer.close().catch(() => {}));

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
