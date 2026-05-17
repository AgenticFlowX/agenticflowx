/**
 * ComposerActivityBar tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES]
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComposerActivityBar } from "./composer-activity-bar";

describe("ComposerActivityBar", () => {
  it("renders idle, streaming thinking preview, and shell states", () => {
    const { rerender } = render(
      <ComposerActivityBar thinking={null} isStreaming={false} isSystemCommand={false} />,
    );
    expect(screen.getByText("idle")).toBeInTheDocument();

    rerender(
      <ComposerActivityBar
        thinking="Reading the repo and checking component boundaries"
        isStreaming
        isSystemCommand={false}
      />,
    );
    expect(screen.getByText("thinking")).toBeInTheDocument();
    expect(screen.getByText(/checking component boundaries/)).toBeInTheDocument();

    rerender(<ComposerActivityBar thinking={null} isStreaming={false} isSystemCommand />);
    expect(screen.getByText("Shell")).toBeInTheDocument();
    expect(screen.getByText("local execution")).toBeInTheDocument();
  });
});
