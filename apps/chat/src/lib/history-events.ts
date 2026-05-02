/**
 * UI-local adapter from current chat transcript data to active-session work-log rows.
 *
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-11] [FR-12] [4.1]
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [DES-HISTORY] [DES-DATA]
 */
import type {
  ChatCompactionView,
  ChatMessageView,
  ChatTimelineItem,
  ChatToolView,
  ChatUsageView,
} from "@afx/shared";

import { toolDescriptor } from "./tool-descriptor";

export type HistoryDensity = "narrative" | "trace" | "audit";

export type ChatHistoryEventKind =
  | "message.user"
  | "message.assistant"
  | "file.read"
  | "file.edit"
  | "command.run"
  | "search"
  | "list"
  | "usage"
  | "activity"
  | "failed"
  | "compaction";

export interface ChatHistoryEvent {
  id: string;
  kind: ChatHistoryEventKind;
  density: HistoryDensity;
  createdAt: number;
  action: string;
  target: string;
  status: "running" | "ok" | "error" | "info";
  detail?: string;
  usage?: ChatUsageView;
  /** Present for compaction events only. */
  compaction?: {
    summary: string;
    tokensBefore: number;
  };
}

/**
 * Converts a timeline item list into history events for the History view.
 * Compaction summaries are shown as distinct "compaction" events.
 */
export function deriveHistoryEvents(messages: readonly ChatTimelineItem[]): ChatHistoryEvent[] {
  const events: ChatHistoryEvent[] = [];
  for (const message of messages) {
    // Compaction summaries become distinct history events.
    if (message.role === "compactionSummary") {
      const compaction = message as ChatCompactionView;
      events.push({
        id: compaction.id,
        kind: "compaction",
        density: "narrative",
        createdAt: compaction.createdAt,
        action: "Compacted",
        target: compact(compaction.summary) || "Session compacted",
        status: "info",
        compaction: {
          summary: compaction.summary,
          tokensBefore: compaction.tokensBefore,
        },
      });
      continue;
    }
    const msg = message;

    if (msg.role === "user") {
      events.push({
        id: msg.id,
        kind: "message.user",
        density: "narrative",
        createdAt: msg.createdAt,
        action: "Asked",
        target: compact(msg.content) || "Empty prompt",
        status: "info",
      });
      continue;
    }

    for (const tool of msg.tools ?? []) {
      events.push(toolEvent(msg, tool));
    }

    if (msg.content.trim().length > 0 || msg.streaming) {
      events.push({
        id: `${msg.id}:assistant`,
        kind: "message.assistant",
        density: "narrative",
        createdAt: msg.createdAt,
        action: msg.streaming ? "Responding" : "Answered",
        target: compact(msg.content) || "Working on response",
        status: msg.streaming ? "running" : "ok",
        detail: msg.stopReason?.replace(/_/g, " "),
      });
    }

    if (msg.usage) {
      events.push({
        id: `${msg.id}:usage`,
        kind: "usage",
        density: "trace",
        createdAt: msg.createdAt,
        action: "Used",
        target: `${formatCompact(msg.usage.tokens.total)} tokens`,
        status: "info",
        detail:
          msg.usage.contextUsage?.percent == null
            ? undefined
            : `Context ${Math.round(msg.usage.contextUsage.percent)}%`,
        usage: msg.usage,
      });
    }
  }
  return events.sort((a, b) => b.createdAt - a.createdAt);
}

function toolEvent(message: ChatMessageView, tool: ChatToolView): ChatHistoryEvent {
  const descriptor = toolDescriptor(tool);
  const kind = classifyTool(tool);
  return {
    id: `${message.id}:${tool.toolCallId}`,
    kind,
    density: kind === "failed" ? "trace" : "audit",
    createdAt: message.createdAt,
    action: descriptor.action,
    // History rows summarise the row with whatever identifies the call best:
    // the args-derived target (path/command) when available, otherwise the
    // tool result summary, falling back to the tool name.
    target: descriptor.target ?? tool.summary ?? tool.toolName,
    status: tool.status === "running" ? "running" : tool.status === "error" ? "error" : "ok",
    detail: tool.toolName,
  };
}

function classifyTool(tool: ChatToolView): ChatHistoryEventKind {
  if (tool.status === "error") return "failed";
  const name = tool.toolName.toLowerCase();
  if (
    name.includes("edit") ||
    name.includes("write") ||
    name.includes("patch") ||
    name.includes("replace")
  ) {
    return "file.edit";
  }
  if (name === "bash" || name.includes("command") || name.includes("exec")) return "command.run";
  if (name.includes("search") || name.includes("grep")) return "search";
  if (
    name.includes("list") ||
    name.includes("find") ||
    name.includes("ls") ||
    name.includes("tree")
  )
    return "list";
  if (name.includes("read") || /\bfile\b/.test(name) || name.endsWith("_file")) return "file.read";
  return "activity";
}

function compact(text: string): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > 96 ? `${value.slice(0, 96)}…` : value;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
