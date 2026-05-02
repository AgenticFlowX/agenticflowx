/**
 * Shared helpers for reading and writing `.afx/notes.md` from the VS Code host.
 * Used by both WorkbenchPanel (afxAppendNote) and SidebarPanel (chat/saveNote).
 *
 * @see docs/specs/900-fleet/01-chat-ux-notes/01-chat-ux-notes.md [FR-2] [FR-3] [NFR-1] [NFR-4] [DES-NOTES-UTILS]
 */
import * as vscode from "vscode";

/**
 * Insert a new note entry at the top of the body — newest first.
 * If today's `## YYYY-MM-DD` heading already exists, prepend the new
 * `### HH:MM:SS.mmm` block right under it. Otherwise prepend a fresh
 * day section at the top of the body.
 */
export function insertNoteAtTop(
  existing: string,
  date: string,
  time: string,
  text: string,
): string {
  const fmMatch = existing.match(/^---\n[\s\S]*?\n---\n?/);
  const frontmatter = fmMatch?.[0] ?? "";
  const body = existing.slice(frontmatter.length).replace(/^\s+/, "");

  const newEntry = `### ${time}\n${text}`;
  const todayHeading = `## ${date}`;
  const todayIdx = body.search(new RegExp(`^##\\s+${date}\\s*$`, "m"));

  let nextBody: string;
  if (todayIdx === -1) {
    nextBody = `${todayHeading}\n\n${newEntry}\n${body ? `\n${body}` : ""}`;
  } else {
    const before = body.slice(0, todayIdx);
    const afterHeadingStart = todayIdx + todayHeading.length;
    const after = body.slice(afterHeadingStart).replace(/^\n+/, "");
    nextBody = `${before}${todayHeading}\n\n${newEntry}\n\n${after}`;
  }

  const fmTail = frontmatter && !frontmatter.endsWith("\n") ? "\n" : "";
  return `${frontmatter}${fmTail}${frontmatter ? "\n" : ""}${nextBody.trimEnd()}\n`;
}

export function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatLocalNoteTime(date: Date): string {
  return `${[
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

/** Append a note to `.afx/notes.md` in the first workspace folder. No-ops if no workspace is open. */
export async function appendNoteToWorkspace(text: string): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!root) return;
  const uri = vscode.Uri.joinPath(root, ".afx", "notes.md");
  let existing: string;
  try {
    existing = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
  } catch {
    existing = "---\nafx: true\ntype: NOTES\n---\n";
  }
  const now = new Date();
  const next = insertNoteAtTop(
    existing,
    formatLocalDate(now),
    formatLocalNoteTime(now),
    text.trim(),
  );
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
}
