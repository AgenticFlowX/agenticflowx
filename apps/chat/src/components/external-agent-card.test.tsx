/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-TEST]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExternalAgentCard } from "./external-agent-card";

describe("ExternalAgentCard", () => {
  it("renders Pi CLI status and detects the binary", () => {
    const onDetectBinary = vi.fn(async () => {});
    render(
      <ExternalAgentCard
        id="pi"
        name="Pi CLI"
        status="connected"
        modelCount={3}
        binaryPath="/usr/local/bin/pi"
        onDetectBinary={onDetectBinary}
      />,
    );

    expect(screen.getByText(/3 models/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /detect/i }));
    expect(onDetectBinary).toHaveBeenCalledOnce();
  });

  it("toggles ephemeral sessions", () => {
    const onToggleEphemeral = vi.fn();
    render(
      <ExternalAgentCard
        id="pi"
        name="Pi CLI"
        status="unavailable"
        modelCount={0}
        ephemeral={false}
        onToggleEphemeral={onToggleEphemeral}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /ephemeral sessions/i }));
    expect(onToggleEphemeral).toHaveBeenCalledWith(true);
  });

  it("toggles Pi RPC opt-in state", () => {
    const onToggleEnabled = vi.fn();
    render(
      <ExternalAgentCard
        id="pi"
        name="Pi CLI"
        status="disabled"
        modelCount={0}
        enabled={false}
        onToggleEnabled={onToggleEnabled}
      />,
    );

    expect(screen.getByText(/rpc disabled/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: /enable pi rpc/i }));
    expect(onToggleEnabled).toHaveBeenCalledWith(true);
  });

  it("renders coming-soon entries as disabled cards", () => {
    render(
      <ExternalAgentCard
        id="future"
        name="More local agents"
        status="coming-soon"
        modelCount={0}
      />,
    );

    expect(screen.getByText(/opencode, crush, and aider/i)).toBeInTheDocument();
    expect(screen.getByText(/soon/i)).toBeInTheDocument();
  });
});
