/**
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-3]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-TEST] [DES-PIPELINE-SIMPLE]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineRow } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Pipeline from "./pipeline";

const PIPELINE_ROWS: PipelineRow[] = [
  {
    name: "runtime-safety",
    specStatus: "Approved",
    designStatus: "Approved",
    tasksStatus: "In Progress",
    completed: 2,
    total: 5,
    featureStatus: "In Progress",
    specPath: "docs/specs/runtime-safety/spec.md",
    designPath: "docs/specs/runtime-safety/design.md",
    tasksPath: "docs/specs/runtime-safety/tasks.md",
  },
  {
    name: "provider-ux",
    specStatus: "Draft",
    designStatus: "Draft",
    tasksStatus: "Not Started",
    completed: 0,
    total: 3,
    featureStatus: "Not Started",
    specPath: "docs/specs/provider-ux/spec.md",
    designPath: "docs/specs/provider-ux/design.md",
    tasksPath: "docs/specs/provider-ux/tasks.md",
  },
  {
    name: "blocked-release",
    specStatus: "Approved",
    designStatus: "Approved",
    tasksStatus: "In Progress",
    completed: 1,
    total: 4,
    featureStatus: "blocked",
    specPath: "docs/specs/blocked-release/spec.md",
    designPath: "docs/specs/blocked-release/design.md",
    tasksPath: "docs/specs/blocked-release/tasks.md",
  },
];

describe("Pipeline", () => {
  beforeEach(() => {
    initWorkbenchBridge();
  });

  afterEach(() => {
    _resetBridgeForTest();
  });

  it("defaults to the simple overview view", () => {
    render(
      <WorkbenchProvider initialState={{ isLoading: false, pipeline: PIPELINE_ROWS }}>
        <Pipeline />
      </WorkbenchProvider>,
    );

    expect(screen.getByText("Pipeline overview")).toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByText("runtime-safety")).toBeInTheDocument();
  });

  it("opens a blocked feature task document in the refinement Preview", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    render(
      <WorkbenchProvider initialState={{ isLoading: false, pipeline: PIPELINE_ROWS }}>
        <Pipeline />
      </WorkbenchProvider>,
    );

    fireEvent.click(screen.getByText("blocked-release").closest("button")!);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenFile",
        path: "docs/specs/blocked-release/tasks.md",
        mode: "afxPreview",
      },
      "*",
    );
    postMessage.mockRestore();
  });
});
