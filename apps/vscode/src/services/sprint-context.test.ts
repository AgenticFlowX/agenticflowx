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

const SPEC_WITH_FOCUSES_BODY = `---
afx: true
type: SPEC
status: Draft
---

# Spec

## Functional Requirements
The composer keeps long labels compact while tooltips show the body preview.

## Non-Functional Requirements
`;

const SPRINT_WITH_FOCUSES_BODY = [
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
  "## Functional Requirements",
  "<!-- SPRINT-SECTION-END: SPEC -->",
  "",
  "<!-- SPRINT-SECTION-START: DESIGN -->",
  "## 2. Design",
  "## [DES-DATA] Data Model",
  "Design body preview for the active section.",
  "```md",
  "## [DES-FAKE] Fake",
  "```",
  "<!-- SPRINT-SECTION-END: DESIGN -->",
  "",
  "<!-- SPRINT-SECTION-START: TASKS -->",
  "## 3. Tasks",
  "### Phase 2: Bridge",
  "<!-- SPRINT-SECTION-END: TASKS -->",
].join("\n");

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

const TEMPLATE_TASKS_BODY = `---
afx: true
type: TASKS
status: Approved
---

# Tasks

## Task Numbering Convention

- **1.x** - Build

## Phase 1: Build

### 1.1 First group

- [x] Existing implemented task
- [ ] Open follow-up task

## Phase 2: Verify

### 2.1 Verify group

- [x] Completed verification task
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
        filePath: "/repo/docs/specs/foo/foo.md",
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
      filePath: "/repo/docs/specs/auth/spec.md",
      approvalStatus: "Draft",
    });
  });

  it("emits the real active file path instead of deriving it from the feature", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/research/ADR-local.md", ADR_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "adr",
      feature: "auth",
      filePath: "/repo/docs/specs/auth/research/ADR-local.md",
      approvalStatus: "Accepted",
    });
  });

  it("detects AFX docs when the active editor path uses Windows separators", () => {
    setupWith(fakeEditor("C:\\repo\\docs\\specs\\auth\\spec.md", SPEC_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      feature: "auth",
      filePath: "C:\\repo\\docs\\specs\\auth\\spec.md",
      approvalStatus: "Draft",
    });
  });

  it("adds parsedFocuses for standard spec/design/tasks documents when headings are present", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/spec.md", SPEC_WITH_FOCUSES_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "spec",
      parsedFocuses: [
        {
          id: "functional-requirements",
          label: "Functional Requirements",
          slug: "functional-requirements",
          excerpt: "The composer keeps long labels compact while tooltips show the body preview.",
          line: 9,
        },
      ],
    });
  });

  it("adds afx-task template phase rows to standard tasks active-doc context", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/tasks.md", TEMPLATE_TASKS_BODY));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      section: "TASKS",
      docKind: "tasks",
      feature: "auth",
      approvalStatus: "Approved",
      tasksCompleted: 1,
      tasksTotal: 2,
      taskPhases: [
        {
          number: 1,
          name: "Build",
          completed: 0,
          total: 1,
          items: [{ text: "First group", completed: false, wbsId: "1.1" }],
        },
        {
          number: 2,
          name: "Verify",
          completed: 1,
          total: 1,
          items: [{ text: "Verify group", completed: true, wbsId: "2.1" }],
        },
      ],
    });
    expect(JSON.stringify(docContexts.at(-1))).not.toContain("Task Numbering Convention");
  });

  it("adds parsedFocuses from only the active sprint section", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/auth.md", SPRINT_WITH_FOCUSES_BODY, 15));
    expect(docContexts.at(-1)).toMatchObject({
      format: "sprint",
      section: "DESIGN",
      docKind: "design",
      parsedFocuses: [
        {
          id: "des-data",
          label: "DES-DATA: Data Model",
          slug: "des-data-data-model",
          commandSuffix: "des-data",
          excerpt: "Design body preview for the active section.",
          line: 16,
        },
      ],
    });
  });

  it("omits parsedFocuses when no focus headings apply", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/spec.md", SPEC_BODY));
    expect(docContexts.at(-1)).not.toHaveProperty("parsedFocuses");
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

  it("re-emits when only the active file path changes", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/research/ADR-one.md", ADR_BODY));
    docContexts.length = 0;

    activeEditorListeners[0]?.(fakeEditor("/repo/docs/specs/auth/research/ADR-two.md", ADR_BODY));

    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "adr",
      feature: "auth",
      filePath: "/repo/docs/specs/auth/research/ADR-two.md",
      approvalStatus: "Accepted",
    });
  });

  // ---------------------------------------------------------------------------
  // signOff payload — populated only for standard tasks.md so the composer
  // can render the brass `[Sign Off ▾]` action when the file is human-ready.
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  // @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
  // ---------------------------------------------------------------------------

  const SIGN_OFF_READY_TASKS = `---
