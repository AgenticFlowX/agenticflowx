import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AgentModel, AgentToChat } from "@afx/shared";
import { createMockTransport } from "@afx/transport";
import type { Transport } from "@afx/transport";

import App from "./app";
import { initTransport } from "./lib/bridge";

function renderApp() {
  const transport = createMockTransport();
  initTransport(transport);
  return render(<App transport={transport} />);
}

function createControlledTransport(): Transport & {
  emit(msg: AgentToChat): void;
  state: unknown;
} {
  const listeners = new Map<AgentToChat["type"], Set<(msg: AgentToChat) => void>>();
  let state: unknown;

  return {
    send: vi.fn(),
    on(type, handler) {
      const existing = listeners.get(type) ?? new Set<(msg: AgentToChat) => void>();
      const wrapped = handler as (msg: AgentToChat) => void;
      existing.add(wrapped);
      listeners.set(type, existing);
      return () => {
        existing.delete(wrapped);
      };
    },
    dispose: vi.fn(),
    getState() {
      return state;
    },
    setState(nextState) {
      state = nextState;
    },
    emit(msg) {
      listeners.get(msg.type)?.forEach((handler) => handler(msg));
    },
    get state() {
      return state;
    },
  };
}

type ChatStateMessage = Extract<AgentToChat, { type: "chat/state" }>;

function emitChatState(
  transport: ReturnType<typeof createControlledTransport>,
  overrides: Partial<Pick<ChatStateMessage, "isStreaming" | "messages" | "tools">> = {},
): void {
  transport.emit({
    type: "chat/state",
    isStreaming: overrides.isStreaming ?? false,
    messages: overrides.messages ?? [],
    tools: overrides.tools ?? [],
  });
}

