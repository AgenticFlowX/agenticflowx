/**
 * @see docs/specs/213-app-chat-history/spec.md [FR-16]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-TEST]
 */
import { describe, expect, it } from "vitest";

import type { AgentTranscriptEntry } from "@afx/shared";

import { transcriptToTimeline } from "./transcript-to-timeline";

describe("transcriptToTimeline", () => {
  it("maps user + assistant entries and pairs a tool result with its call", () => {
    const entries: AgentTranscriptEntry[] = [
      { role: "user", text: "hi", createdAt: 1 },
      {
        role: "assistant",
        text: "hello",
        createdAt: 2,
        toolCalls: [{ id: "t1", name: "edit", args: { path: "a.ts" } }],
      },
      {
        role: "tool",
        createdAt: 3,
        toolResult: { toolCallId: "t1", toolName: "edit", ok: true, summary: "done" },
      },
    ];
    const { messages, tools } = transcriptToTimeline(entries);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "hi" });
    expect(messages[1]).toMatchObject({ role: "assistant", content: "hello" });
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ toolCallId: "t1", status: "ok", summary: "done" });
  });

  it("renders bash exit codes and compaction summaries", () => {
    const { messages, tools } = transcriptToTimeline([
      { role: "bash", createdAt: 1, bash: { command: "ls", exitCode: 0 } },
      { role: "bash", createdAt: 2, bash: { command: "false", exitCode: 1 } },
      { role: "compaction", text: "summary", createdAt: 3 },
    ]);
    expect(tools.find((t) => t.summary === "ls")?.status).toBe("ok");
    expect(tools.find((t) => t.summary === "false")?.status).toBe("error");
    expect(messages).toContainEqual(
      expect.objectContaining({ role: "compactionSummary", summary: "summary" }),
    );
  });

  it("treats a tool result without a matching call as a standalone failed tool", () => {
    const { tools } = transcriptToTimeline([
      { role: "tool", createdAt: 1, toolResult: { toolCallId: "x", toolName: "read", ok: false } },
    ]);
    expect(tools[0]).toMatchObject({ toolCallId: "x", toolName: "read", status: "error" });
  });
});
