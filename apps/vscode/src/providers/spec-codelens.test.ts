/**
 * @see docs/specs/203-app-vscode-see-navigation/spec.md [FR-1] [FR-2]
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-8] [FR-11]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TRACE] [DES-TEST]
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as vscode from "vscode";

import type { ResolvedBlueprintReference } from "../services/blueprint-traces";
import { createSpecCodeLensProvider } from "./spec-codelens";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

function document(uri: vscode.Uri, text: string): vscode.TextDocument {
  return {
    uri,
    getText: () => text,
    positionAt: () => new vscode.Position(0, 0),
  } as unknown as vscode.TextDocument;
}

describe("spec CodeLens", () => {
  it("uses the source document owner for inline links", async () => {
    const first = await mkdtemp(path.join(tmpdir(), "afx-lens-one-"));
    const second = await mkdtemp(path.join(tmpdir(), "afx-lens-two-"));
    roots.push(first, second);
    await mkdir(path.join(second, "docs/specs/auth"), { recursive: true });
    await writeFile(path.join(second, "docs/specs/auth/spec.md"), "# Auth\n");
    const source = document(
      vscode.Uri.file(path.join(second, "src/index.ts")),
      "/** @see docs/specs/auth/spec.md [FR-1] */",
    );
    const provider = createSpecCodeLensProvider((value) =>
      value.uri.fsPath.startsWith(second) ? second : first,
    );
    const lenses = await provider.provideCodeLenses(source, {} as vscode.CancellationToken);
    expect(lenses).toHaveLength(1);
    expect((lenses?.[0]?.command?.arguments?.[0] as vscode.Uri).fsPath).toBe(
      path.join(second, "docs/specs/auth/spec.md"),
    );
  });

  it("renders external CodeLens without an inline annotation", async () => {
    const source = document(vscode.Uri.file("/code/src/index.ts"), "export function run() {}\n");
    const reference: ResolvedBlueprintReference = {
      linkId: "link",
      range: new vscode.Range(new vscode.Position(0, 16), new vscode.Position(0, 19)),
      targetPath: "/private/blueprint/docs/specs/run/spec.md",
      targetAnchor: "FR-1",
      relation: "implements",
      origin: "blueprint",
      resolution: "resolved",
    };
    const provider = createSpecCodeLensProvider(
      () => "/code",
      () => [reference],
    );
    const lenses = await provider.provideCodeLenses(source, {} as vscode.CancellationToken);
    expect(lenses).toHaveLength(1);
    expect(lenses?.[0]?.command?.title).toContain("implements: spec.md [FR-1]");
    expect(lenses?.[0]?.command?.arguments).toEqual([{ path: reference.targetPath, line: 0 }]);
  });

  it("groups the same inline and Blueprint association while preserving its origins", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-lens-hybrid-"));
    roots.push(root);
    const target = path.join(root, "docs/specs/auth/spec.md");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "## [FR-1] Authentication\n");
    const source = document(
      vscode.Uri.file(path.join(root, "src/index.ts")),
      "/** @see docs/specs/auth/spec.md [FR-1] */",
    );
    const reference: ResolvedBlueprintReference = {
      linkId: "link",
      range: new vscode.Range(new vscode.Position(3, 0), new vscode.Position(3, 3)),
      targetPath: target,
      targetAnchor: "FR-1",
      relation: "implements",
      origin: "blueprint",
      resolution: "stale",
    };
    const provider = createSpecCodeLensProvider(
      () => root,
      () => [reference],
    );
    const lenses = await provider.provideCodeLenses(source, {} as vscode.CancellationToken);
    expect(lenses).toHaveLength(1);
    expect(lenses?.[0]?.command?.title).toContain("inline + Blueprint");
    expect(lenses?.[0]?.command?.title).toContain("stale");
    expect(lenses?.[0]?.command?.arguments).toEqual([{ path: target, line: 0 }]);
  });
});
