/**
 * Workbench shell smoke tests for bottom-panel tab routing.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-2] [FR-5]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-TEST] [DES-SHELL-TABS]
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "./app";
import { _resetBridgeForTest } from "./lib/bridge";

const TAB_LABELS = ["Workbench", "Pipeline", "Documents", "Analytics", "Journal", "Board", "Notes"];

describe("workbench App", () => {
  afterEach(() => {
    // Reset bridge state between tests to avoid warnings from unsent messages
    _resetBridgeForTest();
  });

  it("renders all 7 tab triggers", () => {
    render(<App />);
    for (const label of TAB_LABELS) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("defaults to the Workbench tab", () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Workbench" })).toHaveAttribute("aria-selected", "true");
  });
});
