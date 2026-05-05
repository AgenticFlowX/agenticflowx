/**
 * Settings view — runtime snapshot, diagnostics, and available skill discovery.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2] [FR-3] [FR-5] [FR-6]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-MODE] [DES-SETTINGS-MOCKUP-RUNTIME] [DES-SETTINGS-SURFACE-MAP] [DES-SETTINGS-SURFACE-MODE] [DES-SETTINGS-FLOW] [DES-SETTINGS-SURFACE-CONTEXT]
 * @see docs/specs/100-package-shared/spec.md [FR-7] [FR-9]
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  Activity,
  AlertTriangle,
  Brain,
  Brush,
  ChevronDown,
  Cpu,
  ExternalLink,
  FileText,
  Folder,
  Info,
  KeyRound,
  LoaderCircle,
  type LucideIcon,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  SlidersHorizontal,
  SwatchBook,
  Zap,
} from "lucide-react";

import type {
  AfxStyleId,
  AfxThemeId,
  AgentCommand,
  AgentRuntimeStatus,
  AgentStatus,
  QueueMode,
  SettingsSnapshot,
  ThinkingLevel,
  WorkspaceMode,
} from "@afx/shared";
import { createCheckingAgentRuntimeStatus } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { RadioGroup, RadioGroupItem } from "@afx/ui/components/radio-group";
import { Switch } from "@afx/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@afx/ui/components/tabs";
import { cn } from "@afx/ui/lib/utils";

import { type AgentRecoveryActions, AgentRecoveryCard } from "../components/agent-recovery-card";
import { ExternalAgentCard } from "../components/external-agent-card";
import { ProviderCard } from "../components/provider-card";
import { displayCommandName } from "../components/slash-popup";
import { toast } from "../components/toast";
import { bridgeOn, bridgeSend } from "../lib/bridge";
import { applyRuntimeAppearance } from "../lib/theme-preview";

type RuntimeSettings = Pick<
  AgentStatus,
  | "thinkingLevel"
  | "steeringMode"
  | "followUpMode"
  | "autoCompactionEnabled"
  | "autoRetryEnabled"
  | "isCompacting"
  | "sessionId"
  | "sessionName"
  | "messageCount"
>;

const ACTIONS = [
  { name: "/new", description: "New session", message: "chat/newSession" as const },
  { name: "/abort", description: "Abort active run", message: "chat/abort" as const },
];

const THINKING_LEVELS: ReadonlyArray<{ value: ThinkingLevel; label: string }> = [
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra-high" },
];

const QUEUE_MODES: ReadonlyArray<{ value: QueueMode; label: string }> = [
  { value: "all", label: "All — apply queued messages together" },
  { value: "one-at-a-time", label: "One at a time" },
];

const SETTINGS_SECTIONS = [
  { id: "mode", label: "Mode", shortLabel: "Mode" },
  { id: "runtime", label: "Runtime", shortLabel: "Run" },
  { id: "context", label: "Context", shortLabel: "Ctx" },
  { id: "identity", label: "Identity", shortLabel: "ID" },
  { id: "style", label: "Style", shortLabel: "Look" },
  { id: "providers", label: "Providers", shortLabel: "Models" },
  { id: "skills", label: "Skills", shortLabel: "Skills" },
  { id: "diagnostics", label: "Diagnostics", shortLabel: "Logs" },
  { id: "about", label: "About", shortLabel: "About" },
] as const;

type ProviderFilter = "all" | "ready" | "needs-key";

const PROVIDER_FILTERS: ReadonlyArray<{ value: ProviderFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "needs-key", label: "Needs key" },
];

const DEFAULT_TELEMETRY_SETTINGS: SettingsSnapshot["telemetry"] = {
  enabled: true,
  effectiveEnabled: true,
  vscodeTelemetryEnabled: true,
};

const DEFAULT_CONTEXT_SETTINGS: SettingsSnapshot["context"] = {
  includeActiveFileContext: true,
};

/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA]
 */
export interface SettingsProps {
  agentStatus?: AgentRuntimeStatus;
  recoveryActions?: AgentRecoveryActions;
  isCheckingAgent?: boolean;
  onInsertCommand?: (commandText: string) => void;
}

/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-MAP] [DES-SETTINGS-FLOW]
 */
