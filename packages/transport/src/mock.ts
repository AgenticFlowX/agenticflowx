/**
 * Mock transport — scripted scenarios for browser dev and unit tests.
 * Never active in production; injected only when `acquireVsCodeApi` is unavailable.
 *
 * @see docs/specs/110-package-transport/spec.md [FR-3] [FR-4] [FR-7]
 * @see docs/specs/110-package-transport/design.md [DES-TRANSPORT-MOCK-ADAPTER] [DES-TRANSPORT-MOCK-SCENARIOS]
 * @see docs/specs/100-package-shared/spec.md [FR-9] [FR-10]
 */
import {
  AFX_STYLE_IDS,
  API_PROVIDER_IDS,
  type AgentCommand,
  type AgentFileView,
  type AgentModel,
  type AgentRuntimePhase,
  type AgentRuntimeStatus,
  type AgentToChat,
  type ChatMessageView,
  type ChatTimelineItem,
  type ChatToAgent,
  type ChatToolView,
  type MessageOf,
  PROVIDER_DETAILS,
  type SettingsSnapshot,
  type WorkspaceMode,
  consoleSink,
  createLogger,
} from "@afx/shared";

import type { LogEntry, MockTransport, ScenarioFn } from "./types";

const logger = createLogger({ scope: "mock-transport", level: "info", sinks: [consoleSink()] });

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const MOCK_MODEL: AgentModel = {
  provider: "anthropic",
  id: "claude-opus-4",
  name: "Claude Opus 4",
  reasoning: true,
  contextWindow: 200_000,
  maxTokens: 32_000,
  source: "api-provider",
  instanceId: "pi-sdk",
  instanceLabel: "API Providers",
};

const MOCK_MODELS: AgentModel[] = [
  MOCK_MODEL,
  {
    provider: "openai",
    id: "gpt-5.2",
    name: "GPT-5.2",
    reasoning: true,
    contextWindow: 400_000,
    maxTokens: 128_000,
    source: "api-provider",
    instanceId: "pi-sdk",
    instanceLabel: "API Providers",
  },
  {
    provider: "anthropic",
    id: "claude-opus-4",
    name: "Claude Opus 4",
    reasoning: true,
    contextWindow: 200_000,
    maxTokens: 32_000,
    source: "external-agent",
    instanceId: "pi",
    instanceLabel: "Pi CLI",
  },
];
const DEFAULT_MOCK_MODELS = MOCK_MODELS.filter((model) => model.source !== "external-agent");

const MOCK_COMMANDS: AgentCommand[] = [
  { name: "skill:afx-task", description: "Pick, verify, code, complete tasks", source: "skill" },
  { name: "skill:afx-next", description: "Context-aware next action", source: "skill" },
  { name: "skill:afx-spec", description: "Manage spec lifecycle", source: "skill" },
  { name: "summarize", description: "Summarize current context", source: "prompt" },
];

const MOCK_FILES: AgentFileView[] = [
  { path: "apps/chat/src/views/chat.tsx", recent: true },
  { path: "apps/vscode/src/panels/sidebar-panel.ts", recent: true },
  { path: "packages/shared/src/messages.ts" },
];

const MOCK_PROVIDER_MODELS: Record<string, AgentModel[]> = {
  anthropic: [MOCK_MODEL],
  openai: [MOCK_MODELS[1]!],
};

function mockProviderSnapshot(provider: string): SettingsSnapshot["providers"][number] {
  const details = PROVIDER_DETAILS[provider] ?? {
    displayName: titleCase(provider),
    modelHint: "Models available from this provider",
  };
  const models = MOCK_PROVIDER_MODELS[provider] ?? [];
  return {
    id: provider,
    name: provider,
    displayName: details.displayName,
    modelCount: models.length,
    state: models.length > 0 ? "configured" : "empty",
    modelHint: details.modelHint,
    defaultModel: provider === "anthropic" ? "claude-opus-4" : undefined,
    models,
    helpUrl: details.helpUrl,
  };
}

const MOCK_SETTINGS_SNAPSHOT: SettingsSnapshot = {
  appearance: {
    theme: "meridian",
    style: "lyra",
    themes: [
      {
        id: "meridian",
        label: "AFX / Meridian",
        implemented: true,
        description: "AFX identity and brass accents over VS Code host surfaces.",
      },
    ],
    styles: AFX_STYLE_IDS.map((id) => ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      implemented: true,
      description:
        id === "lyra"
          ? "Compact, boxy shadcn treatment."
          : "Runtime treatment tokens over the Lyra primitive baseline.",
    })),
  },
  engine: {
    rpcEnabled: false,
    agentBinary: "pi",
    bundledSkillsPath: "resources/skills/agenticflowx",
    bundledSkillCount: 17,
    ephemeral: true,
  },
  providers: API_PROVIDER_IDS.map(mockProviderSnapshot),
  externalAgents: [
    {
      id: "pi",
      name: "Pi CLI",
      status: "disabled",
      modelCount: 0,
      binaryPath: "pi",
      enabled: false,
      ephemeral: true,
    },
  ],
  sdk: {
    enabled: true,
    defaultModel: "anthropic:claude-opus-4",
    ollamaBaseUrl: "",
    sessionDir: "extension-managed storage",
  },
  context: {
    includeActiveFileContext: true,
  },
  mode: {
    active: "code",
  },
  intent: {
    effective: { slot: 1, minimized: false },
    global: { slot: 1, minimized: false },
    hasWorkspaceOverride: false,
  },
  diagnostics: { logLevel: "info" },
  telemetry: {
    enabled: true,
    effectiveEnabled: true,
    vscodeTelemetryEnabled: true,
  },
  about: {
    extensionVersion: "2.0.0",
    bundledPiNpmVersion: "@mariozechner/pi-coding-agent@0.70.2",
  },
};

function titleCase(value: string): string {
  return value.replace(
    /(^|[-_\s])([a-z])/g,
    (_match, prefix: string, char: string) =>
      `${prefix === "-" || prefix === "_" ? " " : prefix}${char.toUpperCase()}`,
  );
}

type RuntimeSettings = Extract<AgentToChat, { type: "agent/runtimeSettings" }>["settings"];

const BASE_RUNTIME_SETTINGS: RuntimeSettings = {
  thinkingLevel: "medium",
  steeringMode: "one-at-a-time",
  followUpMode: "one-at-a-time",
  autoCompactionEnabled: true,
  autoRetryEnabled: true,
  isCompacting: false,
  sessionId: "mock-session-chat-foundation",
  sessionName: "Chat foundation mock",
  messageCount: 3,
  pendingMessageCount: 0,
};

const MOCK_COMPACTION = {
  summary: "Mock compaction kept the latest implementation context and summarized earlier UI work.",
  firstKeptEntryId: "mock-entry-kept-001",
  tokensBefore: 168_400,
};

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

