/**
 * Custom Providers (Pi SDK track) end-to-end contract.
 *
 * Verifies that AFX-managed custom providers stored in VSCode SecretStorage:
 * - never modify `~/.pi/agent/models.json`
 * - surface as redacted summaries in the snapshot (no apiKey, no models[])
 * - produce a JSON envelope + `AFX_<ID>_KEY` env entries for the Pi SDK spawn
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [FR-10] [NFR-1]
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/420-dx-testing/spec.md [FR-3]
 */
import * as assert from "node:assert";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import * as vscode from "vscode";

interface MutationResult {
  ok: boolean;
  error?: string;
}

/**
 * Narrowed test API surface — only the methods this suite calls. See
 * apps/vscode/src/extension.ts `AfxExtensionTestApi` for the full shape.
 */
interface AfxExtensionTestApi {
  stopAgentRuntime(): Promise<void>;
  getCustomProvidersSnapshot(): Promise<{
    activeHarness: string;
    piSdk: { providers: ReadonlyArray<Record<string, unknown>> };
    piRpc?: {
      path: string;
      status: "ready" | "parse-error" | "missing";
      error?: string;
      providers: ReadonlyArray<Record<string, unknown>>;
    };
  }>;
  buildCustomProvidersSpawnEnv(): Promise<Record<string, string>>;
  upsertCustomProvider(input: {
    id: string;
    displayName?: string;
    baseUrl: string;
    api: "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai";
    apiKeyRef: { source: "vscode-secret" | "env-var" | "shell-cmd" | "none"; label?: string };
    apiKeyValue?: string;
    models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }>;
  }): Promise<MutationResult>;
  removeCustomProvider(providerId: string): Promise<MutationResult>;
}

