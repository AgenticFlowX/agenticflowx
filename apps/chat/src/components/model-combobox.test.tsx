/**
 * ModelCombobox component tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AgentModel } from "@afx/shared";
import { TooltipProvider } from "@afx/ui/components/tooltip";

import { ModelCombobox } from "./model-combobox";

const MODELS: AgentModel[] = [
  {
    provider: "moonshot",
    id: "kimi-k2.6",
    name: "Kimi K2.6 (Moonshot Open)",
    reasoning: true,
    contextWindow: 200_000,
    maxTokens: 8_192,
    source: "api-provider",
    instanceId: "pi-sdk",
    authMethod: "api-key",
  },
];

describe("ModelCombobox", () => {
  it("shows the selected model and method in the compact trigger", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider>
        <ModelCombobox
          models={MODELS}
          value={MODELS[0]}
          thinkingLevel="high"
          onSelect={vi.fn()}
          onSelectThinkingLevel={vi.fn()}
        />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: "Model: Kimi K2.6 (Moonshot Open). Method: API. Thinking level: High",
    });

    expect(trigger).toHaveTextContent("Kimi K2.6 (Moonshot Open) - High");
    expect(trigger).toHaveTextContent("API");

    await user.hover(trigger);

    expect(await screen.findAllByText("Kimi K2.6 (Moonshot Open)")).not.toHaveLength(0);
  });

  it("segments by method and filters across model, provider, and method labels", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const baseModel = MODELS[0];
    const models: AgentModel[] = [
      {
        ...baseModel,
        provider: "anthropic",
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7",
        authMethod: "subscription",
      },
      {
        ...baseModel,
        provider: "anthropic",
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7",
        authMethod: "api-key",
      },
      {
        ...baseModel,
        provider: "ollama",
        id: "qwen2.5",
        name: "Qwen local",
        authMethod: "local",
      },
      {
        ...baseModel,
        provider: "pi",
        id: "default",
        name: "Pi CLI",
        source: "external-agent",
        instanceId: "pi",
        instanceLabel: "Pi CLI",
        authMethod: undefined,
      },
    ];

    render(
      <TooltipProvider>
        <ModelCombobox
          models={models}
          value={models[0]}
          thinkingLevel="medium"
          onSelect={onSelect}
          onSelectThinkingLevel={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Claude Opus 4\.7/ }));

    expect(screen.getAllByText("Subscription").length).toBeGreaterThan(0);
    expect(screen.getAllByText("API key").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Local").length).toBeGreaterThan(0);
    expect(screen.getByText("External Agents")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search models..."), "sub");

    expect(screen.getAllByText("Subscription").length).toBeGreaterThan(0);
    expect(screen.queryByText("API key")).toBeNull();

    await user.clear(screen.getByPlaceholderText("Search models..."));
    await user.type(screen.getByPlaceholderText("Search models..."), "nothing-here");

    expect(screen.getByText("No matching models.")).toBeInTheDocument();
  });
});
