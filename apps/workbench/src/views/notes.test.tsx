/**
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-3] [FR-7] [FR-8]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-TEST] [DES-NOTES-FILTERS] [DES-NOTES-TIME] [DES-NOTES-EMPTY]
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NotesSourceSnapshot, QuickNote, WorkbenchInbound } from "@afx/shared";

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

function note(text: string, date: Date, id = `note-${date.getTime()}`): QuickNote {
  return {
    id,
    timestamp: localTimestamp(date),
    time: "13:14:15.123",
    displayTime: "1:14:15 PM",
    date: dateKey(date),
    text,
    checkboxes: Array.from(text.matchAll(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/gm)).map(
      (match, index) => ({
        fingerprint: `${id}-checkbox-${index}`,
        text: match[2] ?? "",
        completed: (match[1] ?? "").toLowerCase() === "x",
      }),
    ),
  };
}

function sourceSnapshot(
  notes: QuickNote[],
  overrides: Partial<NotesSourceSnapshot> = {},
): NotesSourceSnapshot {
  return {
    source: { rootUri: "file:///workspace", rootName: "workspace", relativePath: ".afx/notes.md" },
    revision: { contentRevision: "revision-1", diskRevision: "revision-1", dirty: false },
    scanGeneration: 1,
    notes,
    ...overrides,
  };
}

function renderNotes(notes: QuickNote[], overrides: Partial<NotesSourceSnapshot> = {}) {
  return render(
    <WorkbenchProvider
      initialState={{ isLoading: false, notes, notesSources: [sourceSnapshot(notes, overrides)] }}
    >
      <Notes />
    </WorkbenchProvider>,
  );
}

function dispatchInbound(message: WorkbenchInbound): void {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: message }));
  });
}

describe("Notes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    _resetBridgeForTest();
  });

  it("renders exact 12-hour note timestamps with seconds", () => {
    const timestamp = new Date(2026, 4, 2, 13, 14, 15, 123);

    renderNotes([note("Timestamped", timestamp)]);

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
    renderNotes([]);

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

    renderNotes([note("Fresh context", today), note("Older context", old)]);

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

    renderNotes([quickNote]);

    await user.click(screen.getByRole("checkbox", { name: /Toggle task checkbox on line 1/i }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxMutateNotes",
        target: expect.objectContaining({ relativePath: ".afx/notes.md" }),
        expectedRevision: "revision-1",
        mutation: {
          kind: "toggleCheckbox",
          noteId: quickNote.id,
          itemFingerprint: `${quickNote.id}-checkbox-0`,
          completed: true,
        },
      }),
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

    renderNotes([quickNote]);

    await user.click(screen.getByRole("button", { name: "Copy note markdown source" }));

    expect(writeText).toHaveBeenCalledWith(quickNote.text);
  });

  it("keeps a capture draft until success and its authoritative snapshot arrive", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderNotes([]);
    const textarea = screen.getByRole("textbox", { name: "New note" });

    fireEvent.change(textarea, { target: { value: "First line\nSecond line" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxMutateNotes" }),
      "*",
    );
    fireEvent.keyDown(textarea, { key: "Enter" });

    const outbound = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes");
    expect(outbound?.requestId).toEqual(expect.any(String));
    expect(textarea).toHaveValue("First line\nSecond line");
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();

    dispatchInbound({
      type: "afxMutationResult",
      requestId: outbound!.requestId!,
      outcome: "success",
      target: sourceSnapshot([]).source,
      revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
    });
    expect(textarea).toHaveValue("First line\nSecond line");
    expect(screen.getByRole("button", { name: "Saved · syncing" })).toBeDisabled();

    dispatchInbound({
      type: "afxUpdate",
      notesSources: [
        sourceSnapshot([], {
          revision: {
            contentRevision: "revision-2",
            diskRevision: "revision-2",
            dirty: false,
          },
          scanGeneration: 2,
        }),
      ],
    });

    await waitFor(() => expect(textarea).toHaveValue(""));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("preserves text typed after an older capture is acknowledged", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderNotes([]);
    const textarea = screen.getByRole("textbox", { name: "New note" });

    fireEvent.change(textarea, { target: { value: "Submitted note" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    const outbound = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes")!;

    fireEvent.change(textarea, { target: { value: "Submitted note\nNext draft" } });
    expect(textarea).toHaveValue("Submitted note\nNext draft");

    dispatchInbound({
      type: "afxMutationResult",
      requestId: outbound.requestId!,
      outcome: "success",
      target: sourceSnapshot([]).source,
      revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
    });
    dispatchInbound({
      type: "afxUpdate",
      notesSources: [
        sourceSnapshot([], {
          revision: {
            contentRevision: "revision-2",
            diskRevision: "revision-2",
            dirty: false,
          },
          scanGeneration: 2,
        }),
      ],
    });

    await waitFor(() => expect(textarea).toHaveValue("Next draft"));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("keeps a replacement draft even when it returns to the submitted text", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderNotes([]);
    const textarea = screen.getByRole("textbox", { name: "New note" });

    fireEvent.change(textarea, { target: { value: "Same text" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    const outbound = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes")!;

    fireEvent.change(textarea, { target: { value: "Replacement" } });
    fireEvent.change(textarea, { target: { value: "Same text" } });
    dispatchInbound({
      type: "afxMutationResult",
      requestId: outbound.requestId!,
      outcome: "success",
      target: sourceSnapshot([]).source,
      revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
    });
    dispatchInbound({
      type: "afxUpdate",
      notesSources: [
        sourceSnapshot([], {
          revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
          scanGeneration: 2,
        }),
      ],
    });

    await waitFor(() => expect(textarea).toHaveValue("Same text"));
  });

  it("retains a failed capture and retries against its original source and revision", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderNotes([]);

    const capture = screen.getByRole("textbox", { name: "New note" });
    fireEvent.change(capture, { target: { value: "Recover me" } });
    fireEvent.keyDown(capture, { key: "Enter" });
    const first = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes")!;

    dispatchInbound({
      type: "afxMutationResult",
      requestId: first.requestId!,
      outcome: "conflict",
      target: sourceSnapshot([]).source,
      code: "stale-revision",
      message: "Notes changed in the editor.",
      revision: { contentRevision: "revision-2", dirty: false },
      retryable: true,
    });

    expect(screen.getByRole("textbox", { name: "New note" })).toHaveValue("Recover me");
    expect(screen.getByRole("alert")).toHaveTextContent("Notes changed in the editor.");
    await user.click(screen.getByRole("button", { name: /Retry failed change/ }));

    const mutations = postMessage.mock.calls.filter(
      ([message]) => (message as { type?: string }).type === "afxMutateNotes",
    );
    expect(mutations).toHaveLength(2);
    expect(mutations[1]?.[0]).toEqual(
      expect.objectContaining({
        target: sourceSnapshot([]).source,
        expectedRevision: "revision-1",
        mutation: { kind: "append", text: "Recover me" },
      }),
    );
  });

  it("pins a failed retry when the selected source changes and ignores stale results", async () => {
    const user = userEvent.setup();
    const first = sourceSnapshot([], {
      source: { rootUri: "file:///first", rootName: "first", relativePath: ".afx/notes.md" },
      revision: { contentRevision: "first-r1", diskRevision: "first-r1", dirty: false },
    });
    const second = sourceSnapshot([], {
      source: {
        rootUri: "file:///second",
        rootName: "second",
        relativePath: "project/.afx/notes.md",
      },
      revision: { contentRevision: "second-r7", diskRevision: "second-r7", dirty: false },
    });
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(
      <WorkbenchProvider initialState={{ isLoading: false, notesSources: [first, second] }}>
        <Notes />
      </WorkbenchProvider>,
    );

    const capture = screen.getByRole("textbox", { name: "New note" });
    fireEvent.change(capture, { target: { value: "Pinned to first" } });
    fireEvent.keyDown(capture, { key: "Enter" });
    const firstRequest = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes")!;
    dispatchInbound({
      type: "afxMutationResult",
      requestId: firstRequest.requestId!,
      outcome: "error",
      target: first.source,
      code: "write-failed",
      message: "First root write failed.",
      revision: { contentRevision: "first-r1", dirty: false },
      retryable: true,
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Notes source" }),
      JSON.stringify([second.source.rootUri, second.source.relativePath]),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("first/.afx/notes.md");
    await user.click(screen.getByRole("button", { name: /Retry.*first\/.afx\/notes\.md/i }));

    const mutations = postMessage.mock.calls
      .map(([message]) => message as Record<string, unknown>)
      .filter((message) => message.type === "afxMutateNotes");
    expect(mutations).toHaveLength(2);
    expect(mutations[1]).toMatchObject({
      target: first.source,
      expectedRevision: "first-r1",
      mutation: { kind: "append", text: "Pinned to first" },
    });
    const retryRequestId = mutations[1]?.requestId as string;

    dispatchInbound({
      type: "afxMutationResult",
      requestId: firstRequest.requestId!,
      outcome: "success",
      target: first.source,
      revision: { contentRevision: "stale-r2", diskRevision: "stale-r2", dirty: false },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saving note");

    dispatchInbound({
      type: "afxMutationResult",
      requestId: retryRequestId,
      outcome: "success",
      target: first.source,
      revision: { contentRevision: "first-r2", diskRevision: "first-r2", dirty: false },
    });
    expect(screen.getByRole("status")).toHaveTextContent("refreshing timeline");

    dispatchInbound({
      type: "afxUpdate",
      notesSources: [
        sourceSnapshot([], {
          source: first.source,
          revision: { contentRevision: "first-r2", diskRevision: "first-r2", dirty: false },
          scanGeneration: 2,
        }),
        second,
      ],
    });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Notes source" }),
      JSON.stringify([first.source.rootUri, first.source.relativePath]),
    );
    expect(screen.getByRole("textbox", { name: "New note" })).toHaveValue("");
  });

  it("retains inline edit text on error and supports keyboard cancel", async () => {
    const user = userEvent.setup();
    const quickNote = note("Original", new Date(2026, 4, 2, 13, 14, 15, 123));
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderNotes([quickNote]);

    await user.click(screen.getByRole("button", { name: "Edit note" }));
    const editor = screen.getByRole("textbox", { name: "Edit note text" });
    fireEvent.change(editor, { target: { value: "Updated draft" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    const outbound = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes")!;
    expect(outbound).toEqual(expect.objectContaining({ requestId: expect.any(String) }));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: { kind: "edit", noteId: quickNote.id, text: "Updated draft" },
      }),
      "*",
    );

    dispatchInbound({
      type: "afxMutationResult",
      requestId: outbound.requestId!,
      outcome: "error",
      target: sourceSnapshot([]).source,
      code: "write-failed",
      message: "Disk write failed.",
      retryable: true,
    });
    expect(editor).toHaveValue("Updated draft");
    expect(screen.getByText("Save failed — draft retained")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
  });

  it("settles a successful inline edit only after the matching source snapshot arrives", async () => {
    const timestamp = new Date(2026, 4, 2, 13, 14, 15, 123);
    const original = note("Original", timestamp);
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    renderNotes([original]);

    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    const editor = screen.getByRole("textbox", { name: "Edit note text" });
    fireEvent.change(editor, { target: { value: "Updated" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
    const outbound = postMessage.mock.calls
      .map(([message]) => message as { type?: string; requestId?: string })
      .find((message) => message.type === "afxMutateNotes")!;

    dispatchInbound({
      type: "afxMutationResult",
      requestId: outbound.requestId!,
      outcome: "success",
      target: sourceSnapshot([]).source,
      revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
    });
    expect(screen.getByRole("textbox", { name: "Edit note text" })).toHaveValue("Updated");

    dispatchInbound({
      type: "afxUpdate",
      notesSources: [
        sourceSnapshot([note("Updated", timestamp, original.id)], {
          revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
          scanGeneration: 2,
        }),
      ],
    });

    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Edit note text" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("routes capture to the exact selected workspace source", async () => {
    const user = userEvent.setup();
    const first = sourceSnapshot([], {
      source: { rootUri: "file:///first", rootName: "first", relativePath: ".afx/notes.md" },
    });
    const second = sourceSnapshot([], {
      source: {
        rootUri: "file:///second",
        rootName: "second",
        relativePath: "project/.afx/notes.md",
      },
      revision: { contentRevision: "revision-second", dirty: false },
    });
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(
      <WorkbenchProvider initialState={{ isLoading: false, notesSources: [first, second] }}>
        <Notes />
      </WorkbenchProvider>,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Notes source" }),
      JSON.stringify(["file:///second", "project/.afx/notes.md"]),
    );
    const sourceCapture = screen.getByRole("textbox", { name: "New note" });
    expect(sourceCapture).toBeEnabled();
    fireEvent.change(sourceCapture, { target: { value: "Second root" } });
    expect(sourceCapture).toHaveValue("Second root");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxMutateNotes",
        target: second.source,
        expectedRevision: "revision-second",
      }),
      "*",
    );
  });

  it("blocks writes while an unsaved or malformed editor snapshot is displayed", async () => {
    const quickNote = note("Last valid note", new Date(2026, 4, 2, 13, 14, 15, 123));
    renderNotes([quickNote], {
      revision: { contentRevision: "dirty-revision", diskRevision: "revision-1", dirty: true },
      parseError: "Unterminated YAML frontmatter.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Unterminated YAML frontmatter.");
    expect(screen.getByRole("textbox", { name: "New note" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit note" })).toBeDisabled();
    expect(screen.getByText("Last valid note")).toBeInTheDocument();
  });

  it("uses a state-preserving Capture and Timeline mode at narrow widths", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(max-width: 719px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    renderNotes([note("Narrow timeline", new Date())]);

    fireEvent.change(screen.getByRole("textbox", { name: "New note" }), {
      target: { value: "Draft survives" },
    });
    expect(screen.queryByText("Narrow timeline")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "timeline" }));
    expect(screen.getByText("Narrow timeline")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "capture" }));
    expect(screen.getByRole("textbox", { name: "New note" })).toHaveValue("Draft survives");
  });
});
