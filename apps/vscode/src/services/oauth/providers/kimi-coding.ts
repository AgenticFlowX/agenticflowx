/**
 * Kimi Code (subscription) provider descriptor.
 *
 * Uses RFC 8628 device-code grant against https://auth.kimi.com with JSON
 * responses, then maps tokens to the AFX `OAuthRecord` shape.
 */
import { pollOAuthDeviceCodeFlow } from "../device-code-poller";
import type { OAuthProviderDescriptor, OAuthRecord, OAuthSignInContext } from "./types";

const CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";
const DEFAULT_OAUTH_HOST = "https://auth.kimi.com";
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const KIMI_DEFAULT_LIFETIME_SECONDS = 15 * 60;
const REQUEST_TIMEOUT_MS = 30_000;

type JsonObject = Record<string, unknown>;

interface KimiTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface KimiDeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}

function readJson(response: Response): Promise<JsonObject | null> {
  return response
    .json()
    .then((value) => (value && typeof value === "object" ? (value as JsonObject) : null))
    .catch(() => null);
}

function trustedHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function getOauthHost(): string {
  return DEFAULT_OAUTH_HOST;
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...(signal ? [signal] : [])]);
}

function toRecord(response: KimiTokenResponse): OAuthRecord {
  if (
    !response.access_token ||
    !response.refresh_token ||
    typeof response.expires_in !== "number"
  ) {
    throw new Error("Invalid Kimi Code token response fields");
  }
  if (response.expires_in <= 0 || !Number.isFinite(response.expires_in)) {
    throw new Error("Invalid Kimi Code token expiry");
  }
  return {
    access: response.access_token,
    refresh: response.refresh_token,
    expires: Date.now() + response.expires_in * 1000,
  };
}

function asKimiTokenResponse(body: JsonObject): KimiTokenResponse {
  if (
    typeof body["access_token"] !== "string" ||
    typeof body["refresh_token"] !== "string" ||
    typeof body["expires_in"] !== "number"
  ) {
    throw new Error("Invalid Kimi Code token response");
  }
  return {
    access_token: body["access_token"],
    refresh_token: body["refresh_token"],
    expires_in: body["expires_in"],
  };
}

async function startDeviceCode(signal?: AbortSignal): Promise<KimiDeviceAuthorization> {
  const response = await fetch(`${getOauthHost()}/api/oauth/device_authorization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ client_id: CLIENT_ID }),
    signal: withTimeout(signal),
  });

  const raw = await readJson(response);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Kimi Code device authorization failed (${response.status})${text ? `: ${text}` : ""}`,
    );
  }

  const safeRaw = raw ?? {};
  const deviceCode = safeRaw["device_code"];
  const userCode = safeRaw["user_code"];
  const verificationUri = trustedHttpUrl(safeRaw["verification_uri"]);
  const verificationUriComplete = trustedHttpUrl(safeRaw["verification_uri_complete"]);
  const interval = safeRaw["interval"];
  const expiresIn = safeRaw["expires_in"];

  if (
    typeof deviceCode !== "string" ||
    typeof userCode !== "string" ||
    !verificationUri ||
    !verificationUriComplete
  ) {
    throw new Error(`Invalid Kimi Code device authorization response: ${JSON.stringify(raw)}`);
  }

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    intervalSeconds:
      typeof interval === "number" && Number.isFinite(interval) && interval > 0
        ? interval
        : DEFAULT_POLL_INTERVAL_SECONDS,
    expiresInSeconds:
      typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
        ? expiresIn
        : KIMI_DEFAULT_LIFETIME_SECONDS,
  };
}

async function pollForToken(
  device: KimiDeviceAuthorization,
  signal?: AbortSignal,
): Promise<OAuthRecord> {
  return pollOAuthDeviceCodeFlow<OAuthRecord>({
    intervalSeconds: device.intervalSeconds,
    expiresInSeconds: device.expiresInSeconds,
    waitBeforeFirstPoll: true,
    signal,
    poll: async () => {
      const response = await fetch(`${getOauthHost()}/api/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          device_code: device.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
        signal: withTimeout(signal),
      });

      const raw = await readJson(response);
      if (!raw) {
        return { status: "failed", message: "Kimi Code token response was invalid JSON" };
      }

      const accessToken = raw["access_token"];
      if (response.ok && typeof accessToken === "string") {
        try {
          return { status: "complete", value: toRecord(asKimiTokenResponse(raw)) };
        } catch (error) {
          return {
            status: "failed",
            message: error instanceof Error ? error.message : "Invalid Kimi Code token response",
          };
        }
      }

      if (response.status >= 500) {
        const text = await response.text().catch(() => "");
        return {
          status: "failed",
          message: `Kimi Code token request failed with status ${response.status}${text ? `: ${text}` : ""}`,
        };
      }

      const error = raw["error"];
      if (error === "authorization_pending") {
        return { status: "pending" };
      }
      if (error === "slow_down") {
        const interval = raw["interval"];
        return {
          status: "slow_down",
          intervalSeconds:
            typeof interval === "number" && interval > 0 ? interval : DEFAULT_POLL_INTERVAL_SECONDS,
        };
      }
      if (error === "expired_token") {
        return {
          status: "failed",
          message: "Kimi Code device authorization expired. Please restart login.",
        };
      }
      if (error === "access_denied") {
        return { status: "failed", message: "Kimi Code login was denied." };
      }
      const description =
        typeof raw["error_description"] === "string" ? `: ${raw["error_description"]}` : "";
      return {
        status: "failed",
        message: `Kimi Code token request failed (${response.status})${description}`,
      };
    },
  });
}

async function refreshKimi(record: OAuthRecord): Promise<OAuthRecord> {
  const response = await fetch(`${getOauthHost()}/api/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: record.refresh,
    }),
    signal: withTimeout(AbortSignal.timeout(REQUEST_TIMEOUT_MS)),
  });

  const raw = await readJson(response);
  if (!response.ok) {
    const responseError = raw ? raw["error"] : undefined;
    const error = typeof responseError === "string" ? responseError : `HTTP ${response.status}`;
    throw new Error(`Kimi Code token refresh failed (${error})`);
  }
  if (!raw) {
    throw new Error("Invalid Kimi Code token response");
  }
  return toRecord(asKimiTokenResponse(raw));
}

async function begin(context: OAuthSignInContext): Promise<OAuthRecord> {
  const device = await startDeviceCode(context.signal);
  context.callbacks.onUserCode?.({
    userCode: device.userCode,
    verificationUri: device.verificationUriComplete || device.verificationUri,
    expiresInMs: device.expiresInSeconds * 1000,
  });
  context.logger.info("starting Kimi Code device-code flow");
  context.callbacks.onProgress?.("Waiting for Kimi authorization...");
  return pollForToken(device, context.signal);
}

export const kimiCodingOAuthProvider: OAuthProviderDescriptor = {
  id: "kimi-coding",
  displayName: "Kimi For Coding",
  flow: "device-code",
  dualMethod: true,
  authorizeUrl: `${DEFAULT_OAUTH_HOST}/api/oauth/device_authorization`,
  tokenUrl: `${DEFAULT_OAUTH_HOST}/api/oauth/token`,
  scopes: "",
  clientId: CLIENT_ID,
  begin,

  async refresh(record: OAuthRecord): Promise<OAuthRecord> {
    const refreshed = await refreshKimi(record);
    return {
      ...record,
      access: refreshed.access,
      refresh: refreshed.refresh,
      expires: refreshed.expires,
    };
  },

  credToKey(record: OAuthRecord): string {
    return record.access;
  },
};
