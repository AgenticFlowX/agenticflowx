/**
 * OAuthService orchestrator — drives AFX-owned subscription sign-in/out, the
 * refresh-on-read access-token path, and active-method credential resolution for
 * the Pi SDK `getApiKey(provider)` seam.
 *
 * Responsibilities:
 *  - `signIn`     pick the flow by `descriptor.flow`, run it, exchange code→tokens
 *                 via the descriptor, map to {@link OAuthRecord} (expires already
 *                 carries the provider safety buffer), persist, set active method
 *                 to `subscription`, return a redacted {@link OAuthStatusSnapshot}.
 *                 @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-3] [FR-4] [FR-6] [FR-7]
 *                 @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-DEVICE] [DES-PROVIDERS] [DES-SEC]
 *                 @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4]
 *                 @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API]
 *  - `signOut`    delete the OAuth record; if the active method was `subscription`,
 *                 revert to `api-key` only when a key exists, else clear and fail
 *                 closed.
 *                 @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-7] [NFR-2]
 *                 @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 *  - `getStatus`  redacted snapshot only — never `access`/`refresh`.
 *                 @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-4] [NFR-1]
 *                 @see docs/specs/353-agent-oauth-credential-store/design.md [DES-API] [DES-SEC]
 *  - `getAccessToken`  refresh-on-read: when `Date.now() >= record.expires`,
 *                 refresh via the descriptor, rotate+persist, return `access`.
 *                 Per-provider in-process single-flight + a token-free advisory
 *                 lock file under `globalStorageUri`; re-read SecretStorage after
 *                 the lock so a sibling window's refresh wins.
 *                 @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-5] [FR-6] [NFR-4]
 *                 @see docs/specs/353-agent-oauth-credential-store/design.md [DES-LOCK] [DES-API]
 *  - `getSelectedProviderKey`  active-method resolution: `subscription` →
 *                 `getAccessToken`; `api-key` → `secretStore.getApiKey`; missing or
 *                 refresh-fail → `undefined`, never a silent cross-method fallback.
 *                 Derives + persists the active method when absent.
 *                 @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [NFR-1]
 *                 @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-SEC]
 *                 @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-2] [NFR-2]
 *                 @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA]
 *  - `setAuthMethod` / `submitCode` / `cancel` — method flip + in-flight sign-in
 *                 paste-code delivery + cancellation.
 *                 @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-2]
 *                 @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-2] [FR-6]
 *                 @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-DEVICE]
 *
 * Pure Node + the injected `vscode.SecretStorage` / `globalStorageUri`; no webview,
 * React, or engine code. Tokens are NEVER logged.
 * @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] [FR-2] [NFR-1]
 * @see docs/specs/352-agent-managed-oauth/design.md [DES-POLICY] [DES-SEC]
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [NFR-1]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-SEC]
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
 */
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import type { Uri } from "vscode";

import type {
  Logger,
  OAuthProviderId,
  OAuthRecord,
  OAuthStatusSnapshot,
  ProviderAuthMethod,
} from "@afx/shared";

import type { SecretStore } from "../../secret-store";
import { type CopilotCredential, runDeviceCode } from "./device-code";
import { OAuthCancelledError, type PkceLoopbackConfig, runPkceLoopback } from "./pkce-loopback";
import { getOAuthProvider } from "./providers";
import type { OAuthProviderDescriptor } from "./providers/types";

/**
 * UI-facing callbacks the host wires per sign-in. The orchestrator forwards these
 * to the underlying flow strategy and never owns UI itself. All
 * fields are optional so headless callers can drive a flow without a panel.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-2] [FR-3] [FR-6] [FR-7] [NFR-1]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-DEVICE] [DES-SEC]
 */
export interface SignInCallbacks {
  /** PKCE-loopback: authorize URL ready; open the browser + render waiting/paste. */
  onAuthUrl?(input: { url: string; proactivePaste: boolean }): void;
  /** Device-code: surface the user code + verification URL. */
  onUserCode?(input: { userCode: string; verificationUri: string; expiresInMs: number }): void;
  /** Non-secret progress breadcrumbs. */
  onProgress?(message: string): void;
  /** Optional enterprise URL/domain for GitHub Copilot (blank ⇒ github.com). */
  enterpriseInput?: string;
  /** Known Copilot model ids to best-effort enable post-login. */
  knownModelIds?: readonly string[];
}

