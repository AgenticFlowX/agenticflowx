/**
 * Shared helpers for reading and writing `.afx/notes.md` from the VS Code host.
 * Used by both WorkbenchPanel (afxAppendNote) and SidebarPanel (chat/saveNote).
 * This is the canonical write path that the cross-zone notes flow funnels through.
 *
 * @see docs/specs/215-app-chat-notes/spec.md [FR-1] [FR-2] [FR-3]
 * @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-FLOW] [DES-NOTES-STORAGE] [DES-NOTES-CROSS-ZONE-FLOW]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-12] [FR-13]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-MUTATION] [DES-NOTES-MARKDOWN]
 */
import * as vscode from "vscode";

import type { NotesMutation, WorkbenchMutationResult, WorkbenchSourceIdentity } from "@afx/shared";

import { NotesMarkdownDocument } from "../services/notes-markdown";
import type { WorkbenchFileState } from "../services/workbench-file-state";
import type { WorkbenchMutationCoordinator } from "../services/workbench-mutation-coordinator";

const EMPTY_NOTES_SOURCE = "---\nafx: true\ntype: NOTES\n---\n";

export interface NotesMutationRequest {
  requestId: string;
  target: WorkbenchSourceIdentity;
  expectedRevision?: string;
  mutation: NotesMutation;
}

export interface NotesWorkspaceWriter {
  mutate(request: NotesMutationRequest): Promise<WorkbenchMutationResult>;
  appendToDefault(text: string): Promise<WorkbenchMutationResult | undefined>;
}

let installedWriter: NotesWorkspaceWriter | undefined;

/** Install the activation-scoped writer used by Chat, editor actions, and Workbench. */
export function installNotesWorkspaceWriter(writer: NotesWorkspaceWriter): vscode.Disposable {
  installedWriter = writer;
  return {
    dispose() {
      if (installedWriter === writer) installedWriter = undefined;
    },
  };
}

/**
 * Adapt a Notes mutation to the shared per-file Workbench coordinator.
 *
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-MUTATION] [DES-API]
 */
export function createNotesWorkspaceWriter(options: {
  fileState: WorkbenchFileState;
  coordinator: WorkbenchMutationCoordinator;
  now?: () => Date;
}): NotesWorkspaceWriter {
  const now = options.now ?? (() => new Date());

  const mutate = (request: NotesMutationRequest): Promise<WorkbenchMutationResult> =>
    options.coordinator.mutateText({
      requestId: request.requestId,
      target: request.target,
      expectedRevision: request.expectedRevision,
      allowCreate: request.mutation.kind === "append",
      transform(content) {
        const source = content || EMPTY_NOTES_SOURCE;
        const document = NotesMarkdownDocument.parse(source);
        const result = document.apply(
          request.mutation.kind === "append"
            ? { ...request.mutation, now: now() }
            : request.mutation,
        );
        if (!result.ok) {
          const message =
            result.reason === "note-not-found"
              ? "The selected note moved or no longer exists."
              : result.reason === "checkbox-not-found"
                ? "The selected checklist item moved or no longer exists."
                : "The Notes source is malformed and cannot be changed safely.";
          throw new Error(message);
        }
        return result.content;
      },
    });

  return {
    mutate,
    async appendToDefault(text) {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!root || !text.trim()) return undefined;
      const uri = vscode.Uri.joinPath(root, ".afx", "notes.md");
      const target = options.fileState.identify(uri);
      if (!target) return undefined;
      const current = await options.fileState.readText(uri);
      return mutate({
        requestId: `notes-host-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        target,
        expectedRevision: current?.revision,
        mutation: { kind: "append", text: text.trim() },
      });
    },
  };
}

/**
 * Append a note to `.afx/notes.md` in the first workspace folder. No-ops if no workspace is open.
 *
 * @see docs/specs/215-app-chat-notes/spec.md [FR-1] [FR-2] [FR-3]
 * @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-FLOW] [DES-NOTES-STORAGE]
 */
export async function appendNoteToWorkspace(text: string): Promise<void> {
  if (installedWriter) {
    const result = await installedWriter.appendToDefault(text);
    if (result && result.outcome !== "success") throw new Error(result.message);
    return;
  }
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) return;
  const uri = vscode.Uri.joinPath(root, ".afx", "notes.md");
  let existing: string;
  try {
    existing = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
  } catch {
    existing = "---\nafx: true\ntype: NOTES\n---\n";
  }
  const parsed = NotesMarkdownDocument.parse(existing);
  const patched = parsed.apply({ kind: "append", text: text.trim(), now: new Date() });
  if (!patched.ok) throw new Error("The Notes source is malformed and cannot be changed safely.");
  const next = patched.content;
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
}
