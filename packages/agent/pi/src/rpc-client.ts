/**
 * Pi RPC client — spawns `pi --mode rpc` and speaks JSONL protocol over stdin/stdout.
 * Uses StringDecoder + indexOf('\n') for framing (not readline — avoids U+2028/U+2029 split bug).
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-1] [FR-4]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-RPC-FLOW] [DES-ARCH]
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { extname } from "node:path";
import { StringDecoder } from "node:string_decoder";

import type { RpcCommand, RpcResponse } from "@earendil-works/pi-coding-agent";

import type { Logger } from "@afx/shared";

// `RpcExtensionUIResponse` is not exported from the package root, so we mirror
// the shape locally — see `dist/modes/rpc/rpc-types.d.ts` in @earendil-works/pi-coding-agent.
export type RpcExtensionUIResponse =
  | { type: "extension_ui_response"; id: string; value: string }
  | { type: "extension_ui_response"; id: string; confirmed: boolean }
  | { type: "extension_ui_response"; id: string; cancelled: true };

export type RpcOutbound = RpcCommand | RpcExtensionUIResponse;

// Pi events are received as loose JSON — we do not bind to pi's internal types
// here. Known fields used by the manager are declared as optional `unknown` so
// strict access (`noPropertyAccessFromIndexSignature`) doesn't force bracket
// notation across the normalizer; the runtime `typeof` checks are the source
// of truth for shape.
export interface PiEvent {
  type: string;
  id?: unknown;
  method?: unknown;
  message?: unknown;
  title?: unknown;
  text?: unknown;
  prefill?: unknown;
  placeholder?: unknown;
  options?: unknown;
  timeout?: unknown;
  notifyType?: unknown;
  statusKey?: unknown;
  statusText?: unknown;
  widgetKey?: unknown;
  widgetLines?: unknown;
  widgetPlacement?: unknown;
  followUp?: unknown;
  steering?: unknown;
  args?: unknown;
  toolCallId?: unknown;
  toolName?: unknown;
  isError?: unknown;
  result?: unknown;
  error?: unknown;
  reason?: unknown;
  attempt?: unknown;
  maxAttempts?: unknown;
  delayMs?: unknown;
  finalError?: unknown;
  success?: unknown;
  aborted?: unknown;
  willRetry?: unknown;
  errorMessage?: unknown;
  assistantMessageEvent?: unknown;
  [key: string]: unknown;
}

export type PiEventListener = (event: PiEvent) => void;
export type PiExitListener = (info: { code: number | null; signal: NodeJS.Signals | null }) => void;
export type PiStderrListener = (chunk: string) => void;

export interface PiClientOptions {
  /** Binary to spawn. Defaults to "pi" on PATH. */
  binaryPath?: string;
  /** Working directory for the agent. */
  cwd?: string;
  /** Extra CLI args appended after "--mode rpc". */
  args?: readonly string[];
  /** Args inserted before "--mode rpc" (used for `node bootstrap.js --mode rpc`). */
  commandPrefixArgs?: readonly string[];
  /** Environment variables passed to the child. Merged over process.env. */
  env?: Record<string, string>;
  /** Optional logger for diagnostic output. The client does not create its own scope. */
  logger?: Logger;
}

export interface PiClient {
  readonly isRunning: boolean;
  start: () => Promise<void>;
  stop: (signal?: NodeJS.Signals) => Promise<void>;
  dispose: () => Promise<void>;
  request: <T = unknown>(cmd: RpcCommand) => Promise<T>;
  send: (msg: RpcOutbound) => void;
  onEvent: (listener: PiEventListener) => () => void;
  onExit: (listener: PiExitListener) => () => void;
  onStderr: (listener: PiStderrListener) => () => void;
  getStderr: () => string;
}

export function shouldUseShellForBinary(
  binaryPath: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== "win32") return false;
  const extension = extname(binaryPath).toLowerCase();
  return extension === "" || extension === ".cmd" || extension === ".bat";
}

interface PendingRequest {
  resolve: (resp: RpcResponse) => void;
  reject: (err: Error) => void;
}

