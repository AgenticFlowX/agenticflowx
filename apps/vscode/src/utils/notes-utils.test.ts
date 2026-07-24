/**
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-12] [FR-13]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-MUTATION] [DES-TEST]
 */
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchSourceIdentity } from "@afx/shared";

import { NotesMarkdownDocument } from "../services/notes-markdown";
import type { WorkbenchFileState } from "../services/workbench-file-state";
import type {
  WorkbenchMutationCoordinator,
  WorkbenchTextMutation,
} from "../services/workbench-mutation-coordinator";
import { createNotesWorkspaceWriter } from "./notes-utils";

const SOURCE: WorkbenchSourceIdentity = {
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath: ".afx/notes.md",
};

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function coordinatorFor(initial: string) {
  let content = initial;
  const requests: WorkbenchTextMutation[] = [];
  const mutateText = vi.fn(async (request: WorkbenchTextMutation) => {
    requests.push(request);
    content = await request.transform(content);
    const contentRevision = hash(content);
    return {
      type: "afxMutationResult" as const,
      requestId: request.requestId,
      outcome: "success" as const,
      target: request.target,
      revision: { contentRevision, diskRevision: contentRevision, dirty: false },
    };
  });
  const coordinator: WorkbenchMutationCoordinator = { mutateText, dispose() {} };
  return {
    coordinator,
    requests,
    content: () => content,
  };
}

function fileState(content: string): WorkbenchFileState {
  const uri = vscode.Uri.file("/workspace/.afx/notes.md");
  return {
    classify: () => "notes",
    identify: () => SOURCE,
    resolve: () => uri,
    async readText() {
      const revision = hash(content);
      return {
        uri,
        content,
        revision,
        dirty: false,
        kind: "notes",
        source: SOURCE,
        sourceRevision: { contentRevision: revision, diskRevision: revision, dirty: false },
      };
    },
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
}

describe("createNotesWorkspaceWriter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adapts append and exact note edits into coordinator mutations", async () => {
    const fixture = coordinatorFor("---\nafx: true\ntype: NOTES\n---\n");
    const writer = createNotesWorkspaceWriter({
      fileState: fileState(fixture.content()),
      coordinator: fixture.coordinator,
      now: () => new Date(2026, 6, 19, 12, 30, 0, 123),
    });

    await writer.mutate({
      requestId: "append",
      target: SOURCE,
      expectedRevision: hash(fixture.content()),
      mutation: { kind: "append", text: "First\n\n- [ ] Check" },
    });
    const parsed = NotesMarkdownDocument.parse(fixture.content());
    expect(parsed.notes[0]).toMatchObject({ text: "First\n\n- [ ] Check" });
    expect(fixture.requests[0]).toMatchObject({ allowCreate: true });

    await writer.mutate({
      requestId: "edit",
      target: SOURCE,
      expectedRevision: hash(fixture.content()),
      mutation: { kind: "edit", noteId: parsed.notes[0]!.id, text: "Updated" },
    });
    expect(NotesMarkdownDocument.parse(fixture.content()).notes[0]?.text).toBe("Updated");
    expect(fixture.requests[1]).toMatchObject({ allowCreate: false });
  });

  it("creates the default source through the exact workspace identity", async () => {
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: vscode.Uri.file("/workspace"), name: "workspace", index: 0 },
    ]);
    const fixture = coordinatorFor("");
    const writer = createNotesWorkspaceWriter({
      fileState: fileState(""),
      coordinator: fixture.coordinator,
      now: () => new Date(2026, 6, 19, 8, 0, 0, 0),
    });

    const result = await writer.appendToDefault("From chat");

    expect(result).toMatchObject({ outcome: "success", target: SOURCE });
    expect(fixture.requests[0]).toMatchObject({
      target: SOURCE,
      allowCreate: true,
    });
    expect(fixture.content()).toContain("### 08:00:00.000\nFrom chat");
  });

  it("fails closed when a stale note locator reaches the parser", async () => {
    const fixture = coordinatorFor("## 2026-07-19\n### 08:00:00.000\nKeep\n");
    fixture.coordinator.mutateText = async (request) => {
      await expect(
        Promise.resolve().then(() => request.transform(fixture.content())),
      ).rejects.toThrow("selected note moved or no longer exists");
      return {
        type: "afxMutationResult",
        requestId: request.requestId,
        outcome: "error",
        target: request.target,
        code: "parse-error",
        message: "The selected note moved or no longer exists.",
        retryable: false,
      };
    };
    const writer = createNotesWorkspaceWriter({
      fileState: fileState(fixture.content()),
      coordinator: fixture.coordinator,
    });

    await expect(
      writer.mutate({
        requestId: "stale",
        target: SOURCE,
        expectedRevision: hash(fixture.content()),
        mutation: { kind: "delete", noteId: "stale" },
      }),
    ).resolves.toMatchObject({ outcome: "error", code: "parse-error" });
  });
});
