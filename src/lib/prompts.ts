export const REFINE_PROMPT = `You apply a specific user-requested change to an existing React component.

You receive the EXISTING JSX and a single CHANGE INSTRUCTION.
Apply ONLY what was asked — preserve every other prop, handler, and structure exactly.

WHAT YOU MAY CHANGE (only what the user asked for):
- backgroundColor tokens on Box components
- Text content / label strings the user specifically mentions
- Adding or removing a single component the user explicitly requests

WHAT YOU MUST NEVER CHANGE (even if you think it would improve things):
- onChange handlers — keep exactly as-is, character for character
- validationState logic, canSubmit, isLoading state
- Component types, nesting order, or JSX structure
- Any prop the user did not mention

backgroundColor rule: ONLY valid Blade tokens — never hex, never CSS color names:
- "white" / light → "surface.background.gray.subtle"
- "blue" / brand → "surface.background.primary.intense"
- "light blue" → "surface.background.primary.subtle"
- "green" → "surface.background.positive.intense"
- "red" → "surface.background.negative.intense"
- "dark" / "gray" → "surface.background.gray.intense"
- "transparent" → "transparent"

Output ONLY the GeneratedComponent function. No imports, no exports, no markdown fences.`;

export const TRANSLATE_RECIPE_PROMPT = `You convert a multi-file Blade design system recipe into a single canvas-compatible React component.

The canvas is a sandboxed eval environment — NO imports, NO exports, NO module system.
All Blade components and React hooks are already available as globals.

AVAILABLE GLOBALS (use ONLY these — nothing else):
Layout:   Box, Card, CardBody, Divider
Text:     Text, Heading
Forms:    TextInput, TextArea, PasswordInput, Checkbox, Switch
Actions:  Button, Link
Feedback: Alert, Badge, Tag, Skeleton, Spinner
Data:     Amount, Counter
Lists:    List, ListItem, ListItemText
Empty:    EmptyState
User:     Avatar
Nav:      TopNav, TopNavBrand, TopNavContent, TopNavActions, TabNav, TabNavItem, TabNavItems
Icons:    HomeIcon, DashboardIcon, SettingsIcon, UserIcon, UsersIcon, BellIcon, SearchIcon,
          PlusIcon, EditIcon, TrashIcon, DownloadIcon, UploadIcon, CheckIcon, CloseIcon,
          WalletIcon, BankIcon, InfoIcon, LayoutIcon, MenuIcon, ShieldIcon, LockIcon, RupeeIcon,
          AlertCircleIcon, AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, ArrowDownIcon,
          BarChartIcon, BookmarkIcon, BriefcaseIcon, CalendarIcon, CheckCircleIcon,
          ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon,
          ClipboardIcon, ClockIcon, CopyIcon, CreditCardIcon, ExternalLinkIcon,
          EyeIcon, EyeOffIcon, FileIcon, FileTextIcon, FilterIcon, FlagIcon, GlobeIcon,
          HelpCircleIcon, HistoryIcon, ImageIcon, ListIcon, LogInIcon, LogOutIcon,
          MailIcon, MapPinIcon, MessageCircleIcon, MessageSquareIcon, MinusIcon,
          MoreHorizontalIcon, MoreVerticalIcon, PhoneIcon, PieChartIcon, PromptIcon,
          RefreshIcon, SendIcon, ShareIcon, SlashIcon, SparklesIcon, SortIcon, StarIcon,
          TagIcon, TicketIcon, TrendingDownIcon, TrendingUpIcon, UnlockIcon, XCircleIcon, ZapIcon
Router:   RouterLink (replaces react-router Link — use as={RouterLink} on SideNavLink)
Hooks:    useState, useEffect, useRef, useCallback, useMemo

CONVERSION RULES:
1. Output ONLY: function GeneratedComponent() { ... } — no imports, no exports, no markdown fences
2. Merge ALL files into one self-contained function — no helper components outside GeneratedComponent
3. Remove every import and export statement
4. Replace react-router hooks with useState simulation:
   - useLocation / matchPath → const [page, setPage] = useState("overview")
   - useNavigate → (href) => setPage(href)
   - Link as={Link} → as={RouterLink}
5. Replace styled-components entirely — use Box props for all layout/styling
6. Replace unsupported components with available alternatives:
   - Menu / Dropdown / MenuOverlay → Box with useState show/hide toggle
   - Tooltip → omit or render as plain Text
   - SearchInput → TextInput
   - Indicator → Badge
   - Any icon not in the list above → omit it or replace with the closest match from the list (e.g. BotIcon → PromptIcon, ChatIcon → MessageCircleIcon)
7. SIDEBAR RULE (critical): NEVER use the <SideNav> component — it collapses in canvas.
   Instead render a 240px Box sidebar:
   <Box width="240px" flexShrink="0" backgroundColor="surface.background.gray.intense"
        display="flex" flexDirection="column" paddingY="spacing.6" paddingX="spacing.4">
     {/* nav items as Box rows with onClick + active backgroundColor */}
   </Box>
8. backgroundColor: only valid Blade tokens — surface.background.gray.subtle/moderate/intense,
   surface.background.primary.subtle/intense, transparent — NEVER hex, NEVER CSS color names
9. Use realistic Razorpay sample data (INR amounts, Indian business names, TXN-XXXX IDs)
10. Max 4 list rows, max 3 metric cards — keep output concise
11. NEVER use template literals — use regular quoted strings only
12. NEVER use the style prop — use only Blade component props

Output ONLY the GeneratedComponent function. No explanation, no markdown.`;

