import { readFileSync } from "fs";
import { join } from "path";

const KB = join(process.cwd(), "node_modules/@razorpay/blade-mcp/knowledgebase");

/** Map each classify archetype to a Blade pattern doc. */
const ARCHETYPE_TO_PATTERN: Record<string, string> = {
  form: "FormGroup",
  list: "ListView",
  detail: "DetailedView",
  // "data-display" → Dashboard.md uses react-router multi-file patterns (harmful for canvas).
  // The SideNav+TopNav layout is enforced instead via DASHBOARD LAYOUT PATTERN in BASE_RULES.
};

function readKb(type: "patterns" | "components", name: string): string {
  try {
    return readFileSync(join(KB, type, `${name}.md`), "utf8");
  } catch {
    return "";
  }
}

/** Trim a doc to its description block + first code example. */
function trimDoc(md: string, maxLines = 120): string {
  const lines = md.split("\n");
  // Find the first closing ```  after an opening ``` block
  let inFence = false;
  let firstFenceClose = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("```")) {
      if (!inFence) inFence = true;
      else {
        inFence = false;
        firstFenceClose = i;
      }
    }
    if (firstFenceClose > 0 && i > firstFenceClose + 2) break;
  }
  const cutAt = firstFenceClose > 0 ? firstFenceClose + 1 : maxLines;
  return lines.slice(0, Math.min(cutAt, maxLines)).join("\n");
}

/**
 * Returns Blade reference docs to inject into the generate prompt.
 * Reads from the installed @razorpay/blade-mcp knowledgebase.
 */
export function getBladeDocs(archetypes: string[]): string {
  const sections: string[] = [];

  // Pattern doc for the primary archetype
  for (const arch of archetypes) {
    const pattern = ARCHETYPE_TO_PATTERN[arch];
    if (pattern) {
      const raw = readKb("patterns", pattern);
      if (raw) {
        sections.push(
          `### Blade Pattern Reference: ${pattern}\n\n${trimDoc(raw, 100)}`,
        );
        break; // one pattern is enough
      }
    }
  }

  // Always inject the correct Blade onChange API from component docs.
  // This fixes the common AI mistake of writing (e)=>setState(e.value)
  // when Blade fires ({value})=>setState(value??'')
  const inputDocs = ["TextInput", "PasswordInput", "TextArea"]
    .map((c) => {
      const raw = readKb("components", c);
      if (!raw) return "";
      // Extract just the TypeScript types block (shows onChange signature)
      const start = raw.indexOf("## TypeScript Types");
      const end = raw.indexOf("## ", start + 1);
      if (start < 0) return "";
      const slice = raw.slice(start, end > 0 ? end : start + 800);
      return `#### ${c}\n${slice}`;
    })
    .filter(Boolean)
    .join("\n\n");

  if (inputDocs) {
    sections.push(
      `### Blade Input onChange API (CRITICAL — follow exactly)\n\n${inputDocs}`,
    );
  }

  return sections.join("\n\n---\n\n");
}
