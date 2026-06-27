# Figma Image Input — Design Spec
**Date:** 2026-06-26
**Status:** Approved for implementation

---

## Goal

Allow users to paste or upload a Figma frame image as input. The engine analyzes the image, extracts exact design details, and returns a pin-to-pin matching prototype plus all relevant scenarios. Export produces production-ready React + Blade code with proper imports.

**Out of scope (next version):** Copy to Figma, JSON-based rendering migration.

---

## Data Flow

```
User pastes or uploads Figma frame (+ optional text hint)
        ↓
ChatInput → { image: base64, mimeType, text?: string }
        ↓
AI SDK message with image part + text part
        ↓
/api/chat detects image → switches agent model to Sonnet
        ↓
Tool 1: analyze_image
  → extracts: screen name, headings, section labels, field names,
              field types, button labels, badge/alert states,
              color mood, layout structure
        ↓
Tool 2: classify_screen (enhanced with extracted components + labels)
  → derives scenarios grounded in actual visible components
  → validation scenarios per field type
        ↓
Tool 3: generate_states (enhanced with imageContext)
  → uses EXACT labels from Figma (not generic placeholders)
  → maps color mood → Blade tokens
  → reproduces layout structure (single-column, sidebar, cards)
  → implements field-specific validation in prototype scenario
        ↓
Prototype + all scenarios streamed to canvas (pin-to-pin match)
        ↓
Export → production React + Blade code with imports
```

---

## Section 1: Input Layer

### ChatInput changes
- **Paperclip icon** — opens native file picker (accepts `image/png, image/jpeg, image/webp`)
- **Paste handler** — `onPaste` event captures `image/*` clipboard items; Figma's "Copy as PNG" (Cmd/Ctrl+Shift+C) works out of the box
- **Image preview** — thumbnail shown above the textarea once attached; ✕ button removes it
- **Text field** — optional; user can add context like "focus on error states only"
- **Send behavior** — unchanged; Enter or send button submits image + text together

### Message format
Uses AI SDK's standard multi-part message:
```ts
sendMessage({
  parts: [
    { type: "file", mediaType: "image/png", url: `data:image/png;base64,${base64}` },
    { type: "text", text: userText ?? "" },
  ],
});
```

Image thumbnail rendered in `chat-message.tsx` when message part type is `file`.

---

## Section 2: `analyze_image` Tool

New tool added to the chat agent. Runs first when an image is detected in the conversation.

**Input:** image (via conversation context, seen by Sonnet)

**Output schema:**
```ts
{
  screenName: string;           // e.g. "KYC Page"
  heading: string;              // exact heading text from image
  subheading?: string;          // exact subheading if present
  sections: string[];           // e.g. ["Personal Information", "Government ID"]
  fields: Array<{
    label: string;              // exact label: "Full Name", "Aadhar Number"
    type: "text" | "email" | "password" | "phone" | "date" | "number" | "textarea";
    format?: string;            // "12-digit numeric", "AAAAA9999A"
    required: boolean;
  }>;
  buttons: Array<{
    label: string;              // exact button text
    variant: "primary" | "secondary" | "tertiary";
  }>;
  badges: Array<{ label: string; color: string }>;
  alerts: Array<{ type: string; message?: string }>;
  colorMood: string;            // e.g. "light, neutral gray sections, green accent"
  layout: {
    type: "single-column" | "sidebar-content" | "split-screen" | "card-grid" | "header-tabs";
    sidebar?: {
      position: "left" | "right";
      navItems: string[];         // e.g. ["Overview", "Payments", "Customers"]
    };
    header?: {
      type: "topnav" | "simple-heading";
      hasAvatar: boolean;
      hasSearch: boolean;
    };
    sections: Array<{
      heading?: string;           // exact section heading text
      containerType: "card" | "plain";
      columns: 1 | 2 | 3;
      contentType: "form-fields" | "metric-cards" | "data-rows" | "list-items";
    }>;
  };
  assets: Array<{
    type: "logo" | "photo" | "avatar" | "icon" | "illustration";
    label: string;                // e.g. "Razorpay logo", "user profile photo"
    position: string;             // e.g. "top-left header", "card thumbnail"
    bladeFallback: string;        // e.g. "Heading with brand name", "Avatar", "gray Box placeholder"
  }>;
  statusIndicators: string[];   // e.g. ["Pending Review badge", "Application Status alert"]
}
```

---

## Section 3: Layout Analysis

Each `layout.type` maps to a specific Blade code pattern the generator already knows:

| `layout.type` | Blade pattern |
|---|---|
| `single-column` | `Box flexDirection="column"` + `Card` per section |
| `sidebar-content` | 240px `Box` sidebar + main content area (already in prompts) |
| `split-screen` | `Box flexDirection="row"` — two equal halves |
| `card-grid` | `Box flexWrap="wrap"` + `Card` components |
| `header-tabs` | `TopNav` + `TabNav` + content area |

