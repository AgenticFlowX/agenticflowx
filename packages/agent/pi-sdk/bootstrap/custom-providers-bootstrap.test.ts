/**
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */
import { describe, expect, it, vi } from "vitest";

import {
  type AfxCustomProvidersEnvelope,
  type PiExtensionApiLike,
  applyAfxEnvelope,
  createCustomProvidersExtensionFactory,
  parseAfxEnvelope,
} from "./custom-providers-bootstrap";

const SAMPLE_ENVELOPE: AfxCustomProvidersEnvelope = {
  providers: {
    ollama: {
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      models: [
        {
          id: "qwen3:30b",
          name: "Qwen3 30B",
          reasoning: false,
          input: ["text"],
          contextWindow: 32_000,
          maxTokens: 8_000,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
    },
  },
};

describe("parseAfxEnvelope", () => {
  it("returns null envelope when text is undefined", () => {
    expect(parseAfxEnvelope(undefined)).toEqual({ envelope: null });
  });

  it("returns null envelope when text is empty", () => {
    expect(parseAfxEnvelope("")).toEqual({ envelope: null });
  });

  it("parses a valid envelope", () => {
    const result = parseAfxEnvelope(JSON.stringify(SAMPLE_ENVELOPE));
    expect(result.envelope).toEqual(SAMPLE_ENVELOPE);
    expect(result.error).toBeUndefined();
  });

  it("returns parse error for malformed JSON", () => {
    const result = parseAfxEnvelope("}{");
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/parse error/);
  });

  it("rejects array top-level value", () => {
    const result = parseAfxEnvelope("[]");
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/top-level value is not an object/);
  });

  it("rejects null top-level value", () => {
    const result = parseAfxEnvelope("null");
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/top-level value is not an object/);
  });

  it("rejects missing providers map", () => {
    const result = parseAfxEnvelope(JSON.stringify({}));
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/providers/);
  });
});

describe("applyAfxEnvelope", () => {
  it("calls registerProvider once per entry", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const result = applyAfxEnvelope(pi, SAMPLE_ENVELOPE);
    expect(pi.registerProvider).toHaveBeenCalledTimes(1);
    expect(pi.registerProvider).toHaveBeenCalledWith("ollama", SAMPLE_ENVELOPE.providers["ollama"]);
    expect(result.registered).toEqual(["ollama"]);
    expect(result.errors).toEqual([]);
  });

  it("captures registration errors per-provider without throwing", () => {
    const pi: PiExtensionApiLike = {
      registerProvider: vi.fn((name: string) => {
        if (name === "ollama") throw new Error("boom");
      }),
    };
    const result = applyAfxEnvelope(pi, SAMPLE_ENVELOPE);
    expect(result.registered).toEqual([]);
    expect(result.errors).toEqual([{ id: "ollama", error: "boom" }]);
  });
});

describe("createCustomProvidersExtensionFactory", () => {
  it("is a no-op when AFX_CUSTOM_PROVIDERS_JSON is unset", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const factory = createCustomProvidersExtensionFactory({});
    factory(pi);
    expect(pi.registerProvider).not.toHaveBeenCalled();
  });

  it("registers providers when AFX_CUSTOM_PROVIDERS_JSON is set", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const factory = createCustomProvidersExtensionFactory({
      AFX_CUSTOM_PROVIDERS_JSON: JSON.stringify(SAMPLE_ENVELOPE),
    });
    factory(pi);
    expect(pi.registerProvider).toHaveBeenCalledTimes(1);
    expect(pi.registerProvider).toHaveBeenCalledWith("ollama", SAMPLE_ENVELOPE.providers["ollama"]);
  });

  it("emits diagnostics through the callback when set", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const onDiagnostic = vi.fn();
    const factory = createCustomProvidersExtensionFactory(
      { AFX_CUSTOM_PROVIDERS_JSON: JSON.stringify(SAMPLE_ENVELOPE) },
      onDiagnostic,
    );
    factory(pi);
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.stringMatching(/AFX registered 1 custom provider\(s\)/),
    );
  });

  it("emits a parse-error diagnostic and short-circuits on malformed envelope", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const onDiagnostic = vi.fn();
    const factory = createCustomProvidersExtensionFactory(
      { AFX_CUSTOM_PROVIDERS_JSON: "}{" },
      onDiagnostic,
    );
    factory(pi);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.stringMatching(/parse error/));
    expect(pi.registerProvider).not.toHaveBeenCalled();
  });

  it("emits per-provider error diagnostics when registerProvider throws", () => {
    const pi: PiExtensionApiLike = {
      registerProvider: vi.fn(() => {
        throw new Error("registration boom");
      }),
    };
    const onDiagnostic = vi.fn();
    const factory = createCustomProvidersExtensionFactory(
      { AFX_CUSTOM_PROVIDERS_JSON: JSON.stringify(SAMPLE_ENVELOPE) },
      onDiagnostic,
    );
    factory(pi);
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.stringMatching(/AFX failed to register ollama: registration boom/),
    );
  });
});
