/**
 * Pi SDK provider-overrides bootstrap helpers — pure, no dependence on
 * `@earendil-works/pi-coding-agent` types so unit tests stay synchronous.
 *
 * Consumes `AFX_PROVIDER_OVERRIDES_JSON`, an env-only channel for AFX to override
 * EXISTING (built-in) Pi providers at spawn. `registerProvider(name, config)` with
 * no `models` mutates request config for the provider's existing models; it does
 * NOT replace them. This is distinct from `AFX_CUSTOM_PROVIDERS_JSON`, which
 * registers NEW providers with their own models.
 *
 * The motivating case is GitHub Copilot Enterprise: AFX owns the subscription
 * credential and the SDK receives it by env reference, so AFX must also inject the
 * derived Copilot base URL. The override can also carry an `apiKeyEnv`
 * reference for AFX-owned subscription credentials. That value is the NAME of an
 * env var (for example `AFX_API_KEY_OPENAI_CODEX`), not the token, so Pi can mark
 * the built-in provider configured without exposing the token in process args.
 *
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-4] [FR-5] [NFR-1]
 * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]
 */
import type { PiExtensionApiLike } from "./custom-providers-bootstrap";

/** A single request/config override applied to an existing Pi provider. */
export interface AfxProviderOverride {
  /** Base URL that replaces the provider's default for its existing models. */
  baseUrl?: string;
  /** Env var name that Pi should resolve for the provider credential. */
  apiKeyEnv?: string;
}

/** Top-level envelope shipped via `AFX_PROVIDER_OVERRIDES_JSON`. */
export interface AfxProviderOverridesEnvelope {
  /** Provider id (e.g. "github-copilot") -> override. */
  overrides: Record<string, AfxProviderOverride>;
}

/**
 * Result of parsing the envelope. Parse errors are kept as data so the bootstrap
 * can log them without throwing — pi's main flow continues even if the AFX overlay
 * fails to parse.
 */
export interface AfxOverridesParseResult {
  envelope: AfxProviderOverridesEnvelope | null;
  error?: string;
}

/**
 * Parse the `AFX_PROVIDER_OVERRIDES_JSON` env var. Returns the envelope when valid;
 * sets `error` describing the failure when malformed. Never throws. Entries whose
 * usable fields are dropped (a no-op override would otherwise clobber the
 * provider's default with `undefined`).
 */
export function parseAfxOverrides(text: string | undefined): AfxOverridesParseResult {
  if (text === undefined || text.length === 0) {
    return { envelope: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      envelope: null,
      error: `AFX_PROVIDER_OVERRIDES_JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      envelope: null,
      error: "AFX_PROVIDER_OVERRIDES_JSON: top-level value is not an object",
    };
  }
  const overridesRaw = (parsed as Record<string, unknown>)["overrides"];
  if (overridesRaw === null || typeof overridesRaw !== "object" || Array.isArray(overridesRaw)) {
    return {
      envelope: null,
      error: "AFX_PROVIDER_OVERRIDES_JSON: missing or invalid `overrides` map",
    };
  }
  const overrides: Record<string, AfxProviderOverride> = {};
  for (const [id, entry] of Object.entries(overridesRaw as Record<string, unknown>)) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    const baseUrl = raw["baseUrl"];
    const apiKeyEnv = raw["apiKeyEnv"];
    const override: AfxProviderOverride = {};
    if (typeof baseUrl === "string" && baseUrl.length > 0) {
      override.baseUrl = baseUrl;
    }
    if (typeof apiKeyEnv === "string" && apiKeyEnv.length > 0) {
      override.apiKeyEnv = apiKeyEnv;
    }
    if (override.baseUrl || override.apiKeyEnv) {
      overrides[id] = override;
    }
  }
  return { envelope: { overrides } };
}

/**
 * Apply an overrides envelope by calling `registerProvider(id, config)` for each
 * entry — Pi treats configs with no `models` as request/base-URL overrides for the
 * provider's existing models. Pure — no env I/O — so callers can supply mocks.
 */
export function applyAfxOverrides(
  pi: PiExtensionApiLike,
  envelope: AfxProviderOverridesEnvelope,
): { overridden: string[]; errors: Array<{ id: string; error: string }> } {
  const overridden: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];
  for (const [id, override] of Object.entries(envelope.overrides)) {
    try {
      const config = {
        ...(override.baseUrl ? { baseUrl: override.baseUrl } : {}),
        ...(override.apiKeyEnv ? { apiKey: override.apiKeyEnv } : {}),
      };
      if (Object.keys(config).length === 0) continue;
      pi.registerProvider(id, config);
      overridden.push(id);
    } catch (err) {
      errors.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { overridden, errors };
}

/**
 * Create the pi extension factory that reads `AFX_PROVIDER_OVERRIDES_JSON` from env
 * and applies each override. Returns a function compatible with pi-mono's
 * `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>`.
 *
 * The factory is a no-op when the env var is unset or carries no usable overrides.
 *
 * @param env — process env (defaulted to `process.env` at call sites).
 * @param onDiagnostic — optional callback for parse / apply diagnostics.
 */
export function createProviderOverridesExtensionFactory(
  env: NodeJS.ProcessEnv = process.env,
  onDiagnostic?: (message: string) => void,
): (pi: PiExtensionApiLike) => void {
  const result = parseAfxOverrides(env["AFX_PROVIDER_OVERRIDES_JSON"]);
  if (result.error) {
    onDiagnostic?.(result.error);
  }
  const envelope = result.envelope;
  return (pi) => {
    if (!envelope || Object.keys(envelope.overrides).length === 0) return;
    const apply = applyAfxOverrides(pi, envelope);
    if (apply.overridden.length > 0) {
      onDiagnostic?.(
        `AFX applied ${apply.overridden.length} provider override(s): ${apply.overridden.join(", ")}`,
      );
    }
    for (const err of apply.errors) {
      onDiagnostic?.(`AFX failed to override ${err.id}: ${err.error}`);
    }
  };
}
