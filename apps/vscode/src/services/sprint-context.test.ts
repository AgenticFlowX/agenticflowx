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

// ---------------------------------------------------------------------------
// Active document context payload (host → webview bridge for spec mode strips)
// @see docs/specs/100-package-shared/spec.md [FR-12]
// @see docs/specs/211-app-chat-composer/spec.md [FR-15]
// ---------------------------------------------------------------------------

const JOURNAL_BODY = `---
afx: true
type: JOURNAL
status: Living
---

# Journal
`;

const ADR_BODY = `---
afx: true
type: ADR
status: Accepted
---

# ADR
`;

const RESEARCH_BODY = `---
afx: true
type: RES
status: Draft
---

# Research
`;

const CONTEXT_BODY = `---
afx: true
type: CONTEXT
status: Active
---

# Context
`;

describe("createSprintContextSync — onDocContextChange", () => {
  let docContexts: Array<unknown>;
  let activeEditorListeners: Array<(editor: FakeEditor | undefined) => void>;

  beforeEach(() => {
    docContexts = [];
    activeEditorListeners = [];

    vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    vi.spyOn(vscode.window, "onDidChangeActiveTextEditor").mockImplementation(((
      listener: (editor: vscode.TextEditor | undefined) => void,
    ) => {
      activeEditorListeners.push(listener as (editor: FakeEditor | undefined) => void);
      return { dispose: vi.fn() };
    }) as typeof vscode.window.onDidChangeActiveTextEditor);
    vi.spyOn(vscode.window, "onDidChangeTextEditorSelection").mockImplementation((() => ({
      dispose: vi.fn(),
    })) as typeof vscode.window.onDidChangeTextEditorSelection);
    vi.spyOn(vscode.workspace, "onDidSaveTextDocument").mockImplementation((() => ({
      dispose: vi.fn(),
    })) as typeof vscode.workspace.onDidSaveTextDocument);
    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupWith(editor: FakeEditor | undefined) {
    Object.defineProperty(vscode.window, "activeTextEditor", { configurable: true, value: editor });
    createSprintContextSync(createMockLogger().logger, {
      onDocContextChange: (ctx) => docContexts.push(ctx),
    });
  }

  it("emits a sprint payload with section + docKind for sprint files", () => {
    setupWith(fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 10)); // inside SPEC
    expect(docContexts).toEqual([
      {
        format: "sprint",
        section: "SPEC",
        docKind: "spec",
        feature: "foo",
        approvalStatus: null,
      },
    ]);
  });

  it("preserves feature paths for sprint files", () => {
    setupWith(fakeEditor("/repo/docs/specs/chat-foundation/chat-foundation.md", SPRINT_BODY, 10));
    expect(docContexts.at(-1)).toMatchObject({ feature: "chat-foundation" });
  });

  it("emits a standard-format payload for spec.md / design.md / tasks.md", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/spec.md", SPEC_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      feature: "auth",
      approvalStatus: "Draft",
    });
  });

  it("detects journal.md as docKind=journal", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/journal.md", JOURNAL_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "journal",
      feature: "auth",
    });
  });

  it("detects global ADR files under docs/adr/", () => {
    setupWith(fakeEditor("/repo/docs/adr/ADR-0001-foo.md", ADR_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "adr",
      feature: null,
    });
  });

  it("detects feature-scoped ADR via frontmatter inside research/", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/research/ADR-local.md", ADR_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "adr",
      feature: "auth",
    });
  });

  it("detects feature-scoped research as docKind=research", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/research/options.md", RESEARCH_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "research",
      feature: "auth",
    });
  });

  it("detects .afx/context.md as docKind=context", () => {
    setupWith(fakeEditor("/repo/.afx/context.md", CONTEXT_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "context",
      feature: null,
    });
  });

  it("does not emit for non-AFX markdown (initial state is already empty)", () => {
    // Initial currentDocContext == EMPTY — emitting EMPTY again would be a
    // duplicate, so the dedup guard correctly suppresses it.
    setupWith(fakeEditor("/repo/README.md", "# readme", 0));
    expect(docContexts).toEqual([]);
  });

  it("emits an empty payload after switching FROM an AFX doc to a non-AFX file", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/spec.md", SPEC_BODY));
    docContexts.length = 0;
    activeEditorListeners[0]?.(fakeEditor("/repo/src/main.ts", "code", 0, "typescript"));
    expect(docContexts.at(-1)).toMatchObject({
      format: null,
      section: null,
      docKind: null,
      feature: null,
      approvalStatus: null,
    });
  });

  it("dedupes consecutive identical payloads", () => {
    const editor = fakeEditor("/repo/docs/specs/auth/spec.md", SPEC_BODY);
    setupWith(editor);
    const first = docContexts.length;
    activeEditorListeners[0]?.(editor); // same editor again
    expect(docContexts.length).toBe(first);
  });
});
