/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-11] [FR-12] [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EDITOR-AREA] [DES-CANVAS-MULTI-INSTANCE]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchInbound, WorkbenchOutbound, WorkbenchSourceIdentity } from "@afx/shared";

import type { CanvasContentPreviewService } from "../services/canvas-content-preview-service";
import type { CanvasEditSessionManager } from "../services/canvas-edit-session-manager";
import type { CanvasExportService } from "../services/canvas-export-service";
import type { CanvasReferencePicker } from "../services/canvas-reference-picker";
import type { WorkbenchFileState } from "../services/workbench-file-state";
import {
  AFX_CANVAS_EDITOR_VIEW_TYPE,
  type CanvasEditorProviderDeps,
  createCanvasEditorProvider,
  openCanvasEditor,
} from "./canvas-editor-provider";

const SOURCE: WorkbenchSourceIdentity = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/project.canvas",
};

function fakeDocument(initial: string) {
  let content = initial;
  let version = 1;
  let dirty = false;
  const uri = {
    scheme: "file",
    authority: "",
    path: "/workspace/.afx/project.canvas",
    fsPath: "/workspace/.afx/project.canvas",
    toString: () => "file:///workspace/.afx/project.canvas",
  } as vscode.Uri;
  const document = {
    uri,
    getText: () => content,
    get lineCount() {
      return content.split("\n").length;
    },
    lineAt(line: number) {
      const text = content.split("\n")[line] ?? "";
      return { range: { end: new vscode.Position(line, text.length) } };
    },
    get version() {
      return version;
    },
    get isDirty() {
      return dirty;
    },
    _replace(next: string) {
      content = next;
      version += 1;
      dirty = true;
    },
    _setNative(next: string, nextDirty: boolean) {
      content = next;
      version += 1;
      dirty = nextDirty;
    },
    _markSaved() {
      dirty = false;
    },
  } as unknown as vscode.TextDocument & {
    _replace(next: string): void;
    _setNative(next: string, dirty: boolean): void;
    _markSaved(): void;
  };
  return document;
}

