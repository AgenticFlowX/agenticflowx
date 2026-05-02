/**
 * Transport interface and related types — the single seam between the chat UI and any message carrier.
 * Implementations: createVscodeTransport() (postMessage) and createMockTransport() (scripted scenarios).
 *
 * @see docs/specs/110-package-transport/spec.md [FR-1] [FR-5]
 * @see docs/specs/110-package-transport/design.md [DES-API]
 */
import type { AgentToChat, ChatToAgent, MessageOf } from "@afx/shared";

export type { AgentToChat, ChatToAgent };

export interface Transport {
  send(msg: ChatToAgent): void;
  on<T extends AgentToChat["type"]>(
    type: T,
    handler: (msg: MessageOf<AgentToChat, T>) => void,
  ): () => void;
  getState?(): unknown;
  setState?(state: unknown): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Log entry — emitted by transports so the DevOverlay can show raw traffic
// ---------------------------------------------------------------------------

export type LogDirection = "in" | "out";

export interface LogEntry {
  id: string;
  dir: LogDirection;
  type: string;
  payload: unknown;
  ts: number;
}

/** Extended interface returned by createMockTransport */
export interface MockTransport extends Transport {
  /** Named scenario runners — call these from the DevOverlay */
  scenarios: Record<string, ScenarioFn>;
  /** Subscribe to raw message log (both directions) */
  onLog(cb: (entry: LogEntry) => void): () => void;
  /** Read current log snapshot */
  getLog(): LogEntry[];
  /** Control streaming speed — ms between word chunks (default 40) */
  setStreamSpeed(ms: number): void;
}

export type ScenarioFn = () => void;
