/**
 * `@see` Definition provider — Cmd-click on a spec path opens the file at line 0;
 * Cmd-click on `[FR-X]` / `[DES-XXX]` / `[X.Y]` jumps to the matched line.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import * as vscode from "vscode";

import { getSeeContextAt, resolveNode } from "./see-resolver";

export function createSpecDefinitionProvider(
  getRoot: () => string | undefined,
): vscode.DefinitionProvider {
  return {
    provideDefinition(document, position): vscode.Location | undefined {
      const root = getRoot();
      if (!root) return undefined;
      const ctx = getSeeContextAt(document, position, root);
      if (!ctx?.exists) return undefined;

      const uri = vscode.Uri.file(ctx.absPath);
      if (ctx.kind === "path") {
        return new vscode.Location(uri, new vscode.Position(0, 0));
      }
      const node = resolveNode(ctx.absPath, ctx.nodeId ?? "");
      if (!node) return new vscode.Location(uri, new vscode.Position(0, 0));
      return new vscode.Location(uri, new vscode.Position(node.line, 0));
    },
  };
}