function fakeFileState(): WorkbenchFileState {
  return {
    identify: () => SOURCE,
    resolve: () => undefined,
    classify: () => "canvas",
    readText: async () => null,
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
}

function fakePanel() {
  const posted: WorkbenchInbound[] = [];
  let receive: ((message: unknown) => void) | undefined;
  let dispose: (() => void) | undefined;
  const panel = {
    webview: {
      options: {},
      html: "",
      cspSource: "vscode-webview://test",
      asWebviewUri: vi.fn((uri: vscode.Uri) => uri),
      postMessage: async (message: WorkbenchInbound) => {
        posted.push(message);
        return true;
      },
      onDidReceiveMessage: (listener: (message: unknown) => void) => {
        receive = listener;
        return {
          dispose() {
            receive = undefined;
          },
        };
      },
    },
    onDidDispose: (listener: () => void) => {
      dispose = listener;
      return { dispose() {} };
    },
    dispose: () => {
      dispose?.();
    },
  } as unknown as vscode.WebviewPanel;
  return {
    panel,
    posted,
    send(message: WorkbenchOutbound) {
      receive?.(message);
    },
    dispose() {
      dispose?.();
    },
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AFX Canvas custom text editor", () => {
  let documentChanges: Set<(event: vscode.TextDocumentChangeEvent) => void>;
  let documentSaves: Set<(document: vscode.TextDocument) => void>;
  let configurationChanges: Set<(event: vscode.ConfigurationChangeEvent) => void>;

  beforeEach(() => {
    documentChanges = new Set();
    documentSaves = new Set();
    configurationChanges = new Set();
    vi.spyOn(vscode.workspace, "onDidChangeTextDocument").mockImplementation((listener) => {
      documentChanges.add(listener);
      return { dispose: () => documentChanges.delete(listener) };
    });
    vi.spyOn(vscode.workspace, "onDidSaveTextDocument").mockImplementation((listener) => {
      documentSaves.add(listener);
      return { dispose: () => documentSaves.delete(listener) };
    });
    vi.spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation((listener) => {
      configurationChanges.add(listener);
      return { dispose: () => configurationChanges.delete(listener) };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function provider(overrides: Partial<CanvasEditorProviderDeps> = {}) {
    return createCanvasEditorProvider({
      extensionUri: vscode.Uri.file("/extension"),
      extensionMode: vscode.ExtensionMode.Production,
      fileState: fakeFileState(),
      // Tests drive events synchronously; keep pushes immediate so settle() sees them.
      pushDebounceMs: 0,
      ...overrides,
    });
  }

  async function resolvePanel(
    editorProvider: vscode.CustomTextEditorProvider,
    document: vscode.TextDocument,
  ) {
    const harness = fakePanel();
    await editorProvider.resolveCustomTextEditor(document, harness.panel, {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose() {} }),
    });
    return harness;
  }

  async function resolve(initial: string, overrides: Partial<CanvasEditorProviderDeps> = {}) {
    const document = fakeDocument(initial);
    const harness = await resolvePanel(provider(overrides), document);
    return { document, ...harness };
  }

  function fireDocumentChange(
    document: vscode.TextDocument,
    reason?: vscode.TextDocumentChangeReason,
  ): void {
    for (const listener of documentChanges) {
      listener({ document, contentChanges: [], reason });
    }
  }

  function fireDocumentSave(document: vscode.TextDocument): void {
    for (const listener of documentSaves) listener(document);
  }

  function fireConfigurationChange(...sections: string[]): void {
    const affected = new Set(sections);
    const event: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => affected.has(section),
    };
    for (const listener of configurationChanges) listener(event);
  }

  it("publishes a live document snapshot and re-identifies the editor client", async () => {
    const harness = await resolve('{"nodes":[],"edges":[]}');

    harness.send({ type: "afxReady" });
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();

    const documents = harness.posted.filter(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    );
    expect(documents.at(-1)).toMatchObject({
      clientId: "editor-a",
      enabled: false,
      document: {
        documentId: "file:///workspace::.afx/project.canvas",
        source: SOURCE,
        revision: { documentVersion: 1, dirty: false },
      },
    });
  });

  it("broadcasts one shared TextDocument while keeping split-editor view state local", async () => {
    const initial = '{"nodes":[],"edges":[]}';
    const document = fakeDocument(initial);
    const editorProvider = provider();
    const editorA = await resolvePanel(editorProvider, document);
    const editorB = await resolvePanel(editorProvider, document);

    editorA.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    editorB.send({ type: "afxCanvasEditorReady", clientId: "editor-b" });
    await settle();
    const initialSnapshot = editorA.posted.find(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    )!;
    editorA.posted.length = 0;
    editorB.posted.length = 0;

    const viewA = { x: 120, y: -45, zoom: 1.4, selectedIds: ["node-a"] };
    const viewB = { x: -20, y: 80, zoom: 0.8, selectedIds: ["node-b"] };
    editorA.send({ type: "afxCanvasEditorSetViewState", clientId: "editor-a", viewState: viewA });
    editorB.send({ type: "afxCanvasEditorSetViewState", clientId: "editor-b", viewState: viewB });
    await settle();

    expect(editorA.posted).toContainEqual({
      type: "afxCanvasEditorState",
      clientId: "editor-a",
      viewState: viewA,
    });
    expect(editorA.posted).not.toContainEqual(
      expect.objectContaining({ type: "afxCanvasEditorState", clientId: "editor-b" }),
    );
    expect(editorB.posted).toContainEqual({
      type: "afxCanvasEditorState",
      clientId: "editor-b",
      viewState: viewB,
    });
    expect(editorB.posted).not.toContainEqual(
      expect.objectContaining({ type: "afxCanvasEditorState", clientId: "editor-a" }),
    );
    editorA.posted.length = 0;
    editorB.posted.length = 0;
    editorA.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();
    expect(editorA.posted).toContainEqual({
      type: "afxCanvasEditorState",
      clientId: "editor-a",
      viewState: viewA,
    });
    expect(editorB.posted).toHaveLength(0);

    let replacement = "";
    vi.spyOn(vscode.WorkspaceEdit.prototype, "replace").mockImplementation((_uri, _range, text) => {
      replacement = text;
    });
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      document._replace(replacement);
      fireDocumentChange(document);
      return true;
    });
    const next = '{"nodes":[],"edges":[],"title":"Shared"}\n';

    editorA.send({
      type: "afxCanvasSave",
      requestId: "shared-save",
      target: SOURCE,
      expectedRevision: initialSnapshot.document.revision.contentRevision,
      content: next,
    });
    await settle();

    const latestDocument = (messages: WorkbenchInbound[]) =>
      messages
        .filter(
          (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
            message.type === "afxCanvasEditorDocument",
        )
        .at(-1);
    expect(latestDocument(editorA.posted)).toMatchObject({
      clientId: "editor-a",
      document: { content: next, revision: { dirty: true, documentVersion: 2 } },
    });
    expect(latestDocument(editorB.posted)).toMatchObject({
      clientId: "editor-b",
      document: { content: next, revision: { dirty: true, documentVersion: 2 } },
    });
    expect(editorA.posted).toContainEqual(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "shared-save",
        outcome: "success",
      }),
    );
    expect(editorB.posted).not.toContainEqual(
      expect.objectContaining({ type: "afxMutationResult", requestId: "shared-save" }),
    );
  });

  it("applies a valid full-document save through WorkspaceEdit and acknowledges it once", async () => {
    const harness = await resolve('{"nodes":[],"edges":[],"vendor":{"keep":true}}');
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();
    const snapshot = harness.posted.find(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    )!;
    let replacement = "";
    vi.spyOn(vscode.WorkspaceEdit.prototype, "replace").mockImplementation((_uri, _range, text) => {
      replacement = text;
    });
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      harness.document._replace(replacement);
      return true;
    });

    harness.send({
      type: "afxCanvasSave",
      requestId: "save-1",
      target: SOURCE,
      expectedRevision: snapshot.document.revision.contentRevision,
      content: '{"nodes":[],"edges":[],"vendor":{"keep":true},"title":"Plan"}\n',
    });
    await settle();

    const results = harness.posted.filter(
      (message): message is Extract<WorkbenchInbound, { type: "afxMutationResult" }> =>
        message.type === "afxMutationResult" && message.requestId === "save-1",
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ outcome: "success", revision: { dirty: true } });
    expect(JSON.parse(harness.document.getText())).toMatchObject({
      vendor: { keep: true },
      title: "Plan",
    });
  });

  it("rejects a stale save without touching the text document", async () => {
    const harness = await resolve('{"nodes":[],"edges":[]}');
    const apply = vi.spyOn(vscode.workspace, "applyEdit");

    harness.send({
      type: "afxCanvasSave",
      requestId: "save-stale",
      target: SOURCE,
      expectedRevision: "old-revision",
      content: '{"nodes":[],"edges":[],"title":"Do not write"}',
    });
    await settle();

    expect(apply).not.toHaveBeenCalled();
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "save-stale",
        outcome: "conflict",
        code: "stale-revision",
      }),
    );
  });

  it("applies ID-based mutations and preserves unknown root and node fields", async () => {
    const initial = JSON.stringify({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "Idea",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          pluginData: { keep: 1 },
        },
      ],
      edges: [],
      obsidianExtension: { keep: true },
    });
    const harness = await resolve(initial);
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();
    const snapshot = harness.posted.find(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    )!;
    let replacement = "";
    vi.spyOn(vscode.WorkspaceEdit.prototype, "replace").mockImplementation((_uri, _range, text) => {
      replacement = text;
    });
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      harness.document._replace(replacement);
      return true;
    });

    harness.send({
      type: "afxCanvasApplyMutation",
      requestId: "mutation-1",
      clientId: "editor-a",
      documentId: snapshot.document.documentId,
      baseVersion: snapshot.document.revision.contentRevision,
      mutation: { kind: "updateNode", nodeId: "n1", patch: { x: 48 } },
    });
    await settle();

    const written = JSON.parse(harness.document.getText()) as Record<string, unknown>;
    expect(written["obsidianExtension"]).toEqual({ keep: true });
    expect((written["nodes"] as Array<Record<string, unknown>>)[0]).toMatchObject({
      x: 48,
      pluginData: { keep: 1 },
    });
  });

  it("pushes manual TextDocument changes and reports malformed JSON without erasing content", async () => {
    const harness = await resolve('{"nodes":[],"edges":[]}');
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();
    harness.document._replace("{broken");

    fireDocumentChange(harness.document);
    await settle();

    const documents = harness.posted.filter(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    );
    expect(documents.at(-1)?.document).toMatchObject({ content: "{broken" });
    expect(documents.at(-1)?.document.parseError).toBeTruthy();
  });

  it("reports native dirty, save, undo, redo, and revert state from the TextDocument", async () => {
    const original = '{"nodes":[],"edges":[]}';
    const saved = '{"nodes":[],"edges":[],"title":"Saved"}';
    const draft = '{"nodes":[],"edges":[],"title":"Draft"}';
    const harness = await resolve(original);
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();

    const pushNativeChange = async (
      content: string,
      dirty: boolean,
      reason?: vscode.TextDocumentChangeReason,
    ) => {
      harness.document._setNative(content, dirty);
      fireDocumentChange(harness.document, reason);
      await settle();
    };
    const latest = () =>
      harness.posted
        .filter(
          (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
            message.type === "afxCanvasEditorDocument",
        )
        .at(-1)!.document;

    await pushNativeChange(saved, true);
    expect(latest()).toMatchObject({
      content: saved,
      revision: { dirty: true, documentVersion: 2 },
    });

    harness.document._markSaved();
    fireDocumentSave(harness.document);
    await settle();
    expect(latest()).toMatchObject({
      content: saved,
      revision: { dirty: false, documentVersion: 2 },
    });

    await pushNativeChange(original, true, vscode.TextDocumentChangeReason.Undo);
    expect(latest()).toMatchObject({
      content: original,
      revision: { dirty: true, documentVersion: 3 },
    });

    await pushNativeChange(saved, false, vscode.TextDocumentChangeReason.Redo);
    expect(latest()).toMatchObject({
      content: saved,
      revision: { dirty: false, documentVersion: 4 },
    });

    await pushNativeChange(draft, true);
    await pushNativeChange(saved, false);
    expect(latest()).toMatchObject({
      content: saved,
      revision: { dirty: false, documentVersion: 6 },
    });
  });

  it("broadcasts native save, undo, redo, and revert revisions to every split editor", async () => {
    const original = '{"nodes":[],"edges":[]}';
    const saved = '{"nodes":[],"edges":[],"title":"Saved"}';
    const draft = '{"nodes":[],"edges":[],"title":"Draft"}';
    const document = fakeDocument(original);
    const editorProvider = provider();
    const editorA = await resolvePanel(editorProvider, document);
    const editorB = await resolvePanel(editorProvider, document);
    editorA.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    editorB.send({ type: "afxCanvasEditorReady", clientId: "editor-b" });
    await settle();
    editorA.posted.length = 0;
    editorB.posted.length = 0;

    const latest = (messages: WorkbenchInbound[]) =>
      messages
        .filter(
          (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
            message.type === "afxCanvasEditorDocument",
        )
        .at(-1)!.document;
    const push = async (
      content: string,
      dirty: boolean,
      reason?: vscode.TextDocumentChangeReason,
    ) => {
      document._setNative(content, dirty);
      fireDocumentChange(document, reason);
      await settle();
      expect(latest(editorA.posted)).toEqual(latest(editorB.posted));
    };

    await push(saved, true);
    document._markSaved();
    fireDocumentSave(document);
    await settle();
    expect(latest(editorA.posted).revision).toMatchObject({ dirty: false, documentVersion: 2 });
    expect(latest(editorA.posted)).toEqual(latest(editorB.posted));

    await push(original, true, vscode.TextDocumentChangeReason.Undo);
    expect(latest(editorA.posted)).toMatchObject({ content: original });
    await push(saved, false, vscode.TextDocumentChangeReason.Redo);
    expect(latest(editorA.posted)).toMatchObject({ content: saved });
    await push(draft, true);
    await push(saved, false);
    expect(latest(editorA.posted)).toMatchObject({
      content: saved,
      revision: { dirty: false, documentVersion: 6 },
    });
  });

  it("leaves a dirty TextDocument untouched when every custom editor view closes", async () => {
    const initial = '{"nodes":[],"edges":[]}';
    const document = fakeDocument(initial);
    const editorProvider = provider();
    const editorA = await resolvePanel(editorProvider, document);
    const editorB = await resolvePanel(editorProvider, document);
    editorA.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    editorB.send({ type: "afxCanvasEditorReady", clientId: "editor-b" });
    await settle();
    const snapshot = editorA.posted.find(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    )!;
    let replacement = "";
    vi.spyOn(vscode.WorkspaceEdit.prototype, "replace").mockImplementation((_uri, _range, text) => {
      replacement = text;
    });
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      document._replace(replacement);
      fireDocumentChange(document);
      return true;
    });
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const dirtyContent = '{"nodes":[],"edges":[],"title":"Hot exit draft"}\n';

    editorA.send({
      type: "afxCanvasSave",
      requestId: "dirty-before-close",
      target: SOURCE,
      expectedRevision: snapshot.document.revision.contentRevision,
      content: dirtyContent,
    });
    await settle();
    editorA.dispose();
    editorB.dispose();

    expect(document.getText()).toBe(dirtyContent);
    expect(document.isDirty).toBe(true);
    expect(documentChanges.size).toBe(0);
    expect(documentSaves.size).toBe(0);
    expect(configurationChanges.size).toBe(0);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("finishes an edit stream mutation after the custom editor closes immediately", async () => {
    const initial = '{"nodes":[],"edges":[]}';
    const document = fakeDocument(initial);
    const harness = await resolvePanel(provider(), document);
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-immediate-close" });
    await settle();
    const snapshot = harness.posted.find(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    )!;
    let replacement = "";
    let releaseApply!: () => void;
    const applyStarted = new Promise<void>((resolve) => {
      releaseApply = resolve;
    });
    vi.spyOn(vscode.WorkspaceEdit.prototype, "replace").mockImplementation((_uri, _range, text) => {
      replacement = text;
    });
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      await applyStarted;
      document._replace(replacement);
      return true;
    });
    const content = '{"nodes":[],"edges":[],"title":"Survives close"}\n';

    harness.send({
      type: "afxCanvasEdit",
      requestId: "stream-close-1",
      sessionId: "editor-immediate-close",
      sequence: 1,
      documentId: snapshot.document.documentId,
      target: SOURCE,
      baseRevision: snapshot.document.revision.contentRevision,
      content,
    } as unknown as WorkbenchOutbound);
    harness.dispose();
    releaseApply();
    await settle();

    expect(document.getText()).toBe(content);
    expect(document.isDirty).toBe(true);
  });

  it("connects every editor panel to one injected extension session without disposing its owner", async () => {
    const stageA = vi.fn();
    const stageB = vi.fn();
    const disconnectA = vi.fn();
    const disconnectB = vi.fn();
    const managerDispose = vi.fn(async () => {});
    const resultSinks: Parameters<CanvasEditSessionManager["connect"]>[0][] = [];
    const canvasEditSessionManager: CanvasEditSessionManager = {
      connect: vi.fn((post) => {
        resultSinks.push(post);
        return resultSinks.length === 1
          ? { stage: stageA, dispose: disconnectA }
          : { stage: stageB, dispose: disconnectB };
      }),
      applyingClientId: vi.fn(() => undefined),
      flush: vi.fn(async () => {}),
      dispose: managerDispose,
    };
    const editorProvider = provider({ canvasEditSessionManager });
    const document = fakeDocument('{"nodes":[],"edges":[]}');
    const editorA = await resolvePanel(editorProvider, document);
    const editorB = await resolvePanel(editorProvider, document);
    editorA.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    editorB.send({ type: "afxCanvasEditorReady", clientId: "editor-b" });
    await settle();
    const snapshot = editorA.posted.find(
      (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
        message.type === "afxCanvasEditorDocument",
    )!;
    const request = {
      type: "afxCanvasEdit" as const,
      requestId: "shared-editor-edit",
      sessionId: "editor-a",
      sequence: 1,
      documentId: snapshot.document.documentId,
      target: SOURCE,
      baseRevision: snapshot.document.revision.contentRevision,
      content: '{"nodes":[],"edges":[],"title":"Shared"}',
    };

    editorA.send(request);
    expect(stageA).toHaveBeenCalledWith(request);
    expect(stageB).not.toHaveBeenCalled();

    const documentCount = editorA.posted.filter(
      (message) => message.type === "afxCanvasEditorDocument",
    ).length;
    resultSinks[0]?.({
      type: "afxCanvasEditResult",
      requestId: request.requestId,
      sessionId: request.sessionId,
      sequence: request.sequence,
      outcome: "success",
      target: SOURCE,
      revision: {
        contentRevision: "shared-r2",
        diskRevision: "shared-r2",
        documentVersion: 2,
        dirty: true,
      },
    });
    await settle();
    expect(editorA.posted).toContainEqual(
      expect.objectContaining({ type: "afxCanvasEditResult", requestId: request.requestId }),
    );
    expect(
      editorA.posted.filter((message) => message.type === "afxCanvasEditorDocument"),
    ).toHaveLength(documentCount);

    editorA.dispose();
    expect(disconnectA).toHaveBeenCalledOnce();
    expect(disconnectB).not.toHaveBeenCalled();
    expect(managerDispose).not.toHaveBeenCalled();
  });

  it("pushes experiment-disabled recovery changes and opens the exact Settings target", async () => {
    let canvasEnabled = false;
    vi.spyOn(vscode.workspace, "getConfiguration").mockImplementation(
      () =>
        ({
          get: <T>(key: string, fallback?: T) =>
            (key === "experimental.canvas" ? canvasEnabled : fallback) as T,
        }) as vscode.WorkspaceConfiguration,
    );
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const harness = await resolve('{"nodes":[],"edges":[]}');
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();
    const snapshots = () =>
      harness.posted.filter(
        (message): message is Extract<WorkbenchInbound, { type: "afxCanvasEditorDocument" }> =>
          message.type === "afxCanvasEditorDocument",
      );
    expect(snapshots().at(-1)?.enabled).toBe(false);

    canvasEnabled = true;
    fireConfigurationChange("afx.experimental.canvas");
    await settle();
    expect(snapshots().at(-1)?.enabled).toBe(true);

    canvasEnabled = false;
    fireConfigurationChange("afx.experimental.canvas");
    harness.send({ type: "afxOpenSettings", setting: "afx.experimental.canvas" });
    await settle();
    expect(snapshots().at(-1)?.enabled).toBe(false);
    expect(executeCommand).toHaveBeenCalledWith(
      "workbench.action.openSettings",
      "afx.experimental.canvas",
    );
    expect(harness.document.getText()).toBe('{"nodes":[],"edges":[]}');
    expect(harness.document.isDirty).toBe(false);
  });

  it("opens bound-root Canvas file nodes at their subpath and rejects unsafe references", async () => {
    const root = { uri: vscode.Uri.file("/workspace"), name: "workspace", index: 0 };
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([root]);
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);
    vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(
      Buffer.from("# Plan\n\n## Requirements\n"),
    );
    const showDocument = vi
      .spyOn(vscode.window, "showTextDocument")
      .mockResolvedValue({} as vscode.TextEditor);
    const warn = vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    const harness = await resolve('{"nodes":[],"edges":[]}');

    harness.send({
      type: "afxOpenFile",
      path: "docs/spec.md",
      subpath: "#Requirements",
      mode: "editor",
      owner: SOURCE,
    });
    await settle();
    expect(showDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/workspace/docs/spec.md" }),
      expect.objectContaining({ selection: expect.any(vscode.Range) }),
    );

    harness.send({ type: "afxOpenFile", path: "/etc/passwd", mode: "editor", owner: SOURCE });
    harness.send({ type: "afxFetchDocContent", filePath: "../outside.md", owner: SOURCE });
    await settle();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("relative path"));
    expect(showDocument).toHaveBeenCalledOnce();
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxDocContent",
        filePath: "../outside.md",
        content: expect.stringContaining("blocked"),
      }),
    );
  });

  it("delivers dirty cross-root Markdown and invalidates every split editor precisely", async () => {
    const roots = [
      { uri: vscode.Uri.file("/workspace"), name: "workspace", index: 0 },
      { uri: vscode.Uri.file("/other"), name: "other", index: 1 },
    ];
    const referencedSource = {
      rootUri: "file:///other",
      rootName: "other",
      relativePath: "docs/shared/spec.markdown",
    } as const;
    const changeListeners = new Set<Parameters<WorkbenchFileState["onDidChange"]>[0]>();
    const fileState: WorkbenchFileState = {
      identify: (uri) =>
        uri.fsPath === "/workspace/.afx/project.canvas"
          ? SOURCE
          : uri.fsPath === "/other/docs/shared/spec.markdown"
            ? referencedSource
            : undefined,
      resolve: () => undefined,
      classify: (uri) =>
        uri.fsPath === "/workspace/.afx/project.canvas"
          ? "canvas"
          : uri.fsPath === "/other/docs/shared/spec.markdown"
            ? "docs"
            : undefined,
      readText: vi.fn(async (uri) =>
        uri.fsPath === "/other/docs/shared/spec.markdown"
          ? {
              uri,
              content: "# Dirty cross-root draft",
              revision: "buffer-r2",
              dirty: true,
              kind: "docs" as const,
              source: referencedSource,
              sourceRevision: {
                contentRevision: "buffer-r2",
                diskRevision: "disk-r1",
                documentVersion: 4,
                dirty: true,
              },
            }
          : null,
      ),
      onDidChange(listener) {
        changeListeners.add(listener);
        return { dispose: () => changeListeners.delete(listener) };
      },
      dispose() {},
    };
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue(roots);
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({} as vscode.FileStat);
    const showDocument = vi
      .spyOn(vscode.window, "showTextDocument")
      .mockResolvedValue({} as vscode.TextEditor);
    const openAfxPreview = vi.fn();
    const document = fakeDocument('{"nodes":[],"edges":[]}');
    const editorProvider = provider({ fileState, openAfxPreview });
    const editorA = await resolvePanel(editorProvider, document);
    const editorB = await resolvePanel(editorProvider, document);

    editorA.send({
      type: "afxFetchDocContent",
      requestId: "cross-root-request",
      filePath: "other/docs/shared/spec.markdown",
      owner: referencedSource,
    });
    editorA.send({
      type: "afxOpenFile",
      path: "other/docs/shared/spec.markdown",
      mode: "editor",
      owner: referencedSource,
    });
    editorA.send({
      type: "afxOpenFile",
      path: "other/docs/shared/spec.markdown",
      mode: "afxPreview",
      owner: referencedSource,
    });
    await settle();

    expect(editorA.posted).toContainEqual({
      type: "afxDocContent",
      requestId: "cross-root-request",
      filePath: "other/docs/shared/spec.markdown",
      owner: referencedSource,
      revision: {
        contentRevision: "buffer-r2",
        diskRevision: "disk-r1",
        documentVersion: 4,
        dirty: true,
      },
      content: "# Dirty cross-root draft",
    });
    expect(showDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/other/docs/shared/spec.markdown" }),
      expect.any(Object),
    );
    expect(openAfxPreview).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: "/other/docs/shared/spec.markdown" }),
    );

    editorA.posted.length = 0;
    editorB.posted.length = 0;
    for (const listener of changeListeners) {
      listener({
        uri: vscode.Uri.file("/other/docs/shared/spec.markdown"),
        kind: "docs",
        reason: "buffer",
      });
    }
    expect(editorA.posted).toContainEqual({
      type: "afxDocContentInvalidated",
      owner: referencedSource,
    });
    expect(editorB.posted).toContainEqual({
      type: "afxDocContentInvalidated",
      owner: referencedSource,
    });
    expect(editorA.posted).toContainEqual({
      type: "afxCanvasContentPreviewInvalidated",
      owner: referencedSource,
    });
    expect(editorB.posted).toContainEqual({
      type: "afxCanvasContentPreviewInvalidated",
      owner: referencedSource,
    });
  });

  it("serializes rich local and explicit URL previews in the custom editor", async () => {
    const owner = {
      rootUri: "file:///workspace",
      rootName: "workspace",
      relativePath: "assets/architecture.png",
    } as const;
    const imageUri = vscode.Uri.file("/workspace/assets/architecture.png");
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
      state: "blocked" as const,
      url: "http://127.0.0.1/private",
      code: "private-address" as const,
      message: "Local and private network URLs cannot be previewed.",
    }));
    const contentPreviewService: CanvasContentPreviewService = { previewSource, previewUrl };
    const harness = await resolve('{"nodes":[],"edges":[]}', { contentPreviewService });

    harness.send({ type: "afxCanvasContentPreviewRequest", requestId: "image-1", owner });
    harness.send({
      type: "afxCanvasUrlPreviewRequest",
      requestId: "url-1",
      url: "http://127.0.0.1/private",
      allowNetwork: true,
    });
    await settle();

    expect(previewSource).toHaveBeenCalledWith(owner);
    expect(harness.panel.webview.asWebviewUri).toHaveBeenCalledWith(imageUri);
    expect(harness.posted).toContainEqual({
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
      url: "http://127.0.0.1/private",
      allowNetwork: true,
    });
    expect(harness.posted).toContainEqual({
      type: "afxCanvasUrlPreviewResult",
      requestId: "url-1",
      url: "http://127.0.0.1/private",
      preview: {
        state: "blocked",
        code: "private-address",
        message: "Local and private network URLs cannot be previewed.",
      },
    });
    expect(JSON.stringify(harness.posted)).not.toContain('"uri"');
  });

  it("opens only explicit credential-free HTTP links from the custom editor", async () => {
    const openExternal = vi.spyOn(vscode.env, "openExternal").mockResolvedValue(true);
    const warning = vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
    const harness = await resolve('{"nodes":[],"edges":[]}');

    harness.send({ type: "afxOpenExternalUrl", url: "https://example.com/architecture" });
    harness.send({ type: "afxOpenExternalUrl", url: "https://token@example.com/private" });
    harness.send({ type: "afxOpenExternalUrl", url: "file:///workspace/private" });
    await settle();

    expect(openExternal).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("correlates multi-file picks and cancelled exports in the custom editor", async () => {
    const references = [
      {
        filePath: "src/architecture.ts",
        source: { ...SOURCE, relativePath: "src/architecture.ts" },
      },
    ];
    const pick = vi.fn().mockResolvedValueOnce(references).mockResolvedValueOnce([]);
    const exportCanvas = vi.fn(async () => ({ outcome: "cancelled" as const }));
    const harness = await resolve('{"nodes":[],"edges":[]}', {
      referencePicker: { pick } satisfies CanvasReferencePicker,
      canvasExportService: { export: exportCanvas } satisfies CanvasExportService,
    });

    harness.send({
      type: "afxCanvasPickReferences",
      requestId: "editor-pick-1",
      owner: SOURCE,
      kind: "any",
      allowMultiple: true,
    });
    harness.send({
      type: "afxCanvasExport",
      requestId: "editor-export-1",
      format: "png",
      encoding: "base64",
      content: "iVBORw0KGgo=",
      suggestedName: "architecture.png",
    });
    harness.send({
      type: "afxCanvasPickReferences",
      requestId: "editor-pick-cancelled",
      owner: SOURCE,
      kind: "image",
      allowMultiple: true,
    });
    await settle();

    expect(pick).toHaveBeenCalledWith({ owner: SOURCE, kind: "any", allowMultiple: true });
    expect(exportCanvas).toHaveBeenCalledWith({
      format: "png",
      encoding: "base64",
      content: "iVBORw0KGgo=",
      suggestedName: "architecture.png",
    });
    expect(harness.posted).toContainEqual({
      type: "afxCanvasReferencesPicked",
      requestId: "editor-pick-1",
      outcome: "success",
      references,
    });
    expect(harness.posted).toContainEqual({
      type: "afxCanvasExportResult",
      requestId: "editor-export-1",
      outcome: "cancelled",
    });
    expect(harness.posted).toContainEqual({
      type: "afxCanvasReferencesPicked",
      requestId: "editor-pick-cancelled",
      outcome: "cancelled",
      references: [],
    });
  });

  it("returns correlated picker failures and export errors in the custom editor", async () => {
    const pick = vi.fn(async () => {
      throw new Error("dialog unavailable");
    });
    const exportCanvas = vi.fn(async () => ({
      outcome: "error" as const,
      code: "write-failed" as const,
      message: "disk full",
    }));
    const harness = await resolve('{"nodes":[],"edges":[]}', {
      referencePicker: { pick } satisfies CanvasReferencePicker,
      canvasExportService: { export: exportCanvas } satisfies CanvasExportService,
    });

    harness.send({
      type: "afxCanvasPickReferences",
      requestId: "editor-pick-error",
      kind: "image",
      allowMultiple: true,
    });
    harness.send({
      type: "afxCanvasExport",
      requestId: "editor-export-error",
      format: "svg",
      encoding: "utf8",
      content: "<svg />",
      suggestedName: "architecture.svg",
    });
    await settle();

    expect(harness.posted).toContainEqual({
      type: "afxCanvasReferencesPicked",
      requestId: "editor-pick-error",
      outcome: "error",
      references: [],
      message: "dialog unavailable",
    });
    expect(harness.posted).toContainEqual({
      type: "afxCanvasExportResult",
      requestId: "editor-export-error",
      outcome: "error",
      code: "write-failed",
      message: "disk full",
    });
  });

  it("opens the optional editor explicitly through vscode.openWith", async () => {
    const execute = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const uri = vscode.Uri.file("/workspace/.afx/project.canvas");

    await openCanvasEditor(fakeFileState(), uri);

    expect(execute).toHaveBeenCalledWith("vscode.openWith", uri, AFX_CANVAS_EDITOR_VIEW_TYPE);
  });

  it("routes confirmed action requests only through the injected safe action service", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const result = {
      type: "afxMutationResult" as const,
      requestId: "action-1",
      outcome: "success" as const,
      target: SOURCE,
      revision: { contentRevision: "r1", dirty: false },
    };
    const run = vi.fn(async () => result);
    const harness = await resolve('{"nodes":[],"edges":[]}', {
      canvasActionService: { run },
    });
    const request = {
      type: "afxCanvasRunAction" as const,
      requestId: "action-1",
      target: SOURCE,
      expectedRevision: "r1",
      action: { version: 1 as const, action: "send-chat" as const },
      nodeIds: ["node-1"],
      confirmed: true,
    };

    harness.send(request);
    await settle();

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(request);
    expect(harness.posted).toContainEqual(result);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("returns one explicit capability error when the action service is unavailable", async () => {
    const harness = await resolve('{"nodes":[],"edges":[]}');

    harness.send({
      type: "afxCanvasRunAction",
      requestId: "action-unavailable",
      target: SOURCE,
      expectedRevision: "r1",
      action: { version: 1, action: "send-chat" },
      nodeIds: ["node-1"],
      confirmed: true,
    });
    await settle();

    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "action-unavailable",
        outcome: "error",
        code: "capability-unavailable",
      }),
    );
  });

  it("rejects action requests addressed to another Canvas before reaching the service", async () => {
    const run = vi.fn();
    const harness = await resolve('{"nodes":[],"edges":[]}', {
      canvasActionService: { run },
    });

    harness.send({
      type: "afxCanvasRunAction",
      requestId: "action-cross-document",
      target: { ...SOURCE, relativePath: ".afx/canvases/other.canvas" },
      expectedRevision: "r1",
      action: { version: 1, action: "send-chat" },
      nodeIds: ["node-1"],
      confirmed: true,
    });
    await settle();

    expect(run).not.toHaveBeenCalled();
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        requestId: "action-cross-document",
        outcome: "error",
        code: "outside-workspace",
      }),
    );
  });

  it("suppresses the change-event echo while the shared manager applies this panel's own edit", async () => {
    let applying: string | undefined;
    const canvasEditSessionManager: CanvasEditSessionManager = {
      connect: vi.fn(() => ({ stage: vi.fn(), dispose: vi.fn() })),
      applyingClientId: vi.fn(() => applying),
      flush: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const document = fakeDocument('{"nodes":[],"edges":[]}');
    const harness = await resolvePanel(provider({ canvasEditSessionManager }), document);
    harness.send({ type: "afxCanvasEditorReady", clientId: "editor-a" });
    await settle();
    const pushes = () =>
      harness.posted.filter((message) => message.type === "afxCanvasEditorDocument").length;
    const baseline = pushes();

    // The manager is writing THIS panel's staged edit: the change event must not echo.
    applying = "editor-a";
    document._replace('{"nodes":[],"edges":[],"metadata":{"afxRevision":1}}');
    fireDocumentChange(document);
    applying = undefined;
    await settle();
    expect(pushes()).toBe(baseline);

    // Another panel's edit on the same document still pushes (multi-instance sync).
    applying = "editor-b";
    document._replace('{"nodes":[],"edges":[],"metadata":{"afxRevision":2}}');
    fireDocumentChange(document);
    applying = undefined;
    await settle();
    expect(pushes()).toBe(baseline + 1);

    // A plain native/manual edit with no manager write pushes too.
    document._replace('{"nodes":[],"edges":[],"metadata":{"afxRevision":3}}');
    fireDocumentChange(document);
    await settle();
    expect(pushes()).toBe(baseline + 2);
  });

  it("routes library operations from the editor and opens results as editor tabs", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const createdTarget: WorkbenchSourceIdentity = {
      rootUri: SOURCE.rootUri,
      rootName: SOURCE.rootName,
      relativePath: ".afx/canvases/plan.canvas",
    };
    const success = (requestId: string) =>
      ({
        type: "afxMutationResult",
        requestId,
        outcome: "success",
        target: createdTarget,
        revision: { contentRevision: "r2", diskRevision: "r2", dirty: false },
      }) as const;
    const canvasLibrary = {
      list: vi.fn(async () => ({ canvases: [] })),
      select: vi.fn(async () => undefined),
      create: vi.fn(async () => success("create-1")),
      rename: vi.fn(async () => success("rename-1")),
      duplicate: vi.fn(async () => success("duplicate-1")),
      delete: vi.fn(async () => success("delete-1")),
      current: vi.fn(async () => undefined),
    };
    const fileState: WorkbenchFileState = {
      ...fakeFileState(),
      resolve: () => vscode.Uri.file("/workspace/.afx/canvases/plan.canvas"),
      dispose() {},
    };
    const harness = await resolvePanel(
      provider({ canvasLibrary, fileState }),
      fakeDocument('{"nodes":[],"edges":[]}'),
    );
    const disposeSpy = vi.spyOn(harness.panel, "dispose");

    harness.send({
      type: "afxCanvasCreate",
      requestId: "create-1",
      targetRootUri: SOURCE.rootUri,
      name: "Plan",
    });
    await settle();
    expect(canvasLibrary.create).toHaveBeenCalled();
    expect(harness.posted).toContainEqual(
      expect.objectContaining({ type: "afxMutationResult", requestId: "create-1" }),
    );
    // The created canvas opens as its own editor tab; this tab keeps its file.
    expect(executeCommand).toHaveBeenCalledWith(
      "vscode.openWith",
      expect.anything(),
      "afx.canvasEditor",
    );
    expect(disposeSpy).not.toHaveBeenCalled();

    // The library is (re)published so the editor's file switcher stays current.
    expect(harness.posted).toContainEqual(expect.objectContaining({ type: "afxCanvasLibrary" }));

    // Deleting the backing file retires this editor tab.
    harness.send({
      type: "afxCanvasDelete",
      requestId: "delete-1",
      target: SOURCE,
      expectedRevision: "r1",
    });
    await settle();
    expect(canvasLibrary.delete).toHaveBeenCalled();
    expect(disposeSpy).toHaveBeenCalled();
  });

  it("serves Spec Map doc-index and Sync from the editor host", async () => {
    const specDependencyIndexer = {
      index: vi.fn(async () => [
        {
          id: "110-cart",
          token: "110-cart",
          title: "Cart",
          kind: "spec" as const,
          source: SOURCE,
          relationships: {},
        },
      ]),
      refresh: vi.fn(async (content: string) => ({
        content: content.replace('"edges":[]', '"edges":[],"synced":true'),
        diagnostics: { unresolved: [], ambiguous: [], cycles: [] },
      })),
      resolveAuthorToken: vi.fn(async () => "110-cart"),
    };
    const harness = await resolvePanel(
      provider({ specDependencyIndexer }),
      fakeDocument('{"nodes":[],"edges":[]}'),
    );

    // Add-spec picker: doc-index answers (no more empty "No specs found").
    harness.send({ type: "afxCanvasDocIndex", requestId: "idx-1" });
    await settle();
    expect(specDependencyIndexer.index).toHaveBeenCalled();
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxCanvasDocIndex",
        requestId: "idx-1",
        entries: expect.arrayContaining([expect.objectContaining({ id: "110-cart" })]),
      }),
    );

    // Sync: reconciles this editor's document and acknowledges (no watchdog).
    harness.send({
      type: "afxCanvasRefreshDependencies",
      requestId: "sync-1",
      target: SOURCE,
      expectedRevision: "any-revision",
    });
    await settle();
    expect(specDependencyIndexer.refresh).toHaveBeenCalled();
    expect(harness.posted).toContainEqual(
      expect.objectContaining({ type: "afxMutationResult", requestId: "sync-1" }),
    );
  });

  it("authors a relationship from the editor host (source frontmatter + canvas reconcile)", async () => {
    const trust = vscode.workspace as { isTrusted?: boolean };
    const priorTrust = trust.isTrusted;
    trust.isTrusted = true;
    try {
      const specDependencyIndexer = {
        index: vi.fn(async () => []),
        refresh: vi.fn(async (content: string) => ({
          content: content.replace('"edges":[]', '"edges":[{"id":"dep"}]'),
          diagnostics: { unresolved: [], ambiguous: [], cycles: [] },
        })),
        resolveAuthorToken: vi.fn(async () => "110-cart"),
      };
      // The coordinator owns the source-doc write; exercise the transform so
      // editFrontmatterList runs, then report the frontmatter edit succeeded.
      const authorCoordinator = {
        mutateText: vi.fn(
          async (mutation: {
            requestId: string;
            target: unknown;
            transform: (c: string) => string | Promise<string>;
          }) => {
            await mutation.transform("---\nafx: true\ntype: SPEC\n---\n# Doc\n");
            return {
              type: "afxMutationResult" as const,
              requestId: mutation.requestId,
              outcome: "success" as const,
              target: mutation.target,
              revision: "rev-authored",
            };
          },
        ),
        dispose: vi.fn(),
      };
      const harness = await resolvePanel(
        provider({
          specDependencyIndexer,
          authorCoordinator: authorCoordinator as never,
        }),
        fakeDocument('{"nodes":[],"edges":[]}'),
      );

      harness.send({
        type: "afxCanvasAuthorRelationship",
        requestId: "auth-1",
        source: SOURCE,
        targetId: "110-cart",
        relationship: "depends_on",
        canvasTarget: SOURCE,
      });
      await settle();

      // Source frontmatter edited via the coordinator, canvas reconciled via
      // the editor's own write path, single acknowledgement posted.
      expect(authorCoordinator.mutateText).toHaveBeenCalledTimes(1);
      expect(specDependencyIndexer.refresh).toHaveBeenCalled();
      expect(harness.posted).toContainEqual(
        expect.objectContaining({ type: "afxMutationResult", requestId: "auth-1" }),
      );
    } finally {
      trust.isTrusted = priorTrust;
    }
  });

  it("answers request/response canvas messages even when a service throws (no hung spinner)", async () => {
    const boom = new Error("boom");
    const specDependencyIndexer = {
      index: vi.fn(async () => {
        throw boom;
      }),
      refresh: vi.fn(async () => {
        throw boom;
      }),
      resolveAuthorToken: vi.fn(async () => {
        throw boom;
      }),
    };
    const contentPreviewService = {
      previewSource: vi.fn(async () => {
        throw boom;
      }),
      previewUrl: vi.fn(async () => {
        throw boom;
      }),
    };
    const canvasLibrary = {
      list: vi.fn(async () => {
        throw boom;
      }),
      select: vi.fn(async () => undefined),
      create: vi.fn(async () => {
        throw boom;
      }),
      rename: vi.fn(async () => {
        throw boom;
      }),
      duplicate: vi.fn(async () => {
        throw boom;
      }),
      delete: vi.fn(async () => {
        throw boom;
      }),
      current: vi.fn(async () => undefined),
    };
    const canvasActionService = {
      run: vi.fn(async () => {
        throw boom;
      }),
    };
    const harness = await resolvePanel(
      provider({
        specDependencyIndexer,
        contentPreviewService: contentPreviewService,
        canvasLibrary,
        canvasActionService,
      }),
      fakeDocument('{"nodes":[],"edges":[]}'),
    );

    harness.send({ type: "afxCanvasDocIndex", requestId: "idx-x" });
    harness.send({ type: "afxCanvasContentPreviewRequest", requestId: "cp-x", owner: SOURCE });
    harness.send({
      type: "afxCanvasUrlPreviewRequest",
      requestId: "url-x",
      url: "https://example.com",
      allowNetwork: true,
    });
    harness.send({
      type: "afxCanvasRefreshDependencies",
      requestId: "sync-x",
      target: SOURCE,
      expectedRevision: "any-revision",
    });
    harness.send({
      type: "afxCanvasCreate",
      requestId: "create-x",
      targetRootUri: SOURCE.rootUri,
      name: "Broken",
    });
    harness.send({
      type: "afxCanvasRunAction",
      requestId: "action-x",
      target: SOURCE,
      expectedRevision: "any-revision",
      action: { version: 1, action: "send-chat" },
      nodeIds: ["node-1"],
      confirmed: true,
    });
    await settle();

    // Every request answers — a thrown service must never strand the webview
    // (the exact failure class behind the earlier "preview never loads" reports).
    expect(harness.posted).toContainEqual(
      expect.objectContaining({ type: "afxCanvasDocIndex", requestId: "idx-x", entries: [] }),
    );
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxCanvasContentPreviewResult",
        requestId: "cp-x",
        preview: expect.objectContaining({ state: "error" }),
      }),
    );
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxCanvasUrlPreviewResult",
        requestId: "url-x",
        preview: expect.objectContaining({ state: "error" }),
      }),
    );
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "sync-x",
        outcome: "error",
      }),
    );
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "create-x",
        outcome: "error",
      }),
    );
    expect(harness.posted).toContainEqual(
      expect.objectContaining({
        type: "afxMutationResult",
        requestId: "action-x",
        outcome: "error",
      }),
    );
  });
});
