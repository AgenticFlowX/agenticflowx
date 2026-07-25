/**
 * xAI (Grok) OAuth provider descriptor.
 *
 * Uses RFC 8628 device-code grant and token refresh.
 */
import { pollOAuthDeviceCodeFlow } from "../device-code-poller";
import type { OAuthProviderDescriptor, OAuthRecord, OAuthSignInContext } from "./types";

const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_SCOPE = "openid profile email offline_access grok-cli:access api:access";
const AUTH_URL = "https://auth.x.ai/oauth2/device/code";
const TOKEN_URL = "https://auth.x.ai/oauth2/token";
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;

interface JsonObject {
  [key: string]: unknown;
}

const DEFAULT_POLL_SECONDS = 5;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

function readJson(response: Response): Promise<JsonObject | null> {
  return response
    .json()
    .then((value) => (value && typeof value === "object" ? (value as JsonObject) : null))
    .catch(() => null);
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...(signal ? [signal] : [])]);
}

function requiredString(body: JsonObject, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid xAI OAuth response field: ${field}`);
  }
  return value;
}

function requiredNumber(body: JsonObject, field: string, fallback?: number): number {
  const value = body[field];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Invalid xAI OAuth response field: ${field}`);
}

function positiveHttpsUri(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function requestFailure(action: string, response: Response, body: JsonObject | null): Error {
  const status = response.status;
  const rawBody = body ?? {};
  const error = typeof rawBody["error"] === "string" ? rawBody["error"] : undefined;
  const description =
    typeof rawBody["error_description"] === "string" ? rawBody["error_description"] : undefined;
  const detail = [error, description].filter(Boolean).join(": ");
  return new Error(`xAI OAuth ${action} failed (HTTP ${status})${detail ? `: ${detail}` : ""}`);
}

async function startDeviceCode(signal?: AbortSignal): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}> {
  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: XAI_CLIENT_ID,
      scope: XAI_SCOPE,
      referrer: "pi",
    }),
    signal: withTimeout(signal),
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw requestFailure("device authorization", response, body);
  }
  if (!body) {
    throw new Error("xAI OAuth device authorization returned invalid JSON");
  }

  const verificationUri = requiredString(body, "verification_uri");
  const verificationUriParsed = positiveHttpsUri(verificationUri);
  const verificationUriCompleteRaw = positiveHttpsUri(body["verification_uri_complete"]);
  if (!verificationUriParsed) {
    throw new Error("Invalid xAI verification URI");
  }

  return {
    deviceCode: requiredString(body, "device_code"),
    userCode: requiredString(body, "user_code"),
    verificationUri: verificationUriParsed,
    verificationUriComplete: verificationUriCompleteRaw ?? verificationUriParsed,
    intervalSeconds:
      typeof body["interval"] === "number" &&
      Number.isFinite(body["interval"]) &&
      body["interval"] > 0
        ? body["interval"]
        : DEFAULT_POLL_SECONDS,
    expiresInSeconds: requiredNumber(body, "expires_in", 15 * 60),
  };
}

function toRecord(body: JsonObject, priorRefreshToken?: string): OAuthRecord {
  const access = requiredString(body, "access_token");
  const refreshFromPayload =
    typeof body["refresh_token"] === "string" && body["refresh_token"].length > 0
      ? body["refresh_token"]
      : null;
  const refresh =
    refreshFromPayload ??
    priorRefreshToken ??
    (() => {
      throw new Error("xAI OAuth refresh response missing refresh token");
    })();
  const expiresIn =
    typeof body["expires_in"] === "number" &&
    Number.isFinite(body["expires_in"]) &&
    body["expires_in"] > 0
      ? body["expires_in"]
      : DEFAULT_TOKEN_LIFETIME_SECONDS;
  return {
    access,
    refresh,
    expires: Date.now() + expiresIn * 1000 - REFRESH_SKEW_MS,
  };
}

async function pollForToken(
  device: {
    deviceCode: string;
    intervalSeconds: number;
    expiresInSeconds: number;
  },
  signal?: AbortSignal,
): Promise<OAuthRecord> {
  return pollOAuthDeviceCodeFlow<OAuthRecord>({
    intervalSeconds: device.intervalSeconds,
    expiresInSeconds: device.expiresInSeconds,
    waitBeforeFirstPoll: true,
    signal,
    poll: async () => {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: XAI_CLIENT_ID,
          device_code: device.deviceCode,
        }),
        signal: withTimeout(signal),
      });

      const body = await readJson(response);
      if (!body) {
        return { status: "failed", message: "xAI token response was invalid JSON" };
      }
      if (response.ok) {
        try {
          return { status: "complete", value: toRecord(body) };
        } catch (error) {
          return {
            status: "failed",
            message: error instanceof Error ? error.message : "Invalid xAI token response",
          };
        }
      }

      const error = body["error"];
      if (error === "authorization_pending") {
        return { status: "pending" };
      }
      if (error === "slow_down") {
        const interval = body["interval"];
        return {
          status: "slow_down",
          intervalSeconds:
            typeof interval === "number" && Number.isFinite(interval) ? interval : undefined,
        };
      }
      if (error === "access_denied" || error === "authorization_denied") {
        return { status: "failed", message: "xAI device authorization was denied" };
      }
      if (error === "expired_token") {
        return { status: "failed", message: "xAI device code expired" };
      }
      return {
        status: "failed",
        message: requestFailure("device token polling", response, body).message,
      };
    },
  });
}

async function refreshToken(record: OAuthRecord): Promise<OAuthRecord> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: XAI_CLIENT_ID,
      refresh_token: record.refresh,
    }),
    signal: withTimeout(AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw requestFailure("token refresh", response, body);
  }
  if (!body) {
    throw new Error("xAI OAuth token refresh returned invalid JSON");
  }
  return toRecord(body, record.refresh);
}

async function begin(context: OAuthSignInContext): Promise<OAuthRecord> {
  const device = await startDeviceCode(context.signal);
  context.callbacks.onUserCode?.({
    userCode: device.userCode,
    verificationUri: device.verificationUriComplete,
    expiresInMs: device.expiresInSeconds * 1000,
  });
  context.callbacks.onProgress?.("Waiting for xAI authorization...");
  return pollForToken(device, context.signal);
}

export const xaiOAuthProvider: OAuthProviderDescriptor = {
  id: "xai",
  displayName: "xAI",
  flow: "device-code",
  dualMethod: true,
  authorizeUrl: AUTH_URL,
  tokenUrl: TOKEN_URL,
  scopes: XAI_SCOPE,
  clientId: XAI_CLIENT_ID,
  begin,
  async refresh(record: OAuthRecord): Promise<OAuthRecord> {
    return refreshToken(record);
  },
  credToKey(record: OAuthRecord): string {
    return record.access;
  },
};
