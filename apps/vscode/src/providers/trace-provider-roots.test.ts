/**
 * @see docs/specs/203-app-vscode-see-navigation/spec.md [FR-1] [FR-2]
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-8]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST]
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as vscode from "vscode";

import { createSeeCompletionProvider } from "./see-completion";
import { createSeeDocumentLinkProvider } from "./see-document-links";
import { createSpecDefinitionProvider } from "./spec-definition";
import { createSpecHoverProvider } from "./spec-hover";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

function document(uri: vscode.Uri, text: string): vscode.TextDocument {
  const lines = text.split("\n");
  return {
    uri,
    getText: () => text,
    lineAt: (line: number | vscode.Position) => ({
      text: lines[typeof line === "number" ? line : line.line] ?? "",
    }),
    offsetAt: (position: vscode.Position) =>
      lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) +
      position.character,
    positionAt: (offset: number) => {
      const before = text.slice(0, offset).split("\n");
      return new vscode.Position(before.length - 1, before.at(-1)?.length ?? 0);
    },
  } as unknown as vscode.TextDocument;
}

describe("document-owned trace provider roots", () => {
  it("uses the nested source owner for hover, definition, links and completion", async () => {
    const first = await mkdtemp(path.join(tmpdir(), "afx-providers-one-"));
    const second = await mkdtemp(path.join(tmpdir(), "afx-providers-two-"));
    roots.push(first, second);
    const target = path.join(second, "docs/specs/auth/spec.md");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "| FR-1 | Authentication |\n");
    const sourceText = "/** @see docs/specs/auth/spec.md [FR-1] */";
    const source = document(vscode.Uri.file(path.join(second, "src/index.ts")), sourceText);
    const getRoot = (value: vscode.TextDocument) =>
      value.uri.fsPath.startsWith(second) ? second : first;
    const pathPosition = new vscode.Position(0, sourceText.indexOf("docs/specs") + 2);

    expect(
      createSpecHoverProvider(getRoot).provideHover(source, pathPosition, {} as never),
    ).toBeDefined();
    const definition = createSpecDefinitionProvider(getRoot).provideDefinition(
      source,
      pathPosition,
      {} as never,
    ) as vscode.Location;
    expect(definition.uri.fsPath).toBe(target);
    const links = (await createSeeDocumentLinkProvider(getRoot).provideDocumentLinks(
      source,
      {} as never,
    )) as vscode.DocumentLink[] | undefined;
    expect((links?.[0]?.target as vscode.Uri).fsPath).toBe(target);

    const completionText = "@see docs/specs/auth/";
    const completionDocument = document(source.uri, completionText);
    const completions = (await createSeeCompletionProvider(getRoot).provideCompletionItems(
      completionDocument,
      new vscode.Position(0, completionText.length),
      {} as never,
      {} as never,
    )) as vscode.CompletionItem[] | undefined;
    expect(completions?.map((item) => item.label)).toContain("spec.md");
  });
});
