import type { LayoutDescription, StateOutput } from "@/lib/types";
import salesDashboard from "./sales-dashboard.json";
import loginPage from "./login-page.json";

export interface Artifact {
  screenName: string;
  matchKeys: string[];
  components: string[];
  archetypes: string[];
  layoutDescription: LayoutDescription;
  states: Record<string, StateOutput>;
}

const ARTIFACTS: Artifact[] = [salesDashboard as Artifact, loginPage as Artifact];

/**
 * Find the best-matching bundled artifact for a screen name. Falls back to the
 * first artifact so the demo always returns something renderable.
 */
export function findArtifact(screenName: string): Artifact {
  const q = screenName.trim().toLowerCase();
  for (const a of ARTIFACTS) {
    if (a.screenName.toLowerCase() === q) return a;
  }
  for (const a of ARTIFACTS) {
    if (a.matchKeys.some((k) => q.includes(k) || k.includes(q))) return a;
  }
  return ARTIFACTS[0];
}

export function listArtifacts(): Artifact[] {
  return ARTIFACTS;
}
