# State Engine

Give it a screen name and a list of components. It classifies the screen into a
behaviour archetype and derives **every non-happy-path state** (loading, error,
empty, …) as live, interactive [Razorpay Blade](https://blade.razorpay.com)
prototypes — with the layout locked identical across states, so only the
component _state_ changes.

## How it works

```
Screen name + components
        │
        ▼
  POST /api/classify   ──►  archetypes[] + locked layoutDescription   (Claude)
        │
        ▼
  POST /api/generate   ──►  Promise.all( generateState × N )          (Claude)
        │                    one specialist prompt per state
        ▼
  Canvas renders the selected state's JSX live:
  @babel/standalone (classic runtime) → new Function eval with Blade injected
```

- **Orchestrator** (`/api/generate`) fans out one Claude call per state in
  parallel and collects the results. Each state is a discrete async unit, so the
  collect-then-return can later be swapped for SSE streaming without touching the
  generation logic.
- **Canvas** transpiles the generated JSX in the browser and evaluates it with
  Blade components injected into scope (no `import` statements in generated code).
- **Sessions** persist to `localStorage` (max 20, newest first).

## Setup

```bash
npm install --legacy-peer-deps      # Blade's peer range predates React 19
npm run dev                         # http://localhost:3000 — works as-is
```

Try `Sales Dashboard` or `Login Page` and press Enter.

### Two modes

**Artifacts mode (default).** With no env flag, `/api/classify` and
`/api/generate` serve pre-generated outputs from `src/lib/artifacts/` (Sales
Dashboard, Login Page). No API key, no cost, deterministic — ideal for a
shareable demo. The full UX is identical: input → classify → parallel
generate → state-switching with a locked layout.

**Live AI mode (optional).** Set both in `.env.local` to do genuine Claude
generation for any screen name:

```
USE_LIVE_AI=true
ANTHROPIC_API_KEY=sk-ant-...
```

The `/api/generate` structure is the same either way — one discrete async unit
per state merged via `Promise.all`; artifacts just swap in for the live calls.

## Scripts

| Command            | Purpose                          |
| ------------------ | -------------------------------- |
| `npm run dev`      | Dev server (Turbopack)           |
| `npm run build`    | Production build                 |
| `npm test`         | Vitest unit tests                |
| `npm run lint`     | ESLint                           |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · `@razorpay/blade` +
styled-components · `@anthropic-ai/sdk` · `@babel/standalone` · Tailwind CSS v4
(layout shell only) · Vitest

## Deploy (Vercel)

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add `ANTHROPIC_API_KEY` in Project → Settings → Environment Variables.
4. Deploy.
