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

import { type ActiveDocCtx, EMPTY_DOC_CTX } from "../../lib/doc-actions";
import {
  AfxCommandSuggestPanelBody,
  BlockedCommandPanelBody,
  ModeSuggestPanelBody,
  ModeSuggestPanelTitle,
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

  it("mode-suggest title is empty when no doc kind is active", () => {
    const { container } = render(<ModeSuggestPanelTitle docContext={EMPTY_DOC_CTX} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mode-suggest body renders explanation copy", () => {
    render(<ModeSuggestPanelBody docContext={EMPTY_DOC_CTX} />);
    expect(screen.getByText(/Switching unlocks targeted actions/)).toBeInTheDocument();
  });

  it("mode-suggest body does not expose editor-menu implementation hints", () => {
    const docContext: ActiveDocCtx = {
      ...EMPTY_DOC_CTX,
      format: "sprint",
      section: "SPEC",
      docKind: "spec",
      feature: "postgresql-marketplace-backend-rewrite",
      filePath: "/repo/docs/specs/postgresql-marketplace-backend-rewrite.md",
      approvalStatus: "Draft",
    };

    render(<ModeSuggestPanelBody docContext={docContext} />);

    expect(screen.getByText("Refine")).toBeInTheDocument();
    expect(screen.queryByText(/editor menu/i)).not.toBeInTheDocument();
  });

  it("afx-command-suggest body renders the explanatory copy", () => {
    render(<AfxCommandSuggestPanelBody />);
    expect(screen.getByText(/That command worked here/)).toBeInTheDocument();
  });
});
