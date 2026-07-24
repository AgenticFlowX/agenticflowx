/**
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-17] [FR-20]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LIVE-DOCUMENTS]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-12] [FR-20] [FR-30] [FR-31]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createWorkbenchFileState } from "./workbench-file-state";

function workspaceFolder(root = "/workspace"): vscode.WorkspaceFolder {
  return { uri: vscode.Uri.file(root), name: "workspace", index: 0 };
}

describe("createWorkbenchFileState", () => {
  afterEach(() => {
    (
      vscode.workspace as unknown as {
        textDocuments: vscode.TextDocument[];
      }
    ).textDocuments = [];
    vi.restoreAllMocks();
  });

  it("prefers a dirty open document over persisted bytes", async () => {
    const uri = vscode.Uri.file("/workspace/.afx/notes.md");
    const readFile = vi
      .spyOn(vscode.workspace.fs, "readFile")
      .mockResolvedValue(Buffer.from("persisted"));
    (
      vscode.workspace as unknown as {
        textDocuments: vscode.TextDocument[];
      }
    ).textDocuments = [
      {
        uri,
        isDirty: true,
        getText: () => "unsaved",
      } as vscode.TextDocument,
    ];
    const state = createWorkbenchFileState({ getWorkspaceFolders: () => [workspaceFolder()] });

    await expect(state.readText(uri)).resolves.toMatchObject({
      content: "unsaved",
      dirty: true,
      kind: "notes",
      sourceRevision: {
        dirty: true,
        diskRevision: expect.any(String),
      },
    });
    // Open-buffer content remains authoritative, while one disk read records
    // the clean base revision needed for save/revert conflict reporting.
    expect(readFile).toHaveBeenCalledOnce();
  });

  it("falls back to disk after an unsaved buffer is closed or discarded", async () => {
    const uri = vscode.Uri.file("/workspace/.afx/notes.md");
    vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(Buffer.from("persisted"));
    const mockWorkspace = vscode.workspace as unknown as {
      textDocuments: vscode.TextDocument[];
    };
    mockWorkspace.textDocuments = [
      { uri, isDirty: true, getText: () => "unsaved" } as vscode.TextDocument,
    ];
    const state = createWorkbenchFileState({ getWorkspaceFolders: () => [workspaceFolder()] });

    await expect(state.readText(uri)).resolves.toMatchObject({ content: "unsaved", dirty: true });

    mockWorkspace.textDocuments = [];
    await expect(state.readText(uri)).resolves.toMatchObject({
      content: "persisted",
      dirty: false,
    });
  });

  it("classifies nested docs, Board, Notes, Canvas, previewable files, and rejects outside paths", () => {
    const state = createWorkbenchFileState({ getWorkspaceFolders: () => [workspaceFolder()] });

    expect(state.classify(vscode.Uri.file("/workspace/project/docs/specs/demo/spec.md"))).toBe(
      "docs",
    );
    expect(
      state.classify(vscode.Uri.file("/workspace/project/docs/specs/demo/design.markdown")),
    ).toBe("docs");
    expect(state.classify(vscode.Uri.file("/workspace/project/.afx/kanban/roadmap.md"))).toBe(
      "board",
    );
    expect(state.classify(vscode.Uri.file("/workspace/project/.afx/notes.md"))).toBe("notes");
    expect(state.classify(vscode.Uri.file("/workspace/.afx/canvases/roadmap.canvas"))).toBe(
      "canvas",
    );
    expect(state.classify(vscode.Uri.file("/workspace/src/app.ts"))).toBe("file");
    expect(state.classify(vscode.Uri.file("/workspace/assets/architecture.png"))).toBe("file");
    expect(state.classify(vscode.Uri.file("/outside/docs/spec.md"))).toBeUndefined();
  });

  it("resolves a portable Canvas workspace hint without persisting a machine URI", () => {
    const folders = [
      { uri: vscode.Uri.file("/workspace/client-a"), name: "client-a", index: 0 },
      { uri: vscode.Uri.file("/workspace/client-b"), name: "client-b", index: 1 },
    ];
    const state = createWorkbenchFileState({ getWorkspaceFolders: () => folders });

    expect(
      state.resolve({
        rootUri: "afx-workspace://client-b",
        rootName: "client-b",
        relativePath: "docs/spec.md",
      }),
    ).toMatchObject({ fsPath: "/workspace/client-b/docs/spec.md" });
    expect(
      state.resolve({
        rootUri: "afx-workspace://missing",
        rootName: "missing",
        relativePath: "docs/spec.md",
      }),
    ).toBeUndefined();
  });

  it("emits relevant editor changes and disposes subscriptions when the listener leaves", () => {
    let changeDocument: ((event: vscode.TextDocumentChangeEvent) => void) | undefined;
    const eventDispose = vi.fn();
    const watcherDispose = vi.fn();
    vi.spyOn(vscode.workspace, "onDidChangeTextDocument").mockImplementation((listener) => {
      changeDocument = listener;
      return { dispose: eventDispose };
    });
    vi.spyOn(vscode.workspace, "onDidSaveTextDocument").mockReturnValue({
      dispose: eventDispose,
    });
    vi.spyOn(vscode.workspace, "onDidCloseTextDocument").mockReturnValue({
      dispose: eventDispose,
    });
    vi.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue({
      onDidChange: vi.fn(() => ({ dispose: eventDispose })),
      onDidCreate: vi.fn(() => ({ dispose: eventDispose })),
      onDidDelete: vi.fn(() => ({ dispose: eventDispose })),
      dispose: watcherDispose,
    } as unknown as vscode.FileSystemWatcher);
    const state = createWorkbenchFileState({ getWorkspaceFolders: () => [workspaceFolder()] });
    const listener = vi.fn();
    const subscription = state.onDidChange(listener);

    changeDocument?.({
      document: { uri: vscode.Uri.file("/workspace/.afx/notes.md") } as vscode.TextDocument,
      contentChanges: [],
      reason: undefined,
    });
    changeDocument?.({
      document: { uri: vscode.Uri.file("/workspace/src/app.ts") } as vscode.TextDocument,
      contentChanges: [],
      reason: undefined,
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "notes", reason: "buffer" }),
    );
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "file", reason: "buffer" }),
    );

    subscription.dispose();
    subscription.dispose();
    expect(watcherDispose).toHaveBeenCalledTimes(5);
  });
});
