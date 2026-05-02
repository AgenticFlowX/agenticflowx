import { dirname } from "node:path";

import { type PiClient, type PiEvent, createPiClient } from "@afx/agent-pi";
import { PROVIDER_API_KEY_ENV_ALIASES, getDefaultApiProviderModel } from "@afx/shared";
import type {
  AgentCommand,
  AgentEvent,
  AgentEventListener,
  AgentManager,
  AgentModel,
  AgentStatus,
  AgentStderrListener,
  AgentUiResponse,
  AgentUsageStats,
  CompactionResult,
  Disposable,
  QueueMode,
  ThinkingLevel,
} from "@afx/shared";

import type { PiSdkManagerOptions } from "./options";

const START_RETRY_COOLDOWN_MS = 10_000;
const START_MAX_ATTEMPTS = 3;
const CONTEXT_OVERFLOW_PATTERNS: readonly RegExp[] = [
  /exceeds the context window/i,
  /context window exceeds limit/i,
  /input token count.*exceeds the maximum/i,
  /maximum context length is \d+ tokens/i,
  /too many tokens/i,
  /token limit exceeded/i,
  /context[_ ]length[_ ]exceeded/i,
];
const RETRYABLE_PROVIDER_ERROR_PATTERNS: readonly RegExp[] = [
  /overloaded/i,
  /provider.?returned.?error/i,
  /rate.?limit/i,
  /too many requests/i,
  /\b429\b/,
  /\b5\d\d\b/,
  /service.?unavailable/i,
  /server.?error/i,
  /internal.?error/i,
  /network.?error/i,
  /connection.?(?:error|refused|lost)/i,
  /other side closed/i,
  /fetch failed/i,
  /upstream.?connect/i,
  /reset before headers/i,
  /socket hang up/i,
  /ended without/i,
  /http2 request did not get a response/i,
  /timed? out|timeout/i,
  /terminated/i,
];

