/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import {
  type TasksSignOffDocument,
  applyTasksSignOff,
  buildTasksSignOffEdit,
  summarizeTasksSignOff,
} from "./tasks-signoff";

const NOW = "2026-05-09T06:30:00.000Z";

// READY_TASKS uses status: Draft because the canonical tasks.md lifecycle is
// Draft → Living. There is no Approved intermediate state for tasks.md — Sign
// Off is precisely the step that promotes to Living.
const READY_TASKS = `---
afx: true
type: TASKS
status: Draft
updated_at: 2026-05-08T01:00:00.000Z
---

# Demo Tasks

## Phase 1: Build

- [x] First task
- [x] Second task

## Cross-Reference Index

| Task | Ref |
| --- | --- |
| 1.1 | [FR-1] |

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-05-09 | 1.1 | Coded | src/a.ts | [x] | [ ] |
| 2026-05-09 | 1.2 | Verified | src/b.ts | [x] | [] |
`;

const NOT_READY_TASKS = READY_TASKS.replace("- [x] Second task", "- [ ] Second task");

// A fully-signed-off tasks.md is already Living — that's the post-promotion
// state. Mirror that here so the no-op assertion is realistic.
const FULLY_SIGNED_TASKS = READY_TASKS.replace("status: Draft", "status: Living")
  .replace("| [x] | [ ] |", "| [x] | [x] |")
  .replace("| [x] | [] |", "| [x] | [x] |");

const MALFORMED_TABLE = `---
afx: true
type: TASKS
status: Draft
updated_at: 2026-05-08T01:00:00.000Z
---

## Phase 1: Build

- [x] First task

## Work Sessions

| Date | Task | Action | Files Modified | Reviewer |
| ---- | ---- | ------ | -------------- | -------- |
| 2026-05-09 | 1.1 | Coded | src/a.ts | [ ] |
`;

const MIXED_AGENT_ROWS = READY_TASKS.replace(
  "| 2026-05-09 | 1.2 | Verified | src/b.ts | [x] | [] |",
  "| 2026-05-09 | 1.2 | Verified | src/b.ts | [] | [ ] |",
);

class FakeWorkspaceEdit {
  replacements: Array<{ line: number; start: number; end: number; text: string }> = [];
  insertions: Array<{ line: number; character: number; text: string }> = [];

  replace(_uri: vscode.Uri, range: vscode.Range, newText: string): void {
    this.replacements.push({
      line: range.start.line,
      start: range.start.character,
      end: range.end.character,
      text: newText,
    });
  }

  insert(_uri: vscode.Uri, position: vscode.Position, newText: string): void {
    this.insertions.push({ line: position.line, character: position.character, text: newText });
  }

  apply(raw: string): string {
    const lines = raw.split("\n");
    const replacements = [...this.replacements].sort((a, b) => {
      if (b.line !== a.line) return b.line - a.line;
      return b.start - a.start;
    });
    for (const replacement of replacements) {
      const line = lines[replacement.line] ?? "";
      lines[replacement.line] =
        line.slice(0, replacement.start) + replacement.text + line.slice(replacement.end);
    }
    const insertions = [...this.insertions].sort((a, b) => b.line - a.line);
    for (const insertion of insertions) {
      const line = lines[insertion.line] ?? "";
      lines[insertion.line] =
        line.slice(0, insertion.character) + insertion.text + line.slice(insertion.character);
    }
    return lines.join("\n");
  }
}

function documentFor(raw: string): TasksSignOffDocument {
  return {
    uri: vscode.Uri.file("/workspace/docs/specs/demo/tasks.md"),
    getText: () => raw,
  };
}

function build(raw: string) {
  const edit = new FakeWorkspaceEdit();
  const result = buildTasksSignOffEdit(
    documentFor(raw),
    NOW,
    edit as unknown as vscode.WorkspaceEdit,
  );
  return { ...result, edit, output: edit.apply(raw) };
}

