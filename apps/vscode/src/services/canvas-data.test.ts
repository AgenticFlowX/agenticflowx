/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-3] [FR-12] [FR-19]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createCanvasDataProvider } from "./canvas-data";

describe("createCanvasDataProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only canvasEnabled:false without reading or watching when disabled", async () => {
    const readFile = vi.spyOn(vscode.workspace.fs, "readFile");
    const createWatcher = vi.spyOn(vscode.workspace, "createFileSystemWatcher");
    const provider = createCanvasDataProvider({
      getWorkspaceRoot: () => vscode.Uri.file("/repo"),
      isEnabled: () => false,
    });

    await expect(provider.getCanvasUpdateFields()).resolves.toEqual({ canvasEnabled: false });
    provider.onDidChange(() => {});

    expect(readFile).not.toHaveBeenCalled();
    expect(createWatcher).not.toHaveBeenCalled();
  });

  it("reads project.canvas when enabled and reports missing files as exists:false", async () => {
    vi.spyOn(vscode.workspace.fs, "readFile").mockRejectedValueOnce(new Error("missing"));
    const provider = createCanvasDataProvider({
      getWorkspaceRoot: () => vscode.Uri.file("/repo"),
      isEnabled: () => true,
    });

    await expect(provider.getCanvasUpdateFields()).resolves.toEqual({
      canvasEnabled: true,
      canvas: { path: ".afx/project.canvas", content: "", exists: false },
    });
  });

  it("publishes raw canvas content when the file exists", async () => {
    vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValueOnce(
      Buffer.from('{"nodes":[],"edges":[]}'),
    );
    const provider = createCanvasDataProvider({
      getWorkspaceRoot: () => vscode.Uri.file("/repo"),
      isEnabled: () => true,
    });

    await expect(provider.getCanvasPayload()).resolves.toEqual({
      path: ".afx/project.canvas",
      content: '{"nodes":[],"edges":[]}',
      exists: true,
    });
  });

  it("registers one enabled watcher and disposes listener handles safely", () => {
    const listenerDispose = vi.fn();
    const watcherDispose = vi.fn();
    vi.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue({
      onDidChange: vi.fn(() => ({ dispose: listenerDispose })),
      onDidCreate: vi.fn(() => ({ dispose: listenerDispose })),
      onDidDelete: vi.fn(() => ({ dispose: listenerDispose })),
      dispose: watcherDispose,
    } as unknown as vscode.FileSystemWatcher);
    const provider = createCanvasDataProvider({
      getWorkspaceRoot: () => vscode.Uri.file("/repo"),
      isEnabled: () => true,
    });

    const disposable = provider.onDidChange(() => {});
    disposable.dispose();
    disposable.dispose();
    provider.dispose();

    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(".afx/project.canvas");
    expect(listenerDispose).toHaveBeenCalledTimes(3);
    expect(watcherDispose).toHaveBeenCalledOnce();
  });

  it("suppresses one watcher echo after an AFX canvas save", async () => {
    let onChange: (() => void) | undefined;
    vi.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue({
      onDidChange: vi.fn((cb: () => void) => {
        onChange = cb;
        return { dispose: vi.fn() };
      }),
      onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    } as unknown as vscode.FileSystemWatcher);
    const readFile = vi
      .spyOn(vscode.workspace.fs, "readFile")
      .mockResolvedValueOnce(Buffer.from('{"nodes":[]}'))
      .mockResolvedValueOnce(Buffer.from('{"nodes":[{"id":"external"}]}'));
    const provider = createCanvasDataProvider({
      getWorkspaceRoot: () => vscode.Uri.file("/repo"),
      isEnabled: () => true,
    });
    const cb = vi.fn();
    provider.onDidChange(cb);

    provider.markSavedContent('{"nodes":[]}');
    onChange?.();

    await vi.waitFor(() => {
      expect(readFile).toHaveBeenCalledOnce();
    });
    expect(cb).not.toHaveBeenCalled();

    provider.markSavedContent('{"nodes":[]}');
    onChange?.();

    await vi.waitFor(() => {
      expect(cb).toHaveBeenCalledOnce();
    });
  });
});
