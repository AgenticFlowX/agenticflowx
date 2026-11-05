/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-11] [FR-12] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TRACE] [DES-TEST]
 */
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as vscode from "vscode";

import { type BlueprintBinding, createBlueprint } from "./blueprint-artifacts";
import {
  addTraceLink,
  findTraceRelinkCandidate,
  relinkTraceSource,
  repositionBlueprintReferences,
  resolveBlueprintReferences,
} from "./blueprint-traces";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("Blueprint traces", () => {
  it("matches explicit repository bindings and prevents same-path cross-repo collisions", async () => {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "afx-traces-"));
    roots.push(artifactRoot);
    const manifest = await createBlueprint({
      artifactRoot,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    const repositoryId = manifest.repositories[0]!.id;
    const documentRoot = await mkdtemp(path.join(tmpdir(), "afx-documents-"));
    roots.push(documentRoot);
    await mkdir(path.join(documentRoot, "docs/specs/auth"), { recursive: true });
    await writeFile(
      path.join(documentRoot, "docs/specs/auth/spec.md"),
      "## [FR-1] Authentication\n",
    );
    const store = await addTraceLink(artifactRoot, manifest, 1, {
      repositoryId,
      sourcePath: "src/index.ts",
      languageId: "typescript",
      scope: "range",
      range: { start: { line: 2, character: 0 }, end: { line: 3, character: 1 } },
      targetPath: "docs/specs/auth/spec.md",
      documentRootId: "sdd",
      documentRoot,
      targetAnchor: { kind: "requirement", id: "FR-1" },
    });
    const binding: BlueprintBinding = {
      blueprintId: manifest.id,
      artifactRoot,
      checkouts: { [repositoryId]: "/code/one" },
      documentRoots: { sdd: documentRoot },
    };
    const document = { uri: vscode.Uri.file("/code/one/src/index.ts") } as vscode.TextDocument;
    const collision = { uri: vscode.Uri.file("/code/two/src/index.ts") } as vscode.TextDocument;
    expect(resolveBlueprintReferences(document, artifactRoot, binding, store)).toHaveLength(1);
    expect(resolveBlueprintReferences(collision, artifactRoot, binding, store)).toHaveLength(0);
  });

  it("marks changed source stale and relinks through a revision-aware atomic update", async () => {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "afx-traces-"));
    roots.push(artifactRoot);
    const manifest = await createBlueprint({
      artifactRoot,
      name: "App",
      repository: { name: "app", kind: "git" },
      researchMarkdown: "research",
      now: "2026-10-21T01:02:03.000Z",
    });
    const repositoryId = manifest.repositories[0]!.id;
    const documentRoot = await mkdtemp(path.join(tmpdir(), "afx-documents-"));
    roots.push(documentRoot);
    await mkdir(path.join(documentRoot, "docs/specs/auth"), { recursive: true });
    await writeFile(path.join(documentRoot, "docs/specs/auth/spec.md"), "## [FR-1] Auth\n");
    const store = await addTraceLink(artifactRoot, manifest, 1, {
      repositoryId,
      sourcePath: "src/old.ts",
      scope: "file",
      targetPath: "docs/specs/auth/spec.md",
      documentRootId: "sdd",
      documentRoot,
      targetAnchor: { kind: "requirement", id: "FR-1" },
      content: "old",
    });
    const binding: BlueprintBinding = {
      blueprintId: manifest.id,
      artifactRoot,
      checkouts: { [repositoryId]: "/code/app" },
      documentRoots: { sdd: documentRoot },
    };
    const changed = {
      uri: vscode.Uri.file("/code/app/src/old.ts"),
      getText: () => "changed",
    } as vscode.TextDocument;
    expect(resolveBlueprintReferences(changed, artifactRoot, binding, store)[0]?.resolution).toBe(
      "stale",
    );
    await unlink(path.join(documentRoot, "docs/specs/auth/spec.md"));
    expect(resolveBlueprintReferences(changed, artifactRoot, binding, store)[0]?.resolution).toBe(
      "unresolved",
    );
    const relinked = await relinkTraceSource(
      artifactRoot,
      manifest,
      store.revision,
      store.links[0]!.id,
      { repositoryId, path: "src/new.ts", scope: "file", content: "new" },
    );
    expect(relinked.revision).toBe(store.revision + 1);
    expect(relinked.links[0]?.source.path).toBe("src/new.ts");
    await expect(
      relinkTraceSource(artifactRoot, manifest, store.revision, store.links[0]!.id, {
        repositoryId,
        path: "src/stale.ts",
        scope: "file",
      }),
    ).rejects.toThrow(/revision conflict/);
  });

  it("resolves moved symbols only with unambiguous repository evidence", () => {
    const link = {
      id: "link",
      source: {
        repositoryId: "repo",
        path: "src/old.ts",
        scope: "symbol" as const,
        symbol: {
          name: "run",
          kind: 12,
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } },
        },
      },
      target: { path: "docs/specs/run/spec.md" },
      relation: "relates-to" as const,
      createdAt: "2026-10-21T01:02:03.000Z",
      createdBy: "human" as const,
    };
    expect(
      findTraceRelinkCandidate(link, [
        { repositoryId: "repo", path: "src/new.ts", symbolNames: ["run"] },
      ]),
    ).toEqual({ resolution: "resolved", path: "src/new.ts" });
    expect(
      findTraceRelinkCandidate(link, [
        { repositoryId: "repo", path: "src/a.ts", symbolNames: ["run"] },
        { repositoryId: "repo", path: "src/b.ts", symbolNames: ["run"] },
      ]),
    ).toEqual({ resolution: "ambiguous" });
    const store = {
      kind: "afx-blueprint-traces" as const,
      schemaVersion: 2 as const,
      blueprintId: "blueprint",
      revision: 1,
      updatedAt: link.createdAt,
      positionEncoding: "utf-16" as const,
      links: [link],
    };
    const references = [
      {
        linkId: link.id,
        range: new vscode.Range(new vscode.Position(0, 16), new vscode.Position(0, 19)),
        targetPath: "/private/spec.md",
        relation: link.relation,
        origin: "blueprint" as const,
        resolution: "stale" as const,
      },
    ];
    const moved = {
      ...link.source.symbol,
      range: { start: { line: 12, character: 0 }, end: { line: 14, character: 0 } },
      selectionRange: { start: { line: 12, character: 16 }, end: { line: 12, character: 19 } },
    };
    const positioned = repositionBlueprintReferences(references, store, [moved]);
    expect(positioned[0]?.range.start.line).toBe(12);
    expect(positioned[0]?.resolution).toBe("stale");
    expect(repositionBlueprintReferences(references, store, [moved, moved])[0]?.resolution).toBe(
      "ambiguous",
    );
    expect(repositionBlueprintReferences(references, store, [])[0]?.resolution).toBe("unresolved");
    expect(link.source.symbol.selectionRange.start.line).toBe(0);
  });
});
