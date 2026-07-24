/**
 * Typed terminal responses for Canvas requests rejected at a host boundary.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-5]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-API] [DES-ERR]
 */
import type { WorkbenchInbound, WorkbenchOutbound, WorkbenchSourceIdentity } from "@afx/shared";

export function postCanvasRequestFailure(
  message: WorkbenchOutbound,
  post: (response: WorkbenchInbound) => void,
  cause: unknown,
  fallbackTarget?: WorkbenchSourceIdentity,
): boolean {
  const detail = cause instanceof Error ? cause.message : "The Canvas operation failed.";
  // The protocol union also contains fire-and-forget messages; only correlated
  // Canvas requests are mapped here and every other message deliberately falls through.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (message.type) {
    case "afxCanvasContentPreviewRequest":
      post({
        type: "afxCanvasContentPreviewResult",
        requestId: message.requestId,
        owner: message.owner,
        preview: {
          kind: "file",
          state: "error",
          code: "read-failed",
          message: detail,
        },
      });
      return true;
    case "afxCanvasUrlPreviewRequest":
      post({
        type: "afxCanvasUrlPreviewResult",
        requestId: message.requestId,
        url: message.url,
        preview: { state: "error", code: "network-error", message: detail },
      });
      return true;
    case "afxCanvasDocIndex":
      post({ type: "afxCanvasDocIndex", requestId: message.requestId, entries: [] });
      return true;
    case "afxCanvasPickReferences":
      post({
        type: "afxCanvasReferencesPicked",
        requestId: message.requestId,
        outcome: "error",
        references: [],
        message: detail,
      });
      return true;
    case "afxCanvasExport":
      post({
        type: "afxCanvasExportResult",
        requestId: message.requestId,
        outcome: "error",
        code: "write-failed",
        message: detail,
      });
      return true;
    case "afxCanvasEdit":
      post({
        type: "afxCanvasEditResult",
        requestId: message.requestId,
        sessionId: message.sessionId,
        sequence: message.sequence,
        outcome: "error",
        target: message.target,
        code: "write-failed",
        message: detail,
        retryable: true,
      });
      return true;
    case "afxCanvasCreate":
      return postMutationFailure(
        message.requestId,
        {
          rootUri: message.targetRootUri,
          rootName: "workspace",
          relativePath: "",
        },
        detail,
        post,
      );
    case "afxCanvasAuthorRelationship":
      return postMutationFailure(message.requestId, message.source, detail, post);
    case "afxCanvasApplyMutation":
      if (!fallbackTarget) return false;
      return postMutationFailure(message.requestId, fallbackTarget, detail, post);
    case "afxCanvasRename":
    case "afxCanvasDuplicate":
    case "afxCanvasDelete":
    case "afxCanvasSave":
    case "afxCanvasRefreshDependencies":
    case "afxCanvasRunAction":
      return postMutationFailure(message.requestId, message.target, detail, post);
    default:
      return false;
  }
}

function postMutationFailure(
  requestId: string,
  target: WorkbenchSourceIdentity,
  message: string,
  post: (response: WorkbenchInbound) => void,
): true {
  post({
    type: "afxMutationResult",
    requestId,
    outcome: "error",
    target,
    code: "write-failed",
    message,
    retryable: true,
  });
  return true;
}
