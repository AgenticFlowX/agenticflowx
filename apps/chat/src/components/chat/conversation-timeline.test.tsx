/**
 * ConversationTimeline tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-A11Y] [DES-PERF]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatTimelineItem, ChatToolView } from "@afx/shared";

import { ConversationTimeline } from "./conversation-timeline";

const noop = vi.fn();
const MAY_16 = new Date(2026, 4, 16, 9, 0, 0).getTime();
const MAY_17 = new Date(2026, 4, 17, 9, 0, 0).getTime();
const LEGACY_MARKER = `AFX-UI-${"ACTIONS"}`;

describe("ConversationTimeline", () => {
  it("renders day groups and core row kinds in chronological order inside a polite log", () => {
    render(
      <ConversationTimeline
        messages={[
          msg("u1", "user", "hello", MAY_16),
          msg("a1", "assistant", "hi there", MAY_16 + 3_000),
          {
            id: "c1",
            role: "compactionSummary",
            summary: "Older context compacted",
            tokensBefore: 12345,
            createdAt: MAY_16 + 5_000,
          } as unknown as ChatTimelineItem,
        ]}
        noteEvents={[{ id: "n1", content: "saved note", savedAt: MAY_16 + 4_000 }]}
        commandOutputs={[
          {
            requestId: "cmd1",
            command: "pnpm test",
            stdout: "ok",
            stderr: "",
            exitCode: 0,
            createdAt: MAY_16 + 2_000,
          },
        ]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-relevant", "additions");
    expect(log).toHaveAttribute("aria-atomic", "false");
    expect(screen.getByText("SAT, 16 MAY")).toBeInTheDocument();
    expect(screen.getByText("1 turn")).toBeInTheDocument();
    expect(log).toHaveTextContent(
      /hello[\s\S]*pnpm test[\s\S]*hi there[\s\S]*saved note[\s\S]*Session compacted/,
    );
  });

  it("counts one day header per local day and starts a new turn for each user", () => {
    render(
      <ConversationTimeline
        messages={[
          msg("u1", "user", "first request", MAY_16),
          msg("a1", "assistant", "first answer", MAY_16 + 1_000),
          msg("u2", "user", "second request", MAY_16 + 2_000),
          msg("a2", "assistant", "second answer", MAY_16 + 3_000),
          msg("u3", "user", "next day request", MAY_17),
          msg("a3", "assistant", "next day answer", MAY_17 + 1_000),
        ]}
        noteEvents={[]}
        commandOutputs={[]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    expect(screen.getAllByText("SAT, 16 MAY")).toHaveLength(1);
    expect(screen.getAllByText("SUN, 17 MAY")).toHaveLength(1);
    expect(screen.getByText("2 turns")).toBeInTheDocument();
    expect(screen.getByText("1 turn")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-turn-context")).not.toBeInTheDocument();
  });

  it("hides obsolete machine-action marker blocks from stale assistant rows", () => {
    render(
      <ConversationTimeline
        messages={[
          msg(
            "a1",
            "assistant",
            `Visible result.

<!-- ${LEGACY_MARKER}:START -->
{"actions":[{"label":"Run"}]}
<!-- ${LEGACY_MARKER}:END -->

Still visible.`,
            MAY_16,
          ),
        ]}
        noteEvents={[]}
        commandOutputs={[]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    expect(screen.getByText("Visible result.")).toBeInTheDocument();
    expect(screen.getByText("Still visible.")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(LEGACY_MARKER))).not.toBeInTheDocument();
    expect(screen.queryByText(/"actions"/)).not.toBeInTheDocument();
  });

  it("keeps sticky day headers above opaque rail markers", () => {
    const { container } = render(
      <ConversationTimeline
        messages={[
          msg("u1", "user", "first request", MAY_16),
          msg("a1", "assistant", "first answer", MAY_16 + 1_000),
        ]}
        noteEvents={[]}
        commandOutputs={[]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    expect(screen.getByTestId("timeline-day-header")).toHaveClass(
      "z-20",
      "bg-background",
      "shadow-sm",
    );
    expect(container.querySelector('[data-timeline-marker="user"]')).toHaveClass(
      "bg-background",
      "ring-[4px]",
      "ring-background",
    );
    expect(container.querySelector('[data-timeline-marker="assistant"]')).toHaveClass(
      "bg-background",
      "ring-[4px]",
      "ring-background",
    );
  });

  it("shows the floating turn context only after the user row scrolls above", () => {
    const observer = installIntersectionObserverMock();
    const longPrompt = [
      "population of fiji, mt cook, hawaii in 2011, split it by ethnicity",
      "and keep this long enough that the floating context needs to clamp instead of stretching",
      "the whole chat timeline while the original prompt is off screen",
    ].join(" ");

    try {
      render(
        <ConversationTimeline
          messages={[
            msg("u1", "user", longPrompt, MAY_16),
            msg("a1", "assistant", "Here is the breakdown.", MAY_16 + 1_000),
          ]}
          noteEvents={[]}
          commandOutputs={[]}
          onSendCommand={noop}
          onInsertCommand={noop}
        />,
      );

      expect(screen.queryByTestId("timeline-turn-context")).not.toBeInTheDocument();

      act(() => {
        observer.instances[0]?.callback(
          [
            intersectionEntry({
              target: observer.instances[0].observe.mock.calls[0]?.[0] as Element,
              isIntersecting: false,
              rowBottom: -1,
              rootTop: 0,
            }),
          ],
          observer.instances[0].observer,
        );
      });

      const context = screen.getByTestId("timeline-turn-context");
      expect(context).toHaveAttribute("aria-hidden", "true");
      expect(context).toHaveAttribute("title", longPrompt);
      expect(context).toHaveTextContent(/population of fiji/);
      expect(screen.getByTestId("timeline-turn-context-time")).toHaveClass("whitespace-nowrap");
      expect(screen.getByTestId("timeline-turn-context-prompt")).toHaveClass("line-clamp-3");
    } finally {
      observer.restore();
    }
  });

  it("keeps user, tool, shell, and AFX response ordered inside one turn", () => {
    render(
      <ConversationTimeline
        messages={[
          msg("u1", "user", "inspect the timeline", MAY_16),
          msg("a1", "assistant", "timeline checked", MAY_16 + 3_000, [
            tool("read-1", "read_file", "apps/chat/src/components/chat/conversation-timeline.tsx"),
          ]),
        ]}
        noteEvents={[]}
        commandOutputs={[
          {
            requestId: "cmd1",
            command: "pnpm --filter apps/chat test",
            stdout: "passed",
            stderr: "",
            exitCode: 0,
            createdAt: MAY_16 + 2_000,
          },
        ]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    expect(screen.getByRole("log")).toHaveTextContent(
      /inspect the timeline[\s\S]*pnpm --filter apps\/chat test[\s\S]*apps\/chat\/src\/components\/chat\/conversation-timeline\.tsx[\s\S]*timeline checked/,
    );
    expect(screen.getByText("1 turn")).toBeInTheDocument();
  });

  it("keeps notes and compaction rows standalone without adding turns", () => {
    render(
      <ConversationTimeline
        messages={[
          msg("u1", "user", "please compact later", MAY_16),
          msg("a1", "assistant", "sure", MAY_16 + 1_000),
          {
            id: "c1",
            role: "compactionSummary",
            summary: "Older context compacted",
            tokensBefore: 9999,
            createdAt: MAY_16 + 3_000,
          } as unknown as ChatTimelineItem,
        ]}
        noteEvents={[{ id: "n1", content: "standalone note", savedAt: MAY_16 + 2_000 }]}
        commandOutputs={[]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    expect(screen.getByText("1 turn")).toBeInTheDocument();
    expect(screen.getByText("standalone note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compacted/i })).toBeInTheDocument();
  });

  it("suppresses empty assistant placeholders and announces errors assertively", () => {
    render(
      <ConversationTimeline
        messages={[
          msg("u1", "user", "debug", MAY_16),
          msg("a-empty", "assistant", "", MAY_16 + 1_000),
          msg("a-error", "assistant", "⚠ Something failed", MAY_16 + 2_000),
        ]}
        noteEvents={[]}
        commandOutputs={[]}
        onSendCommand={noop}
        onInsertCommand={noop}
      />,
    );

    expect(screen.queryAllByText("AFX")).toHaveLength(0);
    expect(screen.getByText(/Something failed/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Conversation contains an error event.");
  });
});

function msg(
  id: string,
  role: "user" | "assistant",
  content: string,
  createdAt: number,
  tools?: ChatToolView[],
): ChatTimelineItem {
  return { id, role, content, createdAt, tools };
}

function tool(toolCallId: string, toolName: string, path: string): ChatToolView {
  return {
    toolCallId,
    toolName,
    status: "ok",
    args: { path },
    summary: "read ok",
  };
}

interface MockObserverInstance {
  callback: IntersectionObserverCallback;
  observer: IntersectionObserver;
  observe: ReturnType<typeof vi.fn>;
}

function installIntersectionObserverMock(): {
  instances: MockObserverInstance[];
  restore: () => void;
} {
  const original = globalThis.IntersectionObserver;
  const instances: MockObserverInstance[] = [];

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.root = options?.root ?? null;
      instances.push({ callback, observer: this, observe: this.observe });
    }
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  return {
    instances,
    restore: () => {
      if (original) {
        vi.stubGlobal("IntersectionObserver", original);
        return;
      }
      Reflect.deleteProperty(globalThis, "IntersectionObserver");
    },
  };
}

function intersectionEntry({
  target,
  isIntersecting,
  rowBottom,
  rootTop,
}: {
  target: Element;
  isIntersecting: boolean;
  rowBottom: number;
  rootTop: number;
}): IntersectionObserverEntry {
  return {
    time: 0,
    target,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: rect(rowBottom - 20, rowBottom),
    intersectionRect: isIntersecting ? rect(rowBottom - 20, rowBottom) : rect(0, 0),
    rootBounds: rect(rootTop, rootTop + 600),
  };
}

function rect(top: number, bottom: number): DOMRectReadOnly {
  return {
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 400,
    width: 400,
    height: bottom - top,
    toJSON: () => ({}),
  };
}
