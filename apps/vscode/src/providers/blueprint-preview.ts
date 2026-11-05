/**
 * Read-only native text-document provider for AFX Blueprint summaries.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-6] [FR-7]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-UI] [DES-FLOW]
 */
import * as vscode from "vscode";

export const BLUEPRINT_PREVIEW_SCHEME = "afx-blueprint";

export interface BlueprintPreviewRecord {
  id: string;
  projectId: string;
  sourceUri?: vscode.Uri;
  content: string;
}

export interface BlueprintPreviewProvider
  extends vscode.TextDocumentContentProvider, vscode.Disposable {
  uriFor(record: BlueprintPreviewRecord): vscode.Uri;
  get(uri: vscode.Uri): BlueprintPreviewRecord | undefined;
  markStale(projectId: string, state: "dirty" | "stale"): void;
  update(record: BlueprintPreviewRecord): vscode.Uri;
}

/**
 * Keeps one virtual summary per project while preserving each preview's captured source identity.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-2] [FR-6]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-UI] [DES-API]
 */
export function createBlueprintPreviewProvider(): BlueprintPreviewProvider {
  const records = new Map<string, BlueprintPreviewRecord>();
  const projectUris = new Map<string, vscode.Uri>();
  const emitter = new vscode.EventEmitter<vscode.Uri>();
  const uriFor = (record: BlueprintPreviewRecord): vscode.Uri => {
    const existing = projectUris.get(record.projectId);
    if (existing) return existing;
    const uri = vscode.Uri.parse(
      `${BLUEPRINT_PREVIEW_SCHEME}:/${encodeURIComponent(record.id)}.md`,
    );
    projectUris.set(record.projectId, uri);
    return uri;
  };
  return {
    onDidChange: emitter.event,
    provideTextDocumentContent(uri) {
      return records.get(uri.toString())?.content ?? "# AFX Blueprint\n\nPreview is unavailable.\n";
    },
    uriFor,
    get: (uri) => records.get(uri.toString()),
    markStale(projectId, state) {
      const uri = projectUris.get(projectId);
      if (!uri) return;
      const record = records.get(uri.toString());
      if (!record) return;
      const content = record.content.replace(/\n> Preview state: (?:dirty|stale)\.[^\n]*\n?$/, "");
      records.set(uri.toString(), {
        ...record,
        content: `${content}\n> Preview state: ${state}. Refresh to collect current evidence.\n`,
      });
      emitter.fire(uri);
    },
    update(record) {
      const uri = uriFor(record);
      records.set(uri.toString(), record);
      emitter.fire(uri);
      return uri;
    },
    dispose() {
      records.clear();
      projectUris.clear();
      emitter.dispose();
    },
  };
}
