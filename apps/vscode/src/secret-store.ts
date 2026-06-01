/**
 * Small VS Code SecretStorage wrapper for provider credentials, AFX-managed
 * custom-provider records, and AFX-owned OAuth records + active auth method.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-SEC] [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-10]
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 */
import type * as vscode from "vscode";

import type { CustomProviderRecord, OAuthRecord, ProviderAuthMethod } from "@afx/shared";

export const CUSTOM_PROVIDERS_INDEX_KEY = "afx.customProviders.index";

/**
 * Index of provider ids holding an OAuth record. Lets the settings snapshot
 * enumerate connected providers without scanning every secret.
 *
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 */
export const OAUTH_INDEX_KEY = "afx.oauth.index";

/**
 * Index of provider ids holding an active-method record (`afx.authMethod.{id}`).
 *
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 */
export const AUTH_METHOD_INDEX_KEY = "afx.authMethod.index";

function customProviderKey(providerId: string): string {
  return `afx.customProvider.${providerId}`;
}

function oauthKey(provider: string): string {
  return `afx.oauth.${provider}`;
}

function authMethodKey(provider: string): string {
  return `afx.authMethod.${provider}`;
}

/**
 * The only two values ever persisted to `afx.authMethod.{provider}`. Selector
 * classifications like `local`/`external` are render-only and never stored.
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
 * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
 */
const AUTH_METHOD_VALUES = [
  "subscription",
  "api-key",
] as const satisfies readonly ProviderAuthMethod[];

function isAuthMethodValue(value: string): value is ProviderAuthMethod {
  return (AUTH_METHOD_VALUES as readonly string[]).includes(value);
}

