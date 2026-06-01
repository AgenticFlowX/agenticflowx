/**
 * GitHub device-code OAuth strategy (GitHub Copilot subscription).
 *
 * AFX owns the host-side Copilot sign-in flow: POST `/login/device/code`, surface
 * the `user_code` + verification URL via callback, poll `/login/oauth/access_token`
 * while honoring `authorization_pending` / `slow_down` / `interval` / expiry /
 * cancel, then exchange the GitHub token for the Copilot token at
 * `/copilot_internal/v2/token`. Enterprise domains are normalized to a hostname
 * (default `github.com`) and the Copilot API base URL is derived from the token
 * `proxy-ep` so AFX can inject a bundled-SDK provider override.
 *
 * Pure Node + `fetch`; no `vscode` import so it stays unit-testable. Tokens are
 * never logged. The caller (OAuthService) maps results onto the shared
 * `OAuthRecord` and persists it in SecretStorage.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-DEVICE] [DES-SEC]
 */
import type { Logger } from "@afx/shared";

/** GitHub Copilot OAuth client id for the device-code grant. */
const COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";

/** Copilot editor identity headers sent on Copilot/GitHub token requests. */
const COPILOT_HEADERS: Readonly<Record<string, string>> = {
  "User-Agent": "GitHubCopilotChat/0.35.0",
  "Editor-Version": "vscode/1.107.0",
  "Editor-Plugin-Version": "copilot-chat/0.35.0",
  "Copilot-Integration-Id": "vscode-chat",
};

/** Poll-interval growth factors for pending and slow-down responses. */
const INITIAL_POLL_INTERVAL_MULTIPLIER = 1.2;
const SLOW_DOWN_POLL_INTERVAL_MULTIPLIER = 1.4;

/** Default Copilot API base URL for individual (non-enterprise) accounts. */
export const COPILOT_DEFAULT_BASE_URL = "https://api.individual.githubcopilot.com";

/** Device-code start response (the fields AFX relies on). */
interface DeviceCodeStart {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly interval: number;
  readonly expires_in: number;
}

/** Normalized credential the device-code flow yields before SecretStorage mapping. */
export interface CopilotCredential {
  /** Copilot API token (short-lived; used as `access`). */
  readonly access: string;
  /** GitHub OAuth access token (long-lived; used as `refresh` to re-mint Copilot tokens). */
  readonly refresh: string;
  /** Epoch ms refresh deadline (Copilot `expires_at` minus 5min buffer). */
  readonly expires: number;
  /** Enterprise hostname when supplied (e.g. "company.ghe.com"); else undefined. */
  readonly enterpriseDomain?: string;
  /** Derived API base URL; differs from default for enterprise / proxy-ep tokens. */
  readonly copilotBaseUrl: string;
}

/** Callbacks the device-code flow drives; UI is owned by the caller. */
export interface DeviceCodeCallbacks {
  /** Surface the `user_code` + verification URL. */
  onUserCode(input: { userCode: string; verificationUri: string; expiresInMs: number }): void;
  /** Optional progress breadcrumbs (non-secret). E.g. model-enable status. */
  onProgress?(message: string): void;
}

export interface DeviceCodeOptions {
  readonly callbacks: DeviceCodeCallbacks;
  readonly logger: Logger;
  /**
   * Raw enterprise URL/domain as typed by the user (blank ⇒ github.com).
   * Normalized internally; an invalid non-empty value rejects.
   */
  readonly enterpriseInput?: string;
  /** Cancel (Cancel button / disposal). Aborting rejects the poll. */
  readonly signal?: AbortSignal;
  /**
   * When true, best-effort enable all known Copilot model policies after login.
   * Failures are warnings unless every call fails. Defaults to true.
   */
  readonly enableModels?: boolean;
  /**
   * Known Copilot model ids to enable post-login. Injected by the caller
   * (registry) so this module stays model-list agnostic.
   */
  readonly knownModelIds?: readonly string[];
}

/** Thrown when the user cancels the device-code flow. */
export class OAuthCancelledError extends Error {
  constructor(message = "Sign-in cancelled") {
    super(message);
    this.name = "OAuthCancelledError";
  }
}

/** Normalize an enterprise URL/domain to a bare hostname, or null if invalid/empty. */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    return url.hostname;
  } catch {
    return null;
  }
}

