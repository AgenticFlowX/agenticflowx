/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-5] [FR-8] [FR-9]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import {
  addFileNode,
  addGroupNode,
  addLabelNode,
  addTextNode,
  connectNodes,
  deleteEdge,
  deleteNode,
  moveNode,
  parsePointFromViewport,
  renameNode,
  resizeNode,
  retargetEdge,
  updateEdgeLabel,
  updateNodeColor,
  updateTextNode,
} from "./use-canvas-model";

describe("canvas model mutations", () => {
  it("adds text and file nodes in JSON Canvas shape", () => {
    const withText = addTextNode({ nodes: [], edges: [] }, { x: 10.4, y: 20.7 }, "Idea", "n-1");
    const withFile = addFileNode(withText, "docs/spec.md", { x: 90, y: 110 }, "n-2");

    expect(withFile.nodes).toMatchObject([
      { id: "n-1", type: "text", text: "Idea", x: 10, y: 21 },
      { id: "n-2", type: "file", file: "docs/spec.md", x: 90, y: 110 },
    ]);
  });

  it("adds notepad-style text nodes, group boxes, and node colors", () => {
    const withNote = addTextNode(
      { nodes: [], edges: [] },
      { x: 10, y: 20 },
      "# Note\n\n",
      "n-note",
      "3",
      "note",
    );
    const withBox = addGroupNode(withNote, { x: 80, y: 100 }, "Box", "n-box", "5");
    const colored = updateNodeColor(withBox, ["n-note", "n-box"], "6");

    expect(withBox.nodes).toMatchObject([
      { id: "n-note", type: "text", text: "# Note\n\n", color: "3", afxNodeKind: "note" },
      { id: "n-box", type: "group", label: "Box", color: "5" },
    ]);
    expect(colored.nodes).toMatchObject([
      { id: "n-note", color: "6" },
      { id: "n-box", color: "6" },
    ]);
  });

  it("adds compact label nodes and preserves label resize bounds", () => {
    const withLabel = addLabelNode(
      { nodes: [], edges: [] },
      { x: 12.4, y: 24.6 },
      "Milestone",
      "n-label",
      "4",
    );
    const resized = resizeNode(withLabel, "n-label", { width: 12, height: 12 });

    expect(withLabel.nodes).toMatchObject([
      {
        id: "n-label",
        type: "text",
        text: "Milestone",
        x: 12,
        y: 25,
        width: 180,
        height: 36,
        color: "4",
        afxNodeKind: "label",
      },
    ]);
    expect(resized.nodes?.[0]).toMatchObject({ width: 80, height: 28 });
  });

  it("moves, resizes, and updates text nodes without touching edges", () => {
    const canvas = connectNodes(
      addTextNode({ nodes: [], edges: [] }, { x: 0, y: 0 }, "Old", "n-1"),
      "n-1",
      "n-2",
      "",
      "e-1",
    );
    const moved = moveNode(canvas, "n-1", { x: 11.8, y: 12.2 });
    const resized = resizeNode(moved, "n-1", { width: 50, height: 40 });
    const updated = updateTextNode(resized, "n-1", "New");

    expect(updated.nodes?.[0]).toMatchObject({
      text: "New",
      x: 12,
      y: 12,
      width: 180,
      height: 110,
    });
    expect(updated.edges).toEqual(canvas.edges);
  });

  it("renames card, note, and box labels without rewriting markdown bodies", () => {
    const base = addGroupNode(
      addTextNode(
        addTextNode(
          addFileNode(
            { nodes: [], edges: [] },
            "docs/specs/demo/spec.md",
            { x: 640, y: 20 },
            "n-file",
          ),
          { x: 0, y: 0 },
          "Card title\n\nKeep this body.",
          "n-card",
        ),
        { x: 320, y: 0 },
        "# Note\n\nKeep this note body.",
        "n-note",
        "3",
        "note",
      ),
      { x: 0, y: 240 },
      "Box",
      "n-box",
    );
    const renamedCard = renameNode(base, "n-card", "Architecture card");
    const renamedNote = renameNode(renamedCard, "n-note", "Decision note");
    const renamedBox = renameNode(renamedNote, "n-box", "Sprint frame");
    const afterReadOnlyFile = renameNode(renamedBox, "n-file", "Should not rename");

    expect(afterReadOnlyFile.nodes).toMatchObject([
      { id: "n-file", type: "file", file: "docs/specs/demo/spec.md" },
      { id: "n-card", type: "text", text: "Architecture card\n\nKeep this body." },
      {
        id: "n-note",
        type: "text",
        text: "# Decision note\n\nKeep this note body.",
        afxNodeKind: "note",
      },
      { id: "n-box", type: "group", label: "Sprint frame" },
    ]);
  });

  it("connects, labels, and deletes nodes with attached edges", () => {
    const base = addTextNode(
      addTextNode({ nodes: [], edges: [] }, { x: 0, y: 0 }, "A", "n-a"),
      { x: 200, y: 0 },
      "B",
      "n-b",
    );
    const connected = connectNodes(base, "n-a", "n-b", "relates_to", "e-1");
    const labeled = updateEdgeLabel(connected, "e-1", "answers");
    const removed = deleteNode(labeled, "n-a");

    expect(labeled.edges?.[0]).toMatchObject({
      id: "e-1",
      fromNode: "n-a",
      fromSide: "right",
      toNode: "n-b",
      toSide: "left",
      label: "answers",
      toEnd: "arrow",
    });
    expect(removed.nodes?.map((node) => node.id)).toEqual(["n-b"]);
    expect(removed.edges).toEqual([]);
  });

  it("deletes and retargets edges without collapsing parallel connections", () => {
    const base = addTextNode(
      addTextNode(
        addTextNode({ nodes: [], edges: [] }, { x: 0, y: 0 }, "A", "n-a"),
        { x: 260, y: 0 },
        "B",
        "n-b",
      ),
      { x: 260, y: 240 },
      "C",
      "n-c",
    );
    const first = connectNodes(base, "n-a", "n-b", "first", "e-1");
    const second = connectNodes(first, "n-a", "n-b", "second", "e-2");
    const retargeted = retargetEdge(second, "e-2", "to", "n-c");
    const deleted = deleteEdge(retargeted, "e-1");

    expect(second.edges).toHaveLength(2);
    expect(retargeted.edges).toMatchObject([
      { id: "e-1", fromNode: "n-a", toNode: "n-b" },
      { id: "e-2", fromNode: "n-a", toNode: "n-c", label: "second" },
    ]);
    expect(deleted.edges).toMatchObject([{ id: "e-2", toNode: "n-c" }]);
  });

  it("maps viewport points into world coordinates using pan and zoom", () => {
    expect(parsePointFromViewport({ x: 220, y: 120 }, { x: 20, y: 20 }, 2)).toEqual({
      x: 100,
      y: 50,
    });
  });
});
