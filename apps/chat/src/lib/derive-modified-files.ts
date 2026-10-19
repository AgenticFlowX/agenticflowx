/**
 * Derive the list of files modified by agent edit/write tool calls in the newest
 * assistant edit batch. Pure helper consumed by the composer's `FilesPanelBody`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import type { ChatTimelineItem, ChatToolView } from "@afx/shared";

export interface ModifiedFile {
  path: string;
  toolCallId: string;
  status: "running" | "ok" | "error";
  assistantMessageId: string;
  lastTurnIndex: number;
  /**
   * First line changed by this tool call (1-indexed) when the underlying tool
   * reports it (e.g. pi-mono `edit.result.details.firstChangedLine`). Used by
   * the FilesPanel source control to jump the editor selection.
   */
  line?: number;
}

export interface DerivedModifiedFiles {
  files: ModifiedFile[];
  /** ID of the most recent assistant message that produced any file edit. */
  latestEditingAssistantMessageId: string | null;
}

const EDIT_TOOL_NAMES = new Set([
  "edit",
  "write",
  "patch",
  "create",
  "edit_file",
  "write_file",
  "apply_patch",
  "create_file",
  "notebookedit",
  "notebook_edit",
  "multiedit",
  "multi_edit",
  "str_replace_editor",
]);
const EDIT_TOOL_SUFFIXES = [
  "_edit_file",
  "_write_file",
  "_apply_patch",
  "_create_file",
  "_notebook_edit",
  "_multi_edit",
  "_str_replace_editor",
] as const;
const PATH_KEYS = ["path", "filePath", "file_path", "notebook_path"] as const;

/**
 * Canonicalize a path string for dedupe and host resolution. Trims, converts
 * backslashes (Windows) to forward slashes, strips a leading `./`, and collapses
 * runs of `/`. Pure string normalization — no filesystem access.
 *
 * Why: agents may emit the same workspace file as `src/foo.ts`, `./src/foo.ts`,
 * or even `src//foo.ts`. Without this, dedupe would treat them as distinct.
 */
function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/");
}

export function deriveModifiedFiles(timeline: readonly ChatTimelineItem[]): DerivedModifiedFiles {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const item = timeline[index];
    if (!item) continue;
    if (item.role !== "assistant") continue;
    const tools = item.tools ?? [];
    const files: ModifiedFile[] = [];
    const seenPaths = new Set<string>();

    // Walk newest-first so the latest call for a normalized path wins and the
    // resulting batch retains tool recency without a second sorting key.
    for (let toolIndex = tools.length - 1; toolIndex >= 0; toolIndex -= 1) {
      const t = tools[toolIndex];
      if (!t) continue;
      if (!isEditTool(t)) continue;
      const rawPath = extractPath(t.args);
      if (!rawPath) continue;
      const filePath = normalizePath(rawPath);
      if (!filePath || seenPaths.has(filePath)) continue;
      seenPaths.add(filePath);
      files.push({
        path: filePath,
        toolCallId: t.toolCallId,
        status: t.status,
        assistantMessageId: item.id,
        lastTurnIndex: index,
        line: t.firstChangedLine,
      });
    }

    if (files.length > 0) {
      return { files, latestEditingAssistantMessageId: item.id };
    }
  }

  return { files: [], latestEditingAssistantMessageId: null };
}

function isEditTool(t: ChatToolView): boolean {
  const normalized = t.toolName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return (
    EDIT_TOOL_NAMES.has(normalized) ||
    EDIT_TOOL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function extractPath(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  for (const key of PATH_KEYS) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
