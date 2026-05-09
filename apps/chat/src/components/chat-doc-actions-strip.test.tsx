/**
 * ChatDocActionsStrip component tests — canonical anchors for every
 * requirement exercised below resolve through these file-level `@see` lines
 * (test names use prose only; no bare `(FR-X)` markers).
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16] [FR-17] [FR-18] [FR-19]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/100-package-shared/spec.md [FR-13] [FR-14]
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatDocActionsStrip } from "./chat-doc-actions-strip";

describe("ChatDocActionsStrip", () => {
  it("groups compose actions before run-now actions and keeps the row bounded", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();

    render(
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: null,
          section: null,
          docKind: null,
          feature: null,
          approvalStatus: null,
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while dismissed", () => {
    const { container } = render(
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        dismissed
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("trims primary actions to the compact set outside Spec workspace mode", () => {
    render(
      <ChatDocActionsStrip
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "journal",
          feature: "auth",
          approvalStatus: "Living",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const compose = screen.getByTestId("doc-actions-compose-group");
    const run = screen.getByTestId("doc-actions-run-group");
    expect(compose).toHaveTextContent("Note");
    expect(compose).toHaveTextContent("Log");
    expect(run).toHaveTextContent("Recap");
    // Note/Log are draft-first, Recap is auto-send — separator must split them.
    expect(screen.getByTestId("doc-actions-intent-separator")).toBeInTheDocument();
  });

  it("renders ADR primary actions and keeps mutating verbs draft-first", () => {
    const onInsert = vi.fn();
    const onAutoSend = vi.fn();

    render(
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "adr",
          feature: null,
          approvalStatus: "Accepted",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "research",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: null,
          docKind: "context",
          feature: null,
          approvalStatus: null,
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("doc-actions-sign-off-button")).not.toBeInTheDocument();
  });

  it("renders Sign Off when ready and previews the atomic edit on click", async () => {
    const user = userEvent.setup();

    render(
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onHostAction={vi.fn()}
      />,
    );

    const signOffButton = screen.getByTestId("doc-actions-sign-off-button");
    expect(signOffButton).toBeInTheDocument();

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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          ...READY_TASKS_CTX,
          signOff: { ...READY_TASKS_CTX.signOff, alreadyLiving: true, pendingHumanRows: 1 },
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        dismissed={false}
        onDismiss={vi.fn()}
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

  it("renders the workflow-position breadcrumb in Spec mode and routes click to /afx-next", async () => {
    const onAutoSend = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatDocActionsStrip
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
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={onAutoSend}
      />,
    );

    const breadcrumb = screen.getByTestId("doc-actions-breadcrumb");
    expect(breadcrumb).toHaveTextContent(/Spec.*Design.*Tasks.*Code/);
    expect(breadcrumb.querySelector('[data-segment="spec"]')).toHaveAttribute(
      "data-status",
      "approved",
    );
    expect(breadcrumb.querySelector('[data-segment="design"]')).toHaveAttribute(
      "data-status",
      "draft",
    );

    await user.click(breadcrumb);
    expect(onAutoSend).toHaveBeenCalledWith("/afx-next");
  });

  it("renders task progress (N/M) in the breadcrumb when tasks counters are known", () => {
    render(
      <ChatDocActionsStrip
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
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    const breadcrumb = screen.getByTestId("doc-actions-breadcrumb");
    expect(breadcrumb).toHaveTextContent("3/8");
  });

  it("hides the breadcrumb outside Spec mode", () => {
    render(
      <ChatDocActionsStrip
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
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("doc-actions-breadcrumb")).not.toBeInTheDocument();
  });

  it("renders the strip-header Memory anchor when onMemorySelect is wired", async () => {
    const onMemorySelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onMemorySelect={onMemorySelect}
      />,
    );

    const triggers = screen.getAllByRole("button", { name: "Open memory menu" });
    expect(triggers).toHaveLength(1);

    await user.click(triggers[0]);
    expect(await screen.findByText("SESSION MEMORY")).toBeInTheDocument();

    await user.click(await screen.findByRole("menuitem", { name: /Recap: \/afx-session recap/i }));
    expect(onMemorySelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-recap", autoSend: true }),
    );
  });

  it("hides the strip-header Memory anchor outside Spec mode", () => {
    render(
      <ChatDocActionsStrip
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: "SPEC",
          docKind: "spec",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={vi.fn()}
        onAutoSend={vi.fn()}
        onMemorySelect={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Open memory menu" })).not.toBeInTheDocument();
  });

  it("uses the canonical compact action set in non-Spec mode (research)", () => {
    // Compact-mode primary table — research compact = [Compare] [Finalize],
    // not the first two actions (Explore, Compare).
    //   @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
    render(
      <ChatDocActionsStrip
        workspaceMode="code"
        docContext={{
          format: "standard",
          section: null,
          docKind: "research",
          feature: "auth",
          approvalStatus: "Draft",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
        workspaceMode="explore"
        docContext={{
          format: "standard",
          section: "TASKS",
          docKind: "tasks",
          feature: "auth",
          approvalStatus: "Living",
        }}
        dismissed={false}
        onDismiss={vi.fn()}
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
    // Status (a Run-Now action that's NOT in the compact set) collapses to More.
    expect(`${compose.textContent}|${run.textContent}`).not.toMatch(/Status/);
  });

  it("does not call onHostAction when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onHostAction = vi.fn();

    render(
      <ChatDocActionsStrip
        workspaceMode="spec"
        docContext={READY_TASKS_CTX}
        dismissed={false}
        onDismiss={vi.fn()}
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
      <ChatDocActionsStrip
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
        dismissed={false}
        onDismiss={vi.fn()}
        onInsert={onInsert}
        onAutoSend={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Code options" }));
    await user.click(await screen.findByText("Code 1.1"));
    expect(onInsert).toHaveBeenCalledWith("/afx-sprint code alpha 1.1");
  });
});
