/**
 * Shared persisted-transcript adapter used by both History preview and reopen.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-16]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-UI]
 */
import type { AgentTranscriptEntry } from "./agent";
import type { ChatMessageView, ChatTimelineItem, ChatToolView } from "./messages";

export interface TranscriptTimeline {
  messages: ChatTimelineItem[];
  tools: ChatToolView[];
}

/**
 * Converts a persisted runtime transcript into the same timeline shape used by
 * live Chat. Tool results update their originating calls instead of creating a
 * second row; standalone results and bash entries remain visible as tool-only
 * assistant timeline items.
 */
export function transcriptToTimeline(entries: readonly AgentTranscriptEntry[]): TranscriptTimeline {
  const messages: ChatTimelineItem[] = [];
  const tools: ChatToolView[] = [];
  const toolById = new Map<string, ChatToolView>();

  const addToolOnlyMessage = (id: string, createdAt: number, tool: ChatToolView): void => {
    tools.push(tool);
    messages.push({ id, role: "assistant", content: "", createdAt, tools: [tool] });
  };

  entries.forEach((entry, index) => {
    const id = `hist-${index}`;
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
        const turnTools = (entry.toolCalls ?? []).map((call) => {
          const tool: ChatToolView = {
            toolCallId: call.id,
            toolName: call.name,
            status: "running",
            args: call.args,
          };
          toolById.set(call.id, tool);
          tools.push(tool);
          return tool;
        });
        const message: ChatMessageView = {
          id,
          role: "assistant",
          content: entry.text ?? "",
          createdAt: entry.createdAt,
          ...(entry.thinking ? { thinking: entry.thinking } : {}),
          ...(turnTools.length ? { tools: turnTools } : {}),
        };
        messages.push(message);
        break;
      }
      case "tool": {
        const result = entry.toolResult;
        if (!result) break;
        const existing = toolById.get(result.toolCallId);
        if (existing) {
          existing.status = result.ok ? "ok" : "error";
          if (result.summary) existing.summary = result.summary;
          break;
        }
        addToolOnlyMessage(id, entry.createdAt, {
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          status: result.ok ? "ok" : "error",
          ...(result.summary ? { summary: result.summary } : {}),
        });
        break;
      }
      case "bash": {
        const command = entry.bash?.command;
        addToolOnlyMessage(id, entry.createdAt, {
          toolCallId: `bash-${index}`,
          toolName: "bash",
          status: entry.bash?.exitCode !== undefined && entry.bash.exitCode !== 0 ? "error" : "ok",
          ...(command ? { args: { command } } : {}),
          ...(entry.text ? { summary: entry.text } : {}),
        });
        break;
      }
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
