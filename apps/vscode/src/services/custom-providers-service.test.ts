/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [FR-10]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 * @see docs/specs/351-agent-pi/spec.md [FR-5]
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import type { CustomProviderRecord } from "@afx/shared";

import { createMockLogger } from "../__fixtures__/mock-logger";
import { createCustomProvidersAdapter } from "../agent-factory";
import { SecretStore } from "../secret-store";
import { createCustomProvidersService } from "./custom-providers-service";

function createMockContext(): vscode.ExtensionContext {
  const values = new Map<string, string>();
  return {
    secrets: {
      get: vi.fn(async (key: string) => values.get(key)),
      store: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
      onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
    },
  } as unknown as vscode.ExtensionContext;
}

const SAMPLE_RECORD: CustomProviderRecord = {
  id: "ollama",
  baseUrl: "http://localhost:11434/v1",
  api: "openai-completions",
  apiKeyRef: { source: "none" },
  models: [{ id: "qwen3:30b", name: "Qwen3 30B", contextWindow: 32_000, maxTokens: 8_000 }],
};

const OPENROUTER_RECORD: CustomProviderRecord = {
  id: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  api: "openai-completions",
  apiKey: "sk-or-test",
  apiKeyRef: { source: "vscode-secret", label: "AFX_OPENROUTER_KEY" },
  models: [
    {
      id: "anthropic/claude-sonnet-4",
      name: "Claude Sonnet 4",
      contextWindow: 200_000,
      maxTokens: 16_000,
    },
  ],
};

let scratchDir: string;

