/**
 * Bridge — module-level shim that delegates send/on calls to the injected Transport.
 * Injected once at app startup via initTransport(); all chat code imports from here.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-API]
 * @see docs/specs/110-package-transport/spec.md [FR-1]
 * @see docs/specs/110-package-transport/design.md [DES-ARCH]
 */
import {
  type AgentToChat,
  type ChatToAgent,
  type MessageOf,
  consoleSink,
  createLogger,
} from "@afx/shared";
import type { Transport } from "@afx/transport";

const log = createLogger({ scope: "chat:bridge", level: "info", sinks: [consoleSink()] });

let _transport: Transport | null = null;

/** Called once in main.tsx before React renders. */
export function initTransport(t: Transport): void {
  _transport = t;
}

/** Post a typed command to the agent engine. */
export function bridgeSend(msg: ChatToAgent): void {
  if (_transport) {
    _transport.send(msg);
  } else {
    log.warn(() => `transport not initialised — dropping ${msg.type}`);
  }
}

/** Subscribe to a specific agent→chat event type. Returns unsubscribe fn. */
export function bridgeOn<T extends AgentToChat["type"]>(
  type: T,
  handler: (msg: MessageOf<AgentToChat, T>) => void,
): () => void {
  if (!_transport) {
    log.warn(() => `transport not initialised — listener for ${type} will not fire`);
    return () => {};
  }
  return _transport.on(type, handler);
}
