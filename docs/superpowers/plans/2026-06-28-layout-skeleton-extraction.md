# Layout Skeleton Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `analyze_image` produce a `layoutSkeleton` (minimal Box/flex JSX with named slot comments) alongside the existing content schema, so Haiku receives a structurally locked outer shell and cannot deviate from the Figma layout.

**Architecture:** Sonnet extracts content labels + writes a Box-only skeleton with slot comments for each visual zone (TOPNAV, SIDENAV, STEPPER, FORM_CONTENT, etc.). Haiku expands each slot comment into real Blade JSX with state and validation, but cannot change the macro structure — widths, panel order, and column ratios are locked in the skeleton.

**Tech Stack:** Next.js 16.2.9, AI SDK v6, Zod, TypeScript, Anthropic Sonnet 4.6 (analyze_image), Haiku 4.5 (generatePrototype)

---

## File Map

| File | What changes |
|------|-------------|
| `src/app/api/chat/route.ts` | Add `layoutSkeleton` to `ImageContextSchema`; expand `layout.header` from 3 → 9 fields |
| `src/lib/prompts.ts` | Mirror schema changes in `ImageContext` interface; add skeleton extraction rules to `ANALYZE_IMAGE_PROMPT`; add slot expansion templates to `SCENARIO_SYSTEM_PROMPT` |
| `src/lib/generation.ts` | Prepend `skeletonBlock` to `userContent` in `generatePrototype()` |

No other files change.

---

### Task 1: Expand `ImageContextSchema` in `route.ts`

**Files:**
- Modify: `src/app/api/chat/route.ts:109-115` (layout.header) and `src/app/api/chat/route.ts:164` (after statusIndicators)

- [ ] **Step 1: Replace `layout.header` object (lines 109–115)**

Find this exact block:
```typescript
    header: z
      .object({
        type: z.enum(["topnav", "simple-heading"]).catch("simple-heading"),
        hasAvatar: z.boolean().catch(false),
        hasSearch: z.boolean().catch(false),
      })
      .optional(),
```

Replace with:
```typescript
    header: z
      .object({
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
      })
      .optional(),
```

- [ ] **Step 2: Add `layoutSkeleton` after `statusIndicators` (line 164)**

Find:
```typescript
  statusIndicators: z.array(z.string().catch("")).optional(),
});
```

Replace with:
```typescript
  statusIndicators: z.array(z.string().catch("")).optional(),
  layoutSkeleton: z.string().optional(),
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd /c/Users/panch/state-engine && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors. If errors appear, they will be in `route.ts` — fix the Zod syntax (`.catch()` must be called on each z.xxx()).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: expand ImageContextSchema with layoutSkeleton and full header fields"
```

---

### Task 2: Update `ImageContext` interface in `prompts.ts`

**Files:**
- Modify: `src/lib/prompts.ts` — `ImageContext` interface (around line 566)

The `ImageContext` TypeScript interface must mirror the Zod schema exactly so `buildImageContextInject()` and `generatePrototype()` have correct types.

- [ ] **Step 1: Expand `layout.header` in the interface**

Find:
```typescript
    header?: {
      type: "topnav" | "simple-heading";
      hasAvatar: boolean;
      hasSearch: boolean;
    };
```

Replace with:
```typescript
    header?: {
      type: "topnav" | "simple-heading";
      hasSidebarToggle: boolean;
      breadcrumb?: string;
      hasNotificationBell: boolean;
      notificationCount?: number;
      hasAvatar: boolean;
      userName?: string;
      userRole?: string;
      hasUserDropdown: boolean;
      hasSearch: boolean;
    };
```

- [ ] **Step 2: Add `layoutSkeleton` to the interface**

Find (the closing brace of the ImageContext interface, after `statusIndicators`):
```typescript
  statusIndicators: string[];
}
```

Replace with:
```typescript
  statusIndicators: string[];
  layoutSkeleton?: string;
}
```

