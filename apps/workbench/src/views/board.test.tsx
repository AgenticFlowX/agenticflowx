/**
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-7] [FR-10]
 * @see docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-BOARD-COLUMN] [DES-BOARD-SAVE] [DES-BOARD-EMPTY]
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const LIVE_BOARD: KanbanBoard = {
  ...BOARD,
  source: {
    rootUri: "file:///workspace",
    rootName: "workspace",
    relativePath: ".afx/kanban/roadmap.md",
  },
  revision: {
    contentRevision: "revision-1",
    diskRevision: "revision-1",
    dirty: false,
  },
  scanGeneration: 1,
  columns: [
    { id: "todo", title: "Todo", cards: [] },
    { id: "done", title: "Done", cards: [] },
  ],
};

function renderBoard(board: KanbanBoard = BOARD) {
  initWorkbenchBridge();
  return render(
    <WorkbenchProvider
      initialState={{ isLoading: false, kanban: { boards: [board], dirPath: ".afx/kanban" } }}
    >
      <Board />
    </WorkbenchProvider>,
  );
}

function dispatchInbound(data: unknown): void {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

describe("Board", () => {
  afterEach(() => {
    _resetBridgeForTest();
    vi.unstubAllGlobals();
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

  it("sends revision-aware board mutations and settles only from a matching result", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderBoard(LIVE_BOARD);

    await userEvent.type(screen.getByLabelText("Add card to Todo"), "Release notes");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Release notes")).toBeInTheDocument();
    const mutation = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxMutateKanbanBoard",
    )?.[0] as
      | {
          type: string;
          requestId: string;
          expectedRevision: string;
          mutation: { kind: string; columnId: string; text: string };
        }
      | undefined;
    expect(mutation).toMatchObject({
      type: "afxMutateKanbanBoard",
      expectedRevision: "revision-1",
      mutation: { kind: "addCard", columnId: "todo", text: "Release notes" },
    });
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: "stale-result",
        outcome: "error",
        target: LIVE_BOARD.source,
        code: "write-failed",
        message: "stale",
        retryable: true,
      });
    });
    expect(screen.queryByText("stale")).not.toBeInTheDocument();

    if (!mutation) throw new Error("Expected a board mutation message");
    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: mutation.requestId,
        outcome: "success",
        target: LIVE_BOARD.source,
        revision: {
          contentRevision: "revision-2",
          diskRevision: "revision-2",
          dirty: false,
        },
      });
    });
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    act(() => {
      dispatchInbound({
        type: "afxUpdate",
        kanban: {
          dirPath: ".afx/kanban",
          boards: [
            {
              ...LIVE_BOARD,
              revision: {
                contentRevision: "revision-2",
                diskRevision: "revision-2",
                dirty: false,
              },
              scanGeneration: 2,
              columns: [
                {
                  id: "todo",
                  title: "Todo",
                  cards: [{ id: "release", text: "Release notes" }],
                },
                { id: "done", title: "Done", cards: [] },
              ],
            },
          ],
        },
      });
    });
    await waitFor(() => expect(screen.queryByText("Saving…")).not.toBeInTheDocument());
    expect(screen.getByText("Release notes")).toBeInTheDocument();
    postMessage.mockRestore();
  });

  it("sends typed lifecycle requests with canonical root identity and expected revisions", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderBoard(LIVE_BOARD);

    await user.click(screen.getByRole("button", { name: "New board" }));
    await user.type(screen.getByRole("textbox", { name: "New board name" }), "Release Train");
    await user.click(screen.getByRole("button", { name: "Create board" }));
    const create = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxCreateKanbanBoard",
    )?.[0];
    expect(create).toMatchObject({
      type: "afxCreateKanbanBoard",
      name: "Release Train",
      targetRootUri: "file:///workspace",
      requestId: expect.stringMatching(/^board-create-/),
    });

    const createRequestId = (create as { requestId: string }).requestId;
    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: createRequestId,
        outcome: "success",
        target: {
          ...LIVE_BOARD.source,
          relativePath: ".afx/kanban/release-train.md",
        },
        revision: { contentRevision: "created", diskRevision: "created", dirty: false },
      });
    });

    await user.click(screen.getByRole("button", { name: "Rename board" }));
    const renameInput = screen.getByRole("textbox", { name: "New board name" });
    await user.clear(renameInput);
    await user.type(renameInput, "Delivery Plan");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const rename = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxRenameKanbanBoard",
    )?.[0];
    expect(rename).toMatchObject({
      type: "afxRenameKanbanBoard",
      name: "Delivery Plan",
      target: LIVE_BOARD.source,
      expectedRevision: "revision-1",
      requestId: expect.stringMatching(/^board-rename-/),
    });

    const renameRequestId = (rename as { requestId: string }).requestId;
    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: renameRequestId,
        outcome: "success",
        target: { ...LIVE_BOARD.source, relativePath: ".afx/kanban/delivery-plan.md" },
        revision: { contentRevision: "renamed", diskRevision: "renamed", dirty: false },
      });
    });

    await user.click(screen.getByRole("button", { name: "Delete board" }));
    await user.click(screen.getByRole("button", { name: "Delete board" }));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxDeleteKanbanBoard",
        target: LIVE_BOARD.source,
        expectedRevision: "revision-1",
        requestId: expect.stringMatching(/^board-delete-/),
      }),
      "*",
    );
    postMessage.mockRestore();
  });

  it("settles lifecycle failures only from the matching structured result", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderBoard(LIVE_BOARD);

    await userEvent.click(screen.getByRole("button", { name: "Rename board" }));
    const renameInput = screen.getByRole("textbox", { name: "New board name" });
    await userEvent.clear(renameInput);
    await userEvent.type(renameInput, "Delivery Plan");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const request = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxRenameKanbanBoard",
    )?.[0] as { requestId?: string } | undefined;
    if (!request?.requestId) throw new Error("Expected typed rename request");
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: "other-lifecycle",
        outcome: "error",
        target: LIVE_BOARD.source,
        code: "write-failed",
        message: "Ignore this result",
        retryable: true,
      });
    });
    expect(screen.queryByText("Ignore this result")).not.toBeInTheDocument();

    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: request.requestId,
        outcome: "conflict",
        target: LIVE_BOARD.source,
        code: "stale-revision",
        message: "Board changed before rename.",
        revision: {
          contentRevision: "external",
          diskRevision: "external",
          dirty: false,
        },
        retryable: true,
      });
    });
    expect(await screen.findByText("Board changed before rename.")).toBeInTheDocument();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
    postMessage.mockRestore();
  });

  it("locks visual writes for unsaved editor content", () => {
    renderBoard({
      ...LIVE_BOARD,
      editorDirty: true,
      revision: { ...LIVE_BOARD.revision!, dirty: true },
    });

    expect(screen.getByText("Unsaved in editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Add card to Todo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Drag Todo column" })).toBeDisabled();
  });

  it("rejects an older clean board scan and accepts the next newer generation", async () => {
    renderBoard({
      ...LIVE_BOARD,
      scanGeneration: 4,
      columns: [
        { id: "todo", title: "Todo", cards: [{ id: "current", text: "Current snapshot" }] },
        { id: "done", title: "Done", cards: [] },
      ],
    });

    act(() => {
      dispatchInbound({
        type: "afxUpdate",
        kanban: {
          dirPath: ".afx/kanban",
          boards: [
            {
              ...LIVE_BOARD,
              scanGeneration: 3,
              columns: [
                { id: "todo", title: "Todo", cards: [{ id: "stale", text: "Stale snapshot" }] },
                { id: "done", title: "Done", cards: [] },
              ],
            },
          ],
        },
      });
    });

    await waitFor(() => expect(screen.getByText("Current snapshot")).toBeInTheDocument());
    expect(screen.queryByText("Stale snapshot")).not.toBeInTheDocument();

    act(() => {
      dispatchInbound({
        type: "afxUpdate",
        kanban: {
          dirPath: ".afx/kanban",
          boards: [
            {
              ...LIVE_BOARD,
              revision: {
                contentRevision: "revision-5",
                diskRevision: "revision-5",
                dirty: false,
              },
              scanGeneration: 5,
              columns: [
                { id: "todo", title: "Todo", cards: [{ id: "new", text: "Newest snapshot" }] },
                { id: "done", title: "Done", cards: [] },
              ],
            },
          ],
        },
      });
    });

    expect(await screen.findByText("Newest snapshot")).toBeInTheDocument();
    expect(screen.queryByText("Current snapshot")).not.toBeInTheDocument();
  });

  it("removes inline dnd transitions when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    renderBoard({
      ...LIVE_BOARD,
      columns: [
        { id: "todo", title: "Todo", cards: [{ id: "card", text: "Reduced motion card" }] },
        { id: "done", title: "Done", cards: [] },
      ],
    });

    expect(document.querySelector('[data-card-id="card"]')).toHaveStyle({ transition: "none" });
    expect(document.querySelector('[data-column-id="todo"]')).toHaveStyle({ transition: "none" });
  });

  it("renders live linked task progress and mutates the source task instead of the board", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    const linkedSource = {
      rootUri: "file:///workspace",
      rootName: "workspace",
      relativePath: "docs/specs/221-board/tasks.md",
    };
    renderBoard({
      ...LIVE_BOARD,
      columns: [
        {
          id: "todo",
          title: "Todo",
          cards: [
            {
              id: "linked-task",
              text: "4.1 · Discover work",
              link: { version: 1, kind: "task", source: linkedSource, wbsId: "4.1" },
              resolved: {
                state: "resolved",
                sourceRevision: "task-revision",
                title: "4.1 · Discover work",
                lifecycle: "Open",
                completed: 1,
                total: 2,
                checklist: [
                  {
                    fingerprint: "item-one",
                    text: "Parse workspace specs",
                    completed: false,
                  },
                ],
              },
            },
          ],
        },
        { id: "done", title: "Done", cards: [] },
      ],
    });

    expect(screen.getByText("1/2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Checklist" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Parse workspace specs" }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxToggleLinkedTask",
        target: linkedSource,
        expectedRevision: "task-revision",
        wbsId: "4.1",
        itemFingerprint: "item-one",
        completed: true,
      }),
      "*",
    );
    const boardMutations = postMessage.mock.calls.filter(
      ([message]) => (message as { type?: string }).type === "afxMutateKanbanBoard",
    );
    expect(boardMutations).toHaveLength(0);
    postMessage.mockRestore();
  });

  it("retains the optimistic draft and exposes recovery after a conflict", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderBoard(LIVE_BOARD);

    await userEvent.type(screen.getByLabelText("Add card to Todo"), "Keep this draft");
    await userEvent.keyboard("{Enter}");
    const mutation = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxMutateKanbanBoard",
    )?.[0] as { requestId?: string } | undefined;
    if (!mutation?.requestId) throw new Error("Expected mutation request");

    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: mutation.requestId,
        outcome: "conflict",
        target: LIVE_BOARD.source,
        code: "stale-revision",
        message: "Board changed in the editor.",
        revision: {
          contentRevision: "external",
          diskRevision: "external",
          dirty: false,
        },
        retryable: true,
      });
    });

    expect(await screen.findByText("Board changed in the editor.")).toBeInTheDocument();
    expect(screen.getByText("Keep this draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open source" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    postMessage.mockRestore();
  });

  it("retries only a retryable error with the preserved mutation and revision", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderBoard(LIVE_BOARD);

    await userEvent.type(screen.getByLabelText("Add card to Todo"), "Retry this draft");
    await userEvent.keyboard("{Enter}");
    const first = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxMutateKanbanBoard",
    )?.[0] as
      | { requestId: string; expectedRevision: string; mutation: { kind: string; text?: string } }
      | undefined;
    if (!first) throw new Error("Expected first Board mutation");

    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: first.requestId,
        outcome: "error",
        target: LIVE_BOARD.source,
        code: "write-failed",
        message: "Temporary write failure.",
        retryable: true,
      });
    });

    expect(await screen.findByText("Temporary write failure.")).toBeInTheDocument();
    expect(screen.getByLabelText("Add card to Todo")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    const mutations = postMessage.mock.calls
      .map(
        ([message]) =>
          message as {
            type?: string;
            requestId?: string;
            expectedRevision?: string;
            mutation?: unknown;
          },
      )
      .filter((message) => message.type === "afxMutateKanbanBoard");
    expect(mutations).toHaveLength(2);
    expect(mutations[1]).toMatchObject({
      expectedRevision: "revision-1",
      mutation: first.mutation,
    });
    expect(mutations[1]?.requestId).not.toBe(first.requestId);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    postMessage.mockRestore();
  });

  it("does not offer Retry for a non-retryable Board error", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderBoard(LIVE_BOARD);

    await userEvent.type(screen.getByLabelText("Add card to Todo"), "Unsafe retry");
    await userEvent.keyboard("{Enter}");
    const request = postMessage.mock.calls.find(
      ([message]) => (message as { type?: string }).type === "afxMutateKanbanBoard",
    )?.[0] as { requestId?: string } | undefined;
    if (!request?.requestId) throw new Error("Expected Board mutation");

    act(() => {
      dispatchInbound({
        type: "afxMutationResult",
        requestId: request.requestId,
        outcome: "error",
        target: LIVE_BOARD.source,
        code: "parse-error",
        message: "The document is ambiguous.",
        retryable: false,
      });
    });

    expect(await screen.findByText("The document is ambiguous.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload source" })).toBeInTheDocument();
    postMessage.mockRestore();
  });
});
