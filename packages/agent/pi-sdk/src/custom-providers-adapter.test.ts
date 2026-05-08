/**
 * Pi SDK custom-providers adapter tests — round-trip the canonical record into
 * the bootstrap envelope, and parse a real-world `~/.pi/agent/models.json` shape
 * (kimi/moonshot-open) for the read-only Pi RPC track.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */
import { describe, expect, it } from "vitest";

import type { CustomProviderRecord } from "@afx/shared";

import {
  type PiSdkBootstrapEnvelope,
  createPiSdkCustomProvidersAdapter,
} from "./custom-providers-adapter";

const adapter = createPiSdkCustomProvidersAdapter();

describe("createPiSdkCustomProvidersAdapter — id and metadata", () => {
  it("identifies as pi-sdk with in-process-register materialization", () => {
    expect(adapter.id).toBe("pi-sdk");
    expect(adapter.materialization).toBe("in-process-register");
    expect(adapter.displayName).toBe("Pi SDK");
  });

  it("exposes hand-edited config path under ~/.pi/agent/models.json", () => {
    expect(adapter.handEditedConfigPath?.()).toMatch(/\.pi\/agent\/models\.json$/);
  });
});

describe("encodeForBootstrap", () => {
  const ollamaRecord: CustomProviderRecord = {
    id: "ollama",
    displayName: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    api: "openai-completions",
    apiKeyRef: { source: "none" },
    models: [
      {
        id: "qwen3:30b",
        name: "Qwen3 30B",
        contextWindow: 32_000,
        maxTokens: 8_000,
      },
    ],
  };

  const openrouterRecord: CustomProviderRecord = {
    id: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    api: "openai-completions",
    apiKey: "sk-or-v1-this-secret-must-not-leave-host",
    apiKeyRef: { source: "vscode-secret", label: "AFX_OPENROUTER_KEY" },
    models: [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        contextWindow: 200_000,
        maxTokens: 16_000,
        capabilities: { reasoning: true, image: true },
        cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      },
    ],
    headers: { "x-portkey-api-key": "header-secret" },
    compat: { supportsLongCacheRetention: true },
  };

  it("emits an envelope with provider id as the map key", () => {
    const result = adapter.encodeForBootstrap([ollamaRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers).toHaveProperty("ollama");
    expect(envelope.providers["ollama"]?.baseUrl).toBe("http://localhost:11434/v1");
  });

  it("layers pi-mono compat defaults onto canonical compat", () => {
    const result = adapter.encodeForBootstrap([openrouterRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    const provider = envelope.providers["openrouter"];
    expect(provider?.compat).toMatchObject({
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsLongCacheRetention: true,
    });
  });

  it("rewrites apiKey to the AFX env-var reference and emits the secret in env map", () => {
    const result = adapter.encodeForBootstrap([openrouterRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["openrouter"]?.apiKey).toBe("AFX_OPENROUTER_KEY");
    expect(result.env).toEqual({
      AFX_OPENROUTER_KEY: "sk-or-v1-this-secret-must-not-leave-host",
    });
  });

  it("never includes the literal apiKey in the envelope JSON", () => {
    const result = adapter.encodeForBootstrap([openrouterRecord]);
    expect(result.envelopeJson).not.toContain("sk-or-v1-this-secret-must-not-leave-host");
  });

  it("emits placeholder apiKey + authHeader: false when source is `none` (pi-mono requires apiKey when models are defined)", () => {
    const result = adapter.encodeForBootstrap([ollamaRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    // Without a placeholder, pi-mono's registerProvider rejects with
    // 'Provider <id>: "apiKey" or "oauth" is required when defining models.'
    expect(envelope.providers["ollama"]?.apiKey).toBe("no-key");
    expect(envelope.providers["ollama"]?.authHeader).toBe(false);
    // No literal secret value is ever shipped via env for source: "none".
    expect(result.env).toEqual({});
  });

  it("placeholder authHeader can still be overridden by explicit record.authHeader", () => {
    const recordWithExplicitAuth: CustomProviderRecord = {
      ...ollamaRecord,
      authHeader: true,
    };
    const result = adapter.encodeForBootstrap([recordWithExplicitAuth]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["ollama"]?.authHeader).toBe(true);
  });

  it("preserves env-var source as the literal env name", () => {
    const record: CustomProviderRecord = {
      ...openrouterRecord,
      apiKey: undefined,
      apiKeyRef: { source: "env-var", label: "MY_KEY" },
    };
    const result = adapter.encodeForBootstrap([record]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["openrouter"]?.apiKey).toBe("MY_KEY");
    expect(result.env).toEqual({});
  });

  it("preserves shell-cmd source with leading `!`", () => {
    const record: CustomProviderRecord = {
      ...openrouterRecord,
      apiKey: undefined,
      apiKeyRef: { source: "shell-cmd", label: "afx-secret get openrouter" },
    };
    const result = adapter.encodeForBootstrap([record]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["openrouter"]?.apiKey).toBe("!afx-secret get openrouter");
  });

  it("threads canonical displayName into pi-mono ProviderConfig.name (drives the dropdown group label)", () => {
    const namedRecord: CustomProviderRecord = {
      ...openrouterRecord,
      id: "moonshot",
      displayName: "Kimi SDK",
    };
    const result = adapter.encodeForBootstrap([namedRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["moonshot"]?.name).toBe("Kimi SDK");
  });

  it("omits provider name when no displayName is set", () => {
    const result = adapter.encodeForBootstrap([ollamaRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["ollama"]?.name).toBe("Ollama");
  });

  it("honours record.authHeader explicitly (overrides default true)", () => {
    const customAuthRecord: CustomProviderRecord = {
      ...openrouterRecord,
      authHeader: false,
    };
    const result = adapter.encodeForBootstrap([customAuthRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["openrouter"]?.authHeader).toBe(false);
  });

  it("encodes model capabilities into pi-mono input array and reasoning flag", () => {
    const result = adapter.encodeForBootstrap([openrouterRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    const model = envelope.providers["openrouter"]?.models[0];
    expect(model?.input).toEqual(["text", "image"]);
    expect(model?.reasoning).toBe(true);
  });

  it("forwards custom headers", () => {
    const result = adapter.encodeForBootstrap([openrouterRecord]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["openrouter"]?.headers).toEqual({
      "x-portkey-api-key": "header-secret",
    });
  });

  it("handles per-model api override", () => {
    const record: CustomProviderRecord = {
      ...openrouterRecord,
      models: [
        {
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          api: "anthropic-messages",
        },
      ],
    };
    const result = adapter.encodeForBootstrap([record]);
    const envelope = JSON.parse(result.envelopeJson) as PiSdkBootstrapEnvelope;
    expect(envelope.providers["openrouter"]?.models[0]?.api).toBe("anthropic-messages");
  });
});

describe("parseHandEdited — real-world fixtures", () => {
  it("parses the moonshot-open / kimi entry as a CUSTOM provider", () => {
    const text = JSON.stringify({
      providers: {
        "moonshot-open": {
          baseUrl: "https://api.moonshot.ai/v1",
          api: "openai-completions",
          apiKey: "sk-BCFo88NCcVorOEF6RwjloBpdBUe1ShtM8ll1mUfQYY6iV4o4",
          authHeader: true,
          compat: {
            supportsDeveloperRole: false,
            supportsReasoningEffort: false,
          },
          models: [
            {
              id: "kimi-k2.6",
              name: "Kimi K2.6 (Moonshot Open)",
              reasoning: true,
              input: ["text"],
              contextWindow: 262144,
              maxTokens: 262144,
            },
            {
              id: "kimi-k2.5",
              name: "Kimi K2.5 (Moonshot Open)",
              reasoning: true,
              input: ["text"],
              contextWindow: 262144,
              maxTokens: 262144,
            },
          ],
        },
      },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records).toHaveLength(1);
    const record = result.records[0]!;
    expect(record.id).toBe("moonshot-open");
    expect(record.api).toBe("openai-completions");
    expect(record.baseUrl).toBe("https://api.moonshot.ai/v1");
    expect(record.models).toHaveLength(2);
    expect(record.models[0]?.id).toBe("kimi-k2.6");
    expect(record.models[0]?.capabilities?.reasoning).toBe(true);
    // The literal apiKey is parsed but classified as `literal` source — webview
    // never sees it via redaction; here we just confirm the source kind.
    expect(record.apiKeyRef.source).toBe("literal");
  });

  it("classifies built-in OVERRIDE entries (no models[]) as warnings, not records", () => {
    const text = JSON.stringify({
      providers: {
        anthropic: { baseUrl: "https://my-proxy.example.com/v1", api: "anthropic-messages" },
      },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records).toHaveLength(0);
    expect(result.warnings).toContain(
      "anthropic: built-in provider override (OVERRIDE/TWEAKS); not surfaced",
    );
  });

  it("infers env-var source from a bare uppercase apiKey", () => {
    const text = JSON.stringify({
      providers: {
        custom: {
          baseUrl: "https://example.com/v1",
          api: "openai-completions",
          apiKey: "MY_CUSTOM_KEY",
          models: [{ id: "model-a", name: "Model A" }],
        },
      },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records[0]?.apiKeyRef).toEqual({ source: "env-var", label: "MY_CUSTOM_KEY" });
  });

  it("infers shell-cmd source from a leading `!`", () => {
    const text = JSON.stringify({
      providers: {
        custom: {
          baseUrl: "https://example.com/v1",
          api: "openai-completions",
          apiKey: "!afx-secret get custom",
          models: [{ id: "model-a", name: "Model A" }],
        },
      },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records[0]?.apiKeyRef).toEqual({
      source: "shell-cmd",
      label: "afx-secret get custom",
    });
  });

  it("infers vscode-secret source from an AFX_*_KEY ref", () => {
    const text = JSON.stringify({
      providers: {
        custom: {
          baseUrl: "https://example.com/v1",
          api: "openai-completions",
          apiKey: "AFX_CUSTOM_KEY",
          models: [{ id: "model-a", name: "Model A" }],
        },
      },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records[0]?.apiKeyRef).toEqual({
      source: "vscode-secret",
      label: "AFX_CUSTOM_KEY",
    });
  });

  it("returns parse warnings on malformed JSON", () => {
    const result = adapter.parseHandEdited("}{");
    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/parse error/);
  });

  it("warns when top-level value is not an object", () => {
    const result = adapter.parseHandEdited("[]");
    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/top-level value is not an object/);
  });

  it("warns when providers map is missing", () => {
    const result = adapter.parseHandEdited(JSON.stringify({ modelOverrides: {} }));
    expect(result.warnings[0]).toMatch(/missing or invalid `providers`/);
  });

  it("skips entries with unsupported api kinds", () => {
    const text = JSON.stringify({
      providers: { weird: { baseUrl: "https://x", api: "weird-api", models: [{ id: "m" }] } },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("unsupported api kind"))).toBe(true);
  });

  it("skips entries missing baseUrl", () => {
    const text = JSON.stringify({
      providers: {
        custom: { api: "openai-completions", models: [{ id: "m", name: "M" }] },
      },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records).toHaveLength(0);
    expect(result.warnings).toContain("custom: missing baseUrl");
  });

  it("skips entries with no own models[]", () => {
    const text = JSON.stringify({
      providers: { custom: { baseUrl: "https://x", api: "openai-completions" } },
    });
    const result = adapter.parseHandEdited(text);
    expect(result.records).toHaveLength(0);
    expect(result.warnings).toContain(
      "custom: no models[]; not surfaced (OVERRIDE/TWEAKS pattern)",
    );
  });
});
