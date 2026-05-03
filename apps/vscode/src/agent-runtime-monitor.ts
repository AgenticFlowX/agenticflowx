/**
 * Host-owned runtime health monitor for the active agent adapter.
 * Drives the runtime phase machine: unknown -> checking -> ready/unhealthy/unsupported.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1] [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-PHASE-MACHINE] [DES-AGENT-RUNTIME-STATUS] [DES-AGENT-LIFECYCLE]
 */
import type {
  AgentManager,
  AgentRuntimeStatus,
  AgentStatus,
  Disposable,
  Logger,
} from "@afx/shared";
import {
  AGENT_RUNTIME_FAILURE_THRESHOLD,
  AGENT_RUNTIME_STARTUP_GRACE_MS,
  createCheckingAgentRuntimeStatus,
  deriveAgentRuntimeStatus,
} from "@afx/shared";

const STARTING_POLL_MS = 1_500;
const READY_POLL_MS = 15_000;
const DISCONNECTED_POLL_MS = 5_000;

/**
 * Poll interval contract used by the VS Code host monitor.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export interface AgentRuntimeMonitorIntervals {
  startingMs: number;
  readyMs: number;
  disconnectedMs: number;
  startupGraceMs: number;
  failureThreshold: number;
}

/**
 * Dependencies for a host-owned runtime health monitor.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export interface AgentRuntimeMonitorOptions {
  agentManager: AgentManager;
  logger: Logger;
  now?: () => number;
  intervals?: Partial<AgentRuntimeMonitorIntervals>;
}

/**
 * Runtime monitor interface shared by the VS Code command path and webview panel.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1] [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export interface AgentRuntimeMonitor extends Disposable {
  start(): void;
  stop(): void;
  check(requestId?: string): Promise<AgentRuntimeStatus>;
  restart(requestId?: string): Promise<AgentRuntimeStatus>;
  record(status: AgentStatus, requestId?: string): AgentRuntimeStatus;
  getSnapshot(): AgentRuntimeStatus;
  onStatus(
    listener: (status: AgentRuntimeStatus, requestId: string | undefined) => void,
  ): Disposable;
}

/**
 * Create the monitor that owns runtime polling and recovery transitions.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1] [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export function createAgentRuntimeMonitor(
  options: AgentRuntimeMonitorOptions,
): AgentRuntimeMonitor {
  // Flow: [AgentManager.RuntimeMonitor]
  const now = options.now ?? Date.now;
  const intervals: AgentRuntimeMonitorIntervals = {
    startingMs: STARTING_POLL_MS,
    readyMs: READY_POLL_MS,
    disconnectedMs: DISCONNECTED_POLL_MS,
    startupGraceMs: AGENT_RUNTIME_STARTUP_GRACE_MS,
    failureThreshold: AGENT_RUNTIME_FAILURE_THRESHOLD,
    ...options.intervals,
  };
  const log = options.logger.child("agent-runtime-monitor");
  const startedAt = now();
  const listeners = new Set<(status: AgentRuntimeStatus, requestId: string | undefined) => void>();

  let snapshot = createCheckingAgentRuntimeStatus(startedAt);
  let timer: NodeJS.Timeout | null = null;
  let started = false;
  let inFlight: Promise<AgentRuntimeStatus> | null = null;

  function emit(requestId?: string): void {
    for (const listener of listeners) {
      try {
        listener(snapshot, requestId);
      } catch (err) {
        log.error("status listener failed", err instanceof Error ? err : undefined);
      }
    }
  }

  function clearPoll(): void {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function scheduleNext(): void {
    if (!started) return;
    clearPoll();
    if (snapshot.restartRequired) return;
    const delay =
      snapshot.phase === "ready" || snapshot.phase === "busy"
        ? intervals.readyMs
        : snapshot.phase === "disconnected" || snapshot.phase === "error"
          ? intervals.disconnectedMs
          : intervals.startingMs;
    timer = setTimeout(() => {
      timer = null;
      void check();
    }, delay);
    timer.unref?.();
  }

  async function performCheck(requestId?: string): Promise<AgentRuntimeStatus> {
    clearPoll();
    try {
      const status = await options.agentManager.getStatus();
      snapshot = deriveAgentRuntimeStatus({
        status,
        previous: snapshot,
        now: now(),
        startedAt,
        startupGraceMs: intervals.startupGraceMs,
        failureThreshold: intervals.failureThreshold,
      });
    } catch (err) {
      snapshot = deriveAgentRuntimeStatus({
        error: err,
        previous: snapshot,
        now: now(),
        startedAt,
        startupGraceMs: intervals.startupGraceMs,
        failureThreshold: intervals.failureThreshold,
      });
      log.warn("agent status check failed", {
        phase: snapshot.phase,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    emit(requestId);
    scheduleNext();
    return snapshot;
  }

  async function check(requestId?: string): Promise<AgentRuntimeStatus> {
    if (inFlight) return inFlight;
    inFlight = performCheck(requestId).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function record(status: AgentStatus, requestId?: string): AgentRuntimeStatus {
    clearPoll();
    snapshot = deriveAgentRuntimeStatus({
      status,
      previous: snapshot,
      now: now(),
      startedAt,
      startupGraceMs: intervals.startupGraceMs,
      failureThreshold: intervals.failureThreshold,
    });
    emit(requestId);
    scheduleNext();
    return snapshot;
  }

  async function restart(requestId?: string): Promise<AgentRuntimeStatus> {
    clearPoll();
    snapshot = {
      ...createCheckingAgentRuntimeStatus(now()),
      info: "Restarting agent runtime.",
    };
    emit(requestId);
    try {
      await options.agentManager.stop();
    } catch (err) {
      snapshot = deriveAgentRuntimeStatus({
        error: err,
        previous: snapshot,
        now: now(),
        startedAt,
        startupGraceMs: intervals.startupGraceMs,
        failureThreshold: intervals.failureThreshold,
      });
      emit(requestId);
      scheduleNext();
      return snapshot;
    }
    return check(requestId);
  }

  return {
    start() {
      if (started) return;
      started = true;
      snapshot = createCheckingAgentRuntimeStatus(now());
      emit();
      void check();
    },
    stop() {
      started = false;
      clearPoll();
    },
    check,
    restart,
    record,
    getSnapshot() {
      return snapshot;
    },
    onStatus(listener) {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
    dispose() {
      started = false;
      clearPoll();
      listeners.clear();
    },
  };
}
