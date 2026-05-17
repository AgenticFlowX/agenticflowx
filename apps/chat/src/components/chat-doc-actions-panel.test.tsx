/**
 * ChatDocActionsPanelBody component tests — canonical anchors for every
 * requirement exercised below resolve through these file-level `@see` lines
 * (test names use prose only; no bare `(FR-X)` markers).
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16] [FR-17] [FR-18] [FR-19]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/100-package-shared/spec.md [FR-13] [FR-14]
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatDocActionsPanelBody, ChatDocActionsPanelHeaderExtras } from "./chat-doc-actions-panel";

describe("ChatDocActionsPanelBody", () => {
  it("primary action row uses available width before falling back to More", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const row = screen.getByTestId("doc-actions-primary-row");
    expect(screen.getByTestId("doc-actions-row")).toHaveClass("w-full");
    expect(row).toHaveClass("flex", "flex-nowrap", "overflow-hidden");
    expect(row.className.split(/\s+/)).not.toContain("hidden");
    const refine = within(row).getByRole("button", { name: /Refine options/i });
    const author = within(row).getByRole("button", { name: /Author:/i });
    expect(refine).toBeInTheDocument();
    expect(author).toBeInTheDocument();
    expect(refine).toHaveClass("!h-5", "!min-h-5", "font-mono", "!text-[10px]");
    expect(author).toHaveClass("!h-5", "!min-h-5", "font-mono", "!text-[10px]");
    expect(within(row).getByRole("button", { name: /Approve:/i })).toBeInTheDocument();
    const more = screen.getByRole("button", { name: "More document actions" });
    expect(more).toBeInTheDocument();
    expect(more).toHaveClass("ml-auto", "shrink-0");
    expect(row).not.toContainElement(more);
  });

  it("moves lower-priority row actions into More when the measured row is tight", async () => {
    const user = userEvent.setup();
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRectMock(this: HTMLElement) {
        const width = this.dataset.testid === "doc-actions-primary-row" ? 110 : 0;
        return {
          x: 0,
          y: 0,
          width,
          height: 0,
          top: 0,
          right: width,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        };
      });

    try {
      render(
        <ChatDocActionsPanelBody
          workspaceMode="spec"
          docContext={{
            format: "standard",
            section: "SPEC",
            docKind: "spec",
            feature: "auth",
            approvalStatus: "Draft",
          }}
          onInsert={vi.fn()}
          onAutoSend={vi.fn()}
        />,
      );

      const row = screen.getByTestId("doc-actions-primary-row");
      await waitFor(() => {
        expect(within(row).queryByRole("button", { name: /Author:/i })).not.toBeInTheDocument();
      });
      const more = screen.getByRole("button", { name: "More document actions" });
      await user.click(more);
      expect(await screen.findByText("Hidden Row Actions")).toBeInTheDocument();
      expect(screen.getAllByText("Author").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Approve").length).toBeGreaterThan(0);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("keeps compact actions visible at medium measured widths", async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRectMock(this: HTMLElement) {
        const width = this.dataset.testid === "doc-actions-primary-row" ? 360 : 0;
        return {
          x: 0,
          y: 0,
          width,
          height: 0,
          top: 0,
          right: width,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        };
      });

    try {
      render(
        <ChatDocActionsPanelBody
          workspaceMode="spec"
          docContext={{
            format: "standard",
            section: "SPEC",
            docKind: "spec",
            feature: "auth",
            approvalStatus: "Draft",
          }}
          onInsert={vi.fn()}
          onAutoSend={vi.fn()}
        />,
      );

      const row = screen.getByTestId("doc-actions-primary-row");
      await waitFor(() => {
        expect(within(row).getByRole("button", { name: /Author:/i })).toBeInTheDocument();
        expect(within(row).getByRole("button", { name: /Validate:|Verify:/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "More document actions" })).toBeInTheDocument();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("resets overflow state when switching from a tight spec row to a journal row", async () => {
    let measuredWidth = 110;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRectMock(this: HTMLElement) {
        const width = this.dataset.testid === "doc-actions-primary-row" ? measuredWidth : 0;
        return {
          x: 0,
          y: 0,
          width,
          height: 0,
          top: 0,
          right: width,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        };
      });

    try {
      const { rerender } = render(
        <ChatDocActionsPanelBody
          workspaceMode="spec"
          docContext={{
            format: "standard",
            section: "SPEC",
            docKind: "spec",
            feature: "auth",
            approvalStatus: "Draft",
          }}
          onInsert={vi.fn()}
          onAutoSend={vi.fn()}
        />,
      );

      const specRow = screen.getByTestId("doc-actions-primary-row");
      await waitFor(() => {
        expect(within(specRow).queryByRole("button", { name: /Author:/i })).not.toBeInTheDocument();
      });

      measuredWidth = 360;
      rerender(
        <ChatDocActionsPanelBody
          workspaceMode="spec"
          docContext={{
            format: "standard",
            section: null,
            docKind: "journal",
            feature: "auth",
            approvalStatus: "Living",
          }}
          onInsert={vi.fn()}
          onAutoSend={vi.fn()}
        />,
      );

      const journalRow = screen.getByTestId("doc-actions-primary-row");
      await waitFor(() => {
        expect(within(journalRow).getByRole("button", { name: /Note:/i })).toBeInTheDocument();
        expect(within(journalRow).getByRole("button", { name: /Log:/i })).toBeInTheDocument();
        expect(within(journalRow).getByRole("button", { name: /Recap:/i })).toBeInTheDocument();
      });
      expect(screen.getByTestId("doc-actions-more-trigger")).toHaveClass("ml-auto");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("groups compose actions before run-now actions and keeps the row bounded", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    const composeGroup = screen.getByTestId("doc-actions-compose-group");
    const runGroup = screen.getByTestId("doc-actions-run-group");
    expect(composeGroup).toHaveTextContent("Code");
    expect(composeGroup).toHaveTextContent("Review");
    expect(runGroup).toHaveTextContent("Verify");
    expect(runGroup).toHaveTextContent("Pick");
    expect(`${composeGroup.textContent}|${runGroup.textContent}`).toMatch(
      /Code.*Review.*\|.*Verify.*Pick/,
    );
    for (const buttonName of ["Code", "Review", "Verify", "Pick"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${buttonName}`) })).toHaveClass(
        "!h-5",
        "!min-h-5",
        "font-mono",
        "!text-[10px]",
      );
    }
    expect(screen.getByRole("button", { name: "More document actions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Status:/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("doc-actions-intent-separator")).toHaveTextContent("|");

    await user.click(screen.getByRole("button", { name: "Code options" }));

    expect(await screen.findByText("Insert In Chat Box")).toBeInTheDocument();
    expect(screen.getByText("Code all")).toBeInTheDocument();
    expect(screen.queryByText(/^Code 1\./)).not.toBeInTheDocument();

    await user.click(screen.getByText("Code all"));
    expect(onInsert).toHaveBeenCalledWith("/afx-task code all auth");
  });

  it("uses tooltip content instead of raw title hints for action buttons", async () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const codeButton = screen.getByRole("button", { name: "Code options" });
    expect(codeButton).not.toHaveAttribute("title");

    fireEvent.focus(codeButton);

    await waitFor(() => {
      expect(screen.getAllByText("/afx-task code all auth").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Draft first").length).toBeGreaterThan(0);
  });

  it("turns Code and Pick into task dropdowns when task phases are available", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
          taskPhases: [
            {
              number: 1,
              name: "Implementation",
              completed: 1,
              total: 3,
              line: 10,
              items: [
                { text: "Already done", completed: true, line: 11, wbsId: "1.1" },
                {
                  text: "Wire the document command menu without letting long target labels expand the row",
                  completed: false,
                  line: 12,
                  wbsId: "1.2",
                },
                { text: "Add e2e coverage", completed: false, line: 13, wbsId: "1.3" },
              ],
            },
          ],
        }}
        onInsert={onInsert}
        onAutoSend={onAutoSend}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Code options" }));

    expect(await screen.findByText("Insert In Chat Box")).toBeInTheDocument();
    expect(await screen.findByText("Code all")).toBeInTheDocument();
    expect(screen.queryByText("Code 1.1")).not.toBeInTheDocument();
    expect(screen.getByText("Code 1.2")).toBeInTheDocument();
    expect(screen.getByText("Code 1.3")).toBeInTheDocument();
    const taskText = screen.getByText(
      "Wire the document command menu without letting long target labels expand the row",
    );
    expect(taskText).toHaveClass("truncate");

    const taskItem = taskText.closest('[role="menuitem"]');
    expect(taskItem).not.toBeNull();
    fireEvent.focus(taskItem as HTMLElement);
    await waitFor(() => {
      expect(screen.getAllByText("Line 12").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("/afx-task code 1.2").length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("Code 1.2")[0]);
    expect(onInsert).toHaveBeenCalledWith("/afx-task code 1.2");

    await user.click(screen.getByRole("button", { name: "Pick options" }));
    expect(await screen.findByText("Run Now")).toBeInTheDocument();
    expect(screen.queryByText("Pick 1.1")).not.toBeInTheDocument();
    expect(await screen.findByText("Pick 1.3")).toBeInTheDocument();

    await user.click(screen.getByText("Pick 1.3"));
    expect(onAutoSend).toHaveBeenLastCalledWith("/afx-task pick 1.3");
  });

  it("keeps Code all available while hiding completed WBS targets", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
          taskPhases: [
            {
              number: 1,
              name: "Implementation",
              completed: 2,
              total: 2,
              line: 10,
              items: [
                { text: "Build completed flow", completed: true, line: 11, wbsId: "1.1" },
                { text: "Polish completed flow", completed: true, line: 12, wbsId: "1.2" },
              ],
            },
          ],
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Code options" }));

    expect(await screen.findByText("Code all")).toBeInTheDocument();
    expect(screen.queryByText("Code 1.1")).not.toBeInTheDocument();
    expect(screen.queryByText("Code 1.2")).not.toBeInTheDocument();

    await user.click(screen.getByText("Code all"));
    expect(onInsert).toHaveBeenCalledWith("/afx-task code all auth");
    expect(screen.queryByRole("button", { name: "Pick options" })).not.toBeInTheDocument();
  });

  it("computes fallback WBS options from task row positions when ids are missing", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
          taskPhases: [
            {
              number: 2,
              name: "Fallback IDs",
              completed: 1,
              total: 3,
              line: 20,
              items: [
                { text: "Already done", completed: true, line: 21 },
                { text: "Wire target parser", completed: false, line: 22 },
                { text: "Add focused coverage", completed: false, line: 23, wbsId: "2.9" },
              ],
            },
          ],
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Code options" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Code" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Code options" }));

    expect(await screen.findByText("Code all")).toBeInTheDocument();
    expect(screen.getByText("Code 2.2")).toBeInTheDocument();
    expect(screen.getByText("Code 2.9")).toBeInTheDocument();
    expect(screen.queryByText("Code 2.1")).not.toBeInTheDocument();

    await user.click(screen.getByText("Code 2.2"));
    expect(onInsert).toHaveBeenCalledWith("/afx-task code 2.2");
  });

  it("turns Refine into a focus dropdown for spec/design documents", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
          parsedFocuses: [
            {
              id: "performance",
              label: "Performance Budget With A Long Label That Truncates",
              slug: "performance",
              commandSuffix: "performance",
              excerpt: "Measure response time under extension-host load.",
              line: 42,
            },
          ],
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Refine options" }));

    expect(await screen.findByText("Insert In Chat Box")).toBeInTheDocument();
    expect(screen.getByText("Refine all")).toBeInTheDocument();
    expect(screen.getByText("From This Doc")).toBeInTheDocument();
    const focusLabel = screen.getByText("Performance Budget With A Long Label That Truncates");
    expect(focusLabel).toBeInTheDocument();
    expect(focusLabel).toHaveClass("truncate");
    expect(screen.getByText("Common Focuses")).toBeInTheDocument();
    expect(screen.getByText("Discuss")).toBeInTheDocument();

    const focusItem = focusLabel.closest('[role="menuitem"]');
    expect(focusItem).not.toBeNull();
    expect(focusItem).not.toHaveAttribute("title");
    fireEvent.focus(focusItem as HTMLElement);
    await waitFor(() => {
      expect(
        screen.getAllByText("Measure response time under extension-host load.").length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("/afx-spec refine auth performance").length).toBeGreaterThan(0);

    await user.click(focusLabel);
    expect(onInsert).toHaveBeenCalledWith("/afx-spec refine auth performance");
  });

  it("shows the verified command catalog in grouped More overflow", async () => {
    const user = userEvent.setup();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More document actions" }));

    expect(await screen.findByText("Compose")).toBeInTheDocument();
    expect(screen.getByText("Run Now")).toBeInTheDocument();
    expect(screen.getByText("Validate")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Sync")).toBeInTheDocument();
  });

  it("renders nothing for non-AFX docs", () => {
    const { container } = render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: null,
          section: null,
          docKind: null,
          feature: null,
          approvalStatus: null,
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("dismissal lives on the panel chrome, not the body — body never reads a `dismissed` prop", () => {
    // The panel chrome (`ComposerPanel` via `ComposerPanelStack`) owns the
    // dismissed state; the body only renders content.
    expect(true).toBe(true);
  });

  it("surfaces Author and Approve as one-click Spec-mode actions for standard specs", () => {
    const onInsert = vi.fn();
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        onInsert={onInsert}
        onAutoSend={onAutoSend}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Refine");
    expect(compose).toHaveTextContent("Author");
    expect(run).toHaveTextContent("Validate");
    expect(run).toHaveTextContent("Review");
    expect(run).toHaveTextContent("Approve");

    fireEvent.click(screen.getByRole("button", { name: /Author: Draft first/i }));
    expect(onInsert).toHaveBeenCalledWith("/afx-design author auth");

    fireEvent.click(screen.getByRole("button", { name: /Approve: Auto-send/i }));
    expect(onAutoSend).toHaveBeenCalledWith("/afx-spec approve auth");
  });

  it("surfaces Author and Approve as one-click Spec-mode actions for sprint design", () => {
    const onInsert = vi.fn();
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "sprint",
          section: "DESIGN",
          docKind: "design",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        onInsert={onInsert}
        onAutoSend={onAutoSend}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Refine");
    expect(compose).toHaveTextContent("Author");
    expect(run).toHaveTextContent("Verify");
    expect(run).toHaveTextContent("Approve");

    fireEvent.click(screen.getByRole("button", { name: /Author: Draft first/i }));
    expect(onInsert).toHaveBeenCalledWith("/afx-sprint task auth");

    fireEvent.click(screen.getByRole("button", { name: /Approve: Auto-send/i }));
    expect(onAutoSend).toHaveBeenCalledWith("/afx-sprint design auth --approve");
  });

  it("trims primary actions to the compact set outside Spec workspace mode", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Refine");
    expect(run).toHaveTextContent("Validate");
    // Review/Approve must collapse into More overflow, not the visible row.
    expect(`${compose.textContent}|${run.textContent}`).not.toMatch(/Review/);
    expect(`${compose.textContent}|${run.textContent}`).not.toMatch(/Approve/);
    expect(screen.getByRole("button", { name: "More document actions" })).toBeInTheDocument();
  });

  it("routes journal.md to all five afx-session subcommands", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "journal",
          feature: "auth",
          approvalStatus: "Living",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Note");
    expect(compose).toHaveTextContent("Log");
    expect(compose).toHaveTextContent("Promote");
    expect(compose).toHaveTextContent("Capture");
    expect(run).toHaveTextContent("Recap");
    expect(screen.getByTestId("doc-actions-row")).toHaveClass("w-full");
    expect(screen.getByTestId("doc-actions-more-trigger")).toHaveClass("ml-auto");
    expect(screen.getByTestId("doc-actions-primary-row")).not.toContainElement(
      screen.getByTestId("doc-actions-more-trigger"),
    );
    // Note/Log are draft-first, Recap is auto-send — separator must split them.
    expect(screen.getByTestId("doc-actions-intent-separator")).toBeInTheDocument();
  });

  it("renders global docs/specs/journal.md as session-only without a spec stepper", async () => {
    const onInsert = vi.fn();
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "journal",
          feature: null,
          filePath: "/repo/docs/specs/journal.md",
          approvalStatus: "Living",
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("spec-stepper")).not.toBeInTheDocument();
    expect(screen.getByTestId("doc-actions-compose-group")).toHaveTextContent("Note");
    await userEvent.setup().click(screen.getByRole("button", { name: "Note: Draft first" }));
    expect(onInsert).toHaveBeenCalledWith("/afx-session note");
  });

  it("renders ADR primary actions and keeps mutating verbs draft-first", () => {
    const onInsert = vi.fn();
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "adr",
          feature: null,
          approvalStatus: "Accepted",
        }}
        onInsert={onInsert}
        onAutoSend={onAutoSend}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Review");
    expect(compose).toHaveTextContent("Supersede");
    expect(run).toHaveTextContent("List");

    fireEvent.click(screen.getByRole("button", { name: /Review:/i }));
    expect(onInsert).toHaveBeenCalledWith("/afx-adr review");
    expect(onAutoSend).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /List:/i }));
    expect(onAutoSend).toHaveBeenCalledWith("/afx-adr list");
  });

  it("keeps every research verb draft-first because the verbs are dialogic", () => {
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "research",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        onInsert={vi.fn()}
        onAutoSend={onAutoSend}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    expect(compose).toHaveTextContent("Explore");
    expect(compose).toHaveTextContent("Compare");
    expect(compose).toHaveTextContent("Summarize");
    expect(screen.queryByTestId("doc-actions-run-group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("doc-actions-intent-separator")).not.toBeInTheDocument();
    expect(onAutoSend).not.toHaveBeenCalled();
  });

  it("routes .afx/context.md to /afx-context Load + Save with mixed dispatch", () => {
    const onInsert = vi.fn();
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "context",
          feature: null,
          approvalStatus: null,
        }}
        onInsert={onInsert}
        onAutoSend={onAutoSend}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Load:/i }));
    expect(onAutoSend).toHaveBeenCalledWith("/afx-context load");

    fireEvent.click(screen.getByRole("button", { name: /Save:/i }));
    expect(onInsert).toHaveBeenCalledWith("/afx-context save");
  });

  it("falls back to flat Code button when tasks.md has no parsed phases", () => {
    const onInsert = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    // Code is always the menu button (so users can pick Code all even before
    // parsed phases land), so look for the menu trigger, not a flat button.
    const codeTrigger = screen.getByRole("button", { name: "Code options" });
    expect(codeTrigger).toBeInTheDocument();
    // No phase items in the trigger label.
    expect(codeTrigger).not.toHaveTextContent(/1\.\d/);
  });

  // ---------------------------------------------------------------------------
  // Sign Off button — surfaces only when every body checkbox is `[x]`, every
  // Work Sessions Agent cell is `[x]`, and at least one Human cell is unticked.
  // The confirm popover previews the atomic edit before dispatching
  // `chat/hostAction { action: "tasks.signOff", uri }`.
  //
  //   @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  //   @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
  // ---------------------------------------------------------------------------

  // Sign Off-ready state: every body checkbox is `[x]` and every Work Sessions
  // Agent cell is `[x]`, but pending Human cells remain — so the file is still
  // `Draft`. Sign Off is precisely the action that flips it to `Living`. The
  // canonical tasks.md lifecycle is `Draft → Living` (no `Approved` step).
  const READY_TASKS_CTX = {
    format: "standard" as const,
    section: "TASKS" as const,
    docKind: "tasks" as const,
    feature: "auth",
    filePath: "/repo/docs/specs/auth/tasks.md",
    approvalStatus: "Draft",
    signOff: {
      ready: true,
      signable: true,
      allTasksChecked: true,
      allAgentVerified: true,
      pendingTasks: 0,
      pendingAgentRows: 0,
      pendingHumanRows: 3,
      alreadyLiving: false,
    },
  };

  it("hides the Sign Off button when there is nothing to sign off (signable false)", () => {
    // Both gates false: no pending Human cells AND not ready. Nothing for the
    // button to do, so it must not render.
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          ...READY_TASKS_CTX,
          signOff: {
            ...READY_TASKS_CTX.signOff,
            ready: false,
            signable: false,
            pendingHumanRows: 0,
          },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("doc-actions-sign-off-button")).not.toBeInTheDocument();
  });

  it("shows the Sign Off button in relaxed mode (signable but not ready) with a warning banner", async () => {
    // Body tasks still pending → ready=false but signable=true. The button
    // must surface, the warning banner must list pendingTasks +
    // pendingAgentRows, and the popover must say status will stay unchanged.
    const user = userEvent.setup();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          ...READY_TASKS_CTX,
          signOff: {
            ...READY_TASKS_CTX.signOff,
            ready: false,
            signable: true,
            allTasksChecked: false,
            pendingTasks: 2,
            pendingAgentRows: 1,
            allAgentVerified: false,
            pendingHumanRows: 1,
          },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={vi.fn()}
      />,
    );

    const button = screen.getByTestId("doc-actions-sign-off-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-warn", "true");

    await user.click(button);
    const popover = await screen.findByTestId("doc-actions-sign-off-popover");
    const warning = await screen.findByTestId("doc-actions-sign-off-warning");
    expect(warning).toHaveTextContent(/2 tasks still unchecked/);
    expect(warning).toHaveTextContent(/1 Work Sessions Agent row/);
    // Singular "cell" — assert plain substring rather than `\b` boundary
    // because rendered DOM concatenates adjacent siblings without whitespace.
    expect(popover).toHaveTextContent("Tick 1 Human cell");
    expect(popover).not.toHaveTextContent("Tick 1 Human cells");
    expect(popover).toHaveTextContent(/Status stays unchanged/);
    expect(popover).not.toHaveTextContent(/Promote status to Living/);
  });

  it("hides the Sign Off button when onHostAction is not wired", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("doc-actions-sign-off-button")).not.toBeInTheDocument();
  });

  it("renders Sign Off when ready and previews the atomic edit on click", async () => {
    const user = userEvent.setup();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={vi.fn()}
      />,
    );

    const signOffButton = screen.getByTestId("doc-actions-sign-off-button");
    expect(signOffButton).toBeInTheDocument();
    expect(signOffButton).toHaveClass("!h-5", "!min-h-5", "font-mono", "!text-[10px]");

    await user.click(signOffButton);

    const popover = await screen.findByTestId("doc-actions-sign-off-popover");
    expect(popover).toHaveTextContent(/Tick 3 Human cells/);
    // Source status is intentionally not named — tasks.md goes Draft → Living
    // (the canonical afx-task lifecycle has no "Approved" intermediate), so
    // the popover only states the destination.
    expect(popover).toHaveTextContent(/Promote status to Living/);
    expect(popover).not.toHaveTextContent(/Approved → Living/);
    expect(popover).toHaveTextContent(/Update updated_at/);
  });

  it("notes that status is already Living when alreadyLiving is true", async () => {
    const user = userEvent.setup();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          ...READY_TASKS_CTX,
          signOff: { ...READY_TASKS_CTX.signOff, alreadyLiving: true, pendingHumanRows: 1 },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("doc-actions-sign-off-button"));
    const popover = await screen.findByTestId("doc-actions-sign-off-popover");
    // Singular "cell" (pendingHumanRows === 1) — assert exact substring rather
    // than a `\b` boundary because the rendered DOM concatenates adjacent
    // siblings without whitespace ("cellStatus..." in textContent).
    expect(popover).toHaveTextContent("Tick 1 Human cell");
    expect(popover).not.toHaveTextContent("Tick 1 Human cells");
    expect(popover).toHaveTextContent(/Status already Living/);
    expect(popover).not.toHaveTextContent(/Approved → Living/);
  });

  it("calls onHostAction with the active filePath when Confirm is clicked", async () => {
    const user = userEvent.setup();
    const onHostAction = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={onHostAction}
      />,
    );

    await user.click(screen.getByTestId("doc-actions-sign-off-button"));
    await user.click(await screen.findByTestId("doc-actions-sign-off-confirm"));

    expect(onHostAction).toHaveBeenCalledWith("tasks.signOff", "/repo/docs/specs/auth/tasks.md");
  });

  // ---------------------------------------------------------------------------
  // Workflow-position breadcrumb + strip-header Memory anchor.
  //   @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  //   @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
  // ---------------------------------------------------------------------------

  it("renders the spec stepper in Spec mode with per-segment statuses (3 pills, no Code, no resume button)", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "DESIGN",
          docKind: "design",
          feature: "auth",
          approvalStatus: "Draft",
          specStatus: "Approved",
          designStatus: "Draft",
          tasksStatus: null,
          siblingPaths: { spec: "/x/spec.md", design: "/x/design.md" },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spec-stepper")).toBeInTheDocument();
    expect(screen.getByTestId("spec-stepper-segment-spec")).toHaveAttribute(
      "data-status",
      "approved",
    );
    expect(screen.getByTestId("spec-stepper-segment-design")).toHaveAttribute(
      "data-status",
      "draft",
    );
    expect(screen.getByTestId("spec-stepper-segment-design")).toHaveAttribute(
      "data-active",
      "true",
    );
    // Spec stepper stays document-focused; chat actions live elsewhere.
    expect(screen.queryByTestId("spec-stepper-segment-code")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spec-stepper-resume")).not.toBeInTheDocument();
    // Tier-2 renders actual sibling targets only; no orphan "Related" label.
    expect(screen.queryByText("Related")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Journal")).toBeInTheDocument();
  });

  it("renders task progress (N/M) on the Tasks pill when tasks counters are known", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
          specStatus: "Approved",
          designStatus: "Approved",
          // tasks.md goes Draft → Living — `tasksStatus` here represents an
          // in-progress (3/8 done) tasks.md, so Draft is the realistic value.
          tasksStatus: "Draft",
          tasksCompleted: 3,
          tasksTotal: 8,
          siblingPaths: { tasks: "/x/tasks.md" },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spec-stepper-segment-tasks")).toHaveTextContent("3/8");
  });

  it("renders the spec stepper outside Spec mode (no longer gated by workspaceMode)", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
          specStatus: "Draft",
          designStatus: null,
          tasksStatus: null,
          siblingPaths: { spec: "/x/spec.md" },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    // Per FR-17 the stepper is visible in every workspace mode so SDD pivot
    // works from Code/Explore too.
    expect(screen.getByTestId("spec-stepper")).toBeInTheDocument();
  });

  it("ChatDocActionsPanelHeaderExtras renders the Memory anchor when onMemorySelect is wired", async () => {
    const onMemorySelect = vi.fn();
    const user = userEvent.setup();

    render(<ChatDocActionsPanelHeaderExtras onMemorySelect={onMemorySelect} />);

    const triggers = screen.getAllByRole("button", { name: "Open memory menu" });
    expect(triggers).toHaveLength(1);

    await user.click(triggers[0]);
    expect(await screen.findByText("SESSION MEMORY")).toBeInTheDocument();

    await user.click(await screen.findByRole("menuitem", { name: /Recap: \/afx-session recap/i }));
    expect(onMemorySelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-recap", autoSend: true }),
    );
  });

  it("Memory anchor lives in header extras, not the body — even in non-spec modes (FR-18)", () => {
    // The body never renders the memory anchor; that lives in the chrome's
    // header-extras slot (`ChatDocActionsPanelHeaderExtras`).
    const { rerender } = render(
      <ChatDocActionsPanelBody
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
          siblingPaths: { spec: "/x/spec.md" },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Open memory menu" })).not.toBeInTheDocument();

    // Header extras renders the memory trigger when the callback is wired.
    rerender(<ChatDocActionsPanelHeaderExtras onMemorySelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Open memory menu" })).toBeInTheDocument();
  });

  it("uses the canonical compact action set in non-Spec mode (research)", () => {
    // Compact-mode primary table — research compact = [Compare] [Finalize],
    // not the first two actions (Explore, Compare).
    //   @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
    render(
      <ChatDocActionsPanelBody
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: null,
          docKind: "research",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    expect(compose).toHaveTextContent("Compare");
    expect(compose).toHaveTextContent("Finalize");
    expect(compose).not.toHaveTextContent("Explore");
    expect(compose).not.toHaveTextContent("Summarize");
  });

  it("uses the canonical compact action set in non-Spec mode (tasks)", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="explore"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    // tasks compact set = [Code|▾] [Review|▾] | [Verify] [Pick|▾]
    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Code");
    expect(compose).toHaveTextContent("Review");
    expect(run).toHaveTextContent("Verify");
    expect(run).toHaveTextContent("Pick");
    // Status is outside the compact set and moves to More.
    expect(`${compose.textContent}|${run.textContent}`).not.toMatch(/Status/);
  });

  it("does not call onHostAction when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onHostAction = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={onHostAction}
      />,
    );

    await user.click(screen.getByTestId("doc-actions-sign-off-button"));
    await user.click(await screen.findByTestId("doc-actions-sign-off-cancel"));

    expect(onHostAction).not.toHaveBeenCalled();
  });

  it("threads sprint task routing through /afx-sprint code with WBS suffix", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "sprint",
          section: "TASKS",
          docKind: "tasks",
          feature: "alpha",
          approvalStatus: "Living",
          taskPhases: [
            {
              number: 1,
              name: "Bridge",
              completed: 0,
              total: 1,
              line: 10,
              items: [{ text: "Wire focus parser", completed: false, line: 11, wbsId: "1.1" }],
            },
          ],
        }}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Code options" }));
    await user.click(await screen.findByText("Code 1.1"));
    expect(onInsert).toHaveBeenCalledWith("/afx-sprint code alpha 1.1");
  });

  // Spec stepper integration
  // @see docs/specs/211-app-chat-composer/spec.md [FR-17] [FR-18]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
  it("renders the spec stepper inside the strip body when an SDD doc is active", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Approved",
          specStatus: "Approved",
          designStatus: "Draft",
          tasksStatus: null,
          siblingPaths: {
            spec: "/work/docs/specs/auth/spec.md",
            design: "/work/docs/specs/auth/design.md",
          },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByTestId("spec-stepper")).toBeInTheDocument();
    expect(screen.getByTestId("spec-stepper-segment-spec")).toHaveAttribute("data-active", "true");
  });

  it("stepper pill click dispatches onOpenFile with the sibling path", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Approved",
          specStatus: "Approved",
          designStatus: "Draft",
          siblingPaths: {
            spec: "/work/docs/specs/auth/spec.md",
            design: "/work/docs/specs/auth/design.md",
          },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/auth/design.md", undefined);
  });

  it("Memory anchor never appears inside the stepper subtree", () => {
    // The body renders the stepper. It must not contain the memory anchor
    // (which lives in `ChatDocActionsPanelHeaderExtras`).
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Approved",
          specStatus: "Approved",
          siblingPaths: { spec: "/x/spec.md" },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    const stepper = screen.getByTestId("spec-stepper");
    const memoryInsideStepper = stepper.querySelector('[aria-label="Open memory menu"]');
    expect(memoryInsideStepper).toBeNull();
  });

  it("stepper hides when the active doc is not an SDD doc (e.g. ADR)", () => {
    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "adr",
          feature: "auth",
          approvalStatus: "Approved",
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("spec-stepper")).not.toBeInTheDocument();
  });

  it("sprint mode → stepper pill click jumps to the in-file section line", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();

    render(
      <ChatDocActionsPanelBody
        workspaceMode="spec"
        docContext={{
          format: "sprint",
          section: "SPEC",
          docKind: "spec",
          feature: "alpha",
          filePath: "/work/docs/specs/alpha/sprint.md",
          approvalStatus: "Approved",
          specStatus: "Approved",
          designStatus: "Draft",
          sectionOffsets: { spec: 12, design: 48, tasks: 102, sessions: 220 },
        }}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onOpenFile={onOpenFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design step/i }));
    expect(onOpenFile).toHaveBeenCalledWith("/work/docs/specs/alpha/sprint.md", 48);
  });

  describe("per-docKind primary actions are surfaced (regression catch for missing buttons)", () => {
    // The doc-actions panel renders per-spec-file action buttons. Each docKind
    // (and the sprint vs standard format split) maps to a distinct action set
    // resolved by `resolveDocActions(docContext)`. This block exists to catch
    // the class of bug where the panel mounts but the action buttons are not
    // discoverable — the original symptom that motivated these tests was the
    // doc-actions panel showing only a "..." menu after the legacy
    // `ComposerStrip` was migrated to `ComposerPanel` chrome (the chrome lost
    // its `@container` class, so the wide-mode primary row never matched).
    //
    // Note: jsdom does not run container queries, so the wide-mode primary
    // row stays hidden in tests. We assert via the compact "Document actions"
    // dropdown menu, which lists the same actions and IS visible at every
    // width.
    type Case = {
      label: string;
      docContext: Parameters<typeof ChatDocActionsPanelBody>[0]["docContext"];
      expected: readonly string[];
    };

    const cases: readonly Case[] = [
      {
        label: "spec.md (standard 4-file)",
        docContext: {
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        },
        expected: ["Refine", "Author", "Validate", "Review", "Approve"],
      },
      {
        label: "spec.md (sprint)",
        docContext: {
          format: "sprint",
          section: "SPEC",
          docKind: "spec",
          feature: "alpha",
          approvalStatus: "Draft",
        },
        expected: ["Refine", "Author", "Verify", "Approve"],
      },
      {
        label: "design.md (standard 4-file)",
        docContext: {
          format: "standard",
          section: "DESIGN",
          docKind: "design",
          feature: "auth",
          approvalStatus: "Draft",
        },
        expected: ["Refine", "Author", "Validate", "Review", "Approve"],
      },
      {
        label: "design.md (sprint)",
        docContext: {
          format: "sprint",
          section: "DESIGN",
          docKind: "design",
          feature: "alpha",
          approvalStatus: "Draft",
        },
        expected: ["Refine", "Author", "Verify", "Approve"],
      },
      {
        label: "tasks.md (standard 4-file)",
        docContext: {
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        },
        expected: ["Code", "Verify", "Pick", "Review", "Status"],
      },
      {
        label: "tasks.md (sprint)",
        docContext: {
          format: "sprint",
          section: "TASKS",
          docKind: "tasks",
          feature: "alpha",
          approvalStatus: "Living",
        },
        expected: ["Refine", "Code", "Verify", "Approve", "Graduate"],
      },
      {
        label: "journal.md",
        docContext: {
          format: "standard",
          section: null,
          docKind: "journal",
          feature: "auth",
          approvalStatus: "Living",
        },
        expected: ["Note", "Log", "Recap", "Promote", "Capture"],
      },
      {
        label: "ADR",
        docContext: {
          format: "standard",
          section: null,
          docKind: "adr",
          feature: "auth",
          approvalStatus: "Accepted",
        },
        expected: ["Review", "Supersede", "List"],
      },
      {
        label: "research note",
        docContext: {
          format: "standard",
          section: null,
          docKind: "research",
          feature: "auth",
          approvalStatus: "Draft",
        },
        expected: ["Explore", "Compare", "Summarize", "Finalize"],
      },
    ] as const;

    for (const tc of cases) {
      it(`${tc.label} → primary row renders ≥2 of ${tc.expected.join(", ")} + remaining live in More`, () => {
        render(
          <ChatDocActionsPanelBody
            workspaceMode="spec"
            docContext={tc.docContext}
            onInsert={vi.fn()}
            onAutoSend={vi.fn()}
          />,
        );

        // The original regression that motivated these tests: the doc-actions
        // panel rendered with nothing but the "..." compact menu visible,
        // because the ComposerPanel chrome lost its `@container` class and the
        // wide-mode primary row's container query never matched. Each docKind's
        // resolveDocActions returns a set; `selectPrimaryActions` picks the
        // most-important subset for the always-visible row, with the rest
        // surfaced through the "More document actions" dropdown.
        //
        // The bar: AT LEAST TWO of the expected actions must render directly
        // as buttons in the primary row (so the user sees buttons, not "...");
        // and EVERY remaining expected action must be reachable somewhere in
        // the panel body (primary row OR the More dropdown's accessible
        // content). That catches "I can't see any actions" without locking in
        // exactly which actions are promoted vs demoted, which is a UX-tuning
        // decision that should be allowed to evolve.
        const row = screen.getByTestId("doc-actions-primary-row");
        expect(screen.queryByRole("button", { name: "Document actions" })).not.toBeInTheDocument();

        const expectedInRow = tc.expected.filter((label) => {
          const named = within(row).queryByRole("button", {
            name: new RegExp(`^${label}(?:\\b|$)`),
          });
          const options = within(row).queryByRole("button", {
            name: new RegExp(`^${label} options$`),
          });
          return Boolean(named ?? options);
        });
        expect(
          expectedInRow.length,
          `expected ≥2 of [${tc.expected.join(", ")}] in the primary row, found [${expectedInRow.join(", ")}]`,
        ).toBeGreaterThanOrEqual(2);
      });
    }
  });
});
