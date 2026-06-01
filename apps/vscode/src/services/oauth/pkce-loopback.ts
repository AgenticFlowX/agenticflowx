/**
 * PKCE authorization-code loopback strategy (Anthropic, OpenAI Codex).
 *
 * Runs the S256 PKCE flow against a provider's *fixed* registered redirect URI:
 * the loopback HTTP server binds BOTH `127.0.0.1` AND `::1` so a browser that
 * resolves `localhost` to either family connects, while the `redirect_uri` host
 * stays `localhost` to match the provider registration. The flow opens the system
 * browser via `vscode.env.openExternal`, races callback capture against an
 * `AbortController` cancel and a <=5min timeout, validates `state` before exchange,
 * and always offers a paste-code fallback. AFX surfaces that paste field
 * proactively when the extension host is remote (`vscode.env.remoteName` set),
 * where loopback is likely unreachable from the user's browser. No tokens are
 * logged.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-2] [FR-6] [FR-7] [NFR-1] [NFR-2]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-SEC]
 */
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";

import * as vscode from "vscode";

import type { Logger } from "@afx/shared";

import { type PkcePair, generatePkce, generateState, timingSafeEqualString } from "./pkce";

/** Loopback bind families. `redirect_uri` always uses `localhost` (see config). */
const BIND_HOSTS = ["127.0.0.1", "::1"] as const;

/**
 * Hard ceiling on a single loopback wait; timeout exits through the same safe
 * cancellation path as user abort.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-2] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE]
 */
const MAX_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Static, provider-supplied loopback configuration. Ports/paths are FIXED by the
 * provider's OAuth registration and cannot be reassigned (only the paste-code
 * fallback can recover a busy port.
 */
export interface PkceLoopbackConfig {
  /** Provider id, e.g. "anthropic" | "openai-codex". Used for log scope only. */
  readonly provider: string;
  /** Authorize endpoint, e.g. "https://claude.ai/oauth/authorize". */
  readonly authorizeUrl: string;
  /** OAuth client id registered with the provider. */
  readonly clientId: string;
  /** Space-delimited scopes. */
  readonly scope: string;
  /** Fixed loopback port (Anthropic 53692, OpenAI Codex 1455). */
  readonly callbackPort: number;
  /** Fixed callback path (Anthropic "/callback", OpenAI Codex "/auth/callback"). */
  readonly callbackPath: string;
  /**
   * Registered redirect URI host — ALWAYS "localhost" for both providers. The
   * server binds the loopback addresses; the provider only accepts this host.
   */
  readonly redirectUri: string;
  /**
   * When true, `state` equals the PKCE `verifier` (Anthropic). When
   * false, a separate random `state` is generated (OpenAI Codex).
   */
  readonly stateIsVerifier: boolean;
  /** Extra static authorize query params (e.g. OpenAI Codex codex flags). */
  readonly extraAuthParams?: Readonly<Record<string, string>>;
}

/** Result of a successful authorization-code capture (pre-exchange). */
export interface PkceAuthorization {
  /** The authorization `code` returned by the provider. */
  readonly code: string;
  /** The validated `state` echoed back (equals expected state). */
  readonly state: string;
  /** The PKCE verifier to send in the token exchange. */
  readonly verifier: string;
  /** The redirect URI to replay in the token exchange (must match authorize). */
  readonly redirectUri: string;
  /** How the code was captured — useful for diagnostics, never the code itself. */
  readonly via: "loopback" | "paste";
}

/** Host callbacks the loopback flow drives (UI is owned by the caller). */
export interface PkceLoopbackCallbacks {
  /**
   * Called once the authorize URL is ready. The caller opens the browser
   * (`vscode.env.openExternal`) and renders the waiting/paste UI. `proactivePaste`
   * is true under Remote/WSL so the paste field should render immediately.
   */
  onAuthUrl(input: { url: string; proactivePaste: boolean }): void;
  /**
   * Optional manual paste source. Resolves with the user-pasted code OR full
   * redirect URL. Races the loopback capture — whichever resolves first wins.
   * Reject to signal the user cancelled the paste affordance.
   */
  onManualCode?(): Promise<string>;
  /** Optional progress breadcrumbs (non-secret strings only). */
  onProgress?(message: string): void;
}

export interface PkceLoopbackOptions {
  readonly config: PkceLoopbackConfig;
  readonly callbacks: PkceLoopbackCallbacks;
  readonly logger: Logger;
  /** External cancel (Cancel button). Aborting closes the server and rejects. */
  readonly signal?: AbortSignal;
  /** Override the loopback wait ceiling for tests; clamped to MAX_TIMEOUT_MS. */
  readonly timeoutMs?: number;
}

