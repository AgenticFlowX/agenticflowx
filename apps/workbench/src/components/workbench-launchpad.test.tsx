/**
 * Workbench launchpad tests.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD] [DES-TEST]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentRow, FeatureTasksData, PipelineRow } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import { WorkbenchLaunchpad } from "./workbench-launchpad";

function renderLaunchpad() {
  return render(
    <WorkbenchProvider initialState={{ isLoading: false }}>
      <WorkbenchLaunchpad />
    </WorkbenchProvider>,
  );
}

const PIPELINE_ROW: PipelineRow = {
  name: "checkout-redesign",
  specStatus: "Draft",
  designStatus: "Draft",
  tasksStatus: "Not Started",
  completed: 1,
  total: 4,
  featureStatus: "In Progress",
  specPath: "docs/specs/checkout-redesign/spec.md",
  designPath: "docs/specs/checkout-redesign/design.md",
  tasksPath: "docs/specs/checkout-redesign/tasks.md",
};

const FEATURE_TASKS: FeatureTasksData = {
  name: "checkout-redesign",
  tasksPath: "docs/specs/checkout-redesign/tasks.md",
  completed: 1,
  total: 4,
  phases: [],
  workSessions: [],
};

const DOCUMENT_ROW: DocumentRow = {
  type: "SPEC",
  name: "Checkout Redesign PRD",
  status: "Draft",
  owner: "@rix",
  filePath: "docs/specs/checkout-redesign/spec.md",
  isAfx: true,
  updatedAt: "2026-06-20T10:00:00.000Z",
};

function renderPopulatedLaunchpad() {
  return render(
    <WorkbenchProvider
      initialState={{
        isLoading: false,
        pipeline: [PIPELINE_ROW],
        featureTasks: [FEATURE_TASKS],
        documents: [DOCUMENT_ROW],
      }}
    >
      <WorkbenchLaunchpad />
    </WorkbenchProvider>,
  );
}

describe("WorkbenchLaunchpad", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    postMessage.mockRestore();
    _resetBridgeForTest();
  });

  it("renders starter actions for chat commands and sample docs", () => {
    renderLaunchpad();

    expect(screen.getByText("Workflow map")).toBeInTheDocument();
    expect(screen.queryByText("First 10 minutes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Full spec/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fast sprint/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bugfix/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Research/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import notes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Refine existing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sample SDD set/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sample sprint/i })).toBeInTheDocument();
  });

  it("opens a guided start drawer and drafts the selected command", () => {
    renderLaunchpad();

    fireEvent.click(screen.getByRole("button", { name: /^Full spec/i }));
    expect(screen.getByTestId("sdd-guided-start-drawer")).toBeInTheDocument();
    expect(screen.getByText("Next command")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Describe the SDD outcome"), {
      target: { value: "Checkout redesign" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft command" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-spec new checkout-redesign ask open questions first",
        mode: "insert",
      },
      "*",
    );

    fireEvent.click(screen.getByRole("button", { name: /^Sample SDD set/i }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxCreateSampleDocs", kind: "full-spec" },
      "*",
    );
  });

  it("renders active refinement and changed SDD docs when workspace data exists", () => {
    renderPopulatedLaunchpad();

    expect(screen.getByText("Active refinement")).toBeInTheDocument();
    expect(screen.getByText("Changed docs")).toBeInTheDocument();
    expect(screen.getByText("checkout-redesign")).toBeInTheDocument();
    expect(screen.getByText("Checkout Redesign PRD")).toBeInTheDocument();

    const refineButtons = screen.getAllByRole("button", { name: "Refine spec" });
    const changedDocRefine = refineButtons[1];
    if (!changedDocRefine) throw new Error("Expected changed-doc Refine spec button.");
    fireEvent.click(changedDocRefine);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-spec refine checkout-redesign",
        mode: "insert",
      },
      "*",
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenFile",
        path: "docs/specs/checkout-redesign/spec.md",
        mode: "afxPreview",
      },
      "*",
    );
  });

  it("wires guided start context toggles into the visible command", () => {
    renderPopulatedLaunchpad();

    fireEvent.click(screen.getByRole("button", { name: /^Full spec/i }));
    fireEvent.change(screen.getByLabelText("Describe the SDD outcome"), {
      target: { value: "Checkout redesign" },
    });

    expect(
      screen.getByText(
        "/afx-spec new checkout-redesign using recent SDD context; ask open questions first",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Include recent SDD context"));
    expect(
      screen.getByText("/afx-spec new checkout-redesign ask open questions first"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Ask open questions first"));
    expect(screen.getByText("/afx-spec new checkout-redesign")).toBeInTheDocument();
  });
});
