/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-30] [FR-35] [FR-36] [FR-44]
 */
import { describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createCanvasReferencePicker } from "./canvas-reference-picker";

describe("CanvasReferencePicker", () => {
  const rootOne = "file:///one";
  const rootTwo = "file:///two";
  const identify = (uri: vscode.Uri) => {
    if (uri.path.startsWith("/one/")) {
      return {
        rootUri: rootOne,
        rootName: "one",
        relativePath: uri.path.slice("/one/".length),
      };
    }
    if (uri.path.startsWith("/two/")) {
      return {
        rootUri: rootTwo,
        rootName: "two",
        relativePath: uri.path.slice("/two/".length),
      };
    }
    return undefined;
  };

  it("returns sorted, deduplicated references from multiple workspace roots", async () => {
    const showOpenDialog = vi
      .fn()
      .mockResolvedValue([
        vscode.Uri.file("/two/docs/diagram.png"),
        vscode.Uri.file("/one/README.md"),
        vscode.Uri.file("/two/docs/diagram.png"),
        vscode.Uri.file("/outside/secret.txt"),
      ]);
    const picker = createCanvasReferencePicker({
      fileState: { identify, resolve: vi.fn() },
      showOpenDialog,
    });

    await expect(picker.pick({ kind: "any" })).resolves.toEqual([
      {
        filePath: "one/README.md",
        source: {
          rootUri: "afx-workspace://one",
          rootName: "one",
          relativePath: "README.md",
        },
      },
      {
        filePath: "two/docs/diagram.png",
        source: {
          rootUri: "afx-workspace://two",
          rootName: "two",
          relativePath: "docs/diagram.png",
        },
      },
    ]);
    expect(showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ canSelectMany: true }));
  });

  it("raises an explicit error when every selected file is outside the workspace", async () => {
    // A silent empty result reads as a dead button in the webview — the exact
    // "image attach shows no signs of life" failure when picking from Desktop.
    const showOpenDialog = vi.fn().mockResolvedValue([vscode.Uri.file("/outside/screenshot.png")]);
    const picker = createCanvasReferencePicker({
      fileState: { identify, resolve: vi.fn() },
      showOpenDialog,
    });

    await expect(picker.pick({ kind: "image" })).rejects.toThrow(/outside this workspace/);
  });

  it("uses bounded filters for Markdown, images, and existing Canvas files", async () => {
    const showOpenDialog = vi.fn().mockResolvedValue(undefined);
    const picker = createCanvasReferencePicker({
      fileState: { identify, resolve: vi.fn() },
      showOpenDialog,
    });

    await picker.pick({ kind: "markdown", allowMultiple: false });
    await picker.pick({ kind: "image" });
    await picker.pick({ kind: "canvas" });

    expect(showOpenDialog.mock.calls[0]?.[0]).toMatchObject({
      canSelectMany: false,
      filters: { "Markdown and specs": ["md", "markdown"] },
    });
    expect(showOpenDialog.mock.calls[1]?.[0]).toMatchObject({
      filters: { Images: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"] },
    });
    expect(showOpenDialog.mock.calls[2]?.[0]).toMatchObject({
      filters: { "JSON Canvas": ["canvas"] },
    });
  });

  it("opens from the owning Canvas directory when it can be resolved", async () => {
    const canvasUri = vscode.Uri.file("/two/.afx/project.canvas");
    const showOpenDialog = vi.fn().mockResolvedValue([]);
    const picker = createCanvasReferencePicker({
      fileState: { identify, resolve: vi.fn().mockReturnValue(canvasUri) },
      showOpenDialog,
    });

    await picker.pick({
      owner: {
        rootUri: rootTwo,
        rootName: "two",
        relativePath: ".afx/project.canvas",
      },
    });

    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultUri: vscode.Uri.file("/two/.afx") }),
    );
  });

  it("keeps same-root paths standard-relative and prefixes cross-root paths", async () => {
    const showOpenDialog = vi
      .fn()
      .mockResolvedValue([vscode.Uri.file("/one/docs/a.md"), vscode.Uri.file("/two/docs/b.md")]);
    const picker = createCanvasReferencePicker({
      fileState: { identify, resolve: vi.fn() },
      showOpenDialog,
    });

    const references = await picker.pick({
      owner: {
        rootUri: rootOne,
        rootName: "one",
        relativePath: ".afx/project.canvas",
      },
    });

    expect(references.map((reference) => reference.filePath)).toEqual([
      "docs/a.md",
      "two/docs/b.md",
    ]);
    expect(
      references.every((reference) => reference.source.rootUri.startsWith("afx-workspace://")),
    ).toBe(true);
  });
});
