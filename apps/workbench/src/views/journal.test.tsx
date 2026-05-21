/**
 * Journal view tests.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-5] [FR-8] [FR-9]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-PREVIEW] [DES-JOURNAL-EMPTY] [DES-TEST]
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JournalEntry } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Journal from "./journal";

const JOURNAL_ENTRY: JournalEntry = {
  id: "AR-D003",
  date: "2026-05-20T10:00:00.000Z",
  title: "Recovery pagination decision",
  status: "active",
  feature: "16-marketplace-asset-recovery",
  filePath: "docs/specs/16-marketplace-asset-recovery/journal.md",
  line: 42,
  context: "Choosing list pagination before implementation.",
  summary: "Cursor pagination avoids drift while new recovery items arrive.",
  decisions: ["Cursor-based pagination", "Cursor encoded as ISO timestamp"],
};

describe("Journal", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    postMessage.mockRestore();
    _resetBridgeForTest();
  });

  it("renders session guidance and opens chat commands", () => {
    render(
      <WorkbenchProvider initialState={{ isLoading: false, journal: [] }}>
        <Journal />
      </WorkbenchProvider>,
    );

    expect(
      screen.getByText("Keep the work understandable after the tab closes"),
    ).toBeInTheDocument();
    expect(screen.getByText("/afx-session log")).toBeInTheDocument();
    expect(screen.getByText("/afx-session note")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Log session/i }));
    fireEvent.click(screen.getByRole("button", { name: /Decision note/i }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxOpenChatCommand", command: "/afx-session log", mode: "insert" },
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxOpenChatCommand", command: "/afx-session note ", mode: "insert" },
      "*",
    );
  });

  it("renders selected entries as decision-first summaries", async () => {
    render(
      <WorkbenchProvider initialState={{ isLoading: false, journal: [JOURNAL_ENTRY] }}>
        <Journal />
      </WorkbenchProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cursor-based pagination")).toBeInTheDocument();
    });
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxFetchDocContent", filePath: JOURNAL_ENTRY.filePath },
      "*",
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "afxDocContent",
            filePath: JOURNAL_ENTRY.filePath,
            content: `# Recovery pagination decision

**Session** — 2026-05-20

## Notes

We compared offset and cursor pagination.
`,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("What mattered")).toBeInTheDocument();
    });
    expect(screen.getByText("Key decisions")).toBeInTheDocument();
    expect(screen.getByText("Why now")).toBeInTheDocument();
    expect(screen.getByText("Captured session")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("We compared offset and cursor pagination.")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Recovery pagination decision")).toHaveLength(2);
  });
});
