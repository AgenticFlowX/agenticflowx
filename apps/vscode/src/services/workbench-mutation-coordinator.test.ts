/**
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-18] [FR-20]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MUTATION-COORDINATOR]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [6.2]
 */
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchSourceIdentity } from "@afx/shared";

import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";
import { createWorkbenchMutationCoordinator } from "./workbench-mutation-coordinator";

const SOURCE: WorkbenchSourceIdentity = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/project.canvas",
};

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function fakeState(
  content: string,
  dirty = false,
): {
  state: WorkbenchFileState;
  setContent(next: string): void;
} {
  const uri = vscode.Uri.file("/workspace/.afx/project.canvas");
  let value = content;
  const state: WorkbenchFileState = {
    classify: () => "canvas",
    identify: () => SOURCE,
    resolve: (source) => (source.rootUri === SOURCE.rootUri ? uri : undefined),
    readText: async (): Promise<WorkbenchTextSnapshot> => {
      const revision = hash(value);
      return {
        uri,
        content: value,
        revision,
        dirty,
        kind: "canvas",
        source: SOURCE,
        sourceRevision: {
          contentRevision: revision,
          diskRevision: revision,
          dirty,
        },
      };
    },
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
  return { state, setContent: (next) => (value = next) };
}

describe("createWorkbenchMutationCoordinator", () => {
  afterEach(() => {
    (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [];
    vi.restoreAllMocks();
  });

  it("rejects stale and dirty sources without writing", async () => {
    const fixture = fakeState("current");
    const write = vi.spyOn(vscode.workspace.fs, "writeFile");
    const coordinator = createWorkbenchMutationCoordinator({ fileState: fixture.state });

    const stale = await coordinator.mutateText({
      requestId: "stale",
      target: SOURCE,
      expectedRevision: "old",
      transform: () => "next",
    });
    expect(stale).toMatchObject({ outcome: "conflict", code: "stale-revision" });

    const dirtyFixture = fakeState("current", true);
    const dirtyCoordinator = createWorkbenchMutationCoordinator({
      fileState: dirtyFixture.state,
    });
    const dirty = await dirtyCoordinator.mutateText({
      requestId: "dirty",
      target: SOURCE,
      expectedRevision: hash("current"),
      transform: () => "next",
    });
    expect(dirty).toMatchObject({ outcome: "conflict", code: "dirty-document" });
    expect(write).not.toHaveBeenCalled();
  });

  it("allows a revision-matched host Canvas stream to advance its own dirty buffer", async () => {
    const fixture = fakeState("current", true);
    const uri = vscode.Uri.file("/workspace/.afx/project.canvas");
    (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [
      { uri } as vscode.TextDocument,
    ];
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      fixture.setContent("next");
      return true;
    });
    const coordinator = createWorkbenchMutationCoordinator({ fileState: fixture.state });

    const result = await coordinator.mutateText({
      requestId: "canvas-stream",
      target: SOURCE,
      expectedRevision: hash("current"),
      allowDirty: true,
      transform: () => "next",
    });

    expect(result).toMatchObject({
      outcome: "success",
      revision: { contentRevision: hash("next") },
    });
    expect(vscode.workspace.applyEdit).toHaveBeenCalledOnce();
  });

  it("uses an undoable WorkspaceEdit for an existing closed document", async () => {
    const fixture = fakeState("current");
    vi.spyOn(vscode.workspace, "applyEdit").mockImplementation(async () => {
      fixture.setContent("next");
      return true;
    });
    const write = vi.spyOn(vscode.workspace.fs, "writeFile");
    const coordinator = createWorkbenchMutationCoordinator({ fileState: fixture.state });

    const result = await coordinator.mutateText({
      requestId: "closed-document",
      target: SOURCE,
      expectedRevision: hash("current"),
      transform: () => "next",
    });

    expect(result.outcome).toBe("success");
    expect(vscode.workspace.applyEdit).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it("serializes same-path mutations and confirms each terminal result", async () => {
    const fixture = fakeState("a");
    vi.spyOn(vscode.workspace, "applyEdit")
      .mockImplementationOnce(async () => {
        fixture.setContent("ab");
        return true;
      })
      .mockImplementationOnce(async () => {
        fixture.setContent("abc");
        return true;
      });
    const coordinator = createWorkbenchMutationCoordinator({ fileState: fixture.state });
    const order: string[] = [];

    const first = coordinator.mutateText({
      requestId: "one",
      target: SOURCE,
      expectedRevision: hash("a"),
      transform: (current) => {
        order.push(`one:${current}`);
        return `${current}b`;
      },
    });
    const second = coordinator.mutateText({
      requestId: "two",
      target: SOURCE,
      expectedRevision: hash("ab"),
      transform: (current) => {
        order.push(`two:${current}`);
        return `${current}c`;
      },
    });

    await expect(first).resolves.toMatchObject({ requestId: "one", outcome: "success" });
    await expect(second).resolves.toMatchObject({ requestId: "two", outcome: "success" });
    expect(order).toEqual(["one:a", "two:ab"]);
  });

  it("rejects opaque roots that are not currently registered", async () => {
    const fixture = fakeState("a");
    const coordinator = createWorkbenchMutationCoordinator({ fileState: fixture.state });
    const result = await coordinator.mutateText({
      requestId: "outside",
      target: { ...SOURCE, rootUri: "file:///outside" },
      transform: () => "b",
    });
    expect(result).toMatchObject({ outcome: "error", code: "outside-workspace" });
  });

  it("rejects create-only writes when the destination appeared before its FIFO turn", async () => {
    const fixture = fakeState("already here");
    const write = vi.spyOn(vscode.workspace.fs, "writeFile");
    const coordinator = createWorkbenchMutationCoordinator({ fileState: fixture.state });

    const result = await coordinator.mutateText({
      requestId: "collision",
      target: SOURCE,
      allowCreate: true,
      requireMissing: true,
      transform: () => "replacement",
    });

    expect(result).toMatchObject({ outcome: "error", code: "collision", retryable: false });
    expect(write).not.toHaveBeenCalled();
  });
});
