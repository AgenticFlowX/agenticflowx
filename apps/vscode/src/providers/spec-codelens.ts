/**
 * @see CodeLens provider — surfaces "Open spec" / "Open design" lenses on @see lines.
 *
 * @see docs/specs/203-app-vscode-see-navigation/spec.md [FR-1] [FR-2]
 * @see docs/specs/203-app-vscode-see-navigation/design.md [DES-API]
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import * as vscode from "vscode";

import type { ResolvedBlueprintReference } from "../services/blueprint-traces";
import { OPEN_SPEC_AT_LINE_COMMAND } from "./see-document-links";
import { resolveNode } from "./see-resolver";

const SEE_RE = /@see\s+(docs\/specs\/[^\s]+\.md)(?:\s+(\[[A-Z0-9-]+\](?:\s*\[[A-Z0-9-]+\])*))?/g;

export function createSpecCodeLensProvider(
  getRoot: (document: vscode.TextDocument) => string | undefined,
  getExternalReferences: (
    document: vscode.TextDocument,
  ) =>
    | readonly ResolvedBlueprintReference[]
    | Promise<readonly ResolvedBlueprintReference[]> = () => [],
  onDidChangeCodeLenses?: vscode.Event<void>,
): vscode.CodeLensProvider {
  // Flow: [SeeNavigation.CodeLens]
  return {
    onDidChangeCodeLenses,
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[] | undefined> {
      const root = getRoot(document);
      if (!root) return undefined;
      const text = document.getText();
      const lenses: vscode.CodeLens[] = [];
      const inlineAssociations = new Map<string, number>();
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
        const anchorIds = [...anchors.matchAll(/\[([^\]]+)\]/g)].map((entry) => entry[1]);
        if (anchorIds.length === 1)
          inlineAssociations.set(`${abs}\u0000${anchorIds[0]}`, lenses.length);
        lenses.push(
          new vscode.CodeLens(range, {
            title: `📜 Open ${label}${anchors ? ` ${anchors}` : ""}`,
            command: "vscode.open",
            arguments: [vscode.Uri.file(abs)],
          }),
        );
      }
      for (const reference of await getExternalReferences(document)) {
        const label = reference.targetPath.split(/[\\/]/).pop() ?? reference.targetPath;
        const node = reference.targetAnchor
          ? resolveNode(reference.targetPath, reference.targetAnchor)
          : undefined;
        const status = reference.resolution === "resolved" ? "" : ` · ${reference.resolution}`;
        const associationKey = reference.targetAnchor
          ? `${reference.targetPath}\u0000${reference.targetAnchor}`
          : undefined;
        const inlineIndex = associationKey ? inlineAssociations.get(associationKey) : undefined;
        const lens = new vscode.CodeLens(reference.range, {
          title: `$(references) ${reference.relation}: ${label}${reference.targetAnchor ? ` [${reference.targetAnchor}]` : ""}${inlineIndex === undefined ? "" : " · inline + Blueprint"}${status}`,
          command: OPEN_SPEC_AT_LINE_COMMAND,
          arguments: [{ path: reference.targetPath, line: node?.line ?? 0 }],
        });
        if (inlineIndex === undefined) lenses.push(lens);
        else lenses[inlineIndex] = lens;
      }
      return lenses;
    },
  };
}