export function createPiSdkAgentManager(opts: PiSdkManagerOptions): AgentManager {
  const log = opts.logger.child("sdk-rpc-manager");
  const configuredProviders = new Set(
    (opts.apiProviders?.length ? opts.apiProviders : [opts.provider]).map(normalizeProvider),
  );
  configuredProviders.add(normalizeProvider(opts.provider));
  let providerId = normalizeProvider(opts.provider);
  let modelId = opts.modelId;
  let rpcClient: PiClient | null = null;
  let startPromise: Promise<PiClient> | null = null;
  let lastStartFailure: { at: number; error: Error } | null = null;
  let failedStartAttempts = 0;
  let startDisabledError: Error | null = null;
  let isStreaming = false;
  let currentMsgId: string | null = null;
  const eventListeners = new Set<AgentEventListener>();
  const stderrListeners = new Set<AgentStderrListener>();

  async function ensureStarted(): Promise<PiClient> {
    if (rpcClient?.isRunning) return rpcClient;
    if (startPromise) return startPromise;
    const retryError = getStartRetryError();
    if (retryError) throw retryError;

    const apiKeys = await getConfiguredApiKeys([...configuredProviders], opts.getApiKey);
    const args = [
      ...(!opts.ephemeral && opts.sessionDir ? ["--session-dir", opts.sessionDir] : []),
      ...(opts.ephemeral ? ["--no-session"] : []),
      ...(opts.additionalSkillPaths?.flatMap((p) => ["--skill", p]) ?? []),
      ...(opts.defaultConfigPath ? ["--append-system-prompt", opts.defaultConfigPath] : []),
    ];
    const env = buildBootstrapEnv({
      provider: providerId,
      modelId,
      apiKeys,
      packageDir: dirname(opts.bootstrapPath),
      sessionDir: opts.sessionDir,
      ollamaBaseUrl: opts.ollamaBaseUrl,
    });

    const client = createPiClient({
      binaryPath: process.execPath,
      commandPrefixArgs: [opts.bootstrapPath],
      cwd: opts.cwd,
      args,
      env,
      logger: log.child("client"),
    });
    rpcClient = client;
    startPromise = (async () => {
      try {
        await client.start();
        log.info("started", { provider: providerId, modelId });
        lastStartFailure = null;
        failedStartAttempts = 0;
        startDisabledError = null;
        return client;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        rpcClient = null;
        startPromise = null;
        failedStartAttempts += 1;
        if (failedStartAttempts >= START_MAX_ATTEMPTS) {
          lastStartFailure = null;
          startDisabledError = createStartDisabledError("Pi SDK", error);
          log.error("start disabled after repeated failures", startDisabledError, {
            attempts: failedStartAttempts,
          });
          throw startDisabledError;
        }
        lastStartFailure = { at: Date.now(), error };
        log.error("start failed", error, { attempts: failedStartAttempts });
        throw error;
      }
    })();

    client.onExit((info: { code: number | null; signal: NodeJS.Signals | null }) => {
      log.info("process exited", { code: info.code, signal: info.signal });
      rpcClient = null;
      startPromise = null;
      isStreaming = false;
      currentMsgId = null;
    });
    client.onEvent(normalizeAndEmit);
    client.onStderr((chunk: string) => {
      for (const listener of stderrListeners) {
        try {
          listener(chunk);
        } catch {
          /* ignore */
        }
      }
    });

    return startPromise;
  }

  function getStartRetryError(): Error | null {
    if (startDisabledError) return startDisabledError;
    if (!lastStartFailure) return null;
    const age = Date.now() - lastStartFailure.at;
    if (age >= START_RETRY_COOLDOWN_MS) {
      lastStartFailure = null;
      return null;
    }
    return new Error(
      `Pi SDK start retry suppressed for ${START_RETRY_COOLDOWN_MS - age}ms after previous failure: ${lastStartFailure.error.message}`,
    );
  }

  function emitEvent(evt: AgentEvent): void {
    for (const listener of eventListeners) {
      try {
        listener(evt);
      } catch (err) {
        log.error("event listener threw", err instanceof Error ? err : undefined);
      }
    }
  }

  function normalizeAndEmit(raw: PiEvent): void {
    const evt = normalizePiEvent(raw);
    log.info("rpc event", {
      ...summarizePiEvent(raw),
      normalizedType: evt?.type ?? "ignored",
      ...summarizeAgentEvent(evt),
    });
    if (evt) emitEvent(evt);
  }

  async function request<T>(
    client: PiClient,
    command: Parameters<PiClient["request"]>[0],
  ): Promise<T> {
    const commandType = typeof command.type === "string" ? command.type : "unknown";
    log.info("rpc call", summarizeRpcCommand(command));
    try {
      const response = await client.request<T>(command);
      log.info("rpc response", {
        command: commandType,
        ...summarizeRpcResponse(commandType, response),
      });
      return response;
    } catch (err) {
      log.error("rpc response failed", err instanceof Error ? err : undefined, {
        command: commandType,
      });
      throw err;
    }
  }

  async function send(message: string): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "prompt", message: rewriteAfxCommandPrompt(message) });
  }

  async function abort(): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "abort" });
  }

  async function steer(message: string): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "steer", message: rewriteAfxCommandPrompt(message) });
  }

  async function followUp(message: string): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "follow_up", message: rewriteAfxCommandPrompt(message) });
  }

  async function newSession(): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "new_session" });
  }

  async function getStatus(): Promise<AgentStatus> {
    try {
      await ensureStarted();
    } catch (err) {
      return startFailureStatus(err);
    }
    const client = rpcClient;
    if (!client?.isRunning) return { running: false, isStreaming };
    try {
      const state = await request<RpcSessionStateLike | null>(client, { type: "get_state" });
      const status = mapPiStateToStatus(state, client.isRunning, isStreaming);
      return tagStatus(status, providerId, modelId);
    } catch {
      return {
        running: client.isRunning,
        isStreaming,
        model: tagModel(minimalModel(providerId, modelId)),
      };
    }
  }

  async function getAvailableModels(): Promise<AgentModel[]> {
    try {
      const client = await ensureStarted();
      const response = await request<{ models?: unknown } | unknown[]>(client, {
        type: "get_available_models",
      });
      const models = Array.isArray(response)
        ? response
        : Array.isArray(response?.models)
          ? response.models
          : [];
      const filtered = models
        .map(normalizeModel)
        .filter((model: AgentModel | null): model is AgentModel => model !== null)
        .filter((model: AgentModel) => configuredProviders.has(normalizeProvider(model.provider)))
        .map(tagModel);
      return filtered.length > 0 ? filtered : fallbackConfiguredModels();
    } catch (err) {
      log.warn("getAvailableModels using configured provider fallback", {
        error: err instanceof Error ? err.message : String(err),
      });
      return fallbackConfiguredModels();
    }
  }

  async function setModel(target: { provider: string; modelId: string }): Promise<AgentModel> {
    const targetProvider = normalizeProvider(target.provider);
    if (!configuredProviders.has(targetProvider)) {
      throw new Error(`API Providers runtime is not configured for provider "${target.provider}"`);
    }
    providerId = targetProvider;
    modelId = target.modelId;
    const client = await ensureStarted();
    const response = await request<unknown>(client, {
      type: "set_model",
      provider: providerId,
      modelId: target.modelId,
    });
    const direct = normalizeModel(response);
    if (direct) return tagModel(direct);

    const status = await request<{ model?: unknown } | null>(client, { type: "get_state" });
    const model = normalizeModel(status?.model);
    return tagModel(model ?? minimalModel(providerId, target.modelId));
  }

  async function switchSession(sessionPath: string): Promise<{ cancelled: boolean }> {
    const client = await ensureStarted();
    const result = await request<{ cancelled?: unknown } | null>(client, {
      type: "switch_session",
      sessionPath,
    });
    return { cancelled: result?.cancelled === true };
  }

  async function getCommands(): Promise<AgentCommand[]> {
    const client = await ensureStarted();
    const response = await request<{ commands?: unknown } | unknown[]>(client, {
      type: "get_commands",
    });
    const commands = Array.isArray(response)
      ? response
      : Array.isArray(response?.commands)
        ? response.commands
        : [];
    return commands
      .map(normalizeCommand)
      .filter((cmd: AgentCommand | null): cmd is AgentCommand => cmd !== null);
  }

  async function getUsage(): Promise<AgentUsageStats | null> {
    try {
      const client = await ensureStarted();
      const stats = await request<{
        tokens?: {
          input?: number;
          output?: number;
          cacheRead?: number;
          cacheWrite?: number;
          total?: number;
        };
        cost?: number;
        contextUsage?: AgentUsageStats["contextUsage"];
      }>(client, { type: "get_session_stats" });
      return {
        tokens: {
          input: stats.tokens?.input ?? 0,
          output: stats.tokens?.output ?? 0,
          cacheRead: stats.tokens?.cacheRead ?? 0,
          cacheWrite: stats.tokens?.cacheWrite ?? 0,
          total: stats.tokens?.total ?? 0,
        },
        cost: stats.cost ?? 0,
        contextUsage: stats.contextUsage,
      };
    } catch (err) {
      log.error("get_session_stats failed", err instanceof Error ? err : undefined);
      return null;
    }
  }

  async function compact(customInstructions?: string): Promise<CompactionResult> {
    const client = await ensureStarted();
    const response = await request<{
      summary?: unknown;
      firstKeptEntryId?: unknown;
      tokensBefore?: unknown;
    } | null>(client, {
      type: "compact",
      ...(customInstructions ? { customInstructions } : {}),
    });
    return {
      summary: typeof response?.summary === "string" ? response.summary : "",
      firstKeptEntryId:
        typeof response?.firstKeptEntryId === "string" ? response.firstKeptEntryId : "",
      tokensBefore: typeof response?.tokensBefore === "number" ? response.tokensBefore : 0,
    };
  }

  async function setThinkingLevel(level: ThinkingLevel): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "set_thinking_level", level });
  }

  async function setSteeringMode(mode: QueueMode): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "set_steering_mode", mode });
  }

  async function setFollowUpMode(mode: QueueMode): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "set_follow_up_mode", mode });
  }

  async function setAutoCompaction(enabled: boolean): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "set_auto_compaction", enabled });
  }

  async function setAutoRetry(enabled: boolean): Promise<void> {
    const client = await ensureStarted();
    await request(client, { type: "set_auto_retry", enabled });
  }

  function respondToUiRequest(response: AgentUiResponse): Promise<void> {
    const client = rpcClient;
    if (!client?.isRunning) throw new Error("PiClient not started");
    client.send({ type: "extension_ui_response", ...response });
    return Promise.resolve();
  }

  function onEvent(listener: AgentEventListener): Disposable {
    eventListeners.add(listener);
    return { dispose: () => eventListeners.delete(listener) };
  }

  function onStderr(listener: AgentStderrListener): Disposable {
    stderrListeners.add(listener);
    return { dispose: () => stderrListeners.delete(listener) };
  }

  async function stop(): Promise<void> {
    const client = rpcClient;
    rpcClient = null;
    startPromise = null;
    lastStartFailure = null;
    failedStartAttempts = 0;
    startDisabledError = null;
    isStreaming = false;
    currentMsgId = null;
    if (client) await client.dispose();
  }

  function startFailureStatus(error: unknown): AgentStatus {
    return {
      running: false,
      isStreaming: false,
      info: formatError(error),
      restartRequired: startDisabledError !== null,
    };
  }

  async function dispose(): Promise<void> {
    eventListeners.clear();
    stderrListeners.clear();
    await stop();
  }

  function tagModel(model: AgentModel): AgentModel {
    return { ...model, source: "api-provider", instanceLabel: opts.provider };
  }

  function fallbackConfiguredModels(): AgentModel[] {
    return [...configuredProviders]
      .map((provider) => {
        const fallbackId =
          provider === providerId && modelId ? modelId : getDefaultApiProviderModel(provider);
        return fallbackId ? tagModel(minimalModel(provider, fallbackId)) : null;
      })
      .filter((model: AgentModel | null): model is AgentModel => model !== null);
  }

  function tagStatus(
    status: AgentStatus,
    fallbackProvider: string,
    fallbackModelId: string,
  ): AgentStatus {
    return {
      ...status,
      model: status.model
        ? { ...status.model, source: "api-provider", instanceLabel: opts.provider }
        : tagModel(minimalModel(fallbackProvider, fallbackModelId)),
    };
  }

  return {
    send,
    abort,
    newSession,
    getStatus,
    getUsage,
    getAvailableModels,
    setModel,
    switchSession,
    getCommands,
    getStderr: () => rpcClient?.getStderr() ?? "",
    compact,
    steer,
    followUp,
    setThinkingLevel,
    setSteeringMode,
    setFollowUpMode,
    setAutoCompaction,
    setAutoRetry,
    respondToUiRequest,
    onEvent,
    onStderr,
    stop,
    dispose,
  };

  function normalizePiEvent(raw: PiEvent): AgentEvent | null {
    switch (raw.type) {
      case "agent_start":
        isStreaming = true;
        currentMsgId = null;
        return { type: "agent_start" };
      case "agent_end":
        isStreaming = false;
        currentMsgId = null;
        return { type: "agent_end" };
      case "message_start":
        return normalizeMessageStart(raw);
      case "message_end": {
        const message = (raw.message ?? {}) as {
          role?: string;
          stopReason?: string;
          errorMessage?: string;
        };
        if (message.role !== "assistant" && message.role !== "user") return null;
        if (message.role === "assistant") currentMsgId = null;
        if (message.role === "assistant" && message.stopReason === "error") {
          const messageText =
            typeof message.errorMessage === "string" && message.errorMessage.length > 0
              ? message.errorMessage
              : "The provider returned an error.";
          if (isContextOverflowError(messageText)) {
            return { type: "context_overflow", message: messageText };
          }
          if (isRetryableProviderError(messageText)) {
            return { type: "retryable_error", message: messageText };
          }
          return {
            type: "error",
            message: messageText,
          };
        }
        return {
          type: "message_end",
          role: message.role,
          stopReason: typeof message.stopReason === "string" ? message.stopReason : undefined,
        };
      }
      case "message_update":
        return normalizeMessageUpdate(raw);
      case "tool_execution_start": {
        const toolCallId = typeof raw.toolCallId === "string" ? raw.toolCallId : "";
        if (!toolCallId) return null;
        return {
          type: "tool_start",
          toolCallId,
          toolName: typeof raw.toolName === "string" ? raw.toolName : "tool",
          args: raw.args as Record<string, unknown> | undefined,
        };
      }
      case "tool_execution_end": {
        const toolCallId = typeof raw.toolCallId === "string" ? raw.toolCallId : "";
        if (!toolCallId) return null;
        return { type: "tool_end", toolCallId, ok: !raw.isError, result: raw.result };
      }
      case "queue_update": {
        const steeringCount = Array.isArray(raw.steering) ? raw.steering.length : 0;
        const followUpCount = Array.isArray(raw.followUp) ? raw.followUp.length : 0;
        return {
          type: "queue_update",
          steeringCount,
          followUpCount,
          pendingMessageCount: steeringCount + followUpCount,
        };
      }
      case "compaction_start":
        return {
          type: "compaction_start",
          reason: typeof raw.reason === "string" ? raw.reason : "manual",
        };
      case "compaction_end":
        return {
          type: "compaction_end",
          reason: typeof raw.reason === "string" ? raw.reason : "manual",
          result: normalizeCompactionResult(raw.result),
          aborted: raw.aborted === true,
          willRetry: raw.willRetry === true,
          errorMessage: typeof raw.errorMessage === "string" ? raw.errorMessage : undefined,
        };
      case "auto_retry_start":
        return {
          type: "auto_retry_start",
          attempt: toFiniteNumber(raw.attempt, 0),
          maxAttempts: toFiniteNumber(raw.maxAttempts, 0),
          delayMs: toFiniteNumber(raw.delayMs, 0),
          errorMessage:
            typeof raw.errorMessage === "string" ? raw.errorMessage : "The provider failed.",
        };
      case "auto_retry_end":
        return {
          type: "auto_retry_end",
          success: raw.success === true,
          attempt: toFiniteNumber(raw.attempt, 0),
          finalError: typeof raw.finalError === "string" ? raw.finalError : undefined,
        };
      case "error":
      case "agent_error":
        return { type: "error", message: extractMessage(raw) ?? `pi emitted ${raw.type}` };
      case "extension_ui_request":
        return normalizeUiRequest(raw);
      default:
        return null;
    }
  }

  function normalizeMessageStart(raw: PiEvent): AgentEvent | null {
    const message = (raw.message ?? {}) as {
      role?: string;
      content?: Array<{ type?: string; text?: string }>;
      stopReason?: string;
      errorMessage?: string;
    };
    if (message.role === "user") {
      return { type: "message_start", role: "user", content: textFromParts(message.content) };
    }
    if (message.role !== "assistant") return null;
    if (message.stopReason === "error" && typeof message.errorMessage === "string") {
      if (isContextOverflowError(message.errorMessage)) {
        return { type: "context_overflow", message: message.errorMessage };
      }
      if (isRetryableProviderError(message.errorMessage)) {
        return { type: "retryable_error", message: message.errorMessage };
      }
      return { type: "message_start", role: "assistant", errorMessage: message.errorMessage };
    }
    const content = textFromParts(message.content);
    return content ? { type: "message_start", role: "assistant", content } : null;
  }

  function normalizeMessageUpdate(raw: PiEvent): AgentEvent | null {
    const delta = raw.assistantMessageEvent as
      | { type: string; delta?: string; message?: string; error?: string }
      | undefined;
    if (!delta) return null;
    if (delta.type === "text_start" || delta.type === "thinking_start") {
      currentMsgId ??= generateId();
      return null;
    }
    if (delta.type === "text_delta" || delta.type === "thinking_delta") {
      if (!delta.delta) return null;
      currentMsgId ??= generateId();
      return { type: delta.type, id: currentMsgId, delta: delta.delta };
    }
    if (delta.type === "error") {
      return { type: "error", message: delta.message ?? delta.error ?? "pi message_update.error" };
    }
    return null;
  }

  function normalizeCompactionResult(value: unknown): CompactionResult | undefined {
    if (!value || typeof value !== "object") return undefined;
    const raw = value as {
      summary?: unknown;
      firstKeptEntryId?: unknown;
      tokensBefore?: unknown;
    };
    return {
      summary: typeof raw.summary === "string" ? raw.summary : "",
      firstKeptEntryId: typeof raw.firstKeptEntryId === "string" ? raw.firstKeptEntryId : "",
      tokensBefore: typeof raw.tokensBefore === "number" ? raw.tokensBefore : 0,
    };
  }

  function isContextOverflowError(message: string): boolean {
    return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message));
  }

  function isRetryableProviderError(message: string): boolean {
    if (isContextOverflowError(message)) return false;
    return RETRYABLE_PROVIDER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  }

  function toFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export function buildBootstrapEnv(input: {
  provider: string;
  modelId: string;
  apiKeys?: Record<string, string>;
  packageDir?: string;
  sessionDir?: string;
  ollamaBaseUrl?: string;
}): Record<string, string> {
  return {
    AFX_PROVIDER: input.provider,
    AFX_MODEL_ID: input.modelId,
    ...Object.fromEntries(
      Object.entries(input.apiKeys ?? {}).flatMap(([provider, apiKey]) =>
        providerApiKeyEnvEntries(provider, apiKey),
      ),
    ),
    ...(input.packageDir ? { PI_PACKAGE_DIR: input.packageDir } : {}),
    ...(input.sessionDir ? { AFX_SESSION_DIR: input.sessionDir } : {}),
    ...(input.sessionDir ? { PI_CODING_AGENT_DIR: input.sessionDir } : {}),
    ...(input.ollamaBaseUrl ? { AFX_OLLAMA_BASE_URL: input.ollamaBaseUrl } : {}),
  };
}

