/**
 * SecretStore credential persistence wrapper.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-2]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
 */
import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";

import { SecretStore } from "./secret-store";

describe("SecretStore", () => {
  it("stores, reads, and clears provider API keys", async () => {
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
    const store = new SecretStore(context);

    await store.setApiKey("anthropic", "sk-test");
    await expect(store.getApiKey("anthropic")).resolves.toBe("sk-test");
    await store.clearApiKey("anthropic");
    await expect(store.getApiKey("anthropic")).resolves.toBeUndefined();

    expect(context.secrets.store).toHaveBeenCalledWith("afx.apiKey.anthropic", "sk-test");
    expect(context.secrets.delete).toHaveBeenCalledWith("afx.apiKey.anthropic");
  });
});