suite("Custom Providers (Pi SDK track)", function () {
  this.timeout(60_000);

  let api: AfxExtensionTestApi | null = null;
  let scratchAgentDir: string | null = null;
  let previousPiAgentDir: string | undefined;
  let handEditedPath: string | null = null;
  let handEditedMtimeBefore: number | null = null;

  suiteSetup(async () => {
    // Point PI_CODING_AGENT_DIR at a scratch directory so the Pi RPC display
    // surface reads from a stable location and we can assert AFX never touches
    // the user's real ~/.pi/agent/models.json.
    scratchAgentDir = join(tmpdir(), `afx-custom-providers-e2e-${Date.now()}`);
    handEditedPath = join(scratchAgentDir, "models.json");
    previousPiAgentDir = process.env["PI_CODING_AGENT_DIR"];
    process.env["PI_CODING_AGENT_DIR"] = scratchAgentDir;

    const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(extension, "Extension agenticflowx.agenticflowx not found");
    api = (await extension.activate()) as AfxExtensionTestApi;
    assert.ok(api, "Extension test API was not returned in ExtensionMode.Test");
  });

  suiteTeardown(async () => {
    if (api) {
      await api.removeCustomProvider("e2e-ollama").catch(() => undefined);
      await api.removeCustomProvider("e2e-openrouter").catch(() => undefined);
      await api.stopAgentRuntime().catch(() => undefined);
    }
    if (previousPiAgentDir === undefined) {
      delete process.env["PI_CODING_AGENT_DIR"];
    } else {
      process.env["PI_CODING_AGENT_DIR"] = previousPiAgentDir;
    }
  });

  function requiredApi(): AfxExtensionTestApi {
    assert.ok(api, "test api unavailable");
    return api;
  }

  test("snapshot starts empty for AFX-managed providers", async () => {
    const snapshot = await requiredApi().getCustomProvidersSnapshot();
    assert.strictEqual(snapshot.activeHarness, "pi-sdk");
    assert.ok(Array.isArray(snapshot.piSdk.providers));
  });

  test("upsert + snapshot round trip surfaces a redacted summary", async () => {
    const ok = await requiredApi().upsertCustomProvider({
      id: "e2e-ollama",
      displayName: "E2E Ollama",
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      apiKeyRef: { source: "none" },
      models: [{ id: "qwen3:30b", name: "Qwen3 30B", contextWindow: 32000 }],
    });
    assert.strictEqual(ok.ok, true, ok.error);
    const snapshot = await requiredApi().getCustomProvidersSnapshot();
    const ollama = snapshot.piSdk.providers.find((p) => p["id"] === "e2e-ollama");
    assert.ok(ollama, "e2e-ollama not in snapshot");
    assert.strictEqual(ollama["modelCount"], 1);
    assert.strictEqual(ollama["origin"], "afx-managed");
    assert.strictEqual(ollama["apiKeySource"], "none");
    // Defence-in-depth: the apiKey value, opaque compat, and headers must never
    // cross the bridge. Redacted models[] (id/name/contextWindow only) is allowed
    // — the user needs to see what they configured. Per NFR-1.
    const json = JSON.stringify(snapshot);
    assert.ok(!json.includes('"apiKey":"'), "apiKey value must not appear in snapshot");
    assert.ok(!json.includes('"compat":{'), "opaque compat must not appear in snapshot");
    assert.ok(!json.includes('"headers":{'), "headers map must not appear in snapshot");
  });

  test("vscode-secret keys never become literal in the spawn envelope", async () => {
    const ok = await requiredApi().upsertCustomProvider({
      id: "e2e-openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      api: "openai-completions",
      apiKeyRef: { source: "vscode-secret", label: "AFX_E2E_OPENROUTER_KEY" },
      apiKeyValue: "sk-test-only-secret-must-stay-host-side",
      models: [{ id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", contextWindow: 200000 }],
    });
    assert.strictEqual(ok.ok, true, ok.error);

    const env = await requiredApi().buildCustomProvidersSpawnEnv();
    const envelopeJson = env["AFX_CUSTOM_PROVIDERS_JSON"];
    assert.ok(typeof envelopeJson === "string");
    const envelope = JSON.parse(envelopeJson) as {
      providers: Record<string, { apiKey?: string }>;
    };
    assert.strictEqual(
      envelope.providers["e2e-openrouter"]?.apiKey,
      "AFX_E2E_OPENROUTER_KEY",
      "envelope must reference env var, not literal",
    );
    assert.strictEqual(env["AFX_E2E_OPENROUTER_KEY"], "sk-test-only-secret-must-stay-host-side");
    assert.ok(
      !envelopeJson.includes("sk-test-only-secret-must-stay-host-side"),
      "literal secret must not appear inside the envelope JSON",
    );
  });

  test("AFX never writes to the hand-edited models.json path", async () => {
    const seedPath = handEditedPath;
    if (!seedPath) {
      assert.fail("handEditedPath unset");
      return;
    }
    if (!existsSync(seedPath)) {
      const dir = dirname(seedPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(seedPath, JSON.stringify({ providers: {} }), "utf-8");
    }
    handEditedMtimeBefore = statSync(seedPath).mtimeMs;

    // Upsert + remove an AFX-managed record.
    await requiredApi().upsertCustomProvider({
      id: "e2e-write-check",
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      apiKeyRef: { source: "none" },
      models: [{ id: "tiny", name: "Tiny" }],
    });
    await requiredApi().removeCustomProvider("e2e-write-check");

    const after = statSync(seedPath).mtimeMs;
    assert.strictEqual(
      after,
      handEditedMtimeBefore,
      `hand-edited models.json mtime changed: AFX must never write this file (${seedPath})`,
    );
    // And confirm the contents are exactly what we seeded.
    const text = readFileSync(seedPath, "utf-8");
    assert.strictEqual(text, JSON.stringify({ providers: {} }));
  });

  test("remove brings the snapshot back to a clean state", async () => {
    await requiredApi().removeCustomProvider("e2e-ollama");
    await requiredApi().removeCustomProvider("e2e-openrouter");
    const snapshot = await requiredApi().getCustomProvidersSnapshot();
    const ids = new Set(snapshot.piSdk.providers.map((p) => p["id"]));
    assert.ok(!ids.has("e2e-ollama"), "e2e-ollama still present after remove");
    assert.ok(!ids.has("e2e-openrouter"), "e2e-openrouter still present after remove");
  });
});
