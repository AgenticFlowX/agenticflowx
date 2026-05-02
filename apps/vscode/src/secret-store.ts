/**
 * Small VS Code SecretStorage wrapper for provider credentials.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
import type * as vscode from "vscode";

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

  private key(provider: string): string {
    return `afx.apiKey.${provider}`;
  }
}