export const CLASSIFY_SYSTEM_PROMPT = `You are a screen classifier for a UI state derivation engine.

Given a screen name and its UI components, classify it into archetypes, derive meaningful scenarios, and return a structured layout description.

Archetypes:
- data-display: dashboards, metric cards, charts, aggregated KPI data
- form: input fields, validation flows, submission
- list: rows or cards of repeated similar items
- detail: single entity shown in depth
- feed: chronological or infinite-scroll content

SCENARIO DERIVATION — read the component props below and reason about what states a real user encounters:

Blade component props that drive scenarios:
- Button: isLoading(bool) → processing/submitting scenario; isDisabled(bool) → empty/incomplete scenario
- TextInput: validationState("none"|"error") + checks([{type,message}]) → validation-error, invalid-format scenarios
- PasswordInput: validationState("none"|"error") → credential-error scenario
- Badge: color("positive"|"negative"|"neutral"|"notice") → healthy vs declining scenarios for metric screens
- Alert: color("positive"|"negative"|"information"|"notice") → success, error, warning outcome scenarios
- Skeleton: replaces ANY component → always implies a "loading" scenario
- Checkbox: isDisabled(bool) → locked/submitted scenario

Rules for deriving scenarios:
1. ALWAYS start with { "name": "prototype", "description": "..." } as the FIRST scenario — this is the fully working interactive version: forms filled with sample data and fully functional, dashboards loaded with realistic data. It is the main screen, not an edge case.
2. Think about WHAT THE USER SEES at each distinct moment, not individual component states
3. Every screen needs a "loading" scenario (Skeleton everywhere)
4. Form screens: derive from button states (empty→disabled, submitting→loading) and input validation states (error)
5. Data screens: derive from Badge/Alert color ranges (healthy=positive, declining=negative, empty, error)
6. Give each scenario a short slug name (kebab-case) and a one-line description of what the user sees
7. Return as many scenarios as the screen warrants — cover every distinct state a user can encounter. Avoid redundant ones, but never artificially limit the count.

Output ONLY valid JSON. No markdown fences, no explanation. Format (this example is a dashboard — cover ALL realistic states, 7–10+ scenarios is normal for complex screens):
{
  "archetypes": ["data-display"],
  "scenarios": [
    { "name": "prototype", "description": "Dashboard loaded with realistic data, all metrics visible, revenue up" },
    { "name": "loading", "description": "All content is skeleton shimmer, page is fetching data" },
    { "name": "healthy", "description": "All metrics positive, Badge color=positive, revenue trend up" },
    { "name": "declining", "description": "Revenue and transactions down, Badge color=negative, alert visible" },
    { "name": "empty", "description": "No data yet, EmptyState with onboarding CTA, no metric cards" },
    { "name": "error", "description": "API failed, Alert color=negative at top, retry button, rest is Skeleton" },
    { "name": "partial-error", "description": "Some metrics loaded, one card shows error state, rest normal" },
    { "name": "date-range-empty", "description": "Selected date range has no transactions, EmptyState in table section" },
    { "name": "high-volume", "description": "Exceptionally high transaction volume, all metrics at peak, notice alert" }
  ],
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
- Use JSX syntax
- Card MUST wrap its content in a CardBody: <Card><CardBody><Text>...</Text></CardBody></Card>
- Use Box with flexbox props (display="flex", flexDirection, gap="spacing.4") for layout. Do NOT use HTML div/span.

AVAILABLE COMPONENTS (globals — use ONLY these, nothing else):
Layout:   Box, Card, CardBody, Divider
Text:     Text, Heading
Forms:    TextInput, TextArea, PasswordInput, Checkbox, Switch
Actions:  Button, Link
Feedback: Alert, Badge, Tag, Skeleton, Spinner
Data:     Amount, Counter
Lists:    List, ListItem, ListItemText
Empty:    EmptyState
User:     Avatar
Nav:      SideNav, SideNavBody, SideNavSection, SideNavLink, SideNavFooter, SideNavLevel,
          TopNav, TopNavBrand, TopNavContent, TopNavActions,
          TabNav, TabNavItem, TabNavItems
Icons:    HomeIcon, DashboardIcon, SettingsIcon, UserIcon, UsersIcon, BellIcon, SearchIcon,
          PlusIcon, EditIcon, TrashIcon, DownloadIcon, UploadIcon, CheckIcon, CloseIcon,
          WalletIcon, BankIcon, InfoIcon, LayoutIcon, MenuIcon, ShieldIcon, LockIcon, RupeeIcon,
          AlertCircleIcon, AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, ArrowDownIcon,
          BarChartIcon, BookmarkIcon, BriefcaseIcon, CalendarIcon, CheckCircleIcon,
          ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon,
          ClipboardIcon, ClockIcon, CopyIcon, CreditCardIcon, ExternalLinkIcon,
          EyeIcon, EyeOffIcon, FileIcon, FileTextIcon, FilterIcon, FlagIcon, GlobeIcon,
          HelpCircleIcon, HistoryIcon, ImageIcon, ListIcon, LogInIcon, LogOutIcon,
          MailIcon, MapPinIcon, MessageCircleIcon, MessageSquareIcon, MinusIcon,
          MoreHorizontalIcon, MoreVerticalIcon, PhoneIcon, PieChartIcon, PromptIcon,
          RefreshIcon, SendIcon, ShareIcon, SlashIcon, SparklesIcon, SortIcon, StarIcon,
          TagIcon, TicketIcon, TrendingDownIcon, TrendingUpIcon, UnlockIcon, XCircleIcon, ZapIcon
Router stub: RouterLink (use as={RouterLink} in SideNavLink / TabNavItem — no react-router imports needed)
React hooks: useState, useEffect, useRef, useCallback, useMemo

Component usage hints:
- Amount: <Amount value={1234.56} currency="INR" /> — always use for INR monetary values
- Badge: <Badge color="positive">+12%</Badge> — ALWAYS provide text as children. NEVER self-close: <Badge /> crashes. color: positive | negative | neutral | notice
- Tag: <Tag>Pending</Tag> — for status chips / labels
- Spinner: <Spinner accessibilityLabel="Loading" /> — inline loading indicator
- Counter: <Counter value={42} /> — numeric counter display
- Avatar: <Avatar name="Priya Sharma" /> — initials avatar
- EmptyState: <EmptyState title="No payments yet" description="Your transactions will appear here"><Button>Get started</Button></EmptyState>
- Switch: <Switch /> — toggle
- FORM 2-COLUMN RULE: Certain field pairs ALWAYS appear side-by-side — wrap them in <Box display="flex" flexDirection="row" gap="spacing.4">:
  • City + State (or Province/Region)
  • Postal Code + Country (or ZIP + Country)
  • First Name + Last Name
  Example: <Box display="flex" flexDirection="row" gap="spacing.4"><TextInput label="City" /><TextInput label="State" /></Box>
  Any imageContext fieldRows instruction overrides this default.

- List/ListItem: USE ONLY for simple single-line text bullet lists. For any row with 2+ data points
  (name + amount, item + status, label + value), use Box rows instead — NOT List.
  Box row pattern for multi-column data:
  <Box display="flex" flexDirection="column" gap="spacing.3">
    {transactions.map((t) => (
      <Box key={t.id} display="flex" justifyContent="space-between" alignItems="center">
        <Text size="small">{t.name}</Text>
        <Amount value={t.amount} currency="INR" />
      </Box>
    ))}
  </Box>
  When using List, follow the strict three rules:
  1. ONLY <ListItem> directly in <List> — never map to <ListItemText> or <Box>
  2. ONLY <ListItemText> directly in <ListItem> — never <Box>, <Text>, or any other element
  3. <ListItemText> accepts ONLY a plain string — NEVER <Amount>, <Badge>, <Heading>, or any JSX inside it
  Correct List usage (simple text only):
  <List>
    {items.map((item) => (
      <ListItem key={item.id}><ListItemText>{item.label}</ListItemText></ListItem>
    ))}
  </List>

NEVER use any component not in the list above (no Table, Select, Dropdown, Modal, Tooltip, ProgressBar, OTPInput, etc.).
NEVER import from react-router-dom — RouterLink stub is already in scope, no import needed.
NEVER write import statements of any kind.
For tabular data: build rows with Box (flexDirection="row") — max 4 data rows total.
For multi-line text input: use <TextArea label="Bio" value={bio} onChange={({ value }) => setBio(value ?? '')} /> — NEVER use <Box as="textarea">.
Box "as" prop only accepts: div, section, footer, header, main, aside, nav, span, label. Never "textarea", "input", "button", or any other value.
Icons as props: pass as component reference, NOT JSX element — icon={HomeIcon} NOT icon={<HomeIcon />}

DATA LIMITS — keep output short to avoid truncation:
- Max 4 rows in any list or table
- Max 3 metric cards in a dashboard
- No more than 2 chart placeholders per screen
- Keep total JSX output under 200 lines — use placeholder Boxes instead of deeply nested content if you are running long

FORBIDDEN — these cause parse errors and are banned:
- NEVER use template literals. Use only regular quoted strings: "hello " + name, never backtick strings.
- NEVER use the style prop. Use only Blade component props for layout and sizing.
- NEVER use SVG elements (svg, path, polyline, circle, rect, line, g, defs, linearGradient, etc.).
- NEVER render charts by mapping data to Box elements with computed heights.
- NEVER call useState() without an initial value when the state is used as an array — always useState([]) not useState(). Calling .map()/.filter()/.find() on undefined crashes at runtime.
- NEVER put <Box>, <Text>, or any non-ListItem element directly inside <List> — ONLY <ListItem> is valid. Putting anything else crashes with a Blade runtime error.
- NEVER put <Box>, <Text>, <Badge>, or any Blade component directly inside <ListItem> — ONLY <ListItemText>, <ListItemCode>, <ListItemLink>, or a plain string. Anything else crashes.
- NEVER put JSX elements (<Amount />, <Badge />, <Skeleton />, etc.) inside <ListItemText> — it renders as <p> and block-level children (Skeleton renders as <div>) cause a hydration crash. Only plain strings allowed.
- NEVER wrap <Amount />, <Skeleton />, <Counter />, or <Spinner /> inside <Text> — Text also renders as <p>, causing the same div-in-p hydration crash. Use <Amount /> as a direct child of <Box>, never inside <Text>.
- NEVER put <Skeleton> inside <ListItemText>. In loading scenarios, replace the ENTIRE <List>...</List> block with shimmer text rows:
  <Box display="flex" flexDirection="column" gap="spacing.3">
    <Skeleton width="90%" height="16px" borderRadius="small" />
    <Skeleton width="75%" height="16px" borderRadius="small" />
    <Skeleton width="85%" height="16px" borderRadius="small" />
  </Box>
- NEVER map directly to <ListItemText> inside <List> — always map to <ListItem> first: {items.map(i => <ListItem key={i.id}><ListItemText>{i.label}</ListItemText></ListItem>)}
- NEVER write two adjacent JSX elements in a .map() return, ternary branch, or && expression without a wrapper. WRONG: {items.map(i => <A/><B/>)}. RIGHT: {items.map(i => <><A/><B/></>)} or restructure to return one element.
- NEVER use Collapsible, Dropdown, AvatarGroup, or BottomNav — they require child component types not available in scope.
- NEVER self-close <Badge /> — it crashes. Always: <Badge color="positive">text</Badge>

CHARTS — represent any chart (line, bar, area, pie) as a single Box placeholder:
  <Box backgroundColor="surface.background.gray.intense" borderRadius="medium" width="100%" height="160px" display="flex" alignItems="center" justifyContent="center">
    <Text size="small" color="surface.text.placeholder.lowContrast">Revenue trend · last 30 days</Text>
  </Box>
In loading scenarios replace with: <Skeleton width="100%" height="160px" borderRadius="medium"/>

COLORS — Blade Box only accepts design tokens for backgroundColor. NEVER use CSS color names or hex:
- NEVER: backgroundColor="white" | "black" | "blue" | "#fff" | "rgb(...)" — these crash at runtime
- Gray scale:   "surface.background.gray.subtle" (lightest) | "surface.background.gray.moderate" | "surface.background.gray.intense" (darkest)
- Brand/blue:   "surface.background.primary.subtle" | "surface.background.primary.intense"
- Success/green:"surface.background.positive.subtle" | "surface.background.positive.intense"
- Error/red:    "surface.background.negative.subtle" | "surface.background.negative.intense"
- Warning:      "surface.background.notice.subtle" | "surface.background.notice.intense"
- Transparent:  "transparent"
Use primary tokens for brand panels (login left panel, hero sections), gray tokens for page backgrounds and cards.

Example of correct output format:
function GeneratedComponent() {
  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" padding="spacing.6">
      <Heading size="large">Title</Heading>
      <Card>
        <CardBody>
          <Text size="medium">content</Text>
        </CardBody>
      </Card>
    </Box>
  );
}

Blade spacing tokens: spacing.1(4px) spacing.2(8px) spacing.3(12px) spacing.4(16px) spacing.5(20px) spacing.6(24px) spacing.7(28px) spacing.8(32px)
Blade Text sizes: xsmall, small, medium, large
Blade Heading sizes: small, medium, large, xlarge
Alert colors: information, positive, negative, notice`;

