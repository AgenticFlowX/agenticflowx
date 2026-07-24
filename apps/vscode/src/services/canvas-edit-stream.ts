/**
 * Host-owned, latest-wins Canvas edit stream.
 *
 * The first edit to an open TextDocument can be applied immediately so VS Code
 * owns dirty state. Later rapid edits are coalesced in the extension host;
 * disk-only documents are debounced here rather than in transient React state.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-11] [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-DIRTY-CONFLICT]
 */
import type { CanvasEditRequest, CanvasEditResult, WorkbenchMutationResult } from "@afx/shared";

/**
 * Host adapter used by the Canvas edit stream.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
export interface CanvasEditStreamOptions {
  apply(
    request: CanvasEditRequest,
    expectedRevision: string | undefined,
  ): Promise<WorkbenchMutationResult>;
  post(result: CanvasEditResult): void;
  shouldApplyImmediately(request: CanvasEditRequest): boolean;
  debounceMs?: number;
}

/**
 * Host-owned Canvas edit lifecycle independent of any React component.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-31] [FR-32]
 */
export interface CanvasEditStream {
  stage(request: CanvasEditRequest): void;
  flush(): Promise<void>;
  dispose(): Promise<void>;
}

interface EditSession {
  latestSequence: number;
  appliedRevision?: string;
  pending?: CanvasEditRequest;
  inFlight?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  disposing: boolean;
}

const DEFAULT_DEBOUNCE_MS = 650;

/**
 * Creates an ordered edit stream keyed by Canvas document and webview session.
 * Superseded queued edits receive an explicit terminal result; the latest edit
 * remains host-owned even after its React producer unmounts.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
export function createCanvasEditStream(options: CanvasEditStreamOptions): CanvasEditStream {
  const sessions = new Map<string, EditSession>();
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let disposed = false;

  const sessionKey = (request: CanvasEditRequest): string =>
    `${request.documentId}\u0000${request.sessionId}`;

  const postSuperseded = (request: CanvasEditRequest): void => {
    options.post({
      type: "afxCanvasEditResult",
      requestId: request.requestId,
      sessionId: request.sessionId,
      sequence: request.sequence,
      outcome: "superseded",
      target: request.target,
    });
  };

  const postFailure = (
    request: CanvasEditRequest,
    result: Extract<WorkbenchMutationResult, { outcome: "conflict" | "error" }>,
  ): void => {
    options.post({
      type: "afxCanvasEditResult",
      requestId: request.requestId,
      sessionId: request.sessionId,
      sequence: request.sequence,
      outcome: result.outcome,
      target: request.target,
      code: result.code,
      message: result.message,
      retryable: result.retryable,
      ...(result.revision ? { revision: result.revision } : {}),
    });
  };

  const postOutOfOrder = (request: CanvasEditRequest): void => {
    options.post({
      type: "afxCanvasEditResult",
      requestId: request.requestId,
      sessionId: request.sessionId,
      sequence: request.sequence,
      outcome: "conflict",
      target: request.target,
      code: "stale-revision",
      message: "The Canvas edit arrived out of sequence.",
      retryable: true,
    });
  };

  const clearTimer = (session: EditSession): void => {
    if (session.timer) clearTimeout(session.timer);
    session.timer = undefined;
  };

  const schedule = (session: EditSession): void => {
    clearTimer(session);
    session.timer = setTimeout(() => {
      session.timer = undefined;
      void applyPending(session);
    }, debounceMs);
  };

  const applyPending = (session: EditSession): Promise<void> | undefined => {
    if (session.inFlight || !session.pending) return session.inFlight;
    clearTimer(session);
    const request = session.pending;
    session.pending = undefined;
    const expectedRevision = session.appliedRevision ?? request.baseRevision;

    const operation = (async () => {
      let result: WorkbenchMutationResult;
      try {
        result = await options.apply(request, expectedRevision);
      } catch (cause) {
        result = {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "error",
          target: request.target,
          code: "write-failed",
          message: cause instanceof Error ? cause.message : "Canvas host write failed.",
          retryable: true,
        };
      }
      if (result.outcome === "success") {
        session.appliedRevision = result.revision.contentRevision;
        options.post({
          type: "afxCanvasEditResult",
          requestId: request.requestId,
          sessionId: request.sessionId,
          sequence: request.sequence,
          outcome: "success",
          target: request.target,
          revision: result.revision,
        });
        return;
      }
      postFailure(request, result);
      if (session.pending) {
        postFailure(session.pending, result);
        session.pending = undefined;
      }
    })().finally(() => {
      session.inFlight = undefined;
      if (session.pending && !session.disposing) schedule(session);
    });
    session.inFlight = operation;
    return operation;
  };

  const flushSession = async (session: EditSession): Promise<void> => {
    clearTimer(session);
    while (session.inFlight || session.pending) {
      if (session.inFlight) {
        await session.inFlight;
      } else {
        await applyPending(session);
      }
      clearTimer(session);
    }
  };

  return {
    stage(request) {
      if (disposed) {
        options.post({
          type: "afxCanvasEditResult",
          requestId: request.requestId,
          sessionId: request.sessionId,
          sequence: request.sequence,
          outcome: "error",
          target: request.target,
          code: "write-failed",
          message: "The Canvas edit session is closed.",
          retryable: true,
        });
        return;
      }
      const key = sessionKey(request);
      const session = sessions.get(key) ?? {
        latestSequence: 0,
        disposing: false,
      };
      sessions.set(key, session);
      if (request.sequence <= session.latestSequence) {
        postOutOfOrder(request);
        return;
      }
      session.latestSequence = request.sequence;
      if (session.pending) postSuperseded(session.pending);
      session.pending = request;

      if (session.inFlight) return;
      if (session.appliedRevision === undefined && options.shouldApplyImmediately(request)) {
        void applyPending(session);
      } else {
        schedule(session);
      }
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
