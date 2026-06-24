import type { UIMessage } from "ai";
import type { Scenario } from "./types";

/** Data carried with every streamed UI state — includes session context so the
 *  client can create/update the session without a separate API round-trip. */
export interface StateData {
  /** Server-generated session ID.  Same for every state within one generation. */
  sessionId: string;
  screenName: string;
  archetypes: string[];
  scenarios: Scenario[];
  name: string;
  jsx: string;
  description: string;
}

export type AppUIMessage = UIMessage<never, { state: StateData }>;
