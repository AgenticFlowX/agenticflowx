import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createMockTransport } from "@afx/transport";

import { initTransport } from "../../lib/bridge";
import type { ChatProps } from "./chat-window";
import { ChatWindow } from "./chat-window";

function createChatProps(): ChatProps {
  return {
    draft: "",
    onDraftChange: vi.fn(),
    promptHistory: [],
    onPromptHistoryAppend: vi.fn(),
  };
}

function withScrollIntoViewMock(run: (scrollIntoView: ReturnType<typeof vi.fn>) => void): void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  try {
    run(scrollIntoView);
  } finally {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  }
}

describe("ChatWindow scroll pinning", () => {
  it("keeps the empty welcome anchored at the top", () => {
    withScrollIntoViewMock((scrollIntoView) => {
      const transport = createMockTransport();
      transport.setState?.({
        chatView: {
          messages: [],
          commandOutputs: [],
          noteEvents: [],
          workspaceMode: "code",
        },
      });
      initTransport(transport);

      render(<ChatWindow {...createChatProps()} />);

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it("still pins real timeline content to the bottom", () => {
    withScrollIntoViewMock((scrollIntoView) => {
      const transport = createMockTransport();
      transport.setState?.({
        chatView: {
          messages: [
            {
              id: "user-1",
              role: "user",
              content: "Continue the release review",
              createdAt: 1,
            },
          ],
          commandOutputs: [],
          noteEvents: [],
          workspaceMode: "code",
        },
      });
      initTransport(transport);

      render(<ChatWindow {...createChatProps()} />);

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "end" });
    });
  });
});
