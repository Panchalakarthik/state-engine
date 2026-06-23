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

export interface Scenario {
  name: string;
  description: string;
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
  scenarios: Scenario[];
  states: Record<string, StateOutput>;
  activeState: string;
  createdAt: number;
  updatedAt: number;
}

export type ChatMessageRole = "user" | "ai";
export type ChatMessageType = "thinking" | "reasoning" | "classified" | "result" | "error";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  type?: ChatMessageType;
  content: string;
  stateNames?: string[];
  /** For type="thinking": short label (e.g. "Classifying your screen…") */
  phase?: string;
  /** For type="thinking": longer explanation shown inside expanded body */
  detail?: string;
  /** For type="thinking": true once all steps have completed */
  isComplete?: boolean;
  timestamp: number;
}

export type ResponsiveMode = "desktop" | "tablet" | "mobile";