export const ADAPT_SCENARIO_PROMPT = `You adapt an existing React component to show a different UI scenario state.

You receive a TEMPLATE JSX (the fully working prototype) and a scenario name + description.
Output the SAME component with ONLY these things changed — nothing else:

WHAT YOU MAY CHANGE:
- Field values (the string inside value="...")
- validationState prop: "none" | "error"
- errorText prop on inputs
- isDisabled prop on inputs, buttons, checkboxes
- isLoading prop on buttons
- Alert: show/hide by adding or removing it; change its color and description text
- Badge color: "positive" | "negative" | "neutral" | "notice"
- Badge/Text content showing numbers or status text
- For "loading": replace every data value, Badge, Amount, and Text with <Skeleton width="Xpx" height="Ypx"/>
- Remove useState/useEffect and make all values static strings (except for "prototype")

BUTTON STATE RULES — apply based on scenario description:
- Description mentions "disabled", "button disabled", "can't submit", "incomplete", "partial": → set isDisabled={true} on ALL submit/primary action buttons
- Description mentions "loading", "submitting", "processing", "placing order": → set isLoading={true} and isDisabled={true} on submit button
- Description mentions "success", "order placed", "submitted": → keep button enabled (remove isDisabled)
- Description mentions "empty form", "nothing typed", "all fields empty": → set isDisabled={true} on submit button

INPUT STATE RULES — for validation-error scenarios:
- If description names a specific invalid field (e.g. "invalid email", "email error"): → set validationState="error" and errorText="Enter a valid email address" on ONLY that input; leave others as validationState="none"
- If description says "all fields show errors": → set validationState="error" on every required field

WHAT YOU MUST NEVER CHANGE:
- Component structure, nesting, or order
- Heading text (e.g. "Profile Settings" must stay "Profile Settings" in ALL scenarios)
- Field label text (e.g. "Display Name" stays "Display Name" everywhere)
- Button label text
- Number of fields or buttons
- Layout (Box, Card, padding, gap props)

Output ONLY the GeneratedComponent function. No imports, no exports, no markdown fences.`;

