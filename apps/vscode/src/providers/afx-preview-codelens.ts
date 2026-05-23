/**
 * CodeLens provider — surfaces a single top-of-file "Open AFX Preview" lens on
 * markdown documents, invoking the `afx.openAfxPreview` command for that file.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-CODELENS]
 */
import * as vscode from "vscode";

export function createAfxPreviewCodeLensProvider(): vscode.CodeLensProvider {
  return {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | undefined {
      if (document.languageId !== "markdown") return undefined;
      return [
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: "$(open-preview) Open AFX Preview",
          command: "afx.openAfxPreview",
          arguments: [document.uri],
        }),
      ];
    },
  };
}