export function providerEnvKey(provider: string): string {
  return provider.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
}

function providerApiKeyEnvEntries(provider: string, apiKey: string): Array<[string, string]> {
  const providerKey = providerEnvKey(provider);
  const aliases =
    PROVIDER_API_KEY_ENV_ALIASES[
      normalizeProvider(provider) as keyof typeof PROVIDER_API_KEY_ENV_ALIASES
    ] ?? [];
  return [...new Set([`AFX_API_KEY_${providerKey}`, `${providerKey}_API_KEY`, ...aliases])].map(
    (key) => [key, apiKey],
  );
}

export function rewriteAfxCommandPrompt(message: string): string {
  return message.replace(/^(\s*)\/afx-(?=\S)/, "$1/skill:afx-");
}

function summarizeRpcCommand(command: Parameters<PiClient["request"]>[0]): Record<string, unknown> {
  const raw = command as Record<string, unknown>;
  const message = typeof raw["message"] === "string" ? raw["message"] : undefined;
  const summary: Record<string, unknown> = {
    command: typeof command.type === "string" ? command.type : "unknown",
  };
  addStringField(summary, "provider", raw["provider"]);
  addStringField(summary, "modelId", raw["modelId"]);
  addStringField(summary, "sessionPath", raw["sessionPath"]);
  addStringField(summary, "level", raw["level"]);
  addStringField(summary, "mode", raw["mode"]);
  if (typeof raw["enabled"] === "boolean") summary["enabled"] = raw["enabled"];
  if (message !== undefined) {
    summary["messageLength"] = message.length;
    summary["messagePreview"] = previewText(message);
  }
  if (typeof raw["customInstructions"] === "string") {
    summary["customInstructionsLength"] = raw["customInstructions"].length;
    summary["customInstructionsPreview"] = previewText(raw["customInstructions"]);
  }
  return summary;
}

