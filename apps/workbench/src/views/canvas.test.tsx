/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-6] [FR-7] [FR-11] [FR-12] [FR-19] [FR-20]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Canvas from "./canvas";

const FILE_CANVAS = JSON.stringify({
  nodes: [
    {
      id: "n-file",
      type: "file",
      file: "docs/specs/demo/spec.md",
      x: 10,
      y: 20,
      width: 340,
      height: 220,
    },
    {
      id: "n-pdf",
      type: "file",
      file: "docs/brief.pdf",
      x: 400,
      y: 20,
      width: 260,
      height: 160,
    },
  ],
  edges: [],
});

const TEXT_EDGE_CANVAS = JSON.stringify({
  nodes: [
    {
      id: "n-a",
      type: "text",
      text: "First thought",
      x: 10,
      y: 20,
      width: 320,
      height: 170,
    },
    {
      id: "n-b",
      type: "text",
      text: "Second thought",
      x: 410,
      y: 20,
      width: 320,
      height: 170,
    },
  ],
  edges: [{ id: "e-1", fromNode: "n-a", toNode: "n-b", toEnd: "arrow" }],
});

const RENAME_CANVAS = JSON.stringify({
  nodes: [
    {
      id: "n-card",
      type: "text",
      text: "Card title\n\nKeep this body.",
      x: 10,
      y: 20,
      width: 320,
      height: 170,
    },
    {
      id: "n-note",
      type: "text",
      text: "# Note\n\nKeep this note body.",
      afxNodeKind: "note",
      color: "3",
      x: 360,
      y: 20,
      width: 320,
      height: 170,
    },
    {
      id: "n-box",
      type: "group",
      label: "Box",
      color: "5",
      x: 10,
      y: 240,
      width: 360,
      height: 220,
    },
    {
      id: "n-label",
      type: "text",
      text: "Label",
      afxNodeKind: "label",
      x: 420,
      y: 260,
      width: 180,
      height: 36,
    },
    {
      id: "n-file",
      type: "file",
      file: "docs/specs/demo/spec.md",
      x: 760,
      y: 20,
      width: 340,
      height: 220,
    },
  ],
  edges: [],
});

function renderCanvas(content = FILE_CANVAS) {
  return render(
    <WorkbenchProvider
      initialState={{
        isLoading: false,
        canvasEnabled: true,
        canvas: { path: ".afx/project.canvas", content, exists: true },
        documents: [
          {
            type: "SPEC",
            name: "Demo Spec",
            status: "Draft",
            owner: "@rix",
            filePath: "docs/specs/demo/spec.md",
          },
        ],
      }}
    >
      <Canvas />
    </WorkbenchProvider>,
  );
}

