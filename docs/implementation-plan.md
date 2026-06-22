# State Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `state-engine` — a Next.js app where a designer inputs a screen name + components, and Claude classifies it into archetypes then generates all non-happy-path states as live, interactive Blade component prototypes in a two-column chat-canvas workspace.

**Architecture:** `/api/classify` (screen → archetypes + layoutDescription via Claude) → `/api/generate` (orchestrator fans out parallel Claude calls per state via `Promise.all`, returns merged JSX strings). Client-side canvas renders JSX via `@babel/standalone` + scoped `new Function` eval with Blade components injected. Sessions persist to `localStorage`.

**Tech Stack:** Next.js 15 App Router, TypeScript, `@razorpay/blade` + `styled-components` 6, `@anthropic-ai/sdk`, `@babel/standalone`, Tailwind CSS v3 (layout shell only), Vitest (unit tests)

**New repo location:** `C:\Users\panch\state-engine`

---

## File Structure

```
state-engine/
├── .env.local                              # ANTHROPIC_API_KEY (gitignored)
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root: StyledComponentsRegistry + Providers
│   │   ├── page.tsx                        # Renders <Workspace />
│   │   ├── globals.css                     # Dark background + Tailwind base
│   │   ├── styled-registry.tsx             # SSR fix for styled-components
│   │   └── api/
│   │       ├── classify/route.ts           # POST: screenName + components → archetypes + layoutDescription
│   │       └── generate/route.ts           # POST: archetypes + layoutDescription → { states }
│   ├── components/
│   │   ├── providers.tsx                   # "use client" — BladeProvider + bankingTheme
│   │   ├── workspace.tsx                   # "use client" — root state + layout grid
│   │   ├── left-panel/
│   │   │   ├── index.tsx                   # Left column container
│   │   │   ├── left-header.tsx             # Page name + history icon + new icon
│   │   │   ├── chat-window.tsx             # Scrollable message list
│   │   │   ├── chat-message.tsx            # Single message (user right, AI left, no bubble)
│   │   │   └── chat-input.tsx              # Tall textarea + send/stop toggle button
│   │   ├── right-panel/
│   │   │   ├── index.tsx                   # Right column container
│   │   │   ├── right-header.tsx            # State dropdown + responsive toggles + export buttons
│   │   │   └── canvas.tsx                  # "use client" — renders active state JSX via eval
│   │   ├── history-panel.tsx               # Floating session list, search, anchored to left header
│   │   └── state-dropdown.tsx              # Controlled dropdown for state switching
│   ├── lib/
│   │   ├── types.ts                        # All shared TypeScript types
│   │   ├── sessions.ts                     # localStorage CRUD (pure functions)
│   │   ├── renderer.ts                     # @babel/standalone + new Function eval
│   │   ├── blade-scope.ts                  # Blade component map injected into renderer
│   │   └── prompts.ts                      # Claude system prompts (classify + per-state)
│   ├── hooks/
│   │   ├── use-sessions.ts                 # Session list + active session state
│   │   └── use-generation.ts               # classify → generate pipeline + AbortController
│   └── __tests__/
│       ├── sessions.test.ts                # Unit tests: getSessions, saveSession, deleteSession
│       └── renderer.test.ts                # Unit tests: compileJsx output shape
```

---

## Task 1: Bootstrap the repo

**Files:**
- Create: `C:\Users\panch\state-engine\` (new git repo)
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.local`

- [ ] **Step 1: Create the repo**

```bash
cd C:\Users\panch
npx create-next-app@latest state-engine --typescript --app --src-dir --tailwind --eslint --no-import-alias
cd state-engine
git init
git add -A
git commit -m "chore: initial Next.js scaffold"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @razorpay/blade styled-components @anthropic-ai/sdk @babel/standalone
npm install -D @types/styled-components vitest @vitejs/plugin-react @babel/core
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.local**

```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

- [ ] **Step 6: Create .gitignore entry**

Ensure `.gitignore` contains:
```
.env.local
.env*.local
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: install blade, anthropic, babel, vitest"
```

---

## Task 2: Blade setup (styled-components SSR + BladeProvider)

**Files:**
- Create: `src/app/styled-registry.tsx`
- Create: `src/components/providers.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create styled-components SSR registry**

Create `src/app/styled-registry.tsx`:
```tsx
'use client';
import React, { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

export default function StyledComponentsRegistry({ children }: { children: React.ReactNode }) {
  const [sheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    sheet.instance.clearTag();
    return <>{styles}</>;
  });

  if (typeof window !== 'undefined') return <>{children}</>;

  return (
    <StyleSheetManager sheet={sheet.instance}>
      {children}
    </StyleSheetManager>
  );
}
```

- [ ] **Step 2: Create Providers component**

Create `src/components/providers.tsx`:
```tsx
'use client';
import { BladeProvider } from '@razorpay/blade/components';
import { bankingTheme } from '@razorpay/blade/tokens';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BladeProvider themeTokens={bankingTheme} colorScheme="dark">
      {children}
    </BladeProvider>
  );
}
```

- [ ] **Step 3: Update root layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';
import StyledComponentsRegistry from './styled-registry';
import Providers from '@/components/providers';

export const metadata: Metadata = {
  title: 'State Engine',
  description: 'Derive all UI states from one screen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Set dark background in globals.css**

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; }

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  background: #111111;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
```

