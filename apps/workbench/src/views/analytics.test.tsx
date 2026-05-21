/**
 * Analytics view tests.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-9]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-EMPTY] [DES-TEST]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Analytics from "./analytics";

describe("Analytics", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    postMessage.mockRestore();
    _resetBridgeForTest();
  });

  it("renders a useful empty guide and can create sample docs", () => {
    render(
      <WorkbenchProvider initialState={{ isLoading: false, pipeline: [], featureTasks: [] }}>
        <Analytics />
      </WorkbenchProvider>,
    );

    expect(screen.getByText("Your project heartbeat will land here")).toBeInTheDocument();
    expect(screen.getByText("Preview once signals exist")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sample SDD set/i }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxCreateSampleDocs", kind: "full-spec" },
      "*",
    );
  });
});
