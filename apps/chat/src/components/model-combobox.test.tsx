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
  },
];

describe("ModelCombobox", () => {
  it("keeps the selected model out of the visible footer label and exposes it in tooltip details", async () => {
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
      name: "Model: Kimi K2.6 (Moonshot Open). Thinking level: High",
    });

    expect(trigger).toHaveTextContent("Model - High");
    expect(trigger).not.toHaveTextContent("Kimi K2.6");

    await user.hover(trigger);

    expect(await screen.findAllByText("Kimi K2.6 (Moonshot Open)")).not.toHaveLength(0);
  });
});
