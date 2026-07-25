/**
 * React Flow Canvas shell coverage for library, planning, mode, save, and
 * external-edit state transitions.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-11] [FR-12] [FR-24] [FR-25] [FR-26] [FR-27] [FR-31]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [9.1] [11.1] [11.2] [12.1] [16.1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CanvasDocumentSnapshot,
  CanvasNode,
  CanvasViewState,
  JSONCanvas,
  WorkbenchSourceIdentity,
} from "@afx/shared";

import { WorkbenchProvider } from "../../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../../lib/bridge";
import { CanvasApp } from "./canvas-app";
import { writeCanvasMode, writeCanvasProfile } from "./canvas-command-registry";
import type { CanvasNodePreview } from "./nodes/canvas-flow-node";

vi.mock("./react-flow-canvas", () => ({
  ReactFlowCanvas: ({
    canvas,
    fileContents,
    nodePreviews,
    onChange,
    onFileContentMount,
    onNodeAction,
    onAuthorRelationship,
    viewState,
    onViewStateChange,
  }: {
    canvas: JSONCanvas;
    fileContents?: Readonly<Record<string, string>>;
    nodePreviews?: Readonly<Record<string, CanvasNodePreview>>;
    onChange: (next: JSONCanvas, options?: { persist?: boolean }) => void;
    onFileContentMount?: (node: Extract<CanvasNode, { type: "file" }>) => void;
    onAuthorRelationship?: (source: CanvasNode, target: CanvasNode) => boolean;
    viewState?: CanvasViewState;
    onViewStateChange?: (viewState: CanvasViewState) => void;
    onNodeAction: (
      node: CanvasNode,
      action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete",
    ) => void;
  }) => {
    const nodes = canvas.nodes ?? [];
    const draw = (fromId: string, toId: string): boolean => {
      const from = nodes.find((node) => node.id === fromId);
      const to = nodes.find((node) => node.id === toId);
      return Boolean(from && to && onAuthorRelationship?.(from, to));
    };
    (globalThis as { __drawEdge?: (a: string, b: string) => boolean }).__drawEdge = draw;
    const fileNodes = (canvas.nodes ?? []).filter(
      (node): node is Extract<CanvasNode, { type: "file" }> => node.type === "file",
    );
    const firstFile = fileNodes[0];
    const firstLink = (canvas.nodes ?? []).find(
      (node): node is Extract<CanvasNode, { type: "link" }> => node.type === "link",
    );
    const actionFile =
      firstFile ??
      ({
        id: "markdown-file",
        type: "file",
        file: "docs/specs/229-app-workbench-canvas/spec.md",
        subpath: "#requirements",
        x: 0,
        y: 0,
        width: 280,
        height: 140,
      } satisfies Extract<CanvasNode, { type: "file" }>);
    return (
      <div data-testid="react-flow-canvas-mock">
        <output data-testid="canvas-node-count">{canvas.nodes?.length ?? 0}</output>
        <output data-testid="canvas-edge-count">{canvas.edges?.length ?? 0}</output>
        <output data-testid="canvas-view-state">{JSON.stringify(viewState)}</output>
        <output data-testid="first-file-content">{fileContents?.[actionFile.id] ?? ""}</output>
        {fileNodes.slice(0, 2).map((node) => (
          <output key={node.id} data-testid={`file-content-${node.id}`}>
            {previewText(nodePreviews?.[node.id]) ?? fileContents?.[node.id] ?? ""}
          </output>
        ))}
        {firstLink ? (
          <output data-testid={`link-preview-${firstLink.id}`}>
            {previewText(nodePreviews?.[firstLink.id])}
          </output>
        ) : null}
        <button type="button" onClick={() => onFileContentMount?.(actionFile)}>
          Mount first Markdown node
        </button>
        {fileNodes[1] ? (
          <button type="button" onClick={() => onFileContentMount?.(fileNodes[1])}>
            Mount second Markdown node
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onViewStateChange?.({ x: 120, y: -45, zoom: 1.4, selectedIds: ["idea"] })}
        >
          Move editor viewport
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...canvas,
              nodes: [
                ...(canvas.nodes ?? []),
                {
                  id: "local-draft",
                  type: "text",
                  text: "Local draft",
                  x: 0,
                  y: 0,
                  width: 240,
                  height: 120,
                },
              ],
            })
          }
        >
          Mutate graph
        </button>
        <button type="button" onClick={() => onNodeAction(actionFile, "open")}>
          Open Markdown source
        </button>
        <button type="button" onClick={() => onNodeAction(actionFile, "preview")}>
          Preview Markdown
        </button>
        {firstLink ? (
          <>
            <button type="button" onClick={() => onNodeAction(firstLink, "loadPreview")}>
              Load URL preview
            </button>
            <button type="button" onClick={() => onNodeAction(firstLink, "open")}>
              Open URL
            </button>
          </>
        ) : null}
      </div>
    );
  },
}));

function previewText(preview: CanvasNodePreview | undefined): string {
  if (!preview) return "";
  if (preview.state === "loading") return "Loading preview…";
  const payload = preview.payload;
  if (!payload) return "";
  if ("kind" in payload) {
    if (payload.kind === "markdown") return payload.content ?? "";
    if (payload.kind === "file") return payload.excerpt ?? "";
    return payload.message ?? payload.state;
  }
  return payload.metadata?.title ?? payload.message ?? payload.state;
}

const SOURCE = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/project.canvas",
} as const;

const REVISION = {
  contentRevision: "project-revision-1",
  diskRevision: "project-revision-1",
  dirty: false,
} as const;

const BASE_CANVAS = JSON.stringify({
  nodes: [
    {
      id: "idea",
      type: "text",
      text: "# Release idea",
      x: 0,
      y: 0,
      width: 280,
      height: 140,
    },
  ],
  edges: [],
});

function descriptor(id: string, relativePath: string, kind: "project" | "named" = "named") {
  return {
    id,
    kind,
    label: kind === "project" ? "Project Canvas" : "Release Roadmap",
    source: { ...SOURCE, relativePath },
    exists: true,
  } as const;
}

function documentSnapshot(
  content: string,
  item = descriptor("release", ".afx/canvases/release-roadmap.canvas"),
): CanvasDocumentSnapshot {
  return {
    documentId: `${item.source.rootUri}::${item.source.relativePath}`,
    descriptor: item,
    source: item.source,
    revision: {
      contentRevision: `revision-${content.length}`,
      diskRevision: `revision-${content.length}`,
      dirty: false,
    },
    content,
  };
}

function canvasWithNodes(count: number, prefix: string): string {
  return JSON.stringify({
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `${prefix}-${index + 1}`,
      type: "text",
      text: `${prefix} ${index + 1}`,
      x: index * 260,
      y: 0,
      width: 220,
      height: 120,
    })),
    edges: [],
  });
}

function renderCanvas(content = BASE_CANVAS) {
  return render(
    <WorkbenchProvider
      initialState={{
        isLoading: false,
        canvasEnabled: true,
        canvas: {
          path: SOURCE.relativePath,
          content,
          exists: true,
          source: SOURCE,
          revision: REVISION,
          documentId: `${SOURCE.rootUri}::${SOURCE.relativePath}`,
        },
      }}
    >
      <CanvasApp />
    </WorkbenchProvider>,
  );
}

function renderCanvasWithoutSource(content = BASE_CANVAS) {
  return render(
    <WorkbenchProvider
      initialState={{
        isLoading: false,
        canvasEnabled: true,
        canvas: { path: SOURCE.relativePath, content, exists: true },
      }}
    >
      <CanvasApp />
    </WorkbenchProvider>,
  );
}

function inbound(data: object): void {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });
}

function submitInputDialog(value?: string): void {
  const dialogInput = screen.getByLabelText(/Canvas name|New name|Duplicate as|URL/);
  if (value !== undefined) fireEvent.change(dialogInput, { target: { value } });
  fireEvent.submit(dialogInput.closest("form")!);
}

function confirmDialog(): void {
  const dialogs = screen.getAllByRole("alertdialog");
  const dialog = dialogs[dialogs.length - 1];
  const action = within(dialog)
    .getAllByRole("button")
    .find((button) => button.textContent !== "Cancel");
  fireEvent.click(action!);
}

describe("CanvasApp React Flow shell", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    globalThis.localStorage.clear();
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _resetBridgeForTest();
  });

  it("lists, selects, creates, renames, duplicates, deletes, and opens named canvases", () => {
    renderCanvas();

    const project = descriptor("project", SOURCE.relativePath, "project");
    const release = descriptor("release", ".afx/canvases/release-roadmap.canvas");
    inbound({ type: "afxCanvasLibrary", canvases: [project, release], selectedId: "project" });

    const picker = screen.getByRole("combobox", { name: "Canvas file" });
    expect(picker).toHaveValue("project");
    fireEvent.change(picker, { target: { value: "release" } });
    expect(postMessage).toHaveBeenCalledWith({ type: "afxCanvasSelect", canvasId: "release" }, "*");

    inbound({ type: "afxCanvasDocument", document: documentSnapshot(BASE_CANVAS, release) });
    fireEvent.click(screen.getByRole("button", { name: "New canvas" }));
    submitInputDialog("Roadmap Q3");
    acknowledgeOperation("afxCanvasCreate", release.source);
    fireEvent.click(screen.getByRole("button", { name: "Rename canvas" }));
    submitInputDialog("Release 2");
    acknowledgeOperation("afxCanvasRename", release.source);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate canvas" }));
    submitInputDialog("Release copy");
    acknowledgeOperation("afxCanvasDuplicate", release.source);
    fireEvent.click(screen.getByRole("button", { name: "Open in Canvas editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete canvas" }));
    confirmDialog();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasCreate",
        targetRootUri: SOURCE.rootUri,
        name: "Roadmap Q3",
        template: "ideas",
      }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxCanvasRename", name: "Release 2" }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxCanvasDuplicate", name: "Release copy" }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxOpenCanvasEditor", target: release.source },
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxCanvasDelete", target: release.source }),
      "*",
    );
  });

  it("switches between Freeform and Spec Map without replacing the document", () => {
    renderCanvas();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Freeform" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Spec Map" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Spec Map" }));
    expect(screen.getByRole("button", { name: "Freeform" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Spec Map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Sync specs" }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasRefreshDependencies",
        target: SOURCE,
        expectedRevision: REVISION.contentRevision,
      }),
      "*",
    );
    fireEvent.click(screen.getByRole("button", { name: "Freeform" }));
    expect(screen.queryByRole("button", { name: "Sync specs" })).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("1");
  });

  it("unlocks document operations with a retryable error when the host never replies", () => {
    vi.useFakeTimers();
    try {
      renderCanvas();
      fireEvent.click(screen.getByRole("button", { name: "Spec Map" }));
      fireEvent.click(screen.getByRole("button", { name: "Sync specs" }));
      expect(screen.getByText("Refreshing dependencies…")).toBeInTheDocument();

      // No afxMutationResult ever arrives - the watchdog must terminate the wait.
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(screen.queryByText("Refreshing dependencies…")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("timed out waiting for the host");
      // The lock is released: a new document operation can start again.
      fireEvent.click(screen.getByRole("button", { name: "Sync specs" }));
      expect(screen.getByText("Refreshing dependencies…")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds an annotation callout as a standard text node with afxNodeKind (FR-46)", () => {
    renderCanvas();
    const before = Number(screen.getByTestId("canvas-node-count").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    expect(Number(screen.getByTestId("canvas-node-count").textContent)).toBe(before + 1);
  });

  it("opens file-node source in the editor and exposes Markdown preview separately", () => {
    renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "Open Markdown source" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Markdown" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenFile",
        path: "docs/specs/229-app-workbench-canvas/spec.md",
        mode: "editor",
        owner: SOURCE,
        subpath: "#requirements",
      },
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenFile",
        path: "docs/specs/229-app-workbench-canvas/spec.md",
        mode: "afxPreview",
        owner: SOURCE,
        subpath: "#requirements",
      },
      "*",
    );
  });

  it("uses a generated file node's canonical owner for fetch, open, and preview", () => {
    const generatedSource = {
      rootUri: "file:///other",
      rootName: "other",
      relativePath: "docs/specs/shared/spec.markdown",
    } as const;
    renderCanvas(
      JSON.stringify({
        nodes: [
          {
            id: "generated-other",
            type: "file",
            file: "other/docs/specs/shared/spec.markdown",
            afxSource: generatedSource,
            x: 0,
            y: 0,
            width: 280,
            height: 140,
          },
        ],
        edges: [],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mount first Markdown node" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Markdown source" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview Markdown" }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasContentPreviewRequest",
        requestId: expect.any(String),
        owner: generatedSource,
      }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxOpenFile",
        path: "other/docs/specs/shared/spec.markdown",
        mode: "editor",
        owner: generatedSource,
      }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxOpenFile",
        path: "other/docs/specs/shared/spec.markdown",
        mode: "afxPreview",
        owner: generatedSource,
      }),
      "*",
    );
  });

  it("keeps same-path Markdown content separate by owner and ignores stale responses", () => {
    const other = {
      rootUri: "afx-workspace://other",
      rootName: "other",
      relativePath: "docs/shared/spec.md",
    } as const;
    const physicalOther = { ...other, rootUri: "file:///other" };
    const content = JSON.stringify({
      nodes: [
        {
          id: "root-a",
          type: "file",
          file: "docs/shared/spec.md",
          x: 0,
          y: 0,
          width: 280,
          height: 140,
        },
        {
          id: "root-b",
          type: "file",
          file: "docs/shared/spec.md",
          afxSource: other,
          x: 320,
          y: 0,
          width: 280,
          height: 140,
        },
      ],
      edges: [],
    });
    renderCanvas(content);
    fireEvent.click(screen.getByRole("button", { name: "Mount first Markdown node" }));
    fireEvent.click(screen.getByRole("button", { name: "Mount second Markdown node" }));

    const initialRequests = postMessage.mock.calls
      .map(
        (call: unknown[]) =>
          call[0] as {
            type?: string;
            requestId?: string;
            owner?: WorkbenchSourceIdentity;
          },
      )
      .filter((message: { type?: string }) => message.type === "afxCanvasContentPreviewRequest");
    expect(initialRequests).toHaveLength(2);
    const rootARequest = initialRequests.find(
      (request: { owner?: WorkbenchSourceIdentity }) => request.owner?.rootUri === SOURCE.rootUri,
    );
    const rootBRequest = initialRequests.find(
      (request: { owner?: WorkbenchSourceIdentity }) => request.owner?.rootUri === other.rootUri,
    );
    inbound({
      type: "afxCanvasContentPreviewResult",
      requestId: rootARequest?.requestId,
      owner: { ...SOURCE, relativePath: "docs/shared/spec.md" },
      revision: { contentRevision: "a-r1", diskRevision: "a-r1", dirty: false },
      preview: { kind: "markdown", state: "ready", content: "# Root A content" },
    });
    inbound({ type: "afxCanvasContentPreviewInvalidated", owner: physicalOther });
    const requests = postMessage.mock.calls
      .map(
        (call: unknown[]) =>
          call[0] as {
            type?: string;
            requestId?: string;
            owner?: WorkbenchSourceIdentity;
          },
      )
      .filter((message: { type?: string }) => message.type === "afxCanvasContentPreviewRequest");
    expect(requests).toHaveLength(3);
    expect(requests[2]?.owner).toEqual(other);

    inbound({
      type: "afxCanvasContentPreviewResult",
      requestId: requests[2]?.requestId,
      owner: other,
      revision: { contentRevision: "r2", diskRevision: "r1", dirty: true },
      preview: { kind: "markdown", state: "ready", content: "# New dirty content" },
    });
    inbound({
      type: "afxCanvasContentPreviewResult",
      requestId: rootBRequest?.requestId,
      owner: other,
      revision: { contentRevision: "r1", diskRevision: "r1", dirty: false },
      preview: { kind: "markdown", state: "ready", content: "# Stale content" },
    });

    expect(screen.getByTestId("file-content-root-a")).toHaveTextContent("# Root A content");
    expect(screen.getByTestId("file-content-root-b")).toHaveTextContent("# New dirty content");
  });

  it("does not mass-fetch an unmounted 1000-node Canvas", () => {
    renderCanvas(
      JSON.stringify({
        nodes: Array.from({ length: 1_000 }, (_, index) => ({
          id: `file-${index}`,
          type: "file",
          file: `docs/specs/${index}/spec.md`,
          x: index * 320,
          y: 0,
          width: 280,
          height: 140,
        })),
        edges: [],
      }),
    );

    expect(
      postMessage.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as { type?: string }).type === "afxCanvasContentPreviewRequest",
      ),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Mount first Markdown node" }));
    expect(
      postMessage.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as { type?: string }).type === "afxCanvasContentPreviewRequest",
      ),
    ).toHaveLength(1);
  });

  it("loads URL metadata only after the user explicitly requests it", () => {
    renderCanvas(
      JSON.stringify({
        nodes: [
          {
            id: "architecture-url",
            type: "link",
            url: "https://example.com/architecture",
            x: 0,
            y: 0,
            width: 280,
            height: 140,
          },
        ],
        edges: [],
      }),
    );

    expect(
      postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasUrlPreviewRequest",
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Load URL preview" }));
    const request = postMessage.mock.calls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .find((message: Record<string, unknown>) => message.type === "afxCanvasUrlPreviewRequest");
    expect(request).toEqual(
      expect.objectContaining({
        requestId: expect.any(String),
        url: "https://example.com/architecture",
        allowNetwork: true,
      }),
    );

    inbound({
      type: "afxCanvasUrlPreviewResult",
      requestId: request?.requestId,
      url: "https://example.com/architecture",
      preview: {
        state: "ready",
        finalUrl: "https://example.com/architecture",
        metadata: { title: "Architecture reference" },
      },
    });
    expect(screen.getByTestId("link-preview-architecture-url")).toHaveTextContent(
      "Architecture reference",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open URL" }));
    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxOpenExternalUrl", url: "https://example.com/architecture" },
      "*",
    );
  });

  it("routes editor-local viewport and selection state through its client identity", () => {
    const editorViewState = { x: -20, y: 80, zoom: 0.8, selectedIds: ["idea"] };
    const editorDocument = documentSnapshot(
      BASE_CANVAS,
      descriptor("project", SOURCE.relativePath, "project"),
    );
    render(
      <WorkbenchProvider initialState={{ isLoading: false, canvasEnabled: true }}>
        <CanvasApp
          editorClientId="editor-a"
          editorDocument={editorDocument}
          editorViewState={editorViewState}
        />
      </WorkbenchProvider>,
    );

    expect(screen.getByTestId("canvas-view-state")).toHaveTextContent(
      JSON.stringify(editorViewState),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move editor viewport" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxCanvasEditorSetViewState",
        clientId: "editor-a",
        viewState: { x: 120, y: -45, zoom: 1.4, selectedIds: ["idea"] },
      },
      "*",
    );
  });

  it("authors a chosen relationship when drawing between two spec docs", () => {
    const docCanvas = JSON.stringify({
      nodes: [
        {
          id: "a",
          type: "file",
          file: "docs/specs/220-checkout/spec.md",
          x: 0,
          y: 0,
          width: 300,
          height: 190,
          afxSource: { ...SOURCE, relativePath: "docs/specs/220-checkout/spec.md" },
          afxDoc: { version: 1, kind: "spec", id: "220-checkout" },
        },
        {
          id: "b",
          type: "file",
          file: "docs/specs/110-cart/spec.md",
          x: 400,
          y: 0,
          width: 300,
          height: 190,
          afxSource: { ...SOURCE, relativePath: "docs/specs/110-cart/spec.md" },
          afxDoc: { version: 1, kind: "spec", id: "110-cart" },
        },
        {
          id: "j",
          type: "file",
          file: "docs/specs/900-fleet/journal.md",
          x: 0,
          y: 300,
          width: 300,
          height: 190,
          afxSource: { ...SOURCE, relativePath: "docs/specs/900-fleet/journal.md" },
          afxDoc: { version: 1, kind: "journal", id: "900-fleet" },
        },
      ],
      edges: [],
    });
    renderCanvas(docCanvas);
    const draw = (globalThis as { __drawEdge?: (a: string, b: string) => boolean }).__drawEdge!;

    // spec → spec is ambiguous → the picker appears.
    let handled = false;
    act(() => {
      handled = draw("a", "b");
    });
    expect(handled).toBe(true);
    const picker = screen.getByRole("alertdialog");
    expect(picker).toHaveTextContent("Choose a relationship");
    fireEvent.click(within(picker).getByRole("button", { name: /depends on/ }));
    // Then a confirmation naming the field and target document.
    fireEvent.click(screen.getByRole("button", { name: "Author" }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasAuthorRelationship",
        relationship: "depends_on",
        targetId: "110-cart",
        remove: false,
        source: expect.objectContaining({ relativePath: "docs/specs/220-checkout/spec.md" }),
      }),
      "*",
    );

    // Drawing to a journal is a free-form edge — no authoring.
    let journalHandled = true;
    act(() => {
      journalHandled = draw("a", "j");
    });
    expect(journalHandled).toBe(false);
  });

  it("keeps library chrome available in the editor-area host and requests the library", () => {
    // Both hosts serve library operations (FR-3); the editor host opens
    // create/duplicate/select results as separate editor tabs.
    const editorDocument = documentSnapshot(
      BASE_CANVAS,
      descriptor("project", SOURCE.relativePath, "project"),
    );
    render(
      <WorkbenchProvider initialState={{ isLoading: false, canvasEnabled: true }}>
        <CanvasApp editorClientId="editor-a" editorDocument={editorDocument} />
      </WorkbenchProvider>,
    );

    expect(screen.getByRole("combobox", { name: "Canvas file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New canvas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename canvas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate canvas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete canvas" })).toBeInTheDocument();
    // Already inside the editor — no self-referential open button.
    expect(screen.queryByRole("button", { name: "Open in Canvas editor" })).not.toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith({ type: "afxCanvasList" }, "*");
  });

  it("applies every planning starter and previews exact spec and sprint handoffs", () => {
    renderCanvas(JSON.stringify({ nodes: [], edges: [] }));

    fireEvent.change(screen.getByRole("combobox", { name: "Canvas tools profile" }), {
      target: { value: "afx" },
    });
    for (const [label, template] of [
      ["Explore an idea", "ideas"],
      ["Plan a feature", "feature"],
      ["Build a roadmap", "roadmap"],
      ["Shape the next spec", "next-spec"],
      ["Low-fidelity workshop", "low-fidelity"],
      ["Architecture map", "architecture"],
      ["Presentation map", "high-fidelity"],
      ["Blank canvas", "blank"],
    ]) {
      if (screen.queryAllByRole("region", { name: "Canvas starters" }).length === 0) {
        fireEvent.click(screen.getByRole("button", { name: "Planning guide" }));
      }
      const gallery = screen.getAllByRole("region", { name: "Canvas starters" })[0];
      fireEvent.click(within(gallery).getByRole("button", { name: new RegExp(label) }));
      // A non-empty canvas asks before being replaced (webview-safe dialog).
      if (screen.queryByRole("alertdialog")) confirmDialog();
      if (template !== "blank") {
        expect(Number(screen.getByTestId("canvas-node-count").textContent)).toBeGreaterThan(0);
      }
    }

    fireEvent.click(screen.getByRole("button", { name: "Planning guide" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare Sprint…" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("/afx-sprint");
    confirmDialog();
    fireEvent.click(screen.getByRole("button", { name: "Prepare Spec…" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("/afx-spec refine");
    confirmDialog();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxOpenChatCommand",
        mode: "insert",
        command: expect.stringContaining("/afx-sprint"),
      }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxOpenChatCommand",
        mode: "insert",
        command: expect.stringContaining("/afx-spec refine"),
      }),
      "*",
    );
  });

  it("retains the last valid graph for malformed manual JSON", () => {
    renderCanvas();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("1");

    inbound({
      type: "afxCanvasDocument",
      document: documentSnapshot("{", descriptor("project", SOURCE.relativePath, "project")),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Manual JSON is invalid");
    expect(screen.getByRole("alert")).toHaveTextContent("last valid graph remains visible");
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("1");
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("starts in an Invalid state for malformed source instead of claiming Saved", () => {
    renderCanvas("{");

    expect(screen.getByText("Invalid")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Manual JSON is invalid");
  });

  it("shows editor-dirty source wording and keeps the toolbar to one scrollable row", () => {
    renderCanvas();
    const project = descriptor("project", SOURCE.relativePath, "project");
    inbound({
      type: "afxCanvasDocument",
      document: {
        ...documentSnapshot(BASE_CANVAS, project),
        revision: { contentRevision: "editor-r2", diskRevision: "disk-r1", dirty: true },
      },
    });

    expect(screen.getByText("Editor has unsaved changes")).toBeInTheDocument();
    expect(
      screen.queryByText("The Canvas source editor has unsaved changes."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-toolbar")).toHaveClass(
      "flex-nowrap",
      "overflow-x-auto",
      "overflow-y-hidden",
    );
  });

  it("sends pickLocation when the New-canvas dialog folder checkbox is ticked", () => {
    renderCanvas();
    const project = descriptor("project", SOURCE.relativePath, "project");
    inbound({ type: "afxCanvasLibrary", canvases: [project], selectedId: "project" });

    fireEvent.click(screen.getByRole("button", { name: "New canvas" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Choose a folder instead of .afx/canvases/" }),
    );
    submitInputDialog("Placed elsewhere");

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasCreate",
        name: "Placed elsewhere",
        pickLocation: true,
      }),
      "*",
    );

    // A host-side picker dismissal resolves quietly — no error banner, unlocked.
    const call = [...postMessage.mock.calls]
      .reverse()
      .find(
        (candidate: unknown[]) => (candidate[0] as { type?: string }).type === "afxCanvasCreate",
      );
    inbound({
      type: "afxMutationResult",
      requestId: (call?.[0] as { requestId: string }).requestId,
      outcome: "error",
      target: SOURCE,
      code: "cancelled",
      message: "Canvas creation cancelled.",
      retryable: true,
    });
    expect(screen.queryByText("Canvas creation cancelled.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New canvas" })).toBeEnabled();
  });

  it("switches A to B and back without losing either dirty draft, mode, or profile", () => {
    const project = descriptor("project", SOURCE.relativePath, "project");
    const release = descriptor("release", ".afx/canvases/release-roadmap.canvas");
    writeCanvasMode(`${SOURCE.rootUri}::${SOURCE.relativePath}`, "spec-map");
    writeCanvasProfile(`${SOURCE.rootUri}::${SOURCE.relativePath}`, "architecture");
    renderCanvas();
    inbound({ type: "afxCanvasLibrary", canvases: [project, release], selectedId: "project" });
    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("2");
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    const picker = screen.getByRole("combobox", { name: "Canvas file" });
    expect(picker).toBeEnabled();
    fireEvent.change(picker, { target: { value: "release" } });
    inbound({
      type: "afxCanvasDocument",
      document: documentSnapshot(canvasWithNodes(3, "release"), release),
    });

    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("3");
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Freeform" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // No stored profile for this AFX-workspace canvas — it defaults to the
    // full AFX toolset instead of hiding the integrations behind Essentials.
    expect(screen.getByRole("combobox", { name: "Canvas tools profile" })).toHaveValue("afx");
    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("4");

    fireEvent.change(picker, { target: { value: "project" } });
    inbound({ type: "afxCanvasDocument", document: documentSnapshot(BASE_CANVAS, project) });

    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("2");
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spec Map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Canvas tools profile" })).toHaveValue(
      "architecture",
    );
  });

  it("correlates a late A acknowledgement without changing active B state", () => {
    renderCanvas();
    const project = descriptor("project", SOURCE.relativePath, "project");
    const release = descriptor("release", ".afx/canvases/release-roadmap.canvas");
    inbound({ type: "afxCanvasLibrary", canvases: [project, release], selectedId: "project" });
    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    const firstEdit = postMessage.mock.calls.find(
      (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
    )?.[0] as
      | {
          requestId: string;
          sessionId: string;
          sequence: number;
          content: string;
        }
      | undefined;
    expect(firstEdit).toBeDefined();

    const picker = screen.getByRole("combobox", { name: "Canvas file" });
    fireEvent.change(picker, { target: { value: "release" } });
    inbound({
      type: "afxCanvasDocument",
      document: documentSnapshot(canvasWithNodes(3, "release"), release),
    });
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("3");
    expect(screen.getByText("Saved")).toBeInTheDocument();

    inbound({
      type: "afxCanvasEditResult",
      requestId: firstEdit?.requestId,
      sessionId: firstEdit?.sessionId,
      sequence: firstEdit?.sequence,
      outcome: "success",
      target: SOURCE,
      revision: {
        contentRevision: "project-late-r2",
        diskRevision: "project-late-r2",
        dirty: false,
      },
    });
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("3");
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "project" } });
    inbound({
      type: "afxCanvasDocument",
      document: documentSnapshot(firstEdit?.content ?? "", project),
    });
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("2");
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    const edits = postMessage.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
    );
    expect(edits.at(-1)?.[0]).toEqual(expect.objectContaining({ baseRevision: "project-late-r2" }));
  });

  it("keeps conflicts independent while switching between dirty documents", () => {
    renderCanvas();
    const project = descriptor("project", SOURCE.relativePath, "project");
    const release = descriptor("release", ".afx/canvases/release-roadmap.canvas");
    const externalProject = canvasWithNodes(4, "external-project");
    const externalRelease = canvasWithNodes(5, "external-release");
    inbound({ type: "afxCanvasLibrary", canvases: [project, release], selectedId: "project" });
    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    inbound({ type: "afxCanvasDocument", document: documentSnapshot(externalProject, project) });
    expect(screen.getByText("Conflict")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("2");

    const picker = screen.getByRole("combobox", { name: "Canvas file" });
    fireEvent.change(picker, { target: { value: "release" } });
    inbound({
      type: "afxCanvasDocument",
      document: documentSnapshot(canvasWithNodes(3, "release"), release),
    });
    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    inbound({ type: "afxCanvasDocument", document: documentSnapshot(externalRelease, release) });
    expect(screen.getByText("Conflict")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("4");

    fireEvent.change(picker, { target: { value: "project" } });
    inbound({ type: "afxCanvasDocument", document: documentSnapshot(externalProject, project) });
    expect(screen.getByText("Conflict")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "Reload external" }));
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("4");
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "release" } });
    inbound({ type: "afxCanvasDocument", document: documentSnapshot(externalRelease, release) });
    expect(screen.getByText("Conflict")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("4");
  });

  it("surfaces lifecycle failures and re-enables document controls", () => {
    renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "New canvas" }));
    submitInputDialog("Existing Canvas");
    expect(screen.getByText("Creating Canvas…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New canvas" })).toBeDisabled();
    const createCall = [...postMessage.mock.calls]
      .reverse()
      .find(
        (candidate: unknown[]) => (candidate[0] as { type?: string }).type === "afxCanvasCreate",
      );
    const requestId = (createCall?.[0] as { requestId?: string } | undefined)?.requestId;
    inbound({
      type: "afxMutationResult",
      requestId,
      outcome: "error",
      target: SOURCE,
      code: "collision",
      message: "A Canvas with that name already exists.",
      retryable: false,
    });

    expect(screen.getByRole("alert")).toHaveTextContent("A Canvas with that name already exists.");
    expect(screen.getByRole("button", { name: "New canvas" })).toBeEnabled();
  });

  it("clears dependency refresh progress when the host returns an error", () => {
    renderCanvas();
    fireEvent.click(screen.getByRole("button", { name: "Spec Map" }));
    fireEvent.click(screen.getByRole("button", { name: "Sync specs" }));
    expect(screen.getByText("Refreshing dependencies…")).toBeInTheDocument();
    const refreshCall = [...postMessage.mock.calls]
      .reverse()
      .find(
        (candidate: unknown[]) =>
          (candidate[0] as { type?: string }).type === "afxCanvasRefreshDependencies",
      );
    const requestId = (refreshCall?.[0] as { requestId?: string } | undefined)?.requestId;

    inbound({
      type: "afxMutationResult",
      requestId,
      outcome: "error",
      target: SOURCE,
      code: "capability-unavailable",
      message: "Canvas dependency refresh is unavailable in this Workbench host.",
      retryable: true,
    });

    expect(screen.queryByText("Refreshing dependencies…")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Canvas dependency refresh is unavailable in this Workbench host.",
    );
  });

  it("blocks autosave on an external conflict and reloads only when explicitly requested", async () => {
    vi.useFakeTimers();
    try {
      renderCanvas();
      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      expect(screen.getByText("Saving…")).toBeInTheDocument();

      const external = JSON.stringify({
        nodes: [
          {
            id: "external",
            type: "text",
            text: "External graph",
            x: 0,
            y: 0,
            width: 220,
            height: 120,
          },
        ],
        edges: [],
      });
      inbound({
        type: "afxCanvasDocument",
        document: documentSnapshot(external, descriptor("project", SOURCE.relativePath, "project")),
      });
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The file changed while this canvas had unsaved work",
      );
      expect(screen.getByText("Conflict")).toBeInTheDocument();

      await act(async () => vi.advanceTimersByTimeAsync(800));
      expect(
        postMessage.mock.calls.filter(
          (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
        ),
      ).toHaveLength(1);

      fireEvent.click(screen.getByRole("button", { name: "Reload external" }));
      expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("1");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Saved")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps dirty state until a revision-aware host save succeeds", async () => {
    vi.useFakeTimers();
    try {
      renderCanvas();
      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      expect(screen.getByText("Saving…")).toBeInTheDocument();
      const saveCall = postMessage.mock.calls.find(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );
      expect(saveCall?.[0]).toEqual(
        expect.objectContaining({
          type: "afxCanvasEdit",
          target: SOURCE,
          baseRevision: REVISION.contentRevision,
        }),
      );

      const save = saveCall?.[0] as
        { requestId: string; sessionId: string; sequence: number } | undefined;
      inbound({
        type: "afxCanvasEditResult",
        requestId: save?.requestId,
        sessionId: save?.sessionId,
        sequence: save?.sequence,
        outcome: "success",
        target: SOURCE,
        revision: {
          contentRevision: "project-revision-2",
          diskRevision: "project-revision-2",
          dirty: false,
        },
      });
      expect(screen.getByText("Saved")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never reports a source-less compatibility save as successful", () => {
    renderCanvasWithoutSource();

    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));

    expect(screen.getByText("Save failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("host provides a workspace file identity");
    expect(screen.getByTestId("canvas-node-count")).toHaveTextContent("2");
    expect(
      postMessage.mock.calls.some(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxSaveFile",
      ),
    ).toBe(false);
  });

  it("hands a Workbench edit to the host before an immediate tab unmount", () => {
    const view = renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    view.unmount();

    const edit = postMessage.mock.calls.find(
      (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
    )?.[0] as { type: string; sequence: number; documentId: string; content: string } | undefined;
    expect(edit).toEqual(
      expect.objectContaining({
        type: "afxCanvasEdit",
        sequence: 1,
        documentId: `${SOURCE.rootUri}::${SOURCE.relativePath}`,
      }),
    );
    expect(edit?.content).toContain("local-draft");
  });

  it("keeps the latest rapid edit pending until its sequence is acknowledged", () => {
    renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
    fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));

    const edits = postMessage.mock.calls
      .filter((call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit")
      .map(
        (call: unknown[]) => call[0] as { requestId: string; sessionId: string; sequence: number },
      );
    expect(edits.map((edit: { sequence: number }) => edit.sequence)).toEqual([1, 2]);

    inbound({
      type: "afxCanvasEditResult",
      requestId: edits[0]?.requestId,
      sessionId: edits[0]?.sessionId,
      sequence: 1,
      outcome: "success",
      target: SOURCE,
      revision: { contentRevision: "stream-r2", diskRevision: "stream-r2", dirty: true },
    });
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    inbound({
      type: "afxCanvasEditResult",
      requestId: edits[1]?.requestId,
      sessionId: edits[1]?.sessionId,
      sequence: 2,
      outcome: "success",
      target: SOURCE,
      revision: { contentRevision: "stream-r3", diskRevision: "stream-r3", dirty: true },
    });
    expect(screen.getByText("Editor has unsaved changes")).toBeInTheDocument();
  });

  it("uses the acknowledged revision for an immediate second save", async () => {
    vi.useFakeTimers();
    try {
      renderCanvas();
      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      const firstSave = postMessage.mock.calls.find(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );
      const first = firstSave?.[0] as
        { requestId: string; sessionId: string; sequence: number } | undefined;
      inbound({
        type: "afxCanvasEditResult",
        requestId: first?.requestId,
        sessionId: first?.sessionId,
        sequence: first?.sequence,
        outcome: "success",
        target: SOURCE,
        revision: {
          contentRevision: "acknowledged-r2",
          diskRevision: "acknowledged-r2",
          dirty: false,
        },
      });

      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      const saves = postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );

      expect(saves).toHaveLength(2);
      expect(saves[1]?.[0]).toEqual(expect.objectContaining({ baseRevision: "acknowledged-r2" }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a newer Workbench edit dirty and chains it after the in-flight save ack", async () => {
    vi.useFakeTimers();
    try {
      renderCanvas();
      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      const firstSave = postMessage.mock.calls.find(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );
      const firstMessage = firstSave?.[0] as
        { requestId: string; sessionId: string; sequence: number; content: string } | undefined;
      expect(firstMessage).toBeDefined();
      expect(screen.getByText("Saving…")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      inbound({
        type: "afxCanvasEditResult",
        requestId: firstMessage?.requestId,
        sessionId: firstMessage?.sessionId,
        sequence: firstMessage?.sequence,
        outcome: "success",
        target: SOURCE,
        revision: {
          contentRevision: "acknowledged-r2",
          diskRevision: "acknowledged-r2",
          dirty: false,
        },
      });

      expect(screen.getByText("Saving…")).toBeInTheDocument();
      const saves = postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );
      expect(saves).toHaveLength(2);
      expect(saves[1]?.[0]).toEqual(expect.objectContaining({ sequence: 2 }));
      expect((saves[1]?.[0] as { content: string }).content).not.toBe(firstMessage?.content);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a newer custom-editor edit dirty and chains it after the in-flight save ack", async () => {
    vi.useFakeTimers();
    try {
      const editorDocument = documentSnapshot(
        BASE_CANVAS,
        descriptor("project", SOURCE.relativePath, "project"),
      );
      render(
        <WorkbenchProvider initialState={{ isLoading: false, canvasEnabled: true }}>
          <CanvasApp editorClientId="editor-race" editorDocument={editorDocument} />
        </WorkbenchProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      const firstSave = postMessage.mock.calls.find(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );
      const firstMessage = firstSave?.[0] as
        { requestId: string; sessionId: string; sequence: number; content: string } | undefined;
      expect(firstMessage).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Mutate graph" }));
      inbound({
        type: "afxCanvasEditResult",
        requestId: firstMessage?.requestId,
        sessionId: firstMessage?.sessionId,
        sequence: firstMessage?.sequence,
        outcome: "success",
        target: SOURCE,
        revision: {
          contentRevision: "editor-ack-r2",
          diskRevision: "editor-ack-r2",
          dirty: true,
        },
      });

      expect(screen.getByText("Saving…")).toBeInTheDocument();
      const saves = postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type?: string }).type === "afxCanvasEdit",
      );
      expect(saves).toHaveLength(2);
      expect(saves[1]?.[0]).toEqual(expect.objectContaining({ sequence: 2 }));
      expect((saves[1]?.[0] as { content: string }).content).not.toBe(firstMessage?.content);
    } finally {
      vi.useRealTimers();
    }
  });

  function acknowledgeOperation(
    type: "afxCanvasCreate" | "afxCanvasRename" | "afxCanvasDuplicate",
    target: WorkbenchSourceIdentity,
  ): void {
    const call = [...postMessage.mock.calls]
      .reverse()
      .find((candidate: unknown[]) => (candidate[0] as { type?: string }).type === type);
    const requestId = (call?.[0] as { requestId?: string } | undefined)?.requestId;
    expect(requestId).toBeTruthy();
    inbound({
      type: "afxMutationResult",
      requestId,
      outcome: "success",
      target,
      revision: {
        contentRevision: `${type}-revision`,
        diskRevision: `${type}-revision`,
        dirty: false,
      },
    });
  }
});
