# State Engine — Design Spec

**Date:** 2026-06-22
**Status:** Approved for implementation
**Phase:** 0 — Demo (shareable link, no auth, vertical slice first)

---

## 1. What it is

A Next.js tool that takes a screen name + component list from a designer, classifies it into behaviour archetypes, and derives every non-happy-path state (loading, empty, error, edge cases) as live, clickable Blade code. Output is simultaneously a rendered prototype and exportable React.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js App Router (TypeScript) |
| UI components | `@razorpay/blade` — real Blade, not lookalikes |
| AI | Claude API (Anthropic SDK) — server-side only |
| Styling | Blade tokens + Tailwind for layout scaffolding |
| Sessions | Browser `localStorage` |
| Auth | None (Phase 0 — link access) |
| Deploy | Vercel |

**Blade peer requirements:** `styled-components` + `BladeProvider` theme wrapper. Wrap the app in `BladeProvider` with `themeTokens={bankingTheme}` (or `paymentTheme`) at the root layout.

---

## 3. UI Layout

Two-column layout. Each column has its own header. No single shared top bar.

```
┌──────────────────────┬────────────────────────────────────────────┐
│ LEFT HEADER:         │ RIGHT HEADER:                              │
│ [Name] [⟲] [+]      │ [State▾] [🖥 📱 📲]    [Copy Figma][Export]│
├──────────────────────┼────────────────────────────────────────────┤
│                      │                                            │
│  AI text (no bubble) │           CANVAS                           │
│                      │           (dot-grid bg)                    │
│         User text →  │           Live Blade output                │
│              [○ K]   │           Layout locked                    │
│                      │                                            │
│ [+ Ask for a change ↑/⏹] │                                      │
└──────────────────────┴────────────────────────────────────────────┘
```

### Left header

- **Page name** (current session screen name) | **clock icon** → opens session history panel | **+ icon** → new session

### Right header

- **Left side:** `State: Default ▾` dropdown pill | Responsive toggle group (Desktop / Tablet / Mobile icons)
- **Right side:** `Copy to Figma` button (placeholder Phase 0) | `Export Code` button (copies JSX to clipboard)

### Left panel

- Chat-style layout. No message bubbles — all text floats directly on the dark background.
- **User message:** right-aligned, green circle avatar on the right of the text.
- **AI response:** left-aligned plain text. `Reasoning ›` and `Worked with N files ›` appear as gray chevron links (collapsible). Body text ~15px, white/light, with inline bold. Bullet lists use standard disc style.
- **Input box:** tall rounded rectangle at the bottom. `+` icon bottom-left, send button bottom-right.
  - **Send button states:**
    - Idle / ready: purple circle with ↑ arrow
    - Generating (AI working): purple circle with ⏹ white square (stop/interrupt) — clicking cancels generation
    - Returns to ↑ when generation completes
- Allows iterative refinement — sending a change request re-runs `/api/generate` with the original `layoutDescription` + the new instruction.

### Canvas (right panel)

- Dark background with dot grid.
- Renders the currently selected state as live Blade components.
- Layout is **locked** — identical structure across all states, only component state changes.
- No scrollbars at the top level; the rendered screen fills the canvas.

### Session history panel

- Opens as a floating card anchored below the clock icon.
- `Search Sessions` input at top.
- `Recents` section with list rows: session name (left) + date (right).
- Click outside to dismiss.

---

## 4. Archetype system

### Phase 0 archetypes (vertical slice → expand)

| Priority | Archetype | States derived |
|---|---|---|
| 1 (vertical slice) | **data-display** | Default, Loading, Empty, Error, Partial data |
| 2 | **list** | Loading, Empty, Populated, Error, End-of-list |
| 3 | **form** | Empty, Validating, Submitting, Success, Error |

Build data-display end-to-end first. Add list and form once the pipeline is confirmed working.

### Classification

Input: screen name (text) + component checklist (checkboxes). The classify endpoint maps these to one or more archetypes. Classification is done by Claude with a focused system prompt enumerating the archetype rules.

Phase 0 does **not** accept a pasted design image — text + checklist only.

---

## 5. Architecture

### API routes

```
/api/classify   POST  { screenName, components[] }
                →     { archetypes[], layoutDescription }

/api/generate   POST  { archetypes[], layoutDescription, screenName }
                →     { states: { [stateName]: { jsx: string, description: string } } }
```

### Orchestration pattern (Option A — confirmed)

```
Frontend → POST /api/generate
                │
                ▼
        Orchestrator reads layoutDescription + archetypes
        Derives required state names from archetype rules
                │
                ▼
        Promise.all([
          generateState("loading",  layoutDescription, systemPrompt_loading),
          generateState("empty",    layoutDescription, systemPrompt_empty),
          generateState("error",    layoutDescription, systemPrompt_error),
          generateState("partial",  layoutDescription, systemPrompt_partial),
        ])
                │
                ▼
        Merge results → return { states: {...} }
```

**Each `generateState` is a discrete async unit** — isolated Claude call with a specialist system prompt. Collected via `Promise.all`, returned together. Structured so switching to SSE streaming later means replacing "collect then return" with "emit as you go" — no restructuring of the generation logic.

### Sub-agent system prompts (per state)

Each specialist prompt is scoped to one concern:
- **Loading:** skeleton patterns, shimmer on Blade components, no real data visible
- **Empty:** onboarding nudge, "get started" CTA using Blade EmptyState, zero-data copy
- **Error:** Blade Alert component (critical variant), error copy tone, retry action
- **Partial:** some components loaded, others still shimmer — progressive disclosure

