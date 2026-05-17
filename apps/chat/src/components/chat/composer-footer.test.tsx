/**
 * ComposerFooter tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComposerFooter } from "./composer-footer";

describe("ComposerFooter", () => {
  it("renders usage stats and idle keyboard hints", () => {
    render(
      <ComposerFooter
        hintId="composer-hint"
        usage={{
          tokens: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0, total: 1500 },
          cost: 0.01,
          contextUsage: { tokens: 1500, contextWindow: 10000, percent: 15 },
        }}
        isCheckingAgent={false}
        runtimeUnavailable={false}
        runtimeUnconfigured={false}
        isStreaming={false}
        rpcEnabled={false}
        agentPhase="ready"
        workspaceMode="code"
      />,
    );

    expect(screen.getByText(/1.5k tokens/)).toBeInTheDocument();
    expect(screen.getByText(/ctx 15%/)).toBeInTheDocument();
    expect(screen.getByText(/idle: ⏎ send/)).toHaveAttribute("id", "composer-hint");
  });

  it("renders clickable Pi warning when runtime is disconnected", () => {
    const onPiWarningClick = vi.fn();

    render(
      <ComposerFooter
        usage={null}
        isCheckingAgent={false}
        runtimeUnavailable
        runtimeUnconfigured={false}
        isStreaming={false}
        rpcEnabled
        agentPhase="disconnected"
        onPiWarningClick={onPiWarningClick}
        workspaceMode="code"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Pi runtime not reachable/i }));
    expect(onPiWarningClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Connection recovery is required before sending.")).toBeInTheDocument();
  });
});