/** Endpoint set for a given (possibly enterprise) domain. */
function getUrls(domain: string): {
  deviceCodeUrl: string;
  accessTokenUrl: string;
  copilotTokenUrl: string;
} {
  return {
    deviceCodeUrl: `https://${domain}/login/device/code`,
    accessTokenUrl: `https://${domain}/login/oauth/access_token`,
    copilotTokenUrl: `https://api.${domain}/copilot_internal/v2/token`,
  };
}

/**
 * Derive the Copilot API base URL from a Copilot token's `proxy-ep` segment, or
 * fall back to the enterprise/default URL.
 * Token format: `tid=...;exp=...;proxy-ep=proxy.individual.githubcopilot.com;...`
 */
export function getCopilotBaseUrl(token: string, enterpriseDomain?: string): string {
  const match = token.match(/proxy-ep=([^;]+)/);
  const proxyHost = match?.[1];
  if (proxyHost) {
    const apiHost = proxyHost.replace(/^proxy\./, "api.");
    return `https://${apiHost}`;
  }
  if (enterpriseDomain) {
    return `https://copilot-api.${enterpriseDomain}`;
  }
  return COPILOT_DEFAULT_BASE_URL;
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // Never echo the request body (may contain tokens), only status/url.
    // @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-6] [FR-7] [NFR-1]
    // @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-DEVICE] [DES-SEC]
    throw new Error(`${response.status} ${response.statusText} from ${url}: ${text}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/** POST the device-code start and validate the response shape. */
async function startDeviceFlow(domain: string): Promise<DeviceCodeStart> {
  const { deviceCodeUrl } = getUrls(domain);
  const data = await fetchJson(deviceCodeUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": COPILOT_HEADERS["User-Agent"],
    },
    body: new URLSearchParams({ client_id: COPILOT_CLIENT_ID, scope: "read:user" }),
  });
  const deviceCode = data["device_code"];
  const userCode = data["user_code"];
  const verificationUri = data["verification_uri"];
  const interval = data["interval"];
  const expiresIn = data["expires_in"];
  if (
    typeof deviceCode !== "string" ||
    typeof userCode !== "string" ||
    typeof verificationUri !== "string" ||
    typeof interval !== "number" ||
    typeof expiresIn !== "number"
  ) {
    throw new Error("Invalid device code response fields");
  }
  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    interval,
    expires_in: expiresIn,
  };
}

/** Sleep that rejects (OAuthCancelledError) if the signal aborts mid-wait. */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new OAuthCancelledError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new OAuthCancelledError());
      },
      { once: true },
    );
  });
}

/**
 * Poll for the GitHub access token, honoring `authorization_pending`, `slow_down`
 * (interval bump + multiplier), the server `interval`, hard expiry, and cancel.
 */
async function pollForGitHubAccessToken(
  domain: string,
  deviceCode: string,
  intervalSeconds: number,
  expiresIn: number,
  log: Logger,
  signal?: AbortSignal,
): Promise<string> {
  const { accessTokenUrl } = getUrls(domain);
  const deadline = Date.now() + expiresIn * 1000;
  let intervalMs = Math.max(1000, Math.floor(intervalSeconds * 1000));
  let intervalMultiplier = INITIAL_POLL_INTERVAL_MULTIPLIER;
  let sawSlowDown = false;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new OAuthCancelledError();
    }
    const remainingMs = deadline - Date.now();
    const waitMs = Math.min(Math.ceil(intervalMs * intervalMultiplier), remainingMs);
    await abortableSleep(waitMs, signal);

    const raw = await fetchJson(accessTokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": COPILOT_HEADERS["User-Agent"],
      },
      body: new URLSearchParams({
        client_id: COPILOT_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const accessToken = raw["access_token"];
    if (typeof accessToken === "string") {
      return accessToken;
    }
    const error = raw["error"];
    if (typeof error === "string") {
      if (error === "authorization_pending") {
        continue;
      }
      if (error === "slow_down") {
        sawSlowDown = true;
        const serverInterval = raw["interval"];
        intervalMs =
          typeof serverInterval === "number" && serverInterval > 0
            ? serverInterval * 1000
            : Math.max(1000, intervalMs + 5000);
        intervalMultiplier = SLOW_DOWN_POLL_INTERVAL_MULTIPLIER;
        log.debug(() => "device-code slow_down; backing off");
        continue;
      }
      const errorDescription = raw["error_description"];
      const description = typeof errorDescription === "string" ? `: ${errorDescription}` : "";
      throw new Error(`Device flow failed: ${error}${description}`);
    }
  }

  if (sawSlowDown) {
    throw new Error(
      "Device flow timed out after slow_down responses. This is often clock drift in WSL/VM — sync the clock and retry.",
    );
  }
  throw new Error("Device flow timed out");
}

/**
 * Exchange the GitHub access token for a Copilot token. Returns `access` (the
 * Copilot token), `expires` (epoch ms minus 5min buffer), and the derived
 * `copilotBaseUrl`. The GitHub token is retained as `refresh` for re-minting.
 */
async function exchangeForCopilotToken(
  githubAccessToken: string,
  enterpriseDomain: string | undefined,
): Promise<{ token: string; expires: number; copilotBaseUrl: string }> {
  const domain = enterpriseDomain ?? "github.com";
  const { copilotTokenUrl } = getUrls(domain);
  const raw = await fetchJson(copilotTokenUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${githubAccessToken}`,
      ...COPILOT_HEADERS,
    },
  });
  const token = raw["token"];
  const expiresAt = raw["expires_at"];
  if (typeof token !== "string" || typeof expiresAt !== "number") {
    throw new Error("Invalid Copilot token response fields");
  }
  return {
    token,
    expires: expiresAt * 1000 - 5 * 60 * 1000,
    copilotBaseUrl: getCopilotBaseUrl(token, enterpriseDomain),
  };
}

