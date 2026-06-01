/**
 * Anthropic (Claude Pro/Max) OAuth provider descriptor — PKCE authorization-code
 * loopback flow. The descriptor records the AFX-owned Claude subscription contract:
 * client id, fixed loopback redirect URI, scopes, token endpoint, and refresh
 * safety window. The bundled Pi SDK consumes the resulting subscription token via
 * AFX credential injection. Anthropic is the one dual-method provider: a single id
 * serves both `subscription` (this flow) and `api-key`.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-4] [FR-6] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
import { generatePKCE } from "./pkce";
import type { BuildAuthUrlResult, OAuthProviderDescriptor, OAuthRecord } from "./types";

/** Anthropic OAuth client id for Claude subscription sign-in. */
const CLIENT_ID = atob("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl");
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CALLBACK_PORT = 53692;
const CALLBACK_PATH = "/callback";
/** redirect_uri host is `localhost` (the registered value) — NOT the bind host. */
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPES =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";
/** Anthropic refresh deadline keeps a 5-minute safety buffer before expiry. */
const SAFETY_BUFFER_MS = 5 * 60 * 1000;

interface AnthropicTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

async function postJson(body: Record<string, string | number>): Promise<AnthropicTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic token request failed (${response.status})`);
  }
  return JSON.parse(text) as AnthropicTokenResponse;
}

function toRecord(data: AnthropicTokenResponse, previous?: OAuthRecord): OAuthRecord {
  const scopes = data.scope ? data.scope.split(/\s+/).filter(Boolean) : previous?.scopes;
  const record: OAuthRecord = {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000 - SAFETY_BUFFER_MS,
  };
  if (scopes && scopes.length > 0) {
    record.scopes = scopes;
  }
  if (previous?.meta) {
    record.meta = { ...previous.meta };
  }
  return record;
}

export const anthropicOAuthProvider: OAuthProviderDescriptor = {
  id: "anthropic",
  displayName: "Anthropic",
  flow: "pkce-loopback",
  port: CALLBACK_PORT,
  callbackPath: CALLBACK_PATH,
  redirectUri: REDIRECT_URI,
  dualMethod: true,
  authorizeUrl: AUTHORIZE_URL,
  tokenUrl: TOKEN_URL,
  scopes: SCOPES,
  clientId: CLIENT_ID,

  async buildAuthUrl(): Promise<BuildAuthUrlResult> {
    const { verifier, challenge } = await generatePKCE();
    // Anthropic requires the PKCE verifier to be echoed as OAuth `state`.
    const params = new URLSearchParams({
      code: "true",
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: verifier,
    });
    return { url: `${AUTHORIZE_URL}?${params.toString()}`, verifier, state: verifier };
  },

  async exchange({ code, state, verifier, redirectUri }): Promise<OAuthRecord> {
    const data = await postJson({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      state,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    return toRecord(data);
  },

  async refresh(record: OAuthRecord): Promise<OAuthRecord> {
    const data = await postJson({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: record.refresh,
    });
    return toRecord(data, record);
  },

  credToKey(record: OAuthRecord): string {
    return record.access;
  },
};
