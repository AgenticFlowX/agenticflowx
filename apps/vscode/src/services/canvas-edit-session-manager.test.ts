/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-MULTI-INSTANCE]
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasEditRequest, WorkbenchMutationResult } from "@afx/shared";

import { createCanvasEditSessionManager } from "./canvas-edit-session-manager";

const TARGET = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/project.canvas",
} as const;

function edit(
  sessionId: string,
  sequence: number,
  options: { documentId?: string; content?: string; baseRevision?: string } = {},
): CanvasEditRequest {
  return {
    type: "afxCanvasEdit",
    requestId: `${sessionId}-${sequence}`,
    sessionId,
    sequence,
    documentId: options.documentId ?? `surface-${sessionId}`,
    target: TARGET,
    baseRevision: options.baseRevision ?? "revision-0",
    content: options.content ?? `${sessionId}-${sequence}`,
  };
}

function success(request: CanvasEditRequest, revision: string): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "success",
    target: request.target,
    revision: { contentRevision: revision, diskRevision: revision, dirty: true },
  };
}

describe("createCanvasEditSessionManager", () => {
  afterEach(() => vi.useRealTimers());

  it("exposes the applying client only while its staged edit is being written", async () => {
    let release!: (result: WorkbenchMutationResult) => void;
    const gate = new Promise<WorkbenchMutationResult>((resolve) => {
      release = resolve;
    });
    const request = edit("session-a", 1);
    const manager = createCanvasEditSessionManager({
      apply: () => gate,
      shouldApplyImmediately: () => true,
    });

    expect(manager.applyingClientId(TARGET)).toBeUndefined();
    const client = manager.connect(() => {});
    client.stage(request);
    expect(manager.applyingClientId(TARGET)).toBe("session-a");
    // Canonicalization: a differently-normalized identity resolves the same session.
    expect(manager.applyingClientId({ ...TARGET, relativePath: "./.afx//project.canvas" })).toBe(
      "session-a",
    );

    release(success(request, "revision-1"));
    await manager.flush();
    expect(manager.applyingClientId(TARGET)).toBeUndefined();
    client.dispose();
    await manager.dispose();
  });

  it("coalesces only within a client and conflicts a stale cross-client snapshot", async () => {
    let releaseFirst!: (result: WorkbenchMutationResult) => void;
    const firstResult = new Promise<WorkbenchMutationResult>((resolve) => {
      releaseFirst = resolve;
    });
    const apply = vi
      .fn<
        (
          request: CanvasEditRequest,
          expectedRevision: string | undefined,
        ) => Promise<WorkbenchMutationResult>
      >()
      .mockImplementationOnce(() => firstResult)
      .mockImplementationOnce(async (request, expectedRevision) =>
        expectedRevision === "revision-0"
          ? {
              type: "afxMutationResult",
              requestId: request.requestId,
              outcome: "conflict",
              target: request.target,
              code: "stale-revision",
              message: "another client wrote first",
              retryable: true,
            }
          : success(request, "revision-2"),
      );
    const manager = createCanvasEditSessionManager({
      apply,
      shouldApplyImmediately: () => true,
      debounceMs: 1,
    });
    const workbenchPost = vi.fn();
    const editorPost = vi.fn();
    const workbench = manager.connect(workbenchPost);
    const editor = manager.connect(editorPost);

    workbench.stage(edit("workbench", 1, { documentId: "workbench-document" }));
    editor.stage(edit("editor", 1, { documentId: "editor-document" }));
    editor.stage(edit("editor", 2, { documentId: "editor-document" }));

    expect(apply).toHaveBeenCalledOnce();
    expect(editorPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "editor-1", outcome: "superseded" }),
    );

    releaseFirst(success(edit("workbench", 1), "revision-1"));
    await manager.flush();

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1]).toEqual([
      edit("editor", 2, { documentId: "editor-document" }),
      "revision-0",
    ]);
    expect(workbenchPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "workbench-1", outcome: "success" }),
    );
    expect(editorPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "editor-2", outcome: "conflict" }),
    );
  });

  it("keeps cross-client arrival order when a later snapshot supersedes its client", async () => {
    const apply = vi.fn(async (request: CanvasEditRequest) =>
      success(request, `revision-${request.requestId}`),
    );
    const manager = createCanvasEditSessionManager({
      apply,
      shouldApplyImmediately: () => false,
    });
    const post = vi.fn();
    const client = manager.connect(post);

    client.stage(edit("client-a", 1));
    client.stage(edit("client-b", 1));
    client.stage(edit("client-a", 2));
    await manager.flush();

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "client-a-1", outcome: "superseded" }),
    );
    expect(apply.mock.calls.map(([request]) => request.requestId)).toEqual([
      "client-b-1",
      "client-a-2",
    ]);
  });

  it("keeps pending work after unmount and never routes stale acknowledgements to a new client", async () => {
    const apply = vi.fn(async (request: CanvasEditRequest) =>
      success(request, `revision-${request.sequence}`),
    );
    const manager = createCanvasEditSessionManager({
      apply,
      shouldApplyImmediately: () => false,
    });
    const stalePost = vi.fn();
    const staleClient = manager.connect(stalePost);

    staleClient.stage(edit("shared-client", 1));
    staleClient.dispose();
    await manager.flush();

    expect(apply).toHaveBeenCalledOnce();
    expect(stalePost).not.toHaveBeenCalled();

    const currentPost = vi.fn();
    const currentClient = manager.connect(currentPost);
    currentClient.stage(edit("shared-client", 1));
    currentClient.stage(edit("shared-client", 2, { baseRevision: "revision-1" }));
    await manager.flush();

    expect(currentPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "shared-client-1", outcome: "conflict" }),
    );
    expect(currentPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "shared-client-2", outcome: "success" }),
    );
    expect(apply.mock.calls[1]).toEqual([
      edit("shared-client", 2, { baseRevision: "revision-1" }),
      "revision-1",
    ]);
  });

  it("returns correlated terminal states when the latest canonical write conflicts", async () => {
    const conflict = (request: CanvasEditRequest): WorkbenchMutationResult => ({
      type: "afxMutationResult",
      requestId: request.requestId,
      outcome: "conflict",
      target: request.target,
      code: "stale-revision",
      message: "external edit won",
      retryable: true,
    });
    const apply = vi.fn(async (request: CanvasEditRequest) => conflict(request));
    const manager = createCanvasEditSessionManager({
      apply,
      shouldApplyImmediately: () => false,
    });
    const workbenchPost = vi.fn();
    const editorPost = vi.fn();

    manager.connect(workbenchPost).stage(edit("workbench", 1));
    manager.connect(editorPost).stage(edit("editor", 1));
    await manager.flush();

    expect(workbenchPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "workbench-1", outcome: "conflict" }),
    );
    expect(editorPost).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "editor-1", outcome: "conflict" }),
    );
  });

  it("accepts a freshly reloaded base revision after an external-edit conflict", async () => {
    const conflict = (request: CanvasEditRequest): WorkbenchMutationResult => ({
      type: "afxMutationResult",
      requestId: request.requestId,
      outcome: "conflict",
      target: request.target,
      code: "stale-revision",
      message: "external edit won",
      retryable: true,
      revision: { contentRevision: "revision-2", diskRevision: "revision-2", dirty: false },
    });
    const apply = vi
      .fn<
        (
          request: CanvasEditRequest,
          expectedRevision: string | undefined,
        ) => Promise<WorkbenchMutationResult>
      >()
      .mockImplementationOnce(async (request) => success(request, "revision-1"))
      .mockImplementationOnce(async (request) => conflict(request))
      .mockImplementationOnce(async (request) => success(request, "revision-3"));
    const manager = createCanvasEditSessionManager({
      apply,
      shouldApplyImmediately: () => false,
    });
    const post = vi.fn();
    const client = manager.connect(post);

    client.stage(edit("editor", 1));
    await manager.flush();
    client.stage(edit("editor", 2, { baseRevision: "revision-1" }));
    await manager.flush();
    client.stage(edit("editor", 3, { baseRevision: "revision-2" }));
    await manager.flush();

    expect(apply.mock.calls[2]).toEqual([
      edit("editor", 3, { baseRevision: "revision-2" }),
      "revision-2",
    ]);
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "editor-3", outcome: "success" }),
    );
  });

  it("uses a new client base after an acknowledged edit burst and a manual file change", async () => {
    let currentRevision = "revision-0";
    const apply = vi.fn(
      async (
        request: CanvasEditRequest,
        expectedRevision: string | undefined,
      ): Promise<WorkbenchMutationResult> => {
        if (expectedRevision !== currentRevision) {
          return {
            type: "afxMutationResult",
            requestId: request.requestId,
            outcome: "conflict",
            target: request.target,
            code: "stale-revision",
            message: "manual edit won",
            retryable: true,
            revision: {
              contentRevision: currentRevision,
              diskRevision: currentRevision,
              dirty: false,
            },
          };
        }
        currentRevision = `applied-${request.sequence}`;
        return success(request, currentRevision);
      },
    );
    const manager = createCanvasEditSessionManager({
      apply,
      shouldApplyImmediately: () => false,
    });
    const post = vi.fn();
    const client = manager.connect(post);

    client.stage(edit("editor", 1));
    await manager.flush();
    currentRevision = "manual-revision-2";
    client.stage(edit("editor", 2, { baseRevision: currentRevision }));
    await manager.flush();

    expect(apply.mock.calls[1]?.[1]).toBe("manual-revision-2");
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "editor-2", outcome: "success" }),
    );
  });
});
