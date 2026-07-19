/**
 * @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-16]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-PERSISTENT-TEST]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AgentToChat, ChatToAgent } from "@afx/shared";
import type { Transport } from "@afx/transport";

import { initTransport } from "../lib/bridge";
import { SessionBrowser } from "./session-browser";

describe("SessionBrowser", () => {
  it("uses the Chat timeline for a read-only persisted transcript without duplicate tool rows", async () => {
    const listeners = new Map<string, Set<(message: AgentToChat) => void>>();
    const emit = (message: AgentToChat): void => {
      for (const listener of listeners.get(message.type) ?? []) listener(message);
    };
    const transport: Transport = {
      send(message: ChatToAgent): void {
        if (message.type === "session/list") {
          emit({
            type: "session/list",
            supported: true,
            sessions: [
              {
                id: "session-1",
                path: "/sessions/session-1.jsonl",
                label: "Timeline parity",
                firstMessage: "Inspect the transcript",
                messageCount: 4,
                createdAt: 1,
                updatedAt: 4,
              },
            ],
          });
        }
        if (message.type === "history/load") {
          emit({
            type: "history/loaded",
            sessionPath: message.sessionPath,
            entries: [
              { role: "user", text: "Inspect the transcript", createdAt: 1 },
              {
                role: "assistant",
                text: "Checking.",
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
                  summary: "loaded",
                },
              },
              { role: "bash", createdAt: 4, bash: { command: "pnpm verify", exitCode: 0 } },
            ],
          });
        }
      },
      on(type, handler) {
        const set = listeners.get(type) ?? new Set<(message: AgentToChat) => void>();
        const listener = handler as (message: AgentToChat) => void;
        set.add(listener);
        listeners.set(type, set);
        return () => set.delete(listener);
      },
      dispose(): void {
        listeners.clear();
      },
    };
    initTransport(transport);

    const user = userEvent.setup();
    const { container } = render(<SessionBrowser />);
    await user.click(await screen.findByTitle("Open session"));

    expect(await screen.findByRole("log")).toHaveAttribute("aria-live", "off");
    expect(screen.getAllByText("read")).toHaveLength(1);
    expect(screen.getByText("pnpm verify")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-timeline-marker="assistant"]')).toHaveLength(1);
  });
});
