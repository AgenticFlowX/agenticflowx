/**
 * @see docs/specs/221-app-workbench-board/spec.md [FR-12] [NFR-7]
 * @see docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-BOARD-LINK-WORK]
 */
import { useRef, useState } from "react";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LinkedWorkItemCandidate, WorkbenchSourceIdentity } from "@afx/shared";

import { LinkWorkPicker } from "./link-work-picker";

const source = (relativePath: string): WorkbenchSourceIdentity => ({
  rootUri: "file:///workspace",
  rootName: "workspace",
  relativePath,
});

const CANDIDATES: LinkedWorkItemCandidate[] = [
  {
    key: "spec:board",
    ref: { version: 1, kind: "spec", source: source("docs/specs/221-board/spec.md") },
    label: "Board UX",
    group: "workspace · 221-board",
    status: "Living",
    completed: 0,
    total: 0,
  },
  {
    key: "task:4.1",
    ref: {
      version: 1,
      kind: "task",
      source: source("docs/specs/221-board/tasks.md"),
      wbsId: "4.1",
    },
    label: "4.1 · Discover work",
    group: "workspace · 221-board",
    status: "Open",
    completed: 1,
    total: 2,
  },
  {
    key: "task:5.1",
    ref: {
      version: 1,
      kind: "task",
      source: source("docs/specs/229-canvas/tasks.md"),
      wbsId: "5.1",
    },
    label: "5.1 · React Flow",
    group: "workspace · 229-canvas",
    status: "Open",
    completed: 0,
    total: 4,
  },
];

describe("LinkWorkPicker", () => {
  it("groups, searches, multi-selects, and targets a column", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    render(
      <LinkWorkPicker
        open
        onOpenChange={() => {}}
        candidates={CANDIDATES}
        columns={[
          { id: "todo", title: "Todo" },
          { id: "next", title: "Next" },
        ]}
        existingKeys={new Set()}
        onLink={onLink}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: "Available AFX work" });
    expect(within(listbox).getByText("workspace · 221-board")).toBeInTheDocument();
    expect(within(listbox).getByText("workspace · 229-canvas")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search linked work" }), "board");
    expect(within(listbox).getByRole("option", { name: /Board UX/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /Discover work/ })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: /React Flow/ })).not.toBeInTheDocument();

    await user.click(within(listbox).getByRole("option", { name: /Board UX/ }));
    await user.click(within(listbox).getByRole("option", { name: /Discover work/ }));
    await user.click(screen.getByRole("combobox", { name: "Target column" }));
    await user.click(screen.getByRole("option", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Link 2" }));

    expect(onLink).toHaveBeenCalledWith(
      "next",
      expect.arrayContaining([
        expect.objectContaining({ label: "Board UX" }),
        expect.objectContaining({ label: "4.1 · Discover work" }),
      ]),
    );
  });

  it("marks already-linked work and prevents duplicate selection", async () => {
    render(
      <LinkWorkPicker
        open
        onOpenChange={() => {}}
        candidates={CANDIDATES}
        columns={[{ id: "todo", title: "Todo" }]}
        existingKeys={new Set(["task:4.1"])}
        onLink={() => {}}
      />,
    );

    const existing = screen.getByRole("option", { name: /Discover work/ });
    expect(existing).toHaveAttribute("aria-disabled", "true");
    expect(existing).toBeDisabled();
    expect(screen.getByText("Linked")).toBeInTheDocument();
  });

  it("keeps empty search feedback and footer actions reachable", async () => {
    const user = userEvent.setup();
    render(
      <LinkWorkPicker
        open
        onOpenChange={() => {}}
        candidates={CANDIDATES}
        columns={[{ id: "todo", title: "Todo" }]}
        existingKeys={new Set()}
        onLink={() => {}}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Search linked work" }), "no-match");
    expect(screen.getByText("No matching AFX work items.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Link work" })).toBeDisabled();
  });

  it("keyboard multi-selects work and restores focus to its trigger", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            Open link picker
          </button>
          <LinkWorkPicker
            open={open}
            onOpenChange={setOpen}
            candidates={CANDIDATES}
            columns={[{ id: "todo", title: "Todo" }]}
            existingKeys={new Set()}
            onLink={() => {}}
            returnFocusRef={triggerRef}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open link picker" });
    await user.click(trigger);
    expect(screen.getByRole("textbox", { name: "Search linked work" })).toHaveFocus();

    const options = screen.getAllByRole("option");
    for (let attempt = 0; attempt < 4 && document.activeElement !== options[0]; attempt++) {
      await user.tab();
    }
    expect(options[0]).toHaveFocus();
    await user.keyboard(" ");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.tab();
    expect(options[1]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Link 2" })).toBeEnabled();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Link AFX work" })).not.toBeInTheDocument();
  });
});
