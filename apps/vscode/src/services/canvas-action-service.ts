/**
 * Explicit execution boundary for untrusted AFX Canvas action metadata.
 *
 * The service never dispatches arbitrary shell or VS Code commands. Callers
 * provide one typed capability for each supported action, and this boundary
 * verifies workspace trust, the exact persisted metadata/revision, and an
 * explicit confirmation before invoking that capability.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-33] [NFR-8]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-SEC]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [12.2]
 */
import * as vscode from "vscode";

import { parseCanvasAction, parseJSONCanvas } from "@afx/canvas-engine";
import type {
  CanvasActionMetadata,
  CanvasNode,
  WorkbenchMutationErrorCode,
  WorkbenchMutationResult,
  WorkbenchOutbound,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
} from "@afx/shared";

import type { WorkbenchFileState } from "./workbench-file-state";

export type CanvasActionRunRequest = Extract<WorkbenchOutbound, { type: "afxCanvasRunAction" }>;

export interface CanvasActionExecutionContext {
  target: WorkbenchSourceIdentity;
  revision: WorkbenchSourceRevision;
  action: CanvasActionMetadata;
  nodes: readonly CanvasNode[];
}

export type CanvasActionHandler = (context: CanvasActionExecutionContext) => void | Promise<void>;

/**
 * Capabilities are named rather than expressed as a command string so Canvas
 * files cannot choose a shell command or a VS Code command identifier.
 */
export type CanvasActionCapabilities = Partial<
  Record<CanvasActionMetadata["action"], CanvasActionHandler>
>;

export interface CanvasActionServiceOptions {
  fileState: WorkbenchFileState;
  capabilities: CanvasActionCapabilities;
  isWorkspaceTrusted?: () => boolean;
}

export interface CanvasActionService {
  run(request: CanvasActionRunRequest): Promise<WorkbenchMutationResult>;
}

export function createCanvasActionService(
  options: CanvasActionServiceOptions,
): CanvasActionService {
  const isWorkspaceTrusted = options.isWorkspaceTrusted ?? (() => vscode.workspace.isTrusted);

  return {
    async run(request) {
      if (!request.confirmed) {
        return failure(
          request,
          "confirmation-required",
          "Confirm the exact Canvas action before running it.",
          false,
        );
      }
      if (!isWorkspaceTrusted()) {
        return failure(
          request,
          "untrusted-workspace",
          "Trust this workspace before running Canvas actions.",
          true,
        );
      }

      const action = parseCanvasAction(request.action);
      if (!action || !sameAction(action, request.action)) {
        return failure(
          request,
          "unsupported-action",
          "This Canvas action is malformed or is not on the AFX allowlist.",
          false,
        );
      }
      const nodeIds = uniqueNodeIds(request.nodeIds);
      if (!nodeIds) {
        return failure(
          request,
          "unsupported-action",
          "Canvas actions require one or more unique node IDs.",
          false,
        );
      }

      const uri = options.fileState.resolve(request.target);
      if (!uri) {
        return failure(
          request,
          "outside-workspace",
          "The Canvas is outside the current workspace.",
          false,
        );
      }
      const snapshot = await options.fileState.readText(uri);
      if (!snapshot) {
        return failure(request, "not-found", "The Canvas no longer exists.", true);
      }
      if (snapshot.sourceRevision.contentRevision !== request.expectedRevision) {
        return failure(
          request,
          "stale-revision",
          "The Canvas changed after the action was confirmed. Reload and confirm it again.",
          true,
          snapshot.sourceRevision,
          "conflict",
        );
      }

      let nodes: readonly CanvasNode[];
      try {
        const canvas = parseJSONCanvas(snapshot.content);
        const byId = new Map((canvas.nodes ?? []).map((node) => [node.id, node]));
        nodes = nodeIds.map((nodeId) => byId.get(nodeId)).filter(isCanvasNode);
        if (
          nodes.length !== nodeIds.length ||
          !nodes.every((node) => nodeHasAction(node, action))
        ) {
          return failure(
            request,
            "unsupported-action",
            "The confirmed action no longer matches the selected Canvas nodes.",
            false,
            snapshot.sourceRevision,
          );
        }
        if (!actionMatchesNodeKinds(action.action, nodes)) {
          return failure(
            request,
            "unsupported-action",
            "This action is not valid for the selected Canvas node type.",
            false,
            snapshot.sourceRevision,
          );
        }
      } catch {
        return failure(
          request,
          "parse-error",
          "The Canvas JSON is invalid. Fix it before running actions.",
          true,
          snapshot.sourceRevision,
        );
      }

      const handler = options.capabilities[action.action];
      if (!handler) {
        return failure(
          request,
          "capability-unavailable",
          `The ${action.action} Canvas capability is unavailable in this host.`,
          true,
          snapshot.sourceRevision,
        );
      }

      try {
        await handler({
          target: request.target,
          revision: snapshot.sourceRevision,
          action,
          nodes,
        });
        return {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "success",
          target: request.target,
          revision: snapshot.sourceRevision,
        };
      } catch {
        return failure(
          request,
          "write-failed",
          "The Canvas action could not be completed.",
          true,
          snapshot.sourceRevision,
        );
      }
    },
  };
}

function uniqueNodeIds(nodeIds: readonly string[]): string[] | undefined {
  if (nodeIds.length === 0 || nodeIds.length > 100) return undefined;
  const normalized = nodeIds.filter((id) => typeof id === "string" && id.trim() === id && id);
  if (normalized.length !== nodeIds.length || new Set(normalized).size !== normalized.length) {
    return undefined;
  }
  return normalized;
}

function nodeHasAction(node: CanvasNode, action: CanvasActionMetadata): boolean {
  const candidate = parseCanvasAction(node["afxAction"]);
  return Boolean(candidate && sameAction(candidate, action));
}

function sameAction(left: CanvasActionMetadata, right: CanvasActionMetadata): boolean {
  return (
    left.version === right.version &&
    left.action === right.action &&
    left.label === right.label &&
    left.command === right.command &&
    Object.keys(left).length === Object.keys(right).length
  );
}

function actionMatchesNodeKinds(
  action: CanvasActionMetadata["action"],
  nodes: readonly CanvasNode[],
): boolean {
  if (action === "open-source") return nodes.every((node) => node.type === "file");
  if (action === "promote-note") return nodes.every((node) => node.type === "text");
  return true;
}

function isCanvasNode(node: CanvasNode | undefined): node is CanvasNode {
  return node !== undefined;
}

function failure(
  request: Pick<CanvasActionRunRequest, "requestId" | "target">,
  code: WorkbenchMutationErrorCode,
  message: string,
  retryable: boolean,
  revision?: WorkbenchSourceRevision,
  outcome: "conflict" | "error" = "error",
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
