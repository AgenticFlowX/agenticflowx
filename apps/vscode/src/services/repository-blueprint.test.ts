/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-3] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST]
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { ProjectContext } from "./project-context";
import { inspectDocumentSymbols, inspectProjectMetadata } from "./repository-blueprint";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("repository inspection", () => {
  it("observes script names and entry points without changing or executing the manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-inspect-"));
    roots.push(root);
    const manifest = '{"scripts":{"danger":"touch should-not-exist"},"main":"src/index.js"}\n';
    await writeFile(path.join(root, "package.json"), manifest);
    const project = {
      id: "project",
      rootUri: vscode.Uri.file(root),
      workspaceUri: vscode.Uri.file(root),
      name: "project",
      kind: "folder",
      gitMarker: "unavailable",
      checkoutIdentity: "project",
      packagePaths: ["package.json"],
      discovery: { complete: true },
    } satisfies ProjectContext;
    const observed = await inspectProjectMetadata(project);
    expect(observed.metadata[0]?.scripts).toEqual(["danger"]);
    expect(observed.metadata[0]?.entryPoints).toEqual(["main: src/index.js"]);
    expect(await readFile(path.join(root, "package.json"), "utf8")).toBe(manifest);
    await expect(readFile(path.join(root, "should-not-exist"))).rejects.toThrow();
  });

  it("marks superseded provider results stale", async () => {
    vi.spyOn(vscode.commands, "executeCommand").mockResolvedValueOnce([]);
    const document = {
      uri: vscode.Uri.file("/repo/src/index.ts"),
      version: 3,
      isDirty: true,
      getText: () => "export const value = 1;",
    } as vscode.TextDocument;
    const result = await inspectDocumentSymbols(document, 1, () => 2);
    expect(result.state).toBe("stale");
    expect(result.dirty).toBe(true);
  });

  it("reports an expected malformed manifest as incomplete", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "afx-inspect-"));
    roots.push(root);
    await writeFile(path.join(root, "package.json"), "not json\n");
    const observed = await inspectProjectMetadata({
      id: "project",
      rootUri: vscode.Uri.file(root),
      workspaceUri: vscode.Uri.file(root),
      name: "project",
      kind: "folder",
      gitMarker: "unavailable",
      checkoutIdentity: "project",
      packagePaths: ["package.json"],
      discovery: { complete: true },
    });
    expect(observed.complete).toBe(false);
    expect(observed.errors).toContain("Could not read supported metadata: package.json");
  });
});