All prompts share a base constraint: output valid JSX using only real `@razorpay/blade` components. No invented components.

### Blade component vocabulary

The classifier and generators are constrained to real Blade components. For Phase 0 data-display archetype, the relevant set is:

- Layout: `Box`, `Card`  
- Data: `Text`, `Heading`, `Amount`
- Loading: `Skeleton` (shimmer)
- Feedback: `Alert` (info/error/warning), `EmptyState`
- Actions: `Button`
- Display: `Badge`, `Divider`

### Layout locking

The AI generates a `layoutDescription` object (structured JSON describing the screen's component tree and their roles) during classify. Every state generator receives the same `layoutDescription` and must preserve it — only changing the `state` of each component (e.g., swap real data for Skeleton, swap content for EmptyState). This is the proof of correctness: the skeleton stays identical, only state changes.

---

## 6. Session model

```ts
interface Session {
  id: string;                    // uuid
  screenName: string;
  components: string[];          // checked component names
  archetypes: string[];          // derived by /api/classify
  layoutDescription: object;     // locked layout from classify
  states: {
    [stateName: string]: {
      jsx: string;               // generated JSX string
      description: string;       // one-line description
    };
  };
  activeState: string;           // currently displayed state
  createdAt: number;             // timestamp
  updatedAt: number;
}
```

Stored in `localStorage` as `sessions: Session[]`. Max 20 sessions (oldest pruned). On load, restore last active session.

---

## 7. State switching

The `State: Default ▾` dropdown in the top bar lists all derived states for the current session. Selecting a state:
1. Sets `activeState` on the session
2. Renders the corresponding `jsx` in the canvas via a sandboxed React renderer
3. Does NOT regenerate — uses the already-generated JSX from the session

All states are live prototypes (interactions work). Default state = happy path.

---

## 8. Export

**Phase 0:** `Export Code` button copies the active state's JSX to clipboard. Shows a brief "Copied!" toast.

**Copy to Figma:** Button present in top bar, shows "Coming soon" tooltip. Not implemented in Phase 0.

---

## 9. Canvas rendering

Generated JSX strings are rendered in the canvas using `@babel/standalone` for client-side transpilation + scoped eval:

```ts
// 1. Claude outputs JSX string (valid JSX, Blade imports assumed in scope)
// 2. @babel/standalone transpiles JSX → React.createElement calls (browser-side)
// 3. new Function('React', 'BladeComponents', ...code)(React, bladeScope)
// 4. Mount the returned component into the canvas div via ReactDOM.render / root.render
```

**Flow:**
1. `@babel/standalone` (`transform(jsxString, { presets: ['react'] })`) converts JSX to plain JS in the browser — no bundler needed at runtime.
2. The transpiled code is wrapped in a `new Function` that receives `React` and a `bladeScope` object (destructured Blade exports) as arguments.
3. The function returns the component; we render it into the canvas `div` with `ReactDOM.createRoot`.

**Constraint:** Claude must generate a single default-exported functional component. All Blade imports are injected via `bladeScope` — no `import` statements in the generated code. Claude's system prompt explicitly states this output format.

**"Ask for a change" behavior:** Sending a message in the left panel input appends the change request to the conversation, then calls `/api/generate` again with the original `layoutDescription` + the change instruction as an additional `userInstruction` field. The new states overwrite the current session's states. The conversation history in the left panel grows to show the exchange.

---

## 10. Build sequence (vertical slice first)

### Step 1 — Scaffold
New repo: `state-engine`. Next.js App Router + TypeScript + Blade setup (BladeProvider, themeTokens, styled-components SSR).

### Step 2 — UI shell
Top bar, left chat panel, canvas area. Static — no AI yet. Session history panel. Hardcoded "Sales Dashboard" session to validate layout.

### Step 3 — Classify endpoint
`/api/classify` with a focused Claude prompt. Accepts screen name + components, returns archetypes + layoutDescription. Test with Postman/curl.

### Step 4 — Generate endpoint
`/api/generate` with `Promise.all` across 3 specialist prompts (loading, empty, error). Returns state JSX strings. Test independently.

### Step 5 — Wire frontend → API
Left panel input → classify → generate → populate state dropdown → render Default in canvas.

### Step 6 — Canvas renderer
Eval-based JSX renderer with Blade scope injection. Render each state on dropdown select.

### Step 7 — Sessions
`localStorage` session persistence. History panel populated from stored sessions.

### Step 8 — Export
Copy to clipboard. "Copied!" toast.

### Step 9 — Polish + deploy
Vercel deploy. Shareable link.

---

## 11. Env vars

```
ANTHROPIC_API_KEY=sk-ant-...   # server-side only, never exposed to client
```

`.env.local` for local dev. Set in Vercel dashboard for production. The API key is never imported in any `"use client"` file.

---

## 12. Open questions (resolved)

| Question | Decision |
|---|---|
| Archetypes in Phase 0 | data-display first (vertical slice), then list + form |
| Input method | Screen name + component checklist (no image paste) |
| Export format | Copy JSX to clipboard |
| Copy to Figma | Placeholder button, Phase 2 |
| Streaming | Phase 0 uses collect-then-return; architecture is streaming-upgrade-ready |
| Auth | None for Phase 0 |
| Sessions storage | localStorage, max 20 |