beforeEach(() => {
  scratchDir = mkdtempSync(join(tmpdir(), "afx-custom-providers-test-"));
});
afterEach(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("createCustomProvidersService — snapshot", () => {
  it("includes pi-sdk providers from SecretStorage", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const adapter = createCustomProvidersAdapter();
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter,
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    await secretStore.setCustomProviderRecord(SAMPLE_RECORD);
    const snapshot = await service.getSnapshot();
    expect(snapshot.activeHarness).toBe("pi-sdk");
    expect(snapshot.piSdk.providers.map((p) => p.id)).toEqual(["ollama"]);
    expect(snapshot.piSdk.providers[0]?.modelCount).toBe(1);
    service.dispose();
  });

  it("never leaks the apiKey value or full compat/headers into the snapshot", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    const sensitiveRecord = {
      ...OPENROUTER_RECORD,
      headers: { "x-portkey-api-key": "header-secret" },
      compat: { supportsLongCacheRetention: true },
    };
    await secretStore.setCustomProviderRecord(sensitiveRecord);
    const snapshot = await service.getSnapshot();
    const json = JSON.stringify(snapshot);
    expect(json).not.toContain("sk-or-test");
    expect(json).not.toContain("header-secret");
    expect(json).not.toContain("x-portkey-api-key");
    expect(json).not.toContain("supportsLongCacheRetention");
    // Model id IS allowed in the redacted summary so the user can see what's configured.
    expect(json).toContain("anthropic/claude-sonnet-4");
    service.dispose();
  });

  it("returns missing status when hand-edited file does not exist", async () => {
    const ctx = createMockContext();
    const service = createCustomProvidersService({
      context: ctx,
      secretStore: new SecretStore(ctx),
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    const snapshot = await service.getSnapshot();
    expect(snapshot.piRpc?.status).toBe("missing");
    service.dispose();
  });

  it("surfaces hand-edited entries when file is present", async () => {
    const ctx = createMockContext();
    const handEditedPath = join(scratchDir, "models.json");
    writeFileSync(
      handEditedPath,
      JSON.stringify({
        providers: {
          "moonshot-open": {
            baseUrl: "https://api.moonshot.ai/v1",
            api: "openai-completions",
            apiKey: "sk-literal-on-disk",
            models: [{ id: "kimi-k2.6", name: "Kimi K2.6" }],
          },
        },
      }),
      "utf-8",
    );
    const service = createCustomProvidersService({
      context: ctx,
      secretStore: new SecretStore(ctx),
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: handEditedPath,
    });
    const snapshot = await service.getSnapshot();
    expect(snapshot.piRpc?.status).toBe("ready");
    expect(snapshot.piRpc?.providers[0]).toMatchObject({
      id: "moonshot-open",
      origin: "hand-edited",
      hasLiteralApiKeyOnDisk: true,
    });
    service.dispose();
  });
});

describe("createCustomProvidersService — applyMutation", () => {
  it("upserts a provider when input is valid", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    const result = await service.applyMutation({
      kind: "upsertProvider",
      provider: {
        id: "ollama",
        baseUrl: "http://localhost:11434/v1",
        api: "openai-completions",
        apiKeyRef: { source: "none" },
        models: [{ id: "qwen3:30b", name: "Qwen3 30B" }],
      },
    });
    expect(result.ok).toBe(true);
    const stored = await secretStore.getCustomProviderRecord("ollama");
    expect(stored?.id).toBe("ollama");
    service.dispose();
  });

  it("rejects invalid provider ids", async () => {
    const ctx = createMockContext();
    const service = createCustomProvidersService({
      context: ctx,
      secretStore: new SecretStore(ctx),
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    const result = await service.applyMutation({
      kind: "upsertProvider",
      provider: {
        id: "has spaces",
        baseUrl: "https://x",
        api: "openai-completions",
        apiKeyRef: { source: "none" },
        models: [{ id: "m", name: "M" }],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid provider id/);
    service.dispose();
  });

  it("rejects vscode-secret source without an apiKeyValue", async () => {
    const ctx = createMockContext();
    const service = createCustomProvidersService({
      context: ctx,
      secretStore: new SecretStore(ctx),
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    const result = await service.applyMutation({
      kind: "upsertProvider",
      provider: {
        id: "openrouter",
        baseUrl: "https://x",
        api: "openai-completions",
        apiKeyRef: { source: "vscode-secret", label: "AFX_OPENROUTER_KEY" },
        models: [{ id: "m", name: "M" }],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/apiKeyValue/);
    service.dispose();
  });

  it("removes a provider", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    await secretStore.setCustomProviderRecord(SAMPLE_RECORD);
    const result = await service.applyMutation({
      kind: "removeProvider",
      providerId: "ollama",
    });
    expect(result.ok).toBe(true);
    await expect(secretStore.getCustomProviderRecord("ollama")).resolves.toBeUndefined();
    service.dispose();
  });

  it("upserts a single model on an existing provider", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    await secretStore.setCustomProviderRecord(SAMPLE_RECORD);
    const result = await service.applyMutation({
      kind: "upsertModel",
      providerId: "ollama",
      model: { id: "qwen3:14b", name: "Qwen3 14B" },
    });
    expect(result.ok).toBe(true);
    const stored = await secretStore.getCustomProviderRecord("ollama");
    expect(stored?.models.map((m) => m.id).sort()).toEqual(["qwen3:14b", "qwen3:30b"]);
    service.dispose();
  });

  it("refuses to remove the last model on a provider", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    await secretStore.setCustomProviderRecord(SAMPLE_RECORD);
    const result = await service.applyMutation({
      kind: "removeModel",
      providerId: "ollama",
      modelId: "qwen3:30b",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least one model/);
    service.dispose();
  });
});

describe("createCustomProvidersService — bootstrap env", () => {
  it("returns empty when no AFX records are stored", async () => {
    const ctx = createMockContext();
    const service = createCustomProvidersService({
      context: ctx,
      secretStore: new SecretStore(ctx),
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    await expect(service.buildEnvForPiSdkSpawn()).resolves.toEqual({});
    service.dispose();
  });

  it("ships AFX_CUSTOM_PROVIDERS_JSON and AFX_<ID>_KEY entries when records exist", async () => {
    const ctx = createMockContext();
    const secretStore = new SecretStore(ctx);
    const service = createCustomProvidersService({
      context: ctx,
      secretStore,
      adapter: createCustomProvidersAdapter(),
      logger: createMockLogger().logger,
      handEditedConfigPath: join(scratchDir, "models.json"),
    });
    await secretStore.setCustomProviderRecord(OPENROUTER_RECORD);
    const env = await service.buildEnvForPiSdkSpawn();
    expect(env["AFX_CUSTOM_PROVIDERS_JSON"]).toContain("openrouter");
    expect(env["AFX_OPENROUTER_KEY"]).toBe("sk-or-test");
    // The envelope itself must use the env-var ref, not the literal.
    const envelope = JSON.parse(env["AFX_CUSTOM_PROVIDERS_JSON"]!) as {
      providers: Record<string, { apiKey?: string }>;
    };
    expect(envelope.providers["openrouter"]?.apiKey).toBe("AFX_OPENROUTER_KEY");
    service.dispose();
  });
});
