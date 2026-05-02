#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { createAgentSessionRuntime, main, runRpcMode } from "@mariozechner/pi-coding-agent";

import { applyProviderEnv, getApiKey } from "./auth";

void runRpcMode;
void createAgentSessionRuntime;

export function buildBootstrapArgs(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const nextArgs = [...args];
  const provider = env["AFX_PROVIDER"];
  const modelId = env["AFX_MODEL_ID"];

  if (provider && !hasOption(nextArgs, "--provider")) {
    nextArgs.push("--provider", provider);
  }
  if (modelId && !hasOption(nextArgs, "--model")) {
    nextArgs.push("--model", modelId);
  }
  if (provider) {
    const apiKey = getApiKey(provider, env);
    if (apiKey) {
      applyProviderEnv(provider, apiKey, env);
      const hasModelScope = hasOption(nextArgs, "--model") || hasOption(nextArgs, "--models");
      if (hasModelScope && !hasOption(nextArgs, "--api-key")) {
        nextArgs.push("--api-key", apiKey);
      }
    }
  }
  if (
    env["AFX_SESSION_DIR"] &&
    !hasOption(nextArgs, "--session-dir") &&
    !hasOption(nextArgs, "--no-session")
  ) {
    env["PI_CODING_AGENT_DIR"] ??= env["AFX_SESSION_DIR"];
    nextArgs.push("--session-dir", env["AFX_SESSION_DIR"]);
  }
  if (env["AFX_OLLAMA_BASE_URL"]) {
    env["OLLAMA_BASE_URL"] ??= env["AFX_OLLAMA_BASE_URL"];
  }

  return nextArgs;
}

function hasOption(args: readonly string[], option: string): boolean {
  return args.includes(option) || args.some((arg) => arg.startsWith(`${option}=`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(buildBootstrapArgs(process.argv.slice(2))).catch((err: unknown) => {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    process.exitCode = 1;
  });
}