describe("summarizeTasksSignOff", () => {
  it("detects ready tasks with completed tasks, agent verification, and pending human rows", () => {
    expect(summarizeTasksSignOff(READY_TASKS)).toEqual({
      ready: true,
      signable: true,
      allTasksChecked: true,
      allAgentVerified: true,
      pendingTasks: 0,
      pendingAgentRows: 0,
      pendingHumanRows: 2,
      alreadyLiving: false,
    });
  });

  it("stays signable but not ready when a task checkbox is still open (relaxed mode)", () => {
    // Relaxed mode: the strip must still surface Sign Off so the user can
    // tick Human cells, but the strict gate (`ready`) is false so status
    // promotion is blocked. The popover shows pendingTasks as a warning.
    expect(summarizeTasksSignOff(NOT_READY_TASKS)).toEqual({
      ready: false,
      signable: true,
      allTasksChecked: false,
      allAgentVerified: true,
      pendingTasks: 1,
      pendingAgentRows: 0,
      pendingHumanRows: 2,
      alreadyLiving: false,
    });
  });

  it("treats malformed work-session tables as not ready and not signable", () => {
    expect(summarizeTasksSignOff(MALFORMED_TABLE)).toEqual({
      ready: false,
      signable: false,
      allTasksChecked: true,
      allAgentVerified: false,
      pendingTasks: 0,
      pendingAgentRows: 0,
      pendingHumanRows: 0,
      alreadyLiving: false,
    });
  });

  it("flags pendingAgentRows when an Agent cell is still unchecked", () => {
    // Pending Agent + pending Human: signable (we can tick Human) but not
    // ready (Agent verification incomplete). Status stays Draft on confirm.
    expect(summarizeTasksSignOff(MIXED_AGENT_ROWS)).toMatchObject({
      ready: false,
      signable: true,
      allAgentVerified: false,
      pendingAgentRows: 1,
      // Only 1 row qualifies for Human-tick (the one with Agent: [x])
      pendingHumanRows: 1,
    });
  });

  it("counts empty-bracket [] as unchecked so allTasksChecked stays accurate", () => {
    // `- []` (zero chars between brackets) is a common typo found in real
    // user files; treat it identically to `- [ ]` so Sign Off readiness
    // doesn't silently report `true` when the task is still open.
    const tasksWithEmptyBracket = READY_TASKS.replace("- [x] Second task", "- [] Second task");
    expect(summarizeTasksSignOff(tasksWithEmptyBracket)).toMatchObject({
      ready: false,
      allTasksChecked: false,
    });
  });
});

describe("buildTasksSignOffEdit", () => {
  it("ticks Human cells, promotes status, and bumps updated_at in one edit", () => {
    const result = build(READY_TASKS);

    expect(result.changed).toBe(true);
    expect(result.signedOffRows).toBe(2);
    expect(result.promotedStatus).toBe(true);
    expect(result.bumpedUpdatedAt).toBe(true);
    expect(result.edit.replacements).toHaveLength(4);
    expect(result.output).toContain("status: Living");
    expect(result.output).toContain(`updated_at: ${NOW}`);
    expect(result.output).toContain("| 2026-05-09 | 1.1 | Coded | src/a.ts | [x] | [x] |");
    expect(result.output).toContain("| 2026-05-09 | 1.2 | Verified | src/b.ts | [x] | [x] |");
  });

  it("is idempotent when every Human row is already signed", () => {
    const result = build(FULLY_SIGNED_TASKS);

    expect(result.changed).toBe(false);
    expect(result.signedOffRows).toBe(0);
    expect(result.edit.replacements).toHaveLength(0);
    expect(result.output).toBe(FULLY_SIGNED_TASKS);
  });

  it("signs only rows where Agent is checked", () => {
    const result = build(MIXED_AGENT_ROWS);

    expect(result.summary.ready).toBe(false);
    expect(result.signedOffRows).toBe(1);
    expect(result.output).toContain("| 2026-05-09 | 1.1 | Coded | src/a.ts | [x] | [x] |");
    expect(result.output).toContain("| 2026-05-09 | 1.2 | Verified | src/b.ts | [] | [ ] |");
  });

  it("ticks Human cells but does NOT promote status when body tasks are still incomplete", () => {
    // Relaxed mode: NOT_READY_TASKS has one body task still `[ ]` and
    // `status: Draft`. Sign Off should tick Human cells (so the user gets
    // partial credit) but leave `status` at Draft until body tasks are
    // complete. The user can re-run Sign Off later to promote.
    const result = build(NOT_READY_TASKS);

    expect(result.summary.ready).toBe(false);
    expect(result.summary.signable).toBe(true);
    expect(result.signedOffRows).toBe(2);
    expect(result.promotedStatus).toBe(false);
    expect(result.bumpedUpdatedAt).toBe(true);
    expect(result.output).toContain("status: Draft");
    expect(result.output).not.toContain("status: Living");
    expect(result.output).toContain(`updated_at: ${NOW}`);
  });

  it("skips status promotion when tasks are already Living", () => {
    const livingTasks = READY_TASKS.replace("status: Draft", "status: Living");
    const result = build(livingTasks);

    expect(result.summary.alreadyLiving).toBe(true);
    expect(result.promotedStatus).toBe(false);
    expect(result.bumpedUpdatedAt).toBe(true);
    expect(result.output).toContain("status: Living");
    expect(result.output).toContain(`updated_at: ${NOW}`);
  });
});