export default function Settings({
  agentStatus = createCheckingAgentRuntimeStatus(),
  recoveryActions,
  isCheckingAgent = false,
  onInsertCommand,
}: SettingsProps) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [runtime, setRuntime] = useState<RuntimeSettings>({});
  const [stderr, setStderr] = useState("");
  const [showStderr, setShowStderr] = useState(false);
  const [activeSection, setActiveSection] =
    useState<(typeof SETTINGS_SECTIONS)[number]["id"]>("mode");
  const [providerTab, setProviderTab] = useState<"api" | "external">("api");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [providerSearch, setProviderSearch] = useState("");

  // Pending requestIds that should fire a success toast when their reply lands.
  const pendingRuntimeMutations = useRef<Map<string, string>>(new Map());
  const pendingModeMutations = useRef<Map<string, string>>(new Map());
  const pendingAppearanceMutations = useRef<Map<string, string>>(new Map());
  const pendingProviderMutations = useRef<Map<string, string>>(new Map());
  const pendingContextMutations = useRef<Map<string, string>>(new Map());
  const pendingTelemetryMutations = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const offs = [
      bridgeOn("agent/settingsSnapshot", (msg) => {
        setSnapshot(msg.snapshot);
        const contextLabel = pendingContextMutations.current.get(msg.requestId);
        if (contextLabel) {
          pendingContextMutations.current.delete(msg.requestId);
          toast.success(contextLabel);
        }
        const label = pendingProviderMutations.current.get(msg.requestId);
        if (label) {
          pendingProviderMutations.current.delete(msg.requestId);
          toast.success(label);
        }
        const modeLabel = pendingModeMutations.current.get(msg.requestId);
        if (modeLabel) {
          pendingModeMutations.current.delete(msg.requestId);
          toast.success(modeLabel);
        }
        const telemetryLabel = pendingTelemetryMutations.current.get(msg.requestId);
        if (telemetryLabel) {
          pendingTelemetryMutations.current.delete(msg.requestId);
          toast.success(telemetryLabel);
        }
      }),
      bridgeOn("agent/appearanceUpdated", (msg) => {
        setSnapshot((prev) => (prev ? { ...prev, appearance: msg.appearance } : prev));
        applyRuntimeAppearance(msg.appearance.theme, msg.appearance.style);
        const label = pendingAppearanceMutations.current.get(msg.requestId);
        if (label) {
          pendingAppearanceMutations.current.delete(msg.requestId);
          toast.success(label);
        }
      }),
      bridgeOn("agent/commands", (msg) => setCommands(msg.commands)),
      bridgeOn("agent/runtimeSettings", (msg) => {
        setRuntime(msg.settings);
        if (!msg.requestId) return;
        const label = pendingRuntimeMutations.current.get(msg.requestId);
        if (label) {
          pendingRuntimeMutations.current.delete(msg.requestId);
          toast.success(label);
        }
      }),
      bridgeOn("chat/error", (msg) => {
        if (!msg.requestId) return;
        const runtimeLabel = pendingRuntimeMutations.current.get(msg.requestId);
        const appearanceLabel = pendingAppearanceMutations.current.get(msg.requestId);
        const providerLabel = pendingProviderMutations.current.get(msg.requestId);
        const contextLabel = pendingContextMutations.current.get(msg.requestId);
        const modeLabel = pendingModeMutations.current.get(msg.requestId);
        const telemetryLabel = pendingTelemetryMutations.current.get(msg.requestId);
        const label =
          runtimeLabel ??
          appearanceLabel ??
          providerLabel ??
          contextLabel ??
          modeLabel ??
          telemetryLabel;
        if (!label) return;
        pendingRuntimeMutations.current.delete(msg.requestId);
        pendingAppearanceMutations.current.delete(msg.requestId);
        pendingProviderMutations.current.delete(msg.requestId);
        pendingContextMutations.current.delete(msg.requestId);
        pendingModeMutations.current.delete(msg.requestId);
        pendingTelemetryMutations.current.delete(msg.requestId);
        toast.error(`${label} failed`, msg.message);
      }),
      bridgeOn("agent/stderr", (msg) => {
        setStderr(msg.content);
        setShowStderr(true);
      }),
    ];
    bridgeSend({ type: "chat/getSettingsSnapshot", requestId: uid() });
    bridgeSend({ type: "chat/getCommands", requestId: uid() });
    // chat/getState is the only message that re-broadcasts agent/runtimeSettings,
    // so we trigger it here to populate the toggles after a tab switch.
    bridgeSend({ type: "chat/getState" });
    return () => offs.forEach((off) => off());
  }, []);

  const groups = useMemo(() => groupCommands(commands), [commands]);
  const skillCount = commands.length + ACTIONS.length;
  const runtimeUnconfigured = agentStatus.runtimeConfigured === false;
  const runtimeUnavailable =
    !runtimeUnconfigured && (agentStatus.phase === "disconnected" || agentStatus.phase === "error");
  const runtimeControlsDisabled = isCheckingAgent || runtimeUnavailable || runtimeUnconfigured;
  const snapshotProviders = snapshot?.providers;
  const telemetrySettings = snapshot?.telemetry ?? DEFAULT_TELEMETRY_SETTINGS;
  const contextSettings = snapshot?.context ?? DEFAULT_CONTEXT_SETTINGS;
  const activeMode = snapshot?.mode?.active ?? "code";
  const providers = useMemo(() => snapshotProviders ?? [], [snapshotProviders]);
  const providerStats = useMemo(() => {
    return providers.reduce(
      (stats, provider) => {
        const ready = provider.state === "configured" || provider.state === "no-key-needed";
        return {
          total: stats.total + 1,
          ready: stats.ready + (ready ? 1 : 0),
          needsKey: stats.needsKey + (!ready ? 1 : 0),
          models: stats.models + provider.modelCount,
        };
      },
      { total: 0, ready: 0, needsKey: 0, models: 0 },
    );
  }, [providers]);
  const visibleProviders = useMemo(() => {
    const search = providerSearch.trim().toLowerCase();
    return providers.filter((provider) => {
      const ready = provider.state === "configured" || provider.state === "no-key-needed";
      if (providerFilter === "ready" && !ready) return false;
      if (providerFilter === "needs-key" && ready) return false;
      if (!search) return true;
      const haystack = [
        provider.id,
        provider.name,
        provider.displayName,
        provider.modelHint,
        ...(provider.models ?? []).map((model) => `${model.name ?? ""} ${model.id}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [providerFilter, providerSearch, providers]);
  const sdkEnabled = snapshot?.sdk?.enabled !== false;
  const rpcEnabled = snapshot?.engine.rpcEnabled ?? agentStatus.rpcEnabled === true;
  const piAgent = snapshot?.externalAgents?.find((agent) => agent.id === "pi");
  const rpcStatus = piAgent?.status ?? (rpcEnabled ? "unavailable" : "disabled");
  const apiProviderSummary =
    providerStats.ready > 0
      ? `${providerStats.ready} ready · ${providerStats.models} models`
      : providerStats.total > 0
        ? `${providerStats.needsKey} need keys`
        : "No providers reported yet";

  function trackRuntimeMutation(label: string): string {
    const requestId = uid();
    pendingRuntimeMutations.current.set(requestId, label);
    return requestId;
  }
  function trackAppearanceMutation(label: string): string {
    const requestId = uid();
    pendingAppearanceMutations.current.set(requestId, label);
    return requestId;
  }
  function trackProviderMutation(label: string): string {
    const requestId = uid();
    pendingProviderMutations.current.set(requestId, label);
    return requestId;
  }
  function trackContextMutation(label: string): string {
    const requestId = uid();
    pendingContextMutations.current.set(requestId, label);
    return requestId;
  }
  function trackModeMutation(label: string): string {
    const requestId = uid();
    pendingModeMutations.current.set(requestId, label);
    return requestId;
  }
  function trackTelemetryMutation(label: string): string {
    const requestId = uid();
    pendingTelemetryMutations.current.set(requestId, label);
    return requestId;
  }
  function applyThinkingLevel(level: ThinkingLevel) {
    setRuntime((r) => ({ ...r, thinkingLevel: level }));
    bridgeSend({
      type: "chat/setThinkingLevel",
      requestId: trackRuntimeMutation(`Thinking level set to ${level}`),
      level,
    });
  }
  function applySteeringMode(mode: QueueMode) {
    setRuntime((r) => ({ ...r, steeringMode: mode }));
    bridgeSend({
      type: "chat/setSteeringMode",
      requestId: trackRuntimeMutation(`Steering mode set to ${mode}`),
      mode,
    });
  }
  function applyFollowUpMode(mode: QueueMode) {
    setRuntime((r) => ({ ...r, followUpMode: mode }));
    bridgeSend({
      type: "chat/setFollowUpMode",
      requestId: trackRuntimeMutation(`Follow-up mode set to ${mode}`),
      mode,
    });
  }
  function applyAutoCompaction(enabled: boolean) {
    setRuntime((r) => ({ ...r, autoCompactionEnabled: enabled }));
    bridgeSend({
      type: "chat/setAutoCompaction",
      requestId: trackRuntimeMutation(`Auto-compaction ${enabled ? "enabled" : "disabled"}`),
      enabled,
    });
  }
  function applyAutoRetry(enabled: boolean) {
    setRuntime((r) => ({ ...r, autoRetryEnabled: enabled }));
    bridgeSend({
      type: "chat/setAutoRetry",
      requestId: trackRuntimeMutation(`Auto-retry ${enabled ? "enabled" : "disabled"}`),
      enabled,
    });
  }
  function applyIncludeActiveFileContext(enabled: boolean) {
    setSnapshot((prev) =>
      prev
        ? {
            ...prev,
            context: {
              ...(prev.context ?? DEFAULT_CONTEXT_SETTINGS),
              includeActiveFileContext: enabled,
            },
          }
        : prev,
    );
    bridgeSend({
      type: "chat/setIncludeActiveFileContext",
      requestId: trackContextMutation(`Active file context ${enabled ? "enabled" : "disabled"}`),
      enabled,
    });
  }
  function applyMode(mode: WorkspaceMode) {
    setSnapshot((prev) => (prev ? { ...prev, mode: { active: mode } } : prev));
    bridgeSend({
      type: "chat/setMode",
      requestId: trackModeMutation(`${mode === "explore" ? "Explore" : "Code"} mode selected`),
      mode,
    });
  }
  function jumpToSection(id: string) {
    setActiveSection(id as (typeof SETTINGS_SECTIONS)[number]["id"]);
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function jumpToProviders(tab: "api" | "external") {
    setProviderTab(tab);
    jumpToSection("providers");
  }
  function applyTheme(theme: AfxThemeId) {
    const appearance = snapshot?.appearance;
    if (!appearance) return;
    const next = { ...appearance, theme };
    setSnapshot((prev) => (prev ? { ...prev, appearance: next } : prev));
    applyRuntimeAppearance(theme, appearance.style);
    bridgeSend({
      type: "appearance/update",
      requestId: trackAppearanceMutation(`Theme set to ${theme}`),
      theme,
    });
  }
  function applyStyle(style: AfxStyleId) {
    const appearance = snapshot?.appearance;
    if (!appearance) return;
    const next = { ...appearance, style };
    setSnapshot((prev) => (prev ? { ...prev, appearance: next } : prev));
    applyRuntimeAppearance(appearance.theme, style);
    bridgeSend({
      type: "appearance/update",
      requestId: trackAppearanceMutation(`Style set to ${style}`),
      style,
    });
  }
  function saveProviderKey(provider: string, key: string): Promise<void> {
    bridgeSend({
      type: "provider/setApiKey",
      requestId: trackProviderMutation(`${providerLabel(provider)} key saved`),
      provider,
      key,
    });
    return Promise.resolve();
  }
  function clearProviderKey(provider: string): Promise<void> {
    bridgeSend({
      type: "provider/clearApiKey",
      requestId: trackProviderMutation(`${providerLabel(provider)} key cleared`),
      provider,
    });
    return Promise.resolve();
  }
  function setProviderDefaultModel(provider: string, modelId: string): Promise<void> {
    bridgeSend({
      type: "provider/setDefaultModel",
      requestId: trackProviderMutation(`${providerLabel(provider)} default model updated`),
      provider,
      modelId,
    });
    return Promise.resolve();
  }
  function detectPiBinary(): Promise<void> {
    bridgeSend({
      type: "external/detectPiBinary",
      requestId: trackProviderMutation("Pi CLI detection complete"),
    });
    return Promise.resolve();
  }
  function setEphemeralSession(enabled: boolean): void {
    bridgeSend({
      type: "external/setEphemeral",
      requestId: trackProviderMutation(`Ephemeral sessions ${enabled ? "enabled" : "disabled"}`),
      enabled,
    });
  }
  function setRpcEnabled(enabled: boolean): void {
    bridgeSend({
      type: "external/setRpcEnabled",
      requestId: trackProviderMutation(`Pi RPC ${enabled ? "enabled" : "disabled"}`),
      enabled,
    });
  }
  function setTelemetryEnabled(enabled: boolean): void {
    setSnapshot((prev) =>
      prev
        ? {
            ...prev,
            telemetry: {
              ...(prev.telemetry ?? DEFAULT_TELEMETRY_SETTINGS),
              enabled,
              effectiveEnabled:
                enabled && (prev.telemetry ?? DEFAULT_TELEMETRY_SETTINGS).vscodeTelemetryEnabled,
            },
          }
        : prev,
    );
    bridgeSend({
      type: "telemetry/setEnabled",
      requestId: trackTelemetryMutation(`Anonymous analytics ${enabled ? "enabled" : "disabled"}`),
      enabled,
    });
  }
  function openSetting(
    key:
      | "afx.agentBinaryPath"
      | "afx.agentEphemeralSession"
      | "afx.rpc.enabled"
      | "afx.sessionDir"
      | "afx.sdk.enabled"
      | "afx.sdk.defaultModel"
      | "afx.sdk.ollamaBaseUrl"
      | "afx.debugPerf"
      | "afx.logLevel"
      | "afx.theme"
      | "afx.style"
      | "afx.telemetry.enabled",
  ): void {
    bridgeSend({ type: "chat/openSettings", requestId: uid(), key });
  }
  function requestStderr(): void {
    setShowStderr(true);
    bridgeSend({ type: "chat/getStderr", requestId: uid(), maxLines: 200 });
  }

  return (
    <div className="afx-surface-subtle @container h-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
      <div className="flex min-w-0 flex-col gap-3 px-2 py-3">
        {/* Surface: [ChatSettings.Nav] */}
        <div className="sticky top-0 z-20 -mx-2 -mt-3 border-b bg-background/95 px-2 py-3 backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <span className="afx-surface-card flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-afx-brand-soft">
                  <Settings2 size={15} />
                </span>
                Settings
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Runtime paths, context, providers, appearance
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 @[250px]:flex @[250px]:flex-wrap">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                aria-label={section.label}
                className={cn(
                  "h-6 min-w-0 shrink-0 rounded-sm border border-transparent px-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground @[250px]:px-1.5",
                  activeSection === section.id &&
                    "border-border bg-muted text-foreground shadow-sm ring-1 ring-foreground/10",
                )}
                onClick={() => jumpToSection(section.id)}
              >
                <span aria-hidden="true" className="hidden @[250px]:inline">
                  {section.label}
                </span>
                <span aria-hidden="true" className="@[250px]:hidden">
                  {section.shortLabel}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Surface: [ChatSettings.Readiness] */}
        {isCheckingAgent ? <SettingsSetupCard /> : null}
        {runtimeUnconfigured ? (
          <RuntimeConfigurationNotice
            apiProvidersEnabled={sdkEnabled}
            rpcEnabled={rpcEnabled}
            recoveryActions={recoveryActions}
            onOpenApiProviders={() => jumpToProviders("api")}
            onOpenExternalAgents={() => jumpToProviders("external")}
            onViewLogs={requestStderr}
          />
        ) : null}
        {runtimeUnavailable ? (
          <AgentRecoveryCard status={agentStatus} actions={recoveryActions} />
        ) : null}

        {/* Surface: [ChatSettings.Mode] */}
        <SettingsCard
          id="mode"
          icon={SlidersHorizontal}
          title="Mode"
          description="Choose the workspace posture. Code is the default full-access Pi-backed mode; Explore is read-only and best for inspection, tracing, and planning."
        >
          <RadioGroup
            value={activeMode}
            onValueChange={(value) => applyMode(value as WorkspaceMode)}
            className="grid gap-2"
          >
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-sm border bg-muted/20 px-2 py-2 transition-colors hover:bg-muted/40",
                activeMode === "code" && "border-border bg-muted/40",
              )}
              onClick={(event) => {
                if (
                  (event.target as HTMLElement | null)?.closest('[data-slot="radio-group-item"]')
                ) {
                  return;
                }
                applyMode("code");
              }}
            >
              <RadioGroupItem value="code" className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="text-[11px] font-medium text-foreground">Code</span>
                <span className="text-[10px] leading-relaxed text-muted-foreground">
                  Default. Full access. Pi can act and edit.
                </span>
              </div>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-sm border bg-muted/20 px-2 py-2 transition-colors hover:bg-muted/40",
                activeMode === "explore" && "border-amber-500/40 bg-amber-500/5",
              )}
              onClick={(event) => {
                if (
                  (event.target as HTMLElement | null)?.closest('[data-slot="radio-group-item"]')
                ) {
                  return;
                }
                applyMode("explore");
              }}
            >
              <RadioGroupItem value="explore" className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">Explore</span>
                  <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wide">
                    Experimental
                  </Badge>
                </div>
                <span className="text-[10px] leading-relaxed text-muted-foreground">
                  Read-only investigation mode for inspection, tracing, and planning. The host
                  blocks shell commands before they spawn.
                </span>
              </div>
            </label>
          </RadioGroup>
          <p className="rounded-sm border border-border/60 bg-muted/25 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
            The model stays shared across both modes.
          </p>
        </SettingsCard>

        {/* Surface: [ChatSettings.RuntimeSetup] */}
        <SettingsCard
          id="runtime"
          icon={PlugZap}
          title="Runtime Setup"
          description="Pick the model path first. Hosted SDK keys and Pi RPC opt-in are both reachable here."
        >
          <div className="flex flex-col gap-2.5">
            <div className="grid gap-2 @[520px]:grid-cols-2">
              <RuntimeChoiceBlock
                icon={KeyRound}
                title="API Provider SDK"
                badge={sdkEnabled ? "Default" : "Off"}
                description="Recommended first-run path: paste a provider key and start without a local Pi install."
              >
                <div className="grid grid-cols-3 gap-1">
                  <ProviderStat label="Ready" value={providerStats.ready} />
                  <ProviderStat label="Needs key" value={providerStats.needsKey} />
                  <ProviderStat label="Models" value={providerStats.models} />
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {apiProviderSummary}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    className="min-w-0"
                    onClick={() => jumpToProviders("api")}
                  >
                    {providerStats.ready > 0 ? "Manage keys" : "Paste API key"}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="min-w-0"
                    onClick={() => openSetting("afx.sdk.enabled")}
                  >
                    SDK setting
                  </Button>
                </div>
              </RuntimeChoiceBlock>

              <RuntimeChoiceBlock
                icon={PlugZap}
                title="Pi RPC"
                badge={rpcEnabled ? "On" : "Off"}
                description="Opt in only when you want AFX to spawn your installed Pi CLI with --mode rpc."
              >
                <SwitchRow
                  id="runtime-setup-pi-rpc"
                  label="Enable Pi RPC"
                  description={
                    rpcEnabled
                      ? "AFX can use models reported by the local Pi RPC process."
                      : "Keep this off for SDK-only provider keys."
                  }
                  checked={rpcEnabled}
                  onCheckedChange={setRpcEnabled}
                />
                <div className="flex items-center gap-1.5 rounded-sm border bg-muted/30 px-2 py-1.5 text-[11px]">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      rpcStatus === "connected" ? "bg-afx-success" : "bg-muted-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {rpcStatus === "connected"
                      ? `${piAgent?.modelCount ?? 0} Pi models available`
                      : rpcEnabled
                        ? "Pi RPC enabled; detect or set the binary if it is missing."
                        : "Pi RPC is disabled."}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="min-w-0"
                    onClick={() => void detectPiBinary()}
                  >
                    Detect Pi
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="min-w-0"
                    onClick={() => openSetting("afx.agentBinaryPath")}
                  >
                    Binary path
                  </Button>
                </div>
              </RuntimeChoiceBlock>
            </div>

            <details className="group rounded-md border bg-card/25 px-2.5 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold text-foreground marker:hidden">
                <span>Advanced paths and defaults</span>
                <ChevronDown
                  size={13}
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="mt-2 flex flex-col gap-2.5">
                <RuntimePathBlock
                  icon={KeyRound}
                  title="API Provider SDK"
                  badge={snapshot?.sdk?.enabled === false ? "Off" : "Default"}
                  description="Uses the bundled Pi SDK bootstrap with provider keys stored by VS Code. No local Pi install is required."
                >
                  <ConfigField
                    label="SDK runtime"
                    value={snapshot?.sdk?.enabled === false ? "disabled" : "enabled"}
                    settingKey="afx.sdk.enabled"
                    hint="Turn this off only when you want AFX to ignore hosted API providers."
                  />
                  <ConfigField
                    label="Default model"
                    value={snapshot?.sdk?.defaultModel || "anthropic:claude-opus-4-5"}
                    settingKey="afx.sdk.defaultModel"
                    hint="Used when that provider is configured; otherwise AFX starts with the first ready provider."
                  />
                  <ConfigField
                    label="Ollama base URL"
                    value={snapshot?.sdk?.ollamaBaseUrl || "not configured"}
                    settingKey="afx.sdk.ollamaBaseUrl"
                    hint="Optional local OpenAI-compatible endpoint for the SDK provider path."
                  />
                </RuntimePathBlock>

                <RuntimePathBlock
                  icon={PlugZap}
                  title="Pi RPC"
                  badge={snapshot?.engine.rpcEnabled ? "Opted in" : "Off"}
                  description="Launches a local Pi CLI subprocess in --mode rpc. Keep it off unless you want your installed Pi runtime."
                >
                  <ConfigField
                    label="Pi RPC"
                    value={snapshot?.engine.rpcEnabled ? "enabled" : "disabled"}
                    settingKey="afx.rpc.enabled"
                    hint="Disabled by default. When enabled, chat can use models reported by the local Pi RPC process."
                  />
                  <ConfigField
                    label="Agent binary"
                    value={snapshot?.engine.agentBinary ?? "pi"}
                    settingKey="afx.agentBinaryPath"
                    hint="Command or absolute path used to spawn Pi when RPC is enabled."
                  />
                  <ConfigField
                    label="Ephemeral mode"
                    value={snapshot?.engine.ephemeral ? "on" : "off"}
                    settingKey="afx.agentEphemeralSession"
                    hint="Maps to Pi --no-session. Leave off to keep resumable sessions in the configured directory."
                  />
                </RuntimePathBlock>

                <RuntimePathBlock
                  icon={Folder}
                  title="Shared Session + Skills"
                  badge={`${snapshot?.engine.bundledSkillCount ?? 0} skills`}
                  description="Both runtime paths receive the bundled AFX skill pack and share the session directory unless ephemeral mode is on."
                >
                  <ConfigField
                    label="Session directory"
                    value={snapshot?.sdk?.sessionDir || "extension-managed storage"}
                    settingKey="afx.sessionDir"
                    hint="Used for saved Pi sessions by both the API Provider SDK path and Pi RPC path."
                  />
                  <ConfigField
                    label="Bundled skills"
                    value={`${snapshot?.engine.bundledSkillsPath ?? "resources/skills/agenticflowx"} (${snapshot?.engine.bundledSkillCount ?? 0} skills)`}
                    hint="Extension-managed AFX skills appended to the agent runtime at startup."
                  />
                </RuntimePathBlock>
              </div>
            </details>
          </div>
        </SettingsCard>

        {/* Surface: [ChatSettings.RuntimeControls] */}
        <SettingsCard
          icon={Cpu}
          title="Runtime"
          description="Live runtime controls — apply immediately to the active session."
        >
          <div className="flex flex-col gap-3">
            <SelectRow
              id="thinking-level"
              labelIcon={<Brain size={11} className="text-afx-brand-soft" />}
              label="Thinking level"
              description="Reasoning effort. Models without reasoning ignore this."
              value={runtime.thinkingLevel ?? ""}
              onChange={(v) => applyThinkingLevel(v as ThinkingLevel)}
              disabled={runtimeControlsDisabled}
              placeholderShown={!runtime.thinkingLevel}
              options={THINKING_LEVELS}
            />
            <SelectRow
              id="steering-mode"
              label="Steering mode"
              description="How the runtime handles messages you send while a turn is streaming."
              value={runtime.steeringMode ?? ""}
              onChange={(v) => applySteeringMode(v as QueueMode)}
              disabled={runtimeControlsDisabled}
              placeholderShown={!runtime.steeringMode}
              options={QUEUE_MODES}
            />
            <SelectRow
              id="followup-mode"
              label="Follow-up mode"
              description="How the runtime processes messages queued for after the current turn."
              value={runtime.followUpMode ?? ""}
              onChange={(v) => applyFollowUpMode(v as QueueMode)}
              disabled={runtimeControlsDisabled}
              placeholderShown={!runtime.followUpMode}
              options={QUEUE_MODES}
            />
            <SwitchRow
              id="auto-compaction"
              label="Auto-compaction"
              description="The runtime compacts message history when the context window fills."
              checked={runtime.autoCompactionEnabled ?? false}
              onCheckedChange={applyAutoCompaction}
              disabled={runtimeControlsDisabled}
            />
            <SwitchRow
              id="auto-retry"
              label="Auto-retry"
              description="The runtime retries on transient provider failures (rate limits, 5xx)."
              checked={runtime.autoRetryEnabled ?? false}
              onCheckedChange={applyAutoRetry}
              disabled={runtimeControlsDisabled}
            />
          </div>
        </SettingsCard>

        {/* Surface: [ChatSettings.Context] */}
        <SettingsCard
          id="context"
          icon={FileText}
          title="Context"
          description="Default context attachment for new chat turns."
        >
          <SwitchRow
            id="active-file-context"
            label="Include active file context"
            description="Attaches the active editor file to new turns. The composer toggle mirrors this default."
            checked={contextSettings.includeActiveFileContext}
            onCheckedChange={applyIncludeActiveFileContext}
            disabled={!snapshot}
          />
        </SettingsCard>

        {/* Surface: [ChatSettings.Appearance] */}
        <SettingsCard
          id="identity"
          icon={SwatchBook}
          title="Identity"
          description="Product accent layer. Ordinary surfaces still follow VS Code."
        >
          <SelectRow
            id="appearance-theme"
            label="Theme identity"
            description="AFX/Meridian supplies product accents over the editor theme."
            value={snapshot?.appearance.theme ?? "meridian"}
            onChange={(value) => applyTheme(value as AfxThemeId)}
            disabled={!snapshot?.appearance}
            options={
              snapshot?.appearance.themes.map((theme) => ({
                value: theme.id,
                label: `${theme.label}${theme.implemented ? "" : " — unavailable"}`,
              })) ?? [{ value: "meridian", label: "AFX / Meridian" }]
            }
          />
          <ConfigField label="VS Code setting" value="afx.theme" settingKey="afx.theme" />
        </SettingsCard>

        <SettingsCard
          id="style"
          icon={Brush}
          title="Style"
          description="Runtime treatment for radius, density, borders, and control feel."
        >
          <SelectRow
            id="appearance-style"
            label="Style treatment"
            description="Switches CSS runtime classes; shadcn components are not regenerated."
            value={snapshot?.appearance.style ?? "lyra"}
            onChange={(value) => applyStyle(value as AfxStyleId)}
            disabled={!snapshot?.appearance}
            options={
              snapshot?.appearance.styles.map((style) => ({
                value: style.id,
                label: `${style.label}${style.implemented ? "" : " — unavailable"}`,
              })) ?? [{ value: "lyra", label: "Lyra" }]
            }
          />
          <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Host colors stay authoritative for background, foreground, input, border, and focus.
          </p>
          <ConfigField label="VS Code setting" value="afx.style" settingKey="afx.style" />
        </SettingsCard>

        {/* Surface: [ChatSettings.Providers] */}
        <SettingsCard
          id="providers"
          icon={KeyRound}
          title="Providers"
          description="Configure hosted API providers and the opt-in local Pi RPC runtime side-by-side."
        >
          <Tabs
            value={providerTab}
            onValueChange={(value) => setProviderTab(value as "api" | "external")}
          >
            <TabsList className="w-full min-w-0">
              <TabsTrigger value="api" className="min-w-0 flex-1 px-1.5 text-[11px]">
                <KeyRound size={11} className="shrink-0" />
                <span className="truncate">API Providers</span>
              </TabsTrigger>
              <TabsTrigger value="external" className="min-w-0 flex-1 px-1.5 text-[11px]">
                <Server size={11} className="shrink-0" />
                <span className="truncate">External Agents</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="api" className="flex flex-col gap-2">
              <SettingsHint
                icon={KeyRound}
                title="API Provider SDK"
                description="Default path for OpenAI, Anthropic, Google, Cerebras, Groq, and Ollama. Provider cards are expanded so you can paste or replace keys directly."
              />
              {/* Surface: [ChatSettings.Providers.Api] */}
              <div className="rounded-md border bg-muted/20 p-2">
                <div className="grid grid-cols-3 gap-1">
                  <ProviderStat label="Providers" value={providerStats.total} />
                  <ProviderStat label="Ready" value={providerStats.ready} />
                  <ProviderStat label="Models" value={providerStats.models} />
                </div>
                <Input
                  value={providerSearch}
                  onChange={(event) => setProviderSearch(event.currentTarget.value)}
                  placeholder="Find provider or model…"
                  aria-label="Find provider or model"
                  className="mt-2 h-8 text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {PROVIDER_FILTERS.map((filter) => (
                    <ProviderFilterButton
                      key={filter.value}
                      label={filter.label}
                      count={
                        filter.value === "ready"
                          ? providerStats.ready
                          : filter.value === "needs-key"
                            ? providerStats.needsKey
                            : providerStats.total
                      }
                      active={providerFilter === filter.value}
                      onClick={() => setProviderFilter(filter.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
                {visibleProviders.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider.id}
                    displayName={provider.displayName ?? providerLabel(provider.id)}
                    modelHint={provider.modelHint ?? "Models available from this provider"}
                    state={provider.state}
                    configuredModelCount={provider.modelCount}
                    defaultModel={provider.defaultModel}
                    modelOptions={provider.models}
                    helpUrl={provider.helpUrl}
                    onSaveKey={(key) => saveProviderKey(provider.id, key)}
                    onClearKey={() => clearProviderKey(provider.id)}
                    onChangeDefault={(modelId) => setProviderDefaultModel(provider.id, modelId)}
                  />
                ))}
                {providers.length === 0 ? (
                  <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
                    Add a provider key to enable hosted models without installing a local agent.
                  </p>
                ) : null}
                {providers.length > 0 && visibleProviders.length === 0 ? (
                  <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
                    No providers match this search/filter.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-muted/30 px-2 py-2">
                <span className="text-[11px] text-muted-foreground">Prefer a local CLI?</span>
                <Button
                  type="button"
                  size="xs"
                  variant="link"
                  className="px-0"
                  onClick={() => setProviderTab("external")}
                >
                  View External Agents
                </Button>
              </div>
              <ConfigField
                label="Ollama base URL"
                value={snapshot?.sdk?.ollamaBaseUrl || "not configured"}
                settingKey="afx.sdk.ollamaBaseUrl"
                hint="Used only by the API Provider SDK path; Pi RPC reads its own local Pi configuration."
              />
            </TabsContent>
            <TabsContent value="external" className="flex flex-col gap-2">
              <SettingsHint
                icon={Server}
                title="Pi RPC and local agents"
                description="Pi RPC is off by default. Enable it when you want AFX to spawn a local Pi CLI process and use models reported over JSONL RPC."
              />
              {/* Surface: [ChatSettings.Providers.External] */}
              {(snapshot?.externalAgents ?? []).map((agent) => (
                <ExternalAgentCard
                  key={agent.id}
                  id={agent.id}
                  name={agent.name}
                  status={agent.status}
                  modelCount={agent.modelCount}
                  binaryPath={agent.binaryPath}
                  versionLabel={agent.versionLabel}
                  enabled={agent.enabled}
                  ephemeral={agent.ephemeral}
                  onDetectBinary={detectPiBinary}
                  onOpenBinarySetting={() => openSetting("afx.agentBinaryPath")}
                  onToggleEnabled={setRpcEnabled}
                  onToggleEphemeral={setEphemeralSession}
                />
              ))}
              <ExternalAgentCard
                id="future-agents"
                name="More local agents"
                status="coming-soon"
                modelCount={0}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-muted/30 px-2 py-2">
                <span className="text-[11px] text-muted-foreground">Need hosted models?</span>
                <Button
                  type="button"
                  size="xs"
                  variant="link"
                  className="px-0"
                  onClick={() => setProviderTab("api")}
                >
                  View API Providers
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SettingsCard>

        {/* Surface: [ChatSettings.ChatSkills] */}
        <SettingsCard icon={Info} title="Chat" description="Composer behavior.">
          <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Switching the model from the chat composer updates the runtime default for future runs.
          </p>
        </SettingsCard>

        <SettingsCard
          id="skills"
          icon={Settings2}
          title="Available Skills"
          description="Commands discovered through the agent runtime plus AFX chat actions."
          badge={`${skillCount}`}
        >
          <CommandGroup
            title="AFX skills"
            commands={groups.afx}
            disabled={runtimeControlsDisabled}
            onInsertCommand={onInsertCommand}
          />
          <CommandGroup
            title="Other skills"
            commands={groups.otherSkills}
            disabled={runtimeControlsDisabled}
            onInsertCommand={onInsertCommand}
          />
          <CommandGroup
            title="Extension commands"
            commands={groups.extension}
            disabled={runtimeControlsDisabled}
            onInsertCommand={onInsertCommand}
          />
          <CommandGroup
            title="Prompt templates"
            commands={groups.prompt}
            disabled={runtimeControlsDisabled}
            onInsertCommand={onInsertCommand}
          />
          <div className="flex flex-col gap-1">
            <GroupTitle label="Actions" count={ACTIONS.length} />
            {ACTIONS.map((action) => (
              <button
                key={action.name}
                type="button"
                onClick={() => bridgeSend({ type: action.message })}
                disabled={runtimeControlsDisabled}
                className="flex items-center justify-between gap-2 border-b border-border/50 px-0.5 py-1.5 text-left hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[11px]">{action.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {action.description}
                  </span>
                </span>
                <Badge variant="outline" className="shrink-0 text-[9px]">
                  action
                </Badge>
              </button>
            ))}
          </div>
        </SettingsCard>

        {/* Surface: [ChatSettings.Diagnostics] */}
        <SettingsCard
          id="diagnostics"
          icon={FileText}
          title="Diagnostics"
          description="Runtime recovery, logs, and session reset."
        >
          <div className="flex flex-col gap-2">
            <ConfigField
              label="Log level"
              value={snapshot?.diagnostics.logLevel ?? "info"}
              settingKey="afx.logLevel"
            />
            <div className="rounded-md border bg-muted/20 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <PlugZap size={13} className="mt-0.5 shrink-0 text-afx-brand-soft" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">
                    Runtime recovery controls
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    Always visible for debugging Pi RPC and API-provider startup state.
                  </p>
                </div>
              </div>
              <RuntimeRecoveryButtonGrid
                actions={recoveryActions}
                className="mt-2"
                onViewLogs={requestStderr}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="xs" variant="outline" onClick={requestStderr}>
              View buffered stderr
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={runtimeControlsDisabled}
              onClick={() => bridgeSend({ type: "chat/newSession" })}
            >
              New session
            </Button>
          </div>
          {showStderr && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Runtime stderr
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => void navigator.clipboard?.writeText(stderr)}
                >
                  Copy
                </Button>
              </div>
              <pre className="max-h-56 overflow-auto rounded-sm border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {stderr || "No stderr captured."}
              </pre>
            </div>
          )}
        </SettingsCard>

        {/* Surface: [ChatSettings.AboutTelemetry] */}
        <SettingsCard
          id="about"
          icon={Activity}
          title="About"
          description="Extension metadata, privacy, and product-level preferences."
        >
          <div className="flex flex-col gap-2">
            <SwitchRow
              id="telemetry-enabled"
              label="Anonymous UI analytics"
              description={
                telemetrySettings.vscodeTelemetryEnabled === false
                  ? "AFX preference is saved, but VS Code telemetry is off so Clarity stays disabled."
                  : "Anonymous Clarity analytics for Chat and Workbench."
              }
              checked={telemetrySettings.enabled}
              onCheckedChange={setTelemetryEnabled}
              disabled={!snapshot}
            />
            <ConfigField
              label="Analytics status"
              value={telemetrySettings.effectiveEnabled ? "enabled" : "disabled"}
              settingKey="afx.telemetry.enabled"
              hint={
                telemetrySettings.vscodeTelemetryEnabled === false
                  ? "VS Code telemetry is disabled, so AFX analytics stays off."
                  : "Respects this AFX toggle, VS Code telemetry, Do Not Track, and dashboard masking rules."
              }
            />
            <ConfigField label="Version" value={snapshot?.about.extensionVersion ?? "?"} />
            <ConfigField
              label="Bundled Pi npm"
              value={snapshot?.about.bundledPiNpmVersion ?? "?"}
              hint="The @mariozechner/pi-coding-agent package version bundled into the extension resources."
            />
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsSetupCard() {
  return (
    <SettingsCard
      icon={LoaderCircle}
      title="Checking agent runtime"
      description="Runtime controls will unlock after readiness is confirmed."
    >
      <div className="flex items-start gap-2 rounded-sm border border-afx-brand-soft/30 bg-afx-brand-soft/5 px-2 py-2 text-[11px] text-muted-foreground">
        <LoaderCircle size={13} className="mt-0.5 shrink-0 animate-spin text-afx-brand-soft" />
        <span>
          Loading settings, providers, and command metadata from the active agent connection.
        </span>
      </div>
    </SettingsCard>
  );
}

function RuntimeConfigurationNotice({
  apiProvidersEnabled,
  rpcEnabled,
  recoveryActions,
  onOpenApiProviders,
  onOpenExternalAgents,
  onViewLogs,
}: {
  apiProvidersEnabled: boolean;
  rpcEnabled: boolean;
  recoveryActions?: AgentRecoveryActions;
  onOpenApiProviders: () => void;
  onOpenExternalAgents: () => void;
  onViewLogs: () => void;
}) {
  const detail =
    !apiProvidersEnabled && !rpcEnabled
      ? "API Provider SDK and Pi RPC are both off."
      : rpcEnabled
        ? "Pi RPC is enabled, but the local Pi process has not reported usable models yet."
        : "API Provider SDK is enabled, but no provider key or Ollama endpoint is configured yet.";

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">No active runtime configured</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="xs" variant="outline" onClick={onOpenApiProviders}>
              <KeyRound size={12} />
              API Providers
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={onOpenExternalAgents}>
              <Server size={12} />
              External Agents
            </Button>
          </div>
          {rpcEnabled ? (
            <div className="mt-3 rounded-md border border-afx-brand-soft/25 bg-background/50 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <PlugZap size={13} className="mt-0.5 shrink-0 text-afx-brand-soft" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">
                    Pi RPC recovery controls
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    Visible while Pi RPC is enabled but no runtime is found.
                  </p>
                </div>
              </div>
              <RuntimeRecoveryButtonGrid
                actions={recoveryActions}
                className="mt-2"
                onViewLogs={onViewLogs}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RuntimeRecoveryButtonGrid({
  actions,
  className,
  onViewLogs,
}: {
  actions?: AgentRecoveryActions;
  className?: string;
  onViewLogs: () => void;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-1.5 @[280px]:flex @[280px]:flex-wrap", className)}>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="min-w-0 justify-start"
        disabled={!actions?.onRetryConnection}
        onClick={actions?.onRetryConnection}
      >
        <RefreshCw size={12} />
        <span className="truncate">Reconnect</span>
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="min-w-0 justify-start"
        disabled={!actions?.onRestartAgent}
        onClick={actions?.onRestartAgent}
      >
        <Zap size={12} />
        <span className="truncate">Restart</span>
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="min-w-0 justify-start"
        onClick={onViewLogs}
      >
        <FileText size={12} />
        <span className="truncate">View logs</span>
      </Button>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="min-w-0 justify-start"
        disabled={!actions?.onReloadHost}
        onClick={actions?.onReloadHost}
      >
        <RotateCcw size={12} />
        <span className="truncate">Reload</span>
      </Button>
    </div>
  );
}

function RuntimeChoiceBlock({
  icon: Icon,
  title,
  badge,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-afx-brand-soft/25 bg-afx-brand-soft/5 px-2.5 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-background/60">
          <Icon size={13} className="text-afx-brand-soft" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
              {title}
            </span>
            <Badge variant="secondary" className="shrink-0 text-[9px]">
              {badge}
            </Badge>
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function RuntimePathBlock({
  icon: Icon,
  title,
  badge,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card/35 px-2.5 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-muted/30">
          <Icon size={13} className="text-afx-brand-soft" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
              {title}
            </span>
            <Badge variant="outline" className="shrink-0 text-[9px]">
              {badge}
            </Badge>
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SettingsHint({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/20 px-2.5 py-2">
      <Icon size={13} className="mt-0.5 shrink-0 text-afx-brand-soft" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-FORM-ROWS] [DES-SETTINGS-SURFACE-MAP]
 */
function SettingsCard({
  id,
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <Card
      id={id ? `settings-${id}` : undefined}
      size="sm"
      className="scroll-mt-28 rounded-none border-x-0 border-t-0 bg-transparent py-0 shadow-none ring-0"
    >
      <CardHeader className="px-1 pb-2">
        <CardTitle className="flex items-start gap-2">
          <span className="afx-surface-card mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
            <Icon size={13} className="text-afx-brand-soft" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[13px]">{title}</span>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-1 pt-1 pb-4">{children}</CardContent>
    </Card>
  );
}

function ProviderStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-sm border bg-card/45 px-1 py-1.5">
      <span className="block truncate text-[8px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

function ProviderFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-sm border px-2 py-1 text-[10px] transition-colors",
        active
          ? "border-afx-brand/40 bg-afx-brand/10 text-afx-brand"
          : "border-border/70 bg-card/35 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {label} <span className="font-mono opacity-70">{count}</span>
    </button>
  );
}

/**
 * Read-only key/value row. Layout is narrow-friendly: label + optional icon-button
 * sit on the same row (label flex-1, button shrink-0), and the value wraps below.
 * Works at VSCode sidebar minimum width (170px) without overflow or stretched controls.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-FORM-ROWS]
 */
function ConfigField({
  label,
  value,
  settingKey,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
  settingKey?:
    | "afx.agentBinaryPath"
    | "afx.agentEphemeralSession"
    | "afx.rpc.enabled"
    | "afx.sessionDir"
    | "afx.sdk.enabled"
    | "afx.sdk.defaultModel"
    | "afx.sdk.ollamaBaseUrl"
    | "afx.debugPerf"
    | "afx.logLevel"
    | "afx.theme"
    | "afx.style"
    | "afx.telemetry.enabled";
}) {
  return (
    <div className="afx-field-surface rounded-md border px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Folder size={11} className="shrink-0 opacity-60" />
          <span className="truncate">{label}</span>
        </span>
        {settingKey ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="shrink-0"
            aria-label={`Open ${settingKey} setting`}
            onClick={() =>
              bridgeSend({ type: "chat/openSettings", requestId: uid(), key: settingKey })
            }
          >
            <ExternalLink size={11} />
          </Button>
        ) : null}
      </div>
      <p className="mt-1 break-all font-mono text-[10px] text-foreground">{value}</p>
      {hint ? (
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Toggle row — horizontal at all widths. Label/desc on the left (flex-1, min-w-0
 * to allow text wrap), Switch on the right (shrink-0). Designed for VSCode sidebar
 * minimum width (170px).
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-FORM-ROWS] [DES-SETTINGS-SURFACE-RUNTIME]
 */
function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="afx-field-surface flex items-start justify-between gap-3 rounded-md border px-2.5 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <Label htmlFor={id} className="text-[11px]">
          {label}
        </Label>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        size="sm"
        className="mt-0.5 shrink-0"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

/**
 * Select row — vertical at all widths so the dropdown gets full width for long
 * option labels. Designed for VSCode sidebar minimum width (170px).
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-FORM-ROWS] [DES-SETTINGS-SURFACE-RUNTIME]
 */
function SelectRow({
  id,
  label,
  labelIcon,
  description,
  value,
  onChange,
  disabled,
  placeholderShown,
  options,
}: {
  id: string;
  label: string;
  labelIcon?: ReactNode;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholderShown?: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="afx-field-surface flex flex-col gap-1.5 rounded-md border px-2.5 py-2">
      <div className="flex flex-col gap-0.5 leading-snug">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-[11px]">
          {labelIcon}
          {label}
        </Label>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <NativeSelect
        id={id}
        size="sm"
        className="w-full"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
        aria-label={label}
      >
        {placeholderShown && <NativeSelectOption value="">—</NativeSelectOption>}
        {options.map((opt) => (
          <NativeSelectOption key={opt.value} value={opt.value}>
            {opt.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-SKILLS]
 */
function CommandGroup({
  title,
  commands,
  disabled,
  onInsertCommand,
}: {
  title: string;
  commands: readonly AgentCommand[];
  disabled?: boolean;
  onInsertCommand?: (commandText: string) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <GroupTitle label={title} count={commands.length} />
      {commands.map((command) => {
        const display = displayCommandName(command);
        return (
          <button
            key={`${command.source}:${command.name}`}
            type="button"
            onClick={() => onInsertCommand?.(display)}
            disabled={disabled}
            className="flex items-center justify-between gap-2 border-b border-border/50 px-0.5 py-1.5 text-left hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 last:border-b-0"
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-[11px]">{display}</span>
              {command.description ? (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {command.description}
                </span>
              ) : null}
            </span>
            <Badge variant="outline" className="text-[9px]">
              {command.source}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

function GroupTitle({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      <span>{label}</span>
      <span>{count}</span>
    </div>
  );
}

function groupCommands(commands: readonly AgentCommand[]) {
  return {
    afx: commands.filter((cmd) => cmd.source === "skill" && cmd.name.startsWith("skill:afx-")),
    otherSkills: commands.filter(
      (cmd) => cmd.source === "skill" && !cmd.name.startsWith("skill:afx-"),
    ),
    extension: commands.filter((cmd) => cmd.source === "extension"),
    prompt: commands.filter((cmd) => cmd.source === "prompt"),
  };
}

function providerLabel(provider: string): string {
  return provider.replace(
    /(^|[-_\s])([a-z])/g,
    (_match, prefix: string, char: string) =>
      `${prefix === "-" || prefix === "_" ? " " : prefix}${char.toUpperCase()}`,
  );
}

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
