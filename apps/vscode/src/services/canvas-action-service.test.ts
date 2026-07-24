/**
 * @see docs/specs/229-app-workbench-canvas/tasks.md [12.2]
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type {
  CanvasActionMetadata,
  CanvasNode,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
} from "@afx/shared";

import {
  type CanvasActionCapabilities,
  type CanvasActionRunRequest,
  createCanvasActionService,
} from "./canvas-action-service";
import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";

const target: WorkbenchSourceIdentity = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/project.canvas",
};
const revision: WorkbenchSourceRevision = {
  contentRevision: "canvas-r1",
  diskRevision: "canvas-r1",
  dirty: false,
};
const uri = vscode.Uri.file("/workspace/.afx/project.canvas");
const sendChatAction: CanvasActionMetadata = { version: 1, action: "send-chat" };

function textNode(id: string, action: unknown = sendChatAction): CanvasNode {
  return {
    id,
    type: "text",
    text: "Plan this feature",
    x: 0,
    y: 0,
    width: 240,
    height: 120,
    afxAction: action,
  };
}

function canvasContent(nodes: CanvasNode[] = [textNode("a")]): string {
  return JSON.stringify({ nodes, edges: [] });
}

function fakeFileState(content = canvasContent()): WorkbenchFileState {
  const snapshot: WorkbenchTextSnapshot = {
    uri,
    content,
    revision: revision.contentRevision,
    dirty: false,
    kind: "canvas",
    source: target,
    sourceRevision: revision,
  };
  return {
    classify: () => "canvas",
    identify: () => target,
    resolve: (candidate) => (candidate === target ? uri : undefined),
    readText: async () => snapshot,
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
}

function request(overrides: Partial<CanvasActionRunRequest> = {}): CanvasActionRunRequest {
  return {
    type: "afxCanvasRunAction",
    requestId: "action-1",
    target,
    expectedRevision: revision.contentRevision,
    action: sendChatAction,
    nodeIds: ["a"],
    confirmed: true,
    ...overrides,
  };
}

function service(
  capabilities: CanvasActionCapabilities = { "send-chat": vi.fn() },
  trusted = true,
  fileState = fakeFileState(),
) {
  return createCanvasActionService({
    fileState,
    capabilities,
    isWorkspaceTrusted: () => trusted,
  });
}

describe("canvas action service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("requires explicit confirmation before reading or invoking a capability", async () => {
    const handler = vi.fn();
    const fileState = fakeFileState();
    const read = vi.spyOn(fileState, "readText");

    const result = await service({ "send-chat": handler }, true, fileState).run(
      request({ confirmed: false }),
    );

    expect(result).toMatchObject({
      requestId: "action-1",
      outcome: "error",
      code: "confirmation-required",
    });
    expect(read).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects every action when the workspace is untrusted", async () => {
    const handler = vi.fn();
    const result = await service({ "send-chat": handler }, false).run(request());

    expect(result).toMatchObject({ outcome: "error", code: "untrusted-workspace" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects malformed, extra-field, and arbitrary command metadata", async () => {
    const handler = vi.fn();
    const actions = [
      { version: 1, action: "shell", command: "rm -rf ." },
      { version: 1, action: "send-chat", command: "rm -rf ." },
      { version: 1, action: "send-chat", future: true },
      { version: 1, action: "prepare-spec", command: "workbench.action.files.save" },
    ] as unknown as CanvasActionMetadata[];

    for (const action of actions) {
      const result = await service({ "send-chat": handler }).run(request({ action }));
      expect(result).toMatchObject({ outcome: "error", code: "unsupported-action" });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a stale revision and requires the action to be confirmed again", async () => {
    const handler = vi.fn();
    const result = await service({ "send-chat": handler }).run(
      request({ expectedRevision: "old-r0" }),
    );

    expect(result).toMatchObject({
      outcome: "conflict",
      code: "stale-revision",
      revision,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("verifies the selected node's exact persisted action metadata", async () => {
    const handler = vi.fn();
    const fileState = fakeFileState(
      canvasContent([textNode("a", { version: 1, action: "promote-note" })]),
    );
    const result = await service({ "send-chat": handler }, true, fileState).run(request());

    expect(result).toMatchObject({ outcome: "error", code: "unsupported-action" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("checks typed host capability availability without dispatching a command", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");
    const result = await service({}).run(request());

    expect(result).toMatchObject({ outcome: "error", code: "capability-unavailable" });
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("invokes one allowlisted capability and returns exactly one terminal success", async () => {
    const handler = vi.fn();
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand");

    const result = await service({ "send-chat": handler }).run(request());

    expect(result).toEqual({
      type: "afxMutationResult",
      requestId: "action-1",
      outcome: "success",
      target,
      revision,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ target, revision, action: sendChatAction }),
    );
    expect(handler.mock.calls[0]?.[0].nodes).toEqual([
      expect.objectContaining({ id: "a", text: "Plan this feature" }),
    ]);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("maps a capability failure to one retryable terminal error", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("private detail"));
    const result = await service({ "send-chat": handler }).run(request());

    expect(result).toMatchObject({
      type: "afxMutationResult",
      requestId: "action-1",
      outcome: "error",
      code: "write-failed",
      retryable: true,
    });
    expect(result).not.toHaveProperty("message", expect.stringContaining("private detail"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("constrains source and note actions to compatible node kinds", async () => {
    const openSource: CanvasActionMetadata = { version: 1, action: "open-source" };
    const handler = vi.fn();
    const fileState = fakeFileState(canvasContent([textNode("a", openSource)]));
    const result = await service({ "open-source": handler }, true, fileState).run(
      request({ action: openSource }),
    );

    expect(result).toMatchObject({ outcome: "error", code: "unsupported-action" });
    expect(handler).not.toHaveBeenCalled();
  });
});