- [ ] **Step 5: Run dev server to verify no Blade errors**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000 with no styled-components SSR warnings.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add blade provider and styled-components SSR registry"
```

---

## Task 3: TypeScript types + session utilities + tests

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/sessions.ts`
- Create: `src/__tests__/sessions.test.ts`

- [ ] **Step 1: Create types**

Create `src/lib/types.ts`:
```typescript
export interface LayoutComponent {
  id: string;
  type: string;
  role: string;
  count?: number;
}

export interface LayoutDescription {
  screenName: string;
  components: LayoutComponent[];
}

export interface StateOutput {
  jsx: string;
  description: string;
}

export interface Session {
  id: string;
  screenName: string;
  components: string[];
  archetypes: string[];
  layoutDescription: LayoutDescription;
  states: Record<string, StateOutput>;
  activeState: string;
  createdAt: number;
  updatedAt: number;
}

export type ChatMessageRole = 'user' | 'ai';
export type ChatMessageType = 'reasoning' | 'classified' | 'result' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  type?: ChatMessageType;
  content: string;
  stateNames?: string[];
  timestamp: number;
}

export type ResponsiveMode = 'desktop' | 'tablet' | 'mobile';
```

- [ ] **Step 2: Write failing test for sessions**

Create `src/__tests__/sessions.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', { localStorage: localStorageMock });

import { getSessions, saveSession, deleteSession, updateSessionState } from '@/lib/sessions';
import type { Session } from '@/lib/types';

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  screenName: 'Sales Dashboard',
  components: ['metric-cards', 'line-chart'],
  archetypes: ['data-display'],
  layoutDescription: { screenName: 'Sales Dashboard', components: [] },
  states: { default: { jsx: 'function GeneratedComponent() { return null; }', description: 'Default' } },
  activeState: 'default',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe('getSessions', () => {
  beforeEach(() => localStorageMock.clear());

  it('returns empty array when nothing stored', () => {
    expect(getSessions()).toEqual([]);
  });
});

describe('saveSession', () => {
  beforeEach(() => localStorageMock.clear());

  it('saves a new session and returns updated list', () => {
    const session = makeSession();
    const result = saveSession(session);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('session-1');
  });

  it('updates an existing session (same id)', () => {
    const session = makeSession();
    saveSession(session);
    const updated = saveSession({ ...session, screenName: 'Updated' });
    expect(updated).toHaveLength(1);
    expect(updated[0].screenName).toBe('Updated');
  });

  it('prepends new sessions (newest first)', () => {
    saveSession(makeSession({ id: 'a' }));
    const result = saveSession(makeSession({ id: 'b' }));
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('prunes to 20 sessions max', () => {
    for (let i = 0; i < 21; i++) {
      saveSession(makeSession({ id: `session-${i}` }));
    }
    expect(getSessions()).toHaveLength(20);
  });
});

describe('deleteSession', () => {
  beforeEach(() => localStorageMock.clear());

  it('removes session by id', () => {
    saveSession(makeSession({ id: 'a' }));
    saveSession(makeSession({ id: 'b' }));
    const result = deleteSession('a');
    expect(result.find(s => s.id === 'a')).toBeUndefined();
    expect(result).toHaveLength(1);
  });
});

describe('updateSessionState', () => {
  beforeEach(() => localStorageMock.clear());

  it('updates activeState for matching session', () => {
    saveSession(makeSession({ id: 'a', activeState: 'default' }));
    const result = updateSessionState('a', 'loading');
    expect(result.find(s => s.id === 'a')?.activeState).toBe('loading');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `getSessions is not defined` or similar import error.

- [ ] **Step 4: Implement sessions.ts**

Create `src/lib/sessions.ts`:
```typescript
import type { Session } from './types';

const STORAGE_KEY = 'state-engine-sessions';
const MAX_SESSIONS = 20;