/** Enable a single Copilot model policy; resolves to success boolean (never throws). */
async function enableCopilotModel(
  copilotToken: string,
  modelId: string,
  copilotBaseUrl: string,
): Promise<boolean> {
  const url = `${copilotBaseUrl}/models/${modelId}/policy`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${copilotToken}`,
        ...COPILOT_HEADERS,
        "openai-intent": "chat-policy",
        "x-interaction-type": "chat-policy",
      },
      body: JSON.stringify({ state: "enabled" }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Best-effort enable all known Copilot model policies after login.
 * Returns true if at least one enable succeeded (or there were none to enable).
 * AFX treats per-model failures as warnings; only a total failure is notable.
 */
async function enableKnownCopilotModels(
  copilotToken: string,
  copilotBaseUrl: string,
  modelIds: readonly string[],
  callbacks: DeviceCodeCallbacks,
): Promise<boolean> {
  if (modelIds.length === 0) {
    return true;
  }
  const results = await Promise.all(
    modelIds.map(async (modelId) => {
      const ok = await enableCopilotModel(copilotToken, modelId, copilotBaseUrl);
      callbacks.onProgress?.(ok ? `Enabled ${modelId}` : `Could not enable ${modelId}`);
      return ok;
    }),
  );
  return results.some(Boolean);
}

/**
 * Run the GitHub Copilot device-code flow end to end and return the normalized
 * Copilot credential. The caller maps this onto an `OAuthRecord`
 * (`access`/`refresh`/`expires`/`meta.enterpriseDomain`/`meta.copilotBaseUrl`)
 * and persists it. Cancellation (signal abort) rejects with OAuthCancelledError.
 */
export async function runDeviceCode(options: DeviceCodeOptions): Promise<CopilotCredential> {
  const { callbacks, signal } = options;
  const log = options.logger.child("oauth:device-code:github-copilot");

  const rawInput = options.enterpriseInput ?? "";
  const enterpriseDomain = normalizeDomain(rawInput) ?? undefined;
  if (rawInput.trim() && !enterpriseDomain) {
    throw new Error("Invalid GitHub Enterprise URL/domain");
  }
  const domain = enterpriseDomain ?? "github.com";

  if (signal?.aborted) {
    throw new OAuthCancelledError();
  }

  const device = await startDeviceFlow(domain);
  callbacks.onUserCode({
    userCode: device.user_code,
    verificationUri: device.verification_uri,
    expiresInMs: device.expires_in * 1000,
  });

  const githubAccessToken = await pollForGitHubAccessToken(
    domain,
    device.device_code,
    device.interval,
    device.expires_in,
    log,
    signal,
  );

  callbacks.onProgress?.("Connecting to Copilot…");
  const { token, expires, copilotBaseUrl } = await exchangeForCopilotToken(
    githubAccessToken,
    enterpriseDomain,
  );

  if (options.enableModels !== false) {
    callbacks.onProgress?.("Enabling models…");
    const anyEnabled = await enableKnownCopilotModels(
      token,
      copilotBaseUrl,
      options.knownModelIds ?? [],
      callbacks,
    );
    if (!anyEnabled && (options.knownModelIds?.length ?? 0) > 0) {
      log.warn("no Copilot model policies could be enabled");
    }
  }

  return {
    access: token,
    refresh: githubAccessToken,
    expires,
    enterpriseDomain,
    copilotBaseUrl,
  };
}