export function createMockTransport(): MockTransport {
  const listeners = new Map<string, Set<(msg: AgentToChat) => void>>();
  const log: LogEntry[] = [];
  const logListeners = new Set<(entry: LogEntry) => void>();
  let streamSpeed = 40; // ms per chunk
  let runtimeSettings: RuntimeSettings = { ...BASE_RUNTIME_SETTINGS };
  let appearance: SettingsSnapshot["appearance"] = MOCK_SETTINGS_SNAPSHOT.appearance;
  let includeActiveFileContext = MOCK_SETTINGS_SNAPSHOT.context.includeActiveFileContext;
  let runtimeStatus: AgentRuntimeStatus = {
    phase: "ready",
    running: true,
    isStreaming: false,
    model: MOCK_MODEL,
    checkedAt: Date.now(),
    lastReadyAt: Date.now(),
    consecutiveFailures: 0,
  };
  let activeAssistantId: string | null = null;
  let mockStreaming = false;
  let drainingFollowUps = false;
  const pendingSteers: string[] = [];
  const pendingFollowUps: string[] = [];
  let activeMode: WorkspaceMode = MOCK_SETTINGS_SNAPSHOT.mode.active;
  let persistedState: unknown;
  // Mirrors emitted message events so chat/getState and chat/ready can return
  // the actual conversation history instead of wiping it on every chat-view
  // remount (e.g. tab switch).
  const trackedMessages: ChatTimelineItem[] = [];

  // ── internal emit ──────────────────────────────────────────────────────────

  function emit(msg: AgentToChat): void {
    trackEmittedMessage(msg);
    const entry: LogEntry = { id: uid(), dir: "in", type: msg.type, payload: msg, ts: Date.now() };
    log.push(entry);
    for (const l of logListeners) l(entry);

    const set = listeners.get(msg.type);
    if (!set) return;
    for (const l of set) {
      try {
        l(msg);
      } catch (err) {
        logger.error(() => `listener error: ${msg.type}`, err instanceof Error ? err : undefined);
      }
    }
  }

  function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Mirrors message lifecycle events into trackedMessages so a fresh
  // chat/getState (e.g. tab remount, phase-change re-fetch in app.tsx) can
  // return real history instead of [].
  function trackEmittedMessage(msg: AgentToChat): void {
    if (msg.type === "chat/state") {
      // Authoritative replacement — scenarios use this to inject system
      // cards (e.g. compaction summaries) that aren't covered by the
      // start/delta/end lifecycle. Without mirroring, a follow-up
      // chat/getState would clobber the just-set state with stale tracking.
      trackedMessages.length = 0;
      trackedMessages.push(...msg.messages);
      return;
    }
    if (msg.type === "chat/messageStart") {
      if (trackedMessages.some((m) => m.id === msg.id)) return;
      trackedMessages.push({
        id: msg.id,
        role: msg.role,
        content: msg.content ?? "",
        createdAt: msg.createdAt,
        streaming: msg.role === "assistant",
      });
      return;
    }
    if (msg.type === "chat/messageDelta") {
      const m = trackedMessages.find((m) => m.id === msg.id);
      if (m && "content" in m) m.content += msg.delta;
      return;
    }
    if (msg.type === "chat/messageEnd") {
      const m = trackedMessages.find((m) => m.id === msg.id);
      if (m && "content" in m) {
        m.streaming = false;
        if (msg.stopReason) m.stopReason = msg.stopReason;
      }
      return;
    }
    if (msg.type === "chat/toolStart") {
      const m = lastTrackedAssistantMessage();
      if (!m) return;
      const tool: ChatToolView = {
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        status: "running",
        args: msg.args as Record<string, unknown> | undefined,
      };
      m.tools = [...(m.tools ?? []), tool];
      return;
    }
    if (msg.type === "chat/toolEnd") {
      for (let i = trackedMessages.length - 1; i >= 0; i--) {
        const m = trackedMessages[i];
        if (!m || m.role !== "assistant" || !("tools" in m) || !m.tools?.length) continue;
        let matched = false;
        const nextTools = m.tools.map((tool) => {
          if (tool.toolCallId !== msg.toolCallId) return tool;
          matched = true;
          return {
            ...tool,
            status: msg.ok ? ("ok" as const) : ("error" as const),
            summary: msg.summary,
            firstChangedLine: msg.firstChangedLine ?? tool.firstChangedLine,
          };
        });
        if (matched) {
          m.tools = nextTools;
          return;
        }
      }
    }
  }

  function lastTrackedAssistantMessage(): ChatMessageView | null {
    for (let i = trackedMessages.length - 1; i >= 0; i--) {
      const m = trackedMessages[i];
      if (m?.role === "assistant") return m;
    }
    return null;
  }

  function emitRuntimeSettings(requestId?: string, patch?: Partial<RuntimeSettings>): void {
    runtimeSettings = {
      ...runtimeSettings,
      ...patch,
      pendingMessageCount: pendingSteers.length + pendingFollowUps.length,
    };
    emit({ type: "agent/runtimeSettings", requestId, settings: runtimeSettings });
  }

  function emitAgentStatus(
    patch: Partial<Omit<AgentRuntimeStatus, "checkedAt" | "consecutiveFailures">> & {
      phase?: AgentRuntimePhase;
      consecutiveFailures?: number;
    } = {},
    requestId?: string,
  ): void {
    const running = patch.running ?? runtimeStatus.running;
    const isStreaming = patch.isStreaming ?? runtimeStatus.isStreaming;
    const phase = patch.phase ?? (running ? (isStreaming ? "busy" : "ready") : "disconnected");
    const checkedAt = Date.now();
    runtimeStatus = {
      ...runtimeStatus,
      ...patch,
      phase,
      running,
      isStreaming,
      model: patch.model ?? runtimeStatus.model ?? MOCK_MODEL,
      checkedAt,
      lastReadyAt: running ? checkedAt : runtimeStatus.lastReadyAt,
      consecutiveFailures:
        patch.consecutiveFailures ?? (running ? 0 : runtimeStatus.consecutiveFailures + 1),
    };
    emit({ type: "agent/status", requestId, status: runtimeStatus });
  }

  function emitUserMessage(content: string): void {
    const id = uid();
    const createdAt = Date.now();
    runtimeSettings = {
      ...runtimeSettings,
      messageCount: (runtimeSettings.messageCount ?? 0) + 1,
    };
    emit({ type: "chat/messageStart", id, role: "user", createdAt, content });
    emit({ type: "chat/messageEnd", id });
  }

  function queueFollowUp(content: string): void {
    pendingFollowUps.push(content);
    emitRuntimeSettings();
  }

  function queueSteer(content: string): void {
    pendingSteers.push(content);
    emitRuntimeSettings();
  }

  function takeSteerBatch(): string[] {
    const count = runtimeSettings.steeringMode === "all" ? pendingSteers.length : 1;
    return pendingSteers.splice(0, count);
  }

  function takeFollowUpBatch(): string[] {
    const count = runtimeSettings.followUpMode === "all" ? pendingFollowUps.length : 1;
    return pendingFollowUps.splice(0, count);
  }

  function applyQueuedSteers(id: string): void {
    if (id !== activeAssistantId || pendingSteers.length === 0) return;
    const batch = takeSteerBatch();
    const summary =
      batch.length === 1
        ? (batch[0] ?? "")
        : [
            `${batch.length} queued messages`,
            ...batch.map((content, index) => `${index + 1}. ${content}`),
          ].join("\n");
    emitRuntimeSettings();
    emit({
      type: "chat/thinkingDelta",
      id,
      delta: `Applying ${batch.length === 1 ? "the queued steer" : `${batch.length} queued steers`} at the next agent step. `,
    });
    emit({
      type: "chat/messageDelta",
      id,
      delta: ["", "", `[Steer applied at next agent step: ${summary}]`, ""].join("\n"),
    });
  }

  async function drainFollowUps(): Promise<void> {
    if (drainingFollowUps || mockStreaming || pendingFollowUps.length === 0) return;
    drainingFollowUps = true;
    try {
      while (!mockStreaming && pendingFollowUps.length > 0) {
        const batch = takeFollowUpBatch();
        emitRuntimeSettings();
        await delay(120);
        const id = startAssistant();
        await streamText(
          id,
          [
            `Following up on ${batch.length === 1 ? "the queued message" : `${batch.length} queued messages`}:`,
            "",
            ...batch.map((content, index) => `${index + 1}. ${content}`),
            "",
            "Queued follow-up messages run after the active turn completes, matching the runtime follow-up behavior.",
          ].join("\n"),
        );
        endAssistant(id);
      }
    } finally {
      drainingFollowUps = false;
    }
  }

  // ── streaming helpers ──────────────────────────────────────────────────────

  async function streamText(id: string, text: string): Promise<void> {
    // Split into ~word-sized chunks for realistic feel
    const chunks = text.match(/.{1,6}/g) ?? [text];
    for (const chunk of chunks) {
      await delay(streamSpeed);
      applyQueuedSteers(id);
      emit({ type: "chat/messageDelta", id, delta: chunk });
    }
  }

  async function streamThinking(id: string, text: string): Promise<void> {
    const chunks = text.match(/.{1,8}/g) ?? [text];
    for (const chunk of chunks) {
      await delay(streamSpeed * 0.5);
      emit({ type: "chat/thinkingDelta", id, delta: chunk });
    }
  }

  function startAssistant(): string {
    const id = uid();
    const createdAt = Date.now();
    activeAssistantId = id;
    mockStreaming = true;
    emitAgentStatus({ running: true, isStreaming: true, model: MOCK_MODEL });
    emit({ type: "chat/messageStart", id, role: "assistant", createdAt });
    return id;
  }

  function endAssistant(id: string): void {
    applyQueuedSteers(id);
    emit({ type: "chat/messageEnd", id, stopReason: "end_turn" });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
    activeAssistantId = null;
    mockStreaming = false;
    emitRuntimeSettings(undefined, {
      isCompacting: false,
      messageCount: (runtimeSettings.messageCount ?? 0) + 1,
    });
    emit({
      type: "chat/usage",
      messageId: id,
      tokens: { input: 1240, output: 380, cacheRead: 800, cacheWrite: 0, total: 1620 },
      cost: 0.0062,
      contextUsage: { tokens: 1620, contextWindow: 200_000, percent: 0.8 },
    });
    void drainFollowUps();
  }

  // ── scenarios ──────────────────────────────────────────────────────────────

  const QUICK_PROMPT = `What does the transport package do in one paragraph?`;
  const QUICK_REPLY = `The transport package is the seam between the chat UI and whatever runtime handles a turn — VSCode webview postMessage in production, a scripted mock in browser dev. The chat UI talks only to the \`Transport\` interface, so swapping runtimes is a one-line injection in \`main.tsx\`.`;

  const MEDIUM_REPLY = `I've looked at the codebase and here's what I found.

The transport abstraction lives in \`packages/transport\` and exposes three methods: \`send\`, \`on\`, and \`dispose\`. Each adapter (VSCode, mock, future WebSocket) implements this interface.

The chat component in \`apps/chat\` never imports from \`vscode\` directly — it only talks to the injected transport, which means it runs identically in a browser or inside the extension.`;

  const LARGE_REPLY = `Great question. Let me walk through the full architecture.

## Transport Layer

The transport interface is the key seam in the system:

\`\`\`typescript
interface Transport {
  send(msg: ChatToAgent): void
  on<T extends AgentToChat['type']>(
    type: T,
    handler: (msg: MessageOf<AgentToChat, T>) => void
  ): () => void
  dispose(): void
}
\`\`\`

This is implemented by three adapters:
- \`createVscodeTransport()\` — wraps \`acquireVsCodeApi().postMessage\`
- \`createMockTransport()\` — scripted scenarios for dev and tests
- \`createWebSocketTransport(url)\` — future cloud support

## Message Protocol

All messages are discriminated unions in \`packages/shared/src/messages.ts\`. The two top-level types are:

- \`ChatToAgent\` — commands from the UI (send, abort, ready, newSession, getState)
- \`AgentToChat\` — events from the runtime (messageStart, messageDelta, thinkingDelta, toolStart, toolEnd, status, usage, error, aborted)

This naming is transport-agnostic — "agent" means the active runtime regardless of whether it's running locally in the extension host, behind a cloud API, or in a CLI subprocess.

## Apps vs Packages

The monorepo splits responsibility cleanly:

\`\`\`
apps/
  vscode/     — Extension host. Owns the local agent runtime, posts messages to webview.
  chat/       — React UI. Renders messages, sends commands. Zero VSCode imports.
  workbench/  — Secondary panel. Spec/task views.
packages/
  shared/     — Message protocol + shared types.
  transport/  — Transport interface + adapters.
  ui/         — Design system (Shadcn, Meridian/Lyra themes).
  parsers/    — Spec, task, journal parsers.
\`\`\`

## Dev Loop

Running \`pnpm dev:chat\` starts Vite on \`localhost:5173\`. The mock transport fires on startup, so you get a live, interactive chat UI in the browser — no VSCode or local agent process needed.

The \`DevOverlay\` (bottom-right corner, only in \`import.meta.env.DEV\`) exposes all scenarios: quick reply, large response, tool calls, errors, context full, etc.

## Future: Cloud

Adding cloud support means:
1. Implement \`createWebSocketTransport(url)\` in \`packages/transport\`
2. Create \`apps/web\` — a Next.js host that mounts \`apps/chat\` with the WS transport
3. No changes to \`apps/chat\` itself

The chat UI is already cloud-ready. It just needs the right transport injected at startup.`;

  const CODING_BENCHMARK_TURN_COUNT = 24;

  function createCodingBenchmarkMessages(now = Date.now()): ChatTimelineItem[] {
    const messages: ChatTimelineItem[] = [];

    for (let index = 0; index < CODING_BENCHMARK_TURN_COUNT; index += 1) {
      const turn = index + 1;
      const createdAt = now + index * 10;
      messages.push({
        id: `benchmark-user-${turn}`,
        role: "user",
        content: [
          `Benchmark refactor slice ${turn}: inspect the chat window extraction.`,
          `Focus on render isolation, long markdown, tool summaries, and composer responsiveness.`,
        ].join(" "),
        createdAt,
      });

      messages.push({
        id: `benchmark-assistant-${turn}`,
        role: "assistant",
        content: [
          `Benchmark refactor slice ${turn} result: the controller keeps bridge state stable while the visual regions render from narrow props.`,
          "",
          "```tsx",
          `const slice${turn} = {`,
          `  id: "turn-${turn}",`,
          `  files: ["apps/chat/src/components/chat/chat-window.tsx", "apps/chat/src/components/chat/conversation-timeline.tsx"],`,
          `  checks: ["render-isolation", "keyboard-shortcuts", "a11y-hints"],`,
          "};",
          "```",
          "",
          `Next practical step ${turn}: keep timeline rows stable while the user types or the footer receives usage updates.`,
        ].join("\n"),
        createdAt: createdAt + 1,
        ...(index % 3 === 0
          ? {
              tools: [
                {
                  toolCallId: `benchmark-tool-${turn}`,
                  toolName: index % 2 === 0 ? "read_file" : "edit_file",
                  status: "ok" as const,
                  args: {
                    path:
                      index % 2 === 0
                        ? "apps/chat/src/components/chat/chat-window.tsx"
                        : "apps/chat/src/components/chat/composer-panel.tsx",
                  },
                  summary:
                    index % 2 === 0
                      ? "Read component boundary and render contract."
                      : "Applied small panel-state preservation patch.",
                  ...(index % 2 === 0 ? {} : { firstChangedLine: 64 + index }),
                },
              ],
            }
          : {}),
        usage: {
          tokens: {
            input: 4800 + index * 80,
            output: 1200 + index * 30,
            cacheRead: 2200,
            cacheWrite: 64,
            total: 8264 + index * 110,
          },
          cost: 0.018 + index * 0.0004,
          contextUsage: {
            tokens: 8264 + index * 110,
            contextWindow: 200_000,
            percent: 4.1 + index * 0.05,
          },
        },
      });
    }

    messages.push({
      id: "benchmark-compaction",
      role: "compactionSummary",
      summary:
        "Benchmark retained the latest implementation context, active tasks, and verification notes after a long coding conversation.",
      tokensBefore: 64_000,
      createdAt: now + 250,
    });

    return messages;
  }

  function runCodingBenchmark(): void {
    const messages = createCodingBenchmarkMessages();
    emit({
      type: "chat/state",
      isStreaming: false,
      messages,
      tools: [],
    });
    emitRuntimeSettings(undefined, {
      isCompacting: false,
      messageCount: messages.length,
      thinkingLevel: runtimeSettings.thinkingLevel,
    });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
    emit({
      type: "chat/usage",
      messageId: `benchmark-assistant-${CODING_BENCHMARK_TURN_COUNT}`,
      tokens: { input: 9800, output: 2600, cacheRead: 4200, cacheWrite: 128, total: 16_728 },
      cost: 0.064,
      contextUsage: { tokens: 16_728, contextWindow: 200_000, percent: 8.36 },
    });
  }

  async function runQuickReply(): Promise<void> {
    emitUserMessage(QUICK_PROMPT);
    const id = startAssistant();
    await delay(180);
    await streamText(id, QUICK_REPLY);
    endAssistant(id);
  }

  async function runStreamingReply(): Promise<void> {
    const id = startAssistant();
    await delay(80);
    await streamText(id, MEDIUM_REPLY);
    endAssistant(id);
  }

  async function runLargeResponse(): Promise<void> {
    const id = startAssistant();
    await delay(60);
    await streamText(id, LARGE_REPLY);
    emit({
      type: "chat/usage",
      messageId: id,
      tokens: { input: 8400, output: 2100, cacheRead: 6000, cacheWrite: 400, total: 10500 },
      cost: 0.048,
      contextUsage: { tokens: 10500, contextWindow: 200_000, percent: 5.25 },
    });
    emit({ type: "chat/messageEnd", id, stopReason: "end_turn" });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
  }

  async function runThinkingReply(): Promise<void> {
    const id = startAssistant();
    await streamThinking(
      id,
      `Let me think through this carefully. The user is asking about the transport layer. I should explain how the adapter pattern works and why it enables running the chat UI in multiple environments without code changes. Key points: interface definition, three adapters, injection at entry point, no VSCode imports in chat app.`,
    );
    await streamText(
      id,
      `The transport is an adapter pattern — the chat UI talks to a \`Transport\` interface and never imports from \`vscode\` directly. Three implementations exist: VSCode postMessage, mock (for dev/tests), and future WebSocket for cloud. You inject the right one at startup in \`main.tsx\`.`,
    );
    endAssistant(id);
  }

  async function runSteerSimulation(): Promise<void> {
    const id = startAssistant();
    await streamText(id, "I'll start with the broad chat foundation architecture, then ");
    handleMockSteer(uid(), "Steer: skip the broad recap and focus on the debug-panel gap.");
    await streamText(
      id,
      "adjusting course: the useful change is to add mock runtime scenarios for steer, follow-up, compaction, and runtime settings, without touching the production bridge.",
    );
    endAssistant(id);
  }

  async function runFollowUpSimulation(): Promise<void> {
    const firstId = startAssistant();
    await streamText(
      firstId,
      "I'm checking the staged protocol surface against the runtime RPC contract and will summarize the missing pieces.",
    );
    handleMockFollowUp("Follow-up: also include the mode toggles after this turn.");
    await streamText(firstId, " The follow-up is queued and will run after this response.");
    endAssistant(firstId);
  }

  // Pre-populates the QueueStrip with a mix of steers and follow-ups during a
  // long stream so the new grouped/numbered queue UI can be inspected without
  // manually queueing items. DEV-only — relies on a window CustomEvent the
  // chat view listens for under import.meta.env.DEV.
  async function runQueueMany(): Promise<void> {
    const queueItems: { mode: "steer" | "followUp"; content: string }[] = [
      { mode: "steer", content: "Wait — focus on the auth bug first, ignore the rest." },
      { mode: "followUp", content: "Add error handling to all the network requests." },
      {
        mode: "followUp",
        content:
          "Update the tests so they cover the new schema, especially the edge cases around null user states and pagination boundaries.",
      },
      { mode: "followUp", content: "Run pnpm verify and report back." },
      { mode: "followUp", content: "Open a PR with a brief summary." },
      { mode: "followUp", content: "Tag @rix for review when done." },
    ];

    // Engine-side counts so the QueueStrip render gate (pendingMessageCount > 0)
    // stays satisfied throughout the simulation.
    for (const item of queueItems) {
      if (item.mode === "steer") pendingSteers.push(item.content);
      else pendingFollowUps.push(item.content);
    }
    emitRuntimeSettings();

    // Mirror items into the chat view's local queue display.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("afx:debug:inject-queue", { detail: { items: queueItems } }),
      );
    }

    const id = startAssistant();
    await delay(120);
    await streamText(
      id,
      `I'll work through the queued items in order. Starting with the steer to focus on the auth bug — let me look at the relevant files now and walk you through each step before moving on to the follow-ups.

This is a long-running response on purpose so the queue stays visible while you inspect it. The Steering and Queued sections above are real chat-side state, dismiss / clear actions wire through the same handlers production uses.`,
    );
    endAssistant(id);
  }

  async function runToolBash(): Promise<void> {
    const id = startAssistant();
    await delay(100);
    const toolCallId = uid();
    emit({
      type: "chat/toolStart",
      toolCallId,
      toolName: "bash",
      args: { command: "pnpm check:types 2>&1 | tail -5" },
    });
    await delay(1200);
    emit({ type: "chat/toolEnd", toolCallId, ok: true, summary: "All types OK (exit 0)" });
    await streamText(id, `Type check passed — no errors across all packages.`);
    endAssistant(id);
  }

  async function runToolReadFile(): Promise<void> {
    const id = startAssistant();
    await delay(80);
    const toolCallId = uid();
    emit({
      type: "chat/toolStart",
      toolCallId,
      toolName: "read_file",
      args: { path: "packages/shared/src/messages.ts" },
    });
    await delay(400);
    emit({
      type: "chat/toolEnd",
      toolCallId,
      ok: true,
      summary: "packages/shared/src/messages.ts (160 lines)",
    });
    await streamText(
      id,
      `I've read \`messages.ts\`. The protocol defines \`ChatToAgent\` (5 variants) and \`AgentToChat\` (11 variants). All message types are namespaced as \`chat/*\`. The \`MessageOf\` helper extracts specific variants by type discriminator.`,
    );
    endAssistant(id);
  }

  async function runToolEditFile(): Promise<void> {
    const id = startAssistant();
    await delay(60);
    const toolCallId = uid();
    emit({
      type: "chat/toolStart",
      toolCallId,
      toolName: "edit_file",
      args: { path: "apps/chat/src/views/chat.tsx", description: "Add scroll-to-bottom button" },
    });
    await delay(900);
    emit({
      type: "chat/toolEnd",
      toolCallId,
      ok: true,
      summary: "apps/chat/src/views/chat.tsx — 3 lines changed",
      // Forwarded from pi-mono-style `result.details.firstChangedLine` (1-indexed).
      // Used by the composer modified-files strip to jump the editor selection.
      firstChangedLine: 142,
    });
    await streamText(
      id,
      `Done. I added a scroll-to-bottom button that appears when the user scrolls up during streaming. It uses the existing \`userScrolledUp\` state and the \`scrollToBottom\` callback.`,
    );
    endAssistant(id);
  }

  /**
   * Dev/e2e scenario for the chat composer's AFX doc-action rail.
   *
   * It mirrors the VSCode host opening `docs/specs/auth/spec.md`, then emits a
   * completed assistant answer with a `Next:` command so Playwright can cover:
   *
   *   ◆ spec.md [Refine] [⚡Validate] […]
   *                  More ▾ -> Focus -> Performance
   *   Assistant result -> Next -> /afx-task code 2.3
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  function emitSpecDocContext(): void {
    emit({
      type: "chat/activeDocContext",
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      feature: "auth",
      filePath: "/workspace/docs/specs/auth/spec.md",
      approvalStatus: "Draft",
      // Sibling statuses + paths populate the spec stepper (FR-17).
      specStatus: "Draft",
      designStatus: "Draft",
      tasksStatus: null,
      tasksCompleted: 0,
      tasksTotal: 0,
      siblingPaths: {
        spec: "/workspace/docs/specs/auth/spec.md",
        design: "/workspace/docs/specs/auth/design.md",
        tasks: "/workspace/docs/specs/auth/tasks.md",
        journal: "/workspace/docs/specs/auth/journal.md",
      },
      parsedFocuses: [
        { id: "requirements", label: "Requirements", slug: "requirements", line: 12 },
        { id: "performance", label: "Performance", slug: "performance", line: 42 },
      ],
    });
  }

  function clearDocContext(): void {
    emit({
      type: "chat/activeDocContext",
      format: null,
      section: null,
      docKind: null,
      feature: null,
      filePath: null,
      approvalStatus: null,
    });
  }

  function runSpecDocActions(): void {
    emitSpecDocContext();

    const id = uid();
    emit({
      type: "chat/messageStart",
      id,
      role: "assistant",
      createdAt: Date.now(),
      content: "Reviewed the active spec.\n\nNext: /afx-task code 2.3",
    });
    emit({ type: "chat/messageEnd", id, stopReason: "end_turn" });
  }

  /**
   * Dev/e2e scenario for long ranked next actions rendered by the chat host.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  function runLongNextActions(): void {
    const feature = "dapi-394-warm-container-app-poc-with-approval-gates-and-long-name";
    emit({
      type: "chat/activeDocContext",
      format: "sprint",
      section: "TASKS",
      docKind: "tasks",
      feature,
      filePath: `/workspace/docs/specs/${feature}.md`,
      approvalStatus: "Draft",
      specStatus: "Approved",
      designStatus: "Draft",
      tasksStatus: "Draft",
      sectionOffsets: { spec: 18, design: 84, tasks: 146, sessions: 248 },
    });

    const id = uid();
    emit({
      type: "chat/messageStart",
      id,
      role: "assistant",
      createdAt: Date.now(),
      content: `Review complete for ${feature}.

Result: NOT READY FOR CODING

Next: /afx-sprint task ${feature} convert Refs lines to canonical @see comments
/afx-sprint design ${feature} add explicit Key Decisions table or N/A note
/afx-sprint spec ${feature} --approve`,
    });
    emit({ type: "chat/messageEnd", id, stopReason: "end_turn" });
  }

  /**
   * Dev/e2e scenario for a single-document sprint. The same file owns Spec,
   * Design, Tasks, Journal companion data, and Work Sessions offsets, so the
   * stepper must send `chat/openFile` with a line number instead of looking for
   * design.md/tasks.md siblings.
   *
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-17]
   */
  function runSprintDocActions(): void {
    emit({
      type: "chat/activeDocContext",
      format: "sprint",
      section: "SPEC",
      docKind: "spec",
      feature: "999-fleet/postgresql-marketplace-backend-rewrite",
      filePath: "/workspace/docs/specs/999-fleet/postgresql-marketplace-backend-rewrite.md",
      approvalStatus: "Draft",
      specStatus: "Draft",
      designStatus: "Draft",
      tasksStatus: "Draft",
      tasksCompleted: 0,
      tasksTotal: 0,
      workSessionsSigned: 0,
      workSessionsTotal: 1,
      siblingPaths: {
        journal: "/workspace/docs/specs/999-fleet/journal.md",
      },
      sectionOffsets: {
        spec: 22,
        design: 84,
        tasks: 140,
        sessions: 220,
      },
      parsedFocuses: [
        { id: "context", label: "Context", slug: "context", line: 32 },
        { id: "scope", label: "Scope", slug: "scope", line: 46 },
      ],
    });
  }

  /**
   * Dev/e2e scenario for the journal.md doc-actions strip. This covers the
   * compact sibling row and journal-specific primary buttons, which differ
   * enough from spec.md that the generic spec scenario does not protect them.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-17]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  function runJournalDocActions(): void {
    emit({
      type: "chat/activeDocContext",
      format: "standard",
      section: null,
      docKind: "journal",
      feature: "auth",
      filePath: "/workspace/docs/specs/auth/journal.md",
      approvalStatus: "Living",
      specStatus: "Approved",
      designStatus: "Approved",
      tasksStatus: "Approved",
      tasksCompleted: 3,
      tasksTotal: 3,
      workSessionsSigned: 2,
      workSessionsTotal: 3,
      siblingPaths: {
        spec: "/workspace/docs/specs/auth/spec.md",
        design: "/workspace/docs/specs/auth/design.md",
        tasks: "/workspace/docs/specs/auth/tasks.md",
        journal: "/workspace/docs/specs/auth/journal.md",
      },
      sectionOffsets: { sessions: 88 },
    });
  }

  /**
   * Dev/e2e scenario for the global session journal at `docs/specs/journal.md`.
   * It has no active feature and no spec/design/tasks siblings, so the chat UI
   * should surface `/afx-session` actions without rendering the spec stepper.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   */
  function runGlobalJournalDocActions(): void {
    emit({
      type: "chat/activeDocContext",
      format: "standard",
      section: null,
      docKind: "journal",
      feature: null,
      filePath: "/workspace/docs/specs/journal.md",
      approvalStatus: "Living",
    });
  }

  /**
   * Dev/e2e scenario for the FR-19 brass `[Sign Off ▾]` action. Mirrors the
   * VSCode host opening a `tasks.md` whose body checkboxes are all `[x]`,
   * every Work Sessions Agent cell is `[x]`, and three Human cells are still
   * `[ ]` — the canonical readiness state for Sign Off.
   *
   *   ✦ tasks.md · Living  Spec ✓ → Design ✓ → Tasks 8/8 → Code · ▾Memory
   *   [Code|▾] [Review|▾] | [⚡Verify] [⚡Pick] [Sign Off ▾]   ← brass
   *
   * Click `[Sign Off ▾]` to inspect the confirm popover (Tick 3 Human cells ·
   * Promote status to Living · Update updated_at).
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-19]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  function runTasksSignOffReady(): void {
    emit({
      type: "chat/activeDocContext",
      format: "standard",
      section: "TASKS",
      docKind: "tasks",
      feature: "auth",
      filePath: "/workspace/docs/specs/auth/tasks.md",
      approvalStatus: "Living",
      tasksCompleted: 8,
      tasksTotal: 8,
      specStatus: "Approved",
      designStatus: "Approved",
      tasksStatus: "Living",
      taskPhases: [
        {
          number: 1,
          name: "Build",
          completed: 4,
          total: 4,
          line: 10,
          items: [
            { text: "Wire auth route", completed: true, line: 11, wbsId: "1.1" },
            { text: "Hash passwords", completed: true, line: 12, wbsId: "1.2" },
            { text: "Issue session cookie", completed: true, line: 13, wbsId: "1.3" },
            { text: "Add logout handler", completed: true, line: 14, wbsId: "1.4" },
          ],
        },
        {
          number: 2,
          name: "Verify",
          completed: 4,
          total: 4,
          line: 20,
          items: [
            { text: "Cover login flow", completed: true, line: 21, wbsId: "2.1" },
            { text: "Cover bad-password path", completed: true, line: 22, wbsId: "2.2" },
            { text: "Verify cookie expiry", completed: true, line: 23, wbsId: "2.3" },
            { text: "Smoke test on dev host", completed: true, line: 24, wbsId: "2.4" },
          ],
        },
      ],
      signOff: {
        ready: true,
        signable: true,
        allTasksChecked: true,
        allAgentVerified: true,
        pendingTasks: 0,
        pendingAgentRows: 0,
        pendingHumanRows: 3,
        alreadyLiving: false,
      },
    });
  }

  /**
   * Relaxed-mode Sign Off — tasks.md has 2 body checkboxes still `[ ]` and 1
   * Work Sessions Agent row not yet `[x]`, but 1 Human cell is pending. The
   * strip surfaces a Sign Off button with a muted warning tone; the popover
   * shows the unmet strict conditions as warnings and notes that status will
   * stay unchanged. Confirm still ticks the eligible Human cell so users can
   * make incremental progress.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-19]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  function runTasksSignOffRelaxed(): void {
    emit({
      type: "chat/activeDocContext",
      format: "standard",
      section: "TASKS",
      docKind: "tasks",
      feature: "auth",
      filePath: "/workspace/docs/specs/auth/tasks.md",
      approvalStatus: "Draft",
      tasksCompleted: 4,
      tasksTotal: 6,
      specStatus: "Approved",
      designStatus: "Approved",
      tasksStatus: "Draft",
      taskPhases: [
        {
          number: 1,
          name: "Build",
          completed: 4,
          total: 4,
          line: 10,
          items: [
            { text: "Wire auth route", completed: true, line: 11, wbsId: "1.1" },
            { text: "Hash passwords", completed: true, line: 12, wbsId: "1.2" },
            { text: "Issue session cookie", completed: true, line: 13, wbsId: "1.3" },
            { text: "Add logout handler", completed: true, line: 14, wbsId: "1.4" },
          ],
        },
        {
          number: 2,
          name: "Verify",
          completed: 0,
          total: 2,
          line: 20,
          items: [
            { text: "Cover login flow", completed: false, line: 21, wbsId: "2.1" },
            { text: "Cover bad-password path", completed: false, line: 22, wbsId: "2.2" },
          ],
        },
      ],
      signOff: {
        ready: false,
        signable: true,
        allTasksChecked: false,
        allAgentVerified: false,
        pendingTasks: 2,
        pendingAgentRows: 1,
        pendingHumanRows: 1,
        alreadyLiving: false,
      },
    });
  }

  async function runMultiTool(): Promise<void> {
    const id = startAssistant();
    await delay(60);

    const t1 = uid();
    emit({
      type: "chat/toolStart",
      toolCallId: t1,
      toolName: "bash",
      args: { command: "ls apps/" },
    });
    await delay(300);
    emit({
      type: "chat/toolEnd",
      toolCallId: t1,
      ok: true,
      summary: "chat  vscode  workbench  vscode-e2e",
    });

    const t2 = uid();
    emit({
      type: "chat/toolStart",
      toolCallId: t2,
      toolName: "read_file",
      args: { path: "apps/chat/package.json" },
    });
    await delay(250);
    emit({
      type: "chat/toolEnd",
      toolCallId: t2,
      ok: true,
      summary: "apps/chat/package.json (39 lines)",
    });

    const t3 = uid();
    emit({
      type: "chat/toolStart",
      toolCallId: t3,
      toolName: "bash",
      args: { command: "pnpm check:types" },
    });
    await delay(1800);
    emit({ type: "chat/toolEnd", toolCallId: t3, ok: true, summary: "All types OK" });

    await streamText(
      id,
      `Checked the workspace. You have four apps (\`chat\`, \`vscode\`, \`workbench\`, \`vscode-e2e\`). The \`apps/chat\` package is correctly named and types are clean across all projects.`,
    );
    endAssistant(id);
  }

  async function runToolError(): Promise<void> {
    const id = startAssistant();
    await delay(80);
    const toolCallId = uid();
    emit({ type: "chat/toolStart", toolCallId, toolName: "bash", args: { command: "pnpm build" } });
    await delay(700);
    emit({
      type: "chat/toolEnd",
      toolCallId,
      ok: false,
      summary: "Exit code 1 — build failed",
    });
    await streamText(
      id,
      `The build failed. The error is in \`apps/vscode/src/extension.ts\` — a missing import. Let me fix it.`,
    );
    endAssistant(id);
  }

  async function runProviderError(): Promise<void> {
    emitAgentStatus({ running: true, isStreaming: true, model: MOCK_MODEL });
    await delay(600);
    emit({
      type: "chat/error",
      message:
        "Provider error: 429 You've exceeded your rate limit. Please wait 60 seconds before retrying.",
    });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
  }

  async function runAbort(): Promise<void> {
    const id = startAssistant();
    await streamText(id, `I'm working through the codebase to find all usages of the`);
    await delay(300);
    emit({ type: "chat/aborted" });
    emit({ type: "chat/messageEnd", id, stopReason: "aborted" });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
  }

  function runDisconnected(): Promise<void> {
    emitAgentStatus({
      running: false,
      isStreaming: false,
      phase: "disconnected",
      info: "Agent runtime exited (code 1)",
      consecutiveFailures: 3,
    });
    return Promise.resolve();
  }

  async function runStartupCheck(): Promise<void> {
    emitAgentStatus({
      running: false,
      isStreaming: false,
      phase: "checking",
      info: "Checking agent runtime readiness.",
      consecutiveFailures: 0,
    });
    await delay(250);
    emitAgentStatus({
      running: false,
      isStreaming: false,
      phase: "starting",
      info: "Starting agent runtime.",
      consecutiveFailures: 1,
    });
    await delay(500);
    emitAgentStatus({ running: true, isStreaming: false, phase: "ready", model: MOCK_MODEL });
  }

  async function runLongDisconnect(): Promise<void> {
    emitAgentStatus({
      running: false,
      isStreaming: false,
      phase: "checking",
      info: "Checking agent runtime readiness.",
      consecutiveFailures: 1,
    });
    await delay(250);
    emitAgentStatus({
      running: false,
      isStreaming: false,
      phase: "checking",
      info: "Agent runtime has not reported readiness yet.",
      consecutiveFailures: 2,
    });
    await delay(250);
    emitAgentStatus({
      running: false,
      isStreaming: false,
      phase: "disconnected",
      info: "Agent runtime did not become ready after multiple checks.",
      consecutiveFailures: 3,
    });
  }

  async function runRetryRecovery(requestId = uid()): Promise<void> {
    await runLongDisconnect();
    await delay(300);
    emitAgentStatus(
      {
        running: false,
        isStreaming: false,
        phase: "checking",
        info: "Retrying agent runtime connection.",
        consecutiveFailures: 0,
      },
      requestId,
    );
    await delay(400);
    emitAgentStatus(
      { running: true, isStreaming: false, phase: "ready", model: MOCK_MODEL },
      requestId,
    );
  }

  async function runRestartRecovery(requestId = uid()): Promise<void> {
    emitAgentStatus(
      {
        running: false,
        isStreaming: false,
        phase: "checking",
        info: "Restarting agent runtime.",
        consecutiveFailures: 0,
      },
      requestId,
    );
    activeAssistantId = null;
    mockStreaming = false;
    pendingSteers.length = 0;
    pendingFollowUps.length = 0;
    await delay(500);
    emitAgentStatus(
      { running: true, isStreaming: false, phase: "ready", model: MOCK_MODEL },
      requestId,
    );
  }

  async function runContextNearFull(): Promise<void> {
    const id = startAssistant();
    await streamText(
      id,
      `I can see the context window is getting full. You might want to start a new session soon to avoid hitting the limit.`,
    );
    emit({
      type: "chat/usage",
      messageId: id,
      tokens: { input: 168_000, output: 1200, cacheRead: 140_000, cacheWrite: 0, total: 169_200 },
      cost: 1.24,
      contextUsage: { tokens: 169_200, contextWindow: 200_000, percent: 84.6 },
    });
    emit({ type: "chat/messageEnd", id, stopReason: "end_turn" });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
  }

  async function runContextRecovery(content = "/afx-session recap"): Promise<void> {
    emitUserMessage(content);
    const compactionMessage = {
      id: uid(),
      role: "compactionSummary" as const,
      summary: MOCK_COMPACTION.summary,
      tokensBefore: MOCK_COMPACTION.tokensBefore,
      createdAt: Date.now(),
    };
    const recoveryText =
      "Recovered after automatic compaction. The AFX session recap can continue on the compacted context.";
    emitRuntimeSettings(undefined, { isCompacting: true });
    emitAgentStatus({ running: true, isStreaming: true, model: MOCK_MODEL });
    await delay(250);
    emit({
      type: "chat/toast",
      tone: "info",
      message: "Context overflow detected",
      description: "Compacting the session and retrying the prompt.",
    });
    await delay(300);
    emit({
      type: "chat/state",
      isStreaming: true,
      messages: [compactionMessage],
      tools: [],
    });
    emit({ type: "agent/compacted", requestId: uid(), result: MOCK_COMPACTION });
    emitRuntimeSettings(undefined, {
      isCompacting: false,
      messageCount: Math.max(1, Math.min(runtimeSettings.messageCount ?? 1, 3)),
    });
    await delay(120);
    const id = startAssistant();
    await streamText(id, recoveryText);
    endAssistant(id);
    emit({
      type: "chat/state",
      isStreaming: false,
      messages: [
        compactionMessage,
        {
          id,
          role: "assistant",
          content: recoveryText,
          createdAt: Date.now(),
          streaming: false,
          stopReason: "end_turn",
        },
      ],
      tools: [],
    });
  }

  function runRuntimeSettingsLoaded(): void {
    emitRuntimeSettings(undefined, {
      thinkingLevel: "high",
      steeringMode: "one-at-a-time",
      followUpMode: "all",
      autoCompactionEnabled: true,
      autoRetryEnabled: false,
      isCompacting: false,
      sessionId: "mock-session-runtime-controls",
      sessionName: "Runtime controls",
      messageCount: 12,
    });
  }

  async function runCompaction(requestId = uid()): Promise<void> {
    emitRuntimeSettings(requestId, { isCompacting: true });
    emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
    await delay(500);
    emit({ type: "agent/compacted", requestId, result: MOCK_COMPACTION });
    emitRuntimeSettings(requestId, {
      isCompacting: false,
      messageCount: Math.max(1, Math.min(runtimeSettings.messageCount ?? 1, 3)),
    });
  }

  function handleMockSteer(requestId: string, content: string): void {
    if (!mockStreaming || !activeAssistantId) {
      emit({
        type: "chat/error",
        requestId,
        message: "Cannot steer: no turn is currently streaming.",
      });
      return;
    }
    emitUserMessage(content);
    queueSteer(content);
  }

  function handleMockFollowUp(content: string): void {
    emitUserMessage(content);
    queueFollowUp(content);
    if (!mockStreaming) void drainFollowUps();
  }

  function runModelsLoaded(): void {
    emit({ type: "agent/models", requestId: uid(), models: DEFAULT_MOCK_MODELS });
  }

  function runModelsEmpty(): void {
    emit({ type: "agent/models", requestId: uid(), models: [] });
  }

  function runCommandsLoaded(): void {
    emit({ type: "agent/commands", requestId: uid(), commands: MOCK_COMMANDS });
  }

  function runFilesListed(): void {
    emit({ type: "agent/files", requestId: uid(), files: MOCK_FILES });
  }

  function runStderrLoaded(): void {
    emit({
      type: "agent/stderr",
      requestId: uid(),
      content: "Runtime stderr buffer is quiet in this mock scenario.",
    });
  }

  function runSettingsSnapshotLoaded(): void {
    emit({
      type: "agent/settingsSnapshot",
      requestId: uid(),
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
      },
    });
  }

  function runProvidersEmpty(): void {
    emit({
      type: "agent/settingsSnapshot",
      requestId: uid(),
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
        providers: MOCK_SETTINGS_SNAPSHOT.providers.map((provider) => ({
          ...provider,
          modelCount: 0,
          state: provider.id === "ollama" ? "no-key-needed" : "empty",
          models: [],
        })),
        externalAgents: [
          {
            id: "pi",
            name: "Pi CLI",
            status: "disabled",
            modelCount: 0,
            binaryPath: "Auto-detect from PATH",
            enabled: false,
            ephemeral: false,
          },
        ],
      },
    });
  }

  function runProvidersAnthropicConfigured(): void {
    emit({
      type: "agent/settingsSnapshot",
      requestId: uid(),
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
        providers: MOCK_SETTINGS_SNAPSHOT.providers.filter((provider) =>
          ["anthropic", "openai"].includes(provider.id),
        ),
      },
    });
  }

  function runProvidersMultiConfigured(): void {
    emit({
      type: "agent/settingsSnapshot",
      requestId: uid(),
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
        sdk: {
          enabled: true,
          defaultModel: "anthropic:claude-opus-4",
          ollamaBaseUrl: "http://127.0.0.1:11434",
          sessionDir: "extension-managed storage",
        },
        providers: [
          ...MOCK_SETTINGS_SNAPSHOT.providers,
          {
            id: "ollama",
            name: "ollama",
            displayName: "Ollama",
            modelCount: 2,
            state: "no-key-needed",
            modelHint: "Local Ollama models from your base URL",
            models: [],
          },
        ],
      },
    });
  }

  function runExternalAgentOnly(): void {
    emit({
      type: "agent/models",
      requestId: uid(),
      models: MOCK_MODELS.filter((model) => model.source === "external-agent"),
    });
    emit({
      type: "agent/settingsSnapshot",
      requestId: uid(),
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
        providers: MOCK_SETTINGS_SNAPSHOT.providers.map((provider) => ({
          ...provider,
          modelCount: 0,
          state: "empty",
          models: [],
        })),
        engine: { ...MOCK_SETTINGS_SNAPSHOT.engine, rpcEnabled: true },
        externalAgents: [
          {
            id: "pi",
            name: "Pi CLI",
            status: "connected",
            modelCount: 1,
            binaryPath: "pi",
            enabled: true,
            ephemeral: true,
          },
        ],
      },
    });
  }

  function runBothConfigured(): void {
    emit({ type: "agent/models", requestId: uid(), models: MOCK_MODELS });
    emit({
      type: "agent/settingsSnapshot",
      requestId: uid(),
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
        engine: { ...MOCK_SETTINGS_SNAPSHOT.engine, rpcEnabled: true },
        externalAgents: [
          {
            id: "pi",
            name: "Pi CLI",
            status: "connected",
            modelCount: 1,
            binaryPath: "pi",
            enabled: true,
            ephemeral: true,
          },
        ],
      },
    });
  }

  function runAppearancePreview(): void {
    appearance = { ...appearance, theme: "meridian", style: "mira" };
    const requestId = uid();
    emit({ type: "agent/appearanceUpdated", requestId, appearance });
    emit({
      type: "agent/settingsSnapshot",
      requestId,
      snapshot: {
        ...MOCK_SETTINGS_SNAPSHOT,
        appearance,
        context: { includeActiveFileContext },
      },
    });
  }

  // ── public API ─────────────────────────────────────────────────────────────

  function send(msg: ChatToAgent): void {
    const entry: LogEntry = { id: uid(), dir: "out", type: msg.type, payload: msg, ts: Date.now() };
    log.push(entry);
    for (const l of logListeners) l(entry);

    if (msg.type === "chat/ready" || msg.type === "chat/getState") {
      emit({
        type: "chat/state",
        isStreaming: mockStreaming,
        messages: trackedMessages.slice(),
        tools: [],
      });
      emitAgentStatus({ running: true, isStreaming: mockStreaming, model: MOCK_MODEL });
      emitRuntimeSettings();
      return;
    }
    if (msg.type === "agent/checkStatus") {
      emitAgentStatus(
        runtimeStatus.phase === "disconnected" || runtimeStatus.phase === "error"
          ? {
              running: false,
              isStreaming: false,
              phase: runtimeStatus.phase,
              info: runtimeStatus.info,
              consecutiveFailures: runtimeStatus.consecutiveFailures,
            }
          : { running: true, isStreaming: mockStreaming, model: runtimeStatus.model ?? MOCK_MODEL },
        msg.requestId,
      );
      return;
    }
    if (msg.type === "agent/restart") {
      void runRestartRecovery(msg.requestId);
      return;
    }
    if (msg.type === "agent/reload") {
      emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL }, msg.requestId);
      return;
    }
    if (msg.type === "chat/send") {
      if (msg.content.trim().startsWith("/afx-session")) {
        void runContextRecovery(msg.content);
        return;
      }
      emitUserMessage(msg.content);
      void runStreamingReply();
      return;
    }
    if (msg.type === "chat/getModels") {
      emit({ type: "agent/models", requestId: msg.requestId, models: DEFAULT_MOCK_MODELS });
      return;
    }
    if (msg.type === "chat/setModel") {
      const model =
        MOCK_MODELS.find(
          (m) =>
            m.provider === msg.provider &&
            m.id === msg.modelId &&
            (msg.instanceId
              ? m.instanceId === msg.instanceId
              : (m.instanceId ?? "default") === "default"),
        ) ?? MOCK_MODELS[0]!;
      emit({ type: "agent/modelChanged", requestId: msg.requestId, model });
      emitAgentStatus({ running: true, isStreaming: false, model });
      return;
    }
    if (msg.type === "chat/getCommands") {
      emit({ type: "agent/commands", requestId: msg.requestId, commands: MOCK_COMMANDS });
      return;
    }
    if (msg.type === "chat/listFiles") {
      emit({ type: "agent/files", requestId: msg.requestId, files: MOCK_FILES });
      return;
    }
    if (msg.type === "chat/getSettingsSnapshot") {
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
        },
      });
      return;
    }
    if (msg.type === "chat/setMode") {
      activeMode = msg.mode;
      MOCK_SETTINGS_SNAPSHOT.mode.active = activeMode;
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
        },
      });
      return;
    }
    if (msg.type === "chat/setIncludeActiveFileContext") {
      includeActiveFileContext = msg.enabled;
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
        },
      });
      return;
    }
    if (msg.type === "appearance/update") {
      const nextTheme = msg.theme === "meridian" ? msg.theme : appearance.theme;
      const nextStyle =
        typeof msg.style === "string" && AFX_STYLE_IDS.includes(msg.style as never)
          ? (msg.style as SettingsSnapshot["appearance"]["style"])
          : appearance.style;
      if ((msg.theme && msg.theme !== nextTheme) || (msg.style && msg.style !== nextStyle)) {
        emit({
          type: "chat/error",
          requestId: msg.requestId,
          message: "Unknown appearance value. Falling back to AFX / Meridian with Lyra treatment.",
        });
        return;
      }
      appearance = { ...appearance, theme: nextTheme, style: nextStyle };
      emit({ type: "agent/appearanceUpdated", requestId: msg.requestId, appearance });
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
        },
      });
      return;
    }
    if (msg.type === "provider/setApiKey") {
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
          providers: MOCK_SETTINGS_SNAPSHOT.providers.map((provider) =>
            provider.id === msg.provider ? { ...provider, state: "configured" } : provider,
          ),
        },
      });
      return;
    }
    if (msg.type === "provider/clearApiKey") {
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
          providers: MOCK_SETTINGS_SNAPSHOT.providers.map((provider) =>
            provider.id === msg.provider
              ? { ...provider, state: "empty", modelCount: 0, models: [] }
              : provider,
          ),
        },
      });
      return;
    }
    if (msg.type === "provider/setDefaultModel") {
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
          sdk: {
            ...MOCK_SETTINGS_SNAPSHOT.sdk!,
            defaultModel: `${msg.provider}:${msg.modelId}`,
          },
          providers: MOCK_SETTINGS_SNAPSHOT.providers.map((provider) =>
            provider.id === msg.provider ? { ...provider, defaultModel: msg.modelId } : provider,
          ),
        },
      });
      return;
    }
    if (msg.type === "external/detectPiBinary") {
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
          engine: { ...MOCK_SETTINGS_SNAPSHOT.engine, rpcEnabled: true },
          externalAgents: [
            {
              id: "pi",
              name: "Pi CLI",
              status: "unavailable",
              modelCount: 0,
              binaryPath: "pi",
              enabled: true,
              ephemeral: true,
            },
          ],
        },
      });
      return;
    }
    if (msg.type === "external/setRpcEnabled") {
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
          engine: { ...MOCK_SETTINGS_SNAPSHOT.engine, rpcEnabled: msg.enabled },
          externalAgents: [
            {
              id: "pi",
              name: "Pi CLI",
              status: msg.enabled ? "unavailable" : "disabled",
              modelCount: 0,
              binaryPath: "pi",
              enabled: msg.enabled,
              ephemeral: true,
            },
          ],
        },
      });
      return;
    }
    if (msg.type === "external/setEphemeral") {
      runtimeSettings = { ...runtimeSettings };
      emit({
        type: "agent/settingsSnapshot",
        requestId: msg.requestId,
        snapshot: {
          ...MOCK_SETTINGS_SNAPSHOT,
          appearance,
          context: { includeActiveFileContext },
          engine: { ...MOCK_SETTINGS_SNAPSHOT.engine, ephemeral: msg.enabled },
          externalAgents: MOCK_SETTINGS_SNAPSHOT.externalAgents?.map((agent) => ({
            ...agent,
            ephemeral: msg.enabled,
          })),
        },
      });
      return;
    }
    if (msg.type === "chat/openSettings") {
      return;
    }
    if (msg.type === "chat/showLogs") {
      return;
    }
    if (msg.type === "chat/compact") {
      void runCompaction(msg.requestId);
      return;
    }
    if (msg.type === "chat/setThinkingLevel") {
      emitRuntimeSettings(msg.requestId, { thinkingLevel: msg.level });
      return;
    }
    if (msg.type === "chat/setSteeringMode") {
      emitRuntimeSettings(msg.requestId, { steeringMode: msg.mode });
      return;
    }
    if (msg.type === "chat/setFollowUpMode") {
      emitRuntimeSettings(msg.requestId, { followUpMode: msg.mode });
      return;
    }
    if (msg.type === "chat/setAutoCompaction") {
      emitRuntimeSettings(msg.requestId, { autoCompactionEnabled: msg.enabled });
      return;
    }
    if (msg.type === "chat/setAutoRetry") {
      emitRuntimeSettings(msg.requestId, { autoRetryEnabled: msg.enabled });
      return;
    }
    if (msg.type === "chat/steer") {
      handleMockSteer(msg.requestId, msg.content);
      return;
    }
    if (msg.type === "chat/followUp") {
      handleMockFollowUp(msg.content);
      return;
    }
    if (msg.type === "chat/abort") {
      emit({ type: "chat/aborted" });
      emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
      activeAssistantId = null;
      mockStreaming = false;
      pendingSteers.length = 0;
      pendingFollowUps.length = 0;
      return;
    }
    if (msg.type === "chat/newSession") {
      runtimeSettings = {
        ...BASE_RUNTIME_SETTINGS,
        sessionId: `mock-session-${Date.now().toString(36)}`,
        messageCount: 0,
      };
      activeAssistantId = null;
      mockStreaming = false;
      pendingSteers.length = 0;
      pendingFollowUps.length = 0;
      trackedMessages.length = 0;
      emit({ type: "chat/state", isStreaming: false, messages: [], tools: [] });
      emitAgentStatus({ running: true, isStreaming: false, model: MOCK_MODEL });
      emitRuntimeSettings();
    }
  }

  function on<T extends AgentToChat["type"]>(
    type: T,
    handler: (msg: MessageOf<AgentToChat, T>) => void,
  ): () => void {
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    const wrapped = handler as (msg: AgentToChat) => void;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
    };
  }

  function dispose(): void {
    listeners.clear();
    logListeners.clear();
  }

  function onLog(cb: (entry: LogEntry) => void): () => void {
    logListeners.add(cb);
    return () => logListeners.delete(cb);
  }

  function getLog(): LogEntry[] {
    return [...log];
  }

  function setStreamSpeed(ms: number): void {
    streamSpeed = ms;
  }

  function getState(): unknown {
    return persistedState;
  }

  function setState(state: unknown): void {
    persistedState = state;
  }

  const scenarios: Record<string, ScenarioFn> = {
    "quick-reply": () => void runQuickReply(),
    "streaming-reply": () => void runStreamingReply(),
    "large-response": () => void runLargeResponse(),
    "coding-benchmark": () => runCodingBenchmark(),
    "thinking-reply": () => void runThinkingReply(),
    steer: () => void runSteerSimulation(),
    "follow-up": () => void runFollowUpSimulation(),
    "queue-many": () => void runQueueMany(),
    "tool-bash": () => void runToolBash(),
    "tool-read-file": () => void runToolReadFile(),
    "tool-edit-file": () => void runToolEditFile(),
    "spec-doc-actions": () => runSpecDocActions(),
    "spec-doc-clear": () => clearDocContext(),
    "spec-doc-preview": () => emitSpecDocContext(),
    "long-next-actions": () => runLongNextActions(),
    "sprint-doc-actions": () => runSprintDocActions(),
    "journal-doc-actions": () => runJournalDocActions(),
    "global-journal-doc-actions": () => runGlobalJournalDocActions(),
    "tasks-sign-off-ready": () => runTasksSignOffReady(),
    "tasks-sign-off-relaxed": () => runTasksSignOffRelaxed(),
    "multi-tool": () => void runMultiTool(),
    "tool-error": () => void runToolError(),
    "provider-error": () => void runProviderError(),
    abort: () => void runAbort(),
    startup: () => void runStartupCheck(),
    disconnected: () => void runDisconnected(),
    "long-disconnect": () => void runLongDisconnect(),
    "retry-recovery": () => void runRetryRecovery(),
    "restart-recovery": () => void runRestartRecovery(),
    "context-near-full": () => void runContextNearFull(),
    "context-recovery": () => void runContextRecovery(),
    runtimeSettingsLoaded: () => runRuntimeSettingsLoaded(),
    compacting: () => void runCompaction(),
    modelsLoaded: () => runModelsLoaded(),
    modelsEmpty: () => runModelsEmpty(),
    commandsLoaded: () => runCommandsLoaded(),
    filesListed: () => runFilesListed(),
    stderrLoaded: () => runStderrLoaded(),
    settingsSnapshotLoaded: () => runSettingsSnapshotLoaded(),
    providersEmpty: () => runProvidersEmpty(),
    providersAnthropicConfigured: () => runProvidersAnthropicConfigured(),
    providersMultiConfigured: () => runProvidersMultiConfigured(),
    externalAgentOnly: () => runExternalAgentOnly(),
    bothConfigured: () => runBothConfigured(),
    appearancePreview: () => runAppearancePreview(),
  };

  return { send, on, getState, setState, dispose, scenarios, onLog, getLog, setStreamSpeed };
}
