/**
 * Root application shell — mounts Chat/History/Settings tabs and DEV-only DebugPanel.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-6] [FR-7]
 * @see docs/specs/210-app-chat/design.md [DES-ARCH]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-12]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-ONBOARDING]
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { History as HistoryIcon } from "lucide-react";

import { type AgentRuntimeStatus, createCheckingAgentRuntimeStatus } from "@afx/shared";
import type { MockTransport, Transport } from "@afx/transport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@afx/ui/components/tabs";
import { cn } from "@afx/ui/lib/utils";

import type { AgentRecoveryActions } from "./components/agent-recovery-card";
import { DebugPanel } from "./components/debug-panel";
import { Toaster, toast } from "./components/toast";
import { bridgeOn, bridgeSend } from "./lib/bridge";
import { setClarityEnabled } from "./lib/clarity";
import type { SettingsOpenTarget } from "./lib/settings-navigation";
import Chat from "./views/chat";
import History from "./views/history";
import { SessionBrowser } from "./views/session-browser";
import Settings from "./views/settings";

const TABS = [
  { value: "chat", label: "Chat" },
  { value: "history", label: "History" },
  { value: "settings", label: "Settings" },
] as const;

interface PersistedWebviewState {
  draft?: string;
}

export interface AppProps {
  transport: Transport;
}

function isMockTransport(t: Transport): t is MockTransport {
  return "scenarios" in t && typeof (t as MockTransport).scenarios === "object";
}

function shouldReplaceDraftWithIncoming(content: string): boolean {
  return /^\/afx-[\w-]+(?:\s|$)/.test(content.trim());
}

function formatIncomingDraftInsertion(content: string): string {
  const trimmed = content.trim();
  return shouldReplaceDraftWithIncoming(trimmed) ? `${trimmed} ` : trimmed;
}

export default function App({ transport }: AppProps) {
  const showDebugPanel = import.meta.env.DEV && isMockTransport(transport);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["value"]>("chat");
  const [historyTab, setHistoryTab] = useState<"past" | "current">("past");
  const [settingsOpenTarget, setSettingsOpenTarget] = useState<SettingsOpenTarget | null>(null);
  const [insertCommand, setInsertCommand] = useState<string | null>(null);
  /** Draft message text — lifted here so it persists across tab switches and view remounts. */
  const [draft, setDraft] = useState(() => readPersistedDraft(transport));
  /** Recently submitted prompts — lifted here so model/runtime switches do not reset recall. */
  const [promptHistory, setPromptHistory] = useState<string[]>([]);

  /** React-style updater: accepts string OR functional updater like React setState. */
  const handleDraftChange = useCallback(
    (value: string | ((prev: string) => string)) => {
      setDraft((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        persistDraft(transport, next);
        return next;
      });
    },
    [transport],
  );
  const appendPromptHistory = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) return;
    setPromptHistory((prev) =>
      prev[prev.length - 1] === trimmed ? prev : [...prev.slice(-49), trimmed],
    );
  }, []);
  const openSettings = useCallback((target: SettingsOpenTarget = "connect") => {
    setSettingsOpenTarget(target);
    setActiveTab("settings");
  }, []);
  const handleSettingsOpenTargetConsumed = useCallback(() => {
    setSettingsOpenTarget(null);
  }, []);
  const [agentStatus, setAgentStatus] = useState<AgentRuntimeStatus>(() =>
    createCheckingAgentRuntimeStatus(),
  );

  useEffect(() => {
    const offs = [
      bridgeOn("agent/status", (msg) => {
        setAgentStatus(msg.status);
      }),
    ];
    const onVisibilityChange = () => {
      if (!document.hidden) {
        bridgeSend({ type: "agent/checkStatus", requestId: uid() });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    bridgeSend({ type: "chat/ready" });
    bridgeSend({ type: "agent/checkStatus", requestId: uid() });
    return () => {
      offs.forEach((off) => off());
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const offs = [
      bridgeOn("chat/draftAppend", (msg) => {
        const insertion = formatIncomingDraftInsertion(msg.content);
        if (!insertion) return;
        setActiveTab("chat");
        handleDraftChange((prev) => {
          if (shouldReplaceDraftWithIncoming(insertion)) return insertion;
          const base = prev.trimEnd();
          if (base.length === 0) return insertion;
          return `${base}\n\n${insertion}`;
        });
        window.requestAnimationFrame(() => {
          const el = document.getElementById("afx-chat-composer");
          if (el instanceof HTMLTextAreaElement) {
            el.focus();
            const end = el.value.length;
            el.setSelectionRange(end, end);
          }
        });
      }),
      bridgeOn("chat/toast", (msg) => {
        const duration = msg.durationMs;
        if (msg.tone === "success") {
          toast.success(msg.message, msg.description, duration);
        } else if (msg.tone === "error") {
          toast.error(msg.message, msg.description, duration);
        } else {
          toast.info(msg.message, msg.description, duration);
        }
      }),
      bridgeOn("agent/telemetryState", (msg) => {
        setClarityEnabled(msg.enabled);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [handleDraftChange]);

  const isCheckingAgent = agentStatus.phase === "checking" || agentStatus.phase === "starting";
  const recoveryActions = useMemo<AgentRecoveryActions>(
    () => ({
      onRetryConnection: () => bridgeSend({ type: "agent/checkStatus", requestId: uid() }),
      onRestartAgent: () => bridgeSend({ type: "agent/restart", requestId: uid() }),
      onOpenSettings: () => openSettings("connect"),
      onReloadHost: () => bridgeSend({ type: "agent/reload", requestId: uid() }),
    }),
    [openSettings],
  );

  useEffect(() => {
    if (agentStatus.phase !== "ready" && agentStatus.phase !== "busy") return;
    bridgeSend({ type: "chat/getState" });
  }, [agentStatus.phase]);

  function handleInsertCommand(commandText: string) {
    setInsertCommand(commandText);
    setActiveTab("chat");
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as (typeof TABS)[number]["value"])}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-0"
      >
        <TabsList variant="line" className="h-9 w-full min-w-0 justify-start gap-0 border-b px-1">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="h-9 min-w-0 flex-1 rounded-none px-1.5 text-[11px] after:bottom-0 after:block after:opacity-0 data-[state=active]:after:opacity-100 data-[state=inactive]:after:opacity-0"
            >
              <span className="truncate">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          forceMount
          value="chat"
          className={cn("flex-1 min-h-0 overflow-hidden", activeTab !== "chat" && "hidden")}
        >
          <Chat
            agentStatus={agentStatus}
            recoveryActions={recoveryActions}
            isCheckingAgent={isCheckingAgent}
            insertCommand={insertCommand}
            onCommandInserted={() => setInsertCommand(null)}
            onOpenSettings={openSettings}
            draft={draft}
            onDraftChange={handleDraftChange}
            promptHistory={promptHistory}
            onPromptHistoryAppend={appendPromptHistory}
          />
        </TabsContent>
        <TabsContent
          forceMount
          value="history"
          className={cn("flex-1 min-h-0 overflow-hidden", activeTab !== "history" && "hidden")}
        >
          {/* @see docs/specs/213-app-chat-history/spec.md [FR-13] | docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-HISTORY-MOCKUPS] */}
          <div className="afx-surface-subtle @container flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b bg-background/95 px-2 py-3">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <span className="afx-surface-card flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-afx-brand-soft">
                  <HistoryIcon size={15} />
                </span>
                History
              </h2>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                Browse and reopen past conversations.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1 @[280px]:flex @[280px]:flex-wrap">
                {(
                  [
                    { id: "past", label: "Past sessions", shortLabel: "Past" },
                    { id: "current", label: "Current session", shortLabel: "Current" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={t.label}
                    className={cn(
                      "h-6 min-w-0 shrink-0 whitespace-nowrap rounded-sm border border-transparent px-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground",
                      historyTab === t.id &&
                        "border-border bg-muted text-foreground shadow-sm ring-1 ring-foreground/10",
                    )}
                    onClick={() => setHistoryTab(t.id)}
                  >
                    <span aria-hidden="true" className="hidden @[250px]:inline">
                      {t.label}
                    </span>
                    <span aria-hidden="true" className="@[250px]:hidden">
                      {t.shortLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div
              className={cn(
                "@container min-h-0 flex-1 overflow-y-auto px-2 py-3",
                historyTab !== "past" && "hidden",
              )}
            >
              <SessionBrowser
                active={activeTab === "history" && historyTab === "past"}
                onReopened={() => setActiveTab("chat")}
              />
            </div>
            <div
              className={cn("min-h-0 flex-1 overflow-hidden", historyTab !== "current" && "hidden")}
            >
              <History
                agentStatus={agentStatus}
                recoveryActions={recoveryActions}
                isCheckingAgent={isCheckingAgent}
                onInsertCommand={handleInsertCommand}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent
          forceMount
          value="settings"
          className={cn("flex-1 min-h-0 overflow-hidden", activeTab !== "settings" && "hidden")}
        >
          <Settings
            agentStatus={agentStatus}
            recoveryActions={recoveryActions}
            isCheckingAgent={isCheckingAgent}
            onInsertCommand={handleInsertCommand}
            openTarget={settingsOpenTarget}
            onOpenTargetConsumed={handleSettingsOpenTargetConsumed}
          />
        </TabsContent>
      </Tabs>

      {showDebugPanel && <DebugPanel transport={transport} />}
      <Toaster />
    </div>
  );
}

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readPersistedDraft(transport: Transport): string {
  const state = transport.getState?.();
  if (!state || typeof state !== "object") return "";
  const draft = (state as PersistedWebviewState).draft;
  return typeof draft === "string" ? draft : "";
}

function persistDraft(transport: Transport, draft: string): void {
  const state = transport.getState?.();
  const nextState =
    state && typeof state === "object" ? { ...(state as PersistedWebviewState), draft } : { draft };
  transport.setState?.(nextState);
}