/** Dependencies the orchestrator is constructed with (functional factory style). */
export interface OAuthServiceDeps {
  readonly secretStore: SecretStore;
  readonly logger: Logger;
  /** `context.globalStorageUri` — the advisory lock lives under it. */
  readonly globalStorageUri: Uri;
  /**
   * Provider descriptor lookup. Defaults to the built-in registry; injectable so
   * tests and a future custom-OAuth registry can widen it.
   */
  readonly getProvider?: (id: OAuthProviderId) => OAuthProviderDescriptor | undefined;
  /** Injectable flow runners (tests stub these without a real browser/network). */
  readonly runPkceLoopback?: typeof runPkceLoopback;
  readonly runDeviceCode?: typeof runDeviceCode;
  /** Override the cross-window lock tunables (tests). */
  readonly lock?: Partial<LockOptions>;
}

/** Public surface the host consumes (`agent-factory.ts` + the OAuth bridge handlers). */
export interface OAuthService {
  /**
   * Run the descriptor's flow, persist the resulting credential, set the active
   * method to `subscription`, and return a redacted status snapshot.
   */
  signIn(provider: OAuthProviderId, callbacks?: SignInCallbacks): Promise<OAuthStatusSnapshot>;
  /** Delete the OAuth record and resolve the active method with fail-closed behavior. */
  signOut(provider: OAuthProviderId): Promise<OAuthStatusSnapshot>;
  /** Redacted status — never `access`/`refresh`. */
  getStatus(provider: OAuthProviderId): Promise<OAuthStatusSnapshot>;
  /**
   * Refresh-on-read access token. Returns `undefined` when no record exists or a
   * refresh fails (fail closed). Single-flight + cross-window advisory lock.
   */
  getAccessToken(provider: OAuthProviderId): Promise<string | undefined>;
  /**
   * Force-refresh an access token before its stored refresh deadline. Used by
   * proactive runtime refresh so the SDK respawns with a newly-rotated token,
   * not the still-valid-but-about-to-expire token.
   */
  refreshAccessToken(provider: OAuthProviderId): Promise<string | undefined>;
  /**
   * Active-method resolution for the Pi SDK `getApiKey` callback. Never a silent
   * cross-method fallback; derives+persists the method if absent.
   */
  getSelectedProviderKey(provider: OAuthProviderId): Promise<string | undefined>;
  /** Persist the active credential method for `provider`. */
  setAuthMethod(provider: OAuthProviderId, method: ProviderAuthMethod): Promise<void>;
  /** Deliver a pasted code/redirect URL to an in-flight PKCE-loopback sign-in. */
  submitCode(provider: OAuthProviderId, code: string): void;
  /** Cancel an in-flight sign-in for `provider`. */
  cancel(provider: OAuthProviderId): void;
}

/**
 * Cross-window advisory-lock tunables.
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-6] [NFR-4]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-LOCK]
 */
export interface LockOptions {
  /** A lock older than this is treated as stale and reclaimed. */
  readonly staleMs: number;
  /** Total time to keep retrying before giving up and refreshing anyway. */
  readonly maxWaitMs: number;
  /** Poll interval between acquisition attempts. */
  readonly retryMs: number;
}

const DEFAULT_LOCK: LockOptions = {
  staleMs: 30_000,
  maxWaitMs: 10_000,
  retryMs: 150,
};

/** Per-provider in-flight sign-in handle (paste delivery + cancel). */
interface InFlightSignIn {
  readonly controller: AbortController;
  resolveManualCode?: (code: string) => void;
  rejectManualCode?: (err: Error) => void;
}

/**
 * Build the `pkce-loopback` strategy config from a provider descriptor. Anthropic
 * reuses the PKCE verifier as `state`; OpenAI Codex needs the extra Codex authorize
 * flags. Both are descriptor-driven for the static fields and provider-keyed only
 * for the two attributes the descriptor does not carry.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-DEVICE] [DES-SEC]
 */
