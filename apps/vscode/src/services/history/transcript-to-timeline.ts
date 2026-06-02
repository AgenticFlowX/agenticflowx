/**
 * Map a normalized `AgentTranscriptEntry[]` (from `HistoryService.getTranscript`)
 * into the chat view's `ChatTimelineItem[]` + `ChatToolView[]` so reopening a
 * past session rehydrates the Chat view through the same `chat/state` snapshot
 * the live stream produces.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-16]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-BRIDGE]
 */
import type {
  AgentTranscriptEntry,
  ChatMessageView,
  ChatTimelineItem,
  ChatToolView,
} from "@afx/shared";

export function transcriptToTimeline(entries: readonly AgentTranscriptEntry[]): {
  messages: ChatTimelineItem[];
  tools: ChatToolView[];
} {
  const messages: ChatTimelineItem[] = [];
  const tools: ChatToolView[] = [];
  const toolById = new Map<string, ChatToolView>();

  entries.forEach((entry, i) => {
    const id = `hist-${i}`;
    switch (entry.role) {
      case "user":
        messages.push({
          id,
          role: "user",
          content: entry.text ?? "",
          createdAt: entry.createdAt,
        });
        break;
      case "assistant": {
        const turnTools: ChatToolView[] = (entry.toolCalls ?? []).map((tc) => {
          const view: ChatToolView = {
            toolCallId: tc.id,
            toolName: tc.name,
            status: "ok",
            args: tc.args,
          };
          toolById.set(tc.id, view);
          tools.push(view);
          return view;
        });
        const msg: ChatMessageView = {
          id,
          role: "assistant",
          content: entry.text ?? "",
          createdAt: entry.createdAt,
          ...(entry.thinking ? { thinking: entry.thinking } : {}),
          ...(turnTools.length ? { tools: turnTools } : {}),
        };
        messages.push(msg);
        break;
      }
      case "tool": {
        const tr = entry.toolResult;
        if (!tr) break;
        const existing = toolById.get(tr.toolCallId);
        if (existing) {
          existing.status = tr.ok ? "ok" : "error";
          if (tr.summary) existing.summary = tr.summary;
        } else {
          tools.push({
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            status: tr.ok ? "ok" : "error",
            ...(tr.summary ? { summary: tr.summary } : {}),
          });
        }
        break;
      }
      case "bash":
        tools.push({
          toolCallId: `bash-${i}`,
          toolName: "bash",
          status:
            entry.bash && entry.bash.exitCode !== undefined && entry.bash.exitCode !== 0
              ? "error"
              : "ok",
          ...(entry.bash?.command ? { summary: entry.bash.command } : {}),
        });
        break;
      case "compaction":
        messages.push({
          id,
          role: "compactionSummary",
          summary: entry.text ?? "",
          tokensBefore: 0,
          createdAt: entry.createdAt,
        });
        break;
    }
  });

  return { messages, tools };
}
