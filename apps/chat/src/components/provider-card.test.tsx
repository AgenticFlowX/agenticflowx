/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-TEST]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProviderCard } from "./provider-card";

describe("ProviderCard", () => {
  it("saves a pasted key from the empty state", () => {
    const onSaveKey = vi.fn(async () => {});
    render(
      <ProviderCard
        provider="anthropic"
        displayName="Anthropic"
        modelHint="Claude models"
        state="empty"
        onSaveKey={onSaveKey}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/api key/i)).toHaveAttribute("data-clarity-mask", "true");
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "secret-key" } });
    fireEvent.click(screen.getByRole("button", { name: /save key/i }));

    expect(onSaveKey).toHaveBeenCalledWith("secret-key");
  });

  it("focuses the key field when opened from onboarding", () => {
    render(
      <ProviderCard
        provider="anthropic"
        displayName="Anthropic"
        modelHint="Claude models"
        state="empty"
        focusKeyInput
        onSaveKey={vi.fn()}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/api key/i)).toHaveFocus();
  });

  it("labels compact empty providers as paste-key actions", () => {
    render(
      <ProviderCard
        provider="anthropic"
        displayName="Anthropic"
        modelHint="Claude models"
        state="empty"
        compact
        onSaveKey={vi.fn()}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Anthropic — Paste key" })).toBeInTheDocument();
  });

  it("shows configured state and clears a saved key", () => {
    const onClearKey = vi.fn(async () => {});
    render(
      <ProviderCard
        provider="openai"
        displayName="OpenAI"
        modelHint="GPT models"
        state="configured"
        configuredModelCount={2}
        onSaveKey={vi.fn()}
        onClearKey={onClearKey}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 models/i)).toBeInTheDocument();
    expect(screen.getByText("•••••••••• saved").closest("[data-clarity-mask='true']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /remove openai key/i }));
    expect(onClearKey).toHaveBeenCalledOnce();
  });

  it("changes the default model", () => {
    const onChangeDefault = vi.fn(async () => {});
    render(
      <ProviderCard
        provider="anthropic"
        displayName="Anthropic"
        modelHint="Claude models"
        state="configured"
        defaultModel="claude-sonnet"
        modelOptions={[
          {
            provider: "anthropic",
            id: "claude-sonnet",
            name: "Claude Sonnet",
            reasoning: true,
            contextWindow: 200_000,
            maxTokens: 64_000,
          },
          {
            provider: "anthropic",
            id: "claude-opus",
            name: "Claude Opus",
            reasoning: true,
            contextWindow: 200_000,
            maxTokens: 64_000,
          },
        ]}
        onSaveKey={vi.fn()}
        onClearKey={vi.fn()}
        onChangeDefault={onChangeDefault}
      />,
    );

    fireEvent.change(screen.getByLabelText(/default model/i), { target: { value: "claude-opus" } });
    expect(onChangeDefault).toHaveBeenCalledWith("claude-opus");
  });
});
