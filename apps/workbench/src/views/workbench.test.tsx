/**
 * Workbench thinking-desk tests.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS] [DES-TEST]
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentRow, FeatureTasksData, PipelineRow } from "@afx/shared";

import { WorkbenchProvider, type WorkbenchState } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import Workbench from "./workbench";

const PIPELINE_ROW: PipelineRow = {
  name: "checkout-redesign",
  specStatus: "Living",
  designStatus: "Draft",
  tasksStatus: "In Progress",
  completed: 3,
  total: 5,
  featureStatus: "Living",
  specPath: "docs/specs/checkout-redesign/spec.md",
  designPath: "docs/specs/checkout-redesign/design.md",
  tasksPath: "docs/specs/checkout-redesign/tasks.md",
};

const BRANDING_PIPELINE_ROW: PipelineRow = {
  name: "branding",
  specStatus: "Living",
  designStatus: "Living",
  tasksStatus: "In Progress",
  completed: 12,
  total: 37,
  featureStatus: "Living",
  specPath: "docs/specs/branding/spec.md",
  designPath: "docs/specs/branding/design.md",
  tasksPath: "docs/specs/branding/tasks.md",
};

const FEATURE_TASKS: FeatureTasksData = {
  name: "checkout-redesign",
  tasksPath: "docs/specs/checkout-redesign/tasks.md",
  completed: 1,
  total: 2,
  phases: [
    {
      number: 1,
      name: "Reader polish",
      completed: 1,
      total: 2,
      line: 12,
      items: [
        { text: "Render decision-ready spec", completed: true, line: 14 },
        { text: "Verify compact bottom panel", completed: false, line: 15 },
      ],
    },
  ],
  workSessions: [],
};

const BRANDING_TASKS: FeatureTasksData = {
  name: "branding",
  tasksPath: "docs/specs/branding/tasks.md",
  completed: 12,
  total: 37,
  phases: [],
  workSessions: [],
};

const BRANDING_SPEC_DOC: DocumentRow = {
  type: "SPEC",
  name: "Branding",
  status: "Living",
  owner: "@rix",
  filePath: "docs/specs/branding/spec.md",
  isAfx: true,
  updatedAt: "2026-06-27T10:00:00.000Z",
};

const SPEC_CONTENT = `---
afx: true
type: SPEC
status: Living
---

<!-- AFX control comment -->
# Checkout Redesign PRD

## Overview

Make checkout decisions easy to read before implementation starts.

## Goals [FR-1]

@see docs/specs/checkout-redesign/spec.md [FR-1]

| Metric | Target |
| --- | --- |
| Completion | 95% |
`;

const DESIGN_CONTENT = `# Checkout Redesign Design

## Architecture

Keep the document in a readable paper measure even when the bottom panel is narrow.
`;

const TASKS_CONTENT = `# Checkout Redesign Tasks

## Phase 1: Reader polish

### 1.1 Render decision-ready spec

- [x] Render decision-ready spec

### 1.2 Verify compact bottom panel

- [ ] Verify compact bottom panel

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-25 | 1.2 | Coded | apps/workbench/src/views/workbench.tsx | [x] | [ ] |
`;

function dispatchDocContent(filePath: string, content: string) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "afxDocContent", filePath, content },
      }),
    );
  });
}

function renderWorkbench(initialState?: Partial<WorkbenchState>) {
  return render(
    <WorkbenchProvider
      initialState={{
        isLoading: false,
        pipeline: [PIPELINE_ROW],
        featureTasks: [FEATURE_TASKS],
        selectedFeature: PIPELINE_ROW.name,
        ...initialState,
      }}
    >
      <Workbench />
    </WorkbenchProvider>,
  );
}

function switchToCompare() {
  fireEvent.click(screen.getByRole("button", { name: "Compare docs" }));
}

describe("Workbench", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    postMessage.mockRestore();
    _resetBridgeForTest();
  });

  it("renders contextual document actions and sends chat commands", async () => {
    renderWorkbench();
    switchToCompare();
    dispatchDocContent(PIPELINE_ROW.specPath!, SPEC_CONTENT);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Checkout Redesign PRD" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine spec" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-spec refine checkout-redesign",
        mode: "insert",
      },
      "*",
    );
  });

  it("opens with a real SDD Studio cockpit and keeps document actions in compare mode", async () => {
    renderWorkbench();

    const cockpit = screen.getByTestId("sdd-studio-cockpit");
    expect(cockpit).toBeInTheDocument();
    expect(screen.getAllByText("Checkout Redesign").length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar", { name: "Feature progress" })).toBeInTheDocument();
    const featurePicker = screen.getByRole("button", { name: "Select SDD feature" });
    expect(featurePicker).toHaveTextContent("Checkout Redesign");
    expect(featurePicker).not.toHaveTextContent("3/5");
    expect(screen.getByTestId("sdd-feature-summary")).toHaveTextContent("Status");
    expect(screen.getByTestId("sdd-feature-summary")).toHaveTextContent("Living");
    expect(screen.getByTestId("sdd-feature-summary")).toHaveTextContent("Tasks");
    expect(screen.getByTestId("sdd-feature-summary")).toHaveTextContent("1/2");
    expect(screen.getByText("View mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(cockpit).getByText("Next work")).toBeInTheDocument();
    expect(within(cockpit).getByText("Needs attention")).toBeInTheDocument();
    expect(within(cockpit).getByTestId("sdd-coach-signal-queue")).toBeInTheDocument();
    expect(
      within(cockpit).getByRole("list", { name: "SDD workflow sequence" }),
    ).toBeInTheDocument();
    expect(within(cockpit).getByTestId("sdd-workflow-step-spec")).toHaveTextContent("1");
    expect(within(cockpit).getByTestId("sdd-workflow-step-design")).toHaveTextContent("2");
    expect(within(cockpit).getByTestId("sdd-workflow-step-tasks")).toHaveTextContent("3");
    expect(
      within(cockpit).getByRole("button", { name: "Spec workflow step 1: Living" }),
    ).toHaveClass("w-full");
    expect(within(cockpit).getByText("Role modes")).toBeInTheDocument();
    expect(within(cockpit).getByText("Active docs")).toBeInTheDocument();
    expect(
      within(cockpit).getByText("Open the artifact that matches the role you are playing."),
    ).toBeInTheDocument();
    expect(
      within(cockpit).getByText("Coach uses this to refine problem, users, and outcomes."),
    ).toBeInTheDocument();
    expect(within(cockpit).getByText("Coach surface · Living")).toBeInTheDocument();
    expect(
      within(cockpit).getByRole("button", { name: "Focus Spec for Coach" }),
    ).toBeInTheDocument();
    expect(within(cockpit).getByRole("button", { name: /^Coach\b/ })).toBeInTheDocument();
    expect(within(cockpit).getByRole("button", { name: /^Architect\b/ })).toBeInTheDocument();
    expect(within(cockpit).getByRole("button", { name: /^Dev\b/ })).toBeInTheDocument();
    expect(within(cockpit).getByRole("button", { name: /^Ship\b/ })).toBeInTheDocument();
    expect(screen.queryByTestId("workbench-column-toggles")).not.toBeInTheDocument();

    fireEvent.click(within(cockpit).getAllByRole("button", { name: "Review design" })[0]);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-design review checkout-redesign",
        mode: "insert",
      },
      "*",
    );
    expect(screen.getByTestId("sdd-studio-focus")).toBeInTheDocument();
    expect(screen.getByText("docs/specs/checkout-redesign/design.md")).toBeInTheDocument();

    switchToCompare();
    expect(screen.getByTestId("workbench-column-toggles")).toHaveAccessibleName(
      "Show or hide SDD Studio compare documents",
    );
    expect(screen.getByRole("button", { name: "Hide Spec document column" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Design document column" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide Tasks document column" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Sessions document column" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New spec" })).not.toBeInTheDocument();

    dispatchDocContent(PIPELINE_ROW.specPath!, SPEC_CONTENT);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Checkout Redesign PRD" })).toBeInTheDocument();
    });
    const specColumn = screen.getByTestId("workbench-column-spec");
    fireEvent.click(within(specColumn).getByRole("button", { name: "Refine spec" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-spec refine checkout-redesign",
        mode: "insert",
      },
      "*",
    );
  });

  it("does not flag an Open Questions table when every row is resolved", () => {
    const completeTasks: FeatureTasksData = {
      ...FEATURE_TASKS,
      completed: 2,
      total: 2,
      workSessions: [
        {
          date: "2026-06-04T11:03:56.000Z",
          task: "1.1",
          action: "Verified",
          filesModified: "spec.md",
          agent: true,
          human: true,
        },
      ],
    };
    renderWorkbench({
      pipeline: [
        {
          ...PIPELINE_ROW,
          designStatus: "Living",
          tasksStatus: "Complete",
          completed: 2,
          total: 2,
          featureStatus: "Complete",
        },
      ],
      featureTasks: [completeTasks],
    });

    dispatchDocContent(
      PIPELINE_ROW.specPath!,
      `${SPEC_CONTENT}\n## Open Questions\n\n| # | Question | Status |\n| --- | --- | --- |\n| 1 | Storage path | Resolved |`,
    );

    const queue = screen.getByTestId("sdd-coach-signal-queue");
    expect(within(queue).getByText("All clear")).toBeInTheDocument();
    expect(within(queue).queryByText("Questions to resolve")).not.toBeInTheDocument();
  });

  it("flags an Open Questions table when a row remains open", () => {
    renderWorkbench();
    dispatchDocContent(
      PIPELINE_ROW.specPath!,
      `${SPEC_CONTENT}\n## Open Questions\n\n| # | Question | Status |\n| --- | --- | --- |\n| 1 | Storage path | Open |`,
    );

    expect(
      within(screen.getByTestId("sdd-coach-signal-queue")).getByText("Questions to resolve"),
    ).toBeInTheDocument();
  });

  it("opens the SDD feature picker and switches features", async () => {
    const user = userEvent.setup();
    renderWorkbench({
      pipeline: [PIPELINE_ROW, BRANDING_PIPELINE_ROW],
      featureTasks: [FEATURE_TASKS, BRANDING_TASKS],
    });

    const picker = screen.getByRole("button", { name: "Select SDD feature" });
    expect(picker).toHaveAttribute("aria-expanded", "false");

    await user.click(picker);

    const listbox = screen.getByRole("listbox", { name: "Select SDD feature" });
    expect(picker).toHaveAttribute("aria-expanded", "true");
    expect(within(listbox).getByRole("option", { name: /Checkout Redesign/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(within(listbox).getByRole("option", { name: /Branding/i }));

    expect(screen.queryByRole("listbox", { name: "Select SDD feature" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select SDD feature" })).toHaveTextContent(
      "Branding",
    );
    expect(screen.getByTestId("sdd-feature-summary")).toHaveTextContent("12/37");
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxSelectFeature",
        name: "branding",
      },
      "*",
    );
    expect(window.localStorage.getItem("afx.workbench.selectedFeature.v1")).toBe("branding");
    expect(window.localStorage.getItem("afx.workbench.recentFeatures.v1")).toContain("branding");
  });

  it("restores the last selected feature when the workbench remounts", () => {
    window.localStorage.setItem("afx.workbench.selectedFeature.v1", "branding");

    render(
      <WorkbenchProvider
        initialState={{
          isLoading: false,
          pipeline: [PIPELINE_ROW, BRANDING_PIPELINE_ROW],
          featureTasks: [FEATURE_TASKS, BRANDING_TASKS],
        }}
      >
        <Workbench />
      </WorkbenchProvider>,
    );

    expect(screen.getByRole("button", { name: "Select SDD feature" })).toHaveTextContent(
      "Branding",
    );
  });

  it("shows recently modified specs beside the feature picker", async () => {
    const user = userEvent.setup();
    renderWorkbench({
      pipeline: [PIPELINE_ROW, BRANDING_PIPELINE_ROW],
      featureTasks: [FEATURE_TASKS, BRANDING_TASKS],
      documents: [BRANDING_SPEC_DOC],
    });

    await user.click(screen.getByRole("button", { name: "Select SDD feature" }));
    const listbox = screen.getByRole("listbox", { name: "Select SDD feature" });

    expect(within(listbox).getByText("Recent specs")).toBeInTheDocument();

    await user.click(within(listbox).getByRole("button", { name: /Open recent spec Branding/i }));

    expect(screen.getByRole("button", { name: "Select SDD feature" })).toHaveTextContent(
      "Branding",
    );
  });

  it("filters the SDD feature picker when the workspace has many features", async () => {
    const user = userEvent.setup();
    const extraRows: PipelineRow[] = Array.from({ length: 5 }, (_, index) => {
      const name = `release-track-${index + 1}`;
      return {
        name,
        specStatus: "Draft",
        designStatus: "Draft",
        tasksStatus: "Draft",
        completed: index,
        total: 10,
        featureStatus: "Draft",
        specPath: `docs/specs/${name}/spec.md`,
        designPath: `docs/specs/${name}/design.md`,
        tasksPath: `docs/specs/${name}/tasks.md`,
      };
    });
    renderWorkbench({
      pipeline: [PIPELINE_ROW, BRANDING_PIPELINE_ROW, ...extraRows],
      featureTasks: [FEATURE_TASKS, BRANDING_TASKS],
    });

    await user.click(screen.getByRole("button", { name: "Select SDD feature" }));
    const listbox = screen.getByRole("listbox", { name: "Select SDD feature" });
    const search = within(listbox).getByLabelText("Filter SDD features");

    await user.type(search, "brand");

    expect(within(listbox).getByRole("option", { name: /Branding/i })).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: /Checkout Redesign/i }),
    ).not.toBeInTheDocument();

    await user.click(within(listbox).getByRole("option", { name: /Branding/i }));

    expect(screen.getByRole("button", { name: "Select SDD feature" })).toHaveTextContent(
      "Branding",
    );
  });

  it("drafts a surgical coding command from a task phase", async () => {
    renderWorkbench();
    switchToCompare();
    dispatchDocContent(PIPELINE_ROW.tasksPath!, TASKS_CONTENT);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Code Phase 1: Reader polish" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Code Phase 1: Reader polish" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-task code checkout-redesign#1.2 phase 1 Reader polish",
        mode: "insert",
      },
      "*",
    );
  });

  it("opens a Workbench column in the editor-area AFX preview", async () => {
    renderWorkbench();
    switchToCompare();

    const [specAfxPreview] = screen.getAllByRole("button", { name: "Open in AFX Preview" });
    if (!specAfxPreview) {
      throw new Error("Expected the SPEC column to expose an AFX Preview action.");
    }
    fireEvent.click(specAfxPreview);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenFile",
        path: PIPELINE_ROW.specPath,
        mode: "afxPreview",
      },
      "*",
    );
  });

  it("copies Workbench column markdown source", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderWorkbench();
    switchToCompare();
    dispatchDocContent(PIPELINE_ROW.specPath!, SPEC_CONTENT);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Checkout Redesign PRD" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Copy SPEC markdown source" }));

    expect(writeText).toHaveBeenCalledWith(SPEC_CONTENT);
  });

  it("renders tasks through the shared document renderer and toggles source checkboxes", async () => {
    renderWorkbench();
    switchToCompare();
    dispatchDocContent(PIPELINE_ROW.tasksPath!, TASKS_CONTENT);

    const taskCheckbox = await screen.findByRole("checkbox", {
      name: "Toggle task checkbox on line 11",
    });
    fireEvent.click(taskCheckbox);

    expect(screen.getByRole("heading", { name: "Checkout Redesign Tasks" })).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxToggleTask",
        path: PIPELINE_ROW.tasksPath,
        line: 11,
        completed: true,
      },
      "*",
    );
  });

  it("renders Work Sessions through the shared markdown table renderer", async () => {
    renderWorkbench();
    switchToCompare();
    dispatchDocContent(PIPELINE_ROW.tasksPath!, TASKS_CONTENT);

    fireEvent.click(screen.getByRole("button", { name: "Show Sessions document column" }));

    const signoffs = await screen.findAllByRole("checkbox", {
      name: "Toggle human signoff row 1",
    });
    const human = signoffs[signoffs.length - 1];
    if (!human) throw new Error("Expected a rendered Work Sessions human signoff checkbox.");

    expect(screen.queryByRole("cell", { name: "[ ]" })).not.toBeInTheDocument();
    fireEvent.click(human);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxToggleSession",
        filePath: PIPELINE_ROW.tasksPath,
        sessionIndex: 0,
        column: "human",
        completed: true,
        line: 17,
      },
      "*",
    );
  });

  it("renders spec and design as clean paper readers", async () => {
    renderWorkbench();
    switchToCompare();

    dispatchDocContent(PIPELINE_ROW.specPath!, SPEC_CONTENT);
    dispatchDocContent(PIPELINE_ROW.designPath!, DESIGN_CONTENT);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Checkout Redesign PRD" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Checkout Redesign Design" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Checkout Redesign PRD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText(/AFX control comment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@see docs/i)).not.toBeInTheDocument();
    expect(screen.queryByText("[FR-1]")).not.toBeInTheDocument();
    expect(screen.queryByText("PRD Studio")).not.toBeInTheDocument();
  });

  it("keeps columns readable with an internal resizable horizontal rail", () => {
    renderWorkbench();
    switchToCompare();

    const region = screen.getByTestId("workbench-column-region");
    const rail = screen.getByTestId("workbench-column-rail");
    const specColumn = screen.getByTestId("workbench-column-spec");

    expect(region).toContainElement(rail);
    expect(specColumn.style.flexBasis).toBe("420px");

    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize SPEC column" }), {
      key: "ArrowRight",
    });

    expect(specColumn.style.flexBasis).toBe("452px");
  });

  it("labels column controls as show/hide document toggles", () => {
    renderWorkbench();
    switchToCompare();

    expect(screen.getByTestId("workbench-column-toggles")).toHaveAccessibleName(
      "Show or hide SDD Studio compare documents",
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide Spec document column" }));

    expect(screen.getByRole("button", { name: "Show Spec document column" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
