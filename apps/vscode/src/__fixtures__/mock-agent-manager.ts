/**
 * Reusable AgentManager test double — vi.fn-backed for assertable calls.
 *
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 */
import { vi } from "vitest";

import type { AgentStatus } from "@afx/shared";

export function createMockAgentManager() {
  return {
    send: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    newSession: vi.fn(async () => {}),
    getStatus: vi.fn(
      async (): Promise<AgentStatus> => ({
        running: true,
        isStreaming: false,
        model: { provider: "openai", id: "gpt-5.2", name: "GPT-5.2" },
        thinkingLevel: "medium" as const,
        isCompacting: false,
        steeringMode: "all" as const,
        followUpMode: "all" as const,
        autoCompactionEnabled: true,
        autoRetryEnabled: true,
        sessionId: "test-session",
        sessionFile: "/tmp/agenticflowx-session.jsonl",
        messageCount: 0,
        pendingMessageCount: 0,
      }),
    ),
    getUsage: vi.fn(async () => null),
    getAvailableModels: vi.fn(async () => [
      {
        provider: "openai",
        id: "gpt-5.2",
        name: "GPT-5.2",
        reasoning: true,
        contextWindow: 400_000,
        maxTokens: 128_000,
      },
    ]),
    setModel: vi.fn(async () => ({
      provider: "openai",
      id: "gpt-5.2",
      name: "GPT-5.2",
      reasoning: true,
      contextWindow: 400_000,
      maxTokens: 128_000,
    })),
    switchSession: vi.fn(async () => ({ cancelled: false })),
    getCommands: vi.fn(async () => [
      { name: "skill:afx-task", description: "Manage tasks", source: "skill" as const },
    ]),
    getStderr: vi.fn(() => ""),
    compact: vi.fn(async () => ({
      summary: "compacted",
      firstKeptEntryId: "entry-1",
      tokensBefore: 0,
    })),
    steer: vi.fn(async () => {}),
    followUp: vi.fn(async () => {}),
    setThinkingLevel: vi.fn(async () => {}),
    setSteeringMode: vi.fn(async () => {}),
    setFollowUpMode: vi.fn(async () => {}),
    setAutoCompaction: vi.fn(async () => {}),
    setAutoRetry: vi.fn(async () => {}),
    respondToUiRequest: vi.fn(async () => {}),
    onEvent: vi.fn(() => ({ dispose: vi.fn() })),
    onStderr: vi.fn(() => ({ dispose: vi.fn() })),
    stop: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  };
}

export type MockAgentManager = ReturnType<typeof createMockAgentManager>;
