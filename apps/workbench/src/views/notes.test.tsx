/**
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-3] [FR-7] [FR-8]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-TEST] [DES-NOTES-FILTERS] [DES-NOTES-TIME] [DES-NOTES-EMPTY]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuickNote } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Notes from "./notes";

function localTimestamp(date: Date): string {
  return `${[
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")}T${[
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function note(text: string, date: Date): QuickNote {
  return {
    timestamp: localTimestamp(date),
    time: "13:14:15.123",
    displayTime: "1:14:15 PM",
    date: dateKey(date),
    text,
  };
}

describe("Notes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetBridgeForTest();
  });

  it("renders exact 12-hour note timestamps with seconds", () => {
    const timestamp = new Date(2026, 4, 2, 13, 14, 15, 123);

    render(
      <WorkbenchProvider
        initialState={{ isLoading: false, notes: [note("Timestamped", timestamp)] }}
      >
        <Notes />
      </WorkbenchProvider>,
    );

    expect(
      screen.getByText(
        timestamp.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      ),
    ).toBeInTheDocument();
  });

  it("explains fleeting-note sources when the timeline is empty", () => {
    render(
      <WorkbenchProvider initialState={{ isLoading: false, notes: [] }}>
        <Notes />
      </WorkbenchProvider>,
    );

    expect(screen.getByText("Catch the thought before it becomes a task")).toBeInTheDocument();
    expect(screen.getByText("Workbench capture")).toBeInTheDocument();
    expect(screen.getByText("From chat")).toBeInTheDocument();
    expect(screen.getByText("IDE right click")).toBeInTheDocument();
    expect(screen.getAllByText(".afx/notes.md").length).toBeGreaterThan(0);
  });

  it("filters the timeline by recent notes", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const old = new Date();
    old.setDate(old.getDate() - 10);

    render(
      <WorkbenchProvider
        initialState={{
          isLoading: false,
          notes: [note("Fresh context", today), note("Older context", old)],
        }}
      >
        <Notes />
      </WorkbenchProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Week" }));

    expect(screen.getByText("Fresh context")).toBeInTheDocument();
    expect(screen.queryByText("Older context")).not.toBeInTheDocument();
  });

  it("uses the shared reader to toggle note checkboxes", async () => {
    const user = userEvent.setup();
    const timestamp = new Date(2026, 4, 2, 13, 14, 15, 123);
    const quickNote = note("- [ ] Confirm preview reader\n- [x] Keep markdown source", timestamp);
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();

    render(
      <WorkbenchProvider initialState={{ isLoading: false, notes: [quickNote] }}>
        <Notes />
      </WorkbenchProvider>,
    );

    await user.click(screen.getByRole("checkbox", { name: /Toggle task checkbox on line 1/i }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxEditNote",
        timestamp: quickNote.timestamp,
        text: "- [x] Confirm preview reader\n- [x] Keep markdown source",
      },
      "*",
    );
  });

  it("copies rendered note markdown source", async () => {
    const user = userEvent.setup();
    const timestamp = new Date(2026, 4, 2, 13, 14, 15, 123);
    const quickNote = note("## Decision\n\nKeep the source copyable.", timestamp);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    initWorkbenchBridge();

    render(
      <WorkbenchProvider initialState={{ isLoading: false, notes: [quickNote] }}>
        <Notes />
      </WorkbenchProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Copy note markdown source" }));

    expect(writeText).toHaveBeenCalledWith(quickNote.text);
  });
});
