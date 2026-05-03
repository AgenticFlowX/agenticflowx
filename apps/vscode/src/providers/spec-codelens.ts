/**
 * @see CodeLens provider — surfaces "Open spec" / "Open design" lenses on @see lines.
 *
 * @see docs/specs/203-app-vscode-see-navigation/spec.md [FR-1] [FR-2]
 * @see docs/specs/203-app-vscode-see-navigation/design.md [DES-API]
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import * as vscode from "vscode";

const SEE_RE = /@see\s+(docs\/specs\/[^\s]+\.md)(?:\s+(\[[A-Z0-9-]+\](?:\s*\[[A-Z0-9-]+\])*))?/g;

export function createSpecCodeLensProvider(
  getRoot: () => string | undefined,
): vscode.CodeLensProvider {
  // Flow: [SeeNavigation.CodeLens]
  return {
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | undefined {
      const root = getRoot();
      if (!root) return undefined;
      const text = document.getText();
      const lenses: vscode.CodeLens[] = [];
      const re = new RegExp(SEE_RE.source, SEE_RE.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const relPath = match[1];
        if (!relPath) continue;
        const abs = join(root, relPath);
        if (!existsSync(abs)) continue;
        const startPos = document.positionAt(match.index);
        const range = new vscode.Range(startPos, startPos);
        const label = relPath.split("/").pop() ?? relPath;
        const anchors = match[2] ?? "";
        lenses.push(
          new vscode.CodeLens(range, {
            title: `📜 Open ${label}${anchors ? ` ${anchors}` : ""}`,
            command: "vscode.open",
            arguments: [vscode.Uri.file(abs)],
          }),
        );
      }
      return lenses;
    },
  };
}