describe("Canvas", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    postMessage.mockRestore();
    _resetBridgeForTest();
  });

  it("fetches markdown file-node content through the bridge and renders the response", async () => {
    renderCanvas();

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        { type: "afxFetchDocContent", filePath: "docs/specs/demo/spec.md" },
        "*",
      );
    });
    expect(postMessage).not.toHaveBeenCalledWith(
      { type: "afxFetchDocContent", filePath: "docs/brief.pdf" },
      "*",
    );
    expect(screen.getByText("preview disabled for non-markdown files")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "afxDocContent",
            filePath: "docs/specs/demo/spec.md",
            content: "# Demo Spec\n\nMarkdown rendered inline.",
          },
        }),
      );
    });

    expect(await screen.findByText("Markdown rendered inline.")).toBeInTheDocument();
  });

  it("autosaves edits to .afx/project.canvas through the existing save bridge", async () => {
    renderCanvas(`{"nodes":[],"edges":[]}`);

    expect(screen.getByLabelText("Canvas save status saved")).toHaveTextContent(
      ".afx/project.canvas",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add text node" }));

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxSaveFile",
          path: ".afx/project.canvas",
        }),
        "*",
      );
    });
  });

  it("shows malformed canvas errors without autosaving over the file", () => {
    renderCanvas("{");

    expect(screen.getByText("Malformed canvas file")).toBeInTheDocument();
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxSaveFile" }),
      "*",
    );
  });

  it("prompts before applying external file changes over local dirty edits", async () => {
    renderCanvas(`{"nodes":[],"edges":[]}`);

    fireEvent.click(screen.getByRole("button", { name: "Add text node" }));
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "afxUpdate",
            canvasEnabled: true,
            canvas: {
              path: ".afx/project.canvas",
              exists: true,
              content:
                '{"nodes":[{"id":"external","type":"text","text":"External","x":0,"y":0,"width":200,"height":120}],"edges":[]}',
            },
          },
        }),
      );
    });

    expect(await screen.findByText("External canvas update available")).toBeInTheDocument();
  });

  it("edits edge labels from the pencil and labeled chip", async () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    fireEvent.click(screen.getByRole("button", { name: "Edit edge label Add label" }));
    const input = screen.getByLabelText("Edge label");
    fireEvent.change(input, { target: { value: "answers" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("button", { name: "Edit edge label answers" })).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Edit edge label answers" }));
    expect(screen.getByLabelText("Edge label")).toHaveValue("answers");
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxSaveFile",
          path: ".afx/project.canvas",
          content: expect.stringContaining('"label": "answers"'),
        }),
        "*",
      );
    });
  });

  it("deletes an edge from the edge controls", async () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Delete edge Add label" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Edit edge label Add label" }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxSaveFile",
          path: ".afx/project.canvas",
          content: expect.not.stringContaining('"e-1"'),
        }),
        "*",
      );
    });
  });

  it("double-clicks a text node into edit mode", async () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    fireEvent.doubleClick(screen.getByTestId("canvas-node-n-a"));
    const input = screen.getByLabelText("Edit text node");
    fireEvent.change(input, { target: { value: "Edited thought" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getAllByText("Edited thought").length).toBeGreaterThan(0);
    });
  });

  it("distinguishes text, note, label, and box nodes with connector handles", () => {
    const { container } = renderCanvas(`{"nodes":[],"edges":[]}`);

    fireEvent.click(screen.getByRole("button", { name: "Add text node" }));
    fireEvent.click(screen.getByRole("button", { name: "Add notepad node" }));
    fireEvent.click(screen.getByRole("button", { name: "Add label" }));
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));

    expect(container.querySelector('[data-node-kind="text"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-kind="note"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-kind="label"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-kind="group"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-icon="text"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-icon="note"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-icon="group"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-kind="text"]')).toHaveStyle({ zIndex: "10" });
    expect(container.querySelector('[data-node-kind="group"]')).toHaveStyle({ zIndex: "1" });
    expect(screen.queryByText("GROUP BOX")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Drag right connector" }).length).toBeGreaterThan(
      0,
    );
    const textNode = container.querySelector('[data-node-kind="text"]');
    expect(textNode).not.toBeNull();
    const textActions = (textNode as HTMLElement).querySelector('[data-node-actions="true"]');
    expect(textActions).toHaveClass("opacity-0");
    fireEvent.click(textNode as HTMLElement);
    expect(textActions).toHaveClass("opacity-100");
    const labelNode = container.querySelector('[data-node-kind="label"]');
    expect(labelNode).not.toBeNull();
    expect(
      within(labelNode as HTMLElement).queryByRole("button", {
        name: "Send node to chat",
      }),
    ).not.toBeInTheDocument();
    const labelTitle = within(labelNode as HTMLElement).getByRole("button", {
      name: "Rename node label Label",
    });
    expect(labelTitle).toHaveStyle({ fontSize: "15px", lineHeight: "17px" });
    expect(labelNode).toHaveClass("border-transparent");
    expect(labelNode).toHaveClass("bg-transparent");
    expect(labelNode).toHaveClass("shadow-none");
    expect(labelNode).not.toHaveClass("shadow-sm");
  });

  it("pans with modified wheel gestures without stealing nested markdown scroll", () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    const surface = screen.getByTestId("canvas-surface");
    expect(readCanvasTransform()).toEqual({ x: 56, y: 44, zoom: 1 });

    fireEvent.wheel(surface, { shiftKey: true, deltaY: 80 });
    expect(readCanvasTransform()).toEqual({ x: -24, y: 44, zoom: 1 });

    fireEvent.wheel(surface, { metaKey: true, shiftKey: true, deltaY: 30 });
    expect(readCanvasTransform()).toEqual({ x: -24, y: 14, zoom: 1 });

    fireEvent.wheel(surface, { deltaY: -100 });
    expect(readCanvasTransform()).toEqual({ x: -24, y: 14, zoom: 1.08 });

    const beforeNestedWheel = screen.getByTestId("canvas-world").getAttribute("style");
    const scrollable = screen
      .getByTestId("canvas-node-n-a")
      .querySelector('[data-canvas-scrollable="true"]');
    expect(scrollable).not.toBeNull();
    fireEvent.wheel(scrollable as HTMLElement, { shiftKey: true, deltaY: 120 });
    expect(screen.getByTestId("canvas-world").getAttribute("style")).toBe(beforeNestedWheel);
  });

  it("renames card, note, label, and box labels inline while leaving file nodes read-only", async () => {
    const { container } = renderCanvas(RENAME_CANVAS);

    renameNodeLabel("n-card", "Architecture card");
    renameNodeLabel("n-note", "Decision note");
    renameNodeLabel("n-label", "Milestone");
    renameNodeLabel("n-box", "Sprint frame");

    expect(
      within(screen.getByTestId("canvas-node-n-card")).getByRole("button", {
        name: "Rename node label Architecture card",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("canvas-node-n-note")).getByRole("button", {
        name: "Rename node label Decision note",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("canvas-node-n-label")).getByRole("button", {
        name: "Rename node label Milestone",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("canvas-node-n-box")).getByRole("button", {
        name: "Rename node label Sprint frame",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep this body.")).toBeInTheDocument();
    expect(screen.getByText("Keep this note body.")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("canvas-node-n-file")).queryByRole("button", {
        name: "Rename node label",
      }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('[data-node-icon="file"]')).toBeInTheDocument();

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "afxSaveFile",
          path: ".afx/project.canvas",
          content: expect.stringContaining('"label": "Sprint frame"'),
        }),
        "*",
      );
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxSaveFile",
        path: ".afx/project.canvas",
        content: expect.stringContaining('"afxNodeKind": "label"'),
      }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxSaveFile",
        path: ".afx/project.canvas",
        content: expect.stringContaining("# Decision note\\n\\nKeep this note body."),
      }),
      "*",
    );
  });

  it("adds markdown nodes from typed paths and browse picks", async () => {
    renderCanvas(`{"nodes":[],"edges":[]}`);

    fireEvent.click(screen.getByRole("button", { name: "Open markdown document picker" }));
    fireEvent.change(screen.getByLabelText("Markdown path for file node"), {
      target: { value: "../docs/ideas.md" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add file node" }));

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        { type: "afxFetchDocContent", filePath: "../docs/ideas.md" },
        "*",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Open markdown document picker" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse markdown file" }));
    expect(postMessage).toHaveBeenCalledWith({ type: "afxPickMarkdownFile" }, "*");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "afxMarkdownFilePicked",
            filePath: "/Users/rix/notes/idea.md",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        { type: "afxFetchDocContent", filePath: "/Users/rix/notes/idea.md" },
        "*",
      );
    });
  });

  it("sends a node to chat from the node footer without draft insertion", async () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    const sendButton = within(screen.getByTestId("canvas-node-n-a")).getByRole("button", {
      name: "Send node to chat",
    });
    fireEvent.click(sendButton);

    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxOpenChatCommand", command: "First thought", mode: "send" },
      "*",
    );
  });

  it("enables toolbar chat context only for two or more selected nodes", async () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    const batchButton = screen.getByRole("button", {
      name: "Send selected canvas context to chat",
    });
    expect(batchButton).toBeDisabled();

    fireEvent.click(
      within(screen.getByTestId("canvas-node-n-a")).getByRole("button", {
        name: "Add node to selection",
      }),
    );
    expect(batchButton).toBeDisabled();

    fireEvent.click(
      within(screen.getByTestId("canvas-node-n-b")).getByRole("button", {
        name: "Add node to selection",
      }),
    );
    expect(batchButton).not.toBeDisabled();
    expect(batchButton).toHaveTextContent("Chat 2");
    fireEvent.click(batchButton);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "First thought\n\n---\n\nSecond thought",
        mode: "send",
      },
      "*",
    );
  });

  it("supports ctrl-click additive selection for canvas cards", async () => {
    renderCanvas(TEXT_EDGE_CANVAS);

    const batchButton = screen.getByRole("button", {
      name: "Send selected canvas context to chat",
    });
    fireEvent.click(screen.getByTestId("canvas-node-n-a"));
    fireEvent.click(screen.getByTestId("canvas-node-n-b"), { ctrlKey: true });

    expect(batchButton).not.toBeDisabled();
    expect(batchButton).toHaveTextContent("Chat 2");
  });
});

function renameNodeLabel(nodeId: string, value: string) {
  const node = within(screen.getByTestId(`canvas-node-${nodeId}`));
  fireEvent.click(node.getByRole("button", { name: "Rename node label" }));
  const input = node.getByLabelText("Rename node label");
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function readCanvasTransform(): { x: number; y: number; zoom: number } {
  const style = screen.getByTestId("canvas-world").getAttribute("style") ?? "";
  const match =
    /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\) scale\((\d+(?:\.\d+)?)\)/.exec(style);
  if (!match) throw new Error(`Unable to read canvas transform from ${style}`);
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    zoom: Number(match[3]),
  };
}
