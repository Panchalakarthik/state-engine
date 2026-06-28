# Layout Skeleton Extraction — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `analyze_image` produce a `layoutSkeleton` (minimal Box/flex JSX with slot comments) alongside the existing content schema, so Haiku receives a structurally locked outer shell and cannot deviate from the Figma layout.

**Architecture:** Sonnet extracts content (labels, types, buttons) as today AND writes a `layoutSkeleton` string of only Box primitives + named slot comments. Haiku expands each slot comment into real Blade JSX with state and validation. The skeleton anchors macro structure — column ratios, panel order, stepper position — without requiring new schema fields per layout type.

**Tech Stack:** Next.js 16.2.9, AI SDK v6, Zod, Anthropic Sonnet 4.6 (analyze_image), Haiku 4.5 (generatePrototype / adaptScenario)

---

## What Changes

### 1. `src/app/api/chat/route.ts`

**`ImageContextSchema`** — add one field:
```ts
layoutSkeleton: z.string().optional(),
```

**`layout.header`** — expand from 3 fields to 9:
```ts
header: z.object({
  type: z.enum(["topnav", "simple-heading"]).catch("simple-heading"),
  hasSidebarToggle: z.boolean().catch(false),
  breadcrumb: z.string().optional(),
  hasNotificationBell: z.boolean().catch(false),
  notificationCount: z.number().optional(),
  hasAvatar: z.boolean().catch(false),
  userName: z.string().optional(),
  userRole: z.string().optional(),
  hasUserDropdown: z.boolean().catch(false),
  hasSearch: z.boolean().catch(false),
}).optional(),
```

**`ImageContext` interface** in `src/lib/prompts.ts` — mirror the same changes.

---

### 2. `src/lib/prompts.ts`

#### A. `ANALYZE_IMAGE_PROMPT` — add skeleton extraction section

Append after existing extraction rules:

```
- layoutSkeleton: Write a minimal JSX skeleton of the macro layout using ONLY these primitives:
    Box (with display, flexDirection, width, flex, gap, padding, minHeight props only)
    Named slot comments: {/* SLOT_NAME: key="value" key2=N */}

  SKELETON RULES (non-negotiable):
  • Use ONLY Box elements and slot comments — NO TextInput, NO Button, NO Heading, NO other components
  • Each distinct zone of the layout becomes a slot comment
  • Slot types and their required keys:
      {/* TOPNAV: breadcrumb="..." hasSidebarToggle=true hasNotificationBell=true notificationCount=N userName="..." userRole="..." hasAvatar=true hasUserDropdown=true */}
      {/* SIDENAV: width="230px" items=["Home","Dashboard","Onboarding Application"] active="Onboarding Application" */}
      {/* STEPPER: steps=[{n:1,title:"Application Details",subtitle:"Applicant information and program selection",active:true},{n:2,title:"Registration Fee",subtitle:"Book your seat with a registration fee.",active:false},...] */}
      {/* FORM_CONTENT: heading="Application Details" */}
      {/* CONTENT_AREA: description="main content" */}
      {/* TAB_NAV: tabs=["Tab1","Tab2"] active="Tab1" */}
      {/* SUMMARY_CARD: title="Order Summary" sticky=true */}
  • Width/flex ratios must match the Figma — estimate from visual proportion:
      Panel takes ~35% of width → width="35%"
      Panel fills remaining → flex="1"
      Fixed sidebar → width="240px" flexShrink="0"
  • Output a single valid JSX fragment (one root Box). No function wrapper, no imports.
  • If the layout is simple single-column with no special zones, output: {/* SINGLE_COLUMN */}
```

#### B. `SCENARIO_SYSTEM_PROMPT` — add skeleton injection rule

Add before SCENARIO RENDERING RULES:

```
LAYOUT SKELETON RULE — when imageContext contains a layoutSkeleton:
The skeleton defines the LOCKED macro structure of this screen. You MUST use it as your outer shell.
Replace each slot comment with the corresponding Blade JSX:
  {/* TOPNAV: breadcrumb="X" hasNotificationBell=true notificationCount=N userName="Y" userRole="Z" hasAvatar=true hasSidebarToggle=true */}
  → <TopNav>
      <TopNavBrand>
        <Box display="flex" alignItems="center" gap="spacing.3">
          {hasSidebarToggle && <Box width="28px" height="28px" border="1px solid" borderColor="surface.border.gray.muted" borderRadius="small" display="flex" alignItems="center" justifyContent="center"><MenuIcon /></Box>}
          <Heading size="medium">{institutionName}</Heading>
        </Box>
      </TopNavBrand>
      <TopNavContent><Text size="small">{breadcrumb}</Text></TopNavContent>
      <TopNavActions>
        <Box display="flex" alignItems="center" gap="spacing.4">
          {hasNotificationBell && <Box style="position:relative"><BellIcon />{notificationCount && <Badge color="negative">{notificationCount}</Badge>}</Box>}
          {hasAvatar && <Box display="flex" alignItems="center" gap="spacing.2"><Avatar name={userName} />{userName && <Box><Text size="small" weight="semibold">{userName}</Text><Text size="xsmall" color="surface.text.gray.muted">{userRole}</Text></Box>}{hasUserDropdown && <ChevronDownIcon />}</Box>}
        </Box>
      </TopNavActions>
    </TopNav>

  {/* SIDENAV: width="W" items=[...] active="X" */}
  → <Box width="W" flexShrink="0" backgroundColor="surface.background.gray.subtle" display="flex" flexDirection="column" paddingY="spacing.6" paddingX="spacing.4">
      {items.map(item => (
        <Box key={item} display="flex" alignItems="center" gap="spacing.3" padding="spacing.3" borderRadius="medium"
             backgroundColor={active === item ? "surface.background.primary.subtle" : "transparent"}
             onClick={() => setActivePage(item)} style={{cursor:"pointer"}}>
          <Text size="small" color={active === item ? "surface.text.primary.normal" : "surface.text.gray.normal"}>{item}</Text>
        </Box>
      ))}
    </Box>

  {/* STEPPER: steps=[{n,title,subtitle,active},...] */}
  → const [activeStep, setActiveStep] = useState(steps.findIndex(s => s.active) + 1 || 1);
    <Box width="200px" flexShrink="0" display="flex" flexDirection="column" gap="spacing.0" position="relative">
      {/* vertical line */}
      <Box position="absolute" left="10px" top="24px" bottom="24px" width="2px" backgroundColor="surface.background.gray.intense" />
      {steps.map(step => (
        <Box key={step.n} display="flex" gap="spacing.3" alignItems="flex-start" marginBottom="spacing.4" position="relative" zIndex="1">
          <Box width="22px" height="22px" borderRadius="full" flexShrink="0" display="flex" alignItems="center" justifyContent="center"
               backgroundColor={activeStep === step.n ? "surface.background.primary.intense" : "surface.background.gray.intense"}>
            <Text size="xsmall" color={activeStep === step.n ? "surface.text.staticWhite.normal" : "surface.text.gray.muted"} weight="semibold">{step.n}</Text>
          </Box>
          <Box>
            <Text size="small" weight={activeStep === step.n ? "semibold" : "regular"} color={activeStep === step.n ? "surface.text.gray.normal" : "surface.text.gray.muted"}>{step.title}</Text>
            {step.subtitle && <Text size="xsmall" color="surface.text.gray.muted">{step.subtitle}</Text>}
          </Box>
        </Box>
      ))}
    </Box>

  {/* FORM_CONTENT: heading="X" */}
  → <Card><CardBody>...fields from imageContext.fields using fieldRows layout...</CardBody></Card>

  {/* SUMMARY_CARD: title="X" sticky=true */}
  → <Box width="320px" flexShrink="0" alignSelf="flex-start" position="sticky" top="0">
      <Card><CardBody>...order summary content...</CardBody></Card>
    </Box>

DO NOT change the Box wrapper widths, flexDirection, or gap from the skeleton — those are exact pixel matches to the Figma.
```

---

### 3. `src/lib/generation.ts`

**`generatePrototype()`** — skeleton goes first in userContent (NOT in buildImageContextInject — that would double-inject into adaptScenario too):

```ts
const skeletonBlock = imageContext?.layoutSkeleton
  ? `LAYOUT SKELETON — use as locked outer shell, expand each {/* SLOT */} comment:\n${imageContext.layoutSkeleton}\n`
  : "";

const userContent = `${skeletonBlock}${imageBlock ? imageBlock + "\n" : ""}Layout description:
...rest unchanged...`;
```

---

## What Does NOT Change

- `classify-core.ts` — untouched
- `workspace.tsx` — untouched
- `agent-message.tsx` — untouched
- `blade-scope.ts` — untouched
- `adaptScenario()` — no skeleton injection needed (it inherits structure from prototype)
- `verifyDesignLabels()` — no changes (checks content labels, not layout)
- All session/history/persistence logic — untouched

---

## Skeleton Constraints (enforced by prompt, validated by sanitizeJsx)

The skeleton must use only:
- `Box` with props: `display`, `flexDirection`, `width`, `flex`, `flexShrink`, `gap`, `padding`, `paddingX`, `paddingY`, `minHeight`, `alignItems`, `justifyContent`, `position`, `alignSelf`, `top`, `zIndex`, `borderRadius`, `backgroundColor`
- Named slot comments: `{/* SLOT_NAME: key="value" */}`

Sonnet must NOT use: TextInput, Button, Heading, Text, Card, any form component, any data component.

The skeleton is a single JSX fragment (one root `<Box>`). No imports, no function wrapper, no state.

---

## Test Cases

| Figma layout | Skeleton output | Expected canvas result |
|---|---|---|
| Single-column form | `{/* SINGLE_COLUMN */}` | Current behavior unchanged |
| Sidebar + stepper + form (Jain Online) | SIDENAV + STEPPER + FORM_CONTENT slots | All 3 zones in correct order |
| Split login (brand left 35%, form right) | Two Box children: width="35%" + flex="1" with FORM_CONTENT | Exact ratio reproduced |
| Checkout + sticky summary (65/35) | FORM_CONTENT flex="1" + SUMMARY_CARD width="320px" sticky | Summary pinned on right |
| Dashboard with tab nav | TOPNAV + SIDENAV + TAB_NAV + CONTENT_AREA | Tabs render correctly |