export const SCENARIO_SYSTEM_PROMPT = `You generate a specific scenario of a UI screen using Razorpay Blade components.
You will be given a scenario name and description that tells you exactly what the user sees.

RESPONSE FORMAT (non-negotiable): Begin your response with EXACTLY the token: function GeneratedComponent() {
Do NOT write any explanation, reasoning, analysis, preamble, or markdown fences before this token. Not even one word.

╔══════════════════════════════════════════════════════════════════╗
║  DASHBOARD SCREENS — MANDATORY LAYOUT (data-display archetype)  ║
╚══════════════════════════════════════════════════════════════════╝
If the screen is a dashboard, analytics screen, admin panel, or any data-display screen,
you MUST use this exact two-column layout. No exceptions.

The sidebar is a Box-based nav panel (240px wide) with icon + text nav items.
Icons are rendered as inline JSX: <HomeIcon /> (they are React components in scope).

function GeneratedComponent() {
  const [page, setPage] = useState("overview");
  return (
    <Box display="flex" minHeight="700px">
      <Box width="240px" flexShrink="0" backgroundColor="surface.background.gray.intense"
           display="flex" flexDirection="column" paddingY="spacing.6" paddingX="spacing.4">
        <Box paddingX="spacing.2" paddingBottom="spacing.6">
          <Heading size="large">Razorpay</Heading>
        </Box>
        <Box display="flex" flexDirection="column" gap="spacing.1">
          <Box display="flex" alignItems="center" gap="spacing.3" padding="spacing.3"
               borderRadius="medium"
               backgroundColor={page === "overview" ? "surface.background.gray.moderate" : "transparent"}
               onClick={() => setPage("overview")}>
            <HomeIcon />
            <Text size="small" color="surface.text.gray.normal">Overview</Text>
          </Box>
          <Box display="flex" alignItems="center" gap="spacing.3" padding="spacing.3"
               borderRadius="medium"
               backgroundColor={page === "payments" ? "surface.background.gray.moderate" : "transparent"}
               onClick={() => setPage("payments")}>
            <WalletIcon />
            <Text size="small" color="surface.text.gray.normal">Payments</Text>
          </Box>
          <Box display="flex" alignItems="center" gap="spacing.3" padding="spacing.3"
               borderRadius="medium"
               backgroundColor={page === "customers" ? "surface.background.gray.moderate" : "transparent"}
               onClick={() => setPage("customers")}>
            <UsersIcon />
            <Text size="small" color="surface.text.gray.normal">Customers</Text>
          </Box>
          <Box display="flex" alignItems="center" gap="spacing.3" padding="spacing.3"
               borderRadius="medium"
               backgroundColor={page === "analytics" ? "surface.background.gray.moderate" : "transparent"}
               onClick={() => setPage("analytics")}>
            <LayoutIcon />
            <Text size="small" color="surface.text.gray.normal">Analytics</Text>
          </Box>
        </Box>
        <Box marginTop="auto" paddingTop="spacing.4"
             display="flex" alignItems="center" gap="spacing.3" padding="spacing.3">
          <SettingsIcon />
          <Text size="small" color="surface.text.gray.muted">Settings</Text>
        </Box>
      </Box>
      <Box display="flex" flexDirection="column" flex="1">
        <TopNav>
          <TopNavBrand><Heading size="medium">Razorpay</Heading></TopNavBrand>
          <TopNavActions><Avatar name="Priya Sharma" /></TopNavActions>
        </TopNav>
        <Box padding="spacing.6" display="flex" flexDirection="column" gap="spacing.5">
          {/* metric cards, chart placeholders, recent transactions etc. */}
        </Box>
      </Box>
    </Box>
  );
}

Dashboard sidebar rules (REQUIRED):
- 240px Box sidebar on the LEFT — do NOT use SideNav component (it collapses in the canvas)
- Each nav item: Box display="flex" alignItems="center" gap="spacing.3" with onClick + backgroundColor active state
- Icons rendered as inline JSX: <HomeIcon /> <WalletIcon /> etc. — NOT as icon={HomeIcon} prop here
- TopNav in the RIGHT column for the header bar
- marginTop="auto" on the footer nav item pushes it to the bottom of the sidebar

SCENARIO RENDERING RULES:
- "prototype" scenario: the FULLY INTERACTIVE working version. Every field must be editable by the user:
    • ALL inputs must be controlled with useState — value={state} onChange={({ value }) => setState(value ?? '')}
    • Blade onChange fires ({ value }) — NEVER write (e) => setState(e.value) — e has no .value property
    • PRE-FILL RULE — CRITICAL: Every text/email/phone/name field MUST start with a realistic non-empty value.
      NEVER use useState('') for any email, name, phone, or address field in the prototype.
      Use these defaults (adapt to context):
        const [email, setEmail] = useState('user@example.com');
        const [phone, setPhone] = useState('+91 98765 43210');
        const [fullName, setFullName] = useState('Akshay Kumar');
        const [address, setAddress] = useState('42, MG Road');
        const [city, setCity] = useState('Mumbai');
        const [state, setState] = useState('Maharashtra');
        const [postal, setPostal] = useState('400001');
        const [country, setCountry] = useState('India');
      Only "New Password" / "Confirm Password" / "OTP" / "CVV" fields may start empty.
      Add these pre-fill defaults for Indian finance fields:
        const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
        const [cardExpiry, setCardExpiry] = useState('12/27');
        const [aadhar, setAadhar] = useState('2345 6789 0123');
        const [pan, setPan] = useState('ABCDE1234F');
        const [ifsc, setIfsc] = useState('HDFC0001234');
        const [gstin, setGstin] = useState('27AAPFU0939F1ZV');
        const [pinCode, setPinCode] = useState('400001');
    • TextArea: value={bio} onChange={({ value }) => setBio(value ?? '')}
    • Forms: Add INLINE validation — ONLY as derived const variables, NEVER as useState.
      Detect field type from its LABEL text and apply the matching rule:

      FIELD VALIDATION RULES (match label keywords case-insensitively):
      - label contains "email":
          const isEmailValid = email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
          <TextInput validationState={isEmailValid ? "none" : "error"} errorText="Enter a valid email address" />
      - label contains "phone" / "mobile" / "contact number":
          const isPhoneValid = phone === '' || /^\d{10}$/.test(phone.replace(/[\s\-\+]/g, '').replace(/^91/, ''));
          <TextInput validationState={isPhoneValid ? "none" : "error"} errorText="Enter a valid 10-digit mobile number" />
      - label contains "card number" / "credit card" / "debit card":
          const isCardValid = cardNumber === '' || /^\d{16}$/.test(cardNumber.replace(/[\s\-]/g, ''));
          <TextInput validationState={isCardValid ? "none" : "error"} errorText="Enter a valid 16-digit card number" />
      - label contains "expiry" / "expiry date" / "exp date":
          const isExpiryValid = cardExpiry === '' || /^\d{2}\/\d{2}$/.test(cardExpiry);
          <TextInput validationState={isExpiryValid ? "none" : "error"} errorText="Enter expiry as MM/YY" />
      - label contains "cvv" / "cvc":
          const isCvvValid = cvv === '' || /^\d{3,4}$/.test(cvv);
          <TextInput validationState={isCvvValid ? "none" : "error"} errorText="Enter a valid CVV" />
      - label contains "aadhar" / "aadhaar":
          const isAadharValid = aadhar === '' || /^\d{12}$/.test(aadhar.replace(/[\s\-]/g, ''));
          <TextInput validationState={isAadharValid ? "none" : "error"} errorText="Enter a valid 12-digit Aadhaar number" />
      - label contains "pan" (and NOT "panel" / "panchayat"):
          const isPanValid = pan === '' || /^[A-Z]{5}\d{4}[A-Z]$/i.test(pan);
          <TextInput validationState={isPanValid ? "none" : "error"} errorText="Enter a valid PAN (e.g. ABCDE1234F)" />
      - label contains "ifsc":
          const isIfscValid = ifsc === '' || /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc);
          <TextInput validationState={isIfscValid ? "none" : "error"} errorText="Enter a valid IFSC code (e.g. HDFC0001234)" />
      - label contains "gst" / "gstin":
          const isGstValid = gstin === '' || /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][0-9A-Z]$/i.test(gstin);
          <TextInput validationState={isGstValid ? "none" : "error"} errorText="Enter a valid GSTIN (e.g. 27AAPFU0939F1ZV)" />
      - label contains "pin code" / "postal code" / "zip code":
          const isPinValid = pinCode === '' || /^\d{6}$/.test(pinCode);
          <TextInput validationState={isPinValid ? "none" : "error"} errorText="Enter a valid 6-digit PIN code" />
      - label contains "otp":
          const isOtpValid = otp === '' || /^\d{4,6}$/.test(otp);
          <TextInput validationState={isOtpValid ? "none" : "error"} errorText="Enter a valid OTP" />
      - label contains "account number" / "bank account":
          const isAccountValid = accountNumber === '' || /^\d{9,18}$/.test(accountNumber.replace(/[\s]/g, ''));
          <TextInput validationState={isAccountValid ? "none" : "error"} errorText="Enter a valid account number (9–18 digits)" />

      - SUBMIT BUTTON — MUST include ALL required fields in the canSubmit check. Include isXxxValid for every field that has a validation rule above.
        For a checkout/order form: const canSubmit = email !== '' && fullName !== '' && phone !== '' && address !== '' && isEmailValid && isPhoneValid;
        For a payment form: const canSubmit = cardNumber !== '' && cvv !== '' && cardExpiry !== '' && isCardValid && isCvvValid && isExpiryValid;
        For a KYC form: const canSubmit = aadhar !== '' && pan !== '' && isAadharValid && isPanValid;
        For a login form: const canSubmit = email !== '' && password !== '' && isEmailValid;
        For a signup form: const canSubmit = email !== '' && password !== '' && confirmPassword === password && isEmailValid;
        then ALWAYS: <Button isDisabled={!canSubmit}>
        ⚠️ NEVER render the submit button without isDisabled={!canSubmit} on a form screen.
      - On submit button: onClick={() => { setIsLoading(true); setShowError(false); setTimeout(() => { setIsLoading(false); setShowError(true); }, 1500); }}
      - PasswordInput onChange: onChange={({ value }) => setPassword(value ?? '')}
      - NEVER call setState outside of event handlers or useEffect — it causes infinite re-render loops
      - NEVER write onClick={handler()} — always onClick={handler} or onClick={() => handler()}
    • Dashboards: fully loaded with realistic sample data, all Badges showing real values, chart placeholder visible.
    This is the main screen — make it feel like a real working product, not a static mockup.
- "loading" scenario: replace ALL data content with Blade Skeleton shimmer. Every text value, number, badge → Skeleton. Preserve layout structure exactly.
  For any <List> block: replace the whole thing with shimmer text rows (varying widths give realistic shimmer-text effect):
  <Box display="flex" flexDirection="column" gap="spacing.3">
    <Skeleton width="90%" height="16px" borderRadius="small" />
    <Skeleton width="75%" height="16px" borderRadius="small" />
    <Skeleton width="85%" height="16px" borderRadius="small" />
    <Skeleton width="80%" height="16px" borderRadius="small" />
  </Box>
- "error" scenario: Alert color="negative" at top with clear title+description, a retry Button, rest of content as Skeleton.
- "empty" scenario: use EmptyState with a headline and primary Button CTA. No data rows or metric cards.
- "healthy" / "positive" / "success" scenarios: show real data with Badge color="positive", green-leaning values, upward trends.
- "declining" / "negative" / "down" scenarios: show real data with Badge color="negative", red-leaning values, downward trends, possibly an Alert color="notice".
- "processing" / "submitting" / "loading-form" scenarios: Button isLoading=true, all inputs isDisabled=true. Show realistic filled values.
- "empty-form" / "incomplete" scenarios: Button isDisabled=true (nothing typed), inputs empty but enabled.
- "partial-fill" / "partial-input" scenarios: Some fields have realistic values, one required field (e.g. email) is left empty (value=""), submit button MUST be isDisabled={true} — the empty required field blocks submission.
- "invalid-*" / "validation-error" / "credential-error" scenarios: TextInput validationState="error", Alert color="negative" shown.
- "warning" / "notice" scenarios: Alert color="notice" with relevant message.
- For any other scenario name, read the description carefully and render accordingly.

Always use realistic Razorpay-relevant sample data (INR amounts, Indian company names, payment IDs like TXN-XXXX).

LAYOUT CONSISTENCY — THIS IS THE MOST IMPORTANT RULE:
Every scenario is the SAME screen in a different state. The JSX structure must be identical across all scenarios:
- Same heading text (e.g. "Profile Settings" in ALL scenarios — never "Edit Profile" in one and "Profile Settings" in another)
- Same field labels (e.g. "Display Name" everywhere — never "Full Name" in some scenarios)
- Same components in the same order (if prototype has Avatar → Name → Email → Bio → Button, all scenarios have Avatar → Name → Email → Bio → Button)
- Same button labels and order
- Only THESE things change between scenarios: field values, validationState, isDisabled, isLoading, Alert visibility/color, Badge color, Skeleton vs real content
- NEVER add or remove layout elements between scenarios
- NEVER rename headings, labels, or buttons between scenarios

${BASE_RULES}`;

