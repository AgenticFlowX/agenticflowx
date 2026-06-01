/**
 * ModelCombobox segmentation, search, and dual-auth radio (Phase 5).
 *
 * The grouping/key/search helpers in model-combobox.tsx are module-private, so
 * this jsdom component test pins their pure contract through the rendered DOM:
 * stable segment order, dual-auth two-row radio (group bucket excludes method),
 * cross-field search filter, no-results state, and per-method trigger chips.
 *
 * @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] [FR-2] [FR-4] [FR-5]
 * @see docs/specs/217-app-chat-model-selector/design.md [DES-TEST]
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AgentModel } from "@afx/shared";
import { TooltipProvider } from "@afx/ui/components/tooltip";

import { ModelCombobox } from "./model-combobox";

function sdkModel(overrides: Partial<AgentModel>): AgentModel {
  return {
    provider: "anthropic",
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    reasoning: true,
    contextWindow: 200_000,
    maxTokens: 64_000,
    source: "api-provider",
    instanceId: "pi-sdk",
    ...overrides,
  };
}

const ALL_SEGMENTS: AgentModel[] = [
  sdkModel({ authMethod: "subscription" }),
  sdkModel({ authMethod: "api-key" }),
  sdkModel({ provider: "ollama", id: "llama3", name: "Llama 3", authMethod: "local" }),
  {
    provider: "pi",
    id: "default",
    name: "Pi (local agent)",
    reasoning: true,
    contextWindow: 200_000,
    maxTokens: 64_000,
    source: "external-agent",
    instanceId: "pi",
    instanceLabel: "Pi CLI",
  },
];

function renderCombobox(models: AgentModel[], value: AgentModel = models[0]) {
  const onSelect = vi.fn();
  render(
    <TooltipProvider>
      <ModelCombobox
        models={models}
        value={value}
        thinkingLevel="medium"
        onSelect={onSelect}
        onSelectThinkingLevel={vi.fn()}
      />
    </TooltipProvider>,
  );
  return { onSelect };
}

describe("ModelCombobox segmentation (Phase 5)", () => {
  it("renders the four segments in the fixed Subscription -> API key -> Local -> External order", async () => {
    const user = userEvent.setup();
    renderCombobox(ALL_SEGMENTS);

    await user.click(screen.getByRole("button", { name: /Claude Opus 4\.7/ }));

    // Each segment header is the first DOM occurrence of its label (its rows follow).
    // "Local" also appears in a row's method detail, so take the earliest match.
    const headers = ["Subscription", "API key", "Local", "External Agents"];
    const firstIndexOf = (label: string): number => {
      const nodes = screen.getAllByText(label);
      return Math.min(
        ...nodes.map((node) => Array.prototype.indexOf.call(document.querySelectorAll("*"), node)),
      );
    };
    const positions = headers.map(firstIndexOf);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    for (const label of headers) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows the same model twice under Subscription and API key (dual-auth radio rows)", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderCombobox([
      sdkModel({ authMethod: "subscription" }),
      sdkModel({ authMethod: "api-key" }),
    ]);

    await user.click(screen.getByRole("button", { name: /Claude Opus 4\.7/ }));

    // Two distinct rows for one provider/model id — bucket key excludes method.
    const rows = screen.getAllByRole("option", { name: /Claude Opus 4\.7/ });
    expect(rows).toHaveLength(2);

    // Selecting the API-key row routes the api-key variant, not subscription.
    const apiKeyHeader = screen.getByText("API key").closest("div")!.parentElement!;
    const apiKeyRow = within(apiKeyHeader.nextElementSibling as HTMLElement).getByRole("option");
    await user.click(apiKeyRow);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ authMethod: "api-key" }));
  });

  it("hides empty segments — a pure API-key list shows no Subscription/Local headers (FR-11)", async () => {
    const user = userEvent.setup();
    renderCombobox([
      sdkModel({ authMethod: "api-key" }),
      sdkModel({ provider: "openai", id: "gpt-5.2", name: "GPT-5.2", authMethod: "api-key" }),
    ]);

    await user.click(screen.getByRole("button", { name: /Claude Opus 4\.7/ }));

    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.queryByText("Subscription")).toBeNull();
    expect(screen.queryByText("Local")).toBeNull();
    expect(screen.queryByText("External Agents")).toBeNull();
  });

  it("filters by provider id and by method label, then shows the no-results state", async () => {
    const user = userEvent.setup();
    renderCombobox(ALL_SEGMENTS);

    await user.click(screen.getByRole("button", { name: /Claude Opus 4\.7/ }));
    const search = screen.getByPlaceholderText("Search models...");

    // Provider id match keeps only the matching segment's rows ("Local" appears
    // in both the header and the row method detail, so assert via getAllByText).
    await user.type(search, "ollama");
    expect(screen.getAllByText("Local").length).toBeGreaterThan(0);
    expect(screen.queryByText("Subscription")).toBeNull();
    expect(screen.queryByText("API key")).toBeNull();

    // Method label match ("subscription").
    await user.clear(search);
    await user.type(search, "subscription");
    expect(screen.getByText("Subscription")).toBeInTheDocument();
    expect(screen.queryByText("Local")).toBeNull();

    // No match -> empty state, no segment headers.
    await user.clear(search);
    await user.type(search, "zzz-no-such-model");
    expect(screen.getByText("No matching models.")).toBeInTheDocument();
    expect(screen.queryByText("Subscription")).toBeNull();
    expect(screen.queryByText("API key")).toBeNull();
  });

  it("hides the Thinking Level control while a search query is active (DES-SEARCH)", async () => {
    const user = userEvent.setup();
    renderCombobox(ALL_SEGMENTS);

    await user.click(screen.getByRole("button", { name: /Claude Opus 4\.7/ }));
    expect(screen.getByText("Thinking Level")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search models..."), "opus");
    expect(screen.queryByText("Thinking Level")).toBeNull();
  });

  it.each([
    ["subscription", "Sub", sdkModel({ authMethod: "subscription" })],
    ["api-key", "API", sdkModel({ authMethod: "api-key" })],
    [
      "local",
      "Local",
      sdkModel({ provider: "ollama", id: "llama3", name: "Llama 3", authMethod: "local" }),
    ],
  ])("renders the %s trigger method chip as %s", async (_method, chip, model) => {
    renderCombobox([model], model);
    const trigger = screen.getByRole("button", { name: new RegExp(model.name) });
    expect(trigger).toHaveTextContent(chip);
  });

  it("labels the external trigger with the instance label rather than a method chip", () => {
    const external = ALL_SEGMENTS[3];
    renderCombobox([external], external);
    const trigger = screen.getByRole("button", { name: /Pi \(local agent\)/ });
    expect(trigger).toHaveTextContent("Pi CLI");
  });
});
