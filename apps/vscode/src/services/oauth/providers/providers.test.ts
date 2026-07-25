import { afterEach, describe, expect, it, vi } from "vitest";

import { BUILT_IN_OAUTH_PROVIDERS, getOAuthProvider } from ".";
import { anthropicOAuthProvider } from "./anthropic";
import {
  exchangeForCopilotToken,
  getGitHubCopilotBaseUrl,
  githubCopilotOAuthProvider,
} from "./github-copilot";
import { openaiCodexOAuthProvider } from "./openai-codex";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Failure",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function jwtWithAccount(accountId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } }),
  )
    .toString("base64url")
    .replace(/=/g, "");
  return `header.${payload}.signature`;
}

describe("OAuth provider registry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("registers the three Pi built-in OAuth providers with method metadata", () => {
    expect(BUILT_IN_OAUTH_PROVIDERS.map((provider) => provider.id)).toEqual([
      "anthropic",
      "github-copilot",
      "openai-codex",
      "openrouter",
      "kimi-coding",
      "xai",
    ]);
    expect(getOAuthProvider("anthropic")?.dualMethod).toBe(true);
    expect(getOAuthProvider("openai-codex")?.dualMethod).toBe(false);
    expect(getOAuthProvider("github-copilot")?.flow).toBe("device-code");
    expect(getOAuthProvider("openrouter")?.flow).toBe("pkce-loopback");
    expect(getOAuthProvider("kimi-coding")?.flow).toBe("device-code");
    expect(getOAuthProvider("xai")?.flow).toBe("device-code");
  });

  it("builds Anthropic authorize URLs with verifier-as-state", async () => {
    const auth = await anthropicOAuthProvider.buildAuthUrl?.();
    if (!auth) throw new Error("expected auth url");
    const url = new URL(auth.url);

    expect(url.origin + url.pathname).toBe("https://claude.ai/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:53692/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(auth.verifier);
  });

  it("builds OpenAI Codex authorize URLs with Codex flags and separate state", async () => {
    const auth = await openaiCodexOAuthProvider.buildAuthUrl?.();
    if (!auth) throw new Error("expected auth url");
    const url = new URL(auth.url);

    expect(url.origin + url.pathname).toBe("https://auth.openai.com/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:1455/auth/callback");
    expect(url.searchParams.get("originator")).toBe("pi");
    expect(url.searchParams.get("codex_cli_simplified_flow")).toBe("true");
    expect(url.searchParams.get("state")).toBe(auth.state);
    expect(auth.state).not.toBe(auth.verifier);
  });

  it("maps Anthropic exchange responses into Pi-compatible OAuth records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          access_token: "sk-ant-oat-access",
          refresh_token: "refresh",
          expires_in: 3600,
          scope: "user:profile user:inference",
        }),
      ),
    );

    const record = await anthropicOAuthProvider.exchange?.({
      code: "code",
      state: "state",
      verifier: "verifier",
      redirectUri: "http://localhost:53692/callback",
    });

    expect(record).toMatchObject({
      access: "sk-ant-oat-access",
      refresh: "refresh",
      scopes: ["user:profile", "user:inference"],
    });
    expect(record?.expires).toBeGreaterThan(Date.now());
  });

  it("extracts OpenAI Codex account metadata from the access-token JWT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          access_token: jwtWithAccount("acct_123"),
          refresh_token: "refresh",
          expires_in: 3600,
        }),
      ),
    );

    const record = await openaiCodexOAuthProvider.exchange?.({
      code: "code",
      state: "state",
      verifier: "verifier",
      redirectUri: "http://localhost:1455/auth/callback",
    });

    expect(record?.meta?.accountId).toBe("acct_123");
    expect(openaiCodexOAuthProvider.credToKey(record!)).toBe(record?.access);
  });

  it("derives Copilot base URLs and preserves enterprise metadata", async () => {
    expect(getGitHubCopilotBaseUrl()).toBe("https://api.individual.githubcopilot.com");
    expect(getGitHubCopilotBaseUrl(undefined, "company.ghe.com")).toBe(
      "https://copilot-api.company.ghe.com",
    );
    expect(getGitHubCopilotBaseUrl("tid=1;proxy-ep=proxy.company.ghe.com;")).toBe(
      "https://api.company.ghe.com",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ token: "tid=1;proxy-ep=proxy.company.ghe.com;", expires_at: 2_000 }),
      ),
    );

    const record = await exchangeForCopilotToken("github-token", "company.ghe.com");

    expect(record.refresh).toBe("github-token");
    expect(record.meta).toMatchObject({
      enterpriseDomain: "company.ghe.com",
      copilotBaseUrl: "https://api.company.ghe.com",
    });
    expect(githubCopilotOAuthProvider.credToKey(record)).toBe(record.access);
  });
});
