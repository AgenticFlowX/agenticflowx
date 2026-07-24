/**
 * Workbench panel host lifecycle tests.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-2] [FR-8]
 * @see docs/specs/220-app-workbench/spec.md [FR-3]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-3] [FR-6] [FR-19] [FR-20]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createLogger, memorySink } from "@afx/shared";

import type { CanvasActionService } from "../services/canvas-action-service";
import type { CanvasContentPreviewService } from "../services/canvas-content-preview-service";
import type { CanvasEditSessionManager } from "../services/canvas-edit-session-manager";
import type { CanvasExportService } from "../services/canvas-export-service";
import type { CanvasReferencePicker } from "../services/canvas-reference-picker";
import type { SpecsDataProvider } from "../services/specs-data";
import type { WorkbenchFileState, WorkbenchSourceChange } from "../services/workbench-file-state";
import type { WorkbenchMutationCoordinator } from "../services/workbench-mutation-coordinator";
import type { NotesWorkspaceWriter } from "../utils/notes-utils";
import { createWorkbenchPanel } from "./workbench-panel";

vi.mock("./webview-html", () => ({
  getAppearanceClass: () => "vscode-light meridian",
  getAppDistPath: () => "/tmp/agenticflowx/workbench/dist",
  loadWebviewHtml: () => "<html></html>",
}));

interface MockWorkbenchView {
  view: vscode.WebviewView;
  fireDispose(): void;
  fireMessage(message: unknown): void;
  fireVisibility(visible: boolean): void;
}

interface MockWatcher {
  pattern: string;
  onDidChange: ReturnType<typeof vi.fn>;
  onDidCreate: ReturnType<typeof vi.fn>;
  onDidDelete: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function makeView(visible = true): MockWorkbenchView {
  let visibilityHandler: (() => void) | undefined;
  let disposeHandler: (() => void) | undefined;
  let messageHandler: ((message: unknown) => void) | undefined;
  const view = {
    webview: {
      options: {} as vscode.WebviewOptions,
      html: "",
      cspSource: "vscode-webview://mock",
      asWebviewUri: vi.fn((uri: vscode.Uri) => uri),
      onDidReceiveMessage: vi.fn((handler: (message: unknown) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }),
      postMessage: vi.fn(async () => true),
    },
    visible,
    onDidChangeVisibility: (handler: () => void) => {
      visibilityHandler = handler;
      return { dispose: vi.fn() };
    },
    onDidDispose: (handler: () => void) => {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    },
    show: vi.fn(),
  } as unknown as vscode.WebviewView;

  return {
    view,
    fireDispose() {
      disposeHandler?.();
    },
    fireMessage(message: unknown) {
      messageHandler?.(message);
    },
    fireVisibility(nextVisible: boolean) {
      (view as unknown as { visible: boolean }).visible = nextVisible;
      visibilityHandler?.();
    },
  };
}

function makeSpecsData(): SpecsDataProvider {
  return {
    getPanelData: vi.fn(async () => ({
      pipeline: [],
      featureTasks: [],
      documents: [],
      journal: [],
      kanban: null,
      notes: [],
      notesRaw: "",
      notesFilePath: "",
      notesSources: [],
      ghostTasks: { count: 0, items: [] },
    })),
    refresh: vi.fn(),
    dispose: vi.fn(),
  };
}

function mockFileWatchers(): MockWatcher[] {
  const watchers: MockWatcher[] = [];
  vi.spyOn(vscode.workspace, "createFileSystemWatcher").mockImplementation((pattern) => {
    const patternText = typeof pattern === "string" ? pattern : pattern.pattern;
    const eventDisposable = () => ({ dispose: vi.fn() });
    const watcher: MockWatcher = {
      pattern: patternText,
      onDidChange: vi.fn(eventDisposable),
      onDidCreate: vi.fn(eventDisposable),
      onDidDelete: vi.fn(eventDisposable),
      dispose: vi.fn(),
    };
    watchers.push(watcher);
    return watcher as unknown as vscode.FileSystemWatcher;
  });
  return watchers;
}

function mockAfxConfiguration(canvasEnabled = false): void {
  vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === "experimental.canvas") return canvasEnabled;
      if (key === "telemetry.enabled") return true;
      return defaultValue;
    }),
    has: vi.fn(() => false),
    inspect: vi.fn(() => undefined),
    update: vi.fn(async () => {}),
  });
}

describe("createWorkbenchPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts only reduced workspace-relative watchers while visible", () => {
    const watchers = mockFileWatchers();
    const { view } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    expect(watchers.map((watcher) => watcher.pattern)).toEqual([
      "**/docs/**/*.{md,markdown}",
      "**/.afx/notes.md",
      "**/.afx/kanban/**/*.md",
      "**/*.canvas",
      "**/*.{md,markdown,txt,json,jsonc,yaml,yml,toml,ini,env,ts,tsx,js,jsx,mjs,cjs,css,scss,html,htm,xml,csv,log,py,go,rs,java,kt,swift,sh,zsh,sql,graphql,png,jpg,jpeg,gif,webp,avif,bmp,svg}",
    ]);
    for (const watcher of watchers) {
      expect(watcher.onDidChange).toHaveBeenCalledOnce();
      expect(watcher.onDidCreate).toHaveBeenCalledOnce();
      expect(watcher.onDidDelete).toHaveBeenCalledOnce();
    }
  });

  it("adds the project canvas watcher only while the experiment is enabled", () => {
    mockAfxConfiguration(true);
    const watchers = mockFileWatchers();
    const { view } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    expect(watchers.map((watcher) => watcher.pattern)).toEqual([
      "**/docs/**/*.{md,markdown}",
      "**/.afx/notes.md",
      "**/.afx/kanban/**/*.md",
      "**/*.canvas",
      "**/*.{md,markdown,txt,json,jsonc,yaml,yml,toml,ini,env,ts,tsx,js,jsx,mjs,cjs,css,scss,html,htm,xml,csv,log,py,go,rs,java,kt,swift,sh,zsh,sql,graphql,png,jpg,jpeg,gif,webp,avif,bmp,svg}",
      ".afx/project.canvas",
    ]);
  });

  it("does not start file watchers while the Workbench view is hidden", () => {
    const watchers = mockFileWatchers();
    const { view } = makeView(false);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    expect(watchers).toHaveLength(0);
  });

  it("recreates watchers and refreshes data when the Workbench view becomes visible", () => {
    const watchers = mockFileWatchers();
    const specsData = makeSpecsData();
    const { view, fireVisibility } = makeView(false);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireVisibility(true);

    expect(watchers).toHaveLength(5);
    expect(specsData.refresh).toHaveBeenCalledOnce();
  });

  it("coalesces a live document change into one latest Workbench refresh", async () => {
    let sourceChange: ((change: WorkbenchSourceChange) => void) | undefined;
    const specsData = makeSpecsData();
    const fileState: WorkbenchFileState = {
      classify: () => "notes",
      identify: () => undefined,
      resolve: () => undefined,
      readText: vi.fn(async () => null),
      onDidChange(listener) {
        sourceChange = listener;
        return { dispose: vi.fn() };
      },
      dispose: vi.fn(),
    };
    const { view } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData,
      fileState,
    }).resolveWebviewView(view, {} as never, {} as never);

    sourceChange?.({
      uri: vscode.Uri.file("/repo/.afx/notes.md"),
      kind: "notes",
      reason: "buffer",
    });
    sourceChange?.({
      uri: vscode.Uri.file("/repo/.afx/notes.md"),
      kind: "notes",
      reason: "buffer",
    });
    await vi.advanceTimersByTimeAsync(150);

    expect(specsData.refresh).toHaveBeenCalledOnce();
    expect(specsData.getPanelData).toHaveBeenCalledOnce();
  });

  it("disposes active watchers on hide and dispose without double-disposing stale watchers", () => {
    const watchers = mockFileWatchers();
    const { view, fireDispose, fireVisibility } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    const firstWatchers = watchers.slice();
    fireVisibility(false);
    for (const watcher of firstWatchers) {
      expect(watcher.dispose).toHaveBeenCalledOnce();
    }

    fireVisibility(true);
    const secondWatchers = watchers.slice(5);
    fireDispose();

    for (const watcher of firstWatchers) {
      expect(watcher.dispose).toHaveBeenCalledOnce();
    }
    for (const watcher of secondWatchers) {
      expect(watcher.dispose).toHaveBeenCalledOnce();
    }
  });

  it("opens chat commands from launchpad messages even without a workspace", async () => {
    const openChatCommand = vi.fn(async () => {});
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      openChatCommand,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxOpenChatCommand", command: "/afx-spec new sample", mode: "insert" });
    await Promise.resolve();

    expect(openChatCommand).toHaveBeenCalledWith("/afx-spec new sample", "insert");
  });

  it("rejects custom-editor-only messages on the Workbench panel without side effects", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const sink = memorySink();
    const logger = createLogger({ level: "warn", sinks: [sink] });
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      logger,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxCanvasEditorReady", clientId: "wrong-surface" });
    fireMessage({
      type: "afxCanvasApplyMutation",
      requestId: "wrong-mutation",
      clientId: "wrong-surface",
      documentId: "canvas",
      baseVersion: "r1",
      mutation: { kind: "removeNodes", nodeIds: [] },
    });
    fireMessage({
      type: "afxCanvasEditorSetViewState",
      clientId: "wrong-surface",
      viewState: { x: 0, y: 0, zoom: 1, selectedIds: [] },
    });
    await Promise.resolve();

    expect(sink.records().map((record) => record.message)).toEqual([
      expect.stringContaining("rejected afxCanvasEditorReady"),
      expect.stringContaining("rejected afxCanvasApplyMutation"),
      expect.stringContaining("rejected afxCanvasEditorSetViewState"),
    ]);
    expect(view.webview.postMessage).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("copies markdown source through the VS Code clipboard bridge", async () => {
    const writeText = vi.spyOn(vscode.env.clipboard, "writeText").mockResolvedValue(undefined);
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxCopyMarkdown", content: "# Copied\n", label: "spec.md" });
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("# Copied\n");
    });
  });

  it("picks markdown files for canvas nodes and posts workspace-relative paths", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue([
      vscode.Uri.file("/repo/docs/ideas.md"),
    ]);
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxPickMarkdownFile" });

    await vi.waitFor(() => {
      expect(view.webview.postMessage).toHaveBeenCalledWith({
        type: "afxMarkdownFilePicked",
        filePath: "docs/ideas.md",
      });
    });
  });

  it("resolves Canvas file nodes by canonical root and rejects unsafe or ambiguous paths", async () => {
    const folders = [
      { uri: vscode.Uri.file("/workspace/client-a"), name: "client-a", index: 0 },
      { uri: vscode.Uri.file("/workspace/client-b"), name: "client-b", index: 1 },
    ];
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue(folders);
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);
    vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(
      Buffer.from("# Plan\n\n## Requirements\n"),
    );
    const showDocument = vi
      .spyOn(vscode.window, "showTextDocument")
      .mockResolvedValue({} as vscode.TextEditor);
    const warn = vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    const { view, fireMessage } = makeView(true);
    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);
    const owner = {
      rootUri: `file://${folders[1]!.uri.path}`,
      rootName: folders[1]!.name,
      relativePath: ".afx/project.canvas",
    };

    fireMessage({
      type: "afxOpenFile",
      path: "docs/spec.md",
      subpath: "#Requirements",
      mode: "editor",
      owner,
    });
    await vi.waitFor(() => expect(showDocument).toHaveBeenCalledOnce());
    expect(showDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/workspace/client-b/docs/spec.md" }),
      expect.objectContaining({ selection: expect.any(vscode.Range) }),
    );

    fireMessage({ type: "afxOpenFile", path: "/etc/passwd", mode: "editor", owner });
    fireMessage({ type: "afxFetchDocContent", filePath: "../outside.md", owner });
    fireMessage({ type: "afxOpenFile", path: "docs/spec.md", mode: "editor" });
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
    expect(showDocument).toHaveBeenCalledOnce();
    expect(view.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxDocContent",
        filePath: "../outside.md",
        content: expect.stringContaining("blocked"),
      }),
    );
  });

  it("returns live dirty Markdown revisions and precisely invalidates the canonical source", async () => {
    const roots = [
      { uri: vscode.Uri.file("/workspace/client-a"), name: "client-a", index: 0 },
      { uri: vscode.Uri.file("/workspace/client-b"), name: "client-b", index: 1 },
    ];
    const referencedSource = {
      rootUri: "file:///workspace/client-b",
      rootName: "client-b",
      relativePath: "docs/shared/spec.markdown",
    } as const;
    let sourceChange: ((change: WorkbenchSourceChange) => void) | undefined;
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue(roots);
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);
    const fileState: WorkbenchFileState = {
      classify: () => "docs",
      identify: (uri) =>
        uri.fsPath === "/workspace/client-b/docs/shared/spec.markdown"
          ? referencedSource
          : undefined,
      resolve: (source) =>
        source.rootUri === referencedSource.rootUri
          ? vscode.Uri.file(`/workspace/client-b/${source.relativePath}`)
          : undefined,
      readText: vi.fn(async (uri) =>
        uri.fsPath === "/workspace/client-b/docs/shared/spec.markdown"
          ? {
              uri,
              content: "# Unsaved manual edit",
              revision: "buffer-r2",
              dirty: true,
              kind: "docs" as const,
              source: referencedSource,
              sourceRevision: {
                contentRevision: "buffer-r2",
                diskRevision: "disk-r1",
                documentVersion: 7,
                dirty: true,
              },
            }
          : null,
      ),
      onDidChange(listener) {
        sourceChange = listener;
        return { dispose() {} };
      },
      dispose() {},
    };
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      fileState,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxFetchDocContent",
      requestId: "doc-request-1",
      filePath: "client-b/docs/shared/spec.markdown",
      owner: referencedSource,
    });
    await vi.waitFor(() =>
      expect(view.webview.postMessage).toHaveBeenCalledWith({
        type: "afxDocContent",
        requestId: "doc-request-1",
        filePath: "client-b/docs/shared/spec.markdown",
        owner: referencedSource,
        revision: {
          contentRevision: "buffer-r2",
          diskRevision: "disk-r1",
          documentVersion: 7,
          dirty: true,
        },
        content: "# Unsaved manual edit",
      }),
    );

    sourceChange?.({
      uri: vscode.Uri.file("/workspace/client-b/docs/shared/spec.markdown"),
      kind: "docs",
      reason: "buffer",
    });
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxDocContentInvalidated",
      owner: referencedSource,
    });
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxCanvasContentPreviewInvalidated",
      owner: referencedSource,
    });
  });

  it("serializes local image and explicit URL previews through the Workbench webview", async () => {
    const owner = {
      rootUri: "file:///workspace/client-b",
      rootName: "client-b",
      relativePath: "assets/architecture.png",
    } as const;
    const imageUri = vscode.Uri.file("/workspace/client-b/assets/architecture.png");
    const previewSource = vi.fn(async () => ({
      kind: "image" as const,
      state: "ready" as const,
      source: owner,
      uri: imageUri,
      mediaType: "image/png",
      byteLength: 42,
      revision: { contentRevision: "image-r1", diskRevision: "image-r1", dirty: false },
    }));
    const previewUrl = vi.fn(async () => ({
      kind: "url" as const,
      state: "ready" as const,
      url: "https://example.com/architecture",
      finalUrl: "https://example.com/architecture",
      metadata: { title: "Architecture" },
    }));
    const contentPreviewService: CanvasContentPreviewService = { previewSource, previewUrl };
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      contentPreviewService,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxCanvasContentPreviewRequest", requestId: "image-1", owner });
    fireMessage({
      type: "afxCanvasUrlPreviewRequest",
      requestId: "url-1",
      url: "https://example.com/architecture",
      allowNetwork: true,
    });

    await vi.waitFor(() => expect(previewSource).toHaveBeenCalledWith(owner));
    expect(view.webview.asWebviewUri).toHaveBeenCalledWith(imageUri);
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxCanvasContentPreviewResult",
      requestId: "image-1",
      owner,
      revision: { contentRevision: "image-r1", diskRevision: "image-r1", dirty: false },
      preview: {
        kind: "image",
        state: "ready",
        mediaType: "image/png",
        byteLength: 42,
        resourceUri: imageUri.toString(),
      },
    });
    expect(previewUrl).toHaveBeenCalledWith({
      url: "https://example.com/architecture",
      allowNetwork: true,
    });
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxCanvasUrlPreviewResult",
      requestId: "url-1",
      url: "https://example.com/architecture",
      preview: {
        state: "ready",
        finalUrl: "https://example.com/architecture",
        metadata: { title: "Architecture" },
      },
    });
    expect(JSON.stringify(vi.mocked(view.webview.postMessage).mock.calls)).not.toContain('"uri"');
  });

  it("posts typed terminal failures when Canvas services throw", async () => {
    const boom = new Error("boom");
    const owner = {
      rootUri: "file:///workspace",
      rootName: "workspace",
      relativePath: ".afx/project.canvas",
    };
    const contentPreviewService: CanvasContentPreviewService = {
      previewSource: vi.fn(async () => {
        throw boom;
      }),
      previewUrl: vi.fn(async () => {
        throw boom;
      }),
    };
    const canvasActionService: CanvasActionService = {
      run: vi.fn(async () => {
        throw boom;
      }),
    };
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      contentPreviewService,
      canvasActionService,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxCanvasContentPreviewRequest", requestId: "preview-x", owner });
    fireMessage({
      type: "afxCanvasUrlPreviewRequest",
      requestId: "url-x",
      url: "https://example.com",
      allowNetwork: true,
    });
    fireMessage({
      type: "afxCanvasRunAction",
      requestId: "action-x",
      target: owner,
      expectedRevision: "r1",
      action: { version: 1, action: "send-chat" },
      nodeIds: ["node-1"],
      confirmed: true,
    });

    await vi.waitFor(() => {
      expect(view.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxCanvasContentPreviewResult",
          requestId: "preview-x",
          preview: expect.objectContaining({ state: "error" }),
        }),
      );
      expect(view.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxCanvasUrlPreviewResult",
          requestId: "url-x",
          preview: expect.objectContaining({ state: "error" }),
        }),
      );
      expect(view.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxMutationResult",
          requestId: "action-x",
          outcome: "error",
        }),
      );
    });
  });

  it("opens only explicit credential-free HTTP links", async () => {
    const openExternal = vi.spyOn(vscode.env, "openExternal").mockResolvedValue(true);
    const warning = vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxOpenExternalUrl", url: "https://example.com/architecture" });
    fireMessage({ type: "afxOpenExternalUrl", url: "https://token@example.com/private" });
    fireMessage({ type: "afxOpenExternalUrl", url: "file:///workspace/private" });

    await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("correlates owner-aware multi-file picks and truthful Canvas exports", async () => {
    const owner = {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: ".afx/project.canvas",
    } as const;
    const references = [
      {
        filePath: "assets/architecture.png",
        source: { ...owner, relativePath: "assets/architecture.png" },
      },
    ];
    const pick = vi.fn(async () => references);
    const exportCanvas = vi.fn(async () => ({
      outcome: "success" as const,
      target: vscode.Uri.file("/repo/architecture.png"),
      byteLength: 7,
    }));
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      referencePicker: { pick } satisfies CanvasReferencePicker,
      canvasExportService: { export: exportCanvas } satisfies CanvasExportService,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCanvasPickReferences",
      requestId: "pick-1",
      owner,
      kind: "image",
      allowMultiple: true,
    });
    fireMessage({
      type: "afxCanvasExport",
      requestId: "export-1",
      format: "png",
      encoding: "base64",
      content: "iVBORw0KGgo=",
      suggestedName: "architecture.png",
    });

    await vi.waitFor(() => expect(pick).toHaveBeenCalledOnce());
    expect(pick).toHaveBeenCalledWith({ owner, kind: "image", allowMultiple: true });
    expect(exportCanvas).toHaveBeenCalledWith({
      format: "png",
      encoding: "base64",
      content: "iVBORw0KGgo=",
      suggestedName: "architecture.png",
    });
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxCanvasReferencesPicked",
      requestId: "pick-1",
      outcome: "success",
      references,
    });
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxCanvasExportResult",
      requestId: "export-1",
      outcome: "success",
      targetName: "architecture.png",
      byteLength: 7,
    });
    expect(JSON.stringify(vi.mocked(view.webview.postMessage).mock.calls)).not.toContain("/repo/");
  });

  it("returns correlated capability errors when Canvas picker and export are unavailable", async () => {
    const { view, fireMessage } = makeView(true);
    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      referencePicker: null,
      canvasExportService: null,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCanvasPickReferences",
      requestId: "pick-unavailable",
      kind: "any",
      allowMultiple: true,
    });
    fireMessage({
      type: "afxCanvasExport",
      requestId: "export-unavailable",
      format: "canvas",
      encoding: "utf8",
      content: "{}",
      suggestedName: "plan.canvas",
    });

    await vi.waitFor(() =>
      expect(view.webview.postMessage).toHaveBeenCalledWith({
        type: "afxCanvasExportResult",
        requestId: "export-unavailable",
        outcome: "error",
        code: "capability-unavailable",
        message: "Canvas export is unavailable in this host.",
      }),
    );
    expect(view.webview.postMessage).toHaveBeenCalledWith({
      type: "afxCanvasReferencesPicked",
      requestId: "pick-unavailable",
      outcome: "error",
      references: [],
      message: "Canvas file picking is unavailable in this host.",
    });
  });

  it("posts canvasEnabled:false without reading project.canvas when the flag is disabled", async () => {
    mockAfxConfiguration(false);
    const readFile = vi.spyOn(vscode.workspace.fs, "readFile");
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxReady" });

    await vi.waitFor(() => {
      expect(view.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "afxUpdate", canvasEnabled: false }),
      );
    });
    expect(readFile).not.toHaveBeenCalled();
  });

  it("creates .afx before saving project.canvas through the existing save bridge", async () => {
    mockAfxConfiguration(false);
    const specsData = makeSpecsData();
    const created: string[] = [];
    const writes: string[] = [];
    const { view, fireMessage } = makeView(true);
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    vi.spyOn(vscode.workspace.fs, "createDirectory").mockImplementation(async (uri) => {
      created.push(uri.fsPath);
    });
    vi.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(async (uri) => {
      writes.push(uri.fsPath);
    });

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxSaveFile", path: ".afx/project.canvas", content: '{"nodes":[]}' });

    await vi.waitFor(() => {
      expect(created).toEqual(["/repo/.afx"]);
      expect(writes).toEqual(["/repo/.afx/project.canvas"]);
    });
    expect(specsData.refresh).toHaveBeenCalled();
  });

  it("flushes a host-owned Canvas edit when the Workbench surface disposes", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const source = {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: ".afx/project.canvas",
    };
    const fileState: WorkbenchFileState = {
      classify: () => "canvas",
      identify: () => source,
      resolve: () => vscode.Uri.file("/repo/.afx/project.canvas"),
      readText: vi.fn(async () => null),
      onDidChange: () => ({ dispose() {} }),
      dispose: vi.fn(),
    };
    const mutateText = vi.fn(async (request) => ({
      type: "afxMutationResult" as const,
      requestId: request.requestId,
      outcome: "success" as const,
      target: request.target,
      revision: { contentRevision: "canvas-r2", diskRevision: "canvas-r1", dirty: true },
    }));
    const mutationCoordinator: WorkbenchMutationCoordinator = {
      mutateText,
      dispose: vi.fn(),
    };
    const { view, fireDispose, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      fileState,
      mutationCoordinator,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCanvasEdit",
      requestId: "canvas-edit-1",
      sessionId: "workbench-session",
      sequence: 1,
      documentId: "project-canvas",
      target: source,
      baseRevision: "canvas-r1",
      content: '{"nodes":[],"edges":[]}',
    });
    expect(mutateText).not.toHaveBeenCalled();

    fireDispose();
    await vi.waitFor(() => expect(mutateText).toHaveBeenCalledOnce());

    expect(mutateText).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "canvas-edit-1",
        target: source,
        expectedRevision: "canvas-r1",
        allowCreate: true,
        allowDirty: true,
      }),
    );
    expect(view.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasEditResult",
        requestId: "canvas-edit-1",
        sequence: 1,
        outcome: "success",
      }),
    );
  });

  it("stages through an injected extension session and only disconnects on view disposal", () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const stage = vi.fn();
    const disconnect = vi.fn();
    const managerDispose = vi.fn(async () => {});
    const canvasEditSessionManager: CanvasEditSessionManager = {
      connect: vi.fn(() => ({ stage, dispose: disconnect })),
      applyingClientId: vi.fn(() => undefined),
      flush: vi.fn(async () => {}),
      dispose: managerDispose,
    };
    const { view, fireDispose, fireMessage } = makeView(true);
    const request = {
      type: "afxCanvasEdit" as const,
      requestId: "shared-edit-1",
      sessionId: "workbench-shared",
      sequence: 1,
      documentId: "workbench-document",
      target: {
        rootUri: "file:///repo",
        rootName: "repo",
        relativePath: ".afx/project.canvas",
      },
      baseRevision: "canvas-r1",
      content: '{"nodes":[],"edges":[]}',
    };

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      canvasEditSessionManager,
    }).resolveWebviewView(view, {} as never, {} as never);
    fireMessage(request);

    expect(stage).toHaveBeenCalledWith(request);
    fireDispose();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(managerDispose).not.toHaveBeenCalled();
  });

  it("creates sample docs through the host bridge and refreshes data", async () => {
    const specsData = makeSpecsData();
    const writes: string[] = [];
    const { view, fireMessage } = makeView(true);
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    vi.spyOn(vscode.workspace.fs, "createDirectory").mockResolvedValue(undefined);
    vi.spyOn(vscode.workspace.fs, "writeFile").mockImplementation(async (uri) => {
      writes.push(uri.fsPath);
    });

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxCreateSampleDocs", kind: "full-spec" });
    await vi.waitFor(() => {
      expect(writes).toEqual([
        "/repo/docs/specs/sample-workbench-tour/spec.md",
        "/repo/docs/specs/sample-workbench-tour/design.md",
        "/repo/docs/specs/sample-workbench-tour/tasks.md",
        "/repo/docs/specs/sample-workbench-tour/journal.md",
      ]);
    });
    expect(specsData.refresh).toHaveBeenCalledOnce();
  });

  it("routes Board and Notes writes through one acknowledged mutation path", async () => {
    const source = {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: ".afx/kanban/roadmap.md",
    };
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const fileState: WorkbenchFileState = {
      classify: () => "board",
      identify: () => source,
      resolve: () => vscode.Uri.file("/repo/.afx/kanban/roadmap.md"),
      readText: vi.fn(async () => null),
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    };
    const mutateText = vi.fn(async (request) => ({
      type: "afxMutationResult" as const,
      requestId: request.requestId,
      outcome: "success" as const,
      target: request.target,
      revision: { contentRevision: "next", diskRevision: "next", dirty: false },
    }));
    const mutationCoordinator: WorkbenchMutationCoordinator = {
      mutateText,
      dispose: vi.fn(),
    };
    const mutateNotes = vi.fn(async (request) => ({
      type: "afxMutationResult" as const,
      requestId: request.requestId,
      outcome: "success" as const,
      target: request.target,
      revision: { contentRevision: "notes-next", diskRevision: "notes-next", dirty: false },
    }));
    const notesWriter: NotesWorkspaceWriter = {
      mutate: mutateNotes,
      appendToDefault: vi.fn(async () => undefined),
    };
    const specsData = makeSpecsData();
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData,
      fileState,
      mutationCoordinator,
      notesWriter,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxMutateKanbanBoard",
      requestId: "board-1",
      target: source,
      expectedRevision: "board-old",
      mutation: { kind: "addColumn", title: "Blocked" },
    });
    await vi.waitFor(() => expect(mutateText).toHaveBeenCalledOnce());
    expect(mutateText).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "board-1",
        target: source,
        expectedRevision: "board-old",
      }),
    );
    expect(view.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "board-1",
        outcome: "success",
      }),
    );

    fireMessage({
      type: "afxMutateNotes",
      requestId: "notes-1",
      target: { ...source, relativePath: ".afx/notes.md" },
      expectedRevision: "notes-old",
      mutation: { kind: "append", text: "Follow up" },
    });
    await vi.waitFor(() => expect(mutateNotes).toHaveBeenCalledOnce());
    expect(view.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "notes-1",
        outcome: "success",
      }),
    );
    expect(specsData.refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes spec dependencies against the live dirty Canvas buffer", async () => {
    const source = {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: ".afx/project.canvas",
    };
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const fileState: WorkbenchFileState = {
      classify: () => "canvas",
      identify: () => source,
      resolve: () => vscode.Uri.file("/repo/.afx/project.canvas"),
      readText: vi.fn(async () => ({
        uri: vscode.Uri.file("/repo/.afx/project.canvas"),
        content: '{"nodes":[],"edges":[]}',
        revision: "dirty-canvas",
        dirty: true,
        kind: "canvas" as const,
        source,
        sourceRevision: {
          contentRevision: "dirty-canvas",
          diskRevision: "saved-canvas",
          documentVersion: 2,
          dirty: true,
        },
      })),
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    };
    const mutateText = vi.fn(async (request) => ({
      type: "afxMutationResult" as const,
      requestId: request.requestId,
      outcome: "success" as const,
      target: request.target,
      revision: { contentRevision: "mapped-canvas", diskRevision: "saved-canvas", dirty: true },
    }));
    const mutationCoordinator: WorkbenchMutationCoordinator = {
      mutateText,
      dispose: vi.fn(),
    };
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      fileState,
      mutationCoordinator,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCanvasRefreshDependencies",
      requestId: "deps-1",
      target: source,
      expectedRevision: "dirty-canvas",
    });
    await vi.waitFor(() => expect(mutateText).toHaveBeenCalledOnce());
    expect(mutateText).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "deps-1",
        target: source,
        expectedRevision: "dirty-canvas",
        allowDirty: true,
      }),
    );
  });

  it("routes typed Board lifecycle requests to their exact multi-root identity", async () => {
    const source = {
      rootUri: "file:///other",
      rootName: "other",
      relativePath: ".afx/kanban/roadmap.md",
    };
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
      { uri: vscode.Uri.file("/other"), name: "other", index: 1 },
    ]);
    const fileState: WorkbenchFileState = {
      classify: () => "board",
      identify: (uri) =>
        uri.fsPath.startsWith("/other/")
          ? {
              rootUri: "file:///other",
              rootName: "other",
              relativePath: uri.fsPath.slice("/other/".length),
            }
          : undefined,
      resolve: (target) =>
        target.rootUri === "file:///other"
          ? vscode.Uri.file(`/other/${target.relativePath}`)
          : target.rootUri === "file:///repo"
            ? vscode.Uri.file(`/repo/${target.relativePath}`)
            : undefined,
      readText: vi.fn(async (uri) => ({
        uri,
        content: '---\ntitle: "Roadmap"\n---\n\n# Roadmap\n\n## Todo\n',
        revision: "board-r1",
        dirty: false,
        kind: "board" as const,
        source,
        sourceRevision: {
          contentRevision: "board-r1",
          diskRevision: "board-r1",
          dirty: false,
        },
      })),
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    };
    const mutateText = vi.fn(async (request) => ({
      type: "afxMutationResult" as const,
      requestId: request.requestId,
      outcome: "success" as const,
      target: request.target,
      revision: { contentRevision: "next", diskRevision: "next", dirty: false },
    }));
    const mutationCoordinator: WorkbenchMutationCoordinator = {
      mutateText,
      dispose: vi.fn(),
    };
    const remove = vi.spyOn(vscode.workspace.fs, "delete").mockResolvedValue(undefined);
    const specsData = makeSpecsData();
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData,
      fileState,
      mutationCoordinator,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCreateKanbanBoard",
      requestId: "create-other",
      targetRootUri: "file:///other",
      name: "Release Train",
    });
    await vi.waitFor(() => expect(mutateText).toHaveBeenCalledTimes(1));
    expect(mutateText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: {
          rootUri: "file:///other",
          rootName: "other",
          relativePath: ".afx/kanban/release-train.md",
        },
        allowCreate: true,
        requireMissing: true,
      }),
    );

    fireMessage({
      type: "afxRenameKanbanBoard",
      requestId: "rename-other",
      target: source,
      expectedRevision: "board-r1",
      name: "Delivery Plan",
    });
    await vi.waitFor(() => expect(mutateText).toHaveBeenCalledTimes(2));
    expect(mutateText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: {
          ...source,
          relativePath: ".afx/kanban/delivery-plan.md",
        },
        allowCreate: true,
        requireMissing: true,
      }),
    );
    await vi.waitFor(() =>
      expect(remove).toHaveBeenCalledWith(vscode.Uri.file("/other/.afx/kanban/roadmap.md")),
    );

    fireMessage({
      type: "afxDeleteKanbanBoard",
      requestId: "delete-other",
      target: source,
      expectedRevision: "board-r1",
    });
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(2));

    for (const requestId of ["create-other", "rename-other", "delete-other"]) {
      const matching = vi
        .mocked(view.webview.postMessage)
        .mock.calls.filter(
          ([message]) =>
            (message as { type?: string; requestId?: string }).type === "afxMutationResult" &&
            (message as { requestId?: string }).requestId === requestId,
        );
      expect(matching).toHaveLength(1);
      expect(matching[0]?.[0]).toEqual(expect.objectContaining({ requestId, outcome: "success" }));
    }
  });

  it("posts one structured error for a typed Board request without a workspace", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([]);
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCreateKanbanBoard",
      requestId: "no-root",
      targetRootUri: "file:///missing",
      name: "Roadmap",
    });

    await vi.waitFor(() => {
      const matching = vi
        .mocked(view.webview.postMessage)
        .mock.calls.filter(
          ([message]) => (message as { requestId?: string }).requestId === "no-root",
        );
      expect(matching).toHaveLength(1);
      expect(matching[0]?.[0]).toEqual(
        expect.objectContaining({
          type: "afxMutationResult",
          requestId: "no-root",
          outcome: "error",
          code: "outside-workspace",
          retryable: false,
        }),
      );
    });
  });

  it("converts an unexpected typed Board lifecycle failure into one terminal result", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const fileState: WorkbenchFileState = {
      classify: () => "board",
      identify: () => undefined,
      resolve: (target) => vscode.Uri.file(`/repo/${target.relativePath}`),
      readText: vi.fn(async () => null),
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    };
    const mutationCoordinator: WorkbenchMutationCoordinator = {
      mutateText: vi.fn(async () => {
        throw new Error("filesystem unavailable");
      }),
      dispose: vi.fn(),
    };
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      fileState,
      mutationCoordinator,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCreateKanbanBoard",
      requestId: "thrown-create",
      targetRootUri: "file:///repo",
      name: "Roadmap",
    });

    await vi.waitFor(() => {
      const matching = vi
        .mocked(view.webview.postMessage)
        .mock.calls.filter(
          ([message]) => (message as { requestId?: string }).requestId === "thrown-create",
        );
      expect(matching).toHaveLength(1);
      expect(matching[0]?.[0]).toEqual(
        expect.objectContaining({
          type: "afxMutationResult",
          outcome: "error",
          code: "write-failed",
          message: "filesystem unavailable",
          retryable: true,
        }),
      );
    });
  });

  it("routes Canvas actions through the safe host service and posts its one terminal result", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const source = {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: ".afx/project.canvas",
    };
    const result = {
      type: "afxMutationResult" as const,
      requestId: "canvas-action-1",
      outcome: "success" as const,
      target: source,
      revision: { contentRevision: "canvas-r1", dirty: false },
    };
    const run = vi.fn(async () => result);
    const canvasActionService: CanvasActionService = { run };
    const { view, fireMessage } = makeView(true);
    const request = {
      type: "afxCanvasRunAction" as const,
      requestId: "canvas-action-1",
      target: source,
      expectedRevision: "canvas-r1",
      action: { version: 1 as const, action: "prepare-spec" as const },
      nodeIds: ["idea-1"],
      confirmed: true,
    };

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
      canvasActionService,
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage(request);

    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(run).toHaveBeenCalledWith(request);
    expect(view.webview.postMessage).toHaveBeenCalledWith(result);
  });

  it("routes the Workbench open-editor action through the explicit Canvas command", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const target = {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: ".afx/canvases/release.canvas",
    };
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({ type: "afxOpenCanvasEditor", target });

    await vi.waitFor(() =>
      expect(executeCommand).toHaveBeenCalledWith("afx.openCanvasEditor", target),
    );
  });

  it("does not silently drop Canvas actions when the safe service is unavailable", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
    ]);
    const { view, fireMessage } = makeView(true);

    createWorkbenchPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      specsData: makeSpecsData(),
    }).resolveWebviewView(view, {} as never, {} as never);

    fireMessage({
      type: "afxCanvasRunAction",
      requestId: "canvas-action-unavailable",
      target: {
        rootUri: "file:///repo",
        rootName: "repo",
        relativePath: ".afx/project.canvas",
      },
      expectedRevision: "canvas-r1",
      action: { version: 1, action: "prepare-spec" },
      nodeIds: ["idea-1"],
      confirmed: true,
    });

    await vi.waitFor(() =>
      expect(view.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxMutationResult",
          requestId: "canvas-action-unavailable",
          outcome: "error",
          code: "capability-unavailable",
        }),
      ),
    );
  });
});
