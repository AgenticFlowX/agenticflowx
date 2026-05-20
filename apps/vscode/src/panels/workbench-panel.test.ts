/**
 * Workbench panel host lifecycle tests.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-2] [FR-8]
 * @see docs/specs/220-app-workbench/spec.md [FR-3]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { SpecsDataProvider } from "../services/specs-data";
import { createWorkbenchPanel } from "./workbench-panel";

vi.mock("./webview-html", () => ({
  getAppearanceClass: () => "vscode-light meridian",
  getAppDistPath: () => "/tmp/agenticflowx/workbench/dist",
  loadWebviewHtml: () => "<html></html>",
}));

interface MockWorkbenchView {
  view: vscode.WebviewView;
  fireDispose(): void;
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
  const view = {
    webview: {
      options: {} as vscode.WebviewOptions,
      html: "",
      cspSource: "vscode-webview://mock",
      asWebviewUri: (uri: vscode.Uri) => uri,
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
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
    const watcher: MockWatcher = {
      pattern: patternText,
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    };
    watchers.push(watcher);
    return watcher as unknown as vscode.FileSystemWatcher;
  });
  return watchers;
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
      "docs/**/*.md",
      ".afx/notes.md",
      ".afx/kanban/*.md",
    ]);
    for (const watcher of watchers) {
      expect(watcher.onDidChange).toHaveBeenCalledOnce();
      expect(watcher.onDidCreate).toHaveBeenCalledOnce();
      expect(watcher.onDidDelete).toHaveBeenCalledOnce();
    }
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

    expect(watchers).toHaveLength(3);
    expect(specsData.refresh).toHaveBeenCalledOnce();
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
    const secondWatchers = watchers.slice(3);
    fireDispose();

    for (const watcher of firstWatchers) {
      expect(watcher.dispose).toHaveBeenCalledOnce();
    }
    for (const watcher of secondWatchers) {
      expect(watcher.dispose).toHaveBeenCalledOnce();
    }
  });
});