function summarizeRpcResponse(command: string, response: unknown): Record<string, unknown> {
  if (response === null || response === undefined) return { responseKind: String(response) };
  if (Array.isArray(response)) return { responseKind: "array", itemCount: response.length };
  if (typeof response === "string") {
    return { responseKind: "string", responsePreview: previewText(response) };
  }
  if (
    typeof response === "number" ||
    typeof response === "boolean" ||
    typeof response === "bigint"
  ) {
    return { responseKind: typeof response, responseValue: response };
  }
  if (typeof response !== "object") {
    return { responseKind: typeof response };
  }

  const raw = response as Record<string, unknown>;
  const summary: Record<string, unknown> = { responseKind: "object" };
  if (Array.isArray(raw["models"])) summary["modelsCount"] = raw["models"].length;
  if (Array.isArray(raw["commands"])) summary["commandsCount"] = raw["commands"].length;
  if (typeof raw["cancelled"] === "boolean") summary["cancelled"] = raw["cancelled"];
  if (typeof raw["summary"] === "string") {
    summary["summaryLength"] = raw["summary"].length;
    summary["summaryPreview"] = previewText(raw["summary"]);
  }
  if (typeof raw["tokensBefore"] === "number") summary["tokensBefore"] = raw["tokensBefore"];

  const model = normalizeModel(command === "set_model" ? response : raw["model"]);
  if (model) {
    summary["provider"] = model.provider;
    summary["modelId"] = model.id;
    summary["modelName"] = model.name;
  }
  addStringField(summary, "sessionId", raw["sessionId"]);
  addStringField(summary, "sessionName", raw["sessionName"]);
  if (typeof raw["messageCount"] === "number") summary["messageCount"] = raw["messageCount"];
  if (typeof raw["pendingMessageCount"] === "number") {
    summary["pendingMessageCount"] = raw["pendingMessageCount"];
  }
  return summary;
}

