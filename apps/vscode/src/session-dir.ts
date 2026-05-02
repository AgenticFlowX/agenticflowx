/**
 * Shared session directory resolution for runtimes that speak Pi sessions.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
import * as vscode from "vscode";

export function resolveAfxSessionDir(context: vscode.ExtensionContext): string {
  const configured = vscode.workspace.getConfiguration("afx").get<string>("sessionDir", "").trim();
  if (configured.length > 0) return configured;
  return vscode.Uri.joinPath(context.globalStorageUri, "sessions").fsPath;
}
