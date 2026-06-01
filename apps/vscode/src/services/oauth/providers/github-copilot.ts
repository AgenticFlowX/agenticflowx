/**
 * GitHub Copilot OAuth provider descriptor — device-code flow (no loopback server).
 * The descriptor records the AFX-owned Copilot subscription contract: OAuth client
 * id, Copilot editor identity headers, domain-derived token endpoint, `proxy-ep`
 * API base-URL derivation, `read:user` device scope, and the Copilot token refresh
 * safety window used before SDK injection.
 *
 * This module owns the descriptor exchange/refresh seam only. The interactive
 * device-code flow (start + poll + cancel) lives in {@link file://./../device-code.ts}
 * and is the single implementation OAuthService drives at sign-in. What remains:
 * {@link exchangeForCopilotToken} re-mints the Copilot token from the stored GitHub
 * token, and {@link getGitHubCopilotBaseUrl} derives the SDK provider base-URL
 * override. Subscription-only: `dualMethod` is false.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-3] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
import type { OAuthProviderDescriptor, OAuthRecord } from "./types";

/** GitHub OAuth app client id used by the Copilot device-code flow. */
const CLIENT_ID = atob("SXYxLmI1MDdhMDhjODdlY2ZlOTg=");

/** Copilot editor identity headers required by the Copilot token endpoints. */
const COPILOT_HEADERS = {
  "User-Agent": "GitHubCopilotChat/0.35.0",
  "Editor-Version": "vscode/1.107.0",
  "Editor-Plugin-Version": "copilot-chat/0.35.0",
  "Copilot-Integration-Id": "vscode-chat",
} as const;

const DEVICE_SCOPE = "read:user";
/** Copilot token refresh deadline keeps a 5-minute safety buffer before expiry. */
const SAFETY_BUFFER_MS = 5 * 60 * 1000;
const DEFAULT_BASE_URL = "https://api.individual.githubcopilot.com";

/** Copilot token-exchange endpoint for a (possibly enterprise) domain. */
function copilotTokenUrl(domain: string): string {
  return `https://api.${domain}/copilot_internal/v2/token`;
}

/** Parse `proxy-ep=...` from a Copilot token and convert `proxy.*` → `api.*` base URL. */
function getBaseUrlFromToken(token: string): string | null {
  const match = token.match(/proxy-ep=([^;]+)/);
  if (!match || !match[1]) {
    return null;
  }
  return `https://${match[1].replace(/^proxy\./, "api.")}`;
}

/** Resolve the Copilot API base URL from token `proxy-ep`, enterprise domain, or default. */
export function getGitHubCopilotBaseUrl(token?: string, enterpriseDomain?: string): string {
  if (token) {
    const urlFromToken = getBaseUrlFromToken(token);
    if (urlFromToken) {
      return urlFromToken;
    }
  }
  if (enterpriseDomain) {
    return `https://copilot-api.${enterpriseDomain}`;
  }
  return DEFAULT_BASE_URL;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`GitHub Copilot request failed (${response.status})`);
  }
  return response.json();
}

/**
 * Exchange a GitHub access token for a Copilot token via `/copilot_internal/v2/token`,
 * returning a normalized {@link OAuthRecord}. `refresh` stores the GitHub access token;
 * `access` stores the Copilot token; `meta` carries the enterprise domain and derived base URL.
 *
 * Drives the descriptor's exchange-on-`refresh()` path; the interactive
 * device-code start/poll lives in `../device-code.ts`.
 */
export async function exchangeForCopilotToken(
  githubAccessToken: string,
  enterpriseDomain?: string,
): Promise<OAuthRecord> {
  const domain = enterpriseDomain || "github.com";
  const raw = await fetchJson(copilotTokenUrl(domain), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${githubAccessToken}`,
      ...COPILOT_HEADERS,
    },
  });
  const obj = (raw ?? {}) as Record<string, unknown>;
  const token = obj["token"];
  const expiresAt = obj["expires_at"];
  if (typeof token !== "string" || typeof expiresAt !== "number") {
    throw new Error("Invalid Copilot token response fields");
  }
  const baseUrl = getGitHubCopilotBaseUrl(token, enterpriseDomain);
  const meta: OAuthRecord["meta"] = {};
  if (enterpriseDomain) {
    meta.enterpriseDomain = enterpriseDomain;
  }
  if (baseUrl !== DEFAULT_BASE_URL) {
    meta.copilotBaseUrl = baseUrl;
  }
  const record: OAuthRecord = {
    access: token,
    refresh: githubAccessToken,
    expires: expiresAt * 1000 - SAFETY_BUFFER_MS,
  };
  if (Object.keys(meta).length > 0) {
    record.meta = meta;
  }
  return record;
}

export const githubCopilotOAuthProvider: OAuthProviderDescriptor = {
  id: "github-copilot",
  displayName: "GitHub Copilot",
  flow: "device-code",
  dualMethod: false,
  authorizeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: DEVICE_SCOPE,
  clientId: CLIENT_ID,

  async refresh(record: OAuthRecord): Promise<OAuthRecord> {
    // Re-mint the Copilot token by re-exchanging the stored GitHub token.
    const refreshed = await exchangeForCopilotToken(record.refresh, record.meta?.enterpriseDomain);
    if (record.meta?.planLabel && refreshed.meta) {
      refreshed.meta.planLabel = record.meta.planLabel;
    }
    return refreshed;
  },

  credToKey(record: OAuthRecord): string {
    return record.access;
  },
};
