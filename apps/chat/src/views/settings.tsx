/**
 * Settings view — 5-group layout: Workspace, Runtimes, Models, Look, Support.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2] [FR-3] [FR-5] [FR-6] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-MAP] [DES-SETTINGS-FLOW] [DES-SETTINGS-INSTANCE-CARDS] [DES-SETTINGS-COPY]
 * @see docs/specs/100-package-shared/spec.md [FR-7] [FR-9]
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
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
  Plus,
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
import type { CustomProviderPreset, CustomProviderSummary } from "@afx/shared";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import { type AgentRecoveryActions, AgentRecoveryCard } from "../components/agent-recovery-card";
import { CustomModelCard } from "../components/custom-model-card";
import {
  CustomProviderForm,
  type CustomProviderFormSubmit,
} from "../components/custom-provider-form";
import { PresetPicker } from "../components/preset-picker";
import { ProviderCard } from "../components/provider-card";
import { displayCommandName } from "../components/slash-popup";
import { toast } from "../components/toast";
import { bridgeOn, bridgeSend } from "../lib/bridge";
import { HEADER, LOOK, MODELS, RUNTIMES, SUPPORT, WORKSPACE } from "../lib/settings-copy";
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
  { value: "minimal", label: RUNTIMES.thinkingMinimal.label },
  { value: "low", label: RUNTIMES.thinkingLow.label },
  { value: "medium", label: RUNTIMES.thinkingMedium.label },
  { value: "high", label: RUNTIMES.thinkingHigh.label },
  { value: "xhigh", label: RUNTIMES.thinkingXhigh.label },
];

const QUEUE_MODES: ReadonlyArray<{ value: QueueMode; label: string }> = [
  { value: "all", label: `${RUNTIMES.steeringAll.label} — ${RUNTIMES.steeringAll.description}` },
  { value: "one-at-a-time", label: RUNTIMES.steeringOne.label },
];

/** 5-group navigation — replaces the previous 9-section nav. */
const SETTINGS_SECTIONS = [
  { id: "workspace", label: "Workspace", shortLabel: "Work" },
  { id: "runtimes", label: "Runtimes", shortLabel: "Run" },
  { id: "models", label: "Models", shortLabel: "Mdl" },
  { id: "look", label: "Look", shortLabel: "Look" },
  { id: "support", label: "Support", shortLabel: "Help" },
] as const;

type SectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

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
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2] [NFR-3]
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
  const [activeSection, setActiveSection] = useState<SectionId>("workspace");
  const [modelsSubTab, setModelsSubTab] = useState<"builtin" | "custom">("builtin");
  const [customModelsTrack, setCustomModelsTrack] = useState<"sdk" | "rpc">("sdk");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [providerSearch, setProviderSearch] = useState("");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
  type CustomSdkMode =
    | { kind: "list" }
    | { kind: "preset" }
    | { kind: "edit"; providerId: string }
    | { kind: "create"; preset: CustomProviderPreset };
  const [customSdkMode, setCustomSdkMode] = useState<CustomSdkMode>({ kind: "list" });
  const [customSdkBusy, setCustomSdkBusy] = useState(false);
  const [customSdkError, setCustomSdkError] = useState<string | null>(null);

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
    ];
    bridgeSend({ type: "chat/getSettingsSnapshot", requestId: uid() });
    bridgeSend({ type: "chat/getCommands", requestId: uid() });
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

  // Sort: active/configured first, then needs-key
  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      const aReady = a.state === "configured" || a.state === "no-key-needed" ? 0 : 1;
      const bReady = b.state === "configured" || b.state === "no-key-needed" ? 0 : 1;
      return aReady - bReady;
    });
  }, [providers]);

  const visibleProviders = useMemo(() => {
    const search = providerSearch.trim().toLowerCase();
    return sortedProviders.filter((provider) => {
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
  }, [providerFilter, providerSearch, sortedProviders]);

  const sdkEnabled = snapshot?.sdk?.enabled !== false;
  const rpcEnabled = snapshot?.engine.rpcEnabled ?? agentStatus.rpcEnabled === true;
  const piAgent = snapshot?.externalAgents?.find((agent) => agent.id === "pi");
  const rpcStatus = piAgent?.status ?? (rpcEnabled ? "unavailable" : "disabled");

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
  function jumpToSection(id: SectionId) {
    setActiveSection(id);
    document
      .getElementById(`settings-${id}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
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

  // ─── Custom Models · Pi SDK track ─────────────────────────────────────────
  // @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10]
  // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]

  function submitCustomProviderUpsert(submission: CustomProviderFormSubmit): Promise<void> {
    setCustomSdkBusy(true);
    setCustomSdkError(null);
    return new Promise<void>((resolve) => {
      const requestId = trackProviderMutation(`Custom provider ${submission.id} saved`);
      const off = bridgeOn("customModels/result", (msg) => {
        if (msg.requestId !== requestId) return;
        off();
        setCustomSdkBusy(false);
        if (msg.ok) {
          setCustomSdkMode({ kind: "list" });
          resolve();
        } else {
          setCustomSdkError(msg.error ?? "Failed to save custom provider");
          resolve();
        }
      });
      bridgeSend({
        type: "customModels/upsertProvider",
        requestId,
        provider: {
          id: submission.id,
          ...(submission.displayName ? { displayName: submission.displayName } : {}),
          baseUrl: submission.baseUrl,
          api: submission.api,
          apiKeyRef: submission.apiKeyRef,
          ...(submission.apiKeyValue ? { apiKeyValue: submission.apiKeyValue } : {}),
          ...(submission.authHeader !== undefined ? { authHeader: submission.authHeader } : {}),
          models: submission.models,
          ...(submission.compat && Object.keys(submission.compat).length > 0
            ? { compat: submission.compat }
            : {}),
        },
      });
    });
  }

  /**
   * Tracks which provider id is awaiting an inline "Are you sure?" confirmation.
   * `window.confirm` is unreliable in VSCode webviews (some contexts return
   * undefined, blocking the delete entirely), so the card surfaces a two-step
   * inline confirm instead — first click arms the action, second click executes.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
   */
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const removeConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const removeCustomProvider = useCallback(
    (providerId: string): void => {
      if (removeConfirmTimerRef.current) {
        clearTimeout(removeConfirmTimerRef.current);
        removeConfirmTimerRef.current = null;
      }
      if (pendingRemoveId === providerId) {
        // Second click within the arm window — actually delete.
        setPendingRemoveId(null);
        setCustomSdkError(null);
        const requestId = trackProviderMutation(`Custom provider ${providerId} removed`);
        const off = bridgeOn("customModels/result", (msg) => {
          if (msg.requestId !== requestId) return;
          off();
          if (!msg.ok) setCustomSdkError(msg.error ?? "Failed to remove custom provider");
        });
        bridgeSend({ type: "customModels/removeProvider", requestId, providerId });
        return;
      }
      // First click — arm the confirm; auto-disarm after 4s so users can't accidentally
      // delete by double-tapping much later.
      setPendingRemoveId(providerId);
      removeConfirmTimerRef.current = setTimeout(() => setPendingRemoveId(null), 4_000);
    },
    [pendingRemoveId],
  );

  function renderCustomSdkList(): JSX.Element {
    const providers: readonly CustomProviderSummary[] =
      snapshot?.customModels?.piSdk.providers ?? [];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <Button
            type="button"
            size="xs"
            variant="default"
            onClick={() => setCustomSdkMode({ kind: "preset" })}
            disabled={customSdkBusy}
          >
            <Plus size={11} />
            {MODELS.customSdkAddLabel}
          </Button>
        </div>
        {providers.length === 0 ? (
          <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
            {MODELS.customSdkEmpty}
          </p>
        ) : (
          <div className="grid gap-2 @[380px]:grid-cols-2">
            {providers.map((summary) => (
              <CustomModelCard
                key={summary.id}
                summary={summary}
                onEdit={() => setCustomSdkMode({ kind: "edit", providerId: summary.id })}
                onRemove={() => removeCustomProvider(summary.id)}
                removeArmed={pendingRemoveId === summary.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderCustomSdkEdit(providerId: string): JSX.Element {
    const summary = snapshot?.customModels?.piSdk.providers.find((p) => p.id === providerId);
    if (!summary) {
      return (
        <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
          Provider not found. It may have been removed.
        </p>
      );
    }
    return (
      <CustomProviderForm
        initial={{
          id: summary.id,
          ...(summary.displayName ? { displayName: summary.displayName } : {}),
          baseUrl: summary.baseUrl,
          api: summary.api,
          apiKeySource: summary.apiKeySource,
          ...(summary.apiKeyLabel ? { apiKeyLabel: summary.apiKeyLabel } : {}),
          ...(summary.authHeader !== undefined ? { authHeader: summary.authHeader } : {}),
          ...(summary.compatFlags ? { compatFlags: summary.compatFlags } : {}),
          // Models[] is hydrated from the redacted summary — id/name/contextWindow
          // only. Cost/headers/per-model compat are not echoed via the snapshot
          // (per NFR-1). The user can re-enter them on edit if they need to.
          // @see docs/specs/214-app-chat-settings/spec.md [NFR-1]
          models: summary.models.map((m) => {
            const entry: {
              id: string;
              name: string;
              api?: typeof m.api;
              contextWindow?: number;
              maxTokens?: number;
              capabilities?: typeof m.capabilities;
            } = {
              id: m.id,
              name: m.name,
            };
            if (m.api) entry.api = m.api;
            if (m.contextWindow !== undefined) entry.contextWindow = m.contextWindow;
            if (m.maxTokens !== undefined) entry.maxTokens = m.maxTokens;
            if (m.capabilities) entry.capabilities = { ...m.capabilities };
            return entry;
          }),
        }}
        onSubmit={(submission) => submitCustomProviderUpsert(submission)}
        onCancel={() => setCustomSdkMode({ kind: "list" })}
      />
    );
  }
  function detectPiBinary(): void {
    bridgeSend({
      type: "external/detectPiBinary",
      requestId: trackProviderMutation("Pi CLI detection complete"),
    });
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
  function openOutputLogs(): void {
    bridgeSend({ type: "chat/showLogs", requestId: uid() });
  }
  function openModelsJson(): void {
    bridgeSend({ type: "chat/openModelsJson", requestId: uid() });
  }

  const fileCtxOn = contextSettings.includeActiveFileContext;
  const sdkReady = sdkEnabled && providerStats.ready > 0;
  const rpcConnected = rpcStatus === "connected";

  return (
    <TooltipProvider>
      <div className="afx-surface-subtle @container h-full overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        <div className="flex min-w-0 flex-col gap-3 px-2 py-3">
          {/* Surface: [ChatSettings.Header] — sticky header strip */}
          <div className="sticky top-0 z-20 -mx-2 -mt-3 border-b bg-background/95 px-2 py-3 backdrop-blur">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                  <span className="afx-surface-card flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-afx-brand-soft">
                    <Settings2 size={15} />
                  </span>
                  {HEADER.title}
                </h2>
                <p className="mt-1 text-[11px] text-muted-foreground">{HEADER.subtitle}</p>
              </div>
            </div>

            {/* Instance status strip */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-muted/20 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  on={sdkReady}
                  label={HEADER.sdkPillLabel}
                  tooltip={sdkReady ? HEADER.sdkPillOnTooltip : HEADER.sdkPillOffTooltip}
                  onClick={() => jumpToSection("runtimes")}
                />
                {rpcEnabled && (
                  <StatusPill
                    on={rpcConnected}
                    label={HEADER.rpcPillLabel}
                    tooltip={rpcConnected ? HEADER.rpcPillOnTooltip : HEADER.rpcPillOffTooltip}
                    onClick={() => jumpToSection("runtimes")}
                  />
                )}
                {!sdkReady && !rpcEnabled && (
                  <StatusPill
                    on={false}
                    label={HEADER.notConfiguredLabel}
                    tooltip={HEADER.notConfiguredTooltip}
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  title={HEADER.restartActiveTooltip}
                  disabled={!recoveryActions?.onRestartAgent}
                  onClick={recoveryActions?.onRestartAgent}
                  aria-label={HEADER.restartActiveTooltip}
                >
                  <Zap size={11} />
                  <span className="truncate">{HEADER.restartActiveLabel}</span>
                </Button>
                <button
                  type="button"
                  title={fileCtxOn ? HEADER.fileCtxOnTooltip : HEADER.fileCtxOffTooltip}
                  aria-label={fileCtxOn ? HEADER.fileCtxOnTooltip : HEADER.fileCtxOffTooltip}
                  aria-pressed={fileCtxOn}
                  onClick={() => applyIncludeActiveFileContext(!fileCtxOn)}
                  className={cn(
                    "flex items-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] transition-colors",
                    fileCtxOn
                      ? "border-afx-brand/40 bg-afx-brand/10 text-afx-brand"
                      : "border-border/70 bg-card/35 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <FileText size={11} />
                  <span>{HEADER.fileCtxLabel}</span>
                  {fileCtxOn && <span className="text-afx-brand">✓</span>}
                </button>
              </div>
            </div>

            {/* 5-group nav */}
            <div className="grid grid-cols-5 gap-1">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  aria-label={section.label}
                  className={cn(
                    "h-6 min-w-0 shrink-0 rounded-sm border border-transparent px-1 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground",
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
              onOpenApiProviders={() => {
                setModelsSubTab("builtin");
                jumpToSection("models");
              }}
              onOpenExternalAgents={() => jumpToSection("runtimes")}
            />
          ) : null}
          {runtimeUnavailable ? (
            <AgentRecoveryCard status={agentStatus} actions={recoveryActions} />
          ) : null}

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Surface: [ChatSettings.Workspace]                                 */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <SettingsCard
            id="workspace"
            icon={SlidersHorizontal}
            title={WORKSPACE.groupTitle}
            description={WORKSPACE.groupDescription}
          >
            {/* Mode */}
            <div className="flex flex-col gap-1.5">
              <div>
                <p className="text-[11px] font-semibold text-foreground">{WORKSPACE.modeLabel}</p>
                <p className="text-[10px] text-muted-foreground">{WORKSPACE.modeDescription}</p>
              </div>
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
                      (event.target as HTMLElement | null)?.closest(
                        '[data-slot="radio-group-item"]',
                      )
                    ) {
                      return;
                    }
                    applyMode("code");
                  }}
                >
                  <RadioGroupItem value="code" className="mt-0.5" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground">
                        {WORKSPACE.codeName}
                      </span>
                      <InfoTooltip content={WORKSPACE.codeTooltip} />
                    </div>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">
                      {WORKSPACE.codeDescription}
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
                      (event.target as HTMLElement | null)?.closest(
                        '[data-slot="radio-group-item"]',
                      )
                    ) {
                      return;
                    }
                    applyMode("explore");
                  }}
                >
                  <RadioGroupItem value="explore" className="mt-0.5" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground">
                        {WORKSPACE.exploreName}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[9px] uppercase tracking-wide"
                      >
                        Experimental
                      </Badge>
                      <InfoTooltip content={WORKSPACE.exploreTooltip} />
                    </div>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">
                      {WORKSPACE.exploreDescription}
                    </span>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-sm border bg-muted/20 px-2 py-2 transition-colors hover:bg-muted/40",
                    activeMode === "spec" && "border-violet-500/40 bg-violet-500/5",
                  )}
                  onClick={(event) => {
                    if (
                      (event.target as HTMLElement | null)?.closest(
                        '[data-slot="radio-group-item"]',
                      )
                    ) {
                      return;
                    }
                    applyMode("spec");
                  }}
                >
                  <RadioGroupItem value="spec" className="mt-0.5" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground">
                        {WORKSPACE.specName}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[9px] uppercase tracking-wide"
                      >
                        New
                      </Badge>
                      <InfoTooltip content={WORKSPACE.specTooltip} />
                    </div>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">
                      {WORKSPACE.specDescription}
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Active-file context — workspace default, mirrored in header chip */}
            <SwitchRow
              id="active-file-context"
              label={WORKSPACE.fileCtxLabel}
              description={WORKSPACE.fileCtxDescription}
              tooltip={WORKSPACE.fileCtxTooltip}
              checked={fileCtxOn}
              onCheckedChange={applyIncludeActiveFileContext}
            />
          </SettingsCard>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Surface: [ChatSettings.Runtimes]                                  */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <SettingsCard
            id="runtimes"
            icon={PlugZap}
            title={RUNTIMES.groupTitle}
            description={RUNTIMES.groupDescription}
          >
            <div className="flex flex-col gap-2">
              {/* SDK instance card — always rendered */}
              <InstanceCard
                title={RUNTIMES.sdkCardTitle}
                description={RUNTIMES.sdkCardDescription}
                tooltip={RUNTIMES.sdkCardTooltip}
                status={sdkReady ? "ready" : "off"}
                statusLabel={
                  sdkReady
                    ? `${providerStats.ready} key${providerStats.ready === 1 ? "" : "s"} · ${providerStats.models} models`
                    : providerStats.total > 0
                      ? "Keys needed"
                      : "No keys configured"
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    title={RUNTIMES.sdkRestartTooltip}
                    disabled={!recoveryActions?.onRestartAgent}
                    onClick={recoveryActions?.onRestartAgent}
                  >
                    <Zap size={11} />
                    Restart
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {RUNTIMES.sdkManageNote}{" "}
                  <button
                    type="button"
                    className="text-afx-brand hover:underline"
                    onClick={() => jumpToSection("models")}
                  >
                    Models tab →
                  </button>
                </p>
                <TroubleshootDisclosure actions={recoveryActions} />
              </InstanceCard>

              {/* RPC instance card — always rendered so toggle is discoverable */}
              <InstanceCard
                title={RUNTIMES.rpcCardTitle}
                description={RUNTIMES.rpcCardDescription}
                tooltip=""
                status={
                  rpcEnabled
                    ? rpcStatus === "connected"
                      ? "ready"
                      : rpcStatus === "unavailable"
                        ? "warn"
                        : "off"
                    : "off"
                }
                statusLabel={
                  rpcEnabled
                    ? rpcStatus === "connected"
                      ? `Connected · ${piAgent?.modelCount ?? 0} models`
                      : "Enabled · not connected"
                    : "Off"
                }
              >
                <SwitchRow
                  id="rpc-enable"
                  label={RUNTIMES.rpcEnableLabel}
                  description={RUNTIMES.rpcEnableDescription}
                  tooltip={RUNTIMES.rpcEnableTooltip}
                  checked={rpcEnabled}
                  onCheckedChange={setRpcEnabled}
                />
                {rpcEnabled && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        title={RUNTIMES.rpcRestartTooltip}
                        disabled={!recoveryActions?.onRestartAgent}
                        onClick={recoveryActions?.onRestartAgent}
                      >
                        <Zap size={11} />
                        Restart
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        title={RUNTIMES.rpcReconnectTooltip}
                        disabled={!recoveryActions?.onRetryConnection}
                        onClick={recoveryActions?.onRetryConnection}
                      >
                        <RefreshCw size={11} />
                        Reconnect
                      </Button>
                    </div>

                    {/* Session controls */}
                    <SwitchRow
                      id="ephemeral-session"
                      label={RUNTIMES.rpcEphemeralLabel}
                      description={RUNTIMES.rpcEphemeralDescription}
                      tooltip={RUNTIMES.rpcEphemeralTooltip}
                      checked={snapshot?.engine.ephemeral ?? false}
                      onCheckedChange={setEphemeralSession}
                    />
                    {/* Advanced paths */}
                    <details className="group rounded-md border bg-card/25 px-2.5 py-2">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold text-foreground marker:hidden">
                        <span>Advanced paths</span>
                        <ChevronDown
                          size={13}
                          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex items-end gap-1.5">
                          <div className="min-w-0 flex-1">
                            <ConfigField
                              label="Pi binary path"
                              value={snapshot?.engine.agentBinary ?? "pi"}
                              settingKey="afx.agentBinaryPath"
                              hint="Command or absolute path used to spawn Pi when RPC is enabled."
                            />
                          </div>
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="mb-[1px] shrink-0"
                            onClick={detectPiBinary}
                          >
                            Detect
                          </Button>
                        </div>
                        <ConfigField
                          label="Session directory"
                          value={snapshot?.sdk?.sessionDir || "extension-managed storage"}
                          settingKey="afx.sessionDir"
                          hint="Where Pi writes session JSONL. Default: ~/.pi/sessions/"
                        />
                        <ConfigField
                          label="Bundled Pi npm"
                          value={snapshot?.about.bundledPiNpmVersion ?? "?"}
                          hint="Pi version compiled into AFX. Read-only — update AFX to change."
                        />
                      </div>
                    </details>

                    <TroubleshootDisclosure actions={recoveryActions} />
                  </>
                )}
              </InstanceCard>
            </div>

            {/* Behaviour card — scoped to active instance */}
            <div className="mt-2 flex flex-col gap-2 rounded-md border bg-muted/10 px-2.5 py-2.5">
              <div className="flex items-start gap-2">
                <Cpu size={13} className="mt-0.5 shrink-0 text-afx-brand-soft" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-semibold text-foreground">
                      {RUNTIMES.behaviourCardTitle}
                    </p>
                    <InfoTooltip content={RUNTIMES.behaviourCardTooltip} />
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {RUNTIMES.behaviourCardDescription}
                  </p>
                </div>
              </div>
              <div className="rounded-sm border border-afx-brand-soft/20 bg-afx-brand-soft/5 px-2 py-1.5 text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {RUNTIMES.behaviourScopePrefix}
                </span>{" "}
                {rpcEnabled && rpcConnected
                  ? `${RUNTIMES.rpcCardTitle} · ${piAgent?.name ?? "Pi RPC"}`
                  : sdkEnabled
                    ? `${RUNTIMES.sdkCardTitle}`
                    : "Not configured"}
                <p className="mt-0.5">{RUNTIMES.behaviourScopeNote}</p>
              </div>

              <div className="flex flex-col gap-3">
                <SelectRow
                  id="thinking-level"
                  labelIcon={<Brain size={11} className="text-afx-brand-soft" />}
                  label={RUNTIMES.thinkingLabel}
                  sublabel={RUNTIMES.thinkingSublabel}
                  description={RUNTIMES.thinkingDescription}
                  tooltip={RUNTIMES.thinkingTooltip}
                  value={runtime.thinkingLevel ?? ""}
                  onChange={(v) => applyThinkingLevel(v as ThinkingLevel)}
                  disabled={runtimeControlsDisabled}
                  placeholderShown={!runtime.thinkingLevel}
                  options={THINKING_LEVELS}
                />
                <SelectRow
                  id="steering-mode"
                  label={RUNTIMES.steeringLabel}
                  sublabel={RUNTIMES.steeringSublabel}
                  description={RUNTIMES.steeringDescription}
                  tooltip={RUNTIMES.steeringTooltip}
                  value={runtime.steeringMode ?? ""}
                  onChange={(v) => applySteeringMode(v as QueueMode)}
                  disabled={runtimeControlsDisabled}
                  placeholderShown={!runtime.steeringMode}
                  options={QUEUE_MODES}
                />
                <SelectRow
                  id="followup-mode"
                  label={RUNTIMES.followUpLabel}
                  sublabel={RUNTIMES.followUpSublabel}
                  description={RUNTIMES.followUpDescription}
                  tooltip={RUNTIMES.followUpTooltip}
                  value={runtime.followUpMode ?? ""}
                  onChange={(v) => applyFollowUpMode(v as QueueMode)}
                  disabled={runtimeControlsDisabled}
                  placeholderShown={!runtime.followUpMode}
                  options={QUEUE_MODES}
                />
                <SwitchRow
                  id="auto-compaction"
                  label={RUNTIMES.compactionLabel}
                  sublabel={RUNTIMES.compactionSublabel}
                  description={RUNTIMES.compactionDescription}
                  tooltip={RUNTIMES.compactionTooltip}
                  checked={runtime.autoCompactionEnabled ?? false}
                  onCheckedChange={applyAutoCompaction}
                  disabled={runtimeControlsDisabled}
                />
                <SwitchRow
                  id="auto-retry"
                  label={RUNTIMES.retryLabel}
                  sublabel={RUNTIMES.retrySublabel}
                  description={RUNTIMES.retryDescription}
                  tooltip={RUNTIMES.retryTooltip}
                  checked={runtime.autoRetryEnabled ?? false}
                  onCheckedChange={applyAutoRetry}
                  disabled={runtimeControlsDisabled}
                />
              </div>
            </div>
          </SettingsCard>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Surface: [ChatSettings.Models]                                     */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <SettingsCard
            id="models"
            icon={KeyRound}
            title={MODELS.groupTitle}
            description={MODELS.groupDescription}
          >
            <Tabs
              value={modelsSubTab}
              onValueChange={(v) => setModelsSubTab(v as "builtin" | "custom")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="builtin">
                  <KeyRound />
                  <span className="truncate">{MODELS.builtinTabLabel}</span>
                </TabsTrigger>
                <TabsTrigger value="custom">
                  <Server />
                  <span className="truncate">{MODELS.customTabLabel}</span>
                </TabsTrigger>
              </TabsList>

              {/* Surface: [ChatSettings.Models.Builtin] */}
              <TabsContent value="builtin" className="flex flex-col gap-2">
                <div className="rounded-md border bg-muted/20 p-2">
                  <div className="grid grid-cols-3 gap-1">
                    <ProviderStat label="Providers" value={providerStats.total} />
                    <ProviderStat label="Ready" value={providerStats.ready} />
                    <ProviderStat label="Models" value={providerStats.models} />
                  </div>
                  <Input
                    value={providerSearch}
                    onChange={(event) => setProviderSearch(event.currentTarget.value)}
                    placeholder={MODELS.searchPlaceholder}
                    aria-label={MODELS.searchLabel}
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
                {/* Provider tile grid — single-active accordion, no 52vh cap */}
                <div className="grid gap-2 @[380px]:grid-cols-2">
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
                      compact={expandedProvider !== provider.id}
                      onExpand={() =>
                        setExpandedProvider(expandedProvider === provider.id ? null : provider.id)
                      }
                      onSaveKey={(key) => saveProviderKey(provider.id, key)}
                      onClearKey={() => clearProviderKey(provider.id)}
                      onChangeDefault={(modelId) => setProviderDefaultModel(provider.id, modelId)}
                    />
                  ))}
                  {providers.length === 0 ? (
                    <p className="col-span-2 rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
                      Add a provider key to enable hosted models without installing a local agent.
                    </p>
                  ) : null}
                  {providers.length > 0 && visibleProviders.length === 0 ? (
                    <p className="col-span-2 rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
                      No providers match this search/filter.
                    </p>
                  ) : null}
                </div>
                <ConfigField
                  label="Ollama base URL"
                  value={snapshot?.sdk?.ollamaBaseUrl || "not configured"}
                  settingKey="afx.sdk.ollamaBaseUrl"
                  hint="Used only by the API Provider SDK path; Pi RPC reads its own local Pi configuration."
                />
              </TabsContent>

              {/* Surface: [ChatSettings.Models.Custom] */}
              <TabsContent value="custom" className="flex flex-col gap-2">
                <div className="rounded-md border bg-muted/20 px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-foreground">{MODELS.customTitle}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {MODELS.customDescription}
                  </p>
                </div>
                {/* Track selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Track:</span>
                  <div className="flex gap-1">
                    {(["sdk", "rpc"] as const).map((track) => (
                      <button
                        key={track}
                        type="button"
                        aria-pressed={customModelsTrack === track}
                        onClick={() => setCustomModelsTrack(track)}
                        className={cn(
                          "rounded-sm border px-2 py-1 text-[10px] transition-colors",
                          customModelsTrack === track
                            ? "border-afx-brand/40 bg-afx-brand/10 text-afx-brand"
                            : "border-border/70 bg-card/35 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {track === "sdk" ? MODELS.customSdkTrackLabel : MODELS.customRpcTrackLabel}
                      </button>
                    ))}
                  </div>
                  <InfoTooltip content={MODELS.customTrackTooltip} />
                </div>

                {customModelsTrack === "sdk" && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
                      <p className="text-[11px] font-semibold text-foreground">
                        {MODELS.customSdkTitle}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                        {MODELS.customSdkDescription}
                      </p>
                    </div>

                    {customSdkMode.kind === "list" && renderCustomSdkList()}
                    {customSdkMode.kind === "preset" && (
                      <PresetPicker
                        onSelect={(preset) => setCustomSdkMode({ kind: "create", preset })}
                        onCancel={() => setCustomSdkMode({ kind: "list" })}
                      />
                    )}
                    {customSdkMode.kind === "create" && (
                      <CustomProviderForm
                        preset={customSdkMode.preset}
                        onSubmit={(submission) => submitCustomProviderUpsert(submission)}
                        onCancel={() => setCustomSdkMode({ kind: "list" })}
                      />
                    )}
                    {customSdkMode.kind === "edit" && renderCustomSdkEdit(customSdkMode.providerId)}

                    {customSdkError ? (
                      <p
                        role="alert"
                        className="rounded-sm border border-destructive/40 bg-destructive/5 px-2 py-1 text-[10px] text-destructive"
                      >
                        {customSdkError}
                      </p>
                    ) : null}
                  </div>
                )}

                {customModelsTrack === "rpc" && (
                  <div className="rounded-md border bg-muted/20 px-2.5 py-2.5">
                    <p className="text-[11px] font-semibold text-foreground">
                      {MODELS.customRpcTitle}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {MODELS.customRpcDescription}
                    </p>
                    {!rpcEnabled && (
                      <p className="mt-1 rounded-sm border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-600">
                        {MODELS.customRpcRpcOff}
                      </p>
                    )}
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        title={MODELS.customRpcOpenTooltip}
                        onClick={openModelsJson}
                      >
                        <ExternalLink size={11} />
                        {MODELS.customRpcOpenLabel}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </SettingsCard>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Surface: [ChatSettings.Look]                                       */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <SettingsCard
            id="look"
            icon={SwatchBook}
            title={LOOK.groupTitle}
            description={LOOK.groupDescription}
          >
            <SelectRow
              id="appearance-theme"
              labelIcon={<SwatchBook size={11} className="text-afx-brand-soft" />}
              label={LOOK.themeLabel}
              description={LOOK.themeDescription}
              tooltip={LOOK.themeTooltip}
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
            <SelectRow
              id="appearance-style"
              labelIcon={<Brush size={11} className="text-afx-brand-soft" />}
              label={LOOK.styleLabel}
              description={LOOK.styleDescription}
              tooltip={LOOK.styleTooltip}
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
              {LOOK.settingNote}
            </p>
            <div className="flex gap-2">
              <ConfigField label="Theme setting" value="afx.theme" settingKey="afx.theme" />
              <ConfigField label="Style setting" value="afx.style" settingKey="afx.style" />
            </div>
          </SettingsCard>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* Surface: [ChatSettings.Support]                                    */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <SettingsCard
            id="support"
            icon={Info}
            title={SUPPORT.groupTitle}
            description={SUPPORT.groupDescription}
            badge={`${skillCount}`}
          >
            {/* Skills & commands */}
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-foreground">{SUPPORT.skillsTitle}</p>
              <p className="text-[10px] text-muted-foreground">{SUPPORT.skillsDescription}</p>
            </div>
            <CommandGroup
              title={SUPPORT.afxSkillsLabel}
              titleTooltip={SUPPORT.afxSkillsTooltip}
              commands={groups.afx}
              disabled={runtimeControlsDisabled}
              onInsertCommand={onInsertCommand}
            />
            <CommandGroup
              title="Pi skills"
              titleTooltip={SUPPORT.piSkillsTooltip}
              commands={groups.otherSkills}
              disabled={runtimeControlsDisabled}
              onInsertCommand={onInsertCommand}
            />
            <CommandGroup
              title={SUPPORT.extensionCommandsLabel}
              titleTooltip={SUPPORT.extensionCommandsTooltip}
              commands={groups.extension}
              disabled={runtimeControlsDisabled}
              onInsertCommand={onInsertCommand}
            />
            <CommandGroup
              title={SUPPORT.promptTemplatesLabel}
              titleTooltip={SUPPORT.promptTemplatesTooltip}
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
                  title={action.name === "/new" ? SUPPORT.newSessionTooltip : SUPPORT.abortTooltip}
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

            {/* Diagnostics */}
            <div className="mt-2 flex flex-col gap-2 border-t pt-2">
              <p className="text-[11px] font-semibold text-foreground">
                {SUPPORT.diagnosticsTitle}
              </p>
              <p className="text-[10px] text-muted-foreground">{SUPPORT.diagnosticsDescription}</p>
              <ConfigField
                label={SUPPORT.logLevelLabel}
                value={snapshot?.diagnostics.logLevel ?? "info"}
                settingKey="afx.logLevel"
                hint={SUPPORT.logLevelTooltip}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  title={SUPPORT.outputLogTooltip}
                  onClick={openOutputLogs}
                >
                  <FileText size={12} />
                  {SUPPORT.outputLogLabel}
                </Button>
              </div>
            </div>

            {/* Privacy */}
            <div className="mt-2 flex flex-col gap-2 border-t pt-2">
              <p className="text-[11px] font-semibold text-foreground">{SUPPORT.privacyTitle}</p>
              <SwitchRow
                id="telemetry-enabled"
                label={SUPPORT.telemetryLabel}
                description={
                  telemetrySettings.vscodeTelemetryEnabled === false
                    ? SUPPORT.telemetryDisabledByVscodeDescription
                    : SUPPORT.telemetryDescription
                }
                tooltip={SUPPORT.telemetryTooltip}
                checked={telemetrySettings.enabled}
                onCheckedChange={setTelemetryEnabled}
                disabled={!snapshot}
              />
              <ConfigField
                label={SUPPORT.telemetryStatusLabel}
                value={telemetrySettings.effectiveEnabled ? "enabled" : "disabled"}
                settingKey="afx.telemetry.enabled"
                hint={
                  telemetrySettings.vscodeTelemetryEnabled === false
                    ? SUPPORT.telemetryStatusDisabledByVscodeHint
                    : SUPPORT.telemetryStatusHint
                }
              />
            </div>

            {/* About */}
            <div className="mt-2 flex flex-col gap-2 border-t pt-2">
              <p className="text-[11px] font-semibold text-foreground">{SUPPORT.aboutTitle}</p>
              <ConfigField label="Version" value={snapshot?.about.extensionVersion ?? "?"} />
              <ConfigField
                label="Bundled Pi npm"
                value={snapshot?.about.bundledPiNpmVersion ?? "?"}
                hint="The Pi coding-agent package version bundled into the extension resources."
              />
              <p
                className="text-[10px] leading-relaxed text-muted-foreground"
                title={SUPPORT.piTelemetryTooltip}
              >
                {SUPPORT.piTelemetryNote}
              </p>
              <a
                href="https://github.com/AgenticFlowX/agenticflowx/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-afx-brand hover:underline"
              >
                <ExternalLink size={11} />
                {SUPPORT.reportIssueLabel}
              </a>
            </div>
          </SettingsCard>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Info tooltip ────────────────────────────────────────────────────────────

function InfoTooltip({
  content,
  side = "top",
}: {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={content}
          className="inline-flex shrink-0 items-center justify-center text-muted-foreground/70 hover:text-muted-foreground focus-visible:outline-none"
        >
          <Info size={11} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[220px] text-[11px] leading-snug">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({
  on,
  label,
  tooltip,
  onClick,
}: {
  on: boolean;
  label: string;
  tooltip: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] transition-colors",
        on
          ? "border-afx-success/40 bg-afx-success/10 text-afx-success"
          : "border-border/70 bg-card/35 text-muted-foreground",
        onClick && "cursor-pointer hover:bg-muted/50",
        !onClick && "cursor-default",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-afx-success" : "bg-muted-foreground")}
      />
      {label}
    </button>
  );
}

// ─── Instance card ────────────────────────────────────────────────────────────

function InstanceCard({
  title,
  description,
  tooltip,
  status,
  statusLabel,
  children,
}: {
  title: string;
  description: string;
  tooltip: string;
  status: "ready" | "warn" | "off";
  statusLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card/25 px-2.5 py-2.5">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-foreground">{title}</span>
            {tooltip && <InfoTooltip content={tooltip} />}
            <Badge
              variant={status === "ready" ? "default" : "outline"}
              className={cn(
                "shrink-0 text-[9px]",
                status === "ready" && "bg-afx-success/20 text-afx-success",
                status === "warn" && "border-amber-500/40 text-amber-500",
              )}
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

// ─── Troubleshoot disclosure ──────────────────────────────────────────────────

function TroubleshootDisclosure({ actions }: { actions?: AgentRecoveryActions }) {
  return (
    <details className="group rounded-md border bg-card/25 px-2.5 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] text-muted-foreground marker:hidden hover:text-foreground">
        <span>{RUNTIMES.troubleshootLabel} ▾</span>
      </summary>
      <div className="mt-2">
        <RuntimeRecoveryButtonGrid actions={actions} />
      </div>
    </details>
  );
}

// ─── Setup/readiness cards ───────────────────────────────────────────────────

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
}: {
  apiProvidersEnabled: boolean;
  rpcEnabled: boolean;
  recoveryActions?: AgentRecoveryActions;
  onOpenApiProviders: () => void;
  onOpenExternalAgents: () => void;
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
              <PlugZap size={12} />
              Runtimes
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
              <RuntimeRecoveryButtonGrid actions={recoveryActions} className="mt-2" />
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
}: {
  actions?: AgentRecoveryActions;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-1.5 @[280px]:flex @[280px]:flex-wrap", className)}>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="min-w-0 justify-start"
        title={RUNTIMES.rpcReconnectTooltip}
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
        title={RUNTIMES.rpcRestartTooltip}
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
        title={RUNTIMES.rpcReloadTooltip}
        disabled={!actions?.onReloadHost}
        onClick={actions?.onReloadHost}
      >
        <RotateCcw size={12} />
        <span className="truncate">Reload</span>
      </Button>
    </div>
  );
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

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
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-FORM-ROWS]
 */
function SwitchRow({
  id,
  label,
  sublabel,
  description,
  tooltip,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  sublabel?: string;
  description: string;
  tooltip?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="afx-field-surface flex items-start justify-between gap-3 rounded-md border px-2.5 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-[11px]">
            {label}
          </Label>
          {sublabel && <span className="text-[9px] text-muted-foreground">{sublabel}</span>}
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
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
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-FORM-ROWS]
 */
function SelectRow({
  id,
  label,
  labelIcon,
  sublabel,
  description,
  tooltip,
  value,
  onChange,
  disabled,
  placeholderShown,
  options,
}: {
  id: string;
  label: string;
  labelIcon?: ReactNode;
  sublabel?: string;
  description: string;
  tooltip?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholderShown?: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="afx-field-surface flex flex-col gap-1.5 rounded-md border px-2.5 py-2">
      <div className="flex flex-col gap-0.5 leading-snug">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="flex items-center gap-1.5 text-[11px]">
            {labelIcon}
            {label}
          </Label>
          {sublabel && <span className="text-[9px] text-muted-foreground">{sublabel}</span>}
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
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
  titleTooltip,
  commands,
  disabled,
  onInsertCommand,
}: {
  title: string;
  titleTooltip?: string;
  commands: readonly AgentCommand[];
  disabled?: boolean;
  onInsertCommand?: (commandText: string) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <GroupTitle label={title} tooltip={titleTooltip} count={commands.length} />
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

function GroupTitle({ label, tooltip, count }: { label: string; tooltip?: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
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
