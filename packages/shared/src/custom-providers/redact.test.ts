/**
 * Redaction guard tests — defence-in-depth that no apiKey, models[], headers, or
 * compat field reaches the webview from a `CustomProviderRecord`.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [NFR-1] [FR-10]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 */
import { describe, expect, it } from "vitest";

import { assertNoSecretLeak, summarizeForWebview } from "./redact";
import type { CustomProviderRecord } from "./types";

const SAMPLE_RECORD: CustomProviderRecord = {
  id: "openrouter",
  displayName: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  api: "openai-completions",
  apiKey: "sk-this-must-never-leave-host",
  apiKeyRef: { source: "vscode-secret", label: "AFX_OPENROUTER_KEY" },
  models: [
    {
      id: "anthropic/claude-sonnet-4",
      name: "Claude Sonnet 4",
      contextWindow: 200_000,
      maxTokens: 16_000,
      cost: { input: 3, output: 15 },
    },
  ],
  headers: { "x-portkey-api-key": "secret-portkey" },
  compat: { supportsDeveloperRole: false },
};

describe("summarizeForWebview", () => {
  it("emits only redacted public fields", () => {
    const summary = summarizeForWebview(SAMPLE_RECORD, "afx-managed");
    expect(summary).toEqual({
      id: "openrouter",
      displayName: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      api: "openai-completions",
      modelCount: 1,
      models: [
        {
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          contextWindow: 200_000,
          maxTokens: 16_000,
        },
      ],
      apiKeySource: "vscode-secret",
      apiKeyLabel: "AFX_OPENROUTER_KEY",
      hasApiKey: true,
      // SAMPLE_RECORD's `compat: { supportsDeveloperRole: false }` projects to compatFlags
      // because supportsDeveloperRole is in COMPAT_FLAGS_BY_API for openai-completions.
      compatFlags: { supportsDeveloperRole: false },
      origin: "afx-managed",
    });
  });

  it("surfaces authHeader on the summary when set on the canonical record", () => {
    const recordWithAuth: CustomProviderRecord = { ...SAMPLE_RECORD, authHeader: true };
    expect(summarizeForWebview(recordWithAuth, "afx-managed").authHeader).toBe(true);
    const recordWithoutAuth: CustomProviderRecord = { ...SAMPLE_RECORD, authHeader: false };
    expect(summarizeForWebview(recordWithoutAuth, "afx-managed").authHeader).toBe(false);
  });

  it("projects only UI-known compat keys; preserves non-boolean values server-side", () => {
    const recordWithUnknown: CustomProviderRecord = {
      ...SAMPLE_RECORD,
      compat: {
        supportsDeveloperRole: true,
        supportsReasoningEffort: true,
        someOpaqueKey: "stays-on-canonical-side", // not boolean → skipped
        unknownFlag: false, // not in COMPAT_FLAGS_BY_API for openai-completions → skipped
      },
    };
    const summary = summarizeForWebview(recordWithUnknown, "afx-managed");
    expect(summary.compatFlags).toEqual({
      supportsDeveloperRole: true,
      supportsReasoningEffort: true,
    });
  });

  it("omits compatFlags entirely when no known flags are set on the record", () => {
    const recordNoCompat: CustomProviderRecord = { ...SAMPLE_RECORD, compat: undefined };
    expect(summarizeForWebview(recordNoCompat, "afx-managed").compatFlags).toBeUndefined();
  });

  it("never includes the literal apiKey value", () => {
    const summary = summarizeForWebview(SAMPLE_RECORD, "afx-managed");
    const json = JSON.stringify(summary);
    expect(json).not.toContain("sk-this-must-never-leave-host");
    expect(json).not.toContain("secret-portkey");
  });

  it("never includes headers or full compat", () => {
    const summary = summarizeForWebview(SAMPLE_RECORD, "afx-managed");
    const asRecord = summary as unknown as Record<string, unknown>;
    expect(asRecord["headers"]).toBeUndefined();
    expect(asRecord["compat"]).toBeUndefined();
  });

  it("includes redacted model summaries (id/name/contextWindow) so the user can see what they configured", () => {
    const summary = summarizeForWebview(SAMPLE_RECORD, "afx-managed");
    expect(summary.models).toHaveLength(1);
    expect(summary.models[0]).toMatchObject({
      id: "anthropic/claude-sonnet-4",
      name: "Claude Sonnet 4",
      contextWindow: 200_000,
    });
    // Model summaries must not leak per-model compat or apiKey (none defined on the canonical record either).
    expect((summary.models[0] as unknown as Record<string, unknown>)["compat"]).toBeUndefined();
  });

  it("hasApiKey reflects whether a key is actually stored", () => {
    expect(summarizeForWebview(SAMPLE_RECORD, "afx-managed").hasApiKey).toBe(true);
    const noKeyRecord: CustomProviderRecord = {
      ...SAMPLE_RECORD,
      apiKey: undefined,
      apiKeyRef: { source: "vscode-secret", label: "AFX_OPENROUTER_KEY" },
    };
    expect(summarizeForWebview(noKeyRecord, "afx-managed").hasApiKey).toBe(false);
    const noneRecord: CustomProviderRecord = {
      ...SAMPLE_RECORD,
      apiKey: undefined,
      apiKeyRef: { source: "none" },
    };
    expect(summarizeForWebview(noneRecord, "afx-managed").hasApiKey).toBe(false);
  });

  it("flags hand-edited entries with literal keys on disk", () => {
    const summary = summarizeForWebview(SAMPLE_RECORD, "hand-edited", {
      hasLiteralApiKeyOnDisk: true,
    });
    expect(summary.origin).toBe("hand-edited");
    expect(summary.hasLiteralApiKeyOnDisk).toBe(true);
  });
});