// ---------------------------------------------------------------------------
// applyTasksSignOff — host wrapper that opens the document, applies the
// WorkspaceEdit, and saves. Returns a discriminated result so the sidebar
// dispatcher can post `agent/signOffComplete` without re-deriving counts.
//
//   @see docs/specs/211-app-chat-composer/spec.md [FR-15]
//   @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
// ---------------------------------------------------------------------------

describe("applyTasksSignOff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fakeDocument(text: string) {
    const document = {
      uri: vscode.Uri.file("/workspace/docs/specs/demo/tasks.md"),
      getText: () => text,
      save: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue(
      document as unknown as vscode.TextDocument,
    );
    vi.spyOn(vscode.workspace, "applyEdit").mockResolvedValue(true);
    return document;
  }

  it("applies the WorkspaceEdit and reports the row count + new status", async () => {
    const document = fakeDocument(READY_TASKS);
    const result = await applyTasksSignOff(document.uri);

    expect(result).toEqual({
      ok: true,
      rowsTicked: 2,
      newStatus: "Living",
    });
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(vscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when every Human cell is already ticked", async () => {
    // FULLY_SIGNED_TASKS is already `status: Living`, so the no-op path
    // returns "Living" — never the legacy hardcoded "Approved" placeholder.
    const document = fakeDocument(FULLY_SIGNED_TASKS);
    const result = await applyTasksSignOff(document.uri);

    expect(result).toEqual({
      ok: true,
      rowsTicked: 0,
      newStatus: "Living",
    });
    expect(document.save).not.toHaveBeenCalled();
    expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
  });

  it("returns the actual current status (Draft) when no-op without promotion", async () => {
    // A tasks.md with no pending Human cells AND status: Draft is an unusual
    // but valid state — applyTasksSignOff must echo the real current status,
    // not invent an "Approved" label that the canonical lifecycle doesn't have.
    const draftAlreadySigned = `---
afx: true
type: TASKS
status: Draft
updated_at: 2026-05-08T01:00:00.000Z
---

## Phase 1: Build

- [x] First task

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-05-09 | 1.1 | Coded | src/a.ts | [x] | [x] |
`;
    const document = fakeDocument(draftAlreadySigned);
    const result = await applyTasksSignOff(document.uri);

    expect(result).toEqual({
      ok: true,
      rowsTicked: 0,
      newStatus: "Draft",
    });
  });

  it("surfaces an error when applyEdit is rejected by the workspace", async () => {
    const document = fakeDocument(READY_TASKS);
    vi.mocked(vscode.workspace.applyEdit).mockResolvedValueOnce(false);

    const result = await applyTasksSignOff(document.uri);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/rejected/i);
    expect(document.save).not.toHaveBeenCalled();
  });

  it("surfaces an error when openTextDocument throws", async () => {
    vi.spyOn(vscode.workspace, "openTextDocument").mockRejectedValueOnce(new Error("not found"));

    const result = await applyTasksSignOff(vscode.Uri.file("/missing/tasks.md"));

    expect(result).toMatchObject({ ok: false, rowsTicked: 0, error: "not found" });
  });
});
