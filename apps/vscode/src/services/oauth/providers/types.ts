/**
 * OAuth provider registry types — the harness-agnostic descriptor contract every
 * built-in provider implements, plus the SecretStorage record shape ({@link OAuthRecord})
 * the host persists. Descriptors record the AFX-owned subscription provider contract:
 * client ids, authorize/token URLs, scopes, fixed loopback ports, redirect URI host,
 * refresh grant, and how a stored record maps to the credential string consumed by
 * SDK injection.
 *
 * The credential record/method/id types (`OAuthRecord`, `ProviderAuthMethod`,
 * `OAuthProviderId`) now live canonically in `@afx/shared` (`packages/shared/src/oauth/`).
 * The two consumed by provider descriptors and the registry (`OAuthRecord`,
 * `OAuthProviderId`) are re-exported here so they keep a single import surface
 * (`./types`); `ProviderAuthMethod` has no consumer through this barrel, so callers
 * import it from `@afx/shared` directly. Only the descriptor/registry-shape types
 * below are owned locally.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-3] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
import type { OAuthProviderId, OAuthRecord } from "@afx/shared";

// Re-export the canonical credential types consumed via this barrel so provider
// descriptors and the registry keep a single import surface (`./types`) rather
// than reaching into `@afx/shared` directly for the record/id shapes.
export type { OAuthProviderId, OAuthRecord };

/** OAuth flow kind a provider uses to obtain its first credential. */
export type OAuthFlowKind = "pkce-loopback" | "device-code";

/** Callbacks the host wires into a descriptor's {@link OAuthProviderDescriptor.buildAuthUrl}. */
export interface BuildAuthUrlResult {
  /** Provider authorize URL to open with `vscode.env.openExternal`. */
  url: string;
  /** PKCE verifier (also used as `state` for Anthropic); validate equality before exchange. */
  verifier: string;
  /** Random state validated against the callback before token exchange. */
  state: string;
}

/**
 * Harness-agnostic AFX provider descriptor for managed subscription accounts.
 *
 * @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-3] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]
 */
export interface OAuthProviderDescriptor {
  /** Provider id shared by catalog metadata, SecretStorage, and SDK injection. */
  readonly id: OAuthProviderId;
  /** AFX voice display name shown in Settings and selector surfaces. */
  readonly displayName: string;
  /** Flow used to obtain the first credential. */
  readonly flow: OAuthFlowKind;
  /** Fixed loopback port for `pkce-loopback` providers; `undefined` for device-code. */
  readonly port?: number;
  /** Loopback callback path for `pkce-loopback` providers. */
  readonly callbackPath?: string;
  /**
   * Registered `redirect_uri` (host `localhost`, never `127.0.0.1`) for `pkce-loopback`.
   * The loopback server binds the loopback families; the provider only accepts this URI.
   * `undefined` for device-code.
   */
  readonly redirectUri?: string;
  /**
   * True only when a single provider id supports BOTH `subscription` and `api-key`
   * on the same card (Anthropic). Subscription-only providers are `false`.
   */
  readonly dualMethod: boolean;
  /** OAuth authorize endpoint. */
  readonly authorizeUrl: string;
  /** OAuth token endpoint (exchange + refresh). */
  readonly tokenUrl: string;
  /** Space-delimited scopes string sent to the authorize endpoint. */
  readonly scopes: string;
  /** OAuth client id sent to provider authorize/token endpoints. */
  readonly clientId: string;

  /**
   * Build the authorize URL plus PKCE verifier/state. PKCE-loopback providers only;
   * device-code providers omit this and use their own start step.
   */
  buildAuthUrl?(): Promise<BuildAuthUrlResult>;

  /**
   * Exchange an authorization code for an {@link OAuthRecord} (PKCE-loopback only).
   * `expires` is already normalized to the provider's refresh deadline.
   */
  exchange?(input: {
    code: string;
    state: string;
    verifier: string;
    redirectUri: string;
  }): Promise<OAuthRecord>;

  /**
   * Refresh credentials and return a rotated {@link OAuthRecord}. Preserves provider
   * metadata (OpenAI `accountId`, Copilot enterprise domain).
   */
  refresh(record: OAuthRecord): Promise<OAuthRecord>;

  /** Map a stored record to the provider api-key/bearer string the SDK consumes. */
  credToKey(record: OAuthRecord): string;
}
