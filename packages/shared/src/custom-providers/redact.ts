/**
 * Redaction helpers — produce webview-safe `CustomProviderSummary` from
 * canonical records. Enforces NFR-1: no apiKey, models[], headers, or compat
 * crosses the host→webview bridge in cleartext.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [NFR-1] [FR-10]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 */
import { COMPAT_FLAGS_BY_API } from "./types";
import type { CustomProviderOrigin, CustomProviderRecord, CustomProviderSummary } from "./types";

const SECRET_PATTERN = /(apiKey|api_key|secret|token|password|bearer|authorization)/i;
const SECRET_VALUE_HINT_KEYS = new Set([
  "apiKey",
  "apikey",
  "api_key",
  "secret",
  "token",
  "password",
  "bearer",
  "authorization",
]);

/**
 * Build a redacted webview-safe summary from a canonical record.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [NFR-1]
 */
export function summarizeForWebview(
  record: CustomProviderRecord,
  origin: CustomProviderOrigin,
  options: { hasLiteralApiKeyOnDisk?: boolean } = {},
): CustomProviderSummary {
  const summary: CustomProviderSummary = {
    id: record.id,
    displayName: record.displayName,
    baseUrl: record.baseUrl,
    api: record.api,
    modelCount: record.models.length,
    models: record.models.map((m) => {
      const entry: CustomProviderSummary["models"][number] = { id: m.id, name: m.name };
      if (m.api) entry.api = m.api;
      if (m.contextWindow !== undefined) entry.contextWindow = m.contextWindow;
      if (m.maxTokens !== undefined) entry.maxTokens = m.maxTokens;
      if (m.capabilities) entry.capabilities = { ...m.capabilities };
      return entry;
    }),
    apiKeySource: record.apiKeyRef.source,
    apiKeyLabel: record.apiKeyRef.label,
    hasApiKey:
      record.apiKeyRef.source === "vscode-secret"
        ? typeof record.apiKey === "string" && record.apiKey.length > 0
        : record.apiKeyRef.source !== "none",
    origin,
  };
  if (record.authHeader !== undefined) {
    summary.authHeader = record.authHeader;
  }
  // Project only the UI-known compat flags for this api kind. Unknown flags on
  // the canonical record are preserved server-side but not echoed (NFR-1).
  const knownFlags = COMPAT_FLAGS_BY_API[record.api];
  if (knownFlags && knownFlags.length > 0 && record.compat) {
    const projection: Record<string, boolean> = {};
    let any = false;
    for (const flag of knownFlags) {
      const raw = record.compat[flag.key];
      if (typeof raw === "boolean") {
        projection[flag.key] = raw;
        any = true;
      }
    }
    if (any) summary.compatFlags = projection;
  }
  if (options.hasLiteralApiKeyOnDisk) {
    summary.hasLiteralApiKeyOnDisk = true;
  }
  return summary;
}

/**
 * Runtime guard — throws if a `CustomProviderSummary` (or arbitrary value claimed
 * to be one) carries any field that should never reach the webview. Used by tests
 * and by the host bridge dispatch as a defence-in-depth check.
 *
 * Allows the redacted `models` array on `CustomProviderSummary` (model id/name/
 * context window are non-secret) but blocks `compat`, `headers`, and any field
 * whose name suggests a credential.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [NFR-1]
 */
export function assertNoSecretLeak(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    // Allow apiKeyLabel + apiKeySource + compatFlags — they are non-secret by contract.
    if (key === "apiKeyLabel" || key === "apiKeySource" || key === "compatFlags") continue;
    if (SECRET_VALUE_HINT_KEYS.has(key.toLowerCase())) {
      throw new Error(
        `assertNoSecretLeak: forbidden field "${key}" present in webview-bound payload`,
      );
    }
    if (key === "compat" || key === "headers") {
      throw new Error(
        `assertNoSecretLeak: forbidden field "${key}" present in webview-bound payload`,
      );
    }
    if (typeof raw === "string" && SECRET_PATTERN.test(key) && raw.length > 0) {
      // Even if the key wasn't in the explicit hint set, refuse to send a non-empty string for a secret-shaped key.
      throw new Error(
        `assertNoSecretLeak: forbidden secret-shaped field "${key}" present with value`,
      );
    }
    if (raw && typeof raw === "object") {
      assertNoSecretLeak(raw);
    }
  }
}