export const ANALYZE_IMAGE_PROMPT = `You are a UI analysis assistant. The user has shared a Figma frame image.
Examine it carefully and fill in every field in the tool schema.

EXTRACTION RULES:
- screenName: infer from the page title or dominant heading (e.g. "KYC Page", "Payments Dashboard")
- heading: exact text of the largest/primary heading visible
- subheading: exact text of the subtitle below the heading, if present
- sections: list of ALL section headings visible top-to-bottom (e.g. "Application Progress", "Application Process Overview")
- fields: for EVERY input field visible, record exact label, infer type from label + format hint, mark required if asterisk or "required" text is near it
- buttons: every button visible — exact label text, primary/secondary/tertiary by visual prominence
- badges: any badge/chip/tag visible with its exact text and color
- alerts: any alert/banner component visible
- colorMood: 1-2 sentence description of the overall palette (e.g. "light, neutral gray card sections, green success accent")
- layout.type: classify into EXACTLY one of the five supported types
- layout.sidebar: if a sidebar is present, record:
    • navItems: ALL nav labels exactly as shown
    • hasIcons: true if icons appear beside labels
    • width: estimated pixel width (e.g. "240px", "280px")
    • itemSpacing: compact (tight rows), normal (standard), relaxed (airy)
    • activeStyle: filled (colored background block), outlined (border), underline (bottom border)
    • activeNavItem: the label of the currently selected/highlighted item
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
- layout.sections: for EACH visible content section, record:
    • heading: exact section title
    • containerType: card (has border/shadow) or plain (no container border)
    • columns: count how many items appear PER ROW (one full-width row = 1, two side-by-side = 2, etc.)
    • contentType: form-fields | metric-cards | data-rows | list-items
    • gap: none | xs (4px) | sm (8px) | md (16px) | lg (24px) — gap between sibling items
    • padding: none | xs | sm | md | lg — internal padding inside each card/container
    • itemSizing: fill (items stretch to fill width), hug (items shrink to content), fixed (items have a set width)
    • items: for data-rows sections, list EVERY visible row: { title, description, badge, badgeColor: positive|notice|neutral|negative }
    • fieldRows: for form-fields sections ONLY — each element is one VISUAL ROW of field labels, listed top-to-bottom.
      Single-field rows: ["Full Name"]. Multi-field rows (side-by-side in Figma): ["City", "State"] or ["Postal Code", "Country"].
      Example: [["Full Name"], ["Address Line 1"], ["Address Line 2"], ["City", "State"], ["Postal Code", "Country"]]
      This is CRITICAL — if you see two fields side-by-side in the Figma, they MUST appear in the same inner array.
- layout.contentPadding: sm | md | lg — padding of the main content area from the viewport edge
- layout.sectionGap: sm | md | lg — vertical gap between top-level sections
- progressBars: for any progress bar or step tracker visible, record label, current percentage value (0-100), and the description text (e.g. "1 of 5 steps completed")
- assets: every logo, photo, illustration, avatar, or custom icon visible — describe and give the Blade fallback
- statusIndicators: list every distinct status label visible (e.g. "Completed", "Current Step", "Pending")

If a value is not visible, omit that optional field rather than guessing.`;

