/**
 * SecretStore credential persistence wrapper.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST] [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-10]
 */
import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import type { CustomProviderRecord } from "@afx/shared";

import { CUSTOM_PROVIDERS_INDEX_KEY, SecretStore } from "./secret-store";

function createMockContext(): {
  context: vscode.ExtensionContext;
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  const context = {
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
  return { context, values };
}

const SAMPLE_RECORD: CustomProviderRecord = {
  id: "openrouter",
  displayName: "OpenRouter",
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

describe("SecretStore — provider API keys", () => {
  it("stores, reads, and clears provider API keys", async () => {
    const { context, values } = createMockContext();
    const store = new SecretStore(context);

    await store.setApiKey("anthropic", "sk-test");
    await expect(store.getApiKey("anthropic")).resolves.toBe("sk-test");
    await store.clearApiKey("anthropic");
    await expect(store.getApiKey("anthropic")).resolves.toBeUndefined();

    expect(context.secrets.store).toHaveBeenCalledWith("afx.apiKey.anthropic", "sk-test");
    expect(context.secrets.delete).toHaveBeenCalledWith("afx.apiKey.anthropic");
    expect(values.size).toBe(0);
  });
});

describe("SecretStore — custom-provider records", () => {
  it("persists a record under afx.customProvider.<id> and updates the index", async () => {
    const { context, values } = createMockContext();
    const store = new SecretStore(context);

    await store.setCustomProviderRecord(SAMPLE_RECORD);
    expect(values.get("afx.customProvider.openrouter")).toBe(JSON.stringify(SAMPLE_RECORD));
    expect(values.get(CUSTOM_PROVIDERS_INDEX_KEY)).toBe(JSON.stringify(["openrouter"]));
  });

  it("does not duplicate ids in the index when re-saving the same record", async () => {
    const { context, values } = createMockContext();
    const store = new SecretStore(context);

    await store.setCustomProviderRecord(SAMPLE_RECORD);
    await store.setCustomProviderRecord({ ...SAMPLE_RECORD, displayName: "OR" });
    expect(values.get(CUSTOM_PROVIDERS_INDEX_KEY)).toBe(JSON.stringify(["openrouter"]));
  });

  it("reads back a stored record verbatim", async () => {
    const { context } = createMockContext();
    const store = new SecretStore(context);

    await store.setCustomProviderRecord(SAMPLE_RECORD);
    const got = await store.getCustomProviderRecord("openrouter");
    expect(got).toEqual(SAMPLE_RECORD);
  });

  it("returns undefined for missing records", async () => {
    const { context } = createMockContext();
    const store = new SecretStore(context);
    await expect(store.getCustomProviderRecord("nope")).resolves.toBeUndefined();
  });

  it("returns undefined when stored value is unparsable", async () => {
    const { context, values } = createMockContext();
    values.set("afx.customProvider.broken", "not json");
    const store = new SecretStore(context);
    await expect(store.getCustomProviderRecord("broken")).resolves.toBeUndefined();
  });

  it("deletes the record and removes id from the index", async () => {
    const { context, values } = createMockContext();
    const store = new SecretStore(context);

    await store.setCustomProviderRecord(SAMPLE_RECORD);
    await store.deleteCustomProviderRecord("openrouter");
    expect(values.has("afx.customProvider.openrouter")).toBe(false);
    expect(values.get(CUSTOM_PROVIDERS_INDEX_KEY)).toBe(JSON.stringify([]));
  });

  it("listCustomProviderRecords returns all records via the index", async () => {
    const { context } = createMockContext();
    const store = new SecretStore(context);

    await store.setCustomProviderRecord(SAMPLE_RECORD);
    await store.setCustomProviderRecord({ ...SAMPLE_RECORD, id: "ollama" });
    const list = await store.listCustomProviderRecords();
    expect(list.map((r) => r.id).sort()).toEqual(["ollama", "openrouter"]);
  });

  it("isCustomProviderKey identifies the AFX namespace", () => {
    expect(SecretStore.isCustomProviderKey("afx.customProvider.foo")).toBe(true);
    expect(SecretStore.isCustomProviderKey(CUSTOM_PROVIDERS_INDEX_KEY)).toBe(true);
    expect(SecretStore.isCustomProviderKey("afx.apiKey.anthropic")).toBe(false);
    expect(SecretStore.isCustomProviderKey("unrelated")).toBe(false);
  });
});
