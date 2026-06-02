/**
 * Host-side router that presents many runtime instances as one AgentManager.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1] [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-MULTIPLEX-FLOW] [DES-AGENT-LIFECYCLE]
 */
import type {
  AgentAuthMethod,
  AgentCommand,
  AgentEvent,
  AgentEventListener,
  AgentManager,
  AgentModel,
  AgentModelSelectionTarget,
  AgentSessionInfo,
  AgentStatus,
  AgentStderrListener,
  AgentTranscriptEntry,
  AgentUiResponse,
  AgentUsageStats,
  CompactionResult,
  Disposable,
  QueueMode,
  ThinkingLevel,
} from "@afx/shared";

import type { AgentInstance } from "./agent-factory";

export interface ModelAuthClassification {
  methods: readonly AgentAuthMethod[];
  activeMethod?: AgentAuthMethod;
}

export type ModelAuthClassifier = (input: {
  instance: AgentInstance;
  provider: string;
}) => Promise<ModelAuthClassification>;

export interface MultiplexedAgentManagerOptions {
  instanceId?: string;
  /**
   * Callback that returns the current `afx.rpc.enabled` setting. Decorated onto
   * every AgentStatus so chat can decide whether to surface Pi affordances.
   */
  rpcEnabledGetter?: () => boolean;
  /**
   * Host-owned classifier for composer segmentation. Only the bundled Pi SDK
   * runtime receives `authMethod` rows; external agents remain unclassified.
   *
   * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-4] [FR-6]
   * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-FLOW]
   */
  modelAuthClassifier?: ModelAuthClassifier;
}

/**
 * Flow: [AgentManager.Multiplexer]
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1] [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-ARCH]
 */
export class MultiplexedAgentManager implements AgentManager {
  private active: AgentInstance | null;
  private readonly modelCache = new Map<string, AgentModel[]>();
  private readonly rpcEnabledGetter?: () => boolean;
  private readonly modelAuthClassifier?: ModelAuthClassifier;
  /**
   * External listeners survive `replaceInstances`. Per-instance forwarders
   * (the maps below) are rebuilt against the new instance set so events from
   * the new active instance reach existing subscribers.
   */
  private readonly eventListeners = new Set<AgentEventListener>();
  private readonly stderrListeners = new Set<AgentStderrListener>();
  private readonly instanceEventSubs = new Map<AgentInstance, Disposable>();
  private readonly instanceStderrSubs = new Map<AgentInstance, Disposable>();

  constructor(
    private instances: readonly AgentInstance[],
    initial?: MultiplexedAgentManagerOptions,
  ) {
    this.active = instances.find((i) => i.id === initial?.instanceId) ?? instances[0] ?? null;
    this.rpcEnabledGetter = initial?.rpcEnabledGetter;
    this.modelAuthClassifier = initial?.modelAuthClassifier;
    this.attachInstanceForwarders(this.instances);
  }

  private attachInstanceForwarders(instances: readonly AgentInstance[]): void {
    for (const instance of instances) {
      if (!this.instanceEventSubs.has(instance)) {
        this.instanceEventSubs.set(
          instance,
          instance.manager.onEvent((event: AgentEvent) => {
            if (instance !== this.active) return;
            for (const listener of this.eventListeners) {
              try {
                listener(event);
              } catch {
                /* listener errors must not break the multiplexer */
              }
            }
          }),
        );
      }
      if (!this.instanceStderrSubs.has(instance)) {
        this.instanceStderrSubs.set(
          instance,
          instance.manager.onStderr((chunk) => {
            if (instance !== this.active) return;
            for (const listener of this.stderrListeners) {
              try {
                listener(chunk);
              } catch {
                /* swallow */
              }
            }
          }),
        );
      }
    }
  }

  private detachInstanceForwarders(instances: readonly AgentInstance[]): void {
    for (const instance of instances) {
      this.instanceEventSubs.get(instance)?.dispose();
      this.instanceEventSubs.delete(instance);
      this.instanceStderrSubs.get(instance)?.dispose();
      this.instanceStderrSubs.delete(instance);
    }
  }

  send(message: string): Promise<void> {
    return this.requireActive().manager.send(message);
  }

  abort(): Promise<void> {
    return this.requireActive().manager.abort();
  }

  newSession(): Promise<void> {
    return this.requireActive().manager.newSession();
  }

  async getStatus(): Promise<AgentStatus> {
    const rpcEnabled = this.rpcEnabledGetter?.() ?? false;
    const active = this.active;
    if (!active) {
      return {
        running: false,
        isStreaming: false,
        info: "No agent runtime configured",
        rpcEnabled,
        runtimeConfigured: false,
      };
    }
    const status = await active.manager.getStatus();
    const taggedStatus = await this.tagStatus(active, status);
    return { ...taggedStatus, rpcEnabled, runtimeConfigured: true };
  }