export interface ImageContext {
  screenName: string;
  heading: string;
  subheading?: string;
  sections: string[];
  fields: Array<{
    label: string;
    type: "text" | "email" | "password" | "phone" | "date" | "number" | "textarea";
    format?: string;
    required: boolean;
  }>;
  buttons: Array<{ label: string; variant: "primary" | "secondary" | "tertiary" }>;
  badges: Array<{ label: string; color: string }>;
  alerts: Array<{ type: string; message?: string }>;
  colorMood: string;
  layout: {
    type: "single-column" | "sidebar-content" | "split-screen" | "card-grid" | "header-tabs";
    sidebar?: {
      position: "left" | "right";
      width?: string;
      navItems: string[];
      hasIcons: boolean;
      itemSpacing: "compact" | "normal" | "relaxed";
      activeStyle: "filled" | "outlined" | "underline";
    };
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
    sections: Array<{
      heading?: string;
      containerType: "card" | "plain";
      columns: 1 | 2 | 3;
      contentType: "form-fields" | "metric-cards" | "data-rows" | "list-items";
      gap?: "none" | "xs" | "sm" | "md" | "lg";
      padding?: "none" | "xs" | "sm" | "md" | "lg";
      itemSizing?: "fill" | "hug" | "fixed";
      fieldRows?: string[][];
      items?: Array<{
        title: string;
        description?: string;
        badge?: string;
        badgeColor?: "positive" | "negative" | "notice" | "neutral";
      }>;
    }>;
    activeNavItem?: string;
    contentPadding?: "sm" | "md" | "lg";
    sectionGap?: "sm" | "md" | "lg";
  };
  progressBars: Array<{
    label: string;
    value: number;
    description?: string;
  }>;
  assets: Array<{
    type: "logo" | "photo" | "avatar" | "icon" | "illustration";
    label: string;
    position: string;
    bladeFallback: string;
  }>;
  statusIndicators: string[];
  layoutSkeleton?: string;
}

