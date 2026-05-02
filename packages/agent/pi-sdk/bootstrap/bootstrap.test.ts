import { describe, expect, it, vi } from "vitest";

import { buildBootstrapArgs } from "./bootstrap";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  main: vi.fn(),
  runRpcMode: vi.fn(),
  createAgentSessionRuntime: vi.fn(),
}));

describe("buildBootstrapArgs", () => {
  it("adds provider, model, api key, and session dir from env", () => {
    const env: NodeJS.ProcessEnv = {
      AFX_PROVIDER: "anthropic",
      AFX_MODEL_ID: "claude-opus-4-5",
      AFX_API_KEY_ANTHROPIC: "secret",
      AFX_SESSION_DIR: "/sessions",
    };

    expect(buildBootstrapArgs(["--mode", "rpc"], env)).toEqual([
      "--mode",
      "rpc",
      "--provider",
      "anthropic",
      "--model",
      "claude-opus-4-5",
      "--api-key",
      "secret",
      "--session-dir",
      "/sessions",
    ]);
    expect(env["ANTHROPIC_API_KEY"]).toBe("secret");
    expect(env["PI_CODING_AGENT_DIR"]).toBe("/sessions");
  });

  it("does not override explicit CLI options", () => {
    expect(
      buildBootstrapArgs(["--mode", "rpc", "--provider", "openai", "--model", "gpt-5.2"], {
        AFX_PROVIDER: "anthropic",
        AFX_MODEL_ID: "claude-opus-4-5",
      }),
    ).toEqual(["--mode", "rpc", "--provider", "openai", "--model", "gpt-5.2"]);
  });

  it("does not pass --api-key without a model scope", () => {
    const env: NodeJS.ProcessEnv = {
      AFX_PROVIDER: "minimax",
      AFX_API_KEY_MINIMAX: "secret",
    };

    expect(buildBootstrapArgs(["--mode", "rpc"], env)).toEqual([
      "--mode",
      "rpc",
      "--provider",
      "minimax",
    ]);
    expect(env["MINIMAX_API_KEY"]).toBe("secret");
  });
});
