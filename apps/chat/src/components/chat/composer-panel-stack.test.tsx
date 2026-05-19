/**
 * ComposerPanelStack tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-A11Y]
 */
import { type ComponentType, useState } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHAT_HISTORY_PANEL_ID, type ComposerPanelDefinition } from "./chat.types";
import { ComposerPanelStack } from "./composer-panel-stack";
import { QueueClearAllAction, QueuePanel } from "./composer-panels";

function Panel({ label }: { label: string }) {
  return <div>{label}</div>;
}

function ThrowingPanel(): never {
  throw new Error("boom");
}

function StatefulPanel() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count {count}
    </button>
  );
}

describe("ComposerPanelStack", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders each panel chrome with the `@container` class so child width-based queries work", () => {
    // Regression guard: the doc-actions primary action row, compact header
    // list, and any future panel that uses `@[<width>px]:` Tailwind queries
    // depend on `ComposerPanel` itself being a query container. Without this
    // class, child queries fall through to the next-nearest container (the
    // composer InputGroup) and silently never match — primary action buttons
    // disappear, only the compact "..." menu shows. jsdom doesn't run
    // container queries, so a render assertion is the cheapest catch.
    render(
      <ComposerPanelStack
        config={{
          panels: [panel("context", "context", "Context")],
        }}
      />,
    );
    const region = screen.getByRole("region", { name: "Context" });
    expect(region.className).toMatch(/(?:^|\s)@container(?:\s|$)/);
  });

  it("assigns unique region labels for rich React titles", () => {
    render(
      <ComposerPanelStack
        config={{
          panels: [
            {
              ...panel("intent", "workflow", "Intent"),
              title: <span>Intent</span>,
            },
            {
              ...panel("doc-actions", "workflow", "Document actions"),
              title: <span>Document actions</span>,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("region", { name: "Intent" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Document actions" })).toBeInTheDocument();
  });

  it("renders the panel-stack wrapper with `mb-1.5` so the rhythm above the textarea is preserved", () => {
    // Regression guard: the legacy ComposerStrip carried `mb-1.5` per strip,
    // and the last visible strip provided the gap to the composer textarea.
    // After migrating to ComposerPanel chrome, that gap moved onto the
    // ComposerPanelStack wrapper. Removing it leaves the textarea touching
    // the last panel; widening it creates a too-large dead zone above the
    // composer. Keep the rhythm explicit so visual regressions show up here.
    const { container } = render(
      <ComposerPanelStack config={{ panels: [panel("context", "context", "Context")] }} />,
    );
    const wrapper = container.querySelector("[data-composer-panel-stack]");
    expect(wrapper?.className).toMatch(/(?:^|\s)mb-1\.5(?:\s|$)/);
    expect(wrapper?.className).toMatch(/(?:^|\s)gap-1\.5(?:\s|$)/);
  });

  it("preserves existing children when no panel config is provided", () => {
    render(
      <ComposerPanelStack>
        <div>legacy strip</div>
      </ComposerPanelStack>,
    );

    expect(screen.getByText("legacy strip")).toBeInTheDocument();
  });

  it("orders visible configured panels by zone plus before/after hints", () => {
    const panels: ComposerPanelDefinition[] = [
      panel("feedback", "feedback", "Feedback"),
      panel("context", "context", "Context"),
      { ...panel("workflow", "workflow", "Workflow"), before: "feedback" },
      { ...panel("debug", "debug", "Debug"), visible: false },
    ];

    render(<ComposerPanelStack config={{ panels }} />);

    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => within(region).getByRole("heading").textContent)).toEqual([
      "Context",
      "Workflow",
      "Feedback",
    ]);
  });

  it("accepts the reserved future history panel id in the context zone", () => {
    render(
      <ComposerPanelStack
        config={{
          panels: [
            panel("workflow", "workflow", "Workflow"),
            panel(CHAT_HISTORY_PANEL_ID, "context", "History"),
          ],
        }}
      />,
    );

    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => within(region).getByRole("heading").textContent)).toEqual([
      "History",
      "Workflow",
    ]);
  });

  it("collapses panel body without dismissing local panel state", () => {
    const panels: ComposerPanelDefinition[] = [
      {
        id: "context",
        zone: "context",
        title: "Context",
        visible: true,
        collapsible: true,
        component: StatefulPanel,
      },
    ];

    render(<ComposerPanelStack config={{ panels }} />);
    fireEvent.click(screen.getByRole("button", { name: "Count 0" }));
    expect(screen.getByRole("button", { name: "Count 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Minimize Context" }));
    const collapsedCounter = screen.getByRole("button", { name: "Count 1", hidden: true });
    expect(collapsedCounter.closest('[aria-hidden="true"]')).toHaveClass("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Expand Context" }));
    expect(
      screen.getByRole("button", { name: "Count 1" }).closest('[aria-hidden="true"]'),
    ).toBeNull();
  });

  it("collapsible panels also toggle when the user clicks the title row (not just the minimize icon)", () => {
    const panels: ComposerPanelDefinition[] = [
      {
        id: "context",
        zone: "context",
        title: "Context",
        visible: true,
        collapsible: true,
        component: StatefulPanel,
      },
    ];

    render(<ComposerPanelStack config={{ panels }} />);
    // Title becomes a button when `collapsible: true` so the full header row is
    // a click target. Clicking the title (not the icon) should collapse.
    fireEvent.click(screen.getByRole("button", { name: "Context" }));
    expect(
      screen.getByRole("button", { name: "Count 0", hidden: true }).closest('[aria-hidden="true"]'),
    ).toHaveClass("hidden");
  });

  it("honors keyed collapse defaults in both directions as settings snapshots change", () => {
    const makePanel = (
      defaultCollapsed: boolean,
      defaultCollapsedKey: string,
    ): ComposerPanelDefinition => ({
      ...panel("intent", "workflow", "Intent"),
      collapsible: true,
      defaultCollapsed,
      defaultCollapsedKey,
    });

    const { rerender } = render(
      <ComposerPanelStack config={{ panels: [makePanel(false, "settings-expanded-initial")] }} />,
    );

    expect(screen.getByText("Intent body").closest('[aria-hidden="false"]')).not.toHaveClass(
      "hidden",
    );

    rerender(<ComposerPanelStack config={{ panels: [makePanel(true, "settings-minimized")] }} />);
    expect(screen.getByText("Intent body").closest('[aria-hidden="true"]')).toHaveClass("hidden");

    rerender(<ComposerPanelStack config={{ panels: [makePanel(false, "settings-expanded")] }} />);
    expect(screen.getByText("Intent body").closest('[aria-hidden="false"]')).not.toHaveClass(
      "hidden",
    );
  });

  it("forces a panel compact when another workflow panel owns the surface", () => {
    const headerExtras = vi.fn(({ collapsed }: { collapsed: boolean }) => (
      <span>{collapsed ? "compact" : "expanded"}</span>
    ));
    const panels: ComposerPanelDefinition[] = [
      {
        ...panel("intent", "workflow", "Intent"),
        collapsible: true,
        forcedCollapsed: true,
        headerExtras,
      },
      panel("doc-actions", "workflow", "Document actions"),
    ];

    render(<ComposerPanelStack config={{ panels }} />);

    const intentRegion = screen.getByRole("region", { name: "Intent" });
    expect(within(intentRegion).getByText("compact")).toBeInTheDocument();
    expect(
      within(intentRegion).queryByRole("button", { name: /Expand Intent|Minimize Intent/ }),
    ).not.toBeInTheDocument();
    expect(
      within(intentRegion).getByText("Intent body").closest('[aria-hidden="true"]'),
    ).toHaveClass("hidden");
  });

  it("dismisses panels and notifies the host", () => {
    const onDismissPanel = vi.fn();
    const panels = [{ ...panel("context", "context", "Context"), dismissible: true }];

    render(<ComposerPanelStack config={{ panels }} onDismissPanel={onDismissPanel} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Context" }));

    expect(screen.queryByRole("region", { name: "Context" })).not.toBeInTheDocument();
    expect(onDismissPanel).toHaveBeenCalledWith("context");
  });

  it("forgets a local dismissal after the controller removes a panel from the config", () => {
    const onDismissPanel = vi.fn();
    const panels = [{ ...panel("context", "context", "Context"), dismissible: true }];

    const { rerender } = render(
      <ComposerPanelStack config={{ panels }} onDismissPanel={onDismissPanel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Context" }));
    expect(screen.queryByRole("region", { name: "Context" })).not.toBeInTheDocument();

    rerender(<ComposerPanelStack config={{ panels: [] }} onDismissPanel={onDismissPanel} />);
    rerender(<ComposerPanelStack config={{ panels }} onDismissPanel={onDismissPanel} />);

    expect(screen.getByRole("region", { name: "Context" })).toBeInTheDocument();
  });

  it("renders the queue panel through the registry with a header actions slot", () => {
    const onDismiss = vi.fn();
    const onClearAll = vi.fn();
    const queued = [
      { id: "q1", content: "steer this", mode: "steer" as const, sentAt: 1 },
      { id: "q2", content: "follow later", mode: "followUp" as const, sentAt: 2 },
    ];
    const panels: ComposerPanelDefinition[] = [
      {
        id: "queue",
        zone: "feedback",
        title: `Queued · ${queued.length}`,
        visible: true,
        component: QueuePanel as ComponentType<unknown>,
        props: { queued, onDismiss },
        actions: <QueueClearAllAction onClearAll={onClearAll} />,
      },
    ];

    render(<ComposerPanelStack config={{ panels }} />);

    // Body lives inside the panel chrome (not in a separate ComposerStrip wrapper).
    const region = screen.getByRole("region", { name: "Queued · 2" });
    expect(within(region).getByText("steer this")).toBeInTheDocument();
    expect(within(region).getByText("follow later")).toBeInTheDocument();

    // Clear-all action mounted in the chrome's actions slot fires the callback.
    fireEvent.click(within(region).getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);

    // Per-row dismiss still works through the panel-mounted body.
    fireEvent.click(within(region).getAllByRole("button", { name: "Hide from queue display" })[0]);
    expect(onDismiss).toHaveBeenCalledWith("q1");
  });

  it("isolates render errors to the failing panel", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const panels: ComposerPanelDefinition[] = [
      panel("context", "context", "Context"),
      {
        id: "broken",
        zone: "workflow",
        title: "Broken",
        visible: true,
        component: ThrowingPanel,
      },
    ];

    render(<ComposerPanelStack config={{ panels }} />);

    expect(screen.getByText("Context body")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Broken panel failed to render.");
  });
});

function panel(
  id: string,
  zone: ComposerPanelDefinition["zone"],
  title: string,
): ComposerPanelDefinition {
  return {
    id,
    zone,
    title,
    visible: true,
    component: Panel as ComponentType<unknown>,
    props: { label: `${title} body` },
  };
}
