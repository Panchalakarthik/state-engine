"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { z } from "zod";
import LeftPanel from "./left-panel";
import RightPanel from "./right-panel";
import HistoryPanel from "./history-panel";
import { useSessions } from "@/hooks/use-sessions";
import { useUsage } from "@/hooks/use-usage";
import type { AppUIMessage, StateData } from "@/lib/ai-types";
import type { Session } from "@/lib/types";

// Zod schema mirroring StateData — needed for dataPartSchemas
const StateDataSchema = z.object({
  sessionId: z.string(),
  screenName: z.string(),
  archetypes: z.array(z.string()),
  scenarios: z.array(z.object({ name: z.string(), description: z.string() })),
  name: z.string(),
  jsx: z.string(),
  description: z.string(),
});

export default function Workspace() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statesReadyCount, setStatesReadyCount] = useState(0);
  const [isStopped, setIsStopped] = useState(false);

  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    persistSession,
    setActiveState,
    startNewSession,
  } = useSessions();

  const { usage, incrementUsage } = useUsage();

  // Track the active session in a ref so the transport body closure is always current
  const activeSessionRef = useRef<Session | null>(null);
  activeSessionRef.current = activeSession;

  // Track accumulated states per session ID during streaming (bypasses stale closures)
  const streamingStatesRef = useRef<Map<string, Record<string, { jsx: string; description: string }>>>(new Map());

  // Track messages and sessions in refs so effects/callbacks always read latest values
  const messagesRef = useRef<AppUIMessage[]>([]);
  const sessionsRef = useRef<Session[]>(sessions);
  sessionsRef.current = sessions;

  // Track which session ID the current/last generation belongs to
  const generationSessionIdRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AppUIMessage>({
        api: "/api/chat",
        body: () => {
          const s = activeSessionRef.current;
          const protoName = s?.scenarios[0]?.name ?? "prototype";
          return {
            currentPrototypeJsx: s?.states[protoName]?.jsx ?? null,
            activeSessionId: s?.id ?? null,
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat<AppUIMessage>({
    transport,
    dataPartSchemas: { state: StateDataSchema },
    onData: (dataPart) => {
      if (dataPart.type !== "data-state") return;
      const data = dataPart.data as StateData;

      generationSessionIdRef.current = data.sessionId;

      // Accumulate states for this session
      const bucket = streamingStatesRef.current.get(data.sessionId) ?? {};
      bucket[data.name] = { jsx: data.jsx, description: data.description };
      streamingStatesRef.current.set(data.sessionId, bucket);

      // Build session and persist
      const existingSession = sessionsRef.current.find((s) => s.id === data.sessionId);

      const session: Session = {
        id: data.sessionId,
        screenName: data.screenName,
        archetypes: data.archetypes,
        scenarios: data.scenarios,
        layoutDescription: { screenName: data.screenName, components: [] },
        states: { ...(existingSession?.states ?? {}), ...bucket },
        activeState: existingSession?.activeState ?? data.scenarios[0]?.name ?? "prototype",
        components: [],
        createdAt: existingSession?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };

      persistSession(session);
      setStatesReadyCount((n) => n + 1);
    },
  });

  // Keep messages ref in sync on every render
  messagesRef.current = messages;

  // After streaming completes, save the full chat history to the session
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      const sessionId = generationSessionIdRef.current;
      if (sessionId) {
        const session = sessionsRef.current.find((s) => s.id === sessionId);
        if (session) {
          persistSession({
            ...session,
            messages: messagesRef.current as unknown[],
            updatedAt: Date.now(),
          });
        }
      }
    }
    prevStatusRef.current = status;
  }, [status, persistSession]);

  const isGenerating = status === "submitted" || status === "streaming";

  const handleAbort = useCallback(() => {
    stop();
    setIsStopped(true);
  }, [stop]);

  const handleSend = useCallback(
    async (value: string, imageFile?: File) => {
      if (usage.limitReached || usage.loading) return;
      const allowed = await incrementUsage();
      if (!allowed) return;

      setStatesReadyCount(0);
      setIsStopped(false);
      if (!activeSession) {
        streamingStatesRef.current.clear();
      }

      if (imageFile) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });

        sendMessage({
          parts: [
            { type: "file", mediaType: imageFile.type, url: dataUrl },
            { type: "text", text: value },
          ],
        } as Parameters<typeof sendMessage>[0]);
      } else {
        sendMessage({ text: value });
      }
    },
    [activeSession, sendMessage, usage, incrementUsage],
  );

  const handleStateChange = useCallback(
    (stateName: string) => {
      if (!activeSessionId) return;
      setActiveState(activeSessionId, stateName);
    },
    [activeSessionId, setActiveState],
  );

  const handleNewSession = useCallback(() => {
    stop();
    startNewSession();
    setMessages([]);
    setStatesReadyCount(0);
    setIsStopped(false);
    streamingStatesRef.current.clear();
    generationSessionIdRef.current = null;
  }, [startNewSession, setMessages, stop]);

  const handleStateFixed = useCallback(
    (scenarioName: string, jsx: string) => {
      if (!activeSession) return;
      persistSession({
        ...activeSession,
        states: {
          ...activeSession.states,
          [scenarioName]: { jsx, description: activeSession.states[scenarioName]?.description ?? scenarioName },
        },
        updatedAt: Date.now(),
      });
    },
    [activeSession, persistSession],
  );

  const handleExport = useCallback(() => {
    if (!activeSession) return;
    const jsx = activeSession.states[activeSession.activeState]?.jsx ?? "";
    if (!jsx) return;

    const allBladeComponents = [
      "Box","Card","CardBody","Divider","Text","Heading",
      "TextInput","TextArea","PasswordInput","Checkbox","Switch",
      "Button","Link","Alert","Badge","Tag","Skeleton","Spinner",
      "Amount","Counter","List","ListItem","ListItemText","EmptyState",
      "Avatar","SideNav","SideNavBody","SideNavSection","SideNavLink","SideNavFooter","SideNavLevel",
      "TopNav","TopNavBrand","TopNavContent","TopNavActions","TabNav","TabNavItem","TabNavItems",
    ];
    const usedComponents = allBladeComponents.filter((c) =>
      new RegExp(`<${c}[\\s/>]`).test(jsx),
    );
    const usedHooks = ["useState","useEffect","useRef","useCallback","useMemo"].filter((h) =>
      jsx.includes(`${h}(`),
    );

    const componentName = activeSession.screenName
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");

    const imports = [
      `import React${usedHooks.length > 0 ? `, { ${usedHooks.join(", ")} }` : ""} from "react";`,
      ...(usedComponents.length > 0
        ? [`import { ${usedComponents.join(", ")} } from "@razorpay/blade/components";`]
        : []),
    ].join("\n");

    const namedJsx = jsx.replace(
      /^function GeneratedComponent\(\)/,
      `export function ${componentName}()`,
    );

    const output = `${imports}\n\n${namedJsx}\n`;

    const screenName = activeSession.screenName.replace(/\s+/g, "-").toLowerCase();
    const filename = `${screenName}-${activeSession.activeState}.tsx`;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [activeSession]);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <LeftPanel
        screenName={activeSession?.screenName ?? null}
        messages={messages}
        isGenerating={isGenerating}
        hasSession={Boolean(activeSession)}
        statesReadyCount={statesReadyCount}
        isStopped={isStopped}
        limitReached={usage.limitReached}
        usageLoading={usage.loading}
        onHistoryClick={() => setHistoryOpen((o) => !o)}
        onNewSession={handleNewSession}
        onSend={handleSend}
        onAbort={handleAbort}
      />
      <RightPanel
        scenarios={activeSession?.scenarios ?? []}
        states={activeSession?.states ?? {}}
        activeState={activeSession?.activeState ?? ""}
        isGenerating={isGenerating}
        onStateChange={handleStateChange}
        onExport={handleExport}
        onStateFixed={handleStateFixed}
      />
      <HistoryPanel
        open={historyOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={(id) => {
          const session = sessionsRef.current.find((s) => s.id === id);
          setActiveSessionId(id);
          setMessages((session?.messages as AppUIMessage[]) ?? []);
          setStatesReadyCount(0);
        }}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
