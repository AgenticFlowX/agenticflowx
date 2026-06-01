import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OAuthProviderId, OAuthRecord, ProviderAuthMethod } from "@afx/shared";

import { createMockLogger } from "../../__fixtures__/mock-logger";
import { createOAuthService } from "./oauth-service";
import type { OAuthProviderDescriptor } from "./providers/types";

class MemorySecretStore {
  readonly apiKeys = new Map<string, string>();
  readonly oauth = new Map<string, OAuthRecord>();
  readonly methods = new Map<string, ProviderAuthMethod>();

  async getApiKey(provider: string): Promise<string | undefined> {
    return this.apiKeys.get(provider);
  }

  async getOAuth(provider: string): Promise<OAuthRecord | undefined> {
    return this.oauth.get(provider);
  }

  async setOAuth(provider: string, record: OAuthRecord): Promise<void> {
    this.oauth.set(provider, record);
  }

  async clearOAuth(provider: string): Promise<void> {
    this.oauth.delete(provider);
  }

  async getAuthMethod(provider: string): Promise<ProviderAuthMethod | undefined> {
    return this.methods.get(provider);
  }

  async setAuthMethod(provider: string, method: ProviderAuthMethod): Promise<void> {
    this.methods.set(provider, method);
  }

  async clearAuthMethod(provider: string): Promise<void> {
    this.methods.delete(provider);
  }
}

function record(access: string, expires = Date.now() + 60_000): OAuthRecord {
  return { access, refresh: `${access}-refresh`, expires, meta: { planLabel: "Pro" } };
}

function descriptor(overrides: Partial<OAuthProviderDescriptor> = {}): OAuthProviderDescriptor {
  return {
    id: "anthropic",
    displayName: "Anthropic",
    flow: "pkce-loopback",
    port: 53692,
    callbackPath: "/callback",
    redirectUri: "http://localhost:53692/callback",
    dualMethod: true,
    authorizeUrl: "https://example.com/oauth/authorize",
    tokenUrl: "https://example.com/oauth/token",
    scopes: "scope",
    clientId: "client",
    exchange: vi.fn(async () => record("signed-in")),
    refresh: vi.fn(async () => record("fresh")),
    credToKey: (stored) => stored.access,
    ...overrides,
  };
}

async function makeService(input: {
  store?: MemorySecretStore;
  provider?: OAuthProviderDescriptor;
  runPkceLoopback?: Parameters<typeof createOAuthService>[0]["runPkceLoopback"];
}) {
  const store = input.store ?? new MemorySecretStore();
  const provider = input.provider ?? descriptor();
  const { logger } = createMockLogger();
  const dir = await mkdtemp(join(tmpdir(), "afx-oauth-service-"));
  return {
    store,
    provider,
    service: createOAuthService({
      secretStore: store as never,
      logger,
      globalStorageUri: { fsPath: dir } as never,
      getProvider: (id: OAuthProviderId) => (id === provider.id ? provider : undefined),
      runPkceLoopback:
        input.runPkceLoopback ??
        vi.fn(async () => ({
          code: "code",
          state: "state",
          verifier: "verifier",
          redirectUri: provider.redirectUri ?? "http://localhost/callback",
          via: "loopback" as const,
        })),
      lock: { retryMs: 1, maxWaitMs: 20, staleMs: 20 },
    }),
  };
}

describe("OAuthService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("signs in through PKCE, stores the record, and returns a redacted snapshot", async () => {
    const provider = descriptor({ exchange: vi.fn(async () => record("oauth-access")) });
    const { service, store } = await makeService({ provider });

    const status = await service.signIn("anthropic");

    expect(store.oauth.get("anthropic")?.access).toBe("oauth-access");
    expect(store.methods.get("anthropic")).toBe("subscription");
    expect(status).toMatchObject({
      provider: "anthropic",
      connected: true,
      activeMethod: "subscription",
      meta: { planLabel: "Pro" },
    });
    expect(JSON.stringify(status)).not.toContain("oauth-access");
    expect(provider.exchange).toHaveBeenCalledWith(
      expect.objectContaining({ code: "code", verifier: "verifier" }),
    );
  });

  it("refreshes expired subscription records on selected-key reads", async () => {
    const store = new MemorySecretStore();
    store.oauth.set("anthropic", record("stale", Date.now() - 1));
    store.methods.set("anthropic", "subscription");
    const provider = descriptor({ refresh: vi.fn(async () => record("fresh-access")) });
    const { service } = await makeService({ store, provider });

    await expect(service.getSelectedProviderKey("anthropic")).resolves.toBe("fresh-access");

    expect(provider.refresh).toHaveBeenCalledWith(expect.objectContaining({ access: "stale" }));
    expect(store.oauth.get("anthropic")?.access).toBe("fresh-access");
  });

  it("force-refreshes unexpired records for proactive runtime reconnect", async () => {
    const store = new MemorySecretStore();
    store.oauth.set("anthropic", record("soon-expiring", Date.now() + 300_000));
    store.methods.set("anthropic", "subscription");
    const provider = descriptor({ refresh: vi.fn(async () => record("rotated-access")) });
    const { service } = await makeService({ store, provider });

    await expect(service.refreshAccessToken("anthropic")).resolves.toBe("rotated-access");

    expect(provider.refresh).toHaveBeenCalledWith(
      expect.objectContaining({ access: "soon-expiring" }),
    );
    expect(store.oauth.get("anthropic")?.access).toBe("rotated-access");
  });

  it("coalesces concurrent refresh-on-read calls for one provider", async () => {
    const store = new MemorySecretStore();
    store.oauth.set("anthropic", record("stale", Date.now() - 1));
    store.methods.set("anthropic", "subscription");
    let releaseRefresh!: () => void;
    let refreshStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const provider = descriptor({
      refresh: vi.fn(
        () =>
          new Promise<OAuthRecord>((resolve) => {
            refreshStarted();
            releaseRefresh = () => resolve(record("fresh-access"));
          }),
      ),
    });
    const { service } = await makeService({ store, provider });

    const first = service.getSelectedProviderKey("anthropic");
    const second = service.getSelectedProviderKey("anthropic");
    await started;
    releaseRefresh();

    await expect(Promise.all([first, second])).resolves.toEqual(["fresh-access", "fresh-access"]);
    expect(provider.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not guess when OAuth and API key both exist but no method is selected", async () => {
    const store = new MemorySecretStore();
    store.oauth.set("anthropic", record("oauth-access"));
    store.apiKeys.set("anthropic", "api-key");
    const { service } = await makeService({ store });

    await expect(service.getSelectedProviderKey("anthropic")).resolves.toBeUndefined();
    expect(store.methods.get("anthropic")).toBeUndefined();
  });

  it("sign-out reverts to api-key only when a key remains, otherwise clears the method", async () => {
    const store = new MemorySecretStore();
    store.oauth.set("anthropic", record("oauth-access"));
    store.methods.set("anthropic", "subscription");
    store.apiKeys.set("anthropic", "api-key");
    const { service } = await makeService({ store });

    await service.signOut("anthropic");
    expect(store.oauth.has("anthropic")).toBe(false);
    expect(store.methods.get("anthropic")).toBe("api-key");

    store.oauth.set("anthropic", record("second"));
    store.methods.set("anthropic", "subscription");
    store.apiKeys.delete("anthropic");

    await service.signOut("anthropic");
    expect(store.methods.get("anthropic")).toBeUndefined();
  });
});