/** Error thrown when the user (or host) cancels the flow. */
export class OAuthCancelledError extends Error {
  constructor(message = "Sign-in cancelled") {
    super(message);
    this.name = "OAuthCancelledError";
  }
}

/** Parsed `{ code, state }` from a pasted code or full redirect URL. */
function parseAuthorizationInput(input: string): { code?: string; state?: string } {
  const value = input.trim();
  if (!value) {
    return {};
  }
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
    };
  } catch {
    // Not a URL — fall through to the looser parsers below.
  }
  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return { code, state };
  }
  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    return {
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
    };
  }
  return { code: value };
}

/** Build the provider authorize URL with PKCE challenge + state. */
function buildAuthorizeUrl(config: PkceLoopbackConfig, pkce: PkcePair, state: string): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", pkce.method);
  url.searchParams.set("state", state);
  for (const [key, val] of Object.entries(config.extraAuthParams ?? {})) {
    url.searchParams.set(key, val);
  }
  return url.toString();
}

interface ServerHandle {
  /** Resolves once with the captured `{ code, state }`, or null if cancelled. */
  readonly waitForCode: () => Promise<{ code: string; state: string } | null>;
  /** Resolve the wait with null (cancel) without erroring the listeners. */
  readonly cancel: () => void;
  /** Tear down all bound servers. Idempotent. */
  readonly close: () => void;
}

/**
 * Bind the loopback callback server on BOTH `127.0.0.1` and `::1`.
 *
 * Each host gets its own `http.Server` instance because a single Node listener
 * cannot bind two explicit addresses. Both share one capture promise — the first
 * valid callback on either family settles it. If `127.0.0.1` binds but `::1`
 * fails (no IPv6 stack), we proceed with whatever bound; only a total failure
 * (e.g. port busy on both) rejects so the caller can fall back to paste-code.
 */
async function startLoopbackServers(
  config: PkceLoopbackConfig,
  expectedState: string,
  log: Logger,
): Promise<ServerHandle> {
  let settle: ((value: { code: string; state: string } | null) => void) | undefined;
  let settled = false;
  const waitForCodePromise = new Promise<{ code: string; state: string } | null>((resolve) => {
    settle = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
  });

  const servers: Server[] = [];

  const handleRequest: Parameters<typeof createServer>[1] = (req, res) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      if (url.pathname !== config.callbackPath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Authentication did not complete. You can close this window.");
        log.debug(() => `callback error param: ${error}`);
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Missing code or state.");
        return;
      }
      if (!timingSafeEqualString(state, expectedState)) {
        // Reject mismatched state before any token exchange.
        // @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-7] [NFR-1]
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("State mismatch.");
        log.warn("loopback callback state mismatch");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<html><body>Sign-in complete. You can close this window.</body></html>");
      settle?.({ code, state });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal error");
      log.error("loopback callback handler threw", err instanceof Error ? err : undefined);
    }
  };

  const listenOn = (host: string): Promise<Server | undefined> =>
    new Promise((resolve) => {
      const server = createServer(handleRequest);
      const onError = (err: NodeJS.ErrnoException): void => {
        // EADDRINUSE on one family (or no IPv6) is tolerated as long as the
        // other binds; a total failure surfaces via the empty-servers check.
        log.debug(() => `loopback bind ${host}:${config.callbackPort} failed: ${err.code}`);
        try {
          server.close();
        } catch {
          // already closed
        }
        resolve(undefined);
      };
      server.once("error", onError);
      server.listen(config.callbackPort, host, () => {
        server.removeListener("error", onError);
        const bound = server.address() as AddressInfo | null;
        log.debug(() => `loopback bound ${host}:${bound?.port ?? config.callbackPort}`);
        resolve(server);
      });
    });

  const results = await Promise.all(BIND_HOSTS.map((host) => listenOn(host)));
  for (const server of results) {
    if (server) {
      servers.push(server);
    }
  }

  if (servers.length === 0) {
    throw new Error(`Could not bind loopback on port ${config.callbackPort}`);
  }

  const close = (): void => {
    for (const server of servers) {
      try {
        server.close();
      } catch {
        // already closed
      }
    }
  };

  return {
    waitForCode: () => waitForCodePromise,
    cancel: () => settle?.(null),
    close,
  };
}

/**
 * Run the PKCE loopback authorization flow and return the captured (validated)
 * authorization code + verifier. The caller performs the token exchange via the
 * provider registry (so this strategy stays provider-shape-agnostic).
 *
 * Resolution order:
 *  1. Dual-stack loopback capture (validated state) — preferred.
 *  2. Manual paste (code or full redirect URL) — validated against expected state.
 *  3. Timeout (<=5min) or cancel — rejects with OAuthCancelledError.
 *
 * Under Remote/WSL the loopback is likely unreachable, so `onAuthUrl` is told to
 * surface the paste field proactively; the loopback still races in case it works.
 */
