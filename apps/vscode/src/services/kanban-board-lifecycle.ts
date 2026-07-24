/**
 * Revision-aware lifecycle operations for portable Markdown boards.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-2] [FR-7] [FR-11] [NFR-5]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-SAVE] [DES-API]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MUTATION-COORDINATOR]
 */
import * as path from "node:path";

import * as vscode from "vscode";

import type {
  WorkbenchMutationResult,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
} from "@afx/shared";

import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";
import type { WorkbenchMutationCoordinator } from "./workbench-mutation-coordinator";

const KANBAN_DIR = ".afx/kanban";

export interface KanbanBoardLifecycleService {
  create(request: {
    requestId: string;
    targetRootUri: string;
    name: string;
  }): Promise<WorkbenchMutationResult>;
  rename(request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
    name: string;
  }): Promise<WorkbenchMutationResult>;
  delete(request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
  }): Promise<WorkbenchMutationResult>;
}

/**
 * Creates the canonical, multi-root Board lifecycle service. Existing sources
 * are revision checked before file creation/removal and every call resolves to
 * one structured terminal result.
 *
 * @see docs/specs/221-app-workbench-board/tasks.md [2.1] [2.2]
 */
export function createKanbanBoardLifecycleService(options: {
  fileState: WorkbenchFileState;
  coordinator: WorkbenchMutationCoordinator;
  getWorkspaceFolders?: () => readonly vscode.WorkspaceFolder[] | undefined;
}): KanbanBoardLifecycleService {
  const getWorkspaceFolders =
    options.getWorkspaceFolders ?? (() => vscode.workspace.workspaceFolders);

  const create = async (request: {
    requestId: string;
    targetRootUri: string;
    name: string;
  }): Promise<WorkbenchMutationResult> => {
    const folder = (getWorkspaceFolders() ?? []).find(
      (candidate) => serializeUri(candidate.uri) === request.targetRootUri,
    );
    const filename = boardFilename(request.name);
    const target: WorkbenchSourceIdentity = {
      rootUri: request.targetRootUri,
      rootName: folder?.name ?? "workspace",
      relativePath: `${KANBAN_DIR}/${filename ?? "invalid-board.md"}`,
    };
    if (!folder) {
      return errorResult(
        requestWithTarget(request, target),
        "outside-workspace",
        "Choose a workspace folder for the new board.",
        false,
      );
    }
    if (!filename || !validTitle(request.name)) {
      return errorResult(
        requestWithTarget(request, target),
        "parse-error",
        "Board name must contain letters or numbers on one line.",
        false,
      );
    }
    return options.coordinator.mutateText({
      requestId: request.requestId,
      target,
      allowCreate: true,
      requireMissing: true,
      transform: () => starterBoard(request.name.trim()),
    });
  };

  const rename = async (request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
    name: string;
  }): Promise<WorkbenchMutationResult> => {
    const filename = boardFilename(request.name);
    if (!filename || !validTitle(request.name)) {
      return errorResult(
        request,
        "parse-error",
        "Board name must contain letters or numbers on one line.",
        false,
      );
    }
    const current = await validateExisting(options.fileState, request);
    if (!current.ok) return current.result;

    const target: WorkbenchSourceIdentity = {
      ...request.target,
      relativePath: path.posix.join(path.posix.dirname(request.target.relativePath), filename),
    };
    const transform = (content: string): string => updateBoardTitle(content, request.name.trim());
    if (target.relativePath === request.target.relativePath) {
      return options.coordinator.mutateText({
        requestId: request.requestId,
        target: request.target,
        expectedRevision: request.expectedRevision,
        transform,
      });
    }

    const written = await options.coordinator.mutateText({
      requestId: request.requestId,
      target,
      allowCreate: true,
      requireMissing: true,
      transform: () => transform(current.snapshot.content),
    });
    if (written.outcome !== "success") return written;

    const latest = await validateExisting(options.fileState, request);
    if (!latest.ok) {
      await removeCreatedTarget(options.fileState, target);
      return latest.result;
    }
    try {
      await vscode.workspace.fs.delete(latest.snapshot.uri);
    } catch (cause) {
      await removeCreatedTarget(options.fileState, target);
      return errorResult(
        request,
        "write-failed",
        cause instanceof Error ? cause.message : "Board could not be renamed.",
        true,
      );
    }
    return { ...written, target };
  };

  const remove = async (request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
  }): Promise<WorkbenchMutationResult> => {
    const current = await validateExisting(options.fileState, request);
    if (!current.ok) return current.result;
    try {
      await vscode.workspace.fs.delete(current.snapshot.uri);
    } catch (cause) {
      return errorResult(
        request,
        "write-failed",
        cause instanceof Error ? cause.message : "Board could not be deleted.",
        true,
      );
    }
    return successResult(request, current.snapshot.sourceRevision);
  };

  return { create, rename, delete: remove };
}