function summarizePiEvent(raw: PiEvent): Record<string, unknown> {
  const summary: Record<string, unknown> = { rawType: raw.type };
  const message = raw.message;
  if (typeof message === "string") {
    summary["messageLength"] = message.length;
    summary["messagePreview"] = previewText(message);
  } else if (message && typeof message === "object") {
    const msg = message as {
      role?: unknown;
      stopReason?: unknown;
      errorMessage?: unknown;
      content?: unknown;
    };
    addStringField(summary, "role", msg.role);
    addStringField(summary, "stopReason", msg.stopReason);
    addStringField(summary, "errorMessage", msg.errorMessage);
    const text = textFromParts(msg.content);
    if (text) {
      summary["contentLength"] = text.length;
      summary["contentPreview"] = previewText(text);
    }
  }

  const assistantMessageEvent = raw.assistantMessageEvent;
  if (assistantMessageEvent && typeof assistantMessageEvent === "object") {
    const evt = assistantMessageEvent as {
      type?: unknown;
      delta?: unknown;
      message?: unknown;
      error?: unknown;
    };
    addStringField(summary, "assistantEventType", evt.type);
    if (typeof evt.delta === "string") {
      summary["deltaLength"] = evt.delta.length;
      summary["deltaPreview"] = previewText(evt.delta);
    }
    addStringField(summary, "assistantMessage", evt.message);
    addStringField(summary, "assistantError", evt.error);
  }

  addStringField(summary, "toolCallId", raw.toolCallId);
  addStringField(summary, "toolName", raw.toolName);
  if (typeof raw.isError === "boolean") summary["isError"] = raw.isError;
  if (Array.isArray(raw.steering)) summary["steeringCount"] = raw.steering.length;
  if (Array.isArray(raw.followUp)) summary["followUpCount"] = raw.followUp.length;
  addStringField(summary, "reason", raw.reason);
  if (typeof raw.attempt === "number") summary["attempt"] = raw.attempt;
  if (typeof raw.maxAttempts === "number") summary["maxAttempts"] = raw.maxAttempts;
  if (typeof raw.delayMs === "number") summary["delayMs"] = raw.delayMs;
  if (typeof raw.success === "boolean") summary["success"] = raw.success;
  addStringField(summary, "finalError", raw.finalError);
  if (typeof raw.aborted === "boolean") summary["aborted"] = raw.aborted;
  if (typeof raw.willRetry === "boolean") summary["willRetry"] = raw.willRetry;
  addStringField(summary, "errorMessage", raw.errorMessage);
  addStringField(summary, "uiMethod", raw.method);
  addStringField(summary, "error", raw.error);
  return summary;
}

