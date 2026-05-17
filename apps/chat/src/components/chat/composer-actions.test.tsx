/**
 * ComposerActions tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComposerActions } from "./composer-actions";

function renderActions(overrides: Partial<Parameters<typeof ComposerActions>[0]> = {}) {
  const props = {
    disabled: false,
    isStreaming: false,
    canSend: true,
    onMemorySelect: vi.fn(),
    onSend: vi.fn(),
    onQueueFollowUp: vi.fn(),
    onSteer: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  };
  render(<ComposerActions {...props} />);
  return props;
}

describe("ComposerActions", () => {
  it("renders idle send state and dispatches send", () => {
    const props = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it("renders streaming follow-up, steer, and stop actions", () => {
    const props = renderActions({ isStreaming: true, canSend: true });

    fireEvent.click(screen.getByRole("button", { name: "Queue follow-up" }));
    fireEvent.click(screen.getByRole("button", { name: "Steer turn" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(props.onQueueFollowUp).toHaveBeenCalledTimes(1);
    expect(props.onSteer).toHaveBeenCalledTimes(1);
    expect(props.onStop).toHaveBeenCalledTimes(1);
  });

  it("disables idle send when the composer cannot send", () => {
    renderActions({ canSend: false });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