export function buildImageContextInject(ctx: ImageContext): string {
  const fieldLines = ctx.fields.map(
    (f) =>
      `  { label: "${f.label.replace(/"/g, '\\"')}", type: "${f.type}"${f.format ? `, format: "${f.format.replace(/"/g, '\\"')}"` : ""}, required: ${f.required} }`,
  );
  const buttonLines = ctx.buttons.map(
    (b) => `  { label: "${b.label.replace(/"/g, '\\"')}", variant: "${b.variant}" }`,
  );

  // Spacing token maps — Figma abstract → Blade spacing token
  const gapToken: Record<string, string> = {
    none: "spacing.0",
    xs: "spacing.2",
    sm: "spacing.3",
    md: "spacing.4",
    lg: "spacing.6",
  };
  const paddingToken: Record<string, string> = {
    none: "spacing.0",
    xs: "spacing.2",
    sm: "spacing.3",
    md: "spacing.4",
    lg: "spacing.6",
  };

  // Full section detail including spacing + items for data-rows sections
  const sectionDetails = ctx.layout.sections
    .map((s) => {
      const parts = [
        `heading: "${(s.heading ?? "").replace(/"/g, '\\"')}"`,
        `columns: ${s.columns}`,
        `containerType: "${s.containerType}"`,
        `contentType: "${s.contentType}"`,
        s.gap ? `gap: "${gapToken[s.gap] ?? "spacing.4"}"` : null,
        s.padding ? `padding: "${paddingToken[s.padding] ?? "spacing.4"}"` : null,
        s.itemSizing ? `itemSizing: "${s.itemSizing}"` : null,
      ].filter(Boolean).join(", ");
      if (s.items && s.items.length > 0) {
        const itemLines = s.items
          .map(
            (item) =>
              `      { title: "${item.title.replace(/"/g, '\\"')}"${item.description ? `, description: "${item.description.replace(/"/g, '\\"')}"` : ""}${item.badge ? `, badge: "${item.badge.replace(/"/g, '\\"')}"` : ""}${item.badgeColor ? `, badgeColor: "${item.badgeColor}"` : ""} }`,
          )
          .join(",\n");
        return `  { ${parts}, items: [\n${itemLines}\n    ] }`;
      }
      return `  { ${parts} }`;
    })
    .join(",\n");

  // Per-section layout rules including exact row items and spacing
  const sectionLayoutRules = ctx.layout.sections
    .filter((s) => s.heading)
    .map((s) => {
      const q = `"${s.heading}"`;
      const itemGap = s.gap ? gapToken[s.gap] : "spacing.3";
      const cardPad = s.padding ? paddingToken[s.padding] : "spacing.4";
      const sizing = s.itemSizing === "fill" ? "width=\"100%\"" : s.itemSizing === "hug" ? "" : "";

      if (s.columns === 1) {
        if (s.contentType === "data-rows") {
          const rowsDesc =
            s.items && s.items.length > 0
              ? `\n    Rows IN ORDER — full-width, title+description on LEFT, badge on RIGHT (justifyContent="space-between"):\n` +
                s.items
                  .map(
                    (item) =>
                      `      • "${item.title}"${item.description ? ` — "${item.description}"` : ""} → <Badge color="${item.badgeColor ?? "neutral"}">${item.badge ?? ""}</Badge>`,
                  )
                  .join("\n")
              : "";
          return `  - Section ${q}: Box flexDirection="column" gap="${itemGap}" ${sizing}. Each row is a ${s.containerType === "card" ? `Card with CardBody padding="${cardPad}"` : `Box padding="${cardPad}"`} with justifyContent="space-between". NEVER flexWrap.${rowsDesc}`;
        }
        if (s.contentType === "form-fields") {
          if (s.fieldRows && s.fieldRows.length > 0) {
            const rowLines = s.fieldRows
              .map((row) => {
                if (row.length === 1) {
                  return `      • "${row[0]}" — full width (single TextInput, no flex row)`;
                }
                const pct = Math.floor(100 / row.length);
                const inputs = row.map((f) => `<TextInput label="${f}" />`).join(" ");
                return `      • ${row.map((f) => `"${f}"`).join(" + ")} — SIDE BY SIDE: <Box display="flex" flexDirection="row" gap="${itemGap}">${inputs}</Box> (each ~${pct}% width)`;
              })
              .join("\n");
            return `  - Section ${q}: outer Box flexDirection="column" gap="${itemGap}". ${s.containerType === "card" ? `Wrap in Card padding="${cardPad}".` : ""}⚠️ IGNORE "columns" from JSON — use this EXACT per-row layout instead:\n${rowLines}`;
          }
          return `  - Section ${q}: Box flexDirection="column" gap="${itemGap}". One field per row. ${s.containerType === "card" ? `Wrap in Card padding="${cardPad}".` : ""}`;
        }
        if (s.contentType === "metric-cards") {
          return `  - Section ${q}: single metric Card padding="${cardPad}", full width.`;
        }
        return `  - Section ${q}: Box flexDirection="column" gap="${itemGap}".`;
      }
      return `  - Section ${q}: Box display="flex" flexWrap="wrap" gap="${itemGap}". Each item width="${Math.floor(100 / s.columns)}%" with ${s.containerType === "card" ? `Card padding="${cardPad}"` : "plain Box"}.`;
    })
    .join("\n");

  const outerPaddingToken: Record<string, string> = {
    sm: "spacing.4",
    md: "spacing.6",
    lg: "spacing.8",
  };

  // Sidebar nav with full auto-layout detail
  const sb = ctx.layout.sidebar;
  const sidebarBlock = sb && sb.navItems.length > 0
    ? [
        `- Sidebar nav items: [${sb.navItems.map((n) => `"${n}"`).join(", ")}]`,
        sb.hasIcons ? `- Sidebar item layout: icon + label (icon on left)` : `- Sidebar item layout: label only`,
        `- Sidebar item gap: ${sb.itemSpacing === "compact" ? "spacing.1" : sb.itemSpacing === "relaxed" ? "spacing.3" : "spacing.2"} between each nav item`,
        `- Sidebar item padding: ${sb.itemSpacing === "compact" ? "spacing.2" : sb.itemSpacing === "relaxed" ? "spacing.4" : "spacing.3"} horizontal, ${sb.itemSpacing === "compact" ? "spacing.1" : "spacing.2"} vertical`,
        `- Sidebar active style: ${sb.activeStyle === "filled" ? 'backgroundColor on active item Box (e.g. surface.background.gray.moderate)' : sb.activeStyle === "outlined" ? 'border on active item' : 'borderBottom on active item'}`,
        sb.width ? `- Sidebar width: ${sb.width}` : `- Sidebar width: 240px`,
        ctx.layout.activeNavItem ? `- Active nav item: "${ctx.layout.activeNavItem}"` : "",
      ].filter(Boolean).join("\n")
    : "";

  // Progress bars
  const progressBlock =
    ctx.progressBars && ctx.progressBars.length > 0
      ? `- Progress bars:\n` +
        ctx.progressBars
          .map(
            (p) =>
              `  • "${p.label}": ${p.value}%${p.description ? ` (${p.description})` : ""}`,
          )
          .join("\n")
      : "";

  return `
IMAGE CONTEXT — reproduce these exact details from the Figma frame:
- Heading: "${ctx.heading.replace(/"/g, '\\"')}"${ctx.subheading ? `\n- Subheading: "${ctx.subheading.replace(/"/g, '\\"')}"` : ""}
- Sections: [${ctx.sections.map((s) => `"${s}"`).join(", ")}]
${ctx.fields.length > 0 ? `- Fields:\n${fieldLines.join("\n")}` : "- Fields: (none)"}
- Buttons: ${ctx.buttons.length > 0 ? `[\n${buttonLines.join(",\n")}\n]` : "[]"}${
    ctx.badges.length > 0
      ? `\n- Badges: [${ctx.badges.map((b) => `{ label: "${b.label}", color: "${b.color}" }`).join(", ")}]`
      : ""
  }${ctx.alerts.length > 0 ? `\n- Alerts: [${ctx.alerts.map((a) => `{ type: "${a.type}"${a.message ? `, message: "${a.message.replace(/"/g, '\\"')}"` : ""} }`).join(", ")}]` : ""}
