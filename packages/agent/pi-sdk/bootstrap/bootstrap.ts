#!/usr/bin/env node
/**
 * Pi SDK bootstrap entry. Translates AFX_* env vars into pi CLI args and, when
 * AFX-managed custom providers are present, attaches an `extensionFactory` that
 * registers them via `pi.registerProvider(...)` at runtime startup.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-4] [FR-5] [NFR-1]
 * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]
 */
import { fileURLToPath } from "node:url";

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { main } from "@earendil-works/pi-coding-agent";

import { applyProviderEnv, getApiKey, providerEnvKey } from "./auth";
import {
  type PiExtensionApiLike,
  createCustomProvidersExtensionFactory,
} from "./custom-providers-bootstrap";
import { createProviderOverridesExtensionFactory } from "./provider-overrides-bootstrap";

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
      // Subscription (OAuth) tokens are delivered env-only and must never reach
      // a --api-key CLI arg (process-list exposure). applyProviderEnv still runs
      // so Pi sees the provider env aliases; only the CLI arg is gated off.
      // @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
      // @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]
      applyProviderEnv(provider, apiKey, env);
      const isSubscription = env[`AFX_AUTH_METHOD_${providerEnvKey(provider)}`] === "subscription";
      const hasModelScope = hasOption(nextArgs, "--model") || hasOption(nextArgs, "--models");
      if (!isSubscription && hasModelScope && !hasOption(nextArgs, "--api-key")) {
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

/**
 * Build the pi `extensionFactory` that registers AFX-managed custom providers.
 * Returns `undefined` when there's nothing to register (so we don't add a no-op
 * extension to pi's pipeline).
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5]
 */
export function buildAfxCustomProvidersExtensionFactory(
  env: NodeJS.ProcessEnv = process.env,
  onDiagnostic?: (message: string) => void,
): ExtensionFactory | undefined {
  if (!env["AFX_CUSTOM_PROVIDERS_JSON"]) return undefined;
  const innerFactory = createCustomProvidersExtensionFactory(env, onDiagnostic);
  return (pi: ExtensionAPI) => {
    // The pi-mono ExtensionAPI is a superset of `PiExtensionApiLike`; cast
    // narrows the surface for the helper without losing type safety in tests.
    innerFactory(pi as unknown as PiExtensionApiLike);
  };
}

/**
 * Build the pi `extensionFactory` that applies existing-provider overrides from
 * `AFX_PROVIDER_OVERRIDES_JSON` (e.g. Copilot Enterprise base URLs and env-key
 * credential references for subscription providers). Returns `undefined` when
 * there's nothing to override so we don't add a no-op extension.
 *
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-4] [FR-5] [NFR-1]
 * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]
 */
export function buildAfxProviderOverridesExtensionFactory(
  env: NodeJS.ProcessEnv = process.env,
  onDiagnostic?: (message: string) => void,
): ExtensionFactory | undefined {
  if (!env["AFX_PROVIDER_OVERRIDES_JSON"]) return undefined;
  const innerFactory = createProviderOverridesExtensionFactory(env, onDiagnostic);
  return (pi: ExtensionAPI) => {
    innerFactory(pi as unknown as PiExtensionApiLike);
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const onDiagnostic = (msg: string): void => {
    process.stderr.write(`${msg}\n`);
  };
  const extensionFactories = [
    buildAfxCustomProvidersExtensionFactory(process.env, onDiagnostic),
    // Base-URL overrides run after provider registration so a Copilot Enterprise
    // base URL is applied to the built-in github-copilot models.
    buildAfxProviderOverridesExtensionFactory(process.env, onDiagnostic),
  ].filter((factory): factory is ExtensionFactory => factory !== undefined);
  const mainOptions = extensionFactories.length > 0 ? { extensionFactories } : undefined;
  main(buildBootstrapArgs(process.argv.slice(2)), mainOptions).catch((err: unknown) => {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    process.exitCode = 1;
  });
}
