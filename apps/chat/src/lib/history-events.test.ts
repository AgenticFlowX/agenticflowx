import { describe, expect, it } from "vitest";

import type { ChatMessageView } from "@afx/shared";

import { deriveHistoryEvents } from "./history-events";

describe("deriveHistoryEvents", () => {
  it("maps transcript, tool, and usage data into active-session rows", () => {
    const messages: ChatMessageView[] = [
      { id: "u1", role: "user", content: "please update the chat view", createdAt: 1 },
      {
        id: "a1",
        role: "assistant",
        content: "Done.",
        createdAt: 2,
        tools: [
          {
            toolCallId: "t1",
            toolName: "edit_file",
            status: "ok",
            summary: "apps/chat/src/views/chat.tsx +18 -7",
          },
          {
            toolCallId: "t2",
            toolName: "read_file",
            status: "ok",
            args: { path: "packages/shared/src/messages.ts" },
          },
        ],
        usage: {
          tokens: { input: 1000, output: 300, cacheRead: 200, cacheWrite: 0, total: 1300 },
          cost: 0.01,
          contextUsage: { tokens: 1300, contextWindow: 200_000, percent: 0.65 },
        },
      },
    ];

    const events = deriveHistoryEvents(messages);

    expect(events.map((event) => event.kind)).toEqual([
      "file.edit",
      "file.read",
      "message.assistant",
      "usage",
      "message.user",
    ]);
    expect(events[0]).toMatchObject({
      action: "Edited",
      target: expect.stringContaining("chat.tsx"),
    });
    expect(events[3]).toMatchObject({ action: "Used", target: "1.3k tokens" });
  });

  it("keeps failed tools visible as failed rows", () => {
    const events = deriveHistoryEvents([
      {
        id: "a1",
        role: "assistant",
        content: "",
        createdAt: 1,
        tools: [{ toolCallId: "t1", toolName: "bash", status: "error", summary: "exit 1" }],
      },
    ]);

    expect(events[0]).toMatchObject({ kind: "failed", status: "error", target: "exit 1" });
  });
});
