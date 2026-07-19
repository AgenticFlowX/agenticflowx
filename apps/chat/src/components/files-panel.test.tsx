/**
 * FilesPanel body tests.
 *
 * Chrome is covered by ComposerPanelStack. These tests keep the modified-file
 * inventory compact while proving every file remains inspectable.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-7]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ModifiedFile } from "../lib/derive-modified-files";
import { COMPACT_FILE_LIMIT, FilesPanelBody } from "./files-panel";

function file(path: string, status: ModifiedFile["status"] = "ok", line?: number): ModifiedFile {
  return {
    path,
    status,
    toolCallId: `tc-${path}`,
    assistantMessageId: "a1",
    lastTurnIndex: 0,
    line,
  };
}

function many(count: number): ModifiedFile[] {
  return Array.from({ length: count }, (_, index) => file(`src/file-${index + 1}.ts`));
}

describe("FilesPanelBody compact inventory", () => {
  it("shows at most two newest non-SDD files in one non-wrapping list", () => {
    render(
      <FilesPanelBody
        files={[
          file("src/newest.ts"),
          file("docs/specs/checkout/spec.md"),
          file("src/second.ts"),
          file("src/hidden.ts"),
        ]}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("files-panel-pill")).toHaveLength(COMPACT_FILE_LIMIT);
    expect(screen.getByText("newest.ts")).toBeInTheDocument();
    expect(screen.getByText("second.ts")).toBeInTheDocument();
    expect(screen.queryByText("hidden.ts")).not.toBeInTheDocument();
    expect(screen.queryByText("spec.md")).not.toBeInTheDocument();
    expect(screen.getByTestId("files-panel-compact-list")).toHaveClass("flex-nowrap");
    expect(screen.getByRole("button", { name: "Show all 4 modified files" })).toBeInTheDocument();
  });

  it("keeps direct source navigation with the complete path and first changed line", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    render(
      <FilesPanelBody
        files={[file("packages/shared/src/messages.ts", "ok", 142)]}
        onOpenFile={onOpenFile}
      />,
    );

    const source = screen.getByRole("button", {
      name: "Open packages/shared/src/messages.ts at line 142",
    });
    expect(source).toHaveTextContent("messages.ts:142");
    await user.click(source);
    expect(onOpenFile).toHaveBeenCalledWith("packages/shared/src/messages.ts", 142);
  });

  it("uses the shortest unique suffix when basenames collide", () => {
    render(
      <FilesPanelBody
        files={[file("apps/chat/src/index.ts"), file("apps/workbench/src/index.ts")]}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByText("chat/src/index.ts")).toBeInTheDocument();
    expect(screen.getByText("workbench/src/index.ts")).toBeInTheDocument();
  });

  it("uses valid list-item children for compact file controls", () => {
    render(<FilesPanelBody files={many(2)} onOpenFile={vi.fn()} />);
    const list = screen.getByTestId("files-panel-compact-list");
    expect(Array.from(list.children).every((child) => child.tagName === "LI")).toBe(true);
  });

  it("keeps running and error status available to assistive technology", () => {
    render(
      <FilesPanelBody
        files={[file("src/running.ts", "running"), file("src/error.ts", "error")]}
        onOpenFile={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /running\.ts.*updating/i })).toHaveAttribute(
      "data-status",
      "running",
    );
    expect(screen.getByRole("button", { name: /error\.ts.*needs attention/i })).toHaveAttribute(
      "data-status",
      "error",
    );
  });
});

describe("FilesPanelBody file actions", () => {
  it("reveals markdown inspection actions on focus and invokes their callbacks", async () => {
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    const onOpenPreview = vi.fn();
    const onOpenGitChanges = vi.fn();
    render(
      <FilesPanelBody
        files={[file("docs/README.md", "ok", 7)]}
        onOpenFile={onOpenFile}
        onOpenPreview={onOpenPreview}
        onOpenGitChanges={onOpenGitChanges}
      />,
    );

    const source = screen.getByRole("button", { name: "Open docs/README.md at line 7" });
    fireEvent.focus(source);
    const actions = await screen.findByRole("dialog", { name: "Actions for docs/README.md" });
    await user.click(within(actions).getByRole("button", { name: "Open source" }));
    expect(onOpenFile).toHaveBeenCalledWith("docs/README.md", 7);

    fireEvent.focus(source);
    await user.click(
      within(await screen.findByRole("dialog", { name: "Actions for docs/README.md" })).getByRole(
        "button",
        { name: "AFX Preview" },
      ),
    );
    expect(onOpenPreview).toHaveBeenCalledWith("docs/README.md");

    fireEvent.focus(source);
    await user.click(
      within(await screen.findByRole("dialog", { name: "Actions for docs/README.md" })).getByRole(
        "button",
        { name: "Git changes" },
      ),
    );
    expect(onOpenGitChanges).toHaveBeenCalledWith("docs/README.md");
  });

  it("does not offer AFX Preview for a non-markdown file", async () => {
    const user = userEvent.setup();
    render(
      <FilesPanelBody
        files={[file("src/app.ts")]}
        onOpenFile={vi.fn()}
        onOpenPreview={vi.fn()}
        onOpenGitChanges={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for src/app.ts" }));
    const actions = screen.getByRole("dialog", { name: "Actions for src/app.ts" });
    expect(within(actions).queryByRole("button", { name: "AFX Preview" })).not.toBeInTheDocument();
  });

  it("restores focus to the explicit trigger when Escape dismisses actions", async () => {
    const user = userEvent.setup();
    render(<FilesPanelBody files={[file("src/app.ts")]} onOpenFile={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Actions for src/app.ts" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Actions for src/app.ts" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Actions for src/app.ts" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("FilesPanelBody all-files popover", () => {
  it("portals a bounded, grouped inventory whose rows expose inline actions", async () => {
    const user = userEvent.setup();
    render(
      <FilesPanelBody
        files={[
          file("src/app.ts"),
          file("README.md"),
          file("src/hidden.ts"),
          file("docs/specs/checkout/spec.md"),
          file("docs/specs/checkout/design.md"),
        ]}
        onOpenFile={vi.fn()}
        onOpenPreview={vi.fn()}
        onOpenGitChanges={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show all 5 modified files" }));
    const inventory = screen.getByRole("dialog", { name: "All 5 modified files" });
    expect(inventory.closest("[data-radix-popper-content-wrapper]")?.parentElement).toBe(
      document.body,
    );
    expect(inventory).toHaveClass("max-h-[min(45vh,320px)]", "overflow-y-auto");
    expect(within(inventory).getByRole("heading", { name: "Files · 3" })).toBeInTheDocument();
    expect(within(inventory).getByRole("heading", { name: "SDD · 2" })).toBeInTheDocument();
    expect(within(inventory).getAllByTestId("files-panel-all-row")).toHaveLength(5);
    expect(within(inventory).getAllByRole("button", { name: "Git changes" })).toHaveLength(5);
    expect(within(inventory).getAllByRole("button", { name: "AFX Preview" })).toHaveLength(3);
  });

  it("uses collision-safe labels for SDD documents in All", async () => {
    const user = userEvent.setup();
    render(
      <FilesPanelBody
        files={[file("docs/specs/checkout/design.md"), file("docs/specs/profile/design.md")]}
        onOpenFile={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show all 2 modified files" }));
    const inventory = screen.getByRole("dialog", { name: "All 2 modified files" });
    expect(within(inventory).getByText("checkout/design.md")).toBeInTheDocument();
    expect(within(inventory).getByText("profile/design.md")).toBeInTheDocument();
  });
});

describe("FilesPanelBody SDD guide", () => {
  it("de-duplicates SDD chips, exposes All for an SDD-only batch, and previews the newest success", async () => {
    const user = userEvent.setup();
    const onOpenPreview = vi.fn();
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/checkout/design.md", "running"),
          file("docs/specs/checkout/spec.md", "ok"),
          file("docs/specs/checkout/tasks.md", "ok"),
        ]}
        onOpenFile={vi.fn()}
        onOpenPreview={onOpenPreview}
      />,
    );

    expect(screen.queryByTestId("files-panel-pill")).not.toBeInTheDocument();
    const guide = screen.getByTestId("sdd-modified-guide");
    expect(guide).toHaveTextContent("SDD · 3 docs");
    expect(guide).toHaveAccessibleName(/updating/i);
    expect(within(guide).getByRole("button", { name: "Show all 3 modified files" })).toBeVisible();

    await user.click(
      within(guide).getByRole("button", {
        name: "Preview docs/specs/checkout/spec.md",
      }),
    );
    expect(onOpenPreview).toHaveBeenCalledWith("docs/specs/checkout/spec.md");
  });

  it("prioritizes failed SDD status over concurrent updates", () => {
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/checkout/design.md", "running"),
          file("docs/specs/checkout/tasks.md", "error"),
        ]}
        onOpenFile={vi.fn()}
      />,
    );

    const guide = screen.getByTestId("sdd-modified-guide");
    expect({
      status: guide.getAttribute("data-status"),
      accessibleName: guide.getAttribute("aria-label"),
      usesErrorColor: guide.querySelector("svg")?.classList.contains("text-amber-500"),
    }).toEqual({
      status: "error",
      accessibleName: "SDD · 2 docs, needs attention",
      usesErrorColor: true,
    });
  });

  it("groups SDD actions by collision-safe owning spec in one bounded menu", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/fleet/checkout/tasks.md"),
          file("docs/specs/billing/checkout/design.md"),
          file("docs/specs/fleet/checkout/spec.md"),
          file("docs/specs/billing/checkout/spec.md"),
        ]}
        onOpenFile={vi.fn()}
        onCommand={onCommand}
      />,
    );

    const guide = screen.getByTestId("sdd-modified-guide");
    await user.click(within(guide).getByRole("button", { name: "More SDD document actions" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("SDD actions · 2 specs")).toBeInTheDocument();
    expect(menu).toHaveClass(
      "max-h-[min(45vh,320px)]",
      "overflow-y-auto",
      "max-w-[calc(100vw-1rem)]",
    );

    const groups = within(menu).getAllByTestId("sdd-action-group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveAccessibleName("SDD actions for docs/specs/fleet/checkout");
    expect(groups[1]).toHaveAccessibleName("SDD actions for docs/specs/billing/checkout");
    expect(within(groups[0]).getByText("fleet/checkout")).toBeInTheDocument();
    expect(within(groups[1]).getByText("billing/checkout")).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { expanded: false })).not.toBeInTheDocument();
  });

  it("orders lifecycle actions, de-duplicates commands, and identifies the singular journal target", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/checkout/tasks.md"),
          file("docs/specs/checkout/spec.md"),
          file("docs/specs/checkout/design.md"),
          file("docs/specs/checkout/spec.md"),
          file("docs/specs/checkout/journal.md"),
        ]}
        onOpenFile={vi.fn()}
        onCommand={onCommand}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More SDD document actions" }));
    const group = screen.getByTestId("sdd-action-group");
    const primaryActions = within(group).getAllByRole("menuitem");
    expect(primaryActions.map((item) => item.textContent?.trim())).toEqual([
      "Refine specSpec",
      "Refine designDesign",
      "Task statusTasks",
      "Capture noteJournal",
    ]);
    expect(within(group).getAllByRole("menuitem", { name: /Refine spec/i })).toHaveLength(1);

    const journal = screen.getByRole("menuitem", {
      name: "Journal for docs/specs/checkout",
    });
    expect(journal).toHaveTextContent("Journal");
    expect(journal).toHaveTextContent("checkout");
    await user.click(journal);
    expect(onCommand).toHaveBeenCalledWith("/afx-session capture --links checkout", "insert");
  });

  it("keeps sprint, ADR, and research documents as separately identified action groups", async () => {
    const user = userEvent.setup();
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/900-fleet/15-sdd/15-sdd.md"),
          file("docs/specs/900-fleet/15-sdd/release-notes.md"),
          file("docs/adr/adr-042.md"),
          file("docs/research/pi-skills.md"),
        ]}
        onOpenFile={vi.fn()}
        onCommand={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More SDD document actions" }));
    const groups = screen.getAllByTestId("sdd-action-group");
    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "SDD actions for docs/specs/900-fleet/15-sdd/15-sdd",
      "SDD actions for docs/specs/900-fleet/15-sdd/release-notes",
      "SDD actions for docs/adr/adr-042",
      "SDD actions for docs/research/pi-skills",
    ]);
  });

  it("excludes running and failed documents from actions and group counts", async () => {
    const user = userEvent.setup();
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/ready/spec.md"),
          file("docs/specs/running/design.md", "running"),
          file("docs/specs/failed/tasks.md", "error"),
        ]}
        onOpenFile={vi.fn()}
        onCommand={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More SDD document actions" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("SDD actions · 1 spec")).toBeInTheDocument();
    expect(within(menu).getAllByTestId("sdd-action-group")).toHaveLength(1);
    expect(within(menu).queryByText("running")).not.toBeInTheDocument();
    expect(within(menu).queryByText("failed")).not.toBeInTheDocument();
  });
});
