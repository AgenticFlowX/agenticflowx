/**
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-7] [FR-10]
 * @see docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-BOARD-COLUMN] [DES-BOARD-SAVE] [DES-BOARD-EMPTY]
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KanbanBoard } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Board from "./board";

const BOARD: KanbanBoard = {
  name: "Roadmap",
  filePath: ".afx/kanban/roadmap.md",
  rawContent: "# Roadmap\n\n## Todo\n\n## Done\n",
  meta: { title: "Roadmap", status: "active" },
  columns: [
    { title: "Todo", cards: [] },
    { title: "Done", cards: [] },
  ],
};

const DUPLICATE_BOARD: KanbanBoard = {
  name: "Duplicates",
  filePath: ".afx/kanban/duplicates.md",
  rawContent: "# Duplicates\n\n## Todo\n\n## Todo\n\n## Done\n",
  meta: { title: "Duplicates", status: "active" },
  columns: [
    { title: "Todo", cards: [{ text: "Repeated card" }] },
    { title: "Todo", cards: [{ text: "Repeated card" }] },
    { title: "Done", cards: [] },
  ],
};

function renderBoard(board: KanbanBoard = BOARD) {
  return render(
    <WorkbenchProvider
      initialState={{ isLoading: false, kanban: { boards: [board], dirPath: ".afx/kanban" } }}
    >
      <Board />
    </WorkbenchProvider>,
  );
}

describe("Board", () => {
  afterEach(() => {
    _resetBridgeForTest();
  });

  it("moves columns immediately with explicit controls", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.click(screen.getByRole("button", { name: "Move Todo column right" }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(["Done", "Todo"]);
    });
  });

  it("keeps duplicate column titles stable while moving columns", async () => {
    const user = userEvent.setup();
    renderBoard(DUPLICATE_BOARD);

    const secondMoveRight = screen.getAllByRole("button", { name: "Move Todo column right" })[1];
    if (!secondMoveRight) throw new Error("Expected duplicate Todo move-right button");
    await user.click(secondMoveRight);

    await waitFor(() => {
      expect(
        screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(["Todo", "Done", "Todo"]);
    });
    expect(screen.getAllByText("Repeated card")).toHaveLength(2);
  });

  it("exposes editor and preview actions for the selected board file", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: "Open in editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in preview" })).toBeInTheDocument();
  });

  it("explains empty boards and creates named markdown boards", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();

    render(
      <WorkbenchProvider
        initialState={{ isLoading: false, kanban: { boards: [], dirPath: ".afx/kanban" } }}
      >
        <Board />
      </WorkbenchProvider>,
    );

    expect(screen.getByText("Make as many markdown boards as the work needs")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Roadmap/i }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxCreateKanbanBoard", name: "Roadmap" },
      "*",
    );
    postMessage.mockRestore();
  });

  it("adds cards optimistically before host refresh", async () => {
    renderBoard();

    fireEvent.change(screen.getByLabelText("Add card to Todo"), {
      target: { value: "Write release notes" },
    });
    fireEvent.keyDown(screen.getByLabelText("Add card to Todo"), { key: "Enter" });

    expect(await screen.findByText("Write release notes")).toBeInTheDocument();
  });
});
