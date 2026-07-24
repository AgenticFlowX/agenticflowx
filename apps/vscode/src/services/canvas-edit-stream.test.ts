/**
 * Host-owned Canvas edit-stream lifecycle coverage.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-11] [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasEditRequest, WorkbenchMutationResult } from "@afx/shared";

import { createCanvasEditStream } from "./canvas-edit-stream";

const TARGET = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/project.canvas",
} as const;

function edit(sequence: number, content = `canvas-${sequence}`): CanvasEditRequest {
  return {
    type: "afxCanvasEdit",
    requestId: `request-${sequence}`,
    sessionId: "workbench-canvas",
    sequence,
    documentId: "project-canvas",
    target: TARGET,
    baseRevision: "revision-0",
    content,
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

describe("createCanvasEditStream", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a disk-only edit in the host and flushes it after React can unmount", async () => {
    vi.useFakeTimers();
    const apply = vi.fn(async (request: CanvasEditRequest) => success(request, "revision-1"));
    const post = vi.fn();
    const stream = createCanvasEditStream({ apply, post, shouldApplyImmediately: () => false });

    stream.stage(edit(1));
    expect(apply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(650);

    expect(apply).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxCanvasEditResult", sequence: 1, outcome: "success" }),
    );
  });

  it("applies the first open-document edit immediately and coalesces later edits latest-wins", async () => {
    vi.useFakeTimers();
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
      .mockImplementationOnce(async (request) => success(request, "revision-3"));
    const post = vi.fn();
    const stream = createCanvasEditStream({ apply, post, shouldApplyImmediately: () => true });

    stream.stage(edit(1));
    stream.stage(edit(2));
    stream.stage(edit(3));

    expect(apply).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ sequence: 2, outcome: "superseded" }),
    );

    releaseFirst(success(edit(1), "revision-1"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(650);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1]).toEqual([edit(3), "revision-1"]);
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ sequence: 3, outcome: "success" }));
  });

  it("flushes the latest queued edit when its owning host surface disposes", async () => {
    vi.useFakeTimers();
    const apply = vi.fn(async (request: CanvasEditRequest) =>
      success(request, `revision-${request.sequence}`),
    );
    const stream = createCanvasEditStream({
      apply,
      post: vi.fn(),
      shouldApplyImmediately: () => false,
    });

    stream.stage(edit(1));
    stream.stage(edit(2));
    await stream.dispose();

    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0]?.[0]).toEqual(edit(2));
  });

  it("turns a host write exception into a correlated terminal error", async () => {
    const post = vi.fn();
    const stream = createCanvasEditStream({
      apply: vi.fn(async () => {
        throw new Error("workspace edit rejected");
      }),
      post,
      shouldApplyImmediately: () => false,
    });

    stream.stage(edit(1));
    await expect(stream.flush()).resolves.toBeUndefined();

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "afxCanvasEditResult",
        requestId: "request-1",
        sequence: 1,
        outcome: "error",
        code: "write-failed",
        message: "workspace edit rejected",
      }),
    );
  });
});