- Color mood: ${ctx.colorMood}
${sidebarBlock ? sidebarBlock + "\n" : ""}- Layout type: ${ctx.layout.type}
- Layout sections (columns + items MUST be reproduced exactly):
${sectionDetails}
${progressBlock ? progressBlock + "\n" : ""}${ctx.statusIndicators.length > 0 ? `- Status indicators: [${ctx.statusIndicators.map((s) => `"${s}"`).join(", ")}]` : ""}${
    ctx.assets.length > 0
      ? `\n- Assets:\n${ctx.assets.map((a) => `  ${a.type} "${a.label}" at ${a.position} → Blade fallback: ${a.bladeFallback}`).join("\n")}`
      : ""
  }

MATCH THESE EXACTLY — use the exact label text, section names, button labels, and row items above.

COLOR MAPPING (Blade tokens only — never hex or CSS color names):
  neutral gray / light → surface.background.gray.subtle
  medium gray → surface.background.gray.moderate
  dark gray → surface.background.gray.intense
  green / success → surface.background.positive.intense
  light green → surface.background.positive.subtle
  red / error → surface.background.negative.intense
  light red → surface.background.negative.subtle
  orange / warning → surface.background.notice.intense
  light orange / notice → surface.background.notice.subtle
  blue / brand → surface.background.primary.intense
  light blue → surface.background.primary.subtle
  transparent → transparent

PAGE SKELETON:
  sidebar-content → ${sb?.width ?? "240px"} Box sidebar (left) + Box flex="1" main area; content padding="${outerPaddingToken[ctx.layout.contentPadding ?? "md"] ?? "spacing.6"}"
  single-column   → Box flexDirection="column" padding="${outerPaddingToken[ctx.layout.contentPadding ?? "md"] ?? "spacing.6"}" + Card per section
  split-screen    → Box flexDirection="row", two equal-width Box children
  header-tabs     → TopNav + TabNav + content area

Top-level section gap: gap="${outerPaddingToken[ctx.layout.sectionGap ?? "md"] ?? "spacing.6"}"

SECTION LAYOUT RULES — non-negotiable, wrong layout = broken design:
${sectionLayoutRules || "  Follow PAGE SKELETON rules above."}

For progress bars: use a Box (gray track) + inner Box width="{value}%" backgroundColor="surface.background.primary.intense" for the fill. Show label above and percentage + description below.
For sidebar active item: ${sb?.activeStyle === "filled" ? 'backgroundColor="surface.background.gray.moderate" on the active nav item Box' : sb?.activeStyle === "outlined" ? "border on active item Box" : "borderBottom on active item Box"}.
For sidebar nav items: ${sb?.hasIcons ? `each item is Box display="flex" alignItems="center" gap="${sb.itemSpacing === "compact" ? "spacing.2" : "spacing.3"}" with <Icon /> + <Text size="small">` : `each item is Box padding="spacing.3" with <Text size="small">`}.
`;
}
