import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchSourceIdentity } from "@afx/shared";

import {
  findCanvasSubpathLine,
  makePortableCanvasFileReference,
  resolveCanvasFileReference,
} from "./canvas-file-reference";

const roots: vscode.WorkspaceFolder[] = [
  { uri: vscode.Uri.file("/workspace/client-a"), name: "client-a", index: 0 },
  { uri: vscode.Uri.file("/workspace/client-b"), name: "client-b", index: 1 },
];

const owner = (root: (typeof roots)[number]): WorkbenchSourceIdentity => ({
  rootUri: `file://${root.uri.path}`,
  rootName: root.name,
  relativePath: ".afx/project.canvas",
});

describe("Canvas file-reference boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["/etc/passwd", "C:\\secrets.txt", "../outside.md", "docs/../../outside.md"])(
    "rejects absolute or workspace-escape path %s",
    async (filePath) => {
      const stat = vi.spyOn(vscode.workspace.fs, "stat");

      await expect(
        resolveCanvasFileReference(filePath, { workspaceFolders: roots, owner: owner(roots[0]!) }),
      ).resolves.toMatchObject({ ok: false, reason: "outside-workspace" });
      expect(stat).not.toHaveBeenCalled();
    },
  );

  it("uses the canonical owner root when the same relative path exists in multiple roots", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);

    await expect(
      resolveCanvasFileReference("docs/spec.md", {
        workspaceFolders: roots,
        owner: owner(roots[1]!),
      }),
    ).resolves.toMatchObject({
      ok: true,
      uri: expect.objectContaining({ fsPath: "/workspace/client-b/docs/spec.md" }),
    });
  });

  it("resolves a portable logical owner root without a machine path", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);

    await expect(
      resolveCanvasFileReference("docs/spec.md", {
        workspaceFolders: roots,
        owner: {
          rootUri: "afx-workspace://client-b",
          rootName: "client-b",
          relativePath: "docs/spec.md",
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      uri: expect.objectContaining({ fsPath: "/workspace/client-b/docs/spec.md" }),
    });
  });

  it("resolves a named-root path to that root instead of the first root", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri) => {
      if (uri.fsPath === "/workspace/client-b/docs/spec.md") return {} as vscode.FileStat;
      throw new Error("missing");
    });

    await expect(
      resolveCanvasFileReference("client-b/docs/spec.md", { workspaceFolders: roots }),
    ).resolves.toMatchObject({
      ok: true,
      uri: expect.objectContaining({ fsPath: "/workspace/client-b/docs/spec.md" }),
    });
  });

  it.each(["Open", "Preview", "fetch"])(
    "resolves a cross-root spec node by afxSource for %s",
    async () => {
      // A spec node loaded from another workspace root carries a portable
      // afxSource so its cross-root path resolves unambiguously.
      const node = {
        id: "n-sprint",
        type: "file" as const,
        file: "client-b/docs/specs/900-fleet/12-history/12-history.md",
        x: 0,
        y: 0,
        width: 300,
        height: 190,
        afxSource: {
          rootUri: "afx-workspace://client-b",
          rootName: "client-b",
          relativePath: "docs/specs/900-fleet/12-history/12-history.md",
        },
      };
      vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri) => {
        if (uri.fsPath === "/workspace/client-b/docs/specs/900-fleet/12-history/12-history.md") {
          return {} as vscode.FileStat;
        }
        throw new Error("missing");
      });

      expect(node.file).toBe("client-b/docs/specs/900-fleet/12-history/12-history.md");
      await expect(
        resolveCanvasFileReference(node.file, {
          workspaceFolders: roots,
          owner: node.afxSource,
        }),
      ).resolves.toMatchObject({
        ok: true,
        uri: expect.objectContaining({
          fsPath: "/workspace/client-b/docs/specs/900-fleet/12-history/12-history.md",
        }),
      });
    },
  );

  it("fails visibly resolvable ownerless paths that are duplicated across roots", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);

    await expect(
      resolveCanvasFileReference("docs/spec.md", { workspaceFolders: roots }),
    ).resolves.toEqual({
      ok: false,
      reason: "ambiguous",
      message: expect.stringContaining("more than one workspace root"),
    });
  });

  it("maps standard heading and block subpaths to source lines", () => {
    const markdown = "# Plan\n\n## Requirements and risks\nText ^evidence-1\n";

    expect(findCanvasSubpathLine(markdown, "#Requirements and risks")).toBe(2);
    expect(findCanvasSubpathLine(markdown, "#^evidence-1")).toBe(3);
    expect(findCanvasSubpathLine(markdown, "#Missing")).toBeUndefined();
  });

  it("creates portable paths only for files in the Canvas owner root", () => {
    expect(
      makePortableCanvasFileReference(
        vscode.Uri.file("/workspace/client-b/docs/spec.md"),
        owner(roots[1]!),
        roots,
      ),
    ).toBe("docs/spec.md");
    expect(
      makePortableCanvasFileReference(
        vscode.Uri.file("/workspace/client-a/docs/spec.md"),
        owner(roots[1]!),
        roots,
      ),
    ).toBeUndefined();
  });
});
