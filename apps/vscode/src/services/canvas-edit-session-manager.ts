/**
 * Extension-lifetime Canvas edit ownership shared by every host surface.
 *
 * Sessions are keyed by canonical workspace source rather than transient
 * webview/document identifiers. Each connected surface retains its own result
 * sink, while pending writes remain host-owned after that surface unmounts.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-MULTI-INSTANCE]
 */
import type {
  CanvasEditRequest,
  CanvasEditResult,
  WorkbenchMutationResult,
  WorkbenchSourceIdentity,
} from "@afx/shared";

export interface CanvasEditSessionManagerOptions {
  apply(
    request: CanvasEditRequest,
    expectedRevision: string | undefined,
  ): Promise<WorkbenchMutationResult>;
  shouldApplyImmediately(request: CanvasEditRequest): boolean;
  debounceMs?: number;
}

export interface CanvasEditSessionClient {
  stage(request: CanvasEditRequest): void;
  dispose(): void;
}

export interface CanvasEditSessionManager {
  connect(post: (result: CanvasEditResult) => void): CanvasEditSessionClient;
  /**
   * Client id (webview session) whose staged edit is being written to the
   * document right now, if any. Editor surfaces use this to suppress their own
   * change-event echo without hiding writes that other surfaces originated.
   */
  applyingClientId(target: WorkbenchSourceIdentity): string | undefined;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

interface QueuedEdit {
  request: CanvasEditRequest;
  deliver(result: CanvasEditResult): void;
}

interface DocumentSession {
  latestSequenceByClient: Map<string, number>;
  /** Last revision produced by each client during the current queued burst. */
  appliedRevisionByClient: Map<string, string>;
  /** Client whose edit is currently inside options.apply — echo-suppression source. */
  applyingClientId?: string;
  /** FIFO across clients; only adjacent pending edits from the same client coalesce. */
  pending: QueuedEdit[];
  inFlight?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  disposing: boolean;
}

const DEFAULT_DEBOUNCE_MS = 650;

export function createCanvasEditSessionManager(
  options: CanvasEditSessionManagerOptions,
): CanvasEditSessionManager {
  const sessions = new Map<string, DocumentSession>();
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let disposed = false;

  const clearTimer = (session: DocumentSession): void => {
    if (session.timer) clearTimeout(session.timer);
    session.timer = undefined;
  };

  const deliverSuperseded = (edit: QueuedEdit): void => {
    edit.deliver({
      type: "afxCanvasEditResult",
      requestId: edit.request.requestId,
      sessionId: edit.request.sessionId,
      sequence: edit.request.sequence,
      outcome: "superseded",
      target: edit.request.target,
    });
  };

  const deliverFailure = (
    edit: QueuedEdit,
    result: Extract<WorkbenchMutationResult, { outcome: "conflict" | "error" }>,
  ): void => {
    edit.deliver({
      type: "afxCanvasEditResult",
      requestId: edit.request.requestId,
      sessionId: edit.request.sessionId,
      sequence: edit.request.sequence,
      outcome: result.outcome,
      target: edit.request.target,
      code: result.code,
      message: result.message,
      retryable: result.retryable,
      ...(result.revision ? { revision: result.revision } : {}),
    });
  };

  const deliverOutOfOrder = (edit: QueuedEdit): void => {
    edit.deliver({
      type: "afxCanvasEditResult",
      requestId: edit.request.requestId,
      sessionId: edit.request.sessionId,
      sequence: edit.request.sequence,
      outcome: "conflict",
      target: edit.request.target,
      code: "stale-revision",
      message: "The Canvas edit arrived out of sequence.",
      retryable: true,
    });
  };

  const schedule = (session: DocumentSession): void => {
    clearTimer(session);
    session.timer = setTimeout(() => {
      session.timer = undefined;
      void applyPending(session);
    }, debounceMs);
  };

  const applyPending = (session: DocumentSession): Promise<void> | undefined => {
    if (session.inFlight || session.pending.length === 0) return session.inFlight;
    clearTimer(session);
    const edit = session.pending.shift();
    if (!edit) return undefined;
    const expectedRevision =
      session.appliedRevisionByClient.get(edit.request.sessionId) ?? edit.request.baseRevision;

    const operation = (async () => {
      let result: WorkbenchMutationResult;
      session.applyingClientId = edit.request.sessionId;
      try {
        result = await options.apply(edit.request, expectedRevision);
      } catch (cause) {
        result = {
          type: "afxMutationResult",
          requestId: edit.request.requestId,
          outcome: "error",
          target: edit.request.target,
          code: "write-failed",
          message: cause instanceof Error ? cause.message : "Canvas host write failed.",
          retryable: true,
        };
      }

      if (result.outcome === "success") {
        session.appliedRevisionByClient.set(
          edit.request.sessionId,
          result.revision.contentRevision,
        );
        edit.deliver({
          type: "afxCanvasEditResult",
          requestId: edit.request.requestId,
          sessionId: edit.request.sessionId,
          sequence: edit.request.sequence,
          outcome: "success",
          target: edit.request.target,
          revision: result.revision,
        });
        return;
      }

      // An external/manual edit can invalidate the manager's last successful
      // revision. Let the next reloaded client request establish a fresh base
      // instead of pinning this extension-lifetime session to a stale value.
      session.appliedRevisionByClient.delete(edit.request.sessionId);
      deliverFailure(edit, result);
    })().finally(() => {
      session.applyingClientId = undefined;
      session.inFlight = undefined;
      if (session.pending.length > 0) {
        if (!session.disposing) schedule(session);
      } else {
        // The burst is fully acknowledged. A later request may legitimately
        // carry a newer base after a native text edit, save, undo, or revert.
        session.appliedRevisionByClient.clear();
      }
    });
    session.inFlight = operation;
    return operation;
  };

  const flushSession = async (session: DocumentSession): Promise<void> => {
    clearTimer(session);
    while (session.inFlight || session.pending.length > 0) {
      if (session.inFlight) await session.inFlight;
      else await applyPending(session);
      clearTimer(session);
    }
  };

  const stage = (edit: QueuedEdit): void => {
    if (disposed) {
      edit.deliver({
        type: "afxCanvasEditResult",
        requestId: edit.request.requestId,
        sessionId: edit.request.sessionId,
        sequence: edit.request.sequence,
        outcome: "error",
        target: edit.request.target,
        code: "write-failed",
        message: "The Canvas edit session manager is closed.",
        retryable: true,
      });
      return;
    }

    const key = canonicalDocumentKey(edit.request);
    const session = sessions.get(key) ?? {
      latestSequenceByClient: new Map<string, number>(),
      appliedRevisionByClient: new Map<string, string>(),
      pending: [],
      disposing: false,
    };
    sessions.set(key, session);
    const latestSequence = session.latestSequenceByClient.get(edit.request.sessionId) ?? 0;
    if (edit.request.sequence <= latestSequence) {
      deliverOutOfOrder(edit);
      return;
    }
    session.latestSequenceByClient.set(edit.request.sessionId, edit.request.sequence);
    let sameClientIndex = -1;
    for (let index = session.pending.length - 1; index >= 0; index--) {
      if (session.pending[index]?.request.sessionId === edit.request.sessionId) {
        sameClientIndex = index;
        break;
      }
    }
    if (sameClientIndex >= 0) {
      const superseded = session.pending[sameClientIndex];
      if (superseded) deliverSuperseded(superseded);
      session.pending.splice(sameClientIndex, 1);
    }
    session.pending.push(edit);

    if (session.inFlight) return;
    if (
      session.appliedRevisionByClient.size === 0 &&
      options.shouldApplyImmediately(edit.request)
    ) {
      void applyPending(session);
    } else {
      schedule(session);
    }
  };

  return {
    connect(post) {
      let active = true;
      return {
        stage(request) {
          stage({
            request,
            deliver: (result) => {
              if (active) post(result);
            },
          });
        },
        dispose() {
          active = false;
        },
      };
    },
    applyingClientId(target) {
      return sessions.get(canonicalSourceKey(target))?.applyingClientId;
    },
    async flush() {
      await Promise.all([...sessions.values()].map((session) => flushSession(session)));
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const session of sessions.values()) session.disposing = true;
      await Promise.all([...sessions.values()].map((session) => flushSession(session)));
      sessions.clear();
    },
  };
}

function canonicalDocumentKey(request: CanvasEditRequest): string {
  return canonicalSourceKey(request.target);
}

function canonicalSourceKey(target: WorkbenchSourceIdentity): string {
  const root = target.rootUri.replace(/\/$/, "");
  const relativePath = target.relativePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
  return `${root}\u0000${relativePath}`;
}
