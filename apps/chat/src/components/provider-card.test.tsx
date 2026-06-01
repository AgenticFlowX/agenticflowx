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

  it("labels compact subscription-only providers as sign-in actions", () => {
    render(
      <ProviderCard
        provider="openai-codex"
        displayName="ChatGPT (Codex)"
        modelHint="GPT models via your ChatGPT plan"
        state="empty"
        compact
        oauthCapable
        oauthFlow="pkce-loopback"
        dualMethod={false}
        onOAuthSignIn={vi.fn()}
        onSaveKey={vi.fn()}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "ChatGPT (Codex) — Sign in" })).toBeInTheDocument();
    expect(screen.getAllByText("Sign in")).toHaveLength(2);
    expect(screen.queryByText("Paste key")).not.toBeInTheDocument();
  });

  it("labels expanded subscription-only providers as sign-in actions", () => {
    render(
      <ProviderCard
        provider="openai-codex"
        displayName="ChatGPT (Codex)"
        modelHint="GPT models via your ChatGPT plan"
        state="empty"
        oauthCapable
        oauthFlow="pkce-loopback"
        dualMethod={false}
        onOAuthSignIn={vi.fn()}
        onSaveKey={vi.fn()}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /sign in with chatgpt/i })).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Needs key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("labels compact dual-method subscription providers as sign-in before a method is saved", () => {
    render(
      <ProviderCard
        provider="anthropic"
        displayName="Anthropic"
        modelHint="Claude models"
        state="empty"
        compact
        oauthCapable
        oauthFlow="pkce-loopback"
        dualMethod
        onOAuthSignIn={vi.fn()}
        onSaveKey={vi.fn()}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Anthropic — Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Paste key")).not.toBeInTheDocument();
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

  it("saves required provider setup fields with a new API key", () => {
    const onSaveKey = vi.fn(async () => {});
    render(
      <ProviderCard
        provider="cloudflare-ai-gateway"
        displayName="Cloudflare AI Gateway"
        modelHint="Cloudflare routed models"
        state="empty"
        configFields={[
          {
            id: "account-id",
            label: "Account ID",
            envVar: "CLOUDFLARE_ACCOUNT_ID",
            description: "Required by Cloudflare.",
          },
          {
            id: "gateway-id",
            label: "Gateway ID",
            envVar: "CLOUDFLARE_GATEWAY_ID",
            description: "Required by Cloudflare AI Gateway.",
          },
        ]}
        onSaveKey={onSaveKey}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "cf-key" } });
    fireEvent.change(screen.getByLabelText("Account ID"), { target: { value: "account-id" } });
    fireEvent.change(screen.getByLabelText("Gateway ID"), { target: { value: "gateway-id" } });
    fireEvent.click(screen.getByRole("button", { name: /save key/i }));

    expect(onSaveKey).toHaveBeenCalledWith("cf-key", {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_GATEWAY_ID: "gateway-id",
    });
  });

  it("saves missing provider setup without re-entering an already stored key", () => {
    const onSaveKey = vi.fn(async () => {});
    render(
      <ProviderCard
        provider="cloudflare-ai-gateway"
        displayName="Cloudflare AI Gateway"
        modelHint="Cloudflare routed models"
        state="invalid"
        configFields={[
          {
            id: "account-id",
            label: "Account ID",
            envVar: "CLOUDFLARE_ACCOUNT_ID",
            description: "Required by Cloudflare.",
          },
          {
            id: "gateway-id",
            label: "Gateway ID",
            envVar: "CLOUDFLARE_GATEWAY_ID",
            description: "Required by Cloudflare AI Gateway.",
          },
        ]}
        configuredConfigFields={["account-id"]}
        onSaveKey={onSaveKey}
        onClearKey={vi.fn()}
        onChangeDefault={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Gateway ID"), { target: { value: "gateway-id" } });
    fireEvent.click(screen.getByRole("button", { name: /save setup/i }));

    expect(onSaveKey).toHaveBeenCalledWith(undefined, {
      CLOUDFLARE_GATEWAY_ID: "gateway-id",
    });
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
