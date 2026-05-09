/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createMockLogger } from "../__fixtures__/mock-logger";
import { createSpecsDataProvider } from "./specs-data";

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

function mockWorkspaceTasks(rawTasks: string): void {
  vi.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
    if (uri.fsPath === "/workspace/docs") {
      return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
    }
    if (uri.fsPath === "/workspace/docs/specs/demo/tasks.md") {
      return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: rawTasks.length };
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
      return [["tasks.md", vscode.FileType.File]];
    }
    return [];
  });

  vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
    if (uri.fsPath === "/workspace/docs/specs/demo/tasks.md") {
      return Buffer.from(rawTasks);
    }
    throw new Error(`Missing fixture file: ${uri.fsPath}`);
  });
}

async function scanTasks(rawTasks: string) {
  mockWorkspaceTasks(rawTasks);
  const provider = createSpecsDataProvider(() => "/workspace", createMockLogger().logger);
  return provider.getPanelData();
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
});
