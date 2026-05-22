/**
 * ComposerToolbar tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentModel } from "@afx/shared";

import { ComposerToolbar } from "./composer-toolbar";

const model: AgentModel = {
  provider: "anthropic",
  id: "claude-opus-4",
  name: "Claude Opus 4",
  contextWindow: 200000,
  maxTokens: 8192,
  reasoning: true,
  source: "api-provider",
};

describe("ComposerToolbar", () => {
  it("renders toolbar controls and dispatches mention/file-context actions", () => {
    const onOpenMentionPicker = vi.fn();
    const onToggleActiveFileContext = vi.fn();
    const onOpenAttachmentPicker = vi.fn();

    render(
      <ComposerToolbar
        isSystemCommand={false}
        disabled={false}
        models={[model]}
        selectedModel={model}
        thinkingLevel="medium"
        workspaceMode="code"
        includeActiveFileContext
        activeFileDisplayName="chat.tsx"
        activeFileDisplayPath="apps/chat/src/chat.tsx"
        onOpenMentionPicker={onOpenMentionPicker}
        onOpenAttachmentPicker={onOpenAttachmentPicker}
        onSelectModel={vi.fn()}
        onSelectThinkingLevel={vi.fn()}
        onWorkspaceModeChange={vi.fn()}
        onToggleActiveFileContext={onToggleActiveFileContext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mention file" }));
    expect(onOpenMentionPicker).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Attach file or image" }));
    expect(onOpenAttachmentPicker).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("switch", { name: "chat.tsx" }));
    expect(onToggleActiveFileContext).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("button", { name: /Model: Claude Opus 4/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workspace mode: Code" })).toBeInTheDocument();
  });

  it("moves the active-file context switch thumb with the checked state", () => {
    const props = {
      isSystemCommand: false,
      disabled: false,
      models: [model],
      selectedModel: model,
      workspaceMode: "code" as const,
      activeFileDisplayName: "chat.tsx",
      activeFileDisplayPath: "apps/chat/src/chat.tsx",
      onOpenMentionPicker: vi.fn(),
      onSelectModel: vi.fn(),
      onSelectThinkingLevel: vi.fn(),
      onWorkspaceModeChange: vi.fn(),
      onToggleActiveFileContext: vi.fn(),
    };

    const { rerender } = render(<ComposerToolbar {...props} includeActiveFileContext />);

    let toggle = screen.getByRole("switch", { name: "chat.tsx" });
    let track = toggle.querySelector('[data-slot="switch"]');
    let thumb = toggle.querySelector('[data-slot="switch-thumb"]');
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(track).toHaveAttribute("data-state", "checked");
    expect(track).toHaveClass("bg-primary");
    expect(thumb).toHaveClass("translate-x-3");

    rerender(<ComposerToolbar {...props} includeActiveFileContext={false} />);

    toggle = screen.getByRole("switch", { name: "chat.tsx" });
    track = toggle.querySelector('[data-slot="switch"]');
    thumb = toggle.querySelector('[data-slot="switch-thumb"]');
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(track).toHaveAttribute("data-state", "unchecked");
    expect(track).not.toHaveClass("bg-primary");
    expect(thumb).toHaveClass("translate-x-0");
  });

  it("omits the attachment trigger until a working picker is supplied", () => {
    render(
      <ComposerToolbar
        isSystemCommand={false}
        disabled={false}
        models={[model]}
        selectedModel={model}
        workspaceMode="code"
        includeActiveFileContext={false}
        activeFileDisplayName="No active file"
        activeFileDisplayPath=""
        onOpenMentionPicker={vi.fn()}
        onSelectModel={vi.fn()}
        onSelectThinkingLevel={vi.fn()}
        onWorkspaceModeChange={vi.fn()}
        onToggleActiveFileContext={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Attach file or image" })).not.toBeInTheDocument();
  });

  it("shows shell status instead of mention trigger for system commands", () => {
    render(
      <ComposerToolbar
        isSystemCommand
        disabled={false}
        models={[model]}
        selectedModel={model}
        workspaceMode="code"
        includeActiveFileContext={false}
        activeFileDisplayName="No active file"
        activeFileDisplayPath=""
        onOpenMentionPicker={vi.fn()}
        onSelectModel={vi.fn()}
        onSelectThinkingLevel={vi.fn()}
        onWorkspaceModeChange={vi.fn()}
        onToggleActiveFileContext={vi.fn()}
      />,
    );

    expect(screen.getByText("Shell")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mention file" })).not.toBeInTheDocument();
  });
});