export class SecretStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getApiKey(provider: string): Promise<string | undefined> {
    return this.context.secrets.get(this.key(provider));
  }

  async setApiKey(provider: string, value: string): Promise<void> {
    await this.context.secrets.store(this.key(provider), value);
  }

  async clearApiKey(provider: string): Promise<void> {
    await this.context.secrets.delete(this.key(provider));
  }

  /**
   * Read an AFX-managed provider setup value by env-var name. Used for provider
   * metadata Pi requires in addition to the API key, such as Cloudflare account
   * and AI Gateway ids.
   *
   * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
   */
  async getProviderEnvVar(envVar: string): Promise<string | undefined> {
    return this.context.secrets.get(this.providerEnvKey(envVar));
  }

  /**
   * Persist a provider setup value by env-var name. Values stay in SecretStorage
   * and are injected into the bundled Pi SDK spawn env only.
   *
   * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
   */
  async setProviderEnvVar(envVar: string, value: string): Promise<void> {
    await this.context.secrets.store(this.providerEnvKey(envVar), value);
  }

  async clearProviderEnvVar(envVar: string): Promise<void> {
    await this.context.secrets.delete(this.providerEnvKey(envVar));
  }

  onDidChange(listener: (event: vscode.SecretStorageChangeEvent) => void): vscode.Disposable {
    return this.context.secrets.onDidChange(listener);
  }

  /**
   * Read the OAuth record for `provider`. Returns `undefined` when absent or
   * unparsable (fail closed — a corrupt record must never be treated as a live
   * credential).
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
   */
  async getOAuth(provider: string): Promise<OAuthRecord | undefined> {
    const raw = await this.context.secrets.get(oauthKey(provider));
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as OAuthRecord;
    } catch {
      return undefined;
    }
  }

  /**
   * Persist an OAuth record under `afx.oauth.${provider}` and add the provider
   * id to {@link OAUTH_INDEX_KEY}. The index is the canonical source for
   * enumeration so we never scan all secrets.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
   */
  async setOAuth(provider: string, record: OAuthRecord): Promise<void> {
    await this.context.secrets.store(oauthKey(provider), JSON.stringify(record));
    const index = await this.readIndex(OAUTH_INDEX_KEY);
    if (!index.includes(provider)) {
      index.push(provider);
      await this.writeIndex(OAUTH_INDEX_KEY, index);
    }
  }

  /**
   * Delete the OAuth record for `provider` and drop it from the index. Active
   * method records are owned separately (see {@link clearAuthMethod}); sign-out
   * orchestration in `OAuthService` decides whether the method reverts to
   * `api-key` or fails closed.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-7] [NFR-1] [NFR-2]
   */
  async clearOAuth(provider: string): Promise<void> {
    await this.context.secrets.delete(oauthKey(provider));
    const index = await this.readIndex(OAUTH_INDEX_KEY);
    const next = index.filter((id) => id !== provider);
    if (next.length !== index.length) {
      await this.writeIndex(OAUTH_INDEX_KEY, next);
    }
  }

  /** Enumerate provider ids that have an OAuth record, via the index. */
  async listOAuthProviders(): Promise<string[]> {
    return this.readIndex(OAUTH_INDEX_KEY);
  }

  /**
   * Read the active auth method for `provider`. Returns `undefined` when absent
   * or when the stored value is not one of `"subscription" | "api-key"` (fail
   * closed — an unknown value must not be coerced into a method).
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
   */
  async getAuthMethod(provider: string): Promise<ProviderAuthMethod | undefined> {
    const raw = await this.context.secrets.get(authMethodKey(provider));
    if (raw === undefined) return undefined;
    return isAuthMethodValue(raw) ? raw : undefined;
  }

  /**
   * Persist the active auth method for `provider` under
   * `afx.authMethod.${provider}` and add the id to {@link AUTH_METHOD_INDEX_KEY}.
   * Only `"subscription" | "api-key"` are accepted; the `ProviderAuthMethod`
   * type makes any other value a compile error.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
   */
  async setAuthMethod(provider: string, method: ProviderAuthMethod): Promise<void> {
    await this.context.secrets.store(authMethodKey(provider), method);
    const index = await this.readIndex(AUTH_METHOD_INDEX_KEY);
    if (!index.includes(provider)) {
      index.push(provider);
      await this.writeIndex(AUTH_METHOD_INDEX_KEY, index);
    }
  }

  /**
   * Delete the active-method record for `provider` and drop it from the index.
   * Used by sign-out when no API key remains, so the next read fails closed
   * rather than silently selecting a credential.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-2] [FR-7] [NFR-2]
   */
  async clearAuthMethod(provider: string): Promise<void> {
    await this.context.secrets.delete(authMethodKey(provider));
    const index = await this.readIndex(AUTH_METHOD_INDEX_KEY);
    const next = index.filter((id) => id !== provider);
    if (next.length !== index.length) {
      await this.writeIndex(AUTH_METHOD_INDEX_KEY, next);
    }
  }

  /** Enumerate provider ids that have an active auth-method record, via the index. */
  async listAuthMethodProviders(): Promise<string[]> {
    return this.readIndex(AUTH_METHOD_INDEX_KEY);
  }

  /**
   * Read a single AFX-managed custom-provider record by id. Returns `undefined`
   * if not present or unparsable.
   */
  async getCustomProviderRecord(providerId: string): Promise<CustomProviderRecord | undefined> {
    const raw = await this.context.secrets.get(customProviderKey(providerId));
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as CustomProviderRecord;
    } catch {
      return undefined;
    }
  }

  /**
   * Persist a record under `afx.customProvider.${id}` and add the id to the
   * index entry `afx.customProviders.index`. The index is the canonical source
   * for enumeration so we don't scan all secrets.
   */
  async setCustomProviderRecord(record: CustomProviderRecord): Promise<void> {
    await this.context.secrets.store(customProviderKey(record.id), JSON.stringify(record));
    const index = await this.readCustomProvidersIndex();
    if (!index.includes(record.id)) {
      index.push(record.id);
      await this.writeCustomProvidersIndex(index);
    }
  }

  async deleteCustomProviderRecord(providerId: string): Promise<void> {
    await this.context.secrets.delete(customProviderKey(providerId));
    const index = await this.readCustomProvidersIndex();
    const next = index.filter((id) => id !== providerId);
    if (next.length !== index.length) {
      await this.writeCustomProvidersIndex(next);
    }
  }

  /** Enumerate all AFX-managed records via the index. */
  async listCustomProviderRecords(): Promise<CustomProviderRecord[]> {
    const ids = await this.readCustomProvidersIndex();
    const records: CustomProviderRecord[] = [];
    for (const id of ids) {
      const record = await this.getCustomProviderRecord(id);
      if (record) records.push(record);
    }
    return records;
  }

  /** Returns true if `key` matches the AFX custom-provider namespace. */
  static isCustomProviderKey(key: string): boolean {
    return key.startsWith("afx.customProvider.") || key === CUSTOM_PROVIDERS_INDEX_KEY;
  }

  /** Returns true if `key` matches the AFX OAuth-record namespace. */
  static isOAuthKey(key: string): boolean {
    return key.startsWith("afx.oauth.") || key === OAUTH_INDEX_KEY;
  }

  /** Returns true if `key` matches the AFX active-auth-method namespace. */
  static isAuthMethodKey(key: string): boolean {
    return key.startsWith("afx.authMethod.") || key === AUTH_METHOD_INDEX_KEY;
  }

  static isProviderEnvKey(key: string): boolean {
    return key.startsWith("afx.providerEnv.");
  }

  private async readCustomProvidersIndex(): Promise<string[]> {
    return this.readIndex(CUSTOM_PROVIDERS_INDEX_KEY);
  }

  private async writeCustomProvidersIndex(ids: readonly string[]): Promise<void> {
    await this.writeIndex(CUSTOM_PROVIDERS_INDEX_KEY, ids);
  }

  /**
   * Read a JSON string-array index secret. Parses fail closed: a corrupt or
   * non-array value yields an empty list. Shared by the custom-provider, OAuth,
   * and active-method indexes.
   */
  private async readIndex(indexKey: string): Promise<string[]> {
    const raw = await this.context.secrets.get(indexKey);
    if (raw === undefined) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(indexKey: string, ids: readonly string[]): Promise<void> {
    await this.context.secrets.store(indexKey, JSON.stringify(ids));
  }

  private key(provider: string): string {
    return `afx.apiKey.${provider}`;
  }

  private providerEnvKey(envVar: string): string {
    return `afx.providerEnv.${envVar}`;
  }
}
