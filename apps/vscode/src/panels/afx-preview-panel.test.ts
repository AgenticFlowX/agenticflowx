/**
 * AFX Preview panel host lifecycle tests.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { openAfxPreview } from "./afx-preview-panel";

vi.mock("./webview-html", () => ({
  getAppearanceClass: () => "theme-meridian style-lyra",
  getAppDistPath: () => "/tmp/agenticflowx/workbench/dist",
  loadWebviewHtml: () => "<html></html>",
}));

interface MockPanel {
  panel: vscode.WebviewPanel;
  fireMessage(message: unknown): void;
  fireDispose(): void;
  reveal: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
}

function makePanel(): MockPanel {
  let messageHandler: ((message: unknown) => void) | undefined;
  let disposeHandler: (() => void) | undefined;
  const reveal = vi.fn();
  const postMessage = vi.fn(async () => true);
  const panel = {
    webview: {
      options: {},
      html: "",
      cspSource: "vscode-webview://mock",
      asWebviewUri: (uri: vscode.Uri) => uri,
      onDidReceiveMessage: vi.fn((handler: (message: unknown) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }),
      postMessage,
    },
    reveal,
    onDidDispose: (handler: () => void) => {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    },
    dispose: vi.fn(),
  } as unknown as vscode.WebviewPanel;

  return {
    panel,
    fireMessage(message: unknown) {
      messageHandler?.(message);
    },
    fireDispose() {
      disposeHandler?.();
    },
    reveal,
    postMessage,
  };
}

function fakeUri(fsPath: string): vscode.Uri {
  return {
    fsPath,
    path: fsPath,
    scheme: "file",
    toString: () => `file://${fsPath}`,
  } as unknown as vscode.Uri;
}

const deps = {
  extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
  extensionMode: vscode.ExtensionMode.Test,
};

describe("openAfxPreview", () => {
  type DocChangeHandler = (event: { document: { uri: vscode.Uri; getText: () => string } }) => void;
  let docChangeHandler: DocChangeHandler | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    docChangeHandler = undefined;
    // The mock has no onDidChangeTextDocument; install a capturing one.
    (
      vscode.workspace as unknown as {
        onDidChangeTextDocument: (handler: DocChangeHandler) => vscode.Disposable;
      }
    ).onDidChangeTextDocument = (handler: DocChangeHandler) => {
      docChangeHandler = handler;
      return { dispose: vi.fn() };
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a panel Beside with retainContextWhenHidden", () => {
    const mock = makePanel();
    const createSpy = vi.spyOn(vscode.window, "createWebviewPanel").mockReturnValue(mock.panel);

    openAfxPreview(deps, fakeUri("/repo/spec.md"));

    expect(createSpy).toHaveBeenCalledTimes(1);
    const [viewType, title, showOptions, options] = createSpy.mock.calls[0]!;
    expect(viewType).toBe("afxPreview");
    expect(title).toBe("AFX Preview — spec.md");
    expect(showOptions).toMatchObject({
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
    });
    expect(options).toMatchObject({ retainContextWhenHidden: true, enableScripts: true });

    mock.fireDispose();
  });

  it("on afxReady posts appearance and afxPreviewShow with content", async () => {
    const mock = makePanel();
    vi.spyOn(vscode.window, "createWebviewPanel").mockReturnValue(mock.panel);
    vi.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({
      uri: fakeUri("/repo/spec.md"),
      getText: () => "# Hello preview body",
      save: async () => true,
    } as never);

    openAfxPreview(deps, fakeUri("/repo/spec.md"));
    mock.fireMessage({ type: "afxReady" });
    await vi.waitFor(() => {
      expect(mock.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "afxAppearanceUpdated" }),
      );
      expect(mock.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxPreviewShow",
          content: "# Hello preview body",
        }),
      );
    });

    mock.fireDispose();
  });

  it("copies markdown source through the VS Code clipboard bridge", async () => {
    const mock = makePanel();
    const writeText = vi.spyOn(vscode.env.clipboard, "writeText").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "createWebviewPanel").mockReturnValue(mock.panel);

    openAfxPreview(deps, fakeUri("/repo/spec.md"));
    mock.fireMessage({ type: "afxCopyMarkdown", content: "# Copied from preview\n" });

    expect(writeText).toHaveBeenCalledWith("# Copied from preview\n");
    mock.fireDispose();
  });

  it("opens a SECOND panel for a different file (side-by-side)", () => {
    const a = makePanel();
    const b = makePanel();
    const createSpy = vi
      .spyOn(vscode.window, "createWebviewPanel")
      .mockReturnValueOnce(a.panel)
      .mockReturnValueOnce(b.panel);

    openAfxPreview(deps, fakeUri("/repo/spec.md"));
    openAfxPreview(deps, fakeUri("/repo/other.md"));

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(a.reveal).not.toHaveBeenCalled();
    expect(b.reveal).not.toHaveBeenCalled();

    a.fireDispose();
    b.fireDispose();
  });

  it("reuses a file's panel: re-invoking on the same file reveals, no third panel", () => {
    const a = makePanel();
    const b = makePanel();
    const createSpy = vi
      .spyOn(vscode.window, "createWebviewPanel")
      .mockReturnValueOnce(a.panel)
      .mockReturnValueOnce(b.panel);

    openAfxPreview(deps, fakeUri("/repo/spec.md"));
    openAfxPreview(deps, fakeUri("/repo/other.md"));
    openAfxPreview(deps, fakeUri("/repo/spec.md"));

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(a.reveal).toHaveBeenCalledWith(vscode.ViewColumn.Beside, true);
    expect(b.reveal).not.toHaveBeenCalled();

    a.fireDispose();
    b.fireDispose();
  });

  it("re-pushes afxPreviewShow on a debounced change to the matching panel only", async () => {
    const a = makePanel();
    const b = makePanel();
    vi.spyOn(vscode.window, "createWebviewPanel")
      .mockReturnValueOnce(a.panel)
      .mockReturnValueOnce(b.panel);
    vi.spyOn(vscode.workspace, "openTextDocument").mockImplementation(
      async (uri: unknown) =>
        ({
          uri,
          getText: () => `text for ${(uri as vscode.Uri).toString()}`,
          save: async () => true,
        }) as never,
    );

    const uriA = fakeUri("/repo/spec.md");
    const uriB = fakeUri("/repo/other.md");
    openAfxPreview(deps, uriA);
    openAfxPreview(deps, uriB);
    a.postMessage.mockClear();
    b.postMessage.mockClear();

    expect(docChangeHandler).toBeDefined();
    docChangeHandler!({ document: { uri: uriA, getText: () => "edited buffer" } });

    // Flush the ~200ms debounce.
    await vi.advanceTimersByTimeAsync(250);
    await vi.waitFor(() => {
      expect(a.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxPreviewShow",
          content: "text for file:///repo/spec.md",
        }),
      );
    });
    // B's panel must not receive A's change.
    expect(b.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxPreviewShow" }),
    );

    a.fireDispose();
    b.fireDispose();
  });

  it("disposing a panel removes it from the registry (re-open creates fresh)", () => {
    const first = makePanel();
    const second = makePanel();
    const createSpy = vi
      .spyOn(vscode.window, "createWebviewPanel")
      .mockReturnValueOnce(first.panel)
      .mockReturnValueOnce(second.panel);

    const uri = fakeUri("/repo/spec.md");
    openAfxPreview(deps, uri);
    expect(createSpy).toHaveBeenCalledTimes(1);

    first.fireDispose();

    // After disposal the key is gone, so a re-open creates a brand-new panel.
    openAfxPreview(deps, uri);
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(second.reveal).not.toHaveBeenCalled();

    second.fireDispose();
  });
});
