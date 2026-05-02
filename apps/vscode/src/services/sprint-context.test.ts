/**
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createMockLogger } from "../__fixtures__/mock-logger";
import { createSprintContextSync } from "./sprint-context";

const SPRINT_BODY = [
  "---",
  "afx: true",
  "type: SPRINT",
  "status: Living",
  "---",
  "",
  "# Sprint",
  "",
  "<!-- SPRINT-SECTION-START: SPEC -->",
  "## 1. Spec",
  "spec body",
  "<!-- SPRINT-SECTION-END: SPEC -->",
  "",
  "<!-- SPRINT-SECTION-START: DESIGN -->",
  "## 2. Design",
  "design body",
  "<!-- SPRINT-SECTION-END: DESIGN -->",
  "",
  "<!-- SPRINT-SECTION-START: TASKS -->",
  "## 3. Tasks",
  "task body",
  "<!-- SPRINT-SECTION-END: TASKS -->",
  "",
].join("\n");

const SPEC_BODY = `---
afx: true
type: SPEC
status: Draft
---

# Spec
`;

interface FakeSelection {
  active: { line: number };
}
interface FakeEditor {
  document: {
    uri: { fsPath: string };
    languageId: string;
    getText: () => string;
  };
  selection: FakeSelection;
}

function fakeEditor(
  fsPath: string,
  body: string,
  cursorLine = 0,
  languageId = "markdown",
): FakeEditor {
  return {
    document: { uri: { fsPath }, languageId, getText: () => body },
    selection: { active: { line: cursorLine } },
  };
}

describe("createSprintContextSync", () => {
  let setContextCalls: Array<{ key: string; value: unknown }>;
  let activeEditorListeners: Array<(editor: FakeEditor | undefined) => void>;
  let selectionListeners: Array<(event: { textEditor: FakeEditor }) => void>;

  beforeEach(() => {
    setContextCalls = [];
    activeEditorListeners = [];
    selectionListeners = [];

    vi.spyOn(vscode.commands, "executeCommand").mockImplementation(
      async (command: string, ...args: unknown[]) => {
        if (command === "setContext") {
          setContextCalls.push({ key: String(args[0]), value: args[1] });
        }
        return undefined;
      },
    );
    vi.spyOn(vscode.window, "onDidChangeActiveTextEditor").mockImplementation(((
      listener: (editor: vscode.TextEditor | undefined) => void,
    ) => {
      activeEditorListeners.push(listener as (editor: FakeEditor | undefined) => void);
      return { dispose: vi.fn() };
    }) as typeof vscode.window.onDidChangeActiveTextEditor);
    vi.spyOn(vscode.window, "onDidChangeTextEditorSelection").mockImplementation(((
      listener: (event: vscode.TextEditorSelectionChangeEvent) => void,
    ) => {
      selectionListeners.push(listener as (event: { textEditor: FakeEditor }) => void);
      return { dispose: vi.fn() };
    }) as typeof vscode.window.onDidChangeTextEditorSelection);
    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: null,
    });
  });

  it("sets afx.isSprint=true and a section when a sprint file is opened", () => {
    const editor = fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 10); // inside SPEC
    Object.defineProperty(vscode.window, "activeTextEditor", { configurable: true, value: editor });

    createSprintContextSync(createMockLogger().logger);

    expect(setContextCalls).toEqual([
      { key: "afx.isSprint", value: true },
      { key: "afx.sprintSection", value: "SPEC" },
    ]);
  });

  it("skips emitting context for non-sprint markdown files", () => {
    const editor = fakeEditor("/repo/docs/specs/foo/spec.md", SPEC_BODY);
    Object.defineProperty(vscode.window, "activeTextEditor", { configurable: true, value: editor });

    createSprintContextSync(createMockLogger().logger);

    expect(setContextCalls).toEqual([]);
  });

  it("ignores files outside docs/specs even with sprint frontmatter", () => {
    const editor = fakeEditor("/repo/notes/random.md", SPRINT_BODY);
    Object.defineProperty(vscode.window, "activeTextEditor", { configurable: true, value: editor });

    createSprintContextSync(createMockLogger().logger);

    expect(setContextCalls).toEqual([]);
  });

  it("flips both keys back to false/empty when switching to a non-sprint file", () => {
    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 10),
    });
    createSprintContextSync(createMockLogger().logger);

    activeEditorListeners[0]?.(fakeEditor("/repo/src/file.ts", "code", 0, "typescript"));

    expect(setContextCalls).toEqual([
      { key: "afx.isSprint", value: true },
      { key: "afx.sprintSection", value: "SPEC" },
      { key: "afx.isSprint", value: false },
      { key: "afx.sprintSection", value: "" },
    ]);
  });

  it("re-emits the section when the cursor moves to a different sprint section", () => {
    const editor = fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 10); // SPEC
    Object.defineProperty(vscode.window, "activeTextEditor", { configurable: true, value: editor });
    createSprintContextSync(createMockLogger().logger);
    setContextCalls.length = 0;

    // Move cursor into TASKS section (line ~20 in the body above)
    editor.selection.active.line = 20;
    selectionListeners[0]?.({ textEditor: editor });

    expect(setContextCalls).toEqual([{ key: "afx.sprintSection", value: "TASKS" }]);
  });

  it("does not emit when the section stays the same as the cursor moves within it", () => {
    const editor = fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 10);
    Object.defineProperty(vscode.window, "activeTextEditor", { configurable: true, value: editor });
    createSprintContextSync(createMockLogger().logger);
    setContextCalls.length = 0;

    editor.selection.active.line = 11;
    selectionListeners[0]?.({ textEditor: editor });

    expect(setContextCalls).toEqual([]);
  });
});