describe("assertNoSecretLeak", () => {
  it("passes for a properly redacted summary", () => {
    const summary = summarizeForWebview(SAMPLE_RECORD, "afx-managed");
    expect(() => assertNoSecretLeak(summary)).not.toThrow();
  });

  it("throws when apiKey field is present", () => {
    expect(() => assertNoSecretLeak({ id: "x", apiKey: "sk-nope" })).toThrow(/apiKey/);
  });

  it("allows redacted models[] (non-secret structural data)", () => {
    expect(() =>
      assertNoSecretLeak({ id: "x", models: [{ id: "m", name: "M", contextWindow: 1000 }] }),
    ).not.toThrow();
  });

  it("still throws on a model entry that smuggles an apiKey field", () => {
    expect(() =>
      assertNoSecretLeak({
        id: "x",
        models: [{ id: "m", name: "M", apiKey: "sk-leak" }],
      }),
    ).toThrow(/apiKey/);
  });

  it("throws when headers is present", () => {
    expect(() => assertNoSecretLeak({ id: "x", headers: {} })).toThrow(/headers/);
  });

  it("throws when compat is present", () => {
    expect(() => assertNoSecretLeak({ id: "x", compat: {} })).toThrow(/compat/);
  });

  it("recurses into nested objects", () => {
    expect(() => assertNoSecretLeak({ providers: [{ id: "x", apiKey: "sk-nope" }] })).toThrow(
      /apiKey/,
    );
  });

  it("allows apiKeyLabel and apiKeySource as non-secret fields", () => {
    expect(() =>
      assertNoSecretLeak({
        id: "x",
        apiKeySource: "vscode-secret",
        apiKeyLabel: "AFX_X_KEY",
      }),
    ).not.toThrow();
  });

  it("ignores null and primitive values", () => {
    expect(() => assertNoSecretLeak(null)).not.toThrow();
    expect(() => assertNoSecretLeak("string")).not.toThrow();
    expect(() => assertNoSecretLeak(42)).not.toThrow();
  });

  it("catches secret-shaped key names that aren't in the explicit hint set (regex fallback)", () => {
    // "BearerToken" is not in the explicit hint set but matches /bearer/i — caught by the regex layer.
    expect(() => assertNoSecretLeak({ id: "x", BearerToken: "header-value" })).toThrow(
      /BearerToken/,
    );
  });

  it("regex fallback skips empty-string secret-shaped values (no false positive on placeholders)", () => {
    expect(() => assertNoSecretLeak({ id: "x", BearerToken: "" })).not.toThrow();
  });
});
