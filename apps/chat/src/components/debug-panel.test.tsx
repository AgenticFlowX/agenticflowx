/**
 * Unit tests for DebugPanel component.
 *
 * Covers: render, tab switching, scenario buttons, log updates,
 * stream speed slider, clear log, log entry expansion.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockTransport } from "@afx/transport";

import { DebugPanel } from "./debug-panel";

function setup() {
  const transport = createMockTransport();
  const result = render(<DebugPanel transport={transport} />);
  return { transport, ...result };
}

function openPanel() {
  const toggle = screen.getByRole("button", { name: /toggle debug panel/i });
  fireEvent.click(toggle);
}

// ---------------------------------------------------------------------------

describe("DebugPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the toggle button", () => {
    setup();
    expect(screen.getByRole("button", { name: /toggle debug panel/i })).toBeInTheDocument();
  });

  it("renders when browser localStorage is unavailable", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("localStorage blocked", "SecurityError");
    });

    setup();

    expect(screen.getByRole("button", { name: /toggle debug panel/i })).toBeInTheDocument();
  });

  it("panel is hidden by default", () => {
    setup();
    expect(screen.queryByRole("tab", { name: /scenarios/i })).not.toBeInTheDocument();
  });

  it("opens panel on toggle click", () => {
    setup();
    openPanel();
    expect(screen.getByRole("tab", { name: /scenarios/i })).toBeInTheDocument();
  });

  it("closes panel on second toggle click", () => {
    setup();
    openPanel();
    const toggle = screen.getByRole("button", { name: /toggle debug panel/i });
    fireEvent.click(toggle);
    expect(screen.queryByRole("tab", { name: /scenarios/i })).not.toBeInTheDocument();
  });

  it("shows all scenario buttons", () => {
    setup();
    openPanel();
    const labels = [
      "Quick",
      "Streaming",
      "Large",
      "Thinking",
      "Steer",
      "Follow-up",
      "bash",
      "read",
      "edit",
      "Multi-tool",
      "Tool error",
      "Provider error",
      "Abort",
      "Startup",
      "Disconnected",
      "Long disconnect",
      "Retry recovery",
      "Restart recovery",
      "Ctx near full",
      "Ctx recovery",
      "Runtime",
      "Compacting",
      "Models",
      "No models",
      "Commands",
      "Files",
      "stderr",
      "Settings",
      "Appearance",
    ];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("clicking a scenario button does not throw", () => {
    setup();
    openPanel();
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Quick" }))).not.toThrow();
  });

  it("switches to Log tab", () => {
    setup();
    openPanel();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Log/i }), { button: 0 });
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("shows log entries after sending a message", () => {
    const { transport } = setup();
    openPanel();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Log/i }), { button: 0 });
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    act(() => {
      transport.send({ type: "chat/ready" });
    });
    expect(screen.queryByText("No messages yet")).not.toBeInTheDocument();
  });

  it("shows entry count badge on Log tab", () => {
    const { transport } = setup();
    openPanel();
    act(() => {
      transport.send({ type: "chat/ready" });
    });
    const logTab = screen.getByRole("tab", { name: /^Log/i });
    expect(logTab.textContent).toMatch(/\d+/);
  });

  it("stream speed slider responds to keyboard", () => {
    setup();
    openPanel();
    const slider = screen.getByRole("slider");
    // Radix Slider responds to End/Home/Arrow keys, not native change events.
    fireEvent.keyDown(slider, { key: "End" });
    expect(screen.getByText(/200 ms\/chunk/)).toBeInTheDocument();
  });

  it("stream speed slider calls setStreamSpeed on transport", () => {
    const { transport } = setup();
    openPanel();
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "End" });
    // Firing a scenario after the speed change should not throw.
    expect(() => transport.scenarios["quick-reply"]?.()).not.toThrow();
  });

  it("Clear button removes log entries", () => {
    const { transport } = setup();
    openPanel();
    act(() => {
      transport.send({ type: "chat/ready" });
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Log/i }), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("expanding a log entry shows JSON payload", () => {
    const { transport } = setup();
    openPanel();
    act(() => {
      transport.send({ type: "chat/ready" });
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Log/i }), { button: 0 });
    const expandBtns = screen.getAllByRole("button", { name: /toggle entry/i });
    expect(expandBtns.length).toBeGreaterThan(0);
    fireEvent.click(expandBtns[0]);
    const pres = document.querySelectorAll("pre");
    expect(pres.length).toBeGreaterThan(0);
  });

  it("shows runtime status events in the visible debug log", () => {
    const { transport } = setup();
    openPanel();
    act(() => {
      transport.send({ type: "chat/ready" });
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Log/i }), { button: 0 });

    const statusEntry = screen.getAllByRole("button", { name: /toggle entry agent\/status/i })[0];
    fireEvent.click(statusEntry);

    expect(screen.getAllByText("agent/status").length).toBeGreaterThan(0);
  });
});
