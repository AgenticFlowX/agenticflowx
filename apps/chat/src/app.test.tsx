import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  ActiveFileContextSnapshot,
  AgentModel,
  AgentToChat,
  SettingsSnapshot,
  WorkspaceMode,
} from "@afx/shared";
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
  activeFileContext: ActiveFileContextSnapshot | null = null,
  mode: WorkspaceMode = "code",
  snapshotOverrides: Partial<SettingsSnapshot> = {},
): void {
  transport.emit({
    type: "chat/state",
    isStreaming: overrides.isStreaming ?? false,
    messages: overrides.messages ?? [],
    tools: overrides.tools ?? [],
  });
  transport.emit({
    type: "agent/activeFileContext",
    snapshot: activeFileContext,
  });
  // Mirror the real host flow: chat/state is followed by agent/settingsSnapshot.
  // Without this, the welcome card stays in WelcomeShell (loading state) and
  // EmptyState/SpecModeWelcome never render.
  // @see docs/specs/212-app-chat-messages/spec.md [FR-8]
  const baseSnapshot = createSettingsSnapshot(mode);
  transport.emit({
    type: "agent/settingsSnapshot",
    requestId: "test-snapshot",
    snapshot: {
      ...baseSnapshot,
      ...snapshotOverrides,
      engine: { ...baseSnapshot.engine, ...(snapshotOverrides.engine ?? {}) },
    },
  });
}