  getUsage(): Promise<AgentUsageStats | null> {
    return this.requireActive().manager.getUsage();
  }

  async getAvailableModels(): Promise<AgentModel[]> {
    const grouped = await Promise.all(
      this.instances.map(async (instance) => {
        let models: AgentModel[];
        try {
          models = await instance.manager.getAvailableModels();
        } catch {
          this.modelCache.set(instance.id, []);
          return [];
        }
        const tagged = await this.tagAvailableModels(instance, models);
        this.modelCache.set(instance.id, tagged);
        return tagged;
      }),
    );
    return grouped.flat();
  }

  async setModel(target: AgentModelSelectionTarget): Promise<AgentModel> {
    const next = target.instanceId
      ? this.instances.find((instance) => instance.id === target.instanceId)
      : await this.findInstanceForModel(target);
    if (!next) {
      throw new Error(`No runtime instance for model ${target.provider}:${target.modelId}`);
    }

    const previous = this.active;

    if (previous && next !== previous) {
      this.active = next;
      if (next.runtime === "pi-sdk") {
        await next.manager.setModel(target);
      }
      await this.trySwitchRuntimeSession(previous, next);
    }

    const selected = await next.manager.setModel(target);
    this.active = next;
    return this.tagModel(next, selected, target.authMethod);
  }

  async switchSession(sessionPath: string): Promise<{ cancelled: boolean }> {
    const active = this.requireActive();
    if (!active.manager.switchSession) {
      throw new Error(`Runtime ${active.label} does not support session switching`);
    }
    return active.manager.switchSession(sessionPath);
  }

  // History — delegate to the active runtime; throw when it lacks the method.
  // @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [NFR-6] [NFR-9]
  // @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API] [DES-PERSISTENT-BRIDGE]
  async listSessions(opts?: { allWorkspaces?: boolean }): Promise<AgentSessionInfo[]> {
    const active = this.requireActive();
    if (!active.manager.listSessions) {
      throw new Error(`Runtime ${active.label} does not support session history`);
    }
    return active.manager.listSessions(opts);
  }

  async getTranscript(sessionPath: string): Promise<AgentTranscriptEntry[]> {
    const active = this.requireActive();
    if (!active.manager.getTranscript) {
      throw new Error(`Runtime ${active.label} does not support session history`);
    }
    return active.manager.getTranscript(sessionPath);
  }

  async setSessionName(name: string): Promise<void> {
    const active = this.requireActive();
    if (!active.manager.setSessionName) {
      throw new Error(`Runtime ${active.label} does not support renaming sessions`);
    }
    return active.manager.setSessionName(name);
  }

  async deleteSession(sessionPath: string): Promise<void> {
    const active = this.requireActive();
    if (!active.manager.deleteSession) {
      throw new Error(`Runtime ${active.label} does not support deleting sessions`);
    }
    return active.manager.deleteSession(sessionPath);
  }

  getCommands(): Promise<AgentCommand[]> {
    return this.requireActive().manager.getCommands();
  }

  getStderr(): string {
    return this.active?.manager.getStderr() ?? "";
  }

  compact(customInstructions?: string): Promise<CompactionResult> {
    return this.requireActive().manager.compact(customInstructions);
  }

  steer(message: string): Promise<void> {
    return this.requireActive().manager.steer(message);
  }

  followUp(message: string): Promise<void> {
    return this.requireActive().manager.followUp(message);
  }

  setThinkingLevel(level: ThinkingLevel): Promise<void> {
    return this.requireActive().manager.setThinkingLevel(level);
  }

  setSteeringMode(mode: QueueMode): Promise<void> {
    return this.requireActive().manager.setSteeringMode(mode);
  }

  setFollowUpMode(mode: QueueMode): Promise<void> {
    return this.requireActive().manager.setFollowUpMode(mode);
  }

  setAutoCompaction(enabled: boolean): Promise<void> {
    return this.requireActive().manager.setAutoCompaction(enabled);
  }

  setAutoRetry(enabled: boolean): Promise<void> {
    return this.requireActive().manager.setAutoRetry(enabled);
  }

  respondToUiRequest(response: AgentUiResponse): Promise<void> {
    return this.requireActive().manager.respondToUiRequest(response);
  }

  onEvent(listener: AgentEventListener): Disposable {
    this.eventListeners.add(listener);
    return { dispose: () => this.eventListeners.delete(listener) };
  }

  onStderr(listener: AgentStderrListener): Disposable {
    this.stderrListeners.add(listener);
    return { dispose: () => this.stderrListeners.delete(listener) };
  }

  async stop(): Promise<void> {
    await Promise.all(this.instances.map((instance) => instance.manager.stop()));
  }

  async dispose(): Promise<void> {
    this.detachInstanceForwarders(this.instances);
    this.eventListeners.clear();
    this.stderrListeners.clear();
    await Promise.all(this.instances.map((instance) => instance.manager.dispose()));
    this.instances = [];
    this.active = null;
    this.modelCache.clear();
  }

