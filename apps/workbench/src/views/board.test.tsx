/**
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-7]
 * @see docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-BOARD-COLUMN] [DES-BOARD-SAVE]
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { KanbanBoard } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest } from "../lib/bridge";
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

function renderBoard() {
  return render(
    <WorkbenchProvider
      initialState={{ isLoading: false, kanban: { boards: [BOARD], dirPath: ".afx/kanban" } }}
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

  it("exposes editor and preview actions for the selected board file", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: "Open in editor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in preview" })).toBeInTheDocument();
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
