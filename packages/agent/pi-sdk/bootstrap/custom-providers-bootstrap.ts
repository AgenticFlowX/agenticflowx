/**
 * Pi SDK custom-providers bootstrap helpers — pure, no dependence on
 * `@earendil-works/pi-coding-agent` types so unit tests can stay synchronous.
 *
 * The exported `createCustomProvidersExtensionFactory` returns an `ExtensionFactory`
 * (typed against pi's runtime API at the call site in `bootstrap.ts`) that reads
 * the AFX envelope from env and registers each canonical provider via
 * `pi.registerProvider(name, config)`.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */

/**
 * Pi-mono extension API surface — narrowed to what AFX needs. We type-cast
 * this at the integration boundary so the bootstrap helpers stay decoupled
 * from `@earendil-works/pi-coding-agent` for unit testing.
 */
export interface PiExtensionApiLike {
  registerProvider: (name: string, config: unknown) => void;
}

/** Subset of pi-mono `ProviderConfig` AFX produces from the canonical envelope. */
export interface AfxProviderConfig {
  name?: string;
  baseUrl: string;
  api: string;
  apiKey?: string;
  authHeader?: boolean;
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
  models: AfxProviderModelConfig[];
}

export interface AfxProviderModelConfig {
  id: string;
  name: string;
  api?: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
}

/** Top-level envelope shape shipped via `AFX_CUSTOM_PROVIDERS_JSON`. */
export interface AfxCustomProvidersEnvelope {
  providers: Record<string, AfxProviderConfig>;
}

/**
 * Result of parsing the envelope. Keeps parse errors as data so the bootstrap can log
 * them without throwing — pi's main flow continues even if AFX overlay fails.
 */
export interface AfxEnvelopeParseResult {
  envelope: AfxCustomProvidersEnvelope | null;
  error?: string;
}

/**
 * Parse the `AFX_CUSTOM_PROVIDERS_JSON` env var. Returns the envelope when valid;
 * sets `error` describing the failure when malformed. Never throws.
 */
export function parseAfxEnvelope(text: string | undefined): AfxEnvelopeParseResult {
  if (text === undefined || text.length === 0) {
    return { envelope: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      envelope: null,
      error: `AFX_CUSTOM_PROVIDERS_JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { envelope: null, error: "AFX_CUSTOM_PROVIDERS_JSON: top-level value is not an object" };
  }
  const root = parsed as Record<string, unknown>;
  const providersRaw = root["providers"];
  if (providersRaw === null || typeof providersRaw !== "object" || Array.isArray(providersRaw)) {
    return {
      envelope: null,
      error: "AFX_CUSTOM_PROVIDERS_JSON: missing or invalid `providers` map",
    };
  }
  return {
    envelope: { providers: providersRaw as Record<string, AfxProviderConfig> },
  };
}

/**
 * Apply an envelope to a pi-mono extension API by calling `registerProvider` for each entry.
 * Pure — no env I/O — so callers can supply mocks in tests.
 */
export function applyAfxEnvelope(
  pi: PiExtensionApiLike,
  envelope: AfxCustomProvidersEnvelope,
): { registered: string[]; errors: Array<{ id: string; error: string }> } {
  const registered: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];
  for (const [id, config] of Object.entries(envelope.providers)) {
    try {
      pi.registerProvider(id, config);
      registered.push(id);
    } catch (err) {
      errors.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { registered, errors };
}

/**
 * Create the pi extension factory that reads `AFX_CUSTOM_PROVIDERS_JSON` from env
 * and registers each provider. Returns a function compatible with pi-mono's
 * `ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>`.
 *
 * The factory is a no-op when the env var is unset.
 *
 * @param env — process env (defaulted to `process.env` at call sites).
 * @param onDiagnostic — optional callback for parse / registration diagnostics.
 */
export function createCustomProvidersExtensionFactory(
  env: NodeJS.ProcessEnv = process.env,
  onDiagnostic?: (message: string) => void,
): (pi: PiExtensionApiLike) => void {
  const result = parseAfxEnvelope(env["AFX_CUSTOM_PROVIDERS_JSON"]);
  if (result.error) {
    onDiagnostic?.(result.error);
  }
  const envelope = result.envelope;
  return (pi) => {
    if (!envelope) return;
    const apply = applyAfxEnvelope(pi, envelope);
    if (apply.registered.length > 0) {
      onDiagnostic?.(
        `AFX registered ${apply.registered.length} custom provider(s): ${apply.registered.join(", ")}`,
      );
    }
    for (const err of apply.errors) {
      onDiagnostic?.(`AFX failed to register ${err.id}: ${err.error}`);
    }
  };
}