  async replaceInstances(instances: readonly AgentInstance[]): Promise<void> {
    const previous = this.instances;
    const activeId = this.active?.id;
    this.detachInstanceForwarders(previous);
    this.instances = instances;
    this.active = instances.find((instance) => instance.id === activeId) ?? instances[0] ?? null;
    this.modelCache.clear();
    this.attachInstanceForwarders(this.instances);
    await Promise.all(previous.map((instance) => instance.manager.dispose()));
  }

  private async findInstanceForModel(target: {
    provider: string;
    modelId: string;
    authMethod?: AgentAuthMethod;
  }): Promise<AgentInstance | undefined> {
    if (this.modelCache.size === 0) {
      await this.getAvailableModels();
    }
    return this.instances.find((instance) =>
      this.modelCache
        .get(instance.id)
        ?.some(
          (model) =>
            model.provider === target.provider &&
            model.id === target.modelId &&
            (target.authMethod === undefined || model.authMethod === target.authMethod),
        ),
    );
  }

  private async trySwitchRuntimeSession(
    previous: AgentInstance,
    next: AgentInstance,
  ): Promise<void> {
    try {
      const previousStatus = await previous.manager.getStatus();
      const sessionFile = previousStatus.sessionFile;
      if (!sessionFile || !next.manager.switchSession) return;
      const result = await next.manager.switchSession(sessionFile);
      if (result.cancelled) return;
    } catch {
      return;
    }
  }

  private async tagAvailableModels(
    instance: AgentInstance,
    models: readonly AgentModel[],
  ): Promise<AgentModel[]> {
    const tagged: AgentModel[] = [];
    for (const model of models) {
      const base = this.tagModel(instance, model);
      if (instance.runtime !== "pi-sdk") {
        tagged.push(base);
        continue;
      }
      const classification = await this.classifyProvider(instance, model.provider);
      const methods: readonly AgentAuthMethod[] =
        classification.methods.length > 0 ? classification.methods : ["api-key"];
      for (const method of methods) {
        tagged.push({ ...base, authMethod: method });
      }
    }
    return tagged;
  }

  private tagModel(
    instance: AgentInstance,
    model: AgentModel,
    authMethod?: AgentAuthMethod,
  ): AgentModel {
    const tagged: AgentModel = {
      ...model,
      source: instance.runtime === "pi" ? "external-agent" : "api-provider",
      instanceId: instance.id,
      instanceLabel: instance.label,
    };
    if (instance.runtime === "pi-sdk") {
      const method = authMethod ?? model.authMethod;
      if (method) tagged.authMethod = method;
    } else {
      delete tagged.authMethod;
    }
    return tagged;
  }

  private async tagStatus(instance: AgentInstance, status: AgentStatus): Promise<AgentStatus> {
    if (!status.model) return status;
    const authMethod =
      instance.runtime === "pi-sdk"
        ? (status.model.authMethod ??
          (await this.getActiveAuthMethod(instance, status.model.provider)))
        : undefined;
    return {
      ...status,
      model: {
        ...status.model,
        source: instance.runtime === "pi" ? "external-agent" : "api-provider",
        instanceId: instance.id,
        instanceLabel: instance.label,
        ...(authMethod ? { authMethod } : {}),
      },
    };
  }

  private async getActiveAuthMethod(
    instance: AgentInstance,
    provider: string,
  ): Promise<AgentAuthMethod | undefined> {
    const classification = await this.classifyProvider(instance, provider);
    if (classification.activeMethod) return classification.activeMethod;
    return classification.methods.length === 1 ? classification.methods[0] : undefined;
  }

  private async classifyProvider(
    instance: AgentInstance,
    provider: string,
  ): Promise<ModelAuthClassification> {
    if (instance.runtime !== "pi-sdk") {
      return { methods: [] };
    }
    const fallback: AgentAuthMethod = provider === "ollama" ? "local" : "api-key";
    const raw = this.modelAuthClassifier
      ? await this.modelAuthClassifier({ instance, provider })
      : { methods: [fallback], activeMethod: fallback };
    const methods = dedupeAuthMethods(raw.methods);
    const activeMethod =
      raw.activeMethod && methods.includes(raw.activeMethod) ? raw.activeMethod : undefined;
    return {
      methods: methods.length > 0 ? methods : [fallback],
      activeMethod: activeMethod ?? (methods.length === 1 ? methods[0] : undefined),
    };
  }

  private requireActive(): AgentInstance {
    if (!this.active) throw new Error("No configured agent runtime");
    return this.active;
  }
}

function dedupeAuthMethods(methods: readonly AgentAuthMethod[]): AgentAuthMethod[] {
  const ordered: AgentAuthMethod[] = [];
  for (const method of methods) {
    if (!ordered.includes(method)) ordered.push(method);
  }
  return ordered;
}
