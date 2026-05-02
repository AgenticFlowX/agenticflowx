/**
 * Host-side router that presents many runtime instances as one AgentManager.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
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

import type { AgentInstance } from "./agent-factory";

export interface MultiplexedAgentManagerOptions {
  instanceId?: string;
  /**
   * Callback that returns the current `afx.rpc.enabled` setting. Decorated onto
   * every AgentStatus so chat can decide whether to surface Pi affordances.
   */
  rpcEnabledGetter?: () => boolean;
}

export class MultiplexedAgentManager implements AgentManager {
  private active: AgentInstance | null;
  private readonly modelCache = new Map<string, AgentModel[]>();
  private readonly rpcEnabledGetter?: () => boolean;
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
    return { ...this.tagStatus(active, status), rpcEnabled, runtimeConfigured: true };
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
        const tagged = models.map((model) => this.tagModel(instance, model));
        this.modelCache.set(instance.id, tagged);
        return tagged;
      }),
    );
    return grouped.flat();
  }

  async setModel(target: {
    provider: string;
    modelId: string;
    instanceId?: string;
  }): Promise<AgentModel> {
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
    return this.tagModel(next, selected);
  }

  async switchSession(sessionPath: string): Promise<{ cancelled: boolean }> {
    const active = this.requireActive();
    if (!active.manager.switchSession) {
      throw new Error(`Runtime ${active.label} does not support session switching`);
    }
    return active.manager.switchSession(sessionPath);
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
  }): Promise<AgentInstance | undefined> {
    if (this.modelCache.size === 0) {
      await this.getAvailableModels();
    }
    return this.instances.find((instance) =>
      this.modelCache
        .get(instance.id)
        ?.some((model) => model.provider === target.provider && model.id === target.modelId),
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

  private tagModel(instance: AgentInstance, model: AgentModel): AgentModel {
    return {
      ...model,
      source: instance.runtime === "pi" ? "external-agent" : "api-provider",
      instanceId: instance.id,
      instanceLabel: instance.label,
    };
  }

  private tagStatus(instance: AgentInstance, status: AgentStatus): AgentStatus {
    if (!status.model) return status;
    return {
      ...status,
      model: {
        ...status.model,
        source: instance.runtime === "pi" ? "external-agent" : "api-provider",
        instanceId: instance.id,
        instanceLabel: instance.label,
      },
    };
  }

  private requireActive(): AgentInstance {
    if (!this.active) throw new Error("No configured agent runtime");
    return this.active;
  }
}
