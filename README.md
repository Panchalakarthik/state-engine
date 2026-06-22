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
cp .env.local .env.local            # then edit it — see below
npm run dev                         # http://localhost:3000
```

Set your Anthropic key in `.env.local` (server-side only, never exposed to the
client):

```
ANTHROPIC_API_KEY=sk-ant-...
```

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
