/**
 * `@see` DocumentLinkProvider — turns spec paths and `[FR-X]` / `[DES-XXX]` / `[X.Y]`
 * brackets into clickable links. Path links use a plain file URI; bracket links use
 * the `afx.openSpecAtLine` command so they jump to the matching line in the file.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import * as vscode from "vscode";

import { resolveNode } from "./see-resolver";

const SEE_LINE_RE =
  /@see\s+(docs\/[A-Za-z0-9_/.+-]+\.md)((?:\s+\[(?:[A-Z]+(?:-[A-Z0-9-]+)?|\d+\.\d+)\])*)/g;
const NODE_ID_RE = /\[([A-Z]+(?:-[A-Z0-9-]+)?|\d+\.\d+)\]/g;

export const OPEN_SPEC_AT_LINE_COMMAND = "afx.openSpecAtLine";

export function createSeeDocumentLinkProvider(
  getRoot: () => string | undefined,
): vscode.DocumentLinkProvider {
  return {
    provideDocumentLinks(document): vscode.DocumentLink[] | undefined {
      const root = getRoot();
      if (!root) return undefined;
      const links: vscode.DocumentLink[] = [];
      const text = document.getText();
      const re = new RegExp(SEE_LINE_RE.source, SEE_LINE_RE.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        const relPath = match[1];
        if (!relPath) continue;
        const abs = join(root, relPath);
        if (!existsSync(abs)) continue;

        // Path link
        const pathStart = match.index + match[0].indexOf(relPath);
        const pathEnd = pathStart + relPath.length;
        const pathLink = new vscode.DocumentLink(
          new vscode.Range(document.positionAt(pathStart), document.positionAt(pathEnd)),
          vscode.Uri.file(abs),
        );
        pathLink.tooltip = `Open ${relPath}`;
        links.push(pathLink);

        // Bracket links
        const brackets = match[2] ?? "";
        if (!brackets) continue;
        const bracketBase = match.index + match[0].indexOf(brackets);
        const bre = new RegExp(NODE_ID_RE.source, NODE_ID_RE.flags);
        let bm: RegExpExecArray | null;
        while ((bm = bre.exec(brackets)) !== null) {
          const nodeId = bm[1];
          if (!nodeId) continue;
          const node = resolveNode(abs, nodeId);
          const line = node?.line ?? 0;
          const tokenStart = bracketBase + bm.index;
          const tokenEnd = tokenStart + bm[0].length;
          const args = encodeURIComponent(JSON.stringify({ path: abs, line }));
          const target = vscode.Uri.parse(`command:${OPEN_SPEC_AT_LINE_COMMAND}?${args}`);
          const bracketLink = new vscode.DocumentLink(
            new vscode.Range(document.positionAt(tokenStart), document.positionAt(tokenEnd)),
            target,
          );
          bracketLink.tooltip = node
            ? `Open ${relPath} at line ${line + 1} (${nodeId})`
            : `Open ${relPath} (${nodeId} not found)`;
          links.push(bracketLink);
        }
      }
      return links;
    },
  };
}
