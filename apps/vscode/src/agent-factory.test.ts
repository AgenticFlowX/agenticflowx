/**
 * Agent factory contract for configured coding-agent instances.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-6] [FR-8]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type MockAgentManager, createMockAgentManager } from "./__fixtures__/mock-agent-manager";
import { createMockLogger } from "./__fixtures__/mock-logger";

vi.mock("@afx/agent-pi", () => ({
  createAgentManager: vi.fn(),
}));

vi.mock("@afx/agent-pi-sdk", () => ({
  createPiSdkAgentManager: vi.fn(),
}));

let agentManager: MockAgentManager;
let sdkAgentManager: MockAgentManager;
let createPiAgentManager: ReturnType<typeof vi.fn>;
let createPiSdkAgentManager: ReturnType<typeof vi.fn>;

function createSecretStoreMock(
  getApiKey: (provider: string) => Promise<string | undefined>,
  oauthProviders: readonly string[] = [],
  getProviderEnvVar: (envVar: string) => Promise<string | undefined> = async () => undefined,
) {
  return {
    getApiKey: vi.fn(getApiKey),
    getProviderEnvVar: vi.fn(getProviderEnvVar),
    getOAuth: vi.fn(async () => undefined),
    getAuthMethod: vi.fn(async () => undefined),
    listOAuthProviders: vi.fn(async () => [...oauthProviders]),
  };
}

beforeEach(async () => {
  const [mod, sdkMod] = await Promise.all([import("@afx/agent-pi"), import("@afx/agent-pi-sdk")]);
  agentManager = createMockAgentManager();
  sdkAgentManager = createMockAgentManager();
  createPiAgentManager = vi.mocked(mod.createAgentManager);
  createPiSdkAgentManager = vi.mocked(sdkMod.createPiSdkAgentManager);
  createPiAgentManager.mockReset();
  createPiSdkAgentManager.mockReset();
  createPiAgentManager.mockReturnValue(agentManager);
  createPiSdkAgentManager.mockReturnValue(sdkAgentManager);
});

describe("agent-factory", () => {
  it("creates one Pi-backed agent instance", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const instances = await createConfiguredAgentInstances({
      logger,
      binaryPath: "/usr/local/bin/pi",
      ephemeral: false,
      rpcEnabled: true,
      sessionDir: "/tmp/agenticflowx-sessions",
      cwd: "/tmp/workspace",
    });

    expect(instances).toEqual([
      {
        id: "pi",
        label: "Pi CLI",
        runtime: "pi",
        manager: agentManager,
      },
    ]);
    expect(createPiAgentManager).toHaveBeenCalledWith({
      logger,
      binaryPath: "/usr/local/bin/pi",
      ephemeral: false,
      rpcEnabled: true,
      sessionDir: "/tmp/agenticflowx-sessions",
      cwd: "/tmp/workspace",
    });
  });

  it("does not create Pi RPC unless it is enabled", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();

    const instances = await createConfiguredAgentInstances({
      logger,
      binaryPath: "/usr/local/bin/pi",
      ephemeral: false,
      piAvailable: true,
    });

    expect(instances).toEqual([]);
    expect(createPiAgentManager).not.toHaveBeenCalled();
  });

  it("adds the API Providers runtime when bootstrap and secrets are configured", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(async () => "secret");

    const instances = await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      rpcEnabled: true,
      sessionDir: "/tmp/agenticflowx-sessions",
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "openai:gpt-5.2",
      secretStore: secretStore as never,
    });

    expect(instances).toEqual([
      expect.objectContaining({ id: "pi", manager: agentManager }),
      {
        id: "pi-sdk",
        label: "API Providers",
        runtime: "pi-sdk",
        manager: sdkAgentManager,
      },
    ]);
    expect(createPiSdkAgentManager).toHaveBeenCalledWith(
      expect.objectContaining({
        logger,
        bootstrapPath: "/tmp/bootstrap.js",
        provider: "openai",
        modelId: "gpt-5.2",
        apiProviders: expect.arrayContaining(["anthropic", "minimax", "openai"]),
        sessionDir: "/tmp/agenticflowx-sessions",
      }),
    );
  });

  it("passes host overlay system prompt paths to both configured runtimes", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(async () => "secret");
    const additionalSystemPromptPaths = [
      "/extension/resources/harness-overlays/common/agenticflowx-vscode.md",
    ];

    await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      rpcEnabled: true,
      sessionDir: "/tmp/agenticflowx-sessions",
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "openai:gpt-5.2",
      secretStore: secretStore as never,
      additionalSystemPromptPaths,
    });

    expect(createPiAgentManager).toHaveBeenCalledWith(
      expect.objectContaining({ additionalSystemPromptPaths }),
    );
    expect(createPiSdkAgentManager).toHaveBeenCalledWith(
      expect.objectContaining({ additionalSystemPromptPaths }),
    );
  });

  it("keeps API Providers available when Pi RPC is disabled", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(async () => "secret");

    const instances = await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      sessionDir: "/tmp/agenticflowx-sessions",
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "openai:gpt-5.2",
      secretStore: secretStore as never,
    });

    expect(instances).toEqual([
      {
        id: "pi-sdk",
        label: "API Providers",
        runtime: "pi-sdk",
        manager: sdkAgentManager,
      },
    ]);
    expect(createPiAgentManager).not.toHaveBeenCalled();
  });

  it("does not limit API Providers to the original small provider set", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(async (provider: string) =>
      provider === "minimax" ? "minimax-secret" : undefined,
    );

    const instances = await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "minimax:minimax-m2",
      piAvailable: false,
      secretStore: secretStore as never,
    });

    expect(instances).toEqual([
      {
        id: "pi-sdk",
        label: "API Providers",
        runtime: "pi-sdk",
        manager: sdkAgentManager,
      },
    ]);
    expect(createPiSdkAgentManager).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "minimax",
        modelId: "minimax-m2",
        apiProviders: ["minimax"],
      }),
    );
  });

  it("does not configure Cloudflare providers until required account metadata is stored", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(async (provider: string) =>
      provider === "cloudflare-ai-gateway" ? "cloudflare-secret" : undefined,
    );

    const instances = await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "cloudflare-ai-gateway:workers-ai/@cf/moonshotai/kimi-k2.6",
      piAvailable: false,
      secretStore: secretStore as never,
    });

    expect(instances).toEqual([]);
    expect(createPiSdkAgentManager).not.toHaveBeenCalled();
  });

  it("injects Cloudflare provider metadata into the bundled SDK spawn env", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(
      async (provider: string) =>
        provider === "cloudflare-ai-gateway" ? "cloudflare-secret" : undefined,
      [],
      async (envVar: string) =>
        envVar === "CLOUDFLARE_ACCOUNT_ID"
          ? "account-id"
          : envVar === "CLOUDFLARE_GATEWAY_ID"
            ? "gateway-id"
            : undefined,
    );

    await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "anthropic:claude-opus-4-5",
      piAvailable: false,
      secretStore: secretStore as never,
    });

    expect(createPiSdkAgentManager).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "cloudflare-ai-gateway",
        modelId: "workers-ai/@cf/moonshotai/kimi-k2.6",
        apiProviders: ["cloudflare-ai-gateway"],
        extraEnv: expect.objectContaining({
          CLOUDFLARE_ACCOUNT_ID: "account-id",
          CLOUDFLARE_GATEWAY_ID: "gateway-id",
        }),
      }),
    );
  });

  it("starts a newly configured provider with its own default model", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();
    const secretStore = createSecretStoreMock(async (provider: string) =>
      provider === "minimax" ? "minimax-secret" : undefined,
    );

    await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      bootstrapPath: "/tmp/bootstrap.js",
      sdkDefaultModel: "anthropic:claude-opus-4-5",
      piAvailable: false,
      secretStore: secretStore as never,
    });

    expect(createPiSdkAgentManager).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "minimax",
        modelId: "MiniMax-M2.7",
        apiProviders: ["minimax"],
      }),
    );
  });

  it("returns the first configured instance as the default", async () => {
    const { createConfiguredAgentInstances, getDefaultAgentInstance } =
      await import("./agent-factory");
    const { logger } = createMockLogger();
    const [instance] = await createConfiguredAgentInstances({
      logger,
      ephemeral: true,
      rpcEnabled: true,
    });
    if (!instance) throw new Error("expected at least one configured instance");

    expect(getDefaultAgentInstance([instance])).toBe(instance);
  });

  it("fails clearly when no instances are configured", async () => {
    const { getDefaultAgentInstance } = await import("./agent-factory");

    expect(() => getDefaultAgentInstance([])).toThrow("No configured agent instances");
  });

  it("skips Pi CLI when no OS-resolved binary is available", async () => {
    const { createConfiguredAgentInstances } = await import("./agent-factory");
    const { logger } = createMockLogger();

    const instances = await createConfiguredAgentInstances({
      logger,
      ephemeral: false,
      rpcEnabled: true,
      piAvailable: false,
    });

    expect(instances).toEqual([]);
    expect(createPiAgentManager).not.toHaveBeenCalled();
  });
});

describe("buildCopilotBaseUrlOverrideEnv (FR-19)", () => {
  const makeStore = (record: unknown) => ({ getOAuth: vi.fn(async () => record) }) as never;

  it("returns undefined when there is no github-copilot OAuth record", async () => {
    const { buildCopilotBaseUrlOverrideEnv } = await import("./agent-factory");
    expect(await buildCopilotBaseUrlOverrideEnv(makeStore(undefined))).toBeUndefined();
  });

  it("returns undefined when the record has no copilotBaseUrl meta", async () => {
    const { buildCopilotBaseUrlOverrideEnv } = await import("./agent-factory");
    const store = makeStore({ access: "a", refresh: "r", expires: 1, meta: {} });
    expect(await buildCopilotBaseUrlOverrideEnv(store)).toBeUndefined();
  });

  it("returns undefined when the base URL equals the individual default", async () => {
    const { buildCopilotBaseUrlOverrideEnv } = await import("./agent-factory");
    const store = makeStore({
      access: "a",
      refresh: "r",
      expires: 1,
      meta: { copilotBaseUrl: "https://api.individual.githubcopilot.com" },
    });
    expect(await buildCopilotBaseUrlOverrideEnv(store)).toBeUndefined();
  });

  it("emits AFX_PROVIDER_OVERRIDES_JSON for a non-default (enterprise) base URL", async () => {
    const { buildCopilotBaseUrlOverrideEnv } = await import("./agent-factory");
    const store = makeStore({
      access: "a",
      refresh: "r",
      expires: 1,
      meta: { copilotBaseUrl: "https://api.corp.ghe.com" },
    });
    const env = await buildCopilotBaseUrlOverrideEnv(store);
    expect(env).toBeDefined();
    expect(JSON.parse(env!["AFX_PROVIDER_OVERRIDES_JSON"]!)).toEqual({
      overrides: { "github-copilot": { baseUrl: "https://api.corp.ghe.com" } },
    });
  });
});