function summarizeAgentEvent(evt: AgentEvent | null): Record<string, unknown> {
  if (!evt) return {};
  const summary: Record<string, unknown> = {};
  switch (evt.type) {
    case "message_start":
      summary["role"] = evt.role;
      addStringField(summary, "errorMessage", evt.errorMessage);
      if (evt.content) {
        summary["contentLength"] = evt.content.length;
        summary["contentPreview"] = previewText(evt.content);
      }
      return summary;
    case "message_end":
      summary["role"] = evt.role;
      addStringField(summary, "stopReason", evt.stopReason);
      return summary;
    case "text_delta":
    case "thinking_delta":
      summary["id"] = evt.id;
      summary["deltaLength"] = evt.delta.length;
      summary["deltaPreview"] = previewText(evt.delta);
      return summary;
    case "tool_start":
      summary["toolCallId"] = evt.toolCallId;
      summary["toolName"] = evt.toolName;
      return summary;
    case "tool_end":
      summary["toolCallId"] = evt.toolCallId;
      summary["ok"] = evt.ok;
      return summary;
    case "queue_update":
      summary["steeringCount"] = evt.steeringCount;
      summary["followUpCount"] = evt.followUpCount;
      summary["pendingMessageCount"] = evt.pendingMessageCount;
      return summary;
    case "context_overflow":
      summary["error"] = evt.message;
      return summary;
    case "retryable_error":
      summary["error"] = evt.message;
      return summary;
    case "compaction_start":
      summary["reason"] = evt.reason;
      return summary;
    case "compaction_end":
      summary["reason"] = evt.reason;
      summary["aborted"] = evt.aborted;
      summary["willRetry"] = evt.willRetry;
      addStringField(summary, "errorMessage", evt.errorMessage);
      if (evt.result) {
        summary["summaryLength"] = evt.result.summary.length;
        summary["summaryPreview"] = previewText(evt.result.summary);
        summary["tokensBefore"] = evt.result.tokensBefore;
      }
      return summary;
    case "auto_retry_start":
      summary["attempt"] = evt.attempt;
      summary["maxAttempts"] = evt.maxAttempts;
      summary["delayMs"] = evt.delayMs;
      summary["error"] = evt.errorMessage;
      return summary;
    case "auto_retry_end":
      summary["success"] = evt.success;
      summary["attempt"] = evt.attempt;
      addStringField(summary, "finalError", evt.finalError);
      return summary;
    case "ui_request":
      summary["uiMethod"] = evt.method;
      summary["id"] = evt.id;
      return summary;
    case "error":
      summary["error"] = evt.message;
      return summary;
    case "agent_start":
    case "agent_end":
      return summary;
    default: {
      const _exhaustive: never = evt;
      return _exhaustive;
    }
  }
}

