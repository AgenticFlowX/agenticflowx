/**
 * Tool event descriptors for chat timeline and history work-log rows.
 *
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-10] [3.3]
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [DES-CHAT] [DES-TEST]
 */
import {
  CircleHelp,
  FileCode,
  FolderOpen,
  type LucideIcon,
  PencilLine,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";

import type { ChatToolView } from "@afx/shared";

export function toolDescriptor(tool: ChatToolView): {
  icon: LucideIcon;
  action: string;
  /** Short identifier for the timeline header — derived from the tool args. */
  target?: string;
} {
  const name = tool.toolName.toLowerCase();
  // Header always uses the args-derived identifier (e.g. command, path, query).
  // The tool result lives in `tool.summary` and is rendered as an expandable
  // body below, never inline in the header.
  const target = toolDetail(tool.args);
  const running = tool.status === "running";

  if (
    name.includes("edit") ||
    name.includes("write") ||
    name.includes("patch") ||
    name.includes("replace")
  ) {
    return { icon: PencilLine, action: running ? "Editing" : "Edited", target };
  }
  if (name === "bash" || name.includes("command") || name.includes("exec")) {
    return { icon: Terminal, action: running ? "Running command" : "Ran command", target };
  }
  if (name.includes("search") || name.includes("grep")) {
    return { icon: Search, action: running ? "Searching" : "Searched", target };
  }
  if (
    name.includes("list") ||
    name.includes("find") ||
    name.includes("ls") ||
    name.includes("tree")
  ) {
    return { icon: FolderOpen, action: running ? "Listing" : "Listed", target };
  }
  if (name.includes("read") || /\bfile\b/.test(name) || name.endsWith("_file")) {
    return { icon: FileCode, action: running ? "Reading" : "Read", target };
  }
  if (name.includes("ask") || name.includes("question")) {
    return { icon: CircleHelp, action: running ? "Asking input" : "Got input", target };
  }
  return { icon: Wrench, action: tool.toolName, target };
}

function toolDetail(args?: Record<string, unknown>): string | undefined {
  if (!args) return undefined;
  const value = args.command ?? args.path ?? args.pattern ?? args.query ?? args.filePath;
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > 56 ? `${value.slice(0, 56)}…` : value;
}