afx: true
type: TASKS
status: Approved
updated_at: 2026-05-08T01:00:00.000Z
---

# Tasks

## Phase 1: Build

- [x] First task
- [x] Second task

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-05-09 | 1.1 | Coded | src/a.ts | [x] | [ ] |
`;

  it("populates signOff for standard tasks.md so the composer can render Sign Off", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/tasks.md", SIGN_OFF_READY_TASKS));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "tasks",
      signOff: {
        ready: true,
        allTasksChecked: true,
        allAgentVerified: true,
        pendingHumanRows: 1,
        alreadyLiving: false,
      },
    });
  });

  it("omits signOff for non-tasks docKinds (NFR-8 payload economy)", () => {
    setupWith(fakeEditor("/repo/docs/specs/auth/spec.md", SPEC_BODY));
    expect(docContexts.at(-1)).not.toHaveProperty("signOff");

    activeEditorListeners[0]?.(fakeEditor("/repo/docs/specs/auth/journal.md", JOURNAL_BODY));
    expect(docContexts.at(-1)).not.toHaveProperty("signOff");

    activeEditorListeners[0]?.(fakeEditor("/repo/docs/specs/auth/research/ADR-x.md", ADR_BODY));
    expect(docContexts.at(-1)).not.toHaveProperty("signOff");
  });

  it("omits signOff on sprint files until sprint sign-off lands", () => {
    setupWith(fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 20)); // cursor in TASKS
    expect(docContexts.at(-1)).toMatchObject({ format: "sprint", docKind: "tasks" });
    expect(docContexts.at(-1)).not.toHaveProperty("signOff");
  });

  // ---------------------------------------------------------------------------
  // Sibling spec/design/tasks frontmatter status — drives the FR-16 breadcrumb.
  // Sprint files derive the same shape from the in-file `approval` block.
  //   @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  //   @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
  // ---------------------------------------------------------------------------

  it("derives sibling spec/design/tasks status from a sprint file's approval block", () => {
    const sprintWithApproval = [
      "---",
      "afx: true",
      "type: SPRINT",
      "status: Living",
      "approval:",
      "  spec: Approved",
      "  design: Draft",
      "  tasks: Approved",
      "---",
      "",
      "<!-- SPRINT-SECTION-START: SPEC -->",
      "## 1. Spec",
      "<!-- SPRINT-SECTION-END: SPEC -->",
      "",
      "<!-- SPRINT-SECTION-START: DESIGN -->",
      "## 2. Design",
      "<!-- SPRINT-SECTION-END: DESIGN -->",
      "",
      "<!-- SPRINT-SECTION-START: TASKS -->",
      "## 3. Tasks",
      "<!-- SPRINT-SECTION-END: TASKS -->",
    ].join("\n");

    setupWith(fakeEditor("/repo/docs/specs/foo/foo.md", sprintWithApproval, 11));
    expect(docContexts.at(-1)).toMatchObject({
      format: "sprint",
      docKind: "spec",
      specStatus: "Approved",
      designStatus: "Draft",
      tasksStatus: "Approved",
    });
  });

  it("omits sibling-status fields when no approval block is present", () => {
    setupWith(fakeEditor("/repo/docs/specs/foo/foo.md", SPRINT_BODY, 10));
    const ctx = docContexts.at(-1) as Record<string, unknown>;
    expect(ctx["specStatus"]).toBeUndefined();
    expect(ctx["designStatus"]).toBeUndefined();
    expect(ctx["tasksStatus"]).toBeUndefined();
  });

  it("treats `- []` empty-bracket task rows as unchecked when rolling up groups", () => {
    // Mirrors a real user file where one sub-checkbox uses zero-char
    // bracket form. The group must report `completed: false` so the
    // Code/Pick menus continue to surface the WBS row.
    const tasksWithEmptyBracket = `---
afx: true
type: TASKS
status: Approved
---

# Tasks

## Phase 2: Entry Form

### 2.1 Build issue entry form

- [x] Right column: form card
- [x] Top row: 2-column grid
- [] "Add event" submit button: primary style, full width
`;

    setupWith(fakeEditor("/repo/docs/specs/auth/tasks.md", tasksWithEmptyBracket));
    expect(docContexts.at(-1)).toMatchObject({
      format: "standard",
      docKind: "tasks",
      tasksCompleted: 0,
      tasksTotal: 1,
      taskPhases: [
        {
          number: 2,
          name: "Entry Form",
          completed: 0,
          total: 1,
          items: [
            {
              text: "Build issue entry form",
              completed: false,
              wbsId: "2.1",
            },
          ],
        },
      ],
    });
  });
});
