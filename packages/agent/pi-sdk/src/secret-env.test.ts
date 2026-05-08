/**
 * @see docs/specs/351-agent-pi/spec.md [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */
import { describe, expect, it } from "vitest";

import { secretEnvVarFor } from "./secret-env";

describe("secretEnvVarFor", () => {
  it("uppercases simple ids", () => {
    expect(secretEnvVarFor("openrouter")).toBe("AFX_OPENROUTER_KEY");
  });

  it("converts hyphens to underscores", () => {
    expect(secretEnvVarFor("my-anthropic-proxy")).toBe("AFX_MY_ANTHROPIC_PROXY_KEY");
  });

  it("preserves underscores", () => {
    expect(secretEnvVarFor("custom_provider")).toBe("AFX_CUSTOM_PROVIDER_KEY");
  });

  it("strips non-alphanumeric chars", () => {
    expect(secretEnvVarFor("provider.with.dots")).toBe("AFX_PROVIDER_WITH_DOTS_KEY");
  });

  it("rejects ids that resolve to a slug starting with a digit", () => {
    // Provider ids leading with a digit aren't valid env-var identifiers; throw rather than silently mangle.
    expect(() => secretEnvVarFor("123provider")).toThrow();
  });

  it("throws on empty input", () => {
    expect(() => secretEnvVarFor("")).toThrow();
  });

  it("throws on non-string input", () => {
    expect(() => secretEnvVarFor(undefined as unknown as string)).toThrow();
  });
});
