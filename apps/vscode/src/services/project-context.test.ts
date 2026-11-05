/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-1] [FR-2] [NFR-4]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST]
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import * as vscode from "vscode";

import { discoverProjects, resolveProject } from "./project-context";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "afx-project-context-"));
  roots.push(root);
  await mkdir(path.join(root, ".git"));
  await mkdir(path.join(root, "packages", "parent-package", "src"), { recursive: true });
  await writeFile(path.join(root, "packages", "parent-package", "package.json"), "{}\n");
  await mkdir(path.join(root, "apps", "child-a", ".git"), { recursive: true });
  await mkdir(path.join(root, "apps", "child-a", "src"));
  await mkdir(path.join(root, "apps", "child-b", "src"), { recursive: true });
  await writeFile(
    path.join(root, "apps", "child-b", ".git"),
    "gitdir: /tmp/git/worktrees/child-b\n",
  );
  return root;
}

describe("project context", () => {
  it("discovers directory and file Git markers and resolves the deepest owner", async () => {
    const root = await fixture();
    const result = await discoverProjects([
      { uri: vscode.Uri.file(root), name: "umbrella", index: 0 },
    ]);

    expect(result.projects.map((project) => [project.name, project.gitMarker])).toEqual(
      expect.arrayContaining([
        [path.basename(root), "directory"],
        ["child-a", "directory"],
        ["child-b", "file"],
      ]),
    );
    const child = resolveProject(
      vscode.Uri.file(path.join(root, "apps", "child-a", "src", "index.ts")),
      result.projects,
    );
    const parentPackage = resolveProject(
      vscode.Uri.file(path.join(root, "packages", "parent-package", "src", "index.ts")),
      result.projects,
    );
    expect(child?.name).toBe("child-a");
    expect(parentPackage?.rootUri.fsPath).toBe(root);
  });

  it("reports limits instead of fabricating complete discovery", async () => {
    const root = await fixture();
    const result = await discoverProjects(
      [{ uri: vscode.Uri.file(root), name: "umbrella", index: 0 }],
      { limits: { maxDepth: 1, maxProjects: 2, maxCandidates: 2 } },
    );
    expect(result.complete).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("keeps duplicate relative paths scoped to their repository", async () => {
    const root = await fixture();
    const result = await discoverProjects([{ uri: vscode.Uri.file(root), name: "root", index: 0 }]);
    const left = resolveProject(
      vscode.Uri.file(path.join(root, "apps/child-a/src/index.ts")),
      result.projects,
    );
    const right = resolveProject(
      vscode.Uri.file(path.join(root, "apps/child-b/src/index.ts")),
      result.projects,
    );
    expect(left?.id).not.toBe(right?.id);
  });
});
