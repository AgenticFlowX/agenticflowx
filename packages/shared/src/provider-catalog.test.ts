import { describe, expect, it } from "vitest";

import {
  API_PROVIDER_IDS,
  DEFAULT_API_PROVIDER_MODELS,
  PROVIDER_API_KEY_ENV_ALIASES,
  PROVIDER_DETAILS,
  getDefaultApiProviderModel,
} from "./provider-catalog";

describe("provider catalog", () => {
  it("includes Pi API-key providers beyond the original small set", () => {
    expect(API_PROVIDER_IDS).toEqual(expect.arrayContaining(["minimax", "mistral", "deepseek"]));
    expect(PROVIDER_DETAILS["minimax"]).toMatchObject({
      displayName: "MiniMax",
      modelHint: expect.stringContaining("MiniMax"),
    });
  });

  it("maps AFX provider ids to Pi-compatible env vars", () => {
    expect(PROVIDER_API_KEY_ENV_ALIASES["minimax"]).toContain("MINIMAX_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["kimi-coding"]).toContain("KIMI_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["vercel-ai-gateway"]).toContain("AI_GATEWAY_API_KEY");
  });

  it("exposes Pi-compatible provider startup defaults", () => {
    expect(DEFAULT_API_PROVIDER_MODELS.minimax).toBe("MiniMax-M2.7");
    expect(getDefaultApiProviderModel("minimax")).toBe("MiniMax-M2.7");
  });
});
