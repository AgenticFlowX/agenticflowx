import { describe, expect, it } from "vitest";

import { applyProviderEnv, getApiKey, providerEnvKey } from "./auth";

describe("bootstrap auth", () => {
  it("normalizes provider names for AFX_API_KEY env lookup", () => {
    expect(providerEnvKey("open-router")).toBe("OPEN_ROUTER");
    expect(getApiKey("open-router", { AFX_API_KEY_OPEN_ROUTER: "secret" })).toBe("secret");
  });

  it("applies provider-compatible API key env aliases", () => {
    const env: NodeJS.ProcessEnv = {};

    applyProviderEnv("anthropic", "secret", env);
    applyProviderEnv("google", "gemini-secret", env);
    applyProviderEnv("minimax", "minimax-secret", env);
    applyProviderEnv("vercel-ai-gateway", "gateway-secret", env);

    expect(env["ANTHROPIC_API_KEY"]).toBe("secret");
    expect(env["GEMINI_API_KEY"]).toBe("gemini-secret");
    expect(env["MINIMAX_API_KEY"]).toBe("minimax-secret");
    expect(env["AI_GATEWAY_API_KEY"]).toBe("gateway-secret");
  });
});
