/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createMockLogger } from "../__fixtures__/mock-logger";
import { notesContentRevision } from "./notes-markdown";
import { createSpecsDataProvider } from "./specs-data";
import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";

const TASKS_WITH_ALL_OPEN = `---
afx: true
type: TASKS
status: Draft
---

# Demo Tasks

## Phase 1: Build

- [ ] First task
- [ ] Second task
- [ ] Third task

## Phase 2: Verify

- [ ] Fourth task
`;

const TASKS_WITH_EARLIER_DONE = TASKS_WITH_ALL_OPEN.replace("- [ ] First task", "- [x] First task");

function mockWorkspaceFile(filePath: string, rawContent: string): void {
  vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
    if (uri.fsPath === "/workspace/docs") {
      return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
    }
    if (uri.fsPath === filePath) {
      return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: rawContent.length };
    }
    throw new Error(`Missing fixture stat: ${uri.fsPath}`);
  });

  vi.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation(async (uri: vscode.Uri) => {
    if (uri.fsPath === "/workspace") {
      return [["docs", vscode.FileType.Directory]];
    }
    if (uri.fsPath === "/workspace/docs") {
      return [["specs", vscode.FileType.Directory]];
    }
    if (uri.fsPath === "/workspace/docs/specs") {
      return [["demo", vscode.FileType.Directory]];
    }
    if (uri.fsPath === "/workspace/docs/specs/demo") {
      return [[filePath.split("/").pop() ?? "tasks.md", vscode.FileType.File]];
    }
    return [];
  });

  vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
    if (uri.fsPath === filePath) {
      return Buffer.from(rawContent);
    }
    throw new Error(`Missing fixture file: ${uri.fsPath}`);
  });
}

function mockWorkspaceTasks(rawTasks: string): void {
  mockWorkspaceFile("/workspace/docs/specs/demo/tasks.md", rawTasks);
}

async function scanTasks(rawTasks: string) {
  mockWorkspaceTasks(rawTasks);
  const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger);
  return provider.getPanelData();
}

type TestTextSnapshot = Pick<
  WorkbenchTextSnapshot,
  "uri" | "content" | "revision" | "dirty" | "kind"
>;

