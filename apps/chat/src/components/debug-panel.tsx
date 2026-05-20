/**
 * DebugPanel — floating dev panel (DEV mode only) for scenario simulation and message log.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-5]
 * @see docs/specs/210-app-chat/design.md [DES-UI]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-DIAGNOSTICS]
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bug,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  MonitorCog,
  Palette,
  PlugZap,
  RotateCcw,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";

import { AFX_STYLE_IDS, type AfxStyleId, type AfxThemeId } from "@afx/shared";
import type { AgentRuntimeStatus } from "@afx/shared";
import type { LogEntry, MockTransport } from "@afx/transport";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import { Separator } from "@afx/ui/components/separator";
import { Slider } from "@afx/ui/components/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@afx/ui/components/tabs";

import {
  HOST_MODE_CLASSES,
  type HostModeClass,
  applyDebugHostMode,
  applyRuntimeAppearance,
  resetDebugAppearance,
} from "../lib/theme-preview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "scenarios" | "appearance" | "log";

interface State {
  open: boolean;
  tab: Tab;
  log: LogEntry[];
  streamSpeed: number;
  runtimeRunning: boolean;
  runtimeStreaming: boolean;
  appearanceTheme: AfxThemeId;
  appearanceStyle: AfxStyleId;
  hostMode: HostModeClass;
}

type Action =
  | { type: "set-open"; open: boolean }
  | { type: "set-tab"; tab: Tab }
  | { type: "append-log"; entry: LogEntry }
  | { type: "clear-log" }
  | { type: "set-speed"; ms: number }
  | { type: "set-runtime-status"; running: boolean; streaming: boolean }
  | { type: "set-appearance"; theme?: AfxThemeId; style?: AfxStyleId }
  | { type: "set-host-mode"; hostMode: HostModeClass }
  | { type: "reset-appearance" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set-open":
      return { ...state, open: action.open };
    case "set-tab":
      return { ...state, tab: action.tab };
    case "append-log":
      return { ...state, log: [...state.log.slice(-199), action.entry] };
    case "clear-log":
      return { ...state, log: [] };
    case "set-speed":
      return { ...state, streamSpeed: action.ms };
    case "set-runtime-status":
      return { ...state, runtimeRunning: action.running, runtimeStreaming: action.streaming };
    case "set-appearance":
      return {
        ...state,
        appearanceTheme: action.theme ?? state.appearanceTheme,
        appearanceStyle: action.style ?? state.appearanceStyle,
      };
    case "set-host-mode":
      return { ...state, hostMode: action.hostMode };
    case "reset-appearance":
      return {
        ...state,
        appearanceTheme: "meridian",
        appearanceStyle: "lyra",
        hostMode: "vscode-dark",
      };
    default:
      return state;
  }
}

const APPEARANCE_STORAGE_KEY = "afx-debug-appearance";

const INITIAL: State = {
  open: false,
  tab: "scenarios",
  log: [],
  streamSpeed: 40,
  runtimeRunning: false,
  runtimeStreaming: false,
  appearanceTheme: "meridian",
  appearanceStyle: "lyra",
  hostMode: "vscode-dark",
};

// ---------------------------------------------------------------------------
// Scenario metadata — grouped by category for visual organization
// ---------------------------------------------------------------------------

interface ScenarioMeta {
  name: string;
  label: string;
  accent: string;
}

interface ScenarioGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ScenarioMeta[];
}

const SCENARIO_GROUPS: ScenarioGroup[] = [
  {
    label: "Replies",
    icon: MessageCircle,
    items: [
      { name: "quick-reply", label: "Quick", accent: "bg-afx-success" },
      { name: "streaming-reply", label: "Streaming", accent: "bg-afx-success" },
      { name: "large-response", label: "Large", accent: "bg-afx-success" },
      { name: "coding-benchmark", label: "Coding bench", accent: "bg-afx-success" },
      { name: "thinking-reply", label: "Thinking", accent: "bg-afx-info" },
      { name: "steer", label: "Steer", accent: "bg-afx-info" },
      { name: "follow-up", label: "Follow-up", accent: "bg-afx-info" },
      { name: "queue-many", label: "Queue many", accent: "bg-afx-info" },
    ],
  },
  {
    label: "Tools",
    icon: Wrench,
    items: [
      { name: "tool-bash", label: "bash", accent: "bg-afx-brand" },
      { name: "tool-read-file", label: "read", accent: "bg-afx-brand" },
      { name: "tool-edit-file", label: "edit", accent: "bg-afx-brand" },
      { name: "multi-tool", label: "Multi-tool", accent: "bg-afx-brand" },
    ],
  },
  {
    label: "Spec workflow",
    icon: MonitorCog,
    items: [
      { name: "spec-doc-actions", label: "Spec actions", accent: "bg-afx-brand" },
      { name: "spec-doc-clear", label: "Clear doc", accent: "bg-muted-foreground" },
      { name: "spec-doc-preview", label: "Preview doc", accent: "bg-afx-brand" },
      { name: "long-next-actions", label: "Long next", accent: "bg-afx-brand" },
      { name: "sprint-doc-actions", label: "Sprint actions", accent: "bg-afx-brand" },
      { name: "journal-doc-actions", label: "Journal actions", accent: "bg-afx-brand" },
      { name: "global-journal-doc-actions", label: "Global journal", accent: "bg-afx-brand" },
      { name: "tasks-sign-off-ready", label: "Sign Off ready", accent: "bg-afx-warning" },
      { name: "tasks-sign-off-relaxed", label: "Sign Off relaxed", accent: "bg-muted-foreground" },
    ],
  },
  {
    label: "Failures & state",
    icon: AlertTriangle,
    items: [
      { name: "tool-error", label: "Tool error", accent: "bg-afx-warning" },
      { name: "provider-error", label: "Provider error", accent: "bg-destructive" },
      { name: "abort", label: "Abort", accent: "bg-afx-warning" },
      { name: "startup", label: "Startup", accent: "bg-afx-info" },
      { name: "disconnected", label: "Disconnected", accent: "bg-destructive" },
      { name: "long-disconnect", label: "Long disconnect", accent: "bg-destructive" },
      { name: "retry-recovery", label: "Retry recovery", accent: "bg-afx-success" },
      { name: "restart-recovery", label: "Restart recovery", accent: "bg-afx-success" },
      { name: "context-near-full", label: "Ctx near full", accent: "bg-afx-warning" },
      { name: "context-recovery", label: "Ctx recovery", accent: "bg-afx-success" },
    ],
  },
  {
    label: "Runtime controls",
    icon: PlugZap,
    items: [
      { name: "runtimeSettingsLoaded", label: "Runtime", accent: "bg-afx-info" },
      { name: "compacting", label: "Compacting", accent: "bg-afx-warning" },
    ],
  },
  {
    label: "Foundation",
    icon: PlugZap,
    items: [
      { name: "appearancePreview", label: "Appearance", accent: "bg-afx-brand" },
      { name: "modelsLoaded", label: "Models", accent: "bg-afx-info" },
      { name: "modelsEmpty", label: "No models", accent: "bg-muted-foreground" },
      { name: "commandsLoaded", label: "Commands", accent: "bg-afx-info" },
      { name: "filesListed", label: "Files", accent: "bg-afx-info" },
      { name: "stderrLoaded", label: "stderr", accent: "bg-afx-warning" },
      { name: "settingsSnapshotLoaded", label: "Settings", accent: "bg-afx-info" },
    ],
  },
  {
    label: "Providers",
    icon: PlugZap,
    items: [
      { name: "providersEmpty", label: "Empty", accent: "bg-muted-foreground" },
      { name: "providersAnthropicConfigured", label: "Anthropic", accent: "bg-afx-success" },
      { name: "providersMultiConfigured", label: "Multi", accent: "bg-afx-success" },
      { name: "externalAgentOnly", label: "Local only", accent: "bg-afx-info" },
      { name: "bothConfigured", label: "Both", accent: "bg-afx-brand" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ running, streaming }: { running: boolean; streaming: boolean }) {
  const { dotClass, label } = !running
    ? { dotClass: "bg-destructive", label: "Disconnected" }
    : streaming
      ? { dotClass: "bg-afx-warning animate-pulse", label: "Streaming" }
      : { dotClass: "bg-afx-success", label: "Idle" };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function getSafeLocalStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    return storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
      ? storage
      : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Log entry row
// ---------------------------------------------------------------------------

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.ts).toISOString().slice(11, 23);
  const isOut = entry.dir === "out";
  const displayType = entry.type;

  return (
    <div className="border-b border-border/30 px-2 py-1 hover:bg-muted/20">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={`Toggle entry ${displayType}`}
        className="flex w-full items-center gap-2 text-left font-mono text-[10px]"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {isOut ? (
          <ArrowUp className="h-3 w-3 shrink-0 text-afx-info" />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0 text-afx-success" />
        )}
        <span className="flex-1 truncate text-foreground/80">{displayType}</span>
        <span className="shrink-0 text-muted-foreground">{time}</span>
      </button>
      {expanded && (
        <pre className="mt-1 ml-6 overflow-x-auto rounded border border-border/40 bg-muted/40 px-2 py-1 text-[9px] leading-snug text-muted-foreground">
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface DebugPanelProps {
  transport: MockTransport;
}

export function DebugPanel({ transport }: DebugPanelProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to log stream
  useEffect(() => {
    const off = transport.onLog((entry) => {
      dispatch({ type: "append-log", entry });
      if (entry.type === "agent/status") {
        const status = (entry.payload as { status?: AgentRuntimeStatus }).status;
        dispatch({
          type: "set-runtime-status",
          running: status?.running ?? false,
          streaming: status?.isStreaming ?? false,
        });
      }
    });
    for (const entry of transport.getLog()) {
      dispatch({ type: "append-log", entry });
    }
    return off;
  }, [transport]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (state.open && state.tab === "log") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.log, state.open, state.tab]);

  useEffect(() => {
    const storage = getSafeLocalStorage();
    const raw = storage?.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<{
        theme: AfxThemeId;
        style: AfxStyleId;
        hostMode: HostModeClass;
      }>;
      dispatch({
        type: "set-appearance",
        theme: parsed.theme === "meridian" ? parsed.theme : undefined,
        style:
          parsed.style && (AFX_STYLE_IDS as readonly string[]).includes(parsed.style)
            ? parsed.style
            : undefined,
      });
      if (parsed.hostMode && HOST_MODE_CLASSES.includes(parsed.hostMode)) {
        dispatch({ type: "set-host-mode", hostMode: parsed.hostMode });
      }
    } catch {
      storage?.removeItem(APPEARANCE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    applyRuntimeAppearance(state.appearanceTheme, state.appearanceStyle);
    applyDebugHostMode(state.hostMode);
    getSafeLocalStorage()?.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        theme: state.appearanceTheme,
        style: state.appearanceStyle,
        hostMode: state.hostMode,
      }),
    );
  }, [state.appearanceTheme, state.appearanceStyle, state.hostMode]);

  const dotColor = useMemo(
    () =>
      !state.runtimeRunning
        ? "bg-destructive"
        : state.runtimeStreaming
          ? "bg-afx-warning animate-pulse"
          : "bg-afx-success",
    [state.runtimeRunning, state.runtimeStreaming],
  );

  return (
    <Popover open={state.open} onOpenChange={(open) => dispatch({ type: "set-open", open })}>
      {state.open && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px]"
        />
      )}
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-20 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-muted"
          title="Toggle Debug Panel"
          aria-label="Toggle Debug Panel"
        >
          <Bug className="h-4 w-4 text-muted-foreground" />
          <span
            className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-background ${dotColor}`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-[360px] overflow-hidden p-0"
      >
        <Tabs
          value={state.tab}
          onValueChange={(v) => dispatch({ type: "set-tab", tab: v as Tab })}
          className="gap-0"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2">
            <Bug className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-xs font-semibold tracking-wide text-foreground">
              Debug Panel
            </span>
            <StatusPill running={state.runtimeRunning} streaming={state.runtimeStreaming} />
          </div>

          {/* Tabs */}
          <TabsList variant="line" className="h-8 w-full justify-start gap-0 border-b px-2">
            <TabsTrigger value="scenarios" className="h-8 gap-1.5 px-3 text-[11px]">
              <Zap className="h-3 w-3" />
              Scenarios
            </TabsTrigger>
            <TabsTrigger value="appearance" className="h-8 gap-1.5 px-3 text-[11px]">
              <Palette className="h-3 w-3" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="log" className="h-8 gap-1.5 px-3 text-[11px]">
              <Activity className="h-3 w-3" />
              Log
              {state.log.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[9px]">
                  {state.log.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Scenarios */}
          <TabsContent value="scenarios" className="m-0 max-h-[420px] overflow-y-auto">
            <div className="flex flex-col gap-3 p-3">
              {SCENARIO_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <section key={group.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {group.label}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.items.map((s) => (
                        <Button
                          key={s.name}
                          size="xs"
                          variant="outline"
                          onClick={() => transport.scenarios[s.name]?.()}
                          className="justify-start gap-2 text-[11px] font-normal"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.accent}`} />
                          <span className="truncate">{s.label}</span>
                        </Button>
                      ))}
                    </div>
                  </section>
                );
              })}

              <Separator />

              <section className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  Recent traffic
                </div>
                <div className="rounded-sm border bg-muted/20">
                  {state.log.slice(-3).length === 0 ? (
                    <p className="px-2 py-2 text-[10px] text-muted-foreground">
                      No transport messages yet.
                    </p>
                  ) : (
                    state.log.slice(-3).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 border-b px-2 py-1 font-mono text-[10px] last:border-b-0"
                      >
                        <span
                          className={entry.dir === "out" ? "text-afx-info" : "text-afx-success"}
                        >
                          {entry.dir}
                        </span>
                        <span className="truncate text-muted-foreground">{entry.type}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Stream speed */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <PlugZap className="h-3 w-3" />
                    Stream speed
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {state.streamSpeed} ms/chunk
                  </span>
                </div>
                <Slider
                  value={[state.streamSpeed]}
                  onValueChange={(v) => {
                    const ms = v[0] ?? 0;
                    dispatch({ type: "set-speed", ms });
                    transport.setStreamSpeed(ms);
                  }}
                  min={0}
                  max={200}
                  step={5}
                  aria-label="Stream speed"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>instant</span>
                  <span>slow</span>
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="m-0 max-h-[420px] overflow-y-auto">
            <div className="flex flex-col gap-3 p-3">
              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Palette className="h-3 w-3" />
                  Identity
                </div>
                <NativeSelect
                  size="sm"
                  className="w-full"
                  value={state.appearanceTheme}
                  onChange={(event) =>
                    dispatch({
                      type: "set-appearance",
                      theme: event.currentTarget.value as AfxThemeId,
                    })
                  }
                  aria-label="Debug identity preview"
                >
                  <NativeSelectOption value="meridian">AFX / Meridian</NativeSelectOption>
                </NativeSelect>
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  Style treatment
                </div>
                <NativeSelect
                  size="sm"
                  className="w-full"
                  value={state.appearanceStyle}
                  onChange={(event) =>
                    dispatch({
                      type: "set-appearance",
                      style: event.currentTarget.value as AfxStyleId,
                    })
                  }
                  aria-label="Debug style preview"
                >
                  {AFX_STYLE_IDS.map((style) => (
                    <NativeSelectOption key={style} value={style}>
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <MonitorCog className="h-3 w-3" />
                  Host mode
                </div>
                <NativeSelect
                  size="sm"
                  className="w-full"
                  value={state.hostMode}
                  onChange={(event) =>
                    dispatch({
                      type: "set-host-mode",
                      hostMode: event.currentTarget.value as HostModeClass,
                    })
                  }
                  aria-label="Debug host mode preview"
                >
                  {HOST_MODE_CLASSES.map((mode) => (
                    <NativeSelectOption key={mode} value={mode}>
                      {mode.replace("vscode-", "")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </section>

              <Button
                type="button"
                size="xs"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  resetDebugAppearance();
                  getSafeLocalStorage()?.removeItem(APPEARANCE_STORAGE_KEY);
                  dispatch({ type: "reset-appearance" });
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset appearance preview
              </Button>
            </div>
          </TabsContent>

          {/* Log */}
          <TabsContent value="log" className="m-0 flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {state.log.length} {state.log.length === 1 ? "entry" : "entries"}
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => dispatch({ type: "clear-log" })}
                className="h-5 gap-1 px-1.5 text-[10px]"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </div>
            <ScrollArea className="h-[320px]">
              {state.log.length === 0 ? (
                <div className="flex h-[320px] flex-col items-center justify-center gap-1 text-center">
                  <Activity className="h-5 w-5 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground">No messages yet</p>
                  <p className="text-[10px] text-muted-foreground/60">
                    Fire a scenario to see traffic
                  </p>
                </div>
              ) : (
                <>
                  {state.log.map((e, index) => (
                    <LogRow key={`${e.id}:${index}`} entry={e} />
                  ))}
                  <div ref={logEndRef} />
                </>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
