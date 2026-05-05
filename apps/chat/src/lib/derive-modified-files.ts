/**
 * Derive the list of files modified by agent edit/write tool calls in the current
 * chat transcript. Pure helper consumed by the composer's `FilesStrip`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
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
   * the FilesStrip pill click to jump the editor selection.
   */
  line?: number;
}

export interface DerivedModifiedFiles {
  files: ModifiedFile[];
  /** ID of the most recent assistant message that produced any file edit. */
  latestEditingAssistantMessageId: string | null;
}

const EDIT_TOOL_PATTERN = /(edit|write|patch|create|notebookedit)/i;
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
  const byPath = new Map<string, ModifiedFile>();
  let latestEditingAssistantMessageId: string | null = null;

  timeline.forEach((item, index) => {
    if (item.role !== "assistant") return;
    const tools = item.tools ?? [];
    for (const t of tools) {
      if (!isEditTool(t)) continue;
      const rawPath = extractPath(t.args);
      if (!rawPath) continue;
      const filePath = normalizePath(rawPath);
      if (!filePath) continue;
      byPath.set(filePath, {
        path: filePath,
        toolCallId: t.toolCallId,
        status: t.status,
        assistantMessageId: item.id,
        lastTurnIndex: index,
        line: t.firstChangedLine,
      });
      latestEditingAssistantMessageId = item.id;
    }
  });

  const files = [...byPath.values()].sort((a, b) => b.lastTurnIndex - a.lastTurnIndex);
  return { files, latestEditingAssistantMessageId };
}

function isEditTool(t: ChatToolView): boolean {
  return EDIT_TOOL_PATTERN.test(t.toolName);
}

function extractPath(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  for (const key of PATH_KEYS) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