describe("chat App", () => {
  it("renders all three tab triggers", () => {
    renderApp();
    for (const label of ["Chat", "History", "Settings"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("tab", { name: "Explorer" })).not.toBeInTheDocument();
  });

  it("defaults to the Chat tab", () => {
    renderApp();
    const chatTab = screen.getByRole("tab", { name: "Chat" });
    expect(chatTab).toHaveAttribute("aria-selected", "true");
  });

  /**
   * @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-3] [FR-5]
   * @see docs/specs/213-app-chat-history/design.md [DES-TEST]
   */
  it("keeps Chat, History, and Settings reachable at VS Code sidebar collapse width", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 205, configurable: true });

    try {
      const transport = createControlledTransport();
      const user = userEvent.setup();
      initTransport(transport);
      render(<App transport={transport} />);

      act(() => {
        transport.emit({
          type: "agent/status",
          status: {
            phase: "ready",
            running: true,
            isStreaming: false,
            checkedAt: 1,
            consecutiveFailures: 0,
          },
        });
      });
      act(() => {
        emitChatState(transport);
      });

      for (const label of ["Chat", "History", "Settings"]) {
        expect(screen.getByRole("tab", { name: label })).toHaveClass("min-w-0", "flex-1");
      }
      expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "/afx-scaffold" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Switch model" })).toHaveClass("min-w-0");
      expect(screen.getByText("Select model")).toHaveClass("hidden", "@[260px]:inline");

      await user.click(screen.getByRole("tab", { name: "History" }));
      expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh history" })).toBeEnabled();
      expect(screen.getByPlaceholderText("Search work log…")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Settings" }));
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Runtime" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "API Providers" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "External Agents" })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });

  it("closes the model menu before navigating to Settings", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
          model: {
            provider: "openai",
            id: "gpt-5.4",
            name: "GPT-5.4",
            source: "api-provider",
            instanceId: "pi-sdk",
            instanceLabel: "API Providers",
          },
        },
      });
      transport.emit({
        type: "agent/models",
        requestId: "models",
        models: [
          {
            provider: "openai",
            id: "gpt-5.4",
            name: "GPT-5.4",
            source: "api-provider",
            instanceId: "pi-sdk",
            instanceLabel: "API Providers",
            reasoning: true,
            contextWindow: 0,
            maxTokens: 0,
          },
        ],
      });
    });

    await waitFor(() => expect(screen.getByText("Openai · GPT-5.4")).toBeInTheDocument());
    screen.getByRole("combobox", { name: "Switch model" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Manage providers and agents…" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Manage providers and agents…" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.queryByRole("button", { name: "Manage providers and agents…" })).toBeNull();
  }, 10_000);

  it("restores an unsent draft after the sidebar webview remounts", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    const firstRender = render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });

    await user.type(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
      "keep me",
    );
    expect(transport.state).toEqual(expect.objectContaining({ draft: "keep me" }));

    firstRender.unmount();
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 2,
          consecutiveFailures: 0,
        },
      });
    });

    expect(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
    ).toHaveValue("keep me");
  });

  /**
   * @see docs/specs/213-app-chat-history/spec.md [FR-6]
   * @see docs/specs/213-app-chat-history/design.md [DES-TEST]
   */
  it("shows readiness affordances across Chat, History, and Settings until the agent responds", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    expect(screen.getByText("Connecting to agent…")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Waiting for the agent runtime to be ready…"),
    ).toBeDisabled();

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "starting",
          running: false,
          isStreaming: false,
          info: "Agent runtime is starting",
          checkedAt: 1,
          consecutiveFailures: 1,
        },
      });
    });
    expect(screen.getByText("Connecting to agent…")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText("Connecting to agent…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View buffered stderr" })).toBeEnabled();
    expect(screen.getByText("Runtime recovery controls")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "History" }));
    // The History view always renders an "History" heading; the subtitle
    // ("Active session work log") only appears once a session is reported.
    expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh history" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Work log loads when the runtime is ready…")).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: "Chat" }));
    expect(screen.getByText("Connecting to agent…")).toBeInTheDocument();
    expect(screen.queryByText("Agent runtime is starting")).not.toBeInTheDocument();

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 2,
          lastReadyAt: 2,
          consecutiveFailures: 0,
        },
      });
    });
    act(() => {
      emitChatState(transport);
    });

    expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
    ).toBeEnabled();

    // Tab switch should not flash the empty state — thread content is preserved.
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await user.click(screen.getByRole("tab", { name: "Chat" }));
    expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
  });

  it("rehydrates the previous transcript immediately after remount", async () => {
    const transport = createControlledTransport();
    initTransport(transport);
    const firstRender = render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 2,
          consecutiveFailures: 0,
        },
      });
    });
    act(() => {
      emitChatState(transport, {
        messages: [
          { id: "past-user", role: "user", content: "Past session question", createdAt: 1 },
          { id: "past-assistant", role: "assistant", content: "Past session answer", createdAt: 2 },
        ],
      });
    });

    await waitFor(() =>
      expect(transport.state).toEqual(
        expect.objectContaining({
          chatView: expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({ content: "Past session question" }),
              expect.objectContaining({ content: "Past session answer" }),
            ]),
          }),
        }),
      ),
    );

    firstRender.unmount();
    render(<App transport={transport} />);

    expect(screen.getAllByText("Past session question").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Past session answer").length).toBeGreaterThan(0);
    expect(screen.queryByText("Loading workspace state")).not.toBeInTheDocument();
    expect(screen.queryByText("Connecting to agent…")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready when you are.")).not.toBeInTheDocument();

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 3,
          consecutiveFailures: 0,
        },
      });
    });
    act(() => {
      emitChatState(transport, {
        messages: [
          { id: "past-user", role: "user", content: "Past session question", createdAt: 1 },
          { id: "past-assistant", role: "assistant", content: "Past session answer", createdAt: 2 },
        ],
      });
    });

    expect(screen.getAllByText("Past session question").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Past session answer").length).toBeGreaterThan(0);
  });

  it("keeps Settings runtime debug controls visible for Pi/API troubleshooting", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "starting",
          running: false,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 1,
        },
      });
    });

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText("Runtime recovery controls")).toBeInTheDocument();

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();

    await user.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "agent/checkStatus" }));

    await user.click(screen.getByRole("button", { name: "Restart" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "agent/restart" }));

    await user.click(screen.getByRole("button", { name: "View logs" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "chat/getStderr" }));
    expect(screen.getByText("Runtime stderr")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "agent/reload" }));
  });

  /**
   * @see docs/specs/213-app-chat-history/spec.md [FR-6]
   * @see docs/specs/213-app-chat-history/design.md [DES-TEST]
   */
  it("keeps the chat empty state on disconnect; recovery lives in History/Settings", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "disconnected",
          running: false,
          isStreaming: false,
          info: "Agent runtime did not become ready after multiple checks.",
          checkedAt: 1,
          consecutiveFailures: 3,
        },
      });
    });
    act(() => {
      emitChatState(transport);
    });

    // Chat keeps its quick-commands empty state — no takeover card.
    // Runtime issues surface via the Pi pill in FooterStrip (when rpc.enabled=true)
    // and via the AgentRecoveryCard in History/Settings.
    expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to AFX")).not.toBeInTheDocument();

    // Recovery affordance still reachable via History/Settings (forceMount-ed tabs).
    const retryButtons = screen.getAllByRole("button", { name: /retry connection/i });
    expect(retryButtons[0]).toBeEnabled();

    await user.click(retryButtons[0]);
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "agent/checkStatus" }),
    );
  });

  it("shows setup UI instead of connection recovery when no runtime is configured", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "disconnected",
          running: false,
          isStreaming: false,
          info: "No agent runtime configured",
          rpcEnabled: false,
          runtimeConfigured: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });
    act(() => {
      emitChatState(transport);
    });

    expect(screen.getByText("Connect a model to start.")).toBeInTheDocument();
    expect(screen.getByText("No active runtime")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Configure an API provider or enable Pi RPC to continue…"),
    ).toBeDisabled();
    expect(screen.queryByText("Connection recovery is required before sending.")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry connection/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No active runtime configured")).toBeInTheDocument();
  });

  it("shows Pi RPC recovery controls when Pi RPC is enabled but missing", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "disconnected",
          running: false,
          isStreaming: false,
          info: "Pi RPC runtime not found",
          rpcEnabled: true,
          runtimeConfigured: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });
    act(() => {
      emitChatState(transport);
    });

    await user.click(screen.getByRole("button", { name: "Open Settings" }));

    expect(screen.getByText("Pi RPC recovery controls")).toBeInTheDocument();
    expect(screen.getByText(/Visible while Pi RPC is enabled/)).toBeInTheDocument();

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();

    await user.click(screen.getAllByRole("button", { name: "Reconnect" })[0]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "agent/checkStatus" }));

    await user.click(screen.getAllByRole("button", { name: "View logs" })[0]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "chat/getStderr" }));
  });

  it("groups SDK and Pi RPC settings with clear help text", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "settings",
        snapshot: {
          appearance: {
            theme: "meridian",
            style: "lyra",
            themes: [
              {
                id: "meridian",
                label: "AFX / Meridian",
                implemented: true,
                description: "AFX identity and brass accents over VS Code host surfaces.",
              },
            ],
            styles: [
              {
                id: "lyra",
                label: "Lyra",
                implemented: true,
                description: "Compact, boxy shadcn treatment.",
              },
            ],
          },
          engine: {
            rpcEnabled: false,
            agentBinary: "pi",
            bundledSkillsPath: "resources/skills/agenticflowx",
            bundledSkillCount: 17,
            ephemeral: false,
          },
          sdk: {
            enabled: true,
            defaultModel: "openai:gpt-5.4",
            ollamaBaseUrl: "",
            sessionDir: "extension-managed storage",
          },
          providers: [],
          externalAgents: [
            {
              id: "pi",
              name: "Pi CLI",
              status: "disabled",
              modelCount: 0,
              binaryPath: "pi",
              enabled: false,
              ephemeral: false,
            },
          ],
          diagnostics: { logLevel: "info" },
          telemetry: {
            enabled: true,
            vscodeTelemetryEnabled: true,
            effectiveEnabled: true,
          },
          about: {
            extensionVersion: "2.0.0",
            bundledPiNpmVersion: "@mariozechner/pi-coding-agent@0.70.2",
          },
        },
      });
    });

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByText("Runtime Setup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /paste api key/i })).toBeInTheDocument();
    expect(screen.getByText("Advanced paths and defaults")).toBeInTheDocument();
    const piRpcSwitch = screen.getByRole("switch", { name: "Enable Pi RPC" });
    expect(piRpcSwitch).not.toBeChecked();
    fireEvent.click(piRpcSwitch);
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "external/setRpcEnabled",
        enabled: true,
      }),
    );
    expect(screen.getAllByText("API Provider SDK").length).toBeGreaterThan(0);
    expect(screen.getByText(/Uses the bundled Pi SDK bootstrap/)).toBeInTheDocument();
    expect(
      screen.getByText(/Launches a local Pi CLI subprocess in --mode rpc/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Both runtime paths receive the bundled AFX skill pack/),
    ).toBeInTheDocument();
    expect(screen.getByText("SDK runtime")).toBeInTheDocument();
    expect(screen.getByText("Default model")).toBeInTheDocument();
    expect(screen.getByText("Bundled Pi npm")).toBeInTheDocument();
    expect(screen.getByText("@mariozechner/pi-coding-agent@0.70.2")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Anonymous UI analytics" })).toBeChecked();

    fireEvent.click(screen.getByRole("switch", { name: "Anonymous UI analytics" }));
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "telemetry/setEnabled",
        enabled: false,
      }),
    );

    await user.click(screen.getByRole("tab", { name: "External Agents" }));
    expect(screen.getByText(/Starts Pi with --mode rpc/)).toBeInTheDocument();
  });

  it("keeps the composer footer visible when usage stats appear", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });

    expect(
      screen
        .getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note")
        .closest(".afx-surface-composer"),
    ).toBeInTheDocument();
    expect(screen.getByText("⌘⇧⏎ note · ⏎ send · ↑ history")).toBeInTheDocument();
    expect(screen.queryByText(/AFX may make mistakes/)).not.toBeInTheDocument();

    act(() => {
      transport.emit({
        type: "chat/usage",
        tokens: { input: 1_000, output: 2_500, cacheRead: 0, cacheWrite: 0, total: 3_500 },
        cost: 0.0012,
        contextUsage: { tokens: 3_500, contextWindow: 200_000, percent: 2 },
      });
    });

    expect(screen.getByText("3.5k tokens · ctx 2% · $0.0012")).toBeInTheDocument();
    expect(screen.getByText("⌘⇧⏎ note · ⏎ send · ↑ history")).toBeInTheDocument();
  });

  it("shows tool arguments immediately while a file tool is running", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "busy",
          running: true,
          isStreaming: true,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
      transport.emit({
        type: "chat/messageStart",
        id: "assistant-1",
        role: "assistant",
        createdAt: 1,
      });
      transport.emit({
        type: "chat/toolStart",
        toolCallId: "tool-1",
        toolName: "read_file",
        args: { path: "packages/shared/src/messages.ts" },
      });
    });

    // Tool action is rendered as a compact eyebrow ("read"); the path is the
    // header target text.
    expect(screen.getByText("read")).toBeInTheDocument();
    expect(screen.getByText("packages/shared/src/messages.ts")).toBeInTheDocument();
  });

  it("renders model switch transcript rows as info events", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
      transport.emit({
        type: "chat/messageStart",
        id: "model-switch",
        role: "assistant",
        createdAt: 1,
        content: "ℹ Switched to Cerebras — Llama 4 Scout (llama-4-scout). Runtime: API provider.",
      });
      transport.emit({ type: "chat/messageEnd", id: "model-switch", stopReason: "info" });
    });

    expect(
      screen
        .getAllByText(/Switched to Cerebras/)
        .some((node) => node.className.includes("font-mono") && node.className.includes("italic")),
    ).toBe(true);
  });

  it("shows animated thinking affordance for non-reasoning API-provider models", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "busy",
          running: true,
          isStreaming: true,
          checkedAt: 1,
          consecutiveFailures: 0,
          model: {
            provider: "cerebras",
            id: "llama-4-scout",
            name: "Llama 4 Scout",
            source: "api-provider",
            instanceId: "pi-sdk",
            instanceLabel: "API Providers",
          },
        },
      });
      transport.emit({
        type: "agent/models",
        requestId: "models",
        models: [
          {
            provider: "cerebras",
            id: "llama-4-scout",
            name: "Llama 4 Scout",
            source: "api-provider",
            instanceId: "pi-sdk",
            instanceLabel: "API Providers",
            reasoning: false,
            contextWindow: 0,
            maxTokens: 0,
          },
        ],
      });
    });

    expect(screen.getByRole("button", { name: "Thinking level" })).toBeEnabled();
    expect(screen.getByText("thinking")).toBeInTheDocument();
    expect(screen.queryByText("reasoning unavailable for this model")).not.toBeInTheDocument();
  });

  it("shows thinking controls for reasoning API-provider models", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
          model: {
            provider: "anthropic",
            id: "claude-opus-4-7",
            name: "Claude Opus 4.7",
            source: "api-provider",
            instanceId: "pi-sdk",
            instanceLabel: "API Providers",
            reasoning: true,
          },
        },
      });
      transport.emit({
        type: "agent/models",
        requestId: "models",
        models: [
          {
            provider: "anthropic",
            id: "claude-opus-4-7",
            name: "Claude Opus 4.7",
            source: "api-provider",
            instanceId: "pi-sdk",
            instanceLabel: "API Providers",
            reasoning: true,
            contextWindow: 0,
            maxTokens: 0,
          },
        ],
      });
    });

    expect(screen.getByRole("button", { name: "Thinking level" })).toBeEnabled();
  });

  it("recalls sent prompts with arrow keys", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });

    const input = screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note");
    await user.type(input, "first prompt");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.type(input, "second prompt");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(input).toHaveValue("second prompt"));
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(input).toHaveValue("first prompt"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(input).toHaveValue("second prompt"));
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("keeps prompt history available after model switches", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);
    const piModel: AgentModel = {
      provider: "pi",
      id: "default",
      name: "Pi RPC",
      source: "external-agent",
      instanceId: "pi",
      instanceLabel: "Pi RPC",
      reasoning: true,
      contextWindow: 0,
      maxTokens: 0,
    };
    const sdkModel: AgentModel = {
      provider: "cerebras",
      id: "llama-4-scout",
      name: "Llama 4 Scout",
      source: "api-provider",
      instanceId: "pi-sdk",
      instanceLabel: "API Providers",
      reasoning: false,
      contextWindow: 0,
      maxTokens: 0,
    };

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: false,
          checkedAt: 1,
          consecutiveFailures: 0,
          model: piModel,
        },
      });
      transport.emit({ type: "agent/models", requestId: "models", models: [piModel, sdkModel] });
    });

    const input = screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note");
    await user.type(input, "prompt before switch");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/send", content: "prompt before switch" }),
    );

    act(() => {
      transport.emit({ type: "agent/modelChanged", requestId: "switch", model: sdkModel });
      transport.emit({ type: "chat/state", isStreaming: false, messages: [], tools: [] });
    });

    input.focus();
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(input).toHaveValue("prompt before switch"));
  });

  /**
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-2]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MOCKUP-THINKING] [DES-MESSAGES-COMPONENT-TIMELINE]
   */
  it("keeps thinking in the composer activity strip and suppresses blank timeline placeholders", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    const now = Date.now();
    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "busy",
          running: true,
          isStreaming: true,
          checkedAt: now,
          consecutiveFailures: 0,
        },
      });
      transport.emit({
        type: "chat/state",
        isStreaming: true,
        tools: [],
        messages: [
          { id: "u-blank", role: "user", content: "debug blank rows", createdAt: now },
          { id: "a-empty-1", role: "assistant", content: "", createdAt: now + 1, streaming: false },
          { id: "a-empty-2", role: "assistant", content: "", createdAt: now + 2, streaming: false },
          { id: "a-live", role: "assistant", content: "", createdAt: now + 3, streaming: true },
        ],
      });
      transport.emit({
        type: "chat/thinkingDelta",
        id: "a-live",
        delta:
          "Reading the message timeline code and checking why empty assistant placeholders are visible in the transcript.",
      });
    });

    expect(screen.queryByText("Working")).not.toBeInTheDocument();
    expect(screen.queryAllByText("AFX")).toHaveLength(0);
    expect(screen.getByText("thinking")).toBeInTheDocument();
    expect(screen.getByText(/empty assistant placeholders are visible/i)).toBeInTheDocument();
  });

  it("exposes separate Queue and Steer buttons while streaming", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "busy",
          running: true,
          isStreaming: true,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });

    const input = screen.getByPlaceholderText("Queue a follow-up… (⌘⏎ to steer this turn)");
    await user.type(input, "do this next");
    await user.click(screen.getByRole("button", { name: "Queue follow-up" }));
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/followUp", content: "do this next" }),
    );

    await user.type(input, "nudge now");
    await user.click(screen.getByRole("button", { name: "Steer turn" }));
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/steer", content: "nudge now" }),
    );
  });

  /**
   * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE]
   */
  it("labels queued steer and follow-up rows and clears them when the runtime queue drains", async () => {
    const transport = createControlledTransport();
    const user = userEvent.setup();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "agent/status",
        status: {
          phase: "busy",
          running: true,
          isStreaming: true,
          checkedAt: 1,
          consecutiveFailures: 0,
        },
      });
    });

    const input = screen.getByPlaceholderText("Queue a follow-up… (⌘⏎ to steer this turn)");
    await user.type(input, "tighten now");
    await user.click(screen.getByRole("button", { name: "Steer turn" }));
    await user.type(input, "then verify");
    await user.click(screen.getByRole("button", { name: "Queue follow-up" }));

    expect(screen.getByText("Steer")).toBeInTheDocument();
    expect(screen.getByText("Follow-up")).toBeInTheDocument();
    expect(screen.getByText("tighten now")).toBeInTheDocument();
    expect(screen.getByText("then verify")).toBeInTheDocument();

    act(() => {
      transport.emit({
        type: "agent/runtimeSettings",
        settings: { pendingMessageCount: 0 },
      });
    });

    await waitFor(() => expect(screen.queryByText("tighten now")).not.toBeInTheDocument());
    expect(screen.queryByText("then verify")).not.toBeInTheDocument();
  });
});