function addStringField(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    target[key] = previewText(value);
  }
}

function previewText(value: string, maxLength = 240): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function normalizeUiRequest(raw: PiEvent): AgentEvent | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  const method = typeof raw.method === "string" ? raw.method : "";
  if (!id || !method) return null;
  const timeout = typeof raw.timeout === "number" ? raw.timeout : undefined;
  switch (method) {
    case "select": {
      const options = Array.isArray(raw.options)
        ? raw.options.filter((option: unknown): option is string => typeof option === "string")
        : [];
      return {
        type: "ui_request",
        id,
        method,
        title: typeof raw.title === "string" ? raw.title : "Select",
        options,
        timeout,
      };
    }
    case "confirm":
      return {
        type: "ui_request",
        id,
        method,
        title: typeof raw.title === "string" ? raw.title : "Confirm",
        message: typeof raw.message === "string" ? raw.message : "",
        timeout,
      };
    case "input":
      return {
        type: "ui_request",
        id,
        method,
        title: typeof raw.title === "string" ? raw.title : "Input",
        placeholder: typeof raw.placeholder === "string" ? raw.placeholder : undefined,
        timeout,
      };
    case "editor":
      return {
        type: "ui_request",
        id,
        method,
        title: typeof raw.title === "string" ? raw.title : "Editor",
        prefill: typeof raw.prefill === "string" ? raw.prefill : undefined,
      };
    case "notify":
      return {
        type: "ui_request",
        id,
        method,
        message: typeof raw.message === "string" ? raw.message : "",
        notifyType:
          raw.notifyType === "info" || raw.notifyType === "warning" || raw.notifyType === "error"
            ? raw.notifyType
            : undefined,
      };
    case "setStatus": {
      const statusKey = typeof raw.statusKey === "string" ? raw.statusKey : "";
      return statusKey
        ? {
            type: "ui_request",
            id,
            method,
            statusKey,
            statusText: typeof raw.statusText === "string" ? raw.statusText : undefined,
          }
        : null;
    }
    case "setWidget": {
      const widgetKey = typeof raw.widgetKey === "string" ? raw.widgetKey : "";
      const widgetLines = Array.isArray(raw.widgetLines)
        ? raw.widgetLines.filter((line: unknown): line is string => typeof line === "string")
        : undefined;
      const widgetPlacement =
        raw.widgetPlacement === "aboveEditor" || raw.widgetPlacement === "belowEditor"
          ? raw.widgetPlacement
          : undefined;
      return widgetKey
        ? { type: "ui_request", id, method, widgetKey, widgetLines, widgetPlacement }
        : null;
    }
    case "setTitle":
      return typeof raw.title === "string" && raw.title
        ? { type: "ui_request", id, method, title: raw.title }
        : null;
    case "set_editor_text":
      return { type: "ui_request", id, method, text: typeof raw.text === "string" ? raw.text : "" };
    default:
      return null;
  }
}

interface RpcSessionStateLike {
  model?: { provider?: unknown; id?: unknown; name?: unknown; reasoning?: unknown } | null;
  thinkingLevel?: unknown;
  isCompacting?: unknown;
  steeringMode?: unknown;
  followUpMode?: unknown;
  autoCompactionEnabled?: unknown;
  autoRetryEnabled?: unknown;
  sessionId?: unknown;
  sessionFile?: unknown;
  sessionName?: unknown;
  messageCount?: unknown;
  pendingMessageCount?: unknown;
}

