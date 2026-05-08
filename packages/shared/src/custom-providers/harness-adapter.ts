/**
 * Harness-agnostic adapter contract. Concrete adapters live under
 * `packages/agent/<harness>/` and never import vscode (per ADR-0004).
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/adr/ADR-0008-afx-custom-providers-adapter-pattern.md
 */
import type { CustomProviderRecord } from "./types";

/**
 * Materialization strategy:
 * - `in-process-register` — bootstrap reads canonical records from env, builds an
 *   empty harness registry, calls `registerProvider(...)` per record. No file write.
 * - `temp-file` — adapter serializes to a transient config file passed to the harness
 *   via its supported config-path mechanism. Used by harnesses without an in-process API.
 */
export type HarnessMaterialization = "in-process-register" | "temp-file";

/** Identifier for the active harness. */
export type HarnessId = "pi-sdk" | "oh-my-pi" | "opencode";

/**
 * Result of `encodeForBootstrap` — the JSON envelope shipped via `AFX_CUSTOM_PROVIDERS_JSON`
 * env var, plus an env map of `AFX_<SLUG>_KEY=<value>` entries that the bootstrap process
 * picks up via the harness's existing env-resolution path.
 */
export interface HarnessBootstrapEnvelope {
  /** JSON-serialized envelope to ship via `AFX_CUSTOM_PROVIDERS_JSON`. Contains env-var refs only — no literal apiKey values. */
  envelopeJson: string;
  /** Env-var map: `AFX_<SLUG>_KEY` → resolved secret value. Set on the bootstrap process. */
  env: Record<string, string>;
}

/** Result of parsing a harness-native config file for read-only display. */
export interface HarnessParseResult {
  records: CustomProviderRecord[];
  warnings: string[];
}

export interface HarnessAdapter {
  readonly id: HarnessId;
  readonly displayName: string;
  readonly materialization: HarnessMaterialization;

  /**
   * Path the harness reads its hand-edited config from (used by the host for read-only
   * display surfaces, e.g. the Pi RPC track). Optional — adapters with no on-disk config
   * (in-memory only) can omit this.
   */
  handEditedConfigPath?(): string;

  /**
   * Translate canonical records into a bootstrap envelope. For `in-process-register` adapters,
   * the bootstrap parses `envelopeJson` and calls the harness's `registerProvider` API.
   */
  encodeForBootstrap(records: readonly CustomProviderRecord[]): HarnessBootstrapEnvelope;

  /**
   * Parse the harness's native config text into canonical records (best-effort). Used only
   * for the read-only Pi RPC track display, never to seed AFX-managed records.
   */
  parseHandEdited(text: string): HarnessParseResult;
}
