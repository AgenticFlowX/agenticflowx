/**
 * OpenAI Codex (ChatGPT Plus/Pro) OAuth provider descriptor — PKCE authorization-code
 * loopback flow. The descriptor records the AFX-owned ChatGPT subscription contract:
 * client id, fixed loopback redirect URI, Codex authorize flags, originator value,
 * scopes, token endpoint, and the `chatgpt_account_id` JWT claim the SDK path needs
 * at request time. Subscription-only: the metered path is the separate `openai` card,
 * so `dualMethod` is false.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-4] [FR-5] [FR-6] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
import { createRandomState, generatePKCE } from "./pkce";
import type { BuildAuthUrlResult, OAuthProviderDescriptor, OAuthRecord } from "./types";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const CALLBACK_PORT = 1455;
const CALLBACK_PATH = "/auth/callback";
/** redirect_uri host is `localhost` (the registered value) — NOT the bind host. */
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPE = "openid profile email offline_access";
/** Originator value expected by the bundled SDK provider path. */
const ORIGINATOR = "pi";
/** JWT claim namespace carrying `chatgpt_account_id`. */
const JWT_CLAIM_PATH = "https://api.openai.com/auth";

interface CodexTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface CodexJwtPayload {
  [JWT_CLAIM_PATH]?: { chatgpt_account_id?: string };
  [key: string]: unknown;
}

/** Decode a JWT payload (base64url, middle segment); returns null on any malformed input. */
function decodeJwt(token: string): CodexJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1] ?? "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as CodexJwtPayload;
  } catch {
    return null;
  }
}

/** Extract `chatgpt_account_id` from the access-token JWT. */
function getAccountId(accessToken: string): string | null {
  const auth = decodeJwt(accessToken)?.[JWT_CLAIM_PATH];
  const accountId = auth?.chatgpt_account_id;
  return typeof accountId === "string" && accountId.length > 0 ? accountId : null;
}

async function postForm(body: Record<string, string>): Promise<CodexTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!response.ok) {
    throw new Error(`OpenAI Codex token request failed (${response.status})`);
  }
  return (await response.json()) as CodexTokenResponse;
}

function toRecord(data: CodexTokenResponse, previous?: OAuthRecord): OAuthRecord {
  if (!data.access_token || !data.refresh_token || typeof data.expires_in !== "number") {
    throw new Error("OpenAI Codex token response missing fields");
  }
  const accountId = getAccountId(data.access_token);
  if (!accountId) {
    throw new Error("Failed to extract accountId from OpenAI Codex token");
  }
  // OpenAI Codex token expiry is used as issued; no refresh buffer is applied.
  const record: OAuthRecord = {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
    meta: { ...previous?.meta, accountId },
  };
  return record;
}

export const openaiCodexOAuthProvider: OAuthProviderDescriptor = {
  id: "openai-codex",
  displayName: "ChatGPT (Codex)",
  flow: "pkce-loopback",
  port: CALLBACK_PORT,
  callbackPath: CALLBACK_PATH,
  redirectUri: REDIRECT_URI,
  dualMethod: false,
  authorizeUrl: AUTHORIZE_URL,
  tokenUrl: TOKEN_URL,
  scopes: SCOPE,
  clientId: CLIENT_ID,

  async buildAuthUrl(): Promise<BuildAuthUrlResult> {
    const { verifier, challenge } = await generatePKCE();
    const state = createRandomState();
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    url.searchParams.set("id_token_add_organizations", "true");
    url.searchParams.set("codex_cli_simplified_flow", "true");
    url.searchParams.set("originator", ORIGINATOR);
    return { url: url.toString(), verifier, state };
  },

  async exchange({ code, verifier, redirectUri }): Promise<OAuthRecord> {
    const data = await postForm({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
    return toRecord(data);
  },

  async refresh(record: OAuthRecord): Promise<OAuthRecord> {
    const data = await postForm({
      grant_type: "refresh_token",
      refresh_token: record.refresh,
      client_id: CLIENT_ID,
    });
    return toRecord(data, record);
  },

  credToKey(record: OAuthRecord): string {
    return record.access;
  },
};