- [ ] **Step 3: Update header extraction description in `ANALYZE_IMAGE_PROMPT`**

Find:
```typescript
- layout.header: if a top nav bar is present, record its type, whether an avatar and search are shown
```

Replace with:
```typescript
- layout.header: if a top nav bar is present, record ALL of these:
    • type: "topnav" if it spans full width, "simple-heading" if just a title
    • hasSidebarToggle: true if there is a ☰ or □ icon to collapse/expand the sidebar
    • breadcrumb: exact label shown in the center of the nav bar (e.g. "Onboarding Application")
    • hasNotificationBell: true if a bell icon is present
    • notificationCount: the badge number on the bell (e.g. 10), if shown
    • hasAvatar: true if a user avatar/initials circle is shown
    • userName: exact name shown beside the avatar (e.g. "Neha Naikamal")
    • userRole: the role/subtitle beneath the name (e.g. "New Student")
    • hasUserDropdown: true if there is a ▾ dropdown chevron beside the user name
    • hasSearch: true if a search input is shown
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors. If you get "Property X does not exist on type ImageContext", the interface and schema are out of sync — re-check the field names match exactly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: expand ImageContext interface and header extraction rules"
```

---

### Task 3: Add skeleton extraction rules to `ANALYZE_IMAGE_PROMPT`

**Files:**
- Modify: `src/lib/prompts.ts` — append to `ANALYZE_IMAGE_PROMPT` before its closing backtick (currently line 564)

- [ ] **Step 1: Add skeleton extraction rules**

Find:
```typescript
- statusIndicators: list every distinct status label visible (e.g. "Completed", "Current Step", "Pending")

If a value is not visible, omit that optional field rather than guessing.`;
```

Replace with:
```typescript
- statusIndicators: list every distinct status label visible (e.g. "Completed", "Current Step", "Pending")
- layoutSkeleton: Write a minimal JSX skeleton of the macro layout.
    USE ONLY: <Box> elements with props: display, flexDirection, width, flex, flexShrink, gap, padding, paddingX, paddingY, minHeight, alignItems, alignSelf
    NO other components — no TextInput, no Button, no Heading, no Card, nothing else.
    Each distinct visual zone becomes a named slot comment. SLOT TYPES:

    {/* TOPNAV: hasSidebarToggle=true breadcrumb="Onboarding Application" hasNotificationBell=true notificationCount=10 hasAvatar=true userName="Neha Naikamal" userRole="New Student" hasUserDropdown=true */}
    {/* SIDENAV: width="230px" items=["Home","Dashboard","Onboarding Application"] active="Onboarding Application" */}
    {/* STEPPER: steps=[{"n":1,"title":"Application Details","subtitle":"Applicant info","active":true},{"n":2,"title":"Registration Fee","subtitle":"Book your seat","active":false}] */}
    {/* FORM_CONTENT: heading="Application Details" */}
    {/* CONTENT_AREA: description="main content" */}
    {/* TAB_NAV: tabs=["Overview","Payments"] active="Overview" */}
    {/* SUMMARY_CARD: title="Order Summary" sticky=true */}

    WIDTH RULES — must match Figma proportions:
    • Panel takes ~35% → width="35%", fills remaining → flex="1", fixed sidebar → width="240px" flexShrink="0"
    • Fixed stepper column → width="200px" flexShrink="0"
    • Sticky summary → width="320px" flexShrink="0"

    OUTPUT: one root <Box> JSX fragment — no imports, no function wrapper.
    If layout is a plain single-column with no special zones, output exactly: {/* SINGLE_COLUMN */}

    EXAMPLE for a sidebar + stepper + form layout:
    <Box display="flex" flexDirection="column" minHeight="100vh">
      {/* TOPNAV: hasSidebarToggle=true breadcrumb="Onboarding Application" hasNotificationBell=true notificationCount=10 hasAvatar=true userName="Neha Naikamal" userRole="New Student" hasUserDropdown=true */}
      <Box display="flex" flex="1">
        {/* SIDENAV: width="230px" items=["Home","Dashboard","Onboarding Application"] active="Onboarding Application" */}
        <Box display="flex" flex="1" padding="spacing.6" gap="spacing.6">
          {/* STEPPER: steps=[{"n":1,"title":"Application Details","subtitle":"Applicant information and program selection","active":true},{"n":2,"title":"Registration Fee","subtitle":"Book your seat with a registration fee.","active":false},{"n":3,"title":"Program Fee","subtitle":"Payment and Loan Option","active":false},{"n":4,"title":"Applicant KYC","subtitle":"Identification details","active":false},{"n":5,"title":"Personal Details","subtitle":"Communication, Guardian","active":false},{"n":6,"title":"Education and Documents","subtitle":"Proof of Education details","active":false}] */}
          <Box flex="1">
            {/* FORM_CONTENT: heading="Application Details" */}
          </Box>
        </Box>
      </Box>
    </Box>

