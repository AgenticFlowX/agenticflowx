/**
 * Bridge — module-level shim that delegates send/on calls and persisted webview state access
 * to the injected Transport.
 * Injected once at app startup via initTransport(); all chat code imports from here.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-API]
 * @see docs/specs/110-package-transport/spec.md [FR-1]
 * @see docs/specs/110-package-transport/design.md [DES-TRANSPORT-INTERFACE]
 * @see docs/specs/350-agent-manager/spec.md [FR-4]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-MULTIPLEX-FLOW]
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

/**
 * Reads the persisted webview state when the transport supports it.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-1] [FR-8]
 * @see docs/specs/210-app-chat/design.md [DES-UI-MOCKUP-HYDRATION]
 * @see docs/specs/110-package-transport/spec.md [FR-5]
 */
export function bridgeGetState(): unknown {
  return _transport?.getState?.();
}

/**
 * Persists the webview state when the transport supports it.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-1] [FR-8]
 * @see docs/specs/210-app-chat/design.md [DES-UI-MOCKUP-HYDRATION]
 * @see docs/specs/110-package-transport/spec.md [FR-5]
 */
export function bridgeSetState(state: unknown): void {
  _transport?.setState?.(state);
}

/**
 * Flow: [Bridge.ChatToAgent]
 *
 * Post a typed command to the agent engine.
 */
export function bridgeSend(msg: ChatToAgent): void {
  if (_transport) {
    _transport.send(msg);
  } else {
    log.warn(() => `transport not initialised — dropping ${msg.type}`);
  }
}

/**
 * Flow: [Bridge.ChatToAgent]
 *
 * Subscribe to a specific agent->chat event type. Returns unsubscribe fn.
 */
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
