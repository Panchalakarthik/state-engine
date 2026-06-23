/**
 * Hardcoded canvas-compatible JSX for each Blade recipe.
 * Used as the fixed prototype in generate — AI only adapts states, never invents structure.
 */

export interface BladeRecipe {
  id: string;
  /** Screen name substrings that trigger this recipe (case-insensitive). */
  keywords: string[];
  /** Blade archetype(s) for this recipe. */
  archetypes: string[];
  /** Predefined scenarios for this recipe — skips AI classification entirely. */
  scenarios: Array<{ name: string; description: string }>;
  /** Canvas-compatible prototype JSX — no imports, no exports, uses bladeScope globals. */
  prototypeJsx: string;
}

// ─── Dashboard Recipe ─────────────────────────────────────────────────────────
// Based on Blade Simple Dashboard recipe (blade.razorpay.com/recipes/simple-dashboard)
// SideNav is emulated with a 240px Box because Blade SideNav collapses without hover.
const DASHBOARD_JSX = `function GeneratedComponent() {
  const [page, setPage] = useState("overview");
  return (
    <Box display="flex" minHeight="700px">
      <Box
        width="240px"
        flexShrink="0"
        backgroundColor="surface.background.gray.intense"
        display="flex"
        flexDirection="column"
        paddingY="spacing.6"
        paddingX="spacing.4"
      >
        <Box paddingX="spacing.2" paddingBottom="spacing.6">
          <Heading size="large">Razorpay</Heading>
        </Box>
        <Box display="flex" flexDirection="column" gap="spacing.1">
          <Box
            display="flex" alignItems="center" gap="spacing.3"
            padding="spacing.3" borderRadius="medium"
            backgroundColor={page === "overview" ? "surface.background.gray.moderate" : "transparent"}
            onClick={() => setPage("overview")}
          >
            <HomeIcon />
            <Text size="small" color="surface.text.gray.normal">Overview</Text>
          </Box>
          <Box
            display="flex" alignItems="center" gap="spacing.3"
            padding="spacing.3" borderRadius="medium"
            backgroundColor={page === "payments" ? "surface.background.gray.moderate" : "transparent"}
            onClick={() => setPage("payments")}
          >
            <WalletIcon />
            <Text size="small" color="surface.text.gray.normal">Payments</Text>
          </Box>
          <Box
            display="flex" alignItems="center" gap="spacing.3"
            padding="spacing.3" borderRadius="medium"
            backgroundColor={page === "payouts" ? "surface.background.gray.moderate" : "transparent"}
            onClick={() => setPage("payouts")}
          >
            <DownloadIcon />
            <Text size="small" color="surface.text.gray.normal">Payouts</Text>
          </Box>
          <Box
            display="flex" alignItems="center" gap="spacing.3"
            padding="spacing.3" borderRadius="medium"
            backgroundColor={page === "customers" ? "surface.background.gray.moderate" : "transparent"}
            onClick={() => setPage("customers")}
          >
            <UsersIcon />
            <Text size="small" color="surface.text.gray.normal">Customers</Text>
          </Box>
        </Box>
        <Box
          marginTop="auto"
          display="flex" alignItems="center" gap="spacing.3"
          padding="spacing.3"
        >
          <SettingsIcon />
          <Text size="small" color="surface.text.gray.muted">Settings</Text>
        </Box>
      </Box>
      <Box display="flex" flexDirection="column" flex="1">
        <TopNav>
          <TopNavBrand>
            <Heading size="medium">Razorpay</Heading>
          </TopNavBrand>
          <TopNavActions>
            <Avatar name="Priya Sharma" />
          </TopNavActions>
        </TopNav>
        <Box padding="spacing.6" display="flex" flexDirection="column" gap="spacing.5">
          <Box display="flex" gap="spacing.4">
            <Card flex="1">
              <CardBody>
                <Text size="small" color="surface.text.gray.muted">Total Revenue</Text>
                <Amount value={4523450} currency="INR" />
                <Badge color="positive">+12.5% vs last month</Badge>
              </CardBody>
            </Card>
            <Card flex="1">
              <CardBody>
                <Text size="small" color="surface.text.gray.muted">Transactions</Text>
                <Heading size="xlarge">12,847</Heading>
                <Badge color="positive">+8.2% vs last month</Badge>
              </CardBody>
            </Card>
            <Card flex="1">
              <CardBody>
                <Text size="small" color="surface.text.gray.muted">Success Rate</Text>
                <Heading size="xlarge">98.7%</Heading>
                <Badge color="positive">+0.3%</Badge>
              </CardBody>
            </Card>
          </Box>
          <Box display="flex" gap="spacing.4">
            <Card flex="1">
              <CardBody>
                <Text size="small" weight="semibold">Revenue Trend</Text>
                <Box
                  backgroundColor="surface.background.gray.intense"
                  borderRadius="medium"
                  width="100%"
                  height="160px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  marginTop="spacing.3"
                >
                  <Text size="small" color="surface.text.placeholder.lowContrast">
                    Revenue trend · last 30 days
                  </Text>
                </Box>
              </CardBody>
            </Card>
            <Card flex="1">
              <CardBody>
                <Text size="small" weight="semibold">Payment Methods</Text>
                <Box
                  backgroundColor="surface.background.gray.intense"
                  borderRadius="medium"
                  width="100%"
                  height="160px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  marginTop="spacing.3"
                >
                  <Text size="small" color="surface.text.placeholder.lowContrast">
                    Payment breakdown by method
                  </Text>
                </Box>
              </CardBody>
            </Card>
          </Box>
          <Card>
            <CardBody>
              <Text size="medium" weight="semibold">Recent Transactions</Text>
              <Box display="flex" flexDirection="column" gap="spacing.3" marginTop="spacing.4">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Text size="small" color="surface.text.gray.muted">TXN-2024-001 · Acme Corp</Text>
                  <Box display="flex" gap="spacing.2" alignItems="center">
                    <Amount value={45000} currency="INR" />
                    <Badge color="positive">Completed</Badge>
                  </Box>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Text size="small" color="surface.text.gray.muted">TXN-2024-002 · TechStart India</Text>
                  <Box display="flex" gap="spacing.2" alignItems="center">
                    <Amount value={12500} currency="INR" />
                    <Badge color="positive">Completed</Badge>
                  </Box>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Text size="small" color="surface.text.gray.muted">TXN-2024-003 · Cloud Solutions</Text>
                  <Box display="flex" gap="spacing.2" alignItems="center">
                    <Amount value={89750} currency="INR" />
                    <Badge color="neutral">Processing</Badge>
                  </Box>
                </Box>
              </Box>
            </CardBody>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}`;

export const BLADE_RECIPES: BladeRecipe[] = [
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
    prototypeJsx: DASHBOARD_JSX,
  },
];

/** Find a Blade recipe matching the given screen name. Returns null if no match. */
export function findRecipe(screenName: string): BladeRecipe | null {
  const lower = screenName.toLowerCase();
  return BLADE_RECIPES.find((r) => r.keywords.some((k) => lower.includes(k))) ?? null;
}
