/**
 * Writes a typed relationship into a source document's frontmatter and
 * reconciles the canvas, for Spec Map draw-to-author and delete-to-remove.
 *
 * The document is authoritative: the edit is a surgical frontmatter list change
 * (`editFrontmatterList`, no YAML round-trip), trust-gated, conflict-aware
 * (`allowDirty: false`), and idempotent. On success the canvas is reconciled
 * through the same non-destructive indexer refresh used by Sync specs.
 *
 * @see docs/specs/230-app-workbench-spec-authoring/spec.md [FR-4] [FR-6] [FR-9]
 * @see docs/specs/230-app-workbench-spec-authoring/design.md [DES-API] [DES-SEC]
 */
import * as vscode from "vscode";

import { editFrontmatterList } from "@afx/parsers";
import type { WorkbenchMutationResult, WorkbenchSourceIdentity } from "@afx/shared";

import { type DocRelationship, type SpecDependencyIndexer } from "./spec-dependency-indexer";
import type { WorkbenchMutationCoordinator } from "./workbench-mutation-coordinator";

export interface DocGraphAuthorRequest {
  requestId: string;
  source: WorkbenchSourceIdentity;
  sourceExpectedRevision?: string;
  targetId: string;
  declaredToken?: string;
  relationship: DocRelationship;
  remove?: boolean;
  canvasTarget: WorkbenchSourceIdentity;
  canvasExpectedRevision?: string;
}

export interface DocGraphAuthorService {
  author(request: DocGraphAuthorRequest): Promise<WorkbenchMutationResult>;
}

export function createDocGraphAuthorService(options: {
  coordinator: WorkbenchMutationCoordinator;
  indexer: SpecDependencyIndexer;
  isWorkspaceTrusted?: () => boolean;
}): DocGraphAuthorService {
  const isWorkspaceTrusted = options.isWorkspaceTrusted ?? (() => vscode.workspace.isTrusted);
  return {
    async author(request) {
      if (!isWorkspaceTrusted()) {
        return failure(
          request.requestId,
          request.source,
          "untrusted-workspace",
          "Trust this workspace to author relationships from the canvas.",
        );
      }

      // 1) Surgical frontmatter edit on the source document (conflict-aware).
      const op = request.remove ? "remove" : "add";
      const targetToken = await options.indexer.resolveAuthorToken(
        request.targetId,
        request.source,
        request.remove ? request.declaredToken : undefined,
      );
      if (!targetToken) {
        return failure(
          request.requestId,
          request.source,
          "parse-error",
          "The relationship target is no longer a unique indexed document.",
        );
      }
      const edited = await options.coordinator.mutateText({
        requestId: request.requestId,
        target: request.source,
        expectedRevision: request.sourceExpectedRevision,
        allowDirty: false,
        transform: (content) => {
          const result = editFrontmatterList(content, request.relationship, targetToken, op);
          if (result.outcome === "unsupported") {
            throw new Error(
              `The ${request.relationship} value is not a supported YAML list and was not changed.`,
            );
          }
          return result.content;
        },
      });
      if (edited.outcome !== "success") return edited;

      // 2) Reconcile the canvas non-destructively from the updated frontmatter.
      const reconciled = await options.coordinator.mutateText({
        requestId: request.requestId,
        target: request.canvasTarget,
        expectedRevision: request.canvasExpectedRevision,
        allowDirty: true,
        transform: async (content) =>
          (await options.indexer.refresh(content, request.canvasTarget)).content,
      });
      return reconciled;
    },
  };
}

function failure(
  requestId: string,
  target: WorkbenchSourceIdentity,
  code: "untrusted-workspace" | "parse-error",
  message: string,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId,
    outcome: "error",
    target,
    code,
    message,
    retryable: true,
  };
}
