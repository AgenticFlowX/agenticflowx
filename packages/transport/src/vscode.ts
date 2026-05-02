/**
 * VSCode transport — wraps acquireVsCodeApi postMessage.
 * The only file in the chat UI that touches the VSCode webview API.
 *
 * @see docs/specs/110-package-transport/spec.md [FR-2]
 * @see docs/specs/110-package-transport/design.md [DES-ARCH]
 * @see docs/specs/200-app-vscode/spec.md [FR-1]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import {
  type AgentToChat,
  type ChatToAgent,
  type MessageOf,
  consoleSink,
  createLogger,
} from "@afx/shared";

import type { Transport } from "./types";

const log = createLogger({ scope: "vscode-transport", level: "info", sinks: [consoleSink()] });

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export function createVscodeTransport(): Transport {
  let api: VsCodeApi | null = null;
  const listeners = new Map<string, Set<(msg: AgentToChat) => void>>();
  let started = false;

  function getApi(): VsCodeApi | null {
    if (api) return api;
    if (typeof acquireVsCodeApi === "function") {
      try {
        api = acquireVsCodeApi();
      } catch {
        /* already acquired — acquireVsCodeApi throws on second call */
      }
    }
    return api;
  }

  function handleWindowMessage(event: MessageEvent): void {
    const msg = event.data as AgentToChat | null;
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    const set = listeners.get(msg.type);
    if (!set) return;
    for (const l of set) {
      try {
        l(msg);
      } catch (err) {
        log.error(() => `listener error: ${msg.type}`, err instanceof Error ? err : undefined);
      }
    }
  }

  function ensureListening(): void {
    if (started) return;
    started = true;
    window.addEventListener("message", handleWindowMessage);
  }

  function send(msg: ChatToAgent): void {
    const vsApi = getApi();
    if (vsApi) {
      vsApi.postMessage(msg);
    } else {
      log.debug(() => `dev send ${msg.type}`, { msg });
    }
  }

  function on<T extends AgentToChat["type"]>(
    type: T,
    handler: (msg: MessageOf<AgentToChat, T>) => void,
  ): () => void {
    ensureListening();
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
    window.removeEventListener("message", handleWindowMessage);
    listeners.clear();
    started = false;
  }

  function getState(): unknown {
    return getApi()?.getState();
  }

  function setState(state: unknown): void {
    getApi()?.setState(state);
  }

  return { send, on, getState, setState, dispose };
}
