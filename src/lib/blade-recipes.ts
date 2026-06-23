/**
 * Blade recipe registry.
 * - patternDoc: reads from blade-mcp knowledgebase and AI-translates to canvas JSX (Option B)
 * - prototypeJsx: hardcoded fallback for recipes without a blade-mcp pattern doc
 */

export interface BladeRecipe {
  id: string;
  /** Screen name substrings that trigger this recipe (case-insensitive). */
  keywords: string[];
  /** Blade archetype(s) for this recipe. */
  archetypes: string[];
  /** Predefined scenarios — skips AI classification entirely. */
  scenarios: Array<{ name: string; description: string }>;
  /** blade-mcp knowledgebase/patterns/<patternDoc>.md — translated dynamically at runtime. */
  patternDoc?: string;
  /** Hardcoded canvas JSX — used when no patternDoc exists. */
  prototypeJsx?: string;
}

// ─── Login Recipe ─────────────────────────────────────────────────────────────
// No Login.md in blade-mcp knowledgebase, so we keep a hardcoded prototype.
const LOGIN_JSX = `function GeneratedComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const isEmailValid = email === "" || /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email);
  const canSubmit = email !== "" && password !== "" && isEmailValid;
  return (
    <Box display="flex" minHeight="700px">
      <Box
        width="420px"
        flexShrink="0"
        backgroundColor="surface.background.primary.intense"
        display="flex"
        flexDirection="column"
        alignItems="flex-start"
        justifyContent="space-between"
        padding="spacing.10"
      >
        <Box>
          <Heading size="xlarge" color="surface.text.staticWhite.normal">Razorpay</Heading>
          <Box marginTop="spacing.4">
            <Text size="large" color="surface.text.staticWhite.normal">The complete</Text>
            <Text size="large" color="surface.text.staticWhite.normal">payments platform</Text>
          </Box>
          <Box marginTop="spacing.6">
            <Text size="medium" color="surface.text.staticWhite.subtle">
              Trusted by 10M+ businesses across India for fast, reliable, and secure payments.
            </Text>
          </Box>
        </Box>
        <Box>
          <Text size="small" color="surface.text.staticWhite.subtle">
            © 2024 Razorpay Software Private Limited
          </Text>
        </Box>
      </Box>
      <Box
        flex="1"
        backgroundColor="surface.background.gray.subtle"
        display="flex"
        alignItems="center"
        justifyContent="center"
        padding="spacing.10"
      >
        <Box width="100%" maxWidth="400px" display="flex" flexDirection="column" gap="spacing.6">
          <Box>
            <Heading size="xlarge">Sign in</Heading>
            <Box marginTop="spacing.2">
              <Text size="medium" color="surface.text.gray.muted">Welcome back to Razorpay Dashboard</Text>
            </Box>
          </Box>
          {showError && (
            <Alert
              color="negative"
              title="Invalid credentials"
              description="The email or password you entered is incorrect. Please try again."
            />
          )}
          <Box display="flex" flexDirection="column" gap="spacing.4">
            <TextInput
              label="Email address"
              placeholder="you@company.com"
              value={email}
              onChange={({ value }) => setEmail(value ?? "")}
              validationState={isEmailValid ? "none" : "error"}
              errorText="Enter a valid email address"
            />
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={({ value }) => setPassword(value ?? "")}
            />
          </Box>
          <Box display="flex" flexDirection="column" gap="spacing.3">
            <Button
              isFullWidth={true}
              isDisabled={!canSubmit}
              isLoading={isLoading}
              onClick={() => {
                setIsLoading(true);
                setShowError(false);
                setTimeout(() => { setIsLoading(false); setShowError(true); }, 1500);
              }}
            >
              Sign in
            </Button>
            <Box display="flex" justifyContent="center">
              <Link href="#">Forgot password?</Link>
            </Box>
          </Box>
          <Divider />
          <Box display="flex" justifyContent="center" gap="spacing.2">
            <Text size="small" color="surface.text.gray.muted">New to Razorpay?</Text>
            <Link href="#">Create an account</Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}`;

export const BLADE_RECIPES: BladeRecipe[] = [
  {
    id: "login",
    keywords: ["login", "sign in", "signin", "sign-in", "auth", "authentication", "log in"],
    archetypes: ["form"],
    scenarios: [
      { name: "prototype", description: "Login page with email and password fields, fully interactive and ready for input" },
      { name: "loading", description: "Sign in button isLoading=true, both inputs isDisabled=true, user is authenticating" },
      { name: "error", description: "Alert color=negative showing invalid credentials, inputs re-enabled so user can retry" },
      { name: "empty", description: "Both fields empty, Sign in button isDisabled=true (nothing entered yet)" },
    ],
    prototypeJsx: LOGIN_JSX,
  },
  {
    id: "dashboard",
    keywords: ["dashboard", "analytics", "overview", "metrics", "kpi", "insights"],
    archetypes: ["data-display"],
    scenarios: [
      { name: "prototype", description: "Dashboard fully loaded with real metrics, positive trends, all data visible" },
      { name: "loading", description: "All metric values, badges, charts, and transaction rows replaced with Skeleton shimmer" },
      { name: "healthy", description: "All KPI badges color=positive, green revenue numbers, high success rate" },
      { name: "declining", description: "KPI badges color=negative, red/down numbers, low success rate, Alert notice visible" },
      { name: "empty", description: "No transactions yet — EmptyState in content area with onboarding CTA" },
    ],
    patternDoc: "Dashboard",
  },
];

/** Find a Blade recipe matching the given screen name. Returns null if no match. */
export function findRecipe(screenName: string): BladeRecipe | null {
  const lower = screenName.toLowerCase();
  return BLADE_RECIPES.find((r) => r.keywords.some((k) => lower.includes(k))) ?? null;
}