async function validateExisting(
  fileState: WorkbenchFileState,
  request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
  },
): Promise<
  { ok: true; snapshot: WorkbenchTextSnapshot } | { ok: false; result: WorkbenchMutationResult }
> {
  const uri = fileState.resolve(request.target);
  if (!uri) {
    return {
      ok: false,
      result: errorResult(
        request,
        "outside-workspace",
        "The selected board is outside the current workspace.",
        false,
      ),
    };
  }
  const snapshot = await fileState.readText(uri);
  if (!snapshot) {
    return {
      ok: false,
      result: errorResult(request, "not-found", "The selected board no longer exists.", true),
    };
  }
  if (snapshot.dirty) {
    return {
      ok: false,
      result: conflictResult(
        request,
        "dirty-document",
        "Save or discard the open board editor before retrying.",
        snapshot.sourceRevision,
      ),
    };
  }
  if (snapshot.revision !== request.expectedRevision) {
    return {
      ok: false,
      result: conflictResult(
        request,
        "stale-revision",
        "The board changed after this view loaded. Reload it before retrying.",
        snapshot.sourceRevision,
      ),
    };
  }
  return { ok: true, snapshot };
}

async function removeCreatedTarget(
  fileState: WorkbenchFileState,
  target: WorkbenchSourceIdentity,
): Promise<void> {
  const uri = fileState.resolve(target);
  if (uri) await Promise.resolve(vscode.workspace.fs.delete(uri)).catch(() => undefined);
}

function validTitle(value: string): boolean {
  return Boolean(value.trim()) && !/[\r\n]/.test(value);
}

function boardFilename(value: string): string | undefined {
  const stem = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem ? `${stem}.md` : undefined;
}

function starterBoard(title: string): string {
  const escaped = title.replace(/"/g, '\\"');
  return `---\nafx: true\ntype: KANBAN\ntitle: "${escaped}"\nstatus: active\n---\n\n# ${title}\n\n## Backlog\n\n## In Progress\n\n## Review\n\n## Done\n`;
}

function updateBoardTitle(content: string, title: string): string {
  const escaped = title.replace(/"/g, '\\"');
  const withTitle = content.replace(/^title:\s*.*$/m, `title: "${escaped}"`);
  return withTitle.replace(/^#(?!#)\s+.*$/m, `# ${title}`);
}

function serializeUri(uri: vscode.Uri): string {
  const rendered = uri.toString();
  return rendered && rendered !== "[object Object]"
    ? rendered
    : `${uri.scheme || "file"}://${uri.authority ?? ""}${uri.path}`;
}

function requestWithTarget(
  request: { requestId: string },
  target: WorkbenchSourceIdentity,
): { requestId: string; target: WorkbenchSourceIdentity } {
  return { requestId: request.requestId, target };
}

function successResult(
  request: { requestId: string; target: WorkbenchSourceIdentity },
  revision: WorkbenchSourceRevision,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "success",
    target: request.target,
    revision,
  };
}

function conflictResult(
  request: { requestId: string; target: WorkbenchSourceIdentity },
  code: "dirty-document" | "stale-revision",
  message: string,
  revision: WorkbenchSourceRevision,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "conflict",
    target: request.target,
    code,
    message,
    revision,
    retryable: true,
  };
}

function errorResult(
  request: { requestId: string; target: WorkbenchSourceIdentity },
  code: "outside-workspace" | "not-found" | "collision" | "parse-error" | "write-failed",
  message: string,
  retryable: boolean,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "error",
    target: request.target,
    code,
    message,
    retryable,
  };
}
