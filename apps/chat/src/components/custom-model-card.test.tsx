/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CustomProviderSummary } from "@afx/shared";

import { CustomModelCard } from "./custom-model-card";

const AFX_MANAGED: CustomProviderSummary = {
  id: "openrouter",
  displayName: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  api: "openai-completions",
  modelCount: 2,
  models: [
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", contextWindow: 200_000 },
    { id: "anthropic/claude-opus-4-5", name: "Claude Opus 4.5", contextWindow: 200_000 },
  ],
  apiKeySource: "vscode-secret",
  apiKeyLabel: "AFX_OPENROUTER_KEY",
  hasApiKey: true,
  origin: "afx-managed",
};

const HAND_EDITED: CustomProviderSummary = {
  id: "moonshot-open",
  baseUrl: "https://api.moonshot.ai/v1",
  api: "openai-completions",
  modelCount: 1,
  models: [{ id: "kimi-k2.6", name: "Kimi K2.6" }],
  apiKeySource: "literal",
  hasApiKey: true,
  origin: "hand-edited",
  hasLiteralApiKeyOnDisk: true,
};

describe("CustomModelCard — afx-managed mode", () => {
  it("shows the displayName, model count, and AFX-managed badge", () => {
    render(<CustomModelCard summary={AFX_MANAGED} />);
    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
    expect(screen.getByText(/2 models/)).toBeInTheDocument();
    expect(screen.getByText(/AFX-managed/i)).toBeInTheDocument();
    expect(screen.getByText("AFX_OPENROUTER_KEY")).toBeInTheDocument();
  });

  it("renders each configured model id and a context-window summary", () => {
    render(<CustomModelCard summary={AFX_MANAGED} />);
    expect(screen.getByText("anthropic/claude-sonnet-4")).toBeInTheDocument();
    expect(screen.getByText("anthropic/claude-opus-4-5")).toBeInTheDocument();
    expect(screen.getAllByText(/200k ctx/i)).toHaveLength(2);
  });

  it("masks the api key with bullets when one is configured", () => {
    render(<CustomModelCard summary={AFX_MANAGED} />);
    // ●●●●●●●●●●●● — verify the masked indicator is rendered.
    expect(screen.getByText(/•+/)).toBeInTheDocument();
  });

  it("invokes onEdit and onRemove handlers", () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(<CustomModelCard summary={AFX_MANAGED} onEdit={onEdit} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText(/edit OpenRouter/i));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText(/remove OpenRouter/i));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("CustomModelCard — hand-edited mode", () => {
  it("renders only Open in editor and surfaces the literal-key warning", () => {
    const onOpenInEditor = vi.fn();
    render(<CustomModelCard summary={HAND_EDITED} onOpenInEditor={onOpenInEditor} />);
    expect(screen.getByText(/READ-ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/Literal API key on disk/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/edit moonshot/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/remove moonshot/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Open moonshot-open in editor/i));
    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
  });
});