export function createPiClient(options: PiClientOptions = {}): PiClient {
  // Flow: [AgentPi.RpcJsonl]
  const { binaryPath = "pi", cwd, args = [], commandPrefixArgs = [], env, logger } = options;

  let proc: ChildProcessWithoutNullStreams | null = null;
  const stdoutDecoder = new StringDecoder("utf8");
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let nextId = 1;
  const pending = new Map<string, PendingRequest>();
  const eventListeners = new Set<PiEventListener>();
  const exitListeners = new Set<PiExitListener>();
  const stderrListeners = new Set<PiStderrListener>();
  let startPromise: Promise<void> | null = null;
  let disposed = false;

  function isRunning(): boolean {
    return proc !== null && !proc.killed && proc.exitCode === null;
  }

  function writeLine(line: string): void {
    if (!proc) throw new Error("PiClient not started");
    proc.stdin.write(line + "\n");
  }

  function failPending(err: Error): void {
    for (const [, p] of pending) {
      try {
        p.reject(err);
      } catch {
        /* ignore */
      }
    }
    pending.clear();
  }

  function handleLine(line: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      logger?.warn("non-JSON line dropped", { line });
      return;
    }

    if (!msg || typeof msg !== "object") return;
    const m = msg as { type?: string; id?: string };

    if (m.type === "response") {
      const id = m.id;
      if (!id) return;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      p.resolve(msg as RpcResponse);
      return;
    }

    for (const l of eventListeners) {
      try {
        l(msg as PiEvent);
      } catch (err) {
        logger?.error("event listener threw", err instanceof Error ? err : undefined);
      }
    }
  }

  function handleStdout(chunk: Buffer | string): void {
    stdoutBuffer += typeof chunk === "string" ? chunk : stdoutDecoder.write(chunk);
    // Framing: LF only. Accept optional \r before \n.
    while (true) {
      const idx = stdoutBuffer.indexOf("\n");
      if (idx === -1) break;
      let line = stdoutBuffer.slice(0, idx);
      stdoutBuffer = stdoutBuffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.length === 0) continue;
      handleLine(line);
    }
  }

  function start(): Promise<void> {
    if (startPromise) return startPromise;
    if (disposed) return Promise.reject(new Error("PiClient is disposed"));

    const finalArgs = [...commandPrefixArgs, "--mode", "rpc", ...args];
    logger?.info("spawn", {
      binaryPath,
      args: finalArgs.join(" "),
      cwd: cwd ?? process.cwd(),
    });

    startPromise = new Promise<void>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(binaryPath, finalArgs, {
          cwd,
          // @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-23]
          // eslint-disable-next-line no-restricted-syntax -- spawned child needs parent env (PATH, HOME, etc.); not user-supplied config
          env: { ...process.env, ...env },
          shell: shouldUseShellForBinary(binaryPath),
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      proc = child;

      child.stdout.on("data", (chunk: Buffer | string) => handleStdout(chunk));
      child.stderr.on("data", (chunk: Buffer | string) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        stderrBuffer += text;
        logger?.warn(() => `stderr: ${text.trimEnd()}`);
        for (const l of stderrListeners) {
          try {
            l(text);
          } catch {
            /* ignore */
          }
        }
      });

      child.once("error", (err) => {
        logger?.error("spawn error", err);
        failPending(err);
        reject(err);
      });

      child.once("exit", (code, signal) => {
        logger?.info("exit", { code, signal });
        proc = null;
        failPending(new Error(`pi exited (code=${code}, signal=${signal})`));
        for (const l of exitListeners) {
          try {
            l({ code, signal });
          } catch {
            /* ignore */
          }
        }
      });

      child.once("spawn", () => resolve());
    });

    return startPromise;
  }

  async function request<T = unknown>(cmd: RpcCommand): Promise<T> {
    if (!proc) throw new Error("PiClient not started");
    const id = String(nextId++);
    const payload = { ...cmd, id };

    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: (resp) => {
          if (resp.success) {
            const withData = resp as unknown as { data?: T };
            resolve(withData.data as T);
          } else {
            const err = (resp as unknown as { error?: string }).error;
            reject(new Error(err ?? "pi command failed"));
          }
        },
        reject,
      });
      try {
        writeLine(JSON.stringify(payload));
      } catch (err) {
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  function send(msg: RpcOutbound): void {
    if (!proc) throw new Error("PiClient not started");
    writeLine(JSON.stringify(msg));
  }

  function onEvent(listener: PiEventListener): () => void {
    eventListeners.add(listener);
    return () => {
      eventListeners.delete(listener);
    };
  }

  function onExit(listener: PiExitListener): () => void {
    exitListeners.add(listener);
    return () => {
      exitListeners.delete(listener);
    };
  }

  function onStderr(listener: PiStderrListener): () => void {
    stderrListeners.add(listener);
    return () => {
      stderrListeners.delete(listener);
    };
  }

  async function stop(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    const current = proc;
    if (!current) return;
    await new Promise<void>((resolve) => {
      current.once("exit", () => resolve());
      try {
        current.kill(signal);
      } catch {
        resolve();
      }
    });
  }

  async function dispose(): Promise<void> {
    disposed = true;
    eventListeners.clear();
    stderrListeners.clear();
    await stop();
  }

  return {
    get isRunning() {
      return isRunning();
    },
    start,
    stop,
    dispose,
    request,
    send,
    onEvent,
    onExit,
    onStderr,
    getStderr: () => stderrBuffer,
  };
}
