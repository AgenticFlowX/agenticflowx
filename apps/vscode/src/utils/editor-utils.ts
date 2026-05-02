/**
 * Editor helpers — extract selection range/context for AFX context menu actions.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import { isAbsolute, relative, sep } from "node:path";

import * as vscode from "vscode";

export function getEffectiveRange(
  document: vscode.TextDocument,
  range: vscode.Range | vscode.Selection,
): { range: vscode.Range; text: string } | undefined {
  if (range.isEmpty) {
    const line = document.lineAt(range.start.line);
    if (!line.text.trim()) return undefined;
    return { range: line.range, text: line.text };
  }
  return { range, text: document.getText(range) };
}

export interface EditorContext {
  filePath: string;
  /** Workspace-relative path (forward slashes) when available. */
  relativePath: string | null;
  languageId: string;
  selectedText: string;
  startLine: number;
  endLine: number;
}

export function getEditorContext(): EditorContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  const sel = editor.selection;
  const effective = getEffectiveRange(editor.document, sel);
  if (!effective) return undefined;
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const rel =
    root && editor.document.uri.scheme === "file"
      ? relative(root, editor.document.uri.fsPath)
      : null;
  const relativePath =
    rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.split(sep).join("/") : null;
  return {
    filePath: editor.document.uri.fsPath,
    relativePath,
    languageId: editor.document.languageId,
    selectedText: effective.text,
    startLine: effective.range.start.line + 1,
    endLine: effective.range.end.line + 1,
  };
}