const THINKING_LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh"];
const QUEUE_MODES: readonly QueueMode[] = ["all", "one-at-a-time"];

function mapPiStateToStatus(
  state: RpcSessionStateLike | null | undefined,
  running: boolean,
  isStreaming: boolean,
): AgentStatus {
  if (!state) return { running, isStreaming };
  const model = normalizeModel(state.model);
  return {
    running,
    isStreaming,
    model: model
      ? { provider: model.provider, id: model.id, name: model.name, reasoning: model.reasoning }
      : undefined,
    thinkingLevel: asEnum(state.thinkingLevel, THINKING_LEVELS),
    isCompacting: typeof state.isCompacting === "boolean" ? state.isCompacting : undefined,
    steeringMode: asEnum(state.steeringMode, QUEUE_MODES),
    followUpMode: asEnum(state.followUpMode, QUEUE_MODES),
    autoCompactionEnabled:
      typeof state.autoCompactionEnabled === "boolean" ? state.autoCompactionEnabled : undefined,
    autoRetryEnabled:
      typeof state.autoRetryEnabled === "boolean" ? state.autoRetryEnabled : undefined,
    sessionId: typeof state.sessionId === "string" ? state.sessionId : undefined,
    sessionFile: typeof state.sessionFile === "string" ? state.sessionFile : undefined,
    sessionName: typeof state.sessionName === "string" ? state.sessionName : undefined,
    messageCount: typeof state.messageCount === "number" ? state.messageCount : undefined,
    pendingMessageCount:
      typeof state.pendingMessageCount === "number" ? state.pendingMessageCount : undefined,
  };
}

function normalizeModel(value: unknown): AgentModel | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as {
    provider?: unknown;
    id?: unknown;
    name?: unknown;
    reasoning?: unknown;
    contextWindow?: unknown;
    maxTokens?: unknown;
    cost?: unknown;
  };
  if (typeof raw.provider !== "string" || typeof raw.id !== "string") return null;
  return {
    provider: raw.provider,
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : raw.id,
    reasoning: typeof raw.reasoning === "boolean" ? raw.reasoning : false,
    contextWindow: typeof raw.contextWindow === "number" ? raw.contextWindow : 0,
    maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : 0,
    cost: normalizeModelCost(raw.cost),
  };
}

function normalizeModelCost(value: unknown): AgentModel["cost"] {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    input?: unknown;
    output?: unknown;
    cacheRead?: unknown;
    cacheWrite?: unknown;
  };
  return {
    input: typeof raw.input === "number" ? raw.input : 0,
    output: typeof raw.output === "number" ? raw.output : 0,
    cacheRead: typeof raw.cacheRead === "number" ? raw.cacheRead : 0,
    cacheWrite: typeof raw.cacheWrite === "number" ? raw.cacheWrite : 0,
  };
}

function normalizeCommand(value: unknown): AgentCommand | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { name?: unknown; description?: unknown; source?: unknown };
  if (typeof raw.name !== "string") return null;
  if (raw.source !== "extension" && raw.source !== "prompt" && raw.source !== "skill") return null;
  return {
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : undefined,
    source: raw.source,
  };
}

function minimalModel(provider: string, id: string): AgentModel {
  return { provider, id, name: id, reasoning: false, contextWindow: 0, maxTokens: 0 };
}

function textFromParts(parts: unknown): string {
  return Array.isArray(parts)
    ? parts
        .filter(isTextPart)
        .map((part) => part.text)
        .join("")
    : "";
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
  if (!part || typeof part !== "object") return false;
  const raw = part as { type?: unknown; text?: unknown };
  return raw.type === "text" && typeof raw.text === "string";
}

async function getConfiguredApiKeys(
  providers: readonly string[],
  getApiKey: PiSdkManagerOptions["getApiKey"],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    providers.map(async (provider) => {
      const apiKey = await getApiKey(provider);
      return apiKey ? ([provider, apiKey] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => !!entry));
}

function extractMessage(raw: PiEvent): string | undefined {
  if (typeof raw.message === "string" && raw.message.length > 0) return raw.message;
  if (typeof raw.error === "string" && raw.error.length > 0) return raw.error;
  if (raw.error && typeof raw.error === "object") {
    const inner = (raw.error as { message?: unknown }).message;
    if (typeof inner === "string" && inner.length > 0) return inner;
  }
  return undefined;
}

function generateId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function normalizeProvider(provider: string): string {
  return provider.toLowerCase();
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function createStartDisabledError(runtimeLabel: string, lastError: Error): Error {
  return new Error(
    `${runtimeLabel} failed to start ${START_MAX_ATTEMPTS} times. Automatic retries are stopped until you restart the agent runtime. Last error: ${lastError.message}`,
  );
}
