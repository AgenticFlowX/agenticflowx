/**
 * Conflict-safe, per-source Workbench text mutations.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-18] [FR-20]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MUTATION-COORDINATOR]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-MUTATIONS]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DIRTY-CONFLICT]
 */
import { createHash } from "node:crypto";

import * as vscode from "vscode";

import type {
  WorkbenchMutationErrorCode,
  WorkbenchMutationResult,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
} from "@afx/shared";

import type { WorkbenchFileState } from "./workbench-file-state";

export interface WorkbenchTextMutation {
  requestId: string;
  target: WorkbenchSourceIdentity;
  expectedRevision?: string;
  allowCreate?: boolean;
  /** Permit a host-owned stream to advance its own revision-matched dirty buffer. */
  allowDirty?: boolean;
  requireMissing?: boolean;
  transform(content: string): string | Promise<string>;
}

export interface WorkbenchMutationCoordinator extends vscode.Disposable {
  mutateText(request: WorkbenchTextMutation): Promise<WorkbenchMutationResult>;
}

export interface WorkbenchMutationCoordinatorOptions {
  fileState: WorkbenchFileState;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function uriKey(uri: vscode.Uri): string {
  return `${uri.scheme}\u0000${uri.authority}\u0000${uri.path}`;
}

function endPosition(content: string): vscode.Position {
  const lines = content.split("\n");
  return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0);
}

function failure(
  request: Pick<WorkbenchTextMutation, "requestId" | "target">,
  outcome: "conflict" | "error",
  code: WorkbenchMutationErrorCode,
  message: string,
  retryable: boolean,
  revision?: WorkbenchSourceRevision,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome,
    target: request.target,
    code,
    message,
    retryable,
    ...(revision ? { revision } : {}),
  };
}

/**
 * Creates a coordinator whose FIFO lanes are independent per canonical URI.
 * A rejected operation never poisons the lane for later requests.
 *
 * @see docs/specs/227-app-workbench-shell/tasks.md [4.1]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [6.2]
 */
export function createWorkbenchMutationCoordinator(
  options: WorkbenchMutationCoordinatorOptions,
): WorkbenchMutationCoordinator {
  const tails = new Map<string, Promise<void>>();
  let disposed = false;

  const enqueue = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(
      () => current,
      () => current,
    );
    tails.set(key, tail);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (tails.get(key) === tail) tails.delete(key);
    }
  };

  const mutateText = async (request: WorkbenchTextMutation): Promise<WorkbenchMutationResult> => {
    if (disposed) {
      return failure(request, "error", "write-failed", "Mutation service is disposed.", true);
    }
    const uri = options.fileState.resolve(request.target);
    if (!uri) {
      return failure(
        request,
        "error",
        "outside-workspace",
        "The selected source is outside the current workspace.",
        false,
      );
    }

    return enqueue(uriKey(uri), async () => {
      const current = await options.fileState.readText(uri);
      if (current && request.requireMissing) {
        return failure(
          request,
          "error",
          "collision",
          "A file already exists at the selected destination.",
          false,
          current.sourceRevision,
        );
      }
      if (!current && !request.allowCreate) {
        return failure(
          request,
          "error",
          "not-found",
          "The selected source no longer exists.",
          true,
        );
      }
      if (current?.dirty && !request.allowDirty) {
        return failure(
          request,
          "conflict",
          "dirty-document",
          "The source has unsaved editor changes. Save or discard them, then retry.",
          true,
          current.sourceRevision,
        );
      }
      if (
        request.expectedRevision !== undefined &&
        current?.revision !== request.expectedRevision
      ) {
        return failure(
          request,
          "conflict",
          "stale-revision",
          "The source changed after this view loaded. Reload it before retrying.",
          true,
          current?.sourceRevision,
        );
      }

      let next: string;
      try {
        next = await request.transform(current?.content ?? "");
      } catch (error) {
        return failure(
          request,
          "error",
          "parse-error",
          error instanceof Error ? error.message : "The source could not be updated safely.",
          false,
          current?.sourceRevision,
        );
      }

      if (next === current?.content) {
        return {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "success",
          target: request.target,
          revision: current.sourceRevision,
        };
      }

      try {
        const openDocument = vscode.workspace.textDocuments.find(
          (document) => uriKey(document.uri) === uriKey(uri),
        );
        // Existing governed documents always flow through WorkspaceEdit, even
        // when closed, so VS Code can retain a native undo transaction.
        if (openDocument || current) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            uri,
            new vscode.Range(new vscode.Position(0, 0), endPosition(current?.content ?? "")),
            next,
          );
          const applied = await vscode.workspace.applyEdit(edit);
          if (!applied) throw new Error("VS Code rejected the workspace edit.");
        } else {
          if (!current) {
            const parent = vscode.Uri.joinPath(uri, "..");
            await vscode.workspace.fs.createDirectory(parent);
          }
          await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
        }
      } catch (error) {
        return failure(
          request,
          "error",
          "write-failed",
          error instanceof Error ? error.message : "The source could not be written.",
          true,
          current?.sourceRevision,
        );
      }

      const contentRevision = hashContent(next);
      const refreshed = await options.fileState.readText(uri);
      if (refreshed) {
        return {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "success",
          target: request.target,
          revision: refreshed.sourceRevision,
        };
      }
      const remainsOpen = vscode.workspace.textDocuments.some(
        (document) => uriKey(document.uri) === uriKey(uri),
      );
      return {
        type: "afxMutationResult",
        requestId: request.requestId,
        outcome: "success",
        target: request.target,
        revision: {
          contentRevision,
          diskRevision: remainsOpen ? current?.sourceRevision.diskRevision : contentRevision,
          documentVersion: current?.sourceRevision.documentVersion,
          dirty: remainsOpen,
        },
      };
    });
  };

  return {
    mutateText,
    dispose() {
      disposed = true;
      tails.clear();
    },
  };
}
