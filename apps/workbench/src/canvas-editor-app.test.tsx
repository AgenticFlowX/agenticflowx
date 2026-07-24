/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EDITOR-AREA]
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasDocumentSnapshot } from "@afx/shared";

import { CanvasEditorApp } from "./canvas-editor-app";
import { _resetBridgeForTest, initWorkbenchBridge } from "./lib/bridge";

const DOCUMENT: CanvasDocumentSnapshot = {
  documentId: "file:///workspace::.afx/project.canvas",
  descriptor: {
    id: "file:///workspace::.afx/project.canvas",
    kind: "project",
    label: "project",
    source: {
      rootUri: "file:///workspace",
      rootName: "workspace",
      relativePath: ".afx/project.canvas",
    },
    exists: true,
  },
  source: {
    rootUri: "file:///workspace",
    rootName: "workspace",
    relativePath: ".afx/project.canvas",
  },
  revision: { contentRevision: "revision-1", dirty: false },
  content: '{"nodes":[],"edges":[]}',
};

describe("CanvasEditorApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetBridgeForTest();
  });

  it("shows a non-destructive Settings recovery when the experiment is disabled", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(<CanvasEditorApp />);
    expect(screen.getByText("Opening Canvas…")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "afxCanvasEditorDocument",
            clientId: "pending",
            document: DOCUMENT,
            enabled: false,
          },
        }),
      );
    });

    expect(screen.getByRole("heading", { name: "AFX Canvas is experimental" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable in Settings" })).toBeInTheDocument();
    expect(screen.getByText(/file remains unchanged/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enable in Settings" }));
    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxOpenSettings", setting: "afx.experimental.canvas" },
      "*",
    );
  });
});
