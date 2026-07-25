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
    expect(API_PROVIDER_IDS).toEqual(
      expect.arrayContaining([
        "cloudflare-ai-gateway",
        "cloudflare-workers-ai",
        "ant-ling",
        "nvidia",
        "zai-coding-cn",
        "minimax",
        "mistral",
        "moonshotai",
        "moonshotai-cn",
        "deepseek",
        "together",
        "xiaomi",
        "xiaomi-token-plan-cn",
        "xiaomi-token-plan-ams",
        "xiaomi-token-plan-sgp",
        "qwen-token-plan",
        "qwen-token-plan-cn",
        "radius",
      ]),
    );
    expect(PROVIDER_DETAILS["minimax"]).toMatchObject({
      displayName: "MiniMax",
      modelHint: expect.stringContaining("MiniMax"),
    });
    expect(PROVIDER_DETAILS["xiaomi"]).toMatchObject({
      displayName: "Xiaomi MiMo",
      modelHint: expect.stringContaining("Xiaomi"),
    });
    expect(PROVIDER_DETAILS["cloudflare-ai-gateway"]?.configFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ envVar: "CLOUDFLARE_ACCOUNT_ID" }),
        expect.objectContaining({ envVar: "CLOUDFLARE_GATEWAY_ID" }),
      ]),
    );
    expect(PROVIDER_DETAILS["cloudflare-workers-ai"]?.configFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ envVar: "CLOUDFLARE_ACCOUNT_ID" })]),
    );
  });

  it("maps AFX provider ids to Pi-compatible env vars", () => {
    expect(PROVIDER_API_KEY_ENV_ALIASES["minimax"]).toContain("MINIMAX_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["ant-ling"]).toContain("ANT_LING_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES.nvidia).toContain("NVIDIA_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["zai-coding-cn"]).toContain("ZAI_CODING_CN_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["kimi-coding"]).toContain("KIMI_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["vercel-ai-gateway"]).toContain("AI_GATEWAY_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["cloudflare-ai-gateway"]).toContain("CLOUDFLARE_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["moonshotai"]).toContain("MOONSHOT_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["together"]).toContain("TOGETHER_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["xiaomi"]).toContain("XIAOMI_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["xiaomi-token-plan-sgp"]).toContain(
      "XIAOMI_TOKEN_PLAN_SGP_API_KEY",
    );
    expect(PROVIDER_API_KEY_ENV_ALIASES["qwen-token-plan"]).toContain("QWEN_TOKEN_PLAN_API_KEY");
    expect(PROVIDER_API_KEY_ENV_ALIASES["qwen-token-plan-cn"]).toContain(
      "QWEN_TOKEN_PLAN_CN_API_KEY",
    );
    expect(PROVIDER_API_KEY_ENV_ALIASES.radius).toContain("RADIUS_API_KEY");
    expect(PROVIDER_DETAILS["kimi-coding"]).toMatchObject({
      oauthCapable: true,
      oauthFlow: "device-code",
      dualMethod: true,
    });
    expect(PROVIDER_DETAILS["openrouter"]).toMatchObject({
      oauthCapable: true,
      oauthFlow: "pkce-loopback",
      dualMethod: true,
    });
    expect(PROVIDER_DETAILS["xai"]).toMatchObject({
      oauthCapable: true,
      oauthFlow: "device-code",
      dualMethod: true,
    });
  });

  it("exposes Pi-compatible provider startup defaults", () => {
    expect(DEFAULT_API_PROVIDER_MODELS.minimax).toBe("MiniMax-M2.7");
    expect(getDefaultApiProviderModel("ant-ling")).toBe("Ling-2.6-1T");
    expect(getDefaultApiProviderModel("nvidia")).toBe("meta/llama-3.1-70b-instruct");
    expect(getDefaultApiProviderModel("zai-coding-cn")).toBe("glm-5.1");
    expect(getDefaultApiProviderModel("minimax")).toBe("MiniMax-M2.7");
    expect(getDefaultApiProviderModel("cloudflare-ai-gateway")).toBe(
      "workers-ai/@cf/moonshotai/kimi-k2.6",
    );
    expect(getDefaultApiProviderModel("cloudflare-workers-ai")).toBe("@cf/moonshotai/kimi-k2.6");
    expect(getDefaultApiProviderModel("moonshotai")).toBe("kimi-k2.6");
    expect(getDefaultApiProviderModel("together")).toBe("moonshotai/Kimi-K2.6");
    expect(getDefaultApiProviderModel("openai-codex")).toBe("gpt-5.5");
    expect(getDefaultApiProviderModel("xiaomi")).toBe("mimo-v2.5-pro");
    expect(getDefaultApiProviderModel("xiaomi-token-plan-cn")).toBe("mimo-v2.5-pro");
    expect(getDefaultApiProviderModel("qwen-token-plan")).toBe("qwen3.7-max");
    expect(getDefaultApiProviderModel("qwen-token-plan-cn")).toBe("qwen3.7-max");
    expect(getDefaultApiProviderModel("radius")).toBe("auto");
  });
});
