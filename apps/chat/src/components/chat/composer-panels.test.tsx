/**
 * Composer panel body unit tests. Chrome (title, dismiss, collapse, error
 * boundary, count badge) belongs to `ComposerPanel` and is covered separately
 * by `composer-panel-stack.test.tsx`.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI] [DES-DATA]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BlockedCommandPanelBody,
  ComposerNoticePanelBody,
  QueueClearAllAction,
  QueuePanel,
} from "./composer-panels";

describe("composer panel bodies", () => {
  it("queue panel renders steer + follow-up rows and dispatches per-row dismiss", () => {
    const onDismiss = vi.fn();
    render(
      <QueuePanel
        queued={[
          { id: "q1", content: "steer this", mode: "steer", sentAt: 1 },
          { id: "q2", content: "follow later", mode: "followUp", sentAt: 2 },
        ]}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("steer this")).toBeInTheDocument();
    expect(screen.getByText("follow later")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Hide from queue display" })[0]);
    expect(onDismiss).toHaveBeenCalledWith("q1");
  });

  it("queue clear-all action button calls onClearAll", () => {
    const onClearAll = vi.fn();
    render(<QueueClearAllAction onClearAll={onClearAll} />);
    fireEvent.click(screen.getByRole("button", { name: /Clear all/ }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("blocked-command body renders the title/message and dispatches copy", () => {
    const onCopyCommand = vi.fn();
    render(
      <BlockedCommandPanelBody
        action={{
          requestId: "r1",
          command: "rm -rf dist",
          title: "Explore blocked shell",
          message: "Switch to Code to run shell commands.",
          mode: "explore",
        }}
        onCopyCommand={onCopyCommand}
      />,
    );
    expect(screen.getByText("Explore blocked shell")).toBeInTheDocument();
    expect(screen.getByText(/Switch to Code/)).toBeInTheDocument();
    expect(screen.getByText("! rm -rf dist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copy command/i }));
    expect(onCopyCommand).toHaveBeenCalledTimes(1);
  });

  it("notice body renders reusable product guidance", () => {
    render(
      <ComposerNoticePanelBody kind="tip">
        That command worked here. Switch to Spec mode for the action rail.
      </ComposerNoticePanelBody>,
    );
    expect(screen.getByText("Tip")).toBeInTheDocument();
    expect(screen.getByText(/That command worked here/)).toBeInTheDocument();
  });

  it("notice body supports alert styling copy without custom panel chrome", () => {
    render(
      <ComposerNoticePanelBody kind="alert">
        Attachment support is unavailable in this build.
      </ComposerNoticePanelBody>,
    );
    expect(screen.getByText("Alert")).toBeInTheDocument();
    expect(screen.getByText(/Attachment support is unavailable/)).toBeInTheDocument();
  });
});