function toPkceConfig(descriptor: OAuthProviderDescriptor): PkceLoopbackConfig {
  if (
    descriptor.port === undefined ||
    descriptor.callbackPath === undefined ||
    descriptor.redirectUri === undefined
  ) {
    throw new Error(`OAuth provider "${descriptor.id}" is missing pkce-loopback config`);
  }
  const stateIsVerifier = descriptor.id === "anthropic";
  const extraAuthParams =
    descriptor.id === "openai-codex"
      ? {
          id_token_add_organizations: "true",
          codex_cli_simplified_flow: "true",
          originator: "pi",
        }
      : undefined;
  return {
    provider: descriptor.id,
    authorizeUrl: descriptor.authorizeUrl,
    clientId: descriptor.clientId,
    scope: descriptor.scopes,
    callbackPort: descriptor.port,
    callbackPath: descriptor.callbackPath,
    redirectUri: descriptor.redirectUri,
    stateIsVerifier,
    ...(extraAuthParams ? { extraAuthParams } : {}),
  };
}

/** Map the device-code strategy's {@link CopilotCredential} onto an {@link OAuthRecord}. */
function copilotCredentialToRecord(cred: CopilotCredential): OAuthRecord {
  const meta: NonNullable<OAuthRecord["meta"]> = {};
  if (cred.enterpriseDomain) {
    meta.enterpriseDomain = cred.enterpriseDomain;
  }
  if (cred.copilotBaseUrl) {
    meta.copilotBaseUrl = cred.copilotBaseUrl;
  }
  const record: OAuthRecord = {
    access: cred.access,
    refresh: cred.refresh,
    expires: cred.expires,
  };
  if (Object.keys(meta).length > 0) {
    record.meta = meta;
  }
  return record;
}

