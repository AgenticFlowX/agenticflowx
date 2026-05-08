/**
 * Small VS Code SecretStorage wrapper for provider credentials and AFX-managed
 * custom-provider records.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-SEC] [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-10]
 */
import type * as vscode from "vscode";

import type { CustomProviderRecord } from "@afx/shared";

export const CUSTOM_PROVIDERS_INDEX_KEY = "afx.customProviders.index";

function customProviderKey(providerId: string): string {
  return `afx.customProvider.${providerId}`;
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

  onDidChange(listener: (event: vscode.SecretStorageChangeEvent) => void): vscode.Disposable {
    return this.context.secrets.onDidChange(listener);
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

  private async readCustomProvidersIndex(): Promise<string[]> {
    const raw = await this.context.secrets.get(CUSTOM_PROVIDERS_INDEX_KEY);
    if (raw === undefined) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }

  private async writeCustomProvidersIndex(ids: readonly string[]): Promise<void> {
    await this.context.secrets.store(CUSTOM_PROVIDERS_INDEX_KEY, JSON.stringify(ids));
  }

  private key(provider: string): string {
    return `afx.apiKey.${provider}`;
  }
}
