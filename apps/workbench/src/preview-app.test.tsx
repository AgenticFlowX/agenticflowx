/**
 * PreviewApp standalone preview-mode tests — full AFX render vs generic degrade.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-15]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-PREVIEW-MODE]
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetBridgeForTest, initWorkbenchBridge } from "./lib/bridge";
import { slugify } from "./lib/document-outline";
import { AFX_PREVIEW_FIXTURES, GENERIC_PREVIEW_FIXTURES } from "./lib/preview-fixtures.test-data";
import { PreviewApp } from "./preview-app";

const AFX_CONTENT = `---
afx: true
type: SPEC
status: Draft
owner: "@rix"
---
# User Authentication
## Overview
Body text for the spec preview.
`;

const GENERIC_CONTENT = `# My Project
Some intro text rendered nicely.
`;

const TASKS_CONTENT = `---
afx: true
type: TASKS
status: Draft
owner: "@rix"
---
# Checkout Tasks

## Phase 1: Reader polish

### 1.1 Finished task

- [x] Already done

### 1.2 Wire preview actions

- [ ] Add task action buttons
- [ ] Verify command routing
`;

const SPRINT_CONTENT = `---
afx: true
type: SPRINT
status: Approved
owner: "@rix"
approval:
  spec: Approved
  design: Approved
  tasks: Approved
---
# Checkout Sprint

<!-- SPRINT-SECTION-START: SPEC -->

## 1. Spec

### Requirements

- Keep the preview useful.

<!-- SPRINT-SECTION-END: SPEC -->

<!-- SPRINT-SECTION-START: DESIGN -->

## 2. Design

### [DES-UI] UI

- Put actions near the section they affect.

<!-- SPRINT-SECTION-END: DESIGN -->

<!-- SPRINT-SECTION-START: TASKS -->

## 3. Tasks

### Phase 1: Reader polish

#### 1.1 Finished task

- [x] Already done

#### 1.2 Wire preview actions

- [ ] Add sprint task action buttons
- [ ] Verify command routing

<!-- SPRINT-SECTION-END: TASKS -->

<!-- SPRINT-SECTION-START: SESSIONS -->

## 4. Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |

| 2026-04-28 | 1.2 | Completed | apps/workbench/src/lib/markdown-render.tsx | [x] | [] |
| 2026-04-29 | 1.3 | Reviewed | apps/workbench/src/components/doc-preview.tsx | [ ] | [ ] |

<!-- SPRINT-SECTION-END: SESSIONS -->
`;

function postPreview(filePath: string, content: string, isAfxHint?: boolean) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "afxPreviewShow", filePath, content, isAfxHint },
      }),
    );
  });
}

const RAIL_COLLAPSED_KEY = "afx.workbench.preview.outlineCollapsed.v2";

describe("PreviewApp", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    _resetBridgeForTest();
  });

  it("renders the full DocumentStudio preview for AFX frontmatter", async () => {
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    // Full-mode markers: the quality-pulse rail + the reading-first title.
    await waitFor(() => {
      expect(screen.getByText("Quality pulse")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "User Authentication" }),
    ).toBeInTheDocument();
  });

  it("copies the raw preview markdown source", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy markdown source" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Copy markdown source" }));

    expect(writeText).toHaveBeenCalledWith(AFX_CONTENT);
  });

  it("renders task-scoped code buttons for standard tasks documents", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/checkout-redesign/tasks.md", TASKS_CONTENT, true);

    const codeTask = await screen.findByRole("button", {
      name: "Code 1.2: Wire preview actions",
    });
    expect(
      screen.queryByRole("button", { name: "Code 1.1: Finished task" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Code task 1.2: Wire preview actions",
      }),
    ).toBeInTheDocument();

    fireEvent.click(codeTask);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-task code checkout-redesign#1.2",
        mode: "insert",
      },
      "*",
    );
    postMessage.mockRestore();
  });

  it("toggles markdown task checkboxes through the preview bridge", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/checkout-redesign/tasks.md", TASKS_CONTENT, true);

    const checkbox = await screen.findByRole("checkbox", {
      name: "Toggle task checkbox on line 17",
    });
    fireEvent.click(checkbox);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxToggleTask",
        path: "docs/specs/checkout-redesign/tasks.md",
        line: 17,
        completed: true,
      },
      "*",
    );
    postMessage.mockRestore();
  });

  it("renders sprint section controls and per-task sprint code buttons", async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/checkout-redesign/checkout-redesign.md", SPRINT_CONTENT, true);

    expect(await screen.findByRole("button", { name: "Refine spec: Draft" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tasks command menu" }));
    expect(screen.getByRole("menuitem", { name: /Approve tasks/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("cell", { name: "1.2" })).toBeInTheDocument();

    const codeTask = screen.getByRole("button", { name: "Code 1.2: Wire preview actions" });
    expect(
      screen.queryByRole("button", { name: "Code 1.1: Finished task" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Code task 1.2: Wire preview actions",
      }),
    ).toBeInTheDocument();
    fireEvent.click(codeTask);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxOpenChatCommand",
        command: "/afx-sprint code checkout-redesign 1.2",
        mode: "insert",
      },
      "*",
    );
    postMessage.mockRestore();
  });

  it("toggles Work Sessions checkboxes through the preview bridge", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/checkout-redesign/checkout-redesign.md", SPRINT_CONTENT, true);

    const checkbox = await screen.findByRole("checkbox", {
      name: "Toggle human signoff row 1",
    });
    fireEvent.click(checkbox);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxToggleSession",
        filePath: "docs/specs/checkout-redesign/checkout-redesign.md",
        sessionIndex: 0,
        column: "human",
        completed: true,
        line: expect.any(Number),
      },
      "*",
    );
    postMessage.mockRestore();
  });

  it("sends Work Sessions bulk signoff toolbar actions through the preview bridge", async () => {
    const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/checkout-redesign/checkout-redesign.md", SPRINT_CONTENT, true);

    const agentAll = await screen.findByRole("button", {
      name: "Select all Agent signoff checkboxes",
    });
    fireEvent.click(agentAll);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxToggleAllSessions",
        filePath: "docs/specs/checkout-redesign/checkout-redesign.md",
        column: "agent",
        completed: true,
      },
      "*",
    );

    const approve = screen.getByRole("button", { name: "Approve Work Sessions" });
    fireEvent.click(approve);

    expect(postMessage).toHaveBeenCalledWith(
      {
        type: "afxApproveSessions",
        filePath: "docs/specs/checkout-redesign/checkout-redesign.md",
      },
      "*",
    );
    postMessage.mockRestore();
  });

  it("renders MinimalMarkdown only (generic mode) for non-AFX markdown", async () => {
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("README.md", GENERIC_CONTENT, false);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "My Project" })).toBeInTheDocument();
    });
    // Generic mode must NOT render the full-mode rails.
    expect(screen.queryByText("Quality pulse")).not.toBeInTheDocument();
    expect(screen.queryByText("Outline")).not.toBeInTheDocument();
  });

  for (const fixture of AFX_PREVIEW_FIXTURES) {
    it(`renders sanitized full AFX fixture: ${fixture.id}`, async () => {
      initWorkbenchBridge();
      render(<PreviewApp />);
      postPreview(fixture.filePath, fixture.content, fixture.isAfxHint);

      await waitFor(() => {
        expect(screen.getByText("Quality pulse")).toBeInTheDocument();
      });
      expect(screen.getByRole("heading", { level: 1, name: fixture.title })).toBeInTheDocument();
      for (const text of fixture.requiredText) {
        expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
      }
      if (fixture.tableCell) {
        expect(screen.getAllByRole("cell", { name: fixture.tableCell }).length).toBeGreaterThan(0);
      }
      if (fixture.rawTextAbsent) {
        expect(screen.queryByText(fixture.rawTextAbsent)).not.toBeInTheDocument();
      }
    });
  }

  for (const fixture of GENERIC_PREVIEW_FIXTURES) {
    it(`renders sanitized generic markdown fixture: ${fixture.id}`, async () => {
      initWorkbenchBridge();
      render(<PreviewApp />);
      postPreview(fixture.filePath, fixture.content, fixture.isAfxHint);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: fixture.title })).toBeInTheDocument();
      });
      expect(screen.queryByText("Quality pulse")).not.toBeInTheDocument();
      for (const text of fixture.requiredText) {
        expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
      }
      if (fixture.tableCell) {
        expect(screen.getAllByRole("cell", { name: fixture.tableCell }).length).toBeGreaterThan(0);
      }
    });
  }

  it("collapses and re-expands the outline and persists the choice", async () => {
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    await waitFor(() => {
      expect(screen.getByText("Quality pulse")).toBeInTheDocument();
    });
    expect(document.querySelector('[data-afx-preview-outline="rail"]')).not.toBeNull();

    // Collapse hides the persistent rail. Small previews keep outline minimized in a popover.
    fireEvent.click(screen.getByRole("button", { name: "Hide outline" }));
    expect(screen.queryByText("Quality pulse")).not.toBeInTheDocument();
    expect(document.querySelector("[data-afx-preview-outline]")).toBeNull();
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));
    expect(screen.getByText("Quality pulse")).toBeInTheDocument();
    expect(document.querySelector('[data-afx-preview-outline="rail"]')).not.toBeNull();
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe("0");
  });

  it("defaults to collapsed when localStorage flag is set", async () => {
    localStorage.setItem(RAIL_COLLAPSED_KEY, "1");
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show outline" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Quality pulse")).not.toBeInTheDocument();
    expect(document.querySelector("[data-afx-preview-outline]")).toBeNull();
  });

  it("scrolls the matching heading into view when an outline item is clicked", async () => {
    // jsdom does not implement scrollIntoView — install a spy on the prototype.
    const scrollSpy = vi.fn();
    const original = (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;

    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    await waitFor(() => {
      expect(screen.getByText("Quality pulse")).toBeInTheDocument();
    });

    // The rendered Overview heading carries the outline slug as its id.
    const slug = slugify("Overview");
    const heading = document.getElementById(slug);
    expect(heading).not.toBeNull();
    expect(heading?.tagName.toLowerCase()).toBe("h2");

    // Click the matching outline button inside the desktop rail.
    const rail = document.querySelector('[data-afx-preview-outline="rail"]');
    expect(rail).not.toBeNull();
    fireEvent.click(within(rail as HTMLElement).getByRole("button", { name: "Overview" }));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(scrollSpy.mock.instances[0]).toBe(heading);

    if (original === undefined) {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    } else {
      Element.prototype.scrollIntoView = original as typeof Element.prototype.scrollIntoView;
    }
  });

  it("reading options change width + tone and persist", async () => {
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    await waitFor(() => {
      expect(screen.getByText("Quality pulse")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reading options" }));
    fireEvent.click(await screen.findByText("Wide"));
    fireEvent.click(screen.getByText("Warm"));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("afx.workbench.preview.reading") ?? "{}");
      expect(saved.width).toBe("wide");
      expect(saved.tone).toBe("warm");
    });
    // Warm tone paints the sheet with the cream paper class.
    expect(document.querySelector(".afx-paper--warm")).not.toBeNull();
  });

  it("focus mode hides the toolbar + rail and Exit focus restores them", async () => {
    initWorkbenchBridge();
    render(<PreviewApp />);
    postPreview("docs/specs/user-auth/spec.md", AFX_CONTENT, true);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reading options" })).toBeInTheDocument();
    });
    expect(screen.getByText("Quality pulse")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Focus mode" }));

    // Toolbar (reading options) + rail (quality pulse) are gone in focus mode.
    expect(screen.queryByRole("button", { name: "Reading options" })).not.toBeInTheDocument();
    expect(screen.queryByText("Quality pulse")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }));
    expect(screen.getByRole("button", { name: "Reading options" })).toBeInTheDocument();
    expect(screen.getByText("Quality pulse")).toBeInTheDocument();
  });
});
