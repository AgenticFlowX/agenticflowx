/**
 * `@see` completion provider — autocompletes path segments after typing
 * `@see docs/...` and node ids (FR-X, NFR-X, DES-XXX, X.Y) after typing
 * `@see <path>.md [`.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import * as vscode from "vscode";

import { type NodeIdEntry, listNodeIds } from "./see-resolver";

const PATH_PREFIX_RE = /@see\s+(docs(?:\/[A-Za-z0-9_./+-]*)?)$/;
const BRACKET_PREFIX_RE =
  /@see\s+(docs\/[A-Za-z0-9_./+-]+\.md)(?:\s+\[(?:[A-Z0-9.-]+)\])*\s+\[([A-Z0-9.-]*)$/;

const NODE_KIND_LABEL: Record<NodeIdEntry["kind"], string> = {
  fr: "Functional req.",
  nfr: "Non-functional req.",
  des: "Design section",
  task: "Task",
};

const NODE_KIND_ICON: Record<NodeIdEntry["kind"], vscode.CompletionItemKind> = {
  fr: vscode.CompletionItemKind.Constant,
  nfr: vscode.CompletionItemKind.Constant,
  des: vscode.CompletionItemKind.Class,
  task: vscode.CompletionItemKind.Event,
};

export function createSeeCompletionProvider(
  getRoot: () => string | undefined,
): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(document, position): vscode.CompletionItem[] | undefined {
      const root = getRoot();
      if (!root) return undefined;

      const linePrefix = document.lineAt(position).text.slice(0, position.character);

      const bracketMatch = BRACKET_PREFIX_RE.exec(linePrefix);
      if (bracketMatch) {
        const relPath = bracketMatch[1];
        if (!relPath) return undefined;
        const abs = join(root, relPath);
        const nodes = listNodeIds(abs);
        return nodes.map((node) => buildNodeItem(node));
      }

      const pathMatch = PATH_PREFIX_RE.exec(linePrefix);
      if (pathMatch) {
        const partial = pathMatch[1] ?? "docs";
        return buildPathItems(root, partial);
      }

      return undefined;
    },
  };
}

function buildPathItems(root: string, partial: string): vscode.CompletionItem[] {
  const lastSlash = partial.lastIndexOf("/");
  const dirPath = lastSlash === -1 ? partial : partial.slice(0, lastSlash);
  const filterPrefix = lastSlash === -1 ? "" : partial.slice(lastSlash + 1);
  const absDir = join(root, dirPath);
  if (!existsSync(absDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(absDir);
  } catch {
    return [];
  }

  const items: vscode.CompletionItem[] = [];
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (filterPrefix && !entry.toLowerCase().startsWith(filterPrefix.toLowerCase())) continue;
    const full = join(absDir, entry);
    let isDir: boolean;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (!isDir && !entry.endsWith(".md")) continue;
    const item = new vscode.CompletionItem(
      isDir ? `${entry}/` : entry,
      isDir ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File,
    );
    item.insertText = isDir ? `${entry}/` : entry;
    item.sortText = isDir ? `0_${entry}` : `1_${entry}`;
    items.push(item);
  }
  return items;
}

function buildNodeItem(node: NodeIdEntry): vscode.CompletionItem {
  const item = new vscode.CompletionItem(node.id, NODE_KIND_ICON[node.kind]);
  item.insertText = node.id;
  item.detail = NODE_KIND_LABEL[node.kind];
  if (node.detail) item.documentation = node.detail;
  item.sortText = sortKey(node);
  return item;
}

function sortKey(node: NodeIdEntry): string {
  // Sort FR before NFR before DES before tasks; numeric ids sort numerically.
  const kindOrder: Record<NodeIdEntry["kind"], string> = {
    fr: "0",
    nfr: "1",
    des: "2",
    task: "3",
  };
  const numMatch = /\d+(?:\.\d+)?/.exec(node.id);
  const padded = numMatch ? numMatch[0].padStart(8, "0") : node.id;
  return `${kindOrder[node.kind]}_${padded}`;
}
