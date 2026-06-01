/**
 * Canonical OAuth credential types — harness-agnostic shapes shared by the AFX
 * extension host (SecretStorage, OAuthService, agent-factory) and the apps/chat
 * Settings webview. Mirrors the custom-providers record-vs-summary split: the
 * secret-bearing {@link OAuthRecord} is host-internal and NEVER crosses the
 * host->webview bridge; the webview only ever receives the redacted
 * {@link OAuthStatusSnapshot}.
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 */

/**
 * Provider ids that support AFX-owned OAuth. The three Pi built-ins are named
 * explicitly; the open `string` arm preserves the data-driven registry seam so
 * a future registered custom OAuth provider widens without a type edit.
 */
// The `& {}` brand preserves literal autocomplete for the three Pi built-ins while keeping the
// data-driven registry seam open to any future registered provider id (avoids the
// literal-union collapse that a bare `| string` triggers).
export type OAuthProviderId = "anthropic" | "openai-codex" | "github-copilot" | (string & {});

/**
 * The active credential method for a provider. Only these two values are ever
 * persisted to `afx.authMethod.{provider}`. Selector-only render
 * classifications such as `local`/`external` are NOT part of this union.
 */
export type ProviderAuthMethod = "subscription" | "api-key";

/**
 * Provider-specific metadata preserved alongside the tokens. None of these are
 * secrets, so they MAY appear in {@link OAuthStatusSnapshot.meta}.
 */
export interface OAuthRecordMeta {
  /** OpenAI Codex `chatgpt_account_id`, derived from the access-token JWT. */
  accountId?: string;
  /** GitHub Copilot enterprise hostname when the user supplied one. */
  enterpriseDomain?: string;
  /** Derived Copilot API base URL (individual default or enterprise proxy-ep). */
  copilotBaseUrl?: string;
  /**
   * Deferred (Q5): populate only if a provider response exposes the plan name
   * safely. The UI ships a generic "Subscription" label until then.
   */
  planLabel?: string;
}

/**
 * Host-internal, secret-bearing OAuth credential record. Lives entirely in
 * VSCode SecretStorage under `afx.oauth.{provider}` as JSON. The `access` and
 * `refresh` tokens NEVER cross the host->webview bridge in cleartext — the
 * webview receives {@link OAuthStatusSnapshot} instead.
 *
 * Field shape is Pi-compatible so provider mirrors map with minimal translation.
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
 */
export interface OAuthRecord {
  /** Provider access token. Secret — host-only, env-injected at spawn. */
  access: string;
  /** Provider refresh token. Secret — host-only. */
  refresh: string;
  /**
   * Epoch-ms refresh deadline. Store the provider expiry minus the
   * provider-specific safety buffer; refresh fires when `Date.now() >= expires`.
   */
  expires: number;
  /** Granted OAuth scopes, when the provider returns them. */
  scopes?: string[];
  /** Non-secret provider metadata preserved across refresh. */
  meta?: OAuthRecordMeta;
}

/**
 * Webview-safe redacted OAuth status. The ONLY OAuth shape the host->webview
 * bridge ever carries. Carries connection booleans, the active method,
 * an expiry delta, and safe metadata — NEVER `access` or `refresh`.
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 */
export interface OAuthStatusSnapshot {
  provider: OAuthProviderId;
  /** True when an `afx.oauth.{provider}` record exists. */
  connected: boolean;
  /**
   * Resolved/derived active method for this provider, when one is set.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-2]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA]
   */
  activeMethod?: ProviderAuthMethod;
  /** Milliseconds until the refresh deadline; never the raw `expires` epoch nor any token. */
  expiresInMs?: number;
  /** Non-secret provider metadata mirrored from {@link OAuthRecord.meta}. */
  meta?: OAuthRecordMeta;
}
