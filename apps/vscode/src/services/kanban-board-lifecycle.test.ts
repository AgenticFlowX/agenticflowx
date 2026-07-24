/**
 * @see docs/specs/221-app-workbench-board/design.md [DES-API] [DES-TEST]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MUTATION-COORDINATOR]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchMutationResult, WorkbenchSourceIdentity } from "@afx/shared";

import { createKanbanBoardLifecycleService } from "./kanban-board-lifecycle";
import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";
import type {
  WorkbenchMutationCoordinator,
  WorkbenchTextMutation,
} from "./workbench-mutation-coordinator";

const roots = [
  { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
  { uri: vscode.Uri.file("/other"), name: "other", index: 1 },
] as vscode.WorkspaceFolder[];

function sourceFor(uri: vscode.Uri): WorkbenchSourceIdentity | undefined {
  const root = roots.find(
    (candidate) => uri.path === candidate.uri.path || uri.path.startsWith(`${candidate.uri.path}/`),
  );
  if (!root) return undefined;
  return {
    rootUri: `file://${root.uri.path}`,
    rootName: root.name,
    relativePath: uri.path.slice(root.uri.path.length).replace(/^\//, ""),
  };
}

function resolve(source: WorkbenchSourceIdentity): vscode.Uri | undefined {
  const root = roots.find((candidate) => `file://${candidate.uri.path}` === source.rootUri);
  return root ? vscode.Uri.joinPath(root.uri, source.relativePath) : undefined;
}

function snapshot(
  uri: vscode.Uri,
  content = '---\ntitle: "Roadmap"\n---\n\n# Roadmap\n\n## Todo\n',
): WorkbenchTextSnapshot {
  return {
    uri,
    content,
    revision: "rev-1",
    dirty: false,
    kind: "board",
    source: sourceFor(uri)!,
    sourceRevision: { contentRevision: "rev-1", diskRevision: "rev-1", dirty: false },
  };
}

function fileState(
  readText: (uri: vscode.Uri) => Promise<WorkbenchTextSnapshot | null> = async (uri) =>
    snapshot(uri),
): WorkbenchFileState {
  return {
    classify: () => "board",
    identify: sourceFor,
    resolve,
    readText,
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
}

function coordinator(
  implementation?: (request: WorkbenchTextMutation) => Promise<WorkbenchMutationResult>,
): WorkbenchMutationCoordinator {
  return {
    mutateText: vi.fn(
      implementation ??
        (async (request) => ({
          type: "afxMutationResult" as const,
          requestId: request.requestId,
          outcome: "success" as const,
          target: request.target,
          revision: { contentRevision: "next", diskRevision: "next", dirty: false },
        })),
    ),
    dispose() {},
  };
}

describe("createKanbanBoardLifecycleService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates in the exact requested workspace root with a collision guard", async () => {
    const mutations: WorkbenchTextMutation[] = [];
    const service = createKanbanBoardLifecycleService({
      fileState: fileState(async () => null),
      coordinator: coordinator(async (request) => {
        mutations.push(request);
        return {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "success",
          target: request.target,
          revision: { contentRevision: "next", diskRevision: "next", dirty: false },
        };
      }),
      getWorkspaceFolders: () => roots,
    });

    const result = await service.create({
      requestId: "create-other",
      targetRootUri: "file:///other",
      name: "Release Train",
    });

    expect(result).toMatchObject({
      requestId: "create-other",
      outcome: "success",
      target: {
        rootUri: "file:///other",
        rootName: "other",
        relativePath: ".afx/kanban/release-train.md",
      },
    });
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({ allowCreate: true, requireMissing: true });
    await expect(Promise.resolve(mutations[0]!.transform(""))).resolves.toContain(
      "# Release Train",
    );
  });

  it("returns structured errors for invalid names and unknown roots without writing", async () => {
    const writes = coordinator();
    const service = createKanbanBoardLifecycleService({
      fileState: fileState(),
      coordinator: writes,
      getWorkspaceFolders: () => roots,
    });

    await expect(
      service.create({ requestId: "invalid", targetRootUri: "file:///other", name: "---" }),
    ).resolves.toMatchObject({
      requestId: "invalid",
      outcome: "error",
      code: "parse-error",
      retryable: false,
    });
    await expect(
      service.create({ requestId: "missing-root", targetRootUri: "file:///gone", name: "Plan" }),
    ).resolves.toMatchObject({
      requestId: "missing-root",
      outcome: "error",
      code: "outside-workspace",
      retryable: false,
    });
    expect(writes.mutateText).not.toHaveBeenCalled();
  });

  it("renames in the target's own root and preserves the expected-revision gate", async () => {
    const source = sourceFor(vscode.Uri.file("/other/.afx/kanban/roadmap.md"))!;
    const mutations: WorkbenchTextMutation[] = [];
    const writes = coordinator(async (request) => {
      mutations.push(request);
      return {
        type: "afxMutationResult",
        requestId: request.requestId,
        outcome: "success",
        target: request.target,
        revision: { contentRevision: "next", diskRevision: "next", dirty: false },
      };
    });
    const removed: string[] = [];
    vi.spyOn(vscode.workspace.fs, "delete").mockImplementation(async (uri) => {
      removed.push(uri.fsPath);
    });
    const service = createKanbanBoardLifecycleService({
      fileState: fileState(),
      coordinator: writes,
      getWorkspaceFolders: () => roots,
    });

    const result = await service.rename({
      requestId: "rename-other",
      target: source,
      expectedRevision: "rev-1",
      name: "Delivery Plan",
    });

    expect(result).toMatchObject({
      requestId: "rename-other",
      outcome: "success",
      target: {
        rootUri: "file:///other",
        relativePath: ".afx/kanban/delivery-plan.md",
      },
    });
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      target: { rootUri: "file:///other", relativePath: ".afx/kanban/delivery-plan.md" },
      allowCreate: true,
      requireMissing: true,
    });
    await expect(Promise.resolve(mutations[0]!.transform(""))).resolves.toContain(
      "# Delivery Plan",
    );
    expect(removed).toEqual(["/other/.afx/kanban/roadmap.md"]);
  });

  it("rejects stale, dirty, and missing board lifecycle operations before deletion", async () => {
    const source = sourceFor(vscode.Uri.file("/other/.afx/kanban/roadmap.md"))!;
    const remove = vi.spyOn(vscode.workspace.fs, "delete");
    const stale = createKanbanBoardLifecycleService({
      fileState: fileState(),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });
    const dirty = createKanbanBoardLifecycleService({
      fileState: fileState(async (uri) => ({
        ...snapshot(uri),
        dirty: true,
        sourceRevision: { contentRevision: "rev-1", diskRevision: "disk", dirty: true },
      })),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });
    const missing = createKanbanBoardLifecycleService({
      fileState: fileState(async () => null),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });

    await expect(
      stale.delete({ requestId: "stale", target: source, expectedRevision: "old" }),
    ).resolves.toMatchObject({ outcome: "conflict", code: "stale-revision" });
    await expect(
      dirty.delete({ requestId: "dirty", target: source, expectedRevision: "rev-1" }),
    ).resolves.toMatchObject({ outcome: "conflict", code: "dirty-document" });
    await expect(
      missing.delete({ requestId: "missing", target: source, expectedRevision: "rev-1" }),
    ).resolves.toMatchObject({ outcome: "error", code: "not-found" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes only the canonical target and returns one acknowledged success", async () => {
    const source = sourceFor(vscode.Uri.file("/other/.afx/kanban/roadmap.md"))!;
    const remove = vi.spyOn(vscode.workspace.fs, "delete").mockResolvedValue(undefined);
    const service = createKanbanBoardLifecycleService({
      fileState: fileState(),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });

    await expect(
      service.delete({ requestId: "delete-other", target: source, expectedRevision: "rev-1" }),
    ).resolves.toEqual({
      type: "afxMutationResult",
      requestId: "delete-other",
      outcome: "success",
      target: source,
      revision: { contentRevision: "rev-1", diskRevision: "rev-1", dirty: false },
    });
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(vscode.Uri.file("/other/.afx/kanban/roadmap.md"));
  });
});
