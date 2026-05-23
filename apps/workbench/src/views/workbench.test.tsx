/**
 * Workbench thinking-desk tests.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS] [DES-TEST]
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FeatureTasksData, PipelineRow } from "@afx/shared";

import { WorkbenchProvider } from "../context/workbench-context";
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

function renderWorkbench() {
  return render(
    <WorkbenchProvider
      initialState={{
        isLoading: false,
        pipeline: [PIPELINE_ROW],
        featureTasks: [FEATURE_TASKS],
        selectedFeature: PIPELINE_ROW.name,
      }}
    >
      <Workbench />
    </WorkbenchProvider>,
  );
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

  it("drafts a surgical coding command from a task phase", async () => {
    renderWorkbench();
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
    dispatchDocContent(PIPELINE_ROW.specPath!, SPEC_CONTENT);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Checkout Redesign PRD" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Copy SPEC markdown source" }));

    expect(writeText).toHaveBeenCalledWith(SPEC_CONTENT);
  });

  it("renders tasks through the shared document renderer and toggles source checkboxes", async () => {
    renderWorkbench();
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
    dispatchDocContent(PIPELINE_ROW.tasksPath!, TASKS_CONTENT);

    fireEvent.click(screen.getByRole("button", { name: "Show SESSIONS document column" }));

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

    expect(screen.getByTestId("workbench-column-toggles")).toHaveAccessibleName(
      "Show or hide Workbench document columns",
    );
    expect(screen.getByText("Show/hide docs")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide SPEC document column" }));

    expect(screen.getByRole("button", { name: "Show SPEC document column" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