The `analyze_image` prompt constrains layout output to these five types only. Claude Vision is asked to: identify containment (what's inside what), detect the primary layout pattern, list section headings top-to-bottom, and identify column count per section. It is NOT asked to measure pixel spacing or reproduce CSS.

**Complex/unsupported patterns** (modals, overlapping layers, absolute positioning) are mapped to the nearest available pattern — e.g., a modal becomes an inline `Alert` or `Card`.

---

## Section 4: Asset Handling

When the image contains visual assets that have no direct Blade equivalent:

| Asset type | Blade fallback |
|---|---|
| Company logo | `<Heading>` with brand name text, or `Box` with primary `backgroundColor` |
| User / profile photo | `<Avatar name="User Name" />` |
| Product / content photo | Gray `<Box>` placeholder with centered label text |
| Illustration / hero image | Gray `<Box>` placeholder with description text |
| Custom icons | Mapped to nearest Blade icon (HomeIcon, WalletIcon, SettingsIcon, etc.) |
| Background image | `backgroundColor` Blade token matching color mood |

The `assets` array in `analyze_image` output tells the generator exactly what fallback to use at each position.

---

## Section 5: Validation Derivation  

The `analyze_image` tool extracts field types and the classify step derives validation scenarios accordingly:

| Field label/type seen in image | Validation applied in prototype | Scenarios derived |
|---|---|---|
| Email | `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` | `validation-error`, `invalid-email` |
| Phone Number | 10-digit Indian format | `invalid-phone` |
| Aadhar Number | 12-digit numeric | `invalid-aadhar` |
| PAN Number | `AAAAA9999A` pattern | `invalid-pan` |
| Password | Min 8 chars | `weak-password` |
| Confirm Password | Must match password | `password-mismatch` |
| Date of Birth | Valid date | `invalid-date` |
| Any required field | Non-empty | `empty-form` (submit disabled) |

**Prototype scenario:** all fields controlled with `useState`, inline validation as derived `const` variables (not `useState`), submit button disabled until valid, submit triggers loading → error flow via `setTimeout`.

**Validation-error scenario:** all fields show `validationState="error"` with contextual `errorText` derived from field type.

---

## Section 4: Enhanced Generation

When `imageContext` is present, the generation prompts are extended with:

```
IMAGE CONTEXT — reproduce these exact details:
- Heading: "Know Your Customer (KYC)"
- Subheading: "Complete your verification to access full features"
- Sections: ["Personal Information", "Government ID"]
- Fields: [
    { label: "Full Name", type: "text", required: true },
    { label: "Date of Birth", type: "date", required: true },
    { label: "Aadhar Number", type: "text", format: "12-digit numeric" },
    { label: "Passport Number", type: "text", format: "alphanumeric" }
  ]
- Buttons: [{ label: "Submit Application", variant: "primary" }]
- Badges: [{ label: "Pending Review", color: "notice" }]
- Color mood: light, neutral gray card sections, green success accent
- Layout: single-column, card-per-section

MATCH THESE EXACTLY — use the exact label text, exact section names, exact button labels from above.
Map color mood to Blade tokens: neutral gray → surface.background.gray.subtle, green → surface.background.positive.subtle.
```

This ensures the prototype says "Know Your Customer (KYC)" not "KYC Form", uses "Submit Application" not "Submit", and applies the right Blade color tokens.

---

## Section 5: Scenario Derivation from Image

The classify step derives scenarios from the **actual components visible** in the image, not from the screen name alone:

- Submit button visible → derives: `empty-form` (disabled), `submitting` (isLoading), `success`, `validation-error`
- Status badge visible (e.g. "Pending Review") → derives: `pending`, `approved`, `rejected`
- Alert component visible → derives: `info`, `success`, `error` alert variants
- Document upload area → derives: `uploading`, `upload-error`, `uploaded`
- Data table → derives: `loading` (skeleton), `empty`, `populated`, `error`

Always includes `prototype` (first) and `loading` (skeleton) for every screen.

---

## Section 6: Export — Production-Ready Code

Currently export downloads a raw JSX string with no imports. With image input (and as an upgrade for all sessions), the export wraps the component properly:

```tsx
import React, { useState } from "react";
import {
  Box, Card, CardBody, TextInput, Button, Alert, Badge, Heading, Text
} from "@razorpay/blade/components";

export function KYCPage() {
  // ... generated component body
}
```

The export function scans the JSX string for component references and auto-generates the import list. Only components actually used are imported.

---

## Agent System Prompt Change

When image is present in the conversation, the agent uses an extended system prompt:

```
For an IMAGE input request:
1. Call analyze_image to extract screen details from the image
2. Call classify_screen with extracted screenName and components (including field labels and types)
3. Call generate_states with the classify result AND imageContext from analyze_image
```

The model is switched from Haiku → Sonnet when an image part is detected in the latest message.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `src/components/left-panel/chat-input.tsx` | Add file picker, paste handler, image preview, update `onSend` signature |
| `src/components/left-panel/index.tsx` | Pass `onSend` updated signature through |
| `src/components/workspace.tsx` | Handle image in `handleSend`, pass to `sendMessage` as parts |
| `src/components/left-panel/chat-message.tsx` | Render image thumbnail for file parts |
| `src/app/api/chat/route.ts` | Detect image, switch to Sonnet, add `analyze_image` tool, pass `imageContext` to generate |
| `src/lib/prompts.ts` | Add `ANALYZE_IMAGE_PROMPT`, extend `CLASSIFY_SYSTEM_PROMPT` and `SCENARIO_SYSTEM_PROMPT` with imageContext injection |
| `src/lib/generation.ts` | Accept optional `imageContext` in `generatePrototype` and `adaptScenario` |
| `src/lib/anthropic.ts` | Confirm `sonnetModel` is configured for vision (it already supports it) |

---

## Constraints

- Image size limit: 5MB (enforced client-side before base64 encoding)
- Accepted formats: PNG, JPG, WebP
- If no image: existing text-only flow is completely unchanged
- Blade component set is the target — non-Blade UI patterns are mapped to the closest equivalent; no warning needed
- The `messages` column migration (errno 1060 fix) is already deployed