export async function runPkceLoopback(options: PkceLoopbackOptions): Promise<PkceAuthorization> {
  const { config, callbacks, signal } = options;
  const log = options.logger.child(`oauth:pkce:${config.provider}`);
  const timeoutMs = Math.min(options.timeoutMs ?? MAX_TIMEOUT_MS, MAX_TIMEOUT_MS);

  if (signal?.aborted) {
    throw new OAuthCancelledError();
  }

  const pkce = await generatePkce();
  // Anthropic reuses the verifier as state; OpenAI Codex uses a separate
  // 16-byte random hex state. Both are validated before exchange.
  const state = config.stateIsVerifier ? pkce.verifier : generateState();
  const proactivePaste = isRemoteHost();

  let server: ServerHandle | undefined;
  let loopbackBound = false;
  try {
    server = await startLoopbackServers(config, state, log);
    loopbackBound = true;
  } catch (err) {
    // Port busy or no bindable loopback: continue with paste-only.
    // @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-2] [NFR-2]
    log.debug(() => `loopback unavailable, paste-only: ${(err as Error).message}`);
  }

  const authorizeUrl = buildAuthorizeUrl(config, pkce, state);
  // Paste must be offered when loopback is down OR proactively under remote.
  callbacks.onAuthUrl({ url: authorizeUrl, proactivePaste: proactivePaste || !loopbackBound });

  // Time-bound + cancelable wrapper around whichever capture wins.
  const timeout = createTimeout(timeoutMs);
  const abortPromise = createAbortPromise(signal);

  try {
    const finalize = (input: { code?: string; state?: string }): PkceAuthorization => {
      if (input.state && !timingSafeEqualString(input.state, state)) {
        throw new Error("OAuth state mismatch");
      }
      if (!input.code) {
        throw new Error("Missing authorization code");
      }
      return {
        code: input.code,
        state: input.state ?? state,
        verifier: pkce.verifier,
        redirectUri: config.redirectUri,
        via: "loopback",
      };
    };

    // Build the racing set: loopback capture, optional manual paste, timeout, abort.
    const loopbackPromise: Promise<PkceAuthorization> = (async () => {
      if (!server) {
        // No loopback bound — never resolves; rely on paste/timeout/abort.
        return new Promise<PkceAuthorization>(() => {});
      }
      const result = await server.waitForCode();
      if (!result) {
        throw new OAuthCancelledError();
      }
      callbacks.onProgress?.("Exchanging authorization code…");
      return finalize(result);
    })();

    const pastePromise: Promise<PkceAuthorization> = (async () => {
      if (!callbacks.onManualCode) {
        return new Promise<PkceAuthorization>(() => {});
      }
      const pasted = await callbacks.onManualCode();
      server?.cancel();
      const parsed = parseAuthorizationInput(pasted);
      callbacks.onProgress?.("Exchanging authorization code…");
      return { ...finalize(parsed), via: "paste" as const };
    })();

    const winner = await Promise.race<PkceAuthorization>([
      loopbackPromise,
      pastePromise,
      timeout.promise.then<never>(() => {
        throw new OAuthCancelledError("Sign-in timed out");
      }),
      abortPromise.promise.then<never>(() => {
        throw new OAuthCancelledError();
      }),
    ]);
    return winner;
  } finally {
    timeout.clear();
    abortPromise.dispose();
    server?.close();
  }
}

/** True when the extension host runs remote (Remote-WSL/SSH/containers/web). */
function isRemoteHost(): boolean {
  return Boolean(vscode.env.remoteName) || vscode.env.uiKind === vscode.UIKind.Web;
}

/** A clearable timeout exposed as a promise (for racing). */
function createTimeout(ms: number): { promise: Promise<void>; clear: () => void } {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    handle = setTimeout(resolve, ms);
  });
  return {
    promise,
    clear: () => {
      if (handle) {
        clearTimeout(handle);
      }
    },
  };
}

/** Bridge an AbortSignal to a promise that resolves on abort. */
function createAbortPromise(signal?: AbortSignal): { promise: Promise<void>; dispose: () => void } {
  if (!signal) {
    return { promise: new Promise<void>(() => {}), dispose: () => {} };
  }
  let onAbort: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    onAbort = () => resolve();
    signal.addEventListener("abort", onAbort, { once: true });
  });
  return {
    promise,
    dispose: () => {
      if (onAbort) {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
