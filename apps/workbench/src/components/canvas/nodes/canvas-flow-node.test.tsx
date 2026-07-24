/**
 * Referenced Markdown delivery starts only when React Flow mounts a file node.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-12] [NFR-2]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-FILES]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CanvasFileNode, CanvasLinkNode, CanvasNode } from "@afx/shared";

import {
  CanvasFlowNode,
  type CanvasFlowNodeData,
  type CanvasNodePreview,
} from "./canvas-flow-node";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  NodeResizer: () => null,
  NodeToolbar: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
}));

vi.mock("../afx-actions", () => ({
  CanvasRunActionButton: () => <button type="button">Run AFX action</button>,
}));

function fileNode(file: string): CanvasFileNode {
  return { id: "file", type: "file", file, x: 0, y: 0, width: 280, height: 140 };
}

function data(
  node: CanvasNode,
  onFileContentMount: CanvasFlowNodeData["onFileContentMount"] = vi.fn(),
  preview?: CanvasNodePreview,
): CanvasFlowNodeData {
  return {
    canvasNode: node,
    preview,
    onUpdate: vi.fn(),
    onAction: vi.fn(),
    onRunCanvasAction: vi.fn(),
    onFileContentMount,
  };
}

function flowProps(node: CanvasNode, nodeData: CanvasFlowNodeData, selected = false) {
  return { id: node.id, data: nodeData, selected } as unknown as React.ComponentProps<
    typeof CanvasFlowNode
  >;
}

describe("CanvasFlowNode foreign node fallback", () => {
  it("renders a preserved fallback card for a foreign node type instead of crashing", () => {
    // Permissive parse admits foreign types with geometry only — no `text`.
    const foreign = {
      id: "video",
      type: "video",
      url: "https://example.com/demo.mp4",
      x: 0,
      y: 0,
      width: 280,
      height: 140,
    } as unknown as CanvasNode;
    render(<CanvasFlowNode {...flowProps(foreign, data(foreign))} />);

    expect(screen.getByText("video")).toBeInTheDocument();
    expect(screen.getByText(/Unsupported node type/)).toBeInTheDocument();
    expect(screen.getByText(/preserved/)).toBeInTheDocument();
  });
});

describe("CanvasFlowNode referenced Markdown lifecycle", () => {
  it("requests .markdown content on mount and unregisters on unmount", () => {
    const cleanup = vi.fn();
    const onFileContentMount = vi.fn(() => cleanup);
    const node = fileNode("docs/architecture.markdown");
    const view = render(<CanvasFlowNode {...flowProps(node, data(node, onFileContentMount))} />);

    expect(onFileContentMount).toHaveBeenCalledOnce();
    expect(onFileContentMount).toHaveBeenCalledWith(node);
    view.unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("requests general file content on mount", () => {
    const onFileContentMount = vi.fn();
    const node = fileNode("docs/architecture.pdf");
    render(<CanvasFlowNode {...flowProps(node, data(node, onFileContentMount))} />);

    expect(onFileContentMount).toHaveBeenCalledWith(node);
  });

  it.each([
    {
      name: "Markdown",
      node: fileNode("docs/architecture.md"),
      preview: {
        state: "ready",
        payload: { kind: "markdown", state: "ready", content: "# Rendered architecture" },
      },
      expected: "Rendered architecture",
    },
    {
      name: "general file",
      node: fileNode("src/architecture.ts"),
      preview: {
        state: "ready",
        payload: { kind: "file", state: "ready", excerpt: "export const map = true;" },
      },
      expected: "export const map = true;",
    },
    {
      name: "Notes",
      node: fileNode(".afx/notes.md"),
      preview: {
        state: "ready",
        payload: {
          kind: "notes",
          state: "ready",
          summary: { totalNotes: 1, items: [{ timestamp: "2026-07-19", text: "Plan launch" }] },
        },
      },
      expected: "Plan launch",
    },
    {
      name: "Board",
      node: fileNode(".afx/kanban/roadmap.md"),
      preview: {
        state: "ready",
        payload: {
          kind: "board",
          state: "ready",
          summary: {
            totalColumns: 1,
            totalCards: 1,
            columns: [{ title: "Next", cardCount: 1, items: ["Ship preview"] }],
          },
        },
      },
      expected: "Ship preview",
    },
  ] as const)("renders a ready $name preview", ({ node, preview, expected }) => {
    render(<CanvasFlowNode {...flowProps(node, data(node, vi.fn(), preview))} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    [".afx/notes.md", "Open Notes file", "Preview Notes"],
    [".afx/kanban/roadmap.md", "Open Board file", "Preview Board"],
    ["docs/architecture.md", "Open source", "Rendered preview"],
  ])("names %s inspection actions for the attached artifact", (path, openLabel, previewLabel) => {
    const node = fileNode(path);
    const nodeData = data(node);
    render(<CanvasFlowNode {...flowProps(node, nodeData, true)} />);

    fireEvent.click(screen.getByRole("button", { name: openLabel }));
    fireEvent.click(screen.getByRole("button", { name: previewLabel }));
    expect(nodeData.onAction).toHaveBeenCalledWith("file", "open");
    expect(nodeData.onAction).toHaveBeenCalledWith("file", "preview");
  });

  it("renders only the host-approved resource for a validated local image", () => {
    const node = fileNode("assets/architecture.png");
    render(
      <CanvasFlowNode
        {...flowProps(
          node,
          data(node, vi.fn(), {
            state: "ready",
            payload: {
              kind: "image",
              state: "ready",
              mediaType: "image/png",
              resourceUri: "vscode-webview://canvas/assets/architecture.png",
            },
          }),
        )}
      />,
    );

    expect(screen.getByRole("img", { name: "architecture.png" })).toHaveAttribute(
      "src",
      "vscode-webview://canvas/assets/architecture.png",
    );
  });

  it("renders image fit, alt text, and caption from valid inert presentation metadata", () => {
    const node = {
      ...fileNode("assets/architecture.png"),
      afxMedia: {
        version: 1,
        fit: "cover",
        alt: "Architecture dependency map",
        caption: "Release topology",
      },
    } as CanvasFileNode;
    render(
      <CanvasFlowNode
        {...flowProps(
          node,
          data(node, vi.fn(), {
            state: "ready",
            payload: {
              kind: "image",
              state: "ready",
              resourceUri: "vscode-webview://canvas/assets/architecture.png",
            },
          }),
        )}
      />,
    );

    expect(screen.getByRole("img", { name: "Architecture dependency map" })).toHaveClass(
      "object-cover",
    );
    expect(screen.getByText("Release topology")).toBeInTheDocument();
  });

  it("keeps malformed image metadata inert and does not render remote URL artwork", () => {
    const malformed = {
      ...fileNode("assets/architecture.png"),
      afxMedia: { version: 2, fit: "stretch", alt: "Ignored", caption: "Ignored" },
    } as CanvasFileNode;
    const view = render(
      <CanvasFlowNode
        {...flowProps(
          malformed,
          data(malformed, vi.fn(), {
            state: "ready",
            payload: {
              kind: "image",
              state: "ready",
              resourceUri: "vscode-webview://canvas/assets/architecture.png",
            },
          }),
        )}
      />,
    );

    expect(screen.getByRole("img", { name: "architecture.png" })).toHaveClass("object-contain");
    expect(screen.queryByText("Ignored")).not.toBeInTheDocument();

    const link: CanvasLinkNode = {
      id: "link",
      type: "link",
      url: "https://example.com/architecture",
      x: 0,
      y: 0,
      width: 280,
      height: 140,
    };
    view.rerender(
      <CanvasFlowNode
        {...flowProps(
          link,
          data(link, vi.fn(), {
            state: "ready",
            payload: {
              state: "ready",
              finalUrl: link.url,
              metadata: {
                title: "Architecture",
                imageUrl: "https://remote.example/tracker.png",
              },
            },
          }),
        )}
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("offers image presentation controls only for a selected approved image preview", () => {
    const node = fileNode("assets/architecture.png");
    const preview: CanvasNodePreview = {
      state: "ready",
      payload: {
        kind: "image",
        state: "ready",
        resourceUri: "vscode-webview://canvas/assets/architecture.png",
      },
    };
    const view = render(<CanvasFlowNode {...flowProps(node, data(node, vi.fn(), preview))} />);

    expect(
      screen.queryByRole("button", { name: "Edit image presentation" }),
    ).not.toBeInTheDocument();
    view.rerender(<CanvasFlowNode {...flowProps(node, data(node, vi.fn(), preview), true)} />);
    expect(screen.getByRole("button", { name: "Edit image presentation" })).toBeVisible();

    const markdown = fileNode("docs/architecture.md");
    view.rerender(
      <CanvasFlowNode
        {...flowProps(
          markdown,
          data(markdown, vi.fn(), {
            state: "ready",
            payload: { kind: "markdown", state: "ready", content: "# Architecture" },
          }),
          true,
        )}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Edit image presentation" }),
    ).not.toBeInTheDocument();
  });

  it("preserves stale content while showing refresh state", () => {
    const node = fileNode("docs/architecture.md");
    render(
      <CanvasFlowNode
        {...flowProps(
          node,
          data(node, vi.fn(), {
            state: "stale",
            payload: { kind: "markdown", state: "ready", content: "# Last good map" },
          }),
        )}
      />,
    );

    expect(screen.getByText("Last good map")).toBeInTheDocument();
    expect(screen.getByText("Refreshing…")).toBeInTheDocument();
  });

  it.each([
    ["loading", "Loading preview…"],
    ["missing", "Source file is missing."],
    ["blocked", "Preview blocked by policy."],
    ["error", "Preview failed."],
  ] as const)("renders the %s state", (state, message) => {
    const node = fileNode("docs/architecture.md");
    render(
      <CanvasFlowNode
        {...flowProps(
          node,
          data(node, vi.fn(), {
            state,
            ...(state === "loading" ? {} : { payload: { kind: "markdown", state, message } }),
          }),
        )}
      />,
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("loads URL metadata only from an explicit action and keeps Open URL separate", () => {
    const node: CanvasLinkNode = {
      id: "link",
      type: "link",
      url: "https://example.com/architecture",
      x: 0,
      y: 0,
      width: 280,
      height: 140,
    };
    const onAction = vi.fn();
    const nodeData = data(node);
    nodeData.onAction = onAction;
    render(<CanvasFlowNode {...flowProps(node, nodeData, true)} />);

    fireEvent.click(screen.getByRole("button", { name: "Load URL preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Open URL" }));

    expect(onAction).toHaveBeenCalledWith("link", "loadPreview");
    expect(onAction).toHaveBeenCalledWith("link", "open");
  });

  it("projects safe semantic styling and compact locked, pinned, and lane affordances", () => {
    const node = {
      id: "service",
      type: "text",
      text: "Architecture service",
      x: 0,
      y: 0,
      width: 280,
      height: 140,
      afxStyle: { shape: "component", density: "compact", typography: "mono", icon: "server" },
      afxLayout: { locked: true, pinned: true, lane: "Platform" },
    } as unknown as CanvasNode;
    render(<CanvasFlowNode {...flowProps(node, data(node), true)} />);

    expect(screen.getByTestId("react-flow-canvas-node-service")).toHaveClass(
      "rounded-sm",
      "border-double",
    );
    expect(screen.getByTestId("canvas-node-body-service")).toHaveClass(
      "p-1",
      "text-[10px]",
      "font-mono",
    );
    expect(document.querySelector('[data-canvas-icon="server"]')).toBeInTheDocument();
    expect(screen.getByLabelText("Locked")).toBeInTheDocument();
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("renders colored collapsed groups without exposing AFX actions outside the AFX profile", () => {
    const group: CanvasNode = {
      id: "system",
      type: "group",
      label: "System context",
      x: 0,
      y: 0,
      width: 700,
      height: 400,
      color: "5",
      background: "assets/context.png",
      afxGroup: { version: 1, collapsed: true },
    };
    const essentials = data(group);
    essentials.showCanvasActions = false;
    const view = render(<CanvasFlowNode {...flowProps(group, essentials, true)} />);

    expect(screen.getByText("Collapsed frame")).toBeInTheDocument();
    expect(screen.getByText("assets/context.png")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run AFX action" })).not.toBeInTheDocument();
    expect(screen.getByTestId("react-flow-canvas-node-system")).toHaveStyle({
      borderLeftColor: "#06b6d4",
    });

    const afx = data(group);
    afx.showCanvasActions = true;
    view.rerender(<CanvasFlowNode {...flowProps(group, afx, true)} />);
    expect(screen.getByRole("button", { name: "Run AFX action" })).toBeInTheDocument();
  });
});