If a value is not visible, omit that optional field rather than guessing.`;
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors. The prompt string is pure text inside a template literal — syntax errors here are unclosed backticks or unescaped `${}`. Check that no curly-brace expressions were accidentally introduced.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: add layoutSkeleton extraction rules to ANALYZE_IMAGE_PROMPT"
```

---

### Task 4: Add slot expansion templates to `SCENARIO_SYSTEM_PROMPT`

**Files:**
- Modify: `src/lib/prompts.ts` — insert LAYOUT SKELETON RULE section inside `SCENARIO_SYSTEM_PROMPT`, before the `SCENARIO RENDERING RULES:` line (currently around line 410)

- [ ] **Step 1: Insert LAYOUT SKELETON RULE block**

Find this exact line in `SCENARIO_SYSTEM_PROMPT`:
```typescript
SCENARIO RENDERING RULES:
```

Insert BEFORE that line (add a blank line between the new block and SCENARIO RENDERING RULES):
```typescript
LAYOUT SKELETON RULE — when the user content includes a "LAYOUT SKELETON" block:
The skeleton defines the LOCKED macro structure. Use it as your outer shell.
Expand each {/* SLOT_NAME: key="value" */} comment with the Blade JSX below.
NEVER change Box widths, flex values, flexDirection, gap, or padding from the skeleton — they encode the exact Figma proportions.

{/* TOPNAV: hasSidebarToggle=BOOL breadcrumb="TEXT" hasNotificationBell=BOOL notificationCount=N hasAvatar=BOOL userName="NAME" userRole="ROLE" hasUserDropdown=BOOL */}
→ Expand to:
  <TopNav>
    <TopNavBrand>
      <Box display="flex" alignItems="center" gap="spacing.3">
        {hasSidebarToggle_VALUE && <Box width="28px" height="28px" borderRadius="medium" display="flex" alignItems="center" justifyContent="center"><MenuIcon /></Box>}
        <Heading size="medium">INSTITUTION_NAME_FROM_ASSETS</Heading>
      </Box>
    </TopNavBrand>
    <TopNavContent><Text size="small" color="surface.text.gray.muted">breadcrumb_VALUE</Text></TopNavContent>
    <TopNavActions>
      <Box display="flex" alignItems="center" gap="spacing.4">
        {hasNotificationBell_VALUE && (
          <Box display="flex" alignItems="center" gap="spacing.2">
            <BellIcon />
            {notificationCount_VALUE > 0 && <Badge color="negative">{notificationCount_VALUE}</Badge>}
          </Box>
        )}
        {hasAvatar_VALUE && (
          <Box display="flex" alignItems="center" gap="spacing.3">
            <Avatar name="userName_VALUE" />
            <Box display="flex" flexDirection="column">
              <Text size="small" weight="semibold">userName_VALUE</Text>
              <Text size="xsmall" color="surface.text.gray.muted">userRole_VALUE</Text>
            </Box>
            {hasUserDropdown_VALUE && <ChevronDownIcon />}
          </Box>
        )}
      </Box>
    </TopNavActions>
  </TopNav>

{/* SIDENAV: width="W" items=["Item1","Item2"] active="ActiveItem" */}
→ Expand to:
  const [activePage, setActivePage] = useState("ActiveItem");
  <Box width="W" flexShrink="0" backgroundColor="surface.background.gray.subtle"
       display="flex" flexDirection="column" paddingY="spacing.6" paddingX="spacing.4">
    {["Item1","Item2",...].map((item) => (
      <Box key={item} display="flex" alignItems="center" gap="spacing.3" padding="spacing.3"
           borderRadius="medium"
           backgroundColor={activePage === item ? "surface.background.primary.subtle" : "transparent"}
           onClick={() => setActivePage(item)}>
        <Text size="small" color={activePage === item ? "surface.text.primary.normal" : "surface.text.gray.normal"}>{item}</Text>
      </Box>
    ))}
  </Box>

{/* STEPPER: steps=[{"n":N,"title":"T","subtitle":"S","active":BOOL},...] */}
→ Expand to:
  const steps = [/* paste the steps array from the slot comment verbatim */];
  const [activeStep, setActiveStep] = useState(steps.find((s) => s.active)?.n ?? 1);
  <Box width="200px" flexShrink="0" display="flex" flexDirection="column">
    {steps.map((step, idx) => {
      const isLast = idx === steps.length - 1;
      return (
        <Box key={step.n} display="flex" gap="spacing.3" alignItems="flex-start">
          <Box display="flex" flexDirection="column" alignItems="center">
            <Box width="22px" height="22px" borderRadius="circular" flexShrink="0"
                 display="flex" alignItems="center" justifyContent="center"
                 backgroundColor={activeStep === step.n ? "surface.background.primary.intense" : "surface.background.gray.intense"}>
              <Text size="xsmall" weight="semibold"
                    color={activeStep === step.n ? "surface.text.staticWhite.normal" : "surface.text.gray.muted"}>{step.n}</Text>
            </Box>
            {!isLast && <Box width="2px" minHeight="32px" backgroundColor="surface.background.gray.intense" />}
          </Box>
          <Box paddingBottom={isLast ? "spacing.0" : "spacing.5"} paddingLeft="spacing.1">
            <Text size="small" weight={activeStep === step.n ? "semibold" : "regular"}
                  color={activeStep === step.n ? "surface.text.gray.normal" : "surface.text.gray.muted"}>{step.title}</Text>
            {step.subtitle && <Text size="xsmall" color="surface.text.gray.muted">{step.subtitle}</Text>}
          </Box>
        </Box>
      );
    })}
  </Box>

{/* FORM_CONTENT: heading="H" */}
→ Expand to: <Card><CardBody>[Heading size="large" for H, then all form fields from imageContext.fields using fieldRows layout, then submit Button]</CardBody></Card>

{/* SUMMARY_CARD: title="T" sticky=true */}
→ Expand to:
  <Box width="320px" flexShrink="0" alignSelf="flex-start">
    <Card><CardBody>
      <Heading size="small">T</Heading>
      <Divider marginY="spacing.4" />
      [Box rows: each line item as justifyContent="space-between" with Text label + Amount value]
      <Divider marginY="spacing.4" />
      <Box display="flex" justifyContent="space-between">
        <Text size="medium" weight="semibold">Total</Text>
        <Amount value={total} currency="INR" />
      </Box>
    </CardBody></Card>
  </Box>

{/* TAB_NAV: tabs=["T1","T2"] active="T1" */}
→ Expand to:
  const [activeTab, setActiveTab] = useState("T1");
  <TabNav>
    <TabNavItems>
      {["T1","T2",...].map((tab) => (
        <TabNavItem key={tab} isActive={activeTab === tab} onClick={() => setActiveTab(tab)} as={RouterLink} href="#">{tab}</TabNavItem>
      ))}
    </TabNavItems>
  </TabNav>

{/* CONTENT_AREA: description="..." */}
→ Expand to the main content based on imageContext.sections, imageContext.fields, and scenario description.

{/* SINGLE_COLUMN */} or no layoutSkeleton → use current rendering behavior (no locked outer structure).

```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors. The most likely issue is an unescaped backtick inside the template literal — scan the added text for any ` character and escape it as `\`` if found.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: add LAYOUT SKELETON RULE with slot expansion templates to SCENARIO_SYSTEM_PROMPT"
```

---

### Task 5: Inject skeleton in `generatePrototype()` in `generation.ts`

**Files:**
- Modify: `src/lib/generation.ts:246-256` (`generatePrototype` function)

- [ ] **Step 1: Add `skeletonBlock` and prepend to `userContent`**

Find:
```typescript
  const imageBlock = imageContext ? buildImageContextInject(imageContext) : "";

  // imageBlock goes FIRST so the model sees exact labels before generating any structure
  const userContent = `${imageBlock ? imageBlock + "\n" : ""}Layout description:
```