export function getSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: Session): Session[] {
  const sessions = getSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  const updated =
    existingIndex >= 0
      ? sessions.map(s => (s.id === session.id ? session : s))
      : [session, ...sessions].slice(0, MAX_SESSIONS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteSession(id: string): Session[] {
  const updated = getSessions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateSessionState(id: string, activeState: string): Session[] {
  const updated = getSessions().map(s =>
    s.id === id ? { ...s, activeState, updatedAt: Date.now() } : s,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add types, session localStorage utilities, and tests"
```

---

## Task 4: Claude prompts

**Files:**
- Create: `src/lib/prompts.ts`

- [ ] **Step 1: Create prompts module**

Create `src/lib/prompts.ts`:
```typescript
export const CLASSIFY_SYSTEM_PROMPT = `You are a screen classifier for a UI state derivation engine.

Given a screen name and its UI components, classify it into archetypes and return a structured layout description.

Archetypes:
- data-display: dashboards, metric cards, charts, aggregated KPI data
- form: input fields, validation flows, submission
- list: rows or cards of repeated similar items
- detail: single entity shown in depth
- feed: chronological or infinite-scroll content

Output ONLY valid JSON. No markdown fences, no explanation. Format:
{
  "archetypes": ["data-display"],
  "layoutDescription": {
    "screenName": "string",
    "components": [
      { "id": "metric-cards", "type": "metric-card", "role": "shows aggregated KPIs", "count": 3 },
      { "id": "revenue-chart", "type": "line-chart", "role": "shows revenue trend" },
      { "id": "date-filter", "type": "date-picker", "role": "filters data by date range" },
      { "id": "transactions-table", "type": "data-table", "role": "shows recent transactions" }
    ]
  }
}`;

const BASE_RULES = `
CRITICAL OUTPUT FORMAT:
- Output ONLY a JavaScript function named exactly "GeneratedComponent"
- NO import statements
- NO export statements
- NO markdown fences or backticks
- All Blade components (Box, Card, Text, Heading, Skeleton, Alert, Button, Badge, Divider) are available as globals
- Use JSX syntax

Example of correct output format:
function GeneratedComponent() {
  return (
    <Box padding="spacing.6">
      <Text size="medium">content</Text>
    </Box>
  );
}

Blade spacing tokens: spacing.1(4px) spacing.2(8px) spacing.3(12px) spacing.4(16px) spacing.5(20px) spacing.6(24px) spacing.7(28px) spacing.8(32px)
Blade Text sizes: xsmall, small, medium, large, xlarge
Blade Heading sizes: small, medium, large, xlarge, xxlarge
Alert colors: information, positive, negative, notice`;

export const STATE_SYSTEM_PROMPTS: Record<string, string> = {
  default: `You generate the DEFAULT (happy path) state of UI screens using Razorpay Blade components.
Show the screen fully populated with realistic sample data. Use Text for values, Heading for titles.
Preserve the exact layout structure from the layoutDescription.
${BASE_RULES}`,

  loading: `You generate the LOADING state of UI screens using Razorpay Blade components.
Replace ALL data content with Blade Skeleton shimmer components. Preserve the exact layout structure.
Use <Skeleton width="120px" height="16px" /> for text, larger skeletons for cards and charts.
Do NOT show any real data. Every piece of content must be a Skeleton.
${BASE_RULES}`,

  error: `You generate the ERROR state of UI screens using Razorpay Blade components.
Show an Alert at the top with color="negative", a clear title and description, and a retry Button.
Keep the rest of the layout structure intact but use Skeleton for content areas.
<Alert color="negative" title="Failed to load data" description="Something went wrong. Please try again." isDismissible={false} />
${BASE_RULES}`,

  empty: `You generate the EMPTY state of UI screens using Razorpay Blade components.
Show a centered empty state with a helpful headline, supporting text, and a primary Button CTA.
Do NOT show any data rows, charts, or cards. Use Box with display="flex" flexDirection="column" alignItems="center".
${BASE_RULES}`,

  partial: `You generate the PARTIAL DATA state of UI screens using Razorpay Blade components.
Some components have loaded (show real data), others are still loading (show Skeleton).
For a data-display screen: metric cards show data, chart and table show Skeleton.
${BASE_RULES}`,
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Claude system prompts for classify and state generation"
```

---

## Task 5: API routes

**Files:**
- Create: `src/app/api/classify/route.ts`
- Create: `src/app/api/generate/route.ts`

- [ ] **Step 1: Create /api/classify**

Create `src/app/api/classify/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CLASSIFY_SYSTEM_PROMPT } from '@/lib/prompts';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { screenName, components } = (await req.json()) as {
    screenName: string;
    components: string[];
  };

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Screen name: "${screenName}"\nComponents on screen: ${components.join(', ')}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const result = JSON.parse(text);

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Test /api/classify manually**

Start the dev server (`npm run dev`), then in a new terminal:
```bash
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{"screenName":"Sales Dashboard","components":["metric cards","line chart","date filter","transactions table"]}'
```

Expected response:
```json
{
  "archetypes": ["data-display"],
  "layoutDescription": {
    "screenName": "Sales Dashboard",
    "components": [...]
  }
}
```

- [ ] **Step 3: Create /api/generate**

Create `src/app/api/generate/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { STATE_SYSTEM_PROMPTS } from '@/lib/prompts';
import type { LayoutDescription, StateOutput } from '@/lib/types';

const client = new Anthropic();

async function generateState(
  stateName: string,
  layoutDescription: LayoutDescription,
  userInstruction?: string,
): Promise<StateOutput> {
  const systemPrompt = STATE_SYSTEM_PROMPTS[stateName] ?? STATE_SYSTEM_PROMPTS.default;

  const userContent = `Layout description:
${JSON.stringify(layoutDescription, null, 2)}
${userInstruction ? `\nAdditional instruction: ${userInstruction}` : ''}

Generate the ${stateName.toUpperCase()} state. Output ONLY the GeneratedComponent function.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const jsx = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  return { jsx, description: `${stateName.charAt(0).toUpperCase() + stateName.slice(1)} state` };
}

export async function POST(req: NextRequest) {
  const { archetypes, layoutDescription, userInstruction } = (await req.json()) as {
    archetypes: string[];
    layoutDescription: LayoutDescription;
    userInstruction?: string;
  };

  const stateNames = archetypes.includes('data-display')
    ? ['default', 'loading', 'error']
    : ['default', 'loading', 'error'];

  const results = await Promise.all(
    stateNames.map(name => generateState(name, layoutDescription, userInstruction)),
  );

  const states: Record<string, StateOutput> = {};
  stateNames.forEach((name, i) => { states[name] = results[i]; });

  return NextResponse.json({ states });
}
```

- [ ] **Step 4: Test /api/generate manually**

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "archetypes": ["data-display"],
    "layoutDescription": {
      "screenName": "Sales Dashboard",
      "components": [
        {"id":"metric-cards","type":"metric-card","role":"shows KPIs","count":3},
        {"id":"revenue-chart","type":"line-chart","role":"shows revenue trend"}
      ]
    }
  }'
```

Expected: JSON with `states.default.jsx`, `states.loading.jsx`, `states.error.jsx` all containing `function GeneratedComponent()`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add /api/classify and /api/generate routes with parallel state generation"
```

---

## Task 6: Canvas renderer

**Files:**
- Create: `src/lib/blade-scope.ts`
- Create: `src/lib/renderer.ts`
- Create: `src/__tests__/renderer.test.ts`

- [ ] **Step 1: Write failing test for renderer**

Create `src/__tests__/renderer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { compileJsx } from '@/lib/renderer';

describe('compileJsx', () => {
  it('transforms JSX into React.createElement calls', async () => {
    const jsx = `function GeneratedComponent() { return <div>hello</div>; }`;
    const result = await compileJsx(jsx);
    expect(result).toContain('React.createElement');
    expect(result).toContain('hello');
  });

  it('throws on invalid JS', async () => {
    await expect(compileJsx('function broken( { return; }')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `compileJsx is not defined`.

- [ ] **Step 3: Create blade-scope.ts**

Create `src/lib/blade-scope.ts`:
```typescript
import {
  Box,
  Card,
  Text,
  Heading,
  Skeleton,
  Alert,
  Button,
  Badge,
  Divider,
} from '@razorpay/blade/components';

export const bladeScope: Record<string, unknown> = {
  Box,
  Card,
  Text,
  Heading,
  Skeleton,
  Alert,
  Button,
  Badge,
  Divider,
};
```

- [ ] **Step 4: Create renderer.ts**

Create `src/lib/renderer.ts`:
```typescript
type BabelStandalone = typeof import('@babel/standalone');
let babelCache: BabelStandalone | null = null;

async function getBabel(): Promise<BabelStandalone> {
  if (!babelCache) {
    babelCache = await import('@babel/standalone');
  }
  return babelCache;
}

export async function compileJsx(jsxString: string): Promise<string> {
  const Babel = await getBabel();
  const result = Babel.transform(jsxString, {
    presets: ['react'],
    filename: 'component.jsx',
  });
  if (!result.code) throw new Error('Babel transform produced no output');
  return result.code;
}

export async function evalComponent(
  jsxString: string,
  scope: Record<string, unknown>,
): Promise<React.ComponentType> {
  const React = (await import('react')).default;
  const code = await compileJsx(jsxString);
  const allScope = { React, ...scope };
  const keys = Object.keys(allScope);
  const values = Object.values(allScope);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...keys, `${code}; return GeneratedComponent;`);
  return fn(...values) as React.ComponentType;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: All renderer tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add @babel/standalone JSX renderer with blade scope injection"
```

---

## Task 7: use-generation hook

**Files:**
- Create: `src/hooks/use-generation.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-generation.ts`:
```typescript
'use client';
import { useState, useRef, useCallback } from 'react';
import type { ChatMessage, Session, LayoutDescription } from '@/lib/types';

interface UseGenerationReturn {
  messages: ChatMessage[];
  isGenerating: boolean;
  generate: (screenName: string, components: string[]) => Promise<Session | null>;
  refine: (session: Session, instruction: string) => Promise<Session | null>;
  abort: () => void;
  clearMessages: () => void;
}

function makeMsg(
  role: ChatMessage['role'],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: crypto.randomUUID(), role, content, timestamp: Date.now(), ...extra };
}

export function useGeneration(): UseGenerationReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async (screenName: string, components: string[]): Promise<Session | null> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg('user', screenName));
      push(makeMsg('ai', `Classifying ${screenName}...`, { type: 'reasoning' }));

      try {
        const classifyRes = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenName, components }),
          signal: controller.signal,
        });
        const { archetypes, layoutDescription } = (await classifyRes.json()) as {
          archetypes: string[];
          layoutDescription: LayoutDescription;
        };

        push(
          makeMsg(
            'ai',
            `Classified as ${archetypes.join(', ')}. Generating states in parallel...`,
            { type: 'classified' },
          ),
        );

        const generateRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archetypes, layoutDescription }),
          signal: controller.signal,
        });
        const { states } = await generateRes.json();
        const stateNames = Object.keys(states);

        const session: Session = {
          id: crypto.randomUUID(),
          screenName,
          components,
          archetypes,
          layoutDescription,
          states,
          activeState: 'default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        push(
          makeMsg(
            'ai',
            `${stateNames.length} states ready. Layout is locked across all states.`,
            { type: 'result', stateNames },
          ),
        );

        return session;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null;
        push(makeMsg('ai', 'Generation failed. Please try again.', { type: 'error' }));
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [push],
  );

  const refine = useCallback(
    async (session: Session, instruction: string): Promise<Session | null> => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      push(makeMsg('user', instruction));
      push(makeMsg('ai', 'Applying your change...', { type: 'reasoning' }));

      try {
        const generateRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            archetypes: session.archetypes,
            layoutDescription: session.layoutDescription,
            userInstruction: instruction,
          }),
          signal: controller.signal,
        });
        const { states } = await generateRes.json();

        const updated: Session = { ...session, states, updatedAt: Date.now() };

        push(
          makeMsg('ai', 'Done. States updated with your change.', {
            type: 'result',
            stateNames: Object.keys(states),
          }),
        );

        return updated;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return null;
        push(makeMsg('ai', 'Refinement failed.', { type: 'error' }));
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [push],
  );

  return { messages, isGenerating, generate, refine, abort, clearMessages };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add use-generation hook with classify→generate pipeline and AbortController"
```

---

## Task 8: use-sessions hook

**Files:**
- Create: `src/hooks/use-sessions.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-sessions.ts`:
```typescript
'use client';
import { useState, useEffect, useCallback } from 'react';
import { getSessions, saveSession, deleteSession, updateSessionState } from '@/lib/sessions';
import type { Session } from '@/lib/types';

interface UseSessionsReturn {
  sessions: Session[];
  activeSession: Session | null;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  persistSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActiveState: (sessionId: string, stateName: string) => void;
  startNewSession: () => void;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getSessions();
    setSessions(stored);
    if (stored.length > 0) setActiveSessionId(stored[0].id);
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  const persistSession = useCallback((session: Session) => {
    const updated = saveSession(session);
    setSessions(updated);
    setActiveSessionId(session.id);
  }, []);

  const removeSession = useCallback((id: string) => {
    const updated = deleteSession(id);
    setSessions(updated);
    if (activeSessionId === id) {
      setActiveSessionId(updated[0]?.id ?? null);
    }
  }, [activeSessionId]);

  const setActiveState = useCallback((sessionId: string, stateName: string) => {
    const updated = updateSessionState(sessionId, stateName);
    setSessions(updated);
  }, []);

  const startNewSession = useCallback(() => {
    setActiveSessionId(null);
  }, []);

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    persistSession,
    removeSession,
    setActiveState,
    startNewSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add use-sessions hook with localStorage persistence"
```

---

## Task 9: Static UI components

**Files:**
- Create: `src/components/left-panel/left-header.tsx`
- Create: `src/components/left-panel/chat-message.tsx`
- Create: `src/components/left-panel/chat-window.tsx`
- Create: `src/components/left-panel/chat-input.tsx`
- Create: `src/components/left-panel/index.tsx`
- Create: `src/components/right-panel/right-header.tsx`
- Create: `src/components/right-panel/canvas.tsx`
- Create: `src/components/right-panel/index.tsx`
- Create: `src/components/history-panel.tsx`
- Create: `src/components/state-dropdown.tsx`

- [ ] **Step 1: Left header**

Create `src/components/left-panel/left-header.tsx`:
```tsx
'use client';

interface LeftHeaderProps {
  screenName: string | null;
  onHistoryClick: () => void;
  onNewSession: () => void;
}

export default function LeftHeader({ screenName, onHistoryClick, onNewSession }: LeftHeaderProps) {
  return (
    <div className="flex items-center h-[46px] px-4 gap-2 border-b border-[#1e1e1e] flex-shrink-0">
      <span className="flex-1 text-sm font-medium text-[#f0f0f0] truncate">
        {screenName ?? 'State Engine'}
      </span>
      <button
        onClick={onHistoryClick}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[#555] hover:bg-[#1e1e1e] hover:text-[#aaa] transition-colors"
        title="History"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
      <button
        onClick={onNewSession}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[#555] hover:bg-[#1e1e1e] hover:text-[#aaa] transition-colors"
        title="New session"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Chat message**

Create `src/components/left-panel/chat-message.tsx`:
```tsx
import type { ChatMessage } from '@/lib/types';

interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageItem({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex items-start justify-end gap-2.5 mb-5">
        <span className="text-[15px] text-[#f0f0f0] text-right leading-snug pt-1">
          {message.content}
        </span>
        <div className="w-[30px] h-[30px] rounded-full bg-[#16a34a] flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 mt-0.5">
          K
        </div>
      </div>
    );
  }

  if (message.type === 'reasoning') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-[#666] mb-2.5 cursor-pointer hover:text-[#999] w-fit">
        Reasoning
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    );
  }

  if (message.type === 'classified') {
    return (
      <p className="text-[15px] text-[#f0f0f0] leading-relaxed mb-3">
        {message.content}
      </p>
    );
  }

  if (message.type === 'result') {
    return (
      <div className="mb-3">
        <p className="text-[15px] text-[#f0f0f0] leading-relaxed mb-2">
          {message.content}
        </p>
        {message.stateNames && (
          <ul className="list-disc pl-5 space-y-1.5">
            {message.stateNames.map(name => (
              <li key={name} className="text-[15px] text-[#f0f0f0]">
                <strong className="font-semibold">
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <p className="text-[15px] text-[#f87171] leading-relaxed mb-3">{message.content}</p>
    );
  }

  return (
    <p className="text-[15px] text-[#f0f0f0] leading-relaxed mb-3">{message.content}</p>
  );
}
```

- [ ] **Step 3: Chat window**

Create `src/components/left-panel/chat-window.tsx`:
```tsx
'use client';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';
import ChatMessageItem from './chat-message';

interface ChatWindowProps {
  messages: ChatMessage[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-5 pb-3 min-h-0">
      {messages.map(msg => (
        <ChatMessageItem key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Chat input with send/stop toggle**

Create `src/components/left-panel/chat-input.tsx`:
```tsx
'use client';
import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  isGenerating: boolean;
  onSend: (value: string) => void;
  onAbort: () => void;
  disabled?: boolean;
}

export default function ChatInput({ isGenerating, onSend, onAbort, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="px-3 pb-3 pt-2 border-t border-[#1e1e1e] flex-shrink-0">
      <div className="flex flex-col bg-[#1a1a1a] border border-[#2a2a2a] rounded-[14px] px-3.5 pt-4 pb-3 gap-5 min-h-[120px]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for a change"
          rows={2}
          disabled={disabled}
          className="bg-transparent border-none outline-none text-[16px] text-[#888] placeholder-[#444] resize-none font-[inherit] flex-1 leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <button className="text-[#555] hover:text-[#aaa] text-[20px] leading-none transition-colors">
            +
          </button>
          {isGenerating ? (
            <button
              onClick={onAbort}
              className="w-9 h-9 rounded-full bg-[#7c3aed] flex items-center justify-center transition-colors hover:bg-[#6d28d9]"
              title="Stop generation"
            >
              {/* Stop square */}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                <rect x="1" y="1" width="10" height="10" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className="w-9 h-9 rounded-full bg-[#7c3aed] flex items-center justify-center transition-colors hover:bg-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send"
            >
              {/* Up arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Left panel index**

Create `src/components/left-panel/index.tsx`:
```tsx
import type { ChatMessage } from '@/lib/types';
import LeftHeader from './left-header';
import ChatWindow from './chat-window';
import ChatInput from './chat-input';

interface LeftPanelProps {
  screenName: string | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  onHistoryClick: () => void;
  onNewSession: () => void;
  onSend: (value: string) => void;
  onAbort: () => void;
}

export default function LeftPanel({
  screenName,
  messages,
  isGenerating,
  onHistoryClick,
  onNewSession,
  onSend,
  onAbort,
}: LeftPanelProps) {
  return (
    <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-[#222] bg-[#111] overflow-hidden">
      <LeftHeader
        screenName={screenName}
        onHistoryClick={onHistoryClick}
        onNewSession={onNewSession}
      />
      <ChatWindow messages={messages} />
      <ChatInput
        isGenerating={isGenerating}
        onSend={onSend}
        onAbort={onAbort}
      />
    </div>
  );
}
```

- [ ] **Step 6: State dropdown**

Create `src/components/state-dropdown.tsx`:
```tsx
'use client';
import { useState, useRef, useEffect } from 'react';

interface StateDropdownProps {
  states: string[];
  activeState: string;
  onChange: (state: string) => void;
}

export default function StateDropdown({ states, activeState, onChange }: StateDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (states.length === 0) {
    return (
      <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[7px] px-3 py-1 text-[12.5px] text-[#555]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
        No states yet
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[7px] px-3 py-1 text-[12.5px] text-[#ccc] hover:bg-[#202020] transition-colors"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
        State: {activeState.charAt(0).toUpperCase() + activeState.slice(1)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden z-50">
          {states.map(state => (
            <button
              key={state}
              onClick={() => { onChange(state); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                state === activeState
                  ? 'bg-[#1e1e2e] text-[#818cf8]'
                  : 'text-[#ccc] hover:bg-[#222]'
              }`}
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Right header**

Create `src/components/right-panel/right-header.tsx`:
```tsx
'use client';
import { useState } from 'react';
import type { ResponsiveMode } from '@/lib/types';
import StateDropdown from '@/components/state-dropdown';

interface RightHeaderProps {
  states: string[];
  activeState: string;
  onStateChange: (state: string) => void;
  onExport: () => void;
}

const responsiveModes: { mode: ResponsiveMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: 'desktop',
    label: 'Desktop',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    mode: 'tablet',
    label: 'Tablet',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    mode: 'mobile',
    label: 'Mobile',
    icon: (
      <svg width="12" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="2" /><circle cx="12" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

export default function RightHeader({ states, activeState, onStateChange, onExport }: RightHeaderProps) {
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>('desktop');

  return (
    <div className="h-[46px] flex items-center px-3.5 gap-2 border-b border-[#1a1a1a] bg-[#111] flex-shrink-0">
      {/* Left: state + responsive */}
      <div className="flex items-center gap-2 flex-1">
        <StateDropdown states={states} activeState={activeState} onChange={onStateChange} />
        <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-[7px] overflow-hidden">
          {responsiveModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setResponsiveMode(mode)}
              title={label}
              className={`w-8 h-[30px] flex items-center justify-center border-r last:border-r-0 border-[#2a2a2a] transition-colors ${
                responsiveMode === mode
                  ? 'bg-[#1e1e2e] text-[#818cf8]'
                  : 'text-[#555] hover:bg-[#222] hover:text-[#bbb]'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Right: export buttons */}
      <div className="flex items-center gap-1.5">
        <button
          title="Coming soon"
          className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[7px] px-3 py-[5px] text-[12px] text-[#666] cursor-not-allowed"
        >
          <FigmaIcon />
          Copy to Figma
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[7px] px-3 py-[5px] text-[12px] text-[#bbb] hover:bg-[#202020] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Code
        </button>
      </div>
    </div>
  );
}

function FigmaIcon() {
  return (
    <svg viewBox="0 0 14 20" width="11" height="16" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 20C5.43 20 7 18.43 7 16.5V13H3.5C1.57 13 0 14.57 0 16.5C0 18.43 1.57 20 3.5 20Z" fill="#0ACF83" />
      <path d="M0 10C0 8.07 1.57 6.5 3.5 6.5H7V13.5H3.5C1.57 13.5 0 11.93 0 10Z" fill="#A259FF" />
      <path d="M0 3.5C0 1.57 1.57 0 3.5 0H7V7H3.5C1.57 7 0 5.43 0 3.5Z" fill="#F24E1E" />
      <path d="M7 0H10.5C12.43 0 14 1.57 14 3.5C14 5.43 12.43 7 10.5 7H7V0Z" fill="#FF7262" />
      <path d="M14 10C14 11.93 12.43 13.5 10.5 13.5C8.57 13.5 7 11.93 7 10C7 8.07 8.57 6.5 10.5 6.5C12.43 6.5 14 8.07 14 10Z" fill="#1ABCFE" />
    </svg>
  );
}
```

- [ ] **Step 8: Canvas component**

Create `src/components/right-panel/canvas.tsx`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { evalComponent } from '@/lib/renderer';
import { bladeScope } from '@/lib/blade-scope';
import React from 'react';
import ReactDOM from 'react-dom/client';

interface CanvasProps {
  jsx: string | null;
}

export default function Canvas({ jsx }: CanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jsx || !mountRef.current) return;

    setError(null);

    evalComponent(jsx, bladeScope)
      .then(Component => {
        if (!mountRef.current) return;
        if (!rootRef.current) {
          rootRef.current = ReactDOM.createRoot(mountRef.current);
        }
        rootRef.current.render(React.createElement(Component));
      })
      .catch(err => {
        console.error('Canvas render error:', err);
        setError(err.message ?? 'Failed to render component');
      });

    return () => {
      rootRef.current?.unmount();
      rootRef.current = null;
    };
  }, [jsx]);

  if (!jsx) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden">
        <DotGrid />
        <p className="relative z-10 text-[#333] text-sm">Enter a screen name to generate states</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden">
        <DotGrid />
        <div className="relative z-10 text-center">
          <p className="text-[#f87171] text-sm mb-2">Render error</p>
          <pre className="text-[#555] text-xs max-w-md">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden">
      <DotGrid />
      <div ref={mountRef} className="relative z-10 w-full max-w-[680px] px-6 overflow-auto max-h-full py-6" />
    </div>
  );
}

function DotGrid() {
  return (
    <div
      className="absolute inset-0 opacity-50"
      style={{
        backgroundImage: 'radial-gradient(circle, #1a2030 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
  );
}
```

- [ ] **Step 9: Right panel index**

Create `src/components/right-panel/index.tsx`:
```tsx
import type { StateOutput } from '@/lib/types';
import RightHeader from './right-header';
import Canvas from './canvas';

interface RightPanelProps {
  states: Record<string, StateOutput>;
  activeState: string;
  onStateChange: (state: string) => void;
  onExport: () => void;
}

export default function RightPanel({ states, activeState, onStateChange, onExport }: RightPanelProps) {
  const activeJsx = states[activeState]?.jsx ?? null;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
      <RightHeader
        states={Object.keys(states)}
        activeState={activeState}
        onStateChange={onStateChange}
        onExport={onExport}
      />
      <Canvas jsx={activeJsx} />
    </div>
  );
}
```

- [ ] **Step 10: History panel**

Create `src/components/history-panel.tsx`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@/lib/types';

interface HistoryPanelProps {
  open: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function HistoryPanel({
  open,
  sessions,
  activeSessionId,
  onSelect,
  onClose,
}: HistoryPanelProps) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = sessions.filter(s =>
    s.screenName.toLowerCase().includes(query.toLowerCase()),
  );

  function formatDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB');
  }

  return (
    <div
      ref={ref}
      className="absolute top-[54px] left-2 w-[320px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden z-50"
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#222]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Sessions"
          autoFocus
          className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#ccc] placeholder-[#555] font-[inherit]"
        />
      </div>
      <p className="px-3.5 pt-2.5 pb-1 text-[11px] text-[#555]">Recents</p>
      <div className="overflow-y-auto max-h-72">
        {filtered.length === 0 ? (
          <p className="px-3.5 py-3 text-[13px] text-[#444]">No sessions found</p>
        ) : (
          filtered.map(session => (
            <button
              key={session.id}
              onClick={() => { onSelect(session.id); onClose(); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] transition-colors text-left ${
                session.id === activeSessionId ? 'bg-[#1e1e2e] text-[#a5b4fc]' : 'text-[#ddd] hover:bg-[#222]'
              }`}
            >
              <span className="truncate">{session.screenName}</span>
              <span className="text-[11px] text-[#555] flex-shrink-0 ml-2">{formatDate(session.createdAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add all UI components (left panel, right panel, history, state dropdown)"
```

---

## Task 10: Workspace — wire everything together

**Files:**
- Create: `src/components/workspace.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create workspace component**

Create `src/components/workspace.tsx`:
```tsx
'use client';
import { useState, useCallback } from 'react';
import LeftPanel from './left-panel';
import RightPanel from './right-panel';
import HistoryPanel from './history-panel';
import { useGeneration } from '@/hooks/use-generation';
import { useSessions } from '@/hooks/use-sessions';
import { saveSession, updateSessionState } from '@/lib/sessions';

const DEFAULT_COMPONENTS = ['metric cards', 'line chart', 'date filter', 'transactions table'];

export default function Workspace() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { messages, isGenerating, generate, refine, abort, clearMessages } = useGeneration();
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    persistSession,
    setActiveState,
    startNewSession,
  } = useSessions();

  const handleSend = useCallback(
    async (value: string) => {
      if (activeSession) {
        // Refinement: session already exists
        const updated = await refine(activeSession, value);
        if (updated) persistSession(updated);
      } else {
        // New generation: value = screen name
        const newSession = await generate(value, DEFAULT_COMPONENTS);
        if (newSession) persistSession(newSession);
      }
    },
    [activeSession, generate, refine, persistSession],
  );

  const handleStateChange = useCallback(
    (stateName: string) => {
      if (!activeSessionId) return;
      setActiveState(activeSessionId, stateName);
    },
    [activeSessionId, setActiveState],
  );

  const handleNewSession = useCallback(() => {
    startNewSession();
    clearMessages();
  }, [startNewSession, clearMessages]);

  const handleExport = useCallback(() => {
    if (!activeSession) return;
    const jsx = activeSession.states[activeSession.activeState]?.jsx ?? '';
    navigator.clipboard.writeText(jsx).then(() => {
      // Toast: show a temporary notice
      const toast = document.createElement('div');
      toast.textContent = 'Copied!';
      toast.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:8px 20px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  }, [activeSession]);

  return (
    <div className="flex h-screen relative overflow-hidden">
      <LeftPanel
        screenName={activeSession?.screenName ?? null}
        messages={messages}
        isGenerating={isGenerating}
        onHistoryClick={() => setHistoryOpen(o => !o)}
        onNewSession={handleNewSession}
        onSend={handleSend}
        onAbort={abort}
      />
      <RightPanel
        states={activeSession?.states ?? {}}
        activeState={activeSession?.activeState ?? 'default'}
        onStateChange={handleStateChange}
        onExport={handleExport}
      />
      <HistoryPanel
        open={historyOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={id => { setActiveSessionId(id); clearMessages(); }}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx**

Replace `src/app/page.tsx`:
```tsx
import Workspace from '@/components/workspace';

export default function Home() {
  return <Workspace />;
}
```

- [ ] **Step 3: Start dev server and test end-to-end**

```bash
npm run dev
```

1. Open http://localhost:3000
2. Type `Sales Dashboard` in the input and press Enter
3. Expected: "Classifying Sales Dashboard..." reasoning appears, then states generate
4. Expected: State dropdown populates with Default / Loading / Error
5. Expected: Canvas renders the Default state Blade component
6. Switch to Loading state — canvas re-renders with Skeleton components
7. Switch to Error state — canvas shows Alert

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire workspace — classify→generate pipeline connected to UI"
```

---

## Task 11: Deploy to Vercel

**Files:**
- No new files (Vercel reads `next.config.ts` automatically)

- [ ] **Step 1: Push repo to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/state-engine.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Deploy via Vercel CLI**

```bash
npx vercel --yes
```

When prompted:
- Project name: `state-engine`
- Framework: Next.js (auto-detected)

- [ ] **Step 3: Set ANTHROPIC_API_KEY in Vercel dashboard**

In Vercel dashboard → Project → Settings → Environment Variables:
- Name: `ANTHROPIC_API_KEY`
- Value: `sk-ant-YOUR_KEY`
- Environment: Production + Preview + Development

- [ ] **Step 4: Redeploy with env var**

```bash
npx vercel --prod
```

Expected: Deployment URL printed, e.g. `https://state-engine.vercel.app`

- [ ] **Step 5: Test the deployed URL**

Open the URL, type a screen name, verify full pipeline works in production.

- [ ] **Final commit**

```bash
git add -A
git commit -m "chore: add vercel deployment"
git push
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Two-column layout with separate headers — Task 9
- [x] Left header: page name, clock, + — Task 9
- [x] Right header: state dropdown + responsive toggles + export buttons — Task 9
- [x] Chat panel: no bubbles, user right (green circle avatar), AI left — Task 9
- [x] Send button: ↑ idle → ⏹ generating → ↑ done — Task 9
- [x] /api/classify — Task 5
- [x] /api/generate with Promise.all — Task 5
- [x] Streaming-upgrade-ready (discrete units) — Task 5
- [x] canvas @babel/standalone + scoped eval — Task 6
- [x] Session localStorage with max 20 — Task 3
- [x] History panel with search — Task 9
- [x] State switching without regeneration — Task 10
- [x] Export to clipboard + toast — Task 10
- [x] Copy to Figma placeholder (disabled) — Task 9
- [x] Blade + styled-components SSR — Task 2
- [x] BladeProvider with bankingTheme — Task 2
- [x] Vertical slice: data-display, 3 states — Task 5
- [x] Vercel deploy — Task 11
