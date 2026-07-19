/**
 * @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-16]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-TEST]
 */
import { describe, expect, it } from "vitest";

import type { AgentTranscriptEntry } from "./agent";
import { transcriptToTimeline } from "./transcript-to-timeline";

describe("transcriptToTimeline", () => {
  it("pairs results with their calls and keeps unmatched tools and bash in the timeline once", () => {
    const entries: AgentTranscriptEntry[] = [
      { role: "user", text: "inspect it", createdAt: 1 },
      {
        role: "assistant",
        text: "Checking now.",
        createdAt: 2,
        toolCalls: [{ id: "read-1", name: "read", args: { path: "src/app.ts" } }],
      },
      {
        role: "tool",
        createdAt: 3,
        toolResult: {
          toolCallId: "read-1",
          toolName: "read",
          ok: true,
          summary: "file contents",
        },
      },
      {
        role: "tool",
        createdAt: 4,
        toolResult: {
          toolCallId: "orphan-1",
          toolName: "search",
          ok: false,
          summary: "not found",
        },
      },
      {
        role: "bash",
        text: "tests failed\n1 error",
        createdAt: 5,
        bash: { command: "pnpm verify", exitCode: 1 },
      },
    ];

    expect(transcriptToTimeline(entries)).toEqual({
      messages: [
        { id: "hist-0", role: "user", content: "inspect it", createdAt: 1 },
        {
          id: "hist-1",
          role: "assistant",
          content: "Checking now.",
          createdAt: 2,
          tools: [
            {
              toolCallId: "read-1",
              toolName: "read",
              status: "ok",
              args: { path: "src/app.ts" },
              summary: "file contents",
            },
          ],
        },
        {
          id: "hist-3",
          role: "assistant",
          content: "",
          createdAt: 4,
          tools: [
            {
              toolCallId: "orphan-1",
              toolName: "search",
              status: "error",
              summary: "not found",
            },
          ],
        },
        {
          id: "hist-4",
          role: "assistant",
          content: "",
          createdAt: 5,
          tools: [
            {
              toolCallId: "bash-4",
              toolName: "bash",
              status: "error",
              args: { command: "pnpm verify" },
              summary: "tests failed\n1 error",
            },
          ],
        },
      ],
      tools: [
        {
          toolCallId: "read-1",
          toolName: "read",
          status: "ok",
          args: { path: "src/app.ts" },
          summary: "file contents",
        },
        {
          toolCallId: "orphan-1",
          toolName: "search",
          status: "error",
          summary: "not found",
        },
        {
          toolCallId: "bash-4",
          toolName: "bash",
          status: "error",
          args: { command: "pnpm verify" },
          summary: "tests failed\n1 error",
        },
      ],
    });
  });

  it("keeps a persisted tool call without a result in the incomplete running state", () => {
    const result = transcriptToTimeline([
      {
        role: "assistant",
        text: "Still checking.",
        createdAt: 1,
        toolCalls: [{ id: "read-incomplete", name: "read", args: { path: "src/app.ts" } }],
      },
    ]);

    expect({
      timelineStatus:
        result.messages[0]?.role === "assistant"
          ? result.messages[0].tools?.[0]?.status
          : undefined,
      snapshotStatus: result.tools[0]?.status,
    }).toEqual({ timelineStatus: "running", snapshotStatus: "running" });
  });
});
