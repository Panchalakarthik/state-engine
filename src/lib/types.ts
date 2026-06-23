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
export type ChatMessageType = "reasoning" | "classified" | "result" | "error";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  type?: ChatMessageType;
  content: string;
  stateNames?: string[];
  timestamp: number;
}

export type ResponsiveMode = "desktop" | "tablet" | "mobile";