function mockFileState(
  readText: (uri: vscode.Uri) => Promise<TestTextSnapshot | null>,
): WorkbenchFileState {
  const identify = (uri: vscode.Uri) => ({
    rootUri: "file:///workspace",
    rootName: "workspace",
    relativePath: uri.path.replace(/^\/workspace\//, ""),
  });
  return {
    classify: () => "docs",
    identify,
    resolve: (source) => vscode.Uri.file(`/workspace/${source.relativePath}`),
    async readText(uri) {
      const snapshot = await readText(uri);
      if (!snapshot) return null;
      const source = identify(uri);
      return {
        ...snapshot,
        source,
        sourceRevision: {
          contentRevision: snapshot.revision,
          diskRevision: snapshot.dirty ? undefined : snapshot.revision,
          dirty: snapshot.dirty,
        },
      };
    },
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
}

describe("createSpecsDataProvider task parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes stable WBS IDs from the original item index", async () => {
    const openPayload = await scanTasks(TASKS_WITH_ALL_OPEN);
    const openPhase = openPayload.featureTasks[0]?.phases[0];

    expect(
      openPhase?.items.map((item) => [item.text, item.completed, item.line, item.wbsId]),
    ).toEqual([
      ["First task", false, 11, "1.1"],
      ["Second task", false, 12, "1.2"],
      ["Third task", false, 13, "1.3"],
    ]);

    vi.restoreAllMocks();

    const completedPayload = await scanTasks(TASKS_WITH_EARLIER_DONE);
    const visibleOpenTasks = completedPayload.featureTasks[0]?.phases[0]?.items.filter(
      (item) => !item.completed,
    );

    expect(visibleOpenTasks?.map((item) => [item.text, item.wbsId])).toEqual([
      ["Second task", "1.2"],
      ["Third task", "1.3"],
    ]);
  });

  it("keeps existing task payload fields and counters intact", async () => {
    const payload = await scanTasks(TASKS_WITH_EARLIER_DONE);

    expect(payload.pipeline[0]).toMatchObject({
      name: "specs/demo",
      completed: 1,
      total: 4,
      tasksPath: "docs/specs/demo/tasks.md",
    });
    expect(payload.featureTasks[0]).toMatchObject({
      name: "specs/demo",
      completed: 1,
      total: 4,
      tasksPath: "docs/specs/demo/tasks.md",
      phases: [
        {
          number: 1,
          name: "Build",
          completed: 1,
          total: 3,
          line: 9,
        },
        {
          number: 2,
          name: "Verify",
          completed: 0,
          total: 1,
          line: 15,
        },
      ],
    });
  });

  it("keeps scanning when a document has malformed frontmatter", async () => {
    const rawSpec = `---
afx: true
type: SPEC
status: Draft
   owner: "@rixrix"
---

# Demo Spec

Body still belongs in the documents list.
`;

    mockWorkspaceFile("/workspace/docs/specs/demo/spec.md", rawSpec);
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger);
    const payload = await provider.getPanelData();

    expect(payload.documents[0]).toMatchObject({
      filePath: "docs/specs/demo/spec.md",
      type: "SPEC",
      isAfx: true,
      status: "Draft",
      owner: "@rixrix",
      excerpt: "Body still belongs in the documents list.",
    });
  });

  it("reads unsaved task content through the live document overlay", async () => {
    mockWorkspaceTasks(TASKS_WITH_ALL_OPEN);
    const liveTasks = TASKS_WITH_ALL_OPEN.replace("- [ ] First task", "- [x] First task");
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger, {
      fileState: mockFileState(async (uri) => ({
        uri,
        content: liveTasks,
        revision: "live",
        dirty: true,
        kind: "docs",
      })),
    });

    const payload = await provider.getPanelData();

    expect(payload.featureTasks[0]).toMatchObject({ completed: 1, total: 4 });
  });

  it("rescans before publishing when an older scan is superseded", async () => {
    mockWorkspaceTasks(TASKS_WITH_ALL_OPEN);
    let resolveFirst: ((snapshot: TestTextSnapshot) => void) | undefined;
    const firstRead = new Promise<TestTextSnapshot>((resolve) => {
      resolveFirst = resolve;
    });
    const latestTasks = TASKS_WITH_ALL_OPEN.replace("- [ ] First task", "- [x] First task");
    let taskReads = 0;
    const readText = vi.fn(async (uri: vscode.Uri): Promise<TestTextSnapshot | null> => {
      if (!uri.fsPath.endsWith("/docs/specs/demo/tasks.md")) return null;
      taskReads += 1;
      if (taskReads === 1) return firstRead;
      return {
        uri,
        content: latestTasks,
        revision: "latest",
        dirty: true,
        kind: "docs",
      };
    });
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger, {
      fileState: mockFileState(readText),
    });

    const pending = provider.getPanelData();
    await vi.waitFor(() => expect(readText).toHaveBeenCalledOnce());
    provider.refresh();
    resolveFirst?.({
      uri: vscode.Uri.file("/workspace/docs/specs/demo/tasks.md"),
      content: TASKS_WITH_ALL_OPEN,
      revision: "old",
      dirty: true,
      kind: "docs",
    });

    await expect(pending).resolves.toMatchObject({
      featureTasks: [expect.objectContaining({ completed: 1, total: 4 })],
    });
    expect(taskReads).toBe(2);
  });

  it("loads Notes in a workspace with no docs directory", async () => {
    const rawNotes = "## 2026-07-19\n\n### 03:00:00.000\n\nLive note\n";
    vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/.afx") {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      throw new Error(`Missing fixture stat: ${uri.fsPath}`);
    });
    vi.spyOn(vscode.workspace.fs, "readDirectory").mockResolvedValue([]);
    vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/.afx/notes.md") return Buffer.from(rawNotes);
      throw new Error(`Missing fixture file: ${uri.fsPath}`);
    });
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger);

    const payload = await provider.getPanelData();

    expect(payload.pipeline).toEqual([]);
    expect(payload.notes).toEqual([
      expect.objectContaining({ id: expect.any(String), text: "Live note", date: "2026-07-19" }),
    ]);
    expect(payload.notesSources).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ rootName: "workspace", relativePath: ".afx/notes.md" }),
        revision: {
          contentRevision: notesContentRevision(rawNotes),
          diskRevision: notesContentRevision(rawNotes),
          dirty: false,
        },
        scanGeneration: 0,
      }),
    ]);
  });

  it("loads unsaved Board and Notes buffers without a docs directory", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/.afx") {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      throw new Error(`Missing fixture stat: ${uri.fsPath}`);
    });
    vi.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/.afx/kanban") {
        return [["live.md", vscode.FileType.File]];
      }
      return [];
    });
    const fileState = mockFileState(async (uri) => {
      if (uri.fsPath === "/workspace/.afx/kanban/live.md") {
        return {
          uri,
          content: "## Doing\n\n- Unsaved card\n",
          revision: "board-live",
          dirty: true,
          kind: "board",
        };
      }
      if (uri.fsPath === "/workspace/.afx/notes.md") {
        return {
          uri,
          content: "## 2026-07-19\n\n### 03:00:00.000\n\nUnsaved note\n",
          revision: "notes-live",
          dirty: true,
          kind: "notes",
        };
      }
      return null;
    });
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger, {
      fileState,
    });

    const payload = await provider.getPanelData();

    expect(payload.kanban?.boards[0]).toMatchObject({
      name: "live",
      columns: [{ title: "Doing", cards: [{ text: "Unsaved card" }] }],
    });
    expect(payload.notes).toEqual([expect.objectContaining({ text: "Unsaved note" })]);
  });

  it("keeps named-root identity when scanning a second workspace folder", async () => {
    const secondRoot = vscode.Uri.file("/second");
    const tasksPath = "/second/docs/specs/demo/tasks.md";
    vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/second/docs") {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      if (uri.fsPath === tasksPath) {
        return {
          type: vscode.FileType.File,
          ctime: 0,
          mtime: 0,
          size: TASKS_WITH_ALL_OPEN.length,
        };
      }
      throw new Error(`Missing fixture stat: ${uri.fsPath}`);
    });
    vi.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/first" || uri.fsPath === "/second") return [];
      if (uri.fsPath === "/second/docs") return [["specs", vscode.FileType.Directory]];
      if (uri.fsPath === "/second/docs/specs") return [["demo", vscode.FileType.Directory]];
      if (uri.fsPath === "/second/docs/specs/demo") {
        return [["tasks.md", vscode.FileType.File]];
      }
      return [];
    });
    vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === tasksPath) return Buffer.from(TASKS_WITH_ALL_OPEN);
      throw new Error(`Missing fixture file: ${uri.fsPath}`);
    });
    const provider = createSpecsDataProvider(() => "/first", createMockLogger().logger, {
      getWorkspaceFolders: () => [
        { uri: vscode.Uri.file("/first"), name: "first", index: 0 },
        { uri: secondRoot, name: "second", index: 1 },
      ],
    });

    const payload = await provider.getPanelData();

    expect(payload.pipeline[0]).toMatchObject({
      name: "specs/demo",
      tasksPath: "second/docs/specs/demo/tasks.md",
    });
  });

  it("returns an explicit creatable Notes target for every workspace root", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockRejectedValue(new Error("missing"));
    vi.spyOn(vscode.workspace.fs, "readDirectory").mockResolvedValue([]);
    vi.spyOn(vscode.workspace.fs, "readFile").mockRejectedValue(new Error("missing"));
    const provider = createSpecsDataProvider(() => "/first", createMockLogger().logger, {
      getWorkspaceFolders: () => [
        { uri: vscode.Uri.file("/first"), name: "first", index: 0 },
        { uri: vscode.Uri.file("/second"), name: "second", index: 1 },
      ],
    });

    const payload = await provider.getPanelData();

    expect(payload.notesSources).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ rootName: "first", relativePath: ".afx/notes.md" }),
        revision: { contentRevision: "", dirty: false },
        notes: [],
      }),
      expect.objectContaining({
        source: expect.objectContaining({ rootName: "second", relativePath: ".afx/notes.md" }),
        revision: { contentRevision: "", dirty: false },
        notes: [],
      }),
    ]);
  });

  it("keeps separate nested and named-root Notes identities", async () => {
    const rootNotes = "## 2026-07-19\n### 09:00:00.000\nRoot note\n";
    const nestedNotes = "## 2026-07-19\n### 10:00:00.000\nNested note\n";
    vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/project/.afx") {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      throw new Error("missing");
    });
    vi.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace") return [["project", vscode.FileType.Directory]];
      return [];
    });
    vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/.afx/notes.md") return Buffer.from(rootNotes);
      if (uri.fsPath === "/workspace/project/.afx/notes.md") return Buffer.from(nestedNotes);
      throw new Error("missing");
    });
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger);

    const payload = await provider.getPanelData();

    expect(payload.notesSources).toHaveLength(2);
    expect(payload.notesSources.map((snapshot) => snapshot.source.relativePath)).toEqual([
      ".afx/notes.md",
      "project/.afx/notes.md",
    ]);
    expect(payload.notesSources.map((snapshot) => snapshot.notes[0]?.text)).toEqual([
      "Root note",
      "Nested note",
    ]);
  });

  it("retains the last valid timeline for a malformed unsaved revision", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
      if (uri.fsPath === "/workspace/.afx") {
        return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
      }
      throw new Error("missing");
    });
    vi.spyOn(vscode.workspace.fs, "readDirectory").mockResolvedValue([]);
    const valid = "## 2026-07-19\n### 11:00:00.000\nKeep visible\n";
    let content = valid;
    const fileState = mockFileState(async (uri) => ({
      uri,
      content,
      revision: notesContentRevision(content),
      dirty: content !== valid,
      kind: "notes",
    }));
    const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger, {
      fileState,
    });

    const first = await provider.getPanelData();
    expect(first.notesSources[0]?.notes[0]?.text).toBe("Keep visible");

    content = "---\nafx: true\n## 2026-07-19\n### 11:00:00.000\nBroken draft\n";
    provider.refresh();
    const second = await provider.getPanelData();

    expect(second.notesSources[0]).toMatchObject({
      notes: [expect.objectContaining({ text: "Keep visible" })],
      parseError: "Unterminated YAML frontmatter.",
      revision: { dirty: true },
    });
  });
});