function createSettingsSnapshot(mode: WorkspaceMode = "code"): SettingsSnapshot {
  return {
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
    context: {
      includeActiveFileContext: true,
    },
    mode: {
      active: mode,
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
  };
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
            model: {
              provider: "openai",
              id: "gpt-5.4",
              name: "GPT-5.4",
              reasoning: true,
              source: "api-provider",
              instanceId: "pi-sdk",
            },
          },
        });
      });
      act(() => {
        emitChatState(
          transport,
          {},
          { name: "journal.md", path: "/workspace/src/notes/journal.md" },
        );
        transport.emit({
          type: "agent/settingsSnapshot",
          requestId: "settings",
          snapshot: createSettingsSnapshot(),
        });
      });

      for (const label of ["Chat", "History", "Settings"]) {
        expect(screen.getByRole("tab", { name: label })).toHaveClass("min-w-0", "flex-1");
      }
      expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "/afx-scaffold" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "GPT-5.4 - Medium" })).toHaveClass("min-w-0");
      expect(screen.getByRole("button", { name: "GPT-5.4 - Medium" })).toHaveTextContent(
        "GPT-5.4 - Medium",
      );
      expect(screen.getByRole("button", { name: "Mention file" })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "journal.md" })).toBeChecked();
      expect(screen.getByText("journal.md")).toHaveClass("hidden", "@[260px]:inline");
      expect(screen.getByText("|")).toBeInTheDocument();

      await user.hover(screen.getByRole("button", { name: "Mention file" }));
      const mentionTooltip = await waitFor(() => {
        const tooltip = document.querySelector('[data-slot="tooltip-content"]');
        expect(tooltip).not.toBeNull();
        return tooltip as HTMLElement;
      });
      expect(mentionTooltip).toHaveTextContent(/mention a file in the workspace/i);
      expect(mentionTooltip).toHaveTextContent(/current editor file/i);

      const send = transport.send as ReturnType<typeof vi.fn>;
      send.mockClear();
      await user.click(screen.getByRole("switch", { name: "journal.md" }));
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chat/setIncludeActiveFileContext",
          enabled: false,
        }),
      );

      const fileContextTrigger = screen.getByRole("switch", { name: "journal.md" });
      await user.unhover(fileContextTrigger);
      await user.hover(fileContextTrigger);
      const fileContextTooltip = await waitFor(() => {
        const tooltip = document.querySelector('[data-slot="tooltip-content"]');
        expect(tooltip).not.toBeNull();
        return tooltip as HTMLElement;
      });
      expect(fileContextTooltip).toHaveTextContent(/file context off/i);
      expect(fileContextTooltip).toHaveTextContent(
        /turn this on when you want the next turn to use the current editor file as context\./i,
      );

      await user.click(screen.getByRole("tab", { name: "History" }));
      expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh history" })).toBeEnabled();
      expect(screen.getByPlaceholderText("Search work log…")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Settings" }));
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
      // 5-group nav: Workspace, Runtimes, Models, Look, Support
      expect(screen.getByRole("button", { name: "Runtimes" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Models" })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });

  it("shows a tooltip for the combined model/thinking selector at collapse width", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 240, configurable: true });

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
        type: "agent/runtimeSettings",
        settings: { thinkingLevel: "medium", runtimeConfigured: true },
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
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "settings",
        snapshot: createSettingsSnapshot(),
      });
      transport.emit({
        type: "agent/activeFileContext",
        snapshot: { name: "journal.md", path: "/workspace/src/notes/journal.md" },
      });
    });

    try {
      await user.hover(screen.getByRole("button", { name: "GPT-5.4 - Medium" }));
      expect(
        await screen.findByText(/choose the model and thinking level for the next turn/i, {
          selector: '[data-slot="tooltip-content"]',
        }),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });

  it("opens the combined model/thinking menu and sends thinking changes", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 240, configurable: true });

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
        type: "agent/runtimeSettings",
        settings: { thinkingLevel: "medium", runtimeConfigured: true },
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
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "settings",
        snapshot: createSettingsSnapshot(),
      });
    });

    try {
      await user.click(screen.getByRole("button", { name: "GPT-5.4 - Medium" }));
      expect(screen.getByText("Thinking Level")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Model" })).toBeInTheDocument();

      const send = transport.send as ReturnType<typeof vi.fn>;
      send.mockClear();
      await user.click(screen.getByRole("menuitemradio", { name: "Low" }));
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chat/setThinkingLevel",
          level: "low",
        }),
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "GPT-5.4 - Low" })).toBeInTheDocument(),
      );
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });

  it("shows a tooltip for the active file context switch at collapse width", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 240, configurable: true });

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
        type: "agent/settingsSnapshot",
        requestId: "settings",
        snapshot: createSettingsSnapshot(),
      });
      transport.emit({
        type: "agent/activeFileContext",
        snapshot: { name: "journal.md", path: "/workspace/src/notes/journal.md" },
      });
    });

    try {
      const fileContextTrigger = screen.getByRole("switch", { name: "journal.md" });
      await user.hover(fileContextTrigger);
      const fileContextTooltip = await waitFor(() => {
        const tooltip = document.querySelector('[data-slot="tooltip-content"]');
        expect(tooltip).not.toBeNull();
        return tooltip as HTMLElement;
      });
      expect(fileContextTooltip).toHaveTextContent(/file context on/i);
      expect(fileContextTooltip).toHaveTextContent(
        /new turns automatically include this editor file, which is useful when the answer depends on the current code\./i,
      );
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });

  it("shows the Mode control, Explore tooltip, footer state, and blocked command strip", async () => {
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
        type: "agent/settingsSnapshot",
        requestId: "settings",
        snapshot: createSettingsSnapshot(),
      });
      transport.emit({
        type: "agent/activeFileContext",
        snapshot: { name: "journal.md", path: "/workspace/src/notes/journal.md" },
      });
    });

    const modeButton = screen.getByRole("button", { name: "Workspace mode" });
    expect(modeButton).toHaveTextContent("Code");
    expect(modeButton).not.toHaveTextContent("Mode:");
    expect(modeButton).not.toHaveClass("text-muted-foreground");
    const modeIcon = modeButton.querySelector("svg");
    expect(modeIcon).toHaveClass("text-afx-brand-soft");
    expect(modeIcon).not.toHaveClass("text-muted-foreground");
    await user.hover(modeButton);
    expect(
      await screen.findByText(/code is the default full-access pi-backed mode/i, {
        selector: '[data-slot="tooltip-content"]',
      }),
    ).toBeInTheDocument();

    await user.click(modeButton);
    expect(screen.getByRole("menuitemradio", { name: /Explore/i })).toBeInTheDocument();
    expect(screen.getAllByText("Experimental").length).toBeGreaterThan(0);

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    await user.click(screen.getByRole("menuitemradio", { name: /Explore/i }));

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/setMode",
        mode: "explore",
      }),
    );
    const exploreModeButton = screen.getByRole("button", { name: "Workspace mode" });
    expect(exploreModeButton).toHaveTextContent("Explore");
    expect(exploreModeButton).not.toHaveClass("text-amber-600");
    const exploreModeIcon = exploreModeButton.querySelector("svg");
    expect(exploreModeIcon).toHaveClass("text-afx-brand-soft");
    expect(exploreModeIcon).not.toHaveClass("text-amber-600");
    // Footer hint now includes the Cmd/Ctrl+Shift+M shortcut suffix in non-Code modes.
    // @see docs/specs/211-app-chat-composer/spec.md [FR-14]
    expect(screen.getByText(/Read-only \/ Safe/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "Explore mode is read-only — ask about files, risks, or the next step…",
      ),
    ).toBeInTheDocument();

    act(() => {
      transport.emit({
        type: "agent/actionBlocked",
        requestId: "blocked-1",
        mode: "explore",
        action: "runCommand",
        title: "Shell command blocked in Explore mode",
        message: "Explore mode is read-only. Switch to Code to run shell commands.",
        command: "pnpm test",
      });
    });

    expect(screen.getByText("Blocked command")).toBeInTheDocument();
    expect(screen.getByText("! pnpm test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy command" })).toBeInTheDocument();

    send.mockClear();
    await user.click(screen.getByRole("button", { name: "Switch to Code" }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/setMode",
        mode: "code",
      }),
    );
    expect(screen.getByRole("button", { name: "Workspace mode" })).toHaveTextContent("Code");
    expect(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
    ).toHaveValue("! pnpm test");
    expect(screen.queryByText("Blocked command")).not.toBeInTheDocument();
  });

  /**
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODE-TOGGLE] [DES-COMPOSER-CONTEXT]
   */
  it("keeps a fresh Code mode selection from being overwritten by a late Explore snapshot", async () => {
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
            reasoning: true,
            source: "api-provider",
            instanceId: "pi-sdk",
          },
        },
      });
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "settings-explore",
        snapshot: createSettingsSnapshot("explore"),
      });
    });

    const modeButton = screen.getByRole("button", { name: "Workspace mode" });
    expect(modeButton).toHaveTextContent("Explore");
    await user.click(modeButton);
    await user.click(screen.getByRole("menuitemradio", { name: /^Code\b/i }));

    const send = transport.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/setMode",
        mode: "code",
      }),
    );
    expect(screen.getByRole("button", { name: "Workspace mode" })).toHaveTextContent("Code");
    expect(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
    ).toBeInTheDocument();

    act(() => {
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "settings-stale-explore",
        snapshot: createSettingsSnapshot("explore"),
      });
    });

    expect(screen.getByRole("button", { name: "Workspace mode" })).toHaveTextContent("Code");
    expect(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
    ).toBeInTheDocument();
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
          {
            provider: "pi",
            id: "default",
            name: "Pi RPC",
            source: "external-agent",
            instanceId: "pi",
            instanceLabel: "Pi RPC",
            reasoning: true,
            contextWindow: 0,
            maxTokens: 0,
          },
        ],
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "GPT-5.4 - Medium" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "GPT-5.4 - Medium" }));
    await user.hover(screen.getByRole("menuitem", { name: "Model" }));
    await waitFor(() => expect(screen.getByText("Provider")).toBeInTheDocument());
    expect(screen.getAllByText("External Agents").length).toBeGreaterThan(0);
    expect(screen.getByText("Openai")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getAllByText("Pi RPC").length).toBeGreaterThan(0);

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Claude Opus 4\.7/i }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/setModel",
        provider: "anthropic",
        modelId: "claude-opus-4-7",
        instanceId: "pi-sdk",
      }),
    );

    await user.click(screen.getByRole("button", { name: "GPT-5.4 - Medium" }));
    await user.hover(screen.getByRole("menuitem", { name: "Model" }));
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Manage providers and agents…" })).toBeVisible(),
    );

    send.mockClear();
    fireEvent.click(screen.getByRole("menuitem", { name: "Manage providers and agents…" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(screen.queryByRole("menuitem", { name: "Manage providers and agents…" })).toBeNull();
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
    // Troubleshoot disclosure is always rendered inside each instance card.
    expect(screen.getAllByText("Troubleshoot ▾").length).toBeGreaterThan(0);

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

    expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note"),
    ).toBeEnabled();

    // Tab switch should not flash the empty state — thread content is preserved.
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await user.click(screen.getByRole("tab", { name: "Chat" }));
    expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/Chat-first by default/i)).not.toBeInTheDocument();

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
    // Troubleshoot disclosure is always rendered inside the SDK instance card.
    expect(screen.getAllByText("Troubleshoot ▾").length).toBeGreaterThan(0);

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();

    // Open the SDK instance card Troubleshoot disclosure to reveal the buttons.
    const troubleshootButtons = screen.getAllByText("Troubleshoot ▾");
    await user.click(troubleshootButtons[0]);

    await user.click(screen.getAllByRole("button", { name: "Reconnect" })[0]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "agent/checkStatus" }));

    await user.click(screen.getAllByRole("button", { name: "Restart" })[0]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "agent/restart" }));

    await user.click(screen.getAllByRole("button", { name: "View logs" })[0]);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "chat/getStderr" }));
    expect(screen.getByText("Runtime stderr")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Reload" })[0]);
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
    expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
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

    expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
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

  it("uses the empty chat landing as editable onboarding, not auto-send", async () => {
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
          lastReadyAt: 1,
          consecutiveFailures: 0,
        },
      });
      emitChatState(transport);
    });

    expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
    expect(screen.getByText(/Repo-backed notes, tasks, and docs/i)).toBeInTheDocument();
    expect(screen.getByText(/Most coding stays in chat/i)).toBeInTheDocument();
    expect(screen.queryByText(/Spec -> design -> tasks/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Chat").length).toBeGreaterThan(1);
    expect(screen.getByText("Workflow")).toBeInTheDocument();
    expect(screen.getAllByText("Spec").length).toBeGreaterThan(1);

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    const composer = screen.getByPlaceholderText("Ask AFX about this workspace — ⌘⇧⏎ saves a note");

    await user.click(screen.getByRole("button", { name: "Ask about this repo" }));
    expect((composer as HTMLTextAreaElement).value).toContain("Give me a concise orientation");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));

    await user.click(screen.getByRole("button", { name: "Start a sprint" }));
    expect((composer as HTMLTextAreaElement).value).toContain("AFX sprint mode");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));

    await user.click(screen.getByRole("button", { name: "What do I do next?" }));
    expect(composer).toHaveValue("/afx-next");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));
  });

  it("shows Explore mode read-only onboarding as a distinct empty state", async () => {
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
          lastReadyAt: 1,
          consecutiveFailures: 0,
        },
      });
      emitChatState(transport, {}, null, "explore");
    });

    expect(screen.getByText(/Read-only\. Use it to inspect code/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Experimental/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/try not to delete files or folders/i)).toBeInTheDocument();
    expect(screen.getByText("Inspect")).toBeInTheDocument();
    expect(screen.getByText("Trace")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    await user.click(screen.getByRole("button", { name: "Find risks" }));
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const exploreComposer = screen.getByPlaceholderText(
      /Explore mode is read-only/i,
    ) as HTMLTextAreaElement;
    expect(exploreComposer.value).toContain("Explore mode: review the current context");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));
  });

  it("shows Spec mode guided onboarding when no AFX doc is active", async () => {
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
          lastReadyAt: 1,
          consecutiveFailures: 0,
        },
      });
      emitChatState(transport, {}, null, "spec");
    });

    expect(screen.getByRole("heading", { name: "Spec-driven workflow" })).toBeInTheDocument();
    expect(screen.getByText(/Spec -> design -> tasks/i)).toBeInTheDocument();
    expect(screen.getByText("How AFX moves work")).toBeInTheDocument();
    expect(screen.getByText("Living specs")).toBeInTheDocument();
    expect(screen.getByText("Traceability")).toBeInTheDocument();
    expect(screen.getByText("Sprint mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create first spec/i })).toBeInTheDocument();
    expect(screen.getByText(/Pick an example or bring your own idea/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Explore an idea/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start lean/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resume workflow/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "/afx-context load" })).toBeInTheDocument();
    expect(screen.getByText("Same skills. Same files. Same rules.")).toBeInTheDocument();

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    const specComposer = (): HTMLTextAreaElement =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      screen.getByPlaceholderText(/Spec mode/i) as HTMLTextAreaElement;
    await user.click(screen.getByRole("button", { name: /Create first spec/i }));
    expect(specComposer().value).toContain("I want to create my first AFX spec");
    expect(specComposer().value).toContain("a landing page for <product or project>");
    expect(specComposer().value).toContain("a workflow/tooling feature");
    expect(specComposer().value).toContain(
      "recommend whether this should become an /afx-spec or an /afx-sprint",
    );
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));

    await user.click(screen.getByRole("button", { name: /Explore an idea/i }));
    expect(specComposer().value).toContain("I have a rough feature idea");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));
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
      emitChatState(transport, undefined, null, "code", {
        engine: {
          rpcEnabled: true,
          agentBinary: "pi",
          bundledSkillsPath: "resources/skills/agenticflowx",
          bundledSkillCount: 17,
          ephemeral: false,
        },
      });
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
        snapshot: createSettingsSnapshot(),
      });
    });

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    // Workspace group: 5-group nav with Workspace, Runtimes, Models, Look, Support
    expect(screen.getByRole("button", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Runtimes" })).toBeInTheDocument();
    // Mode card: Code / Explore with new copy from settings-copy.ts
    expect(
      screen.getByText(/Full access\. Runtimes can read, write, run shells, and edit\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Read-only\. Tool calls that would modify files or run shell commands are blocked/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Experimental").length).toBeGreaterThan(0);
    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();
    await user.click(screen.getByText("Explore"));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/setMode",
        mode: "explore",
      }),
    );
    // Active-file context switch is in the Workspace group
    const includeActiveFileContext = screen.getByRole("switch", {
      name: "Active-file context",
    });
    expect(includeActiveFileContext).toBeChecked();
    send.mockClear();
    fireEvent.click(includeActiveFileContext);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/setIncludeActiveFileContext",
        enabled: false,
      }),
    );
    // Runtimes group: SDK and RPC instance cards
    await user.click(screen.getByRole("button", { name: "Runtimes" }));
    expect(screen.getAllByText("API Providers (bundled SDK)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pi RPC (subprocess)").length).toBeGreaterThan(0);
    const piRpcSwitch = screen.getByRole("switch", { name: "Enable Pi RPC" });
    expect(piRpcSwitch).not.toBeChecked();
    fireEvent.click(piRpcSwitch);
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "external/setRpcEnabled",
        enabled: true,
      }),
    );
    // Support group: About + telemetry toggle
    await user.click(screen.getByRole("button", { name: "Support" }));
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
    expect(
      screen.getByText("⏎ follow-up · ⌘⏎ steer · idle: ⏎ send · ⌘⇧⏎ note · ↑ history"),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText("⏎ follow-up · ⌘⏎ steer · idle: ⏎ send · ⌘⇧⏎ note · ↑ history"),
    ).toBeInTheDocument();
  });

  /**
   * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
   */
  it("flips a running file-edit tool to error when the user aborts mid-turn", () => {
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
        id: "assistant-abort-1",
        role: "assistant",
        createdAt: 1,
      });
      transport.emit({
        type: "chat/toolStart",
        toolCallId: "edit-1",
        toolName: "edit_file",
        args: { path: "src/x.ts" },
      });
    });

    const pill = screen.getByTestId("files-strip-pill");
    expect(pill).toHaveAttribute("data-status", "running");

    act(() => {
      transport.emit({ type: "chat/aborted" });
    });

    expect(screen.getByTestId("files-strip-pill")).toHaveAttribute("data-status", "error");
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

  /**
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-4]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENT-TIMELINE] [DES-MESSAGES-COMPONENT-TOOL-EVENT]
   */
  it("keeps tool rows below the triggering user message after timeline sorting", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    act(() => {
      transport.emit({
        type: "chat/state",
        isStreaming: true,
        tools: [],
        messages: [
          { id: "user-review", role: "user", content: "review this research file", createdAt: 10 },
          {
            id: "assistant-review",
            role: "assistant",
            content: "",
            createdAt: 11,
            streaming: true,
            tools: [
              {
                toolCallId: "tool-read-research",
                toolName: "read_file",
                status: "running",
                args: { path: "docs/research/res-top10-user-ask.md" },
              },
            ],
          },
        ],
      });
    });

    const userMessage = screen.getByText("review this research file");
    const toolLabel = screen.getByText("read");
    expect(userMessage.compareDocumentPosition(toolLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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

    expect(screen.getByRole("button", { name: "Llama 4 Scout - Medium" })).toBeEnabled();
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

    expect(screen.getByRole("button", { name: "Claude Opus 4.7 - Medium" })).toBeEnabled();
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

  /**
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-FOOTER] [DES-COMPOSER-MOCKUP-COMPACTING]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MOCKUP-COMPACTION-TOAST]
   */
  it("locks the composer during compaction and keeps compacted toasts short", () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    const longSummary =
      "This compacted session summary is intentionally long and should stay out of the transient toast.";

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
        type: "agent/runtimeSettings",
        settings: { isCompacting: true, runtimeConfigured: true },
      });
    });

    expect(
      screen.getByPlaceholderText("Compacting session — wait for it to finish…"),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compact session" })).toBeDisabled();

    act(() => {
      transport.emit({
        type: "agent/compacted",
        requestId: "compact-1",
        result: { summary: longSummary, firstKeptEntryId: "entry-1", tokensBefore: 1234 },
      });
    });

    expect(screen.getByText("Session compacted")).toBeInTheDocument();
    expect(screen.getByText("History compacted into a summary.")).toBeInTheDocument();
    expect(screen.queryByText(longSummary)).not.toBeInTheDocument();
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
    expect(screen.getByText("Follow-up")).toBeInTheDocument();
    expect(screen.getByText("⏎")).toBeInTheDocument();
    expect(screen.getByText("Steer")).toBeInTheDocument();
    expect(screen.getByText("⌘⏎")).toBeInTheDocument();
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

  // ---------------------------------------------------------------------------
  // Local-only state reset on new session / reload — covers two reported bugs:
  //   1. Token / context counter persisted across `chat/newSession`.
  //   2. Shell-command output persisted across reload while messages cleared.
  // The fix routes both through chat/state with empty messages → clear
  // commandOutputs + noteEvents + usage. Plus startNewSession does the same
  // local clears for instant UI feedback.
  // @see docs/specs/210-app-chat/design.md [DES-API]
  // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
  // ---------------------------------------------------------------------------

  it("clears the token/context counter when chat/state arrives with messages=[] (reload)", async () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    // Hydrate with some chat content + a usage counter.
    act(() => {
      emitChatState(transport, {
        messages: [{ id: "m1", role: "user", content: "hi", createdAt: 1 }],
      });
      transport.emit({
        type: "chat/usage",
        tokens: { input: 1_000, output: 2_500, cacheRead: 0, cacheWrite: 0, total: 3_500 },
        cost: 0.0012,
        contextUsage: { tokens: 3_500, contextWindow: 200_000, percent: 2 },
      });
    });

    expect(screen.getByText(/3\.5k tokens · ctx 2% · \$0\.0012/)).toBeInTheDocument();

    // Simulate a reload: host sends a fresh chat/state with empty messages.
    act(() => {
      transport.emit({
        type: "chat/state",
        isStreaming: false,
        messages: [],
        tools: [],
      });
    });

    expect(screen.queryByText(/tokens · ctx/)).not.toBeInTheDocument();
  });

  it("clears shell command output when chat/state arrives with messages=[] (reload)", async () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);

    // Seed a shell-command output via the agent/commandOutput bridge.
    act(() => {
      emitChatState(transport, {
        messages: [{ id: "m1", role: "user", content: "hi", createdAt: 1 }],
      });
      transport.emit({
        type: "agent/commandOutput",
        requestId: "cmd-1",
        delta: "README.md\npackage.json",
        kind: "stdout",
      });
      transport.emit({
        type: "agent/commandOutput",
        requestId: "cmd-1",
        done: true,
        exitCode: 0,
      });
    });

    expect(screen.getByText(/README\.md/)).toBeInTheDocument();

    // Reload — host's chat/state.messages is empty → all local-only surfaces
    // (shell output, notes, usage) must clear together.
    act(() => {
      transport.emit({
        type: "chat/state",
        isStreaming: false,
        messages: [],
        tools: [],
      });
    });

    expect(screen.queryByText(/README\.md/)).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Spec mode composer-strip auto-send (FR-15)
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
  // ---------------------------------------------------------------------------

  /** Bring the chat into Spec mode with a standard spec.md as the active doc. */
  function bootSpecMode(
    transport: ReturnType<typeof createControlledTransport>,
    opts: { isStreaming?: boolean } = {},
  ): void {
    act(() => {
      // Runtime needs a `ready` status before the composer enables itself.
      transport.emit({
        type: "agent/status",
        status: {
          phase: "ready",
          running: true,
          isStreaming: opts.isStreaming ?? false,
          checkedAt: 1,
          lastReadyAt: 1,
          consecutiveFailures: 0,
        },
      });
      emitChatState(transport, { isStreaming: opts.isStreaming }, null, "spec");
      transport.emit({
        type: "chat/activeDocContext",
        format: "standard",
        section: "SPEC",
        docKind: "spec",
        feature: "auth",
        approvalStatus: "Draft",
      });
    });
  }

  /**
   * Click the first action button matching `label`. The same action is rendered
   * by both DocActionsStrip (above the composer) and SpecModeWelcome (empty
   * state) in spec mode — they share the same callbacks, so testing either is
   * equivalent. We pick the first match to keep tests stable.
   */
  function clickStripAction(label: string): Promise<void> {
    const buttons = screen
      .getAllByRole("button")
      .filter((el) => el.querySelector("span")?.textContent?.trim() === label);
    const target = buttons[0];
    if (!target) {
      throw new Error(`No strip button labeled "${label}" found.`);
    }
    return userEvent.setup().click(target);
  }

  it("auto-sends Validate immediately on click (chat/send, draft stays empty)", async () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);
    bootSpecMode(transport);

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();

    await clickStripAction("Validate");

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/send",
        content: "/afx-spec validate auth",
      }),
    );
    // Draft must stay empty — auto-send bypasses the textarea.
    expect(screen.getByPlaceholderText(/Spec mode/i)).toHaveValue("");
  });

  it("auto-sends Approve while streaming as a polite chat/followUp (never steer)", async () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);
    bootSpecMode(transport, { isStreaming: true });

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();

    await clickStripAction("Approve");

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/followUp",
        content: "/afx-spec approve auth",
      }),
    );
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/steer" }));
  });

  it("inserts Refine into the composer draft (never auto-sends)", async () => {
    const transport = createControlledTransport();
    initTransport(transport);
    render(<App transport={transport} />);
    bootSpecMode(transport);

    const send = transport.send as ReturnType<typeof vi.fn>;
    send.mockClear();

    await clickStripAction("Refine");

    // Refine is dialogic — it lands in the textarea, not on the wire.
    expect(screen.getByPlaceholderText(/Spec mode/i)).toHaveValue("/afx-spec refine auth");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/send" }));
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "chat/followUp" }));
  });
});
