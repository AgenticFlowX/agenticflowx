/**
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-4] [FR-5] [NFR-1]
 * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]
 */
import { describe, expect, it, vi } from "vitest";

import type { PiExtensionApiLike } from "./custom-providers-bootstrap";
import {
  type AfxProviderOverridesEnvelope,
  applyAfxOverrides,
  createProviderOverridesExtensionFactory,
  parseAfxOverrides,
} from "./provider-overrides-bootstrap";

const ENTERPRISE_BASE_URL = "https://api.corp.ghe.com";
const OPENAI_CODEX_KEY_ENV = "AFX_API_KEY_OPENAI_CODEX";
const SAMPLE_ENVELOPE: AfxProviderOverridesEnvelope = {
  overrides: { "github-copilot": { baseUrl: ENTERPRISE_BASE_URL } },
};

describe("parseAfxOverrides", () => {
  it("returns null envelope when text is undefined", () => {
    expect(parseAfxOverrides(undefined)).toEqual({ envelope: null });
  });

  it("returns null envelope when text is empty", () => {
    expect(parseAfxOverrides("")).toEqual({ envelope: null });
  });

  it("parses a valid envelope", () => {
    const result = parseAfxOverrides(JSON.stringify(SAMPLE_ENVELOPE));
    expect(result.envelope).toEqual(SAMPLE_ENVELOPE);
    expect(result.error).toBeUndefined();
  });

  it("returns parse error for malformed JSON", () => {
    const result = parseAfxOverrides("}{");
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/parse error/);
  });

  it("rejects array top-level value", () => {
    const result = parseAfxOverrides("[]");
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/top-level value is not an object/);
  });

  it("rejects missing overrides map", () => {
    const result = parseAfxOverrides(JSON.stringify({}));
    expect(result.envelope).toBeNull();
    expect(result.error).toMatch(/overrides/);
  });

  it("parses subscription credential env references", () => {
    const result = parseAfxOverrides(
      JSON.stringify({
        overrides: { "openai-codex": { apiKeyEnv: OPENAI_CODEX_KEY_ENV } },
      }),
    );
    expect(result.envelope).toEqual({
      overrides: { "openai-codex": { apiKeyEnv: OPENAI_CODEX_KEY_ENV } },
    });
  });

  it("drops entries with no usable fields", () => {
    const result = parseAfxOverrides(
      JSON.stringify({
        overrides: {
          a: {},
          b: { baseUrl: "", apiKeyEnv: "" },
          c: { baseUrl: ENTERPRISE_BASE_URL },
        },
      }),
    );
    expect(result.envelope).toEqual({ overrides: { c: { baseUrl: ENTERPRISE_BASE_URL } } });
  });
});

describe("applyAfxOverrides", () => {
  it("calls registerProvider with a baseUrl-only config per entry", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const result = applyAfxOverrides(pi, SAMPLE_ENVELOPE);
    expect(pi.registerProvider).toHaveBeenCalledTimes(1);
    expect(pi.registerProvider).toHaveBeenCalledWith("github-copilot", {
      baseUrl: ENTERPRISE_BASE_URL,
    });
    expect(result.overridden).toEqual(["github-copilot"]);
    expect(result.errors).toEqual([]);
  });

  it("calls registerProvider with a credential env reference", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const result = applyAfxOverrides(pi, {
      overrides: { "openai-codex": { apiKeyEnv: OPENAI_CODEX_KEY_ENV } },
    });
    expect(pi.registerProvider).toHaveBeenCalledTimes(1);
    expect(pi.registerProvider).toHaveBeenCalledWith("openai-codex", {
      apiKey: OPENAI_CODEX_KEY_ENV,
    });
    expect(result.overridden).toEqual(["openai-codex"]);
    expect(result.errors).toEqual([]);
  });

  it("captures override errors per-provider without throwing", () => {
    const pi: PiExtensionApiLike = {
      registerProvider: vi.fn(() => {
        throw new Error("boom");
      }),
    };
    const result = applyAfxOverrides(pi, SAMPLE_ENVELOPE);
    expect(result.overridden).toEqual([]);
    expect(result.errors).toEqual([{ id: "github-copilot", error: "boom" }]);
  });
});

describe("createProviderOverridesExtensionFactory", () => {
  it("is a no-op when AFX_PROVIDER_OVERRIDES_JSON is unset", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    createProviderOverridesExtensionFactory({})(pi);
    expect(pi.registerProvider).not.toHaveBeenCalled();
  });

  it("applies overrides when AFX_PROVIDER_OVERRIDES_JSON is set", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    createProviderOverridesExtensionFactory({
      AFX_PROVIDER_OVERRIDES_JSON: JSON.stringify(SAMPLE_ENVELOPE),
    })(pi);
    expect(pi.registerProvider).toHaveBeenCalledWith("github-copilot", {
      baseUrl: ENTERPRISE_BASE_URL,
    });
  });

  it("is a no-op when the parsed envelope has no usable overrides", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    createProviderOverridesExtensionFactory({
      AFX_PROVIDER_OVERRIDES_JSON: JSON.stringify({ overrides: { a: {} } }),
    })(pi);
    expect(pi.registerProvider).not.toHaveBeenCalled();
  });

  it("emits a diagnostic on successful override", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const onDiagnostic = vi.fn();
    createProviderOverridesExtensionFactory(
      { AFX_PROVIDER_OVERRIDES_JSON: JSON.stringify(SAMPLE_ENVELOPE) },
      onDiagnostic,
    )(pi);
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.stringMatching(/AFX applied 1 provider override\(s\)/),
    );
  });

  it("emits a parse-error diagnostic and short-circuits on malformed env", () => {
    const pi: PiExtensionApiLike = { registerProvider: vi.fn() };
    const onDiagnostic = vi.fn();
    createProviderOverridesExtensionFactory(
      { AFX_PROVIDER_OVERRIDES_JSON: "}{" },
      onDiagnostic,
    )(pi);
    expect(onDiagnostic).toHaveBeenCalledWith(expect.stringMatching(/parse error/));
    expect(pi.registerProvider).not.toHaveBeenCalled();
  });

  it("emits a per-provider error diagnostic when registerProvider throws", () => {
    const pi: PiExtensionApiLike = {
      registerProvider: vi.fn(() => {
        throw new Error("override boom");
      }),
    };
    const onDiagnostic = vi.fn();
    createProviderOverridesExtensionFactory(
      { AFX_PROVIDER_OVERRIDES_JSON: JSON.stringify(SAMPLE_ENVELOPE) },
      onDiagnostic,
    )(pi);
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.stringMatching(/AFX failed to override github-copilot: override boom/),
    );
  });
});