Replace with:
```typescript
  const imageBlock = imageContext ? buildImageContextInject(imageContext) : "";

  // Skeleton goes first — locks macro layout before Haiku sees any content details
  const skeletonBlock = imageContext?.layoutSkeleton
    ? `LAYOUT SKELETON — use as locked outer shell, expand each {/* SLOT */} comment into Blade JSX:\n${imageContext.layoutSkeleton}\n`
    : "";

  const userContent = `${skeletonBlock}${imageBlock ? imageBlock + "\n" : ""}Layout description:
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors. `imageContext?.layoutSkeleton` is safe because `layoutSkeleton?: string` on the `ImageContext` interface.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generation.ts
git commit -m "feat: inject layoutSkeleton as locked outer shell in generatePrototype"
```

---

### Task 6: Deploy and verify end-to-end

- [ ] **Step 1: Deploy to production**

```bash
/c/Users/panch/AppData/Roaming/npm/vercel --prod
```

Wait for READY status.

- [ ] **Step 2: Manual smoke test — simple layout**

Upload a simple single-column form Figma image (e.g. a basic login form).
Expected:
- `analyze_image` returns `layoutSkeleton: "{/* SINGLE_COLUMN */}"` (or omits it)
- Canvas renders the same as before — no regression

- [ ] **Step 3: Manual smoke test — Jain Online onboarding frame**

Upload the Jain Online onboarding screenshot (sidebar + stepper + form).
Expected in `analyze_image` output (visible in agent message after "Analyzed"):
- `layoutSkeleton` contains TOPNAV, SIDENAV, STEPPER, FORM_CONTENT slots
- Canvas shows: TopNav with bell + user name + breadcrumb, left sidebar with active "Onboarding Application", vertical 6-step stepper, form card with 2-column field rows

- [ ] **Step 4: Verify TopNav elements**

In the rendered canvas prototype:
- ✅ TopNav shows "Onboarding Application" breadcrumb in center
- ✅ Bell icon with badge "10" in top right
- ✅ Avatar + "Neha Naikamal" + "New Student" text
- ✅ ☰ sidebar toggle icon on left
- ✅ "JAIN ONLINE" heading (or institution name from assets)

- [ ] **Step 5: Verify Stepper**

- ✅ 6 numbered steps visible on left
- ✅ Step 1 is highlighted (blue circle, bold text)
- ✅ Steps 2–6 are grayed out with subtitle text
- ✅ Connecting line between steps visible

- [ ] **Step 6: Verify form layout**

- ✅ "Name as per 10th mark-sheet" + "Email Address" are SIDE BY SIDE (2-column)
- ✅ "Country" + "Phone Number" are SIDE BY SIDE
- ✅ "Program" + "Elective" are SIDE BY SIDE
- ✅ "Save, Pay Application Fee" button is full-width at bottom