export function createOAuthService(deps: OAuthServiceDeps): OAuthService {
  const { secretStore, globalStorageUri } = deps;
  const log = deps.logger.child("oauth-service");
  const resolveProvider = deps.getProvider ?? getOAuthProvider;
  const pkceRunner = deps.runPkceLoopback ?? runPkceLoopback;
  const deviceRunner = deps.runDeviceCode ?? runDeviceCode;
  const lockOpts: LockOptions = { ...DEFAULT_LOCK, ...deps.lock };

  /**
   * In-process single-flight: one refresh per provider at a time.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-6] [NFR-4]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-LOCK]
   */
  const refreshInFlight = new Map<OAuthProviderId, Promise<OAuthRecord | undefined>>();
  /** Active sign-in flows, keyed by provider, for paste/cancel routing. */
  const signInFlows = new Map<OAuthProviderId, InFlightSignIn>();

  function requireDescriptor(provider: OAuthProviderId): OAuthProviderDescriptor {
    const descriptor = resolveProvider(provider);
    if (!descriptor) {
      throw new Error(`Unknown OAuth provider "${provider}"`);
    }
    return descriptor;
  }

  /** Compose a redacted snapshot from current SecretStorage state. */
  async function buildSnapshot(provider: OAuthProviderId): Promise<OAuthStatusSnapshot> {
    const record = await secretStore.getOAuth(provider);
    const activeMethod = await secretStore.getAuthMethod(provider);
    const snapshot: OAuthStatusSnapshot = {
      provider,
      connected: record !== undefined,
    };
    if (activeMethod) {
      snapshot.activeMethod = activeMethod;
    }
    if (record) {
      snapshot.expiresInMs = record.expires - Date.now();
      if (record.meta) {
        snapshot.meta = { ...record.meta };
      }
    }
    return snapshot;
  }

  // ─── sign-in ──────────────────────────────────────────────────────────────

  async function signIn(
    provider: OAuthProviderId,
    callbacks: SignInCallbacks = {},
  ): Promise<OAuthStatusSnapshot> {
    const descriptor = requireDescriptor(provider);
    // A new sign-in supersedes any prior in-flight one for the same provider.
    signInFlows.get(provider)?.controller.abort();
    const controller = new AbortController();
    const flow: InFlightSignIn = { controller };
    signInFlows.set(provider, flow);

    try {
      const record =
        descriptor.flow === "device-code"
          ? await runDeviceCodeFlow(descriptor, callbacks, controller.signal)
          : await runPkceFlow(descriptor, flow, callbacks, controller.signal);

      await secretStore.setOAuth(provider, record);
      await secretStore.setAuthMethod(provider, "subscription");
      log.info("oauth sign-in complete", { provider });
      return buildSnapshot(provider);
    } finally {
      if (signInFlows.get(provider) === flow) {
        signInFlows.delete(provider);
      }
    }
  }

  async function runPkceFlow(
    descriptor: OAuthProviderDescriptor,
    flow: InFlightSignIn,
    callbacks: SignInCallbacks,
    signal: AbortSignal,
  ): Promise<OAuthRecord> {
    if (!descriptor.exchange) {
      throw new Error(`OAuth provider "${descriptor.id}" cannot exchange (pkce-loopback)`);
    }
    const config = toPkceConfig(descriptor);
    const authorization = await pkceRunner({
      config,
      logger: deps.logger,
      signal,
      callbacks: {
        onAuthUrl: (input) => callbacks.onAuthUrl?.(input),
        onProgress: (message) => callbacks.onProgress?.(message),
        // Bridge the panel's "Submit code" button through submitCode().
        onManualCode: () =>
          new Promise<string>((resolve, reject) => {
            flow.resolveManualCode = resolve;
            flow.rejectManualCode = reject;
          }),
      },
    });
    callbacks.onProgress?.("Exchanging authorization code…");
    return descriptor.exchange({
      code: authorization.code,
      state: authorization.state,
      verifier: authorization.verifier,
      redirectUri: authorization.redirectUri,
    });
  }

  async function runDeviceCodeFlow(
    descriptor: OAuthProviderDescriptor,
    callbacks: SignInCallbacks,
    signal: AbortSignal,
  ): Promise<OAuthRecord> {
    const credential = await deviceRunner({
      logger: deps.logger,
      signal,
      ...(callbacks.enterpriseInput !== undefined
        ? { enterpriseInput: callbacks.enterpriseInput }
        : {}),
      ...(callbacks.knownModelIds !== undefined ? { knownModelIds: callbacks.knownModelIds } : {}),
      callbacks: {
        onUserCode: (input) => callbacks.onUserCode?.(input),
        onProgress: (message) => callbacks.onProgress?.(message),
      },
    });
    void descriptor; // device-code descriptor carries no exchange step (already normalized)
    return copilotCredentialToRecord(credential);
  }

  // ─── sign-out (fail closed) ─────────────────────────────────────────────────
  // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-7] [NFR-2]
  // @see docs/specs/353-agent-oauth-credential-store/design.md [DES-SEC]

  async function signOut(provider: OAuthProviderId): Promise<OAuthStatusSnapshot> {
    signInFlows.get(provider)?.controller.abort();
    const priorMethod = await secretStore.getAuthMethod(provider);
    await secretStore.clearOAuth(provider);

    // Only re-resolve the active method when subscription was the live method.
    if (priorMethod === "subscription") {
      const apiKey = await secretStore.getApiKey(provider);
      if (apiKey) {
        // An API key remains: revert the active method to it (surfaced by caller).
        await secretStore.setAuthMethod(provider, "api-key");
        log.info("oauth sign-out reverted to api-key", { provider });
      } else {
        // No fallback credential: clear the method so the next read fails closed.
        await secretStore.clearAuthMethod(provider);
        log.info("oauth sign-out cleared active method (fail closed)", { provider });
      }
    }
    return buildSnapshot(provider);
  }

  // ─── status ─────────────────────────────────────────────────────────────────

  async function getStatus(provider: OAuthProviderId): Promise<OAuthStatusSnapshot> {
    return buildSnapshot(provider);
  }

  // ─── access token (refresh-on-read) ──────────────────────────────────────────

  async function getAccessToken(provider: OAuthProviderId): Promise<string | undefined> {
    return getAccessTokenInternal(provider, { forceRefresh: false });
  }

  async function refreshAccessToken(provider: OAuthProviderId): Promise<string | undefined> {
    return getAccessTokenInternal(provider, { forceRefresh: true });
  }

  async function getAccessTokenInternal(
    provider: OAuthProviderId,
    options: { forceRefresh: boolean },
  ): Promise<string | undefined> {
    const descriptor = resolveProvider(provider);
    if (!descriptor) {
      log.warn("getAccessToken for unknown provider", { provider });
      return undefined;
    }
    const record = await secretStore.getOAuth(provider);
    if (!record) {
      return undefined;
    }
    if (!options.forceRefresh && Date.now() < record.expires) {
      return descriptor.credToKey(record);
    }
    const refreshed = await refreshRecord(provider, descriptor, record, options);
    return refreshed ? descriptor.credToKey(refreshed) : undefined;
  }

  /**
   * Refresh `provider` with in-process single-flight + a cross-window advisory
   * lock. Coalesces concurrent callers in this window onto one promise; across
   * windows, the lock holder refreshes and siblings re-read the rotated record.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   */
  async function refreshRecord(
    provider: OAuthProviderId,
    descriptor: OAuthProviderDescriptor,
    stale: OAuthRecord,
    options: { forceRefresh: boolean } = { forceRefresh: false },
  ): Promise<OAuthRecord | undefined> {
    const existing = refreshInFlight.get(provider);
    if (existing) {
      return existing;
    }
    const task = (async (): Promise<OAuthRecord | undefined> => {
      const release = await acquireLock(provider);
      try {
        // Another window may have refreshed while we waited for the lock — re-read.
        const current = await secretStore.getOAuth(provider);
        const siblingRotated =
          current !== undefined &&
          (current.access !== stale.access ||
            current.refresh !== stale.refresh ||
            current.expires !== stale.expires);
        if (current && Date.now() < current.expires && (!options.forceRefresh || siblingRotated)) {
          log.debug(() => `refresh skipped; sibling rotated ${provider}`);
          return current;
        }
        const base = current ?? stale;
        log.info("oauth refreshing", { provider });
        const startedAt = Date.now();
        const rotated = await descriptor.refresh(base);
        log.info("oauth refreshed", { provider, ms: Date.now() - startedAt });
        // Persist rotated access + refresh only after a successful refresh.
        // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-5]
        await secretStore.setOAuth(provider, rotated);
        return rotated;
      } catch (err) {
        // Fail closed: never silently fall back to another method.
        // @see docs/specs/353-agent-oauth-credential-store/spec.md [NFR-2]
        log.error("oauth refresh failed", err instanceof Error ? err : undefined, { provider });
        return undefined;
      } finally {
        await release();
      }
    })();
    refreshInFlight.set(provider, task);
    try {
      return await task;
    } finally {
      refreshInFlight.delete(provider);
    }
  }

  // ─── advisory lock (token-free) ──────────────────────────────────────────────
  // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-6] [NFR-4]
  // @see docs/specs/353-agent-oauth-credential-store/design.md [DES-LOCK]

  function lockDir(): string {
    return join(globalStorageUri.fsPath, "oauth-refresh");
  }

  function lockPath(provider: OAuthProviderId): string {
    // Provider ids are a small known set; keep them filesystem-safe regardless.
    const safe = provider.replace(/[^a-zA-Z0-9._-]/g, "_");
    return join(lockDir(), `${safe}.lock`);
  }

  /**
   * Acquire a token-free advisory lock. Exclusive create (`wx`); reclaims a stale
   * lock; retries up to `maxWaitMs`, then proceeds anyway (best-effort, never
   * blocks a refresh forever). The file contains only a timestamp — no secrets.
   */
  async function acquireLock(provider: OAuthProviderId): Promise<() => Promise<void>> {
    await mkdir(lockDir(), { recursive: true });
    const path = lockPath(provider);
    const deadline = Date.now() + lockOpts.maxWaitMs;
    let held = false;

    for (;;) {
      try {
        const handle = await open(path, "wx");
        await handle.writeFile(JSON.stringify({ at: Date.now() }));
        await handle.close();
        held = true;
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
          // Unexpected FS error — proceed unlocked rather than wedging refresh.
          log.debug(() => `lock open failed (${(err as Error).message}); proceeding unlocked`);
          break;
        }
        if (await reclaimIfStale(path)) {
          continue;
        }
        if (Date.now() >= deadline) {
          log.debug(() => `lock wait timed out for ${provider}; proceeding`);
          break;
        }
        await sleep(lockOpts.retryMs);
      }
    }

    return async () => {
      if (!held) {
        return;
      }
      try {
        await rm(path, { force: true });
      } catch (err) {
        log.debug(() => `lock release failed: ${(err as Error).message}`);
      }
    };
  }

  /** Remove a lock file whose timestamp is older than `staleMs`. Returns true if reclaimed. */
  async function reclaimIfStale(path: string): Promise<boolean> {
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as { at?: number };
      const at = typeof parsed.at === "number" ? parsed.at : 0;
      if (Date.now() - at < lockOpts.staleMs) {
        return false;
      }
      await rm(path, { force: true });
      return true;
    } catch {
      // Unreadable/unparsable lock — treat as stale and reclaim.
      await rm(path, { force: true }).catch(() => undefined);
      return true;
    }
  }

  // ─── active-method resolution ────────────────────────────────────────────────
  // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-2] [NFR-2]
  // @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA]

  async function getSelectedProviderKey(provider: OAuthProviderId): Promise<string | undefined> {
    const method = await resolveActiveMethod(provider);
    if (!method) {
      // Neither credential present, or unresolved both-and-no-method case.
      return undefined;
    }
    if (method === "subscription") {
      // Never falls back to api-key on refresh failure.
      // @see docs/specs/353-agent-oauth-credential-store/spec.md [NFR-2]
      return getAccessToken(provider);
    }
    return secretStore.getApiKey(provider);
  }

  /**
   * Resolve the active method, deriving + persisting it when absent:
   *  1. A stored method whose backing credential still exists wins.
   *  2. OAuth only ⇒ persist + use `subscription`.
   *  3. API key only ⇒ persist + use `api-key`.
   *  4. Both present but no method ⇒ leave unresolved (the UI prompts); return
   *     `undefined` so runtime resolution fails closed rather than guessing.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-2] [NFR-2]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA]
   */
  async function resolveActiveMethod(
    provider: OAuthProviderId,
  ): Promise<ProviderAuthMethod | undefined> {
    const stored = await secretStore.getAuthMethod(provider);
    const hasOAuth = (await secretStore.getOAuth(provider)) !== undefined;
    const hasApiKey = (await secretStore.getApiKey(provider)) !== undefined;

    if (stored === "subscription" && hasOAuth) {
      return "subscription";
    }
    if (stored === "api-key" && hasApiKey) {
      return "api-key";
    }
    // Stored method's backing credential is gone — fall through to derivation.
    if (hasOAuth && !hasApiKey) {
      await secretStore.setAuthMethod(provider, "subscription");
      return "subscription";
    }
    if (hasApiKey && !hasOAuth) {
      await secretStore.setAuthMethod(provider, "api-key");
      return "api-key";
    }
    // Both present with no usable stored method, or neither present: unresolved.
    return undefined;
  }

  // ─── method flip / paste / cancel ────────────────────────────────────────────

  async function setAuthMethod(
    provider: OAuthProviderId,
    method: ProviderAuthMethod,
  ): Promise<void> {
    await secretStore.setAuthMethod(provider, method);
  }

  function submitCode(provider: OAuthProviderId, code: string): void {
    const flow = signInFlows.get(provider);
    if (!flow?.resolveManualCode) {
      log.warn("submitCode with no in-flight paste affordance", { provider });
      return;
    }
    flow.resolveManualCode(code);
    flow.resolveManualCode = undefined;
    flow.rejectManualCode = undefined;
  }

  function cancel(provider: OAuthProviderId): void {
    const flow = signInFlows.get(provider);
    if (!flow) {
      return;
    }
    flow.rejectManualCode?.(new OAuthCancelledError());
    flow.resolveManualCode = undefined;
    flow.rejectManualCode = undefined;
    flow.controller.abort();
  }

  return {
    signIn,
    signOut,
    getStatus,
    getAccessToken,
    refreshAccessToken,
    getSelectedProviderKey,
    setAuthMethod,
    submitCode,
    cancel,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
