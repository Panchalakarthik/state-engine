/**
 * Core Blade JSX generation functions shared by /api/generate (SSE) and
 * /api/chat (AI SDK tool) routes.  No HTTP-specific code here.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { generateText } from "ai";
import { haikuModel } from "./anthropic";
import { LRUCache } from "./lru-cache";
import { getBladeDocs } from "./blade-docs";
import {
  SCENARIO_SYSTEM_PROMPT,
  ADAPT_SCENARIO_PROMPT,
  TRANSLATE_RECIPE_PROMPT,
  REFINE_PROMPT,
  buildImageContextInject,
  type ImageContext,
} from "./prompts";
import type { LayoutDescription, Scenario, StateOutput } from "./types";

// ─── Sanitization ─────────────────────────────────────────────────────────────

function remapNamedColor(color: string): string {
  const c = color.toLowerCase();
  if (c === "transparent") return "transparent";
  if (
    ["white", "snow", "ivory", "lightyellow", "beige", "mintcream", "whitesmoke", "ghostwhite"].includes(c)
  )
    return "surface.background.gray.subtle";
  if (
    ["blue", "royalblue", "cornflowerblue", "dodgerblue", "steelblue", "navy", "indigo", "violet", "purple", "darkblue"].includes(c)
  )
    return "surface.background.primary.intense";
  if (["lightblue", "aliceblue", "lavender", "lightsteelblue"].includes(c))
    return "surface.background.primary.subtle";
  if (
    ["green", "darkgreen", "lime", "limegreen", "forestgreen", "seagreen", "mediumseagreen"].includes(c)
  )
    return "surface.background.positive.intense";
  if (["lightgreen", "honeydew", "palegreen"].includes(c))
    return "surface.background.positive.subtle";
  if (["red", "crimson", "firebrick", "darkred", "tomato", "orangered"].includes(c))
    return "surface.background.negative.intense";
  if (["orange", "darkorange", "gold", "yellow"].includes(c))
    return "surface.background.notice.intense";
  return "surface.background.gray.intense";
}

export function sanitizeJsx(jsx: string): string {
  let out = jsx
    .replace(/(<Box\b[^>]*?)\s+as="[^"]*"/g, "$1")
    .replace(
      /backgroundColor="(#[^"]+|rgb[^"]+)"/g,
      'backgroundColor="surface.background.gray.intense"',
    )
    .replace(/backgroundColor="([a-zA-Z][a-zA-Z-]*)"/g, (_, color) =>
      `backgroundColor="${remapNamedColor(color)}"`,
    )
    .replace(/\bstyle=\{\{[^}]*\}\}/g, "")
    // Badge requires text children — self-closing or empty crashes at runtime
    .replace(/<Badge(\b[^>]*)\/>/g, "")
    .replace(/<Badge(\b[^>]*)>\s*<\/Badge>/g, "")
    // Badge wrapping a component (e.g. Skeleton in loading scenarios) — extract the inner component
    .replace(/<Badge\b[^>]*>\s*(<[A-Z][A-Za-z]*\b[^>]*\/>)\s*<\/Badge>/g, "$1")
    // Button requires at least one of: text children OR icon prop — self-closing/empty without icon crashes
    .replace(/<Button(\b[^>]*)\/>/g, (match, attrs) =>
      /\bicon=/.test(attrs) ? match : `<Button${attrs}>Action</Button>`,
    )
    .replace(/<Button(\b[^>]*)>\s*<\/Button>/g, (_, attrs) =>
      /\bicon=/.test(attrs) ? `<Button${attrs} />` : `<Button${attrs}>Action</Button>`,
    );

  // Loading scenario: List containing Skeleton items → replace entire List with skeleton rows.
  // ListItemText renders as <p>; Skeleton renders as <div>; div-in-p is invalid HTML.
  // Swapping out the whole List gives the shimmer-text visual without the nesting violation.
  out = out.replace(/<List\b[^>]*>([\s\S]*?)<\/List>/g, (match, inner) => {
    if (!/<Skeleton\b/.test(inner)) return match;
    const count = Math.min((inner.match(/<ListItem\b/g) ?? []).length || 3, 4);
    const widths = ["90%", "75%", "85%", "70%"];
    const rows = Array.from({ length: count })
      .map((_, i) => `  <Skeleton width="${widths[i % widths.length]}" height="16px" borderRadius="small" />`)
      .join("\n");
    return `<Box display="flex" flexDirection="column" gap="spacing.3">\n${rows}\n</Box>`;
  });

  out = out.replace(
    /(<ListItem\b[^>]*>)([\s\S]*?)(<\/ListItem>)/g,
    (_, open, inner, close) => {
      let fixed = inner;
      // Box is invalid in ListItem — replace with fragments to preserve JSX validity
      // (removing tags outright creates adjacent JSX in .map() callbacks → syntax error)
      fixed = fixed.replace(/<Box\b[^>]*>/g, "<>");
      fixed = fixed.replace(/<\/Box>/g, "</>");
      // Convert Text → ListItemText
      fixed = fixed.replace(/<Text(\b[^>]*)?>/g, "<ListItemText$1>");
      fixed = fixed.replace(/<\/Text>/g, "</ListItemText>");
      // Convert Heading → ListItemText (Heading is invalid in ListItem)
      fixed = fixed.replace(/<Heading\b[^>]*>/g, "<ListItemText>");
      fixed = fixed.replace(/<\/Heading>/g, "</ListItemText>");
      // Convert Badge → ListItemText (keep text content)
      fixed = fixed.replace(/<Badge\b[^>]*>([\s\S]*?)<\/Badge>/g, "<ListItemText>$1</ListItemText>");
      return open + fixed + close;
    },
  );

  // Text/ListItemText render as <p> — Amount/Skeleton/Counter/Spinner render as block-level divs.
  // div-in-p causes hydration errors.
  // • If <Text> wraps ONLY a single self-closing block component → strip the <Text> shell, keep the component.
  // • If <Text> has mixed content (text + block) → strip the block components from the inner content.
  out = out.replace(
    /<Text(\b[^>]*)>([\s\S]*?)<\/Text>/g,
    (match, attrs, inner) => {
      if (!/<(?:Amount|Skeleton|Counter|Spinner)\b/.test(inner)) return match;
      const trimmed = inner.trim();
      // Sole self-closing block component → unwrap (Text shell adds nothing)
      if (/^<(?:Amount|Skeleton|Counter|Spinner)\b[^>]*\/>$/.test(trimmed)) return trimmed;
      // Mixed content → strip the block components, keep surrounding text
      const stripped = trimmed
        .replace(/<Amount\b[^>]*\/>/g, "")
        .replace(/<Amount\b[^>]*>[\s\S]*?<\/Amount>/g, "")
        .replace(/<(?:Skeleton|Counter|Spinner)\b[^>]*\/>/g, "");
      return `<Text${attrs}>${stripped}</Text>`;
    },
  );
  out = out.replace(
    /(<ListItemText\b[^>]*>)([\s\S]*?)(<\/ListItemText>)/g,
    (_, open, inner, close) =>
      open + inner.replace(/<(?:Amount|Skeleton|Counter|Spinner)\b[^>]*\/>/g, "") + close,
  );

  out = out.replace(
    /\b(on[A-Z][a-zA-Z]+)=\{([a-zA-Z_$][a-zA-Z0-9_$]*\([^{()]*\))\}/g,
    "$1={() => $2}",
  );

  out = out.replace(/(<SideNav\b)(?![^>]*\bisExpanded=)/g, "$1 isExpanded={true}");
  out = out.replace(/(<SideNav\b)(?![^>]*\bposition=)/g, '$1 position="relative"');
  out = out.replace(/(<SideNavLink\b)(?![^>]*\bas=)/g, "$1 as={RouterLink}");
  out = out.replace(/\bicon=\{<([A-Za-z]+Icon)\s*\/>\}/g, "icon={$1}");

  return out;
}

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

export function cleanJsx(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:jsx|tsx|js|javascript)?\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/i, "");
  cleaned = cleaned.trim();
  if (!cleaned.endsWith("}") || !isBracketsBalanced(cleaned)) {
    throw new Error("Generated JSX was truncated. Please try again.");
  }
  return sanitizeJsx(cleaned);
}

// ─── Claude wrapper ───────────────────────────────────────────────────────────

export async function callClaude(
  system: string,
  userContent: string,
  signal?: AbortSignal,
): Promise<string> {
  const { text } = await generateText({
    model: haikuModel,
    system,
    prompt: userContent,
    maxOutputTokens: 8192,
    abortSignal: signal,
    maxRetries: 3,
  });
  return text;
}

// ─── Recipe translation (LRU-cached) ─────────────────────────────────────────

const translationCache = new LRUCache<string, string>(20);

export async function translateRecipeDoc(
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

// ─── Generation functions ─────────────────────────────────────────────────────

export async function generatePrototype(
  scenario: Scenario,
  layoutDescription: LayoutDescription,
  userInstruction: string | undefined,
  archetypes: string[],
  signal?: AbortSignal,
  imageContext?: ImageContext,
): Promise<StateOutput> {
  const bladeDocs = getBladeDocs(archetypes);
  const system = bladeDocs
    ? `${SCENARIO_SYSTEM_PROMPT}\n\n---\n\n## BLADE REFERENCE DOCS\n\n${bladeDocs}`
    : SCENARIO_SYSTEM_PROMPT;

  const imageBlock = imageContext ? buildImageContextInject(imageContext) : "";

  const userContent = `Layout description:
${JSON.stringify(layoutDescription, null, 2)}

Scenario: "prototype"
What the user sees: ${scenario.description}
${userInstruction ? `\nAdditional instruction: ${userInstruction}` : ""}${imageBlock}

Generate the prototype scenario. Output ONLY the GeneratedComponent function.`;

  const raw = await callClaude(system, userContent, signal);
  return { jsx: cleanJsx(raw), description: scenario.description };
}

export async function adaptScenario(
  prototypeJsx: string,
  scenario: Scenario,
  signal?: AbortSignal,
  imageContext?: ImageContext,
): Promise<StateOutput> {
  const imageBlock = imageContext ? buildImageContextInject(imageContext) : "";

  const userContent = `TEMPLATE JSX (prototype — do not change structure):
${prototypeJsx}

Scenario to adapt: "${scenario.name}"
What the user sees: ${scenario.description}${imageBlock}

Adapt the template for this scenario. Output ONLY the GeneratedComponent function.`;

  const raw = await callClaude(ADAPT_SCENARIO_PROMPT, userContent, signal);
  return { jsx: cleanJsx(raw), description: scenario.description };
}

export async function refinePrototype(
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
