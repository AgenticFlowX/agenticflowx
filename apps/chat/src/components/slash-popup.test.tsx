/**
 * SlashPopup — component unit tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-HELPERS] [DES-COMPOSER-MOCKUP-SLASH-FILTER]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AgentCommand } from "@afx/shared";

import { SlashPopup, displayCommandName } from "./slash-popup";

function cmd(name: string, description?: string): AgentCommand {
  return { source: "skill", name, description };
}

const MOCK_COMMANDS: AgentCommand[] = [
  cmd("skill:afx-spec", "Validate and manage spec lifecycle"),
  cmd("skill:afx-sprint", "Single-document SDD for fast feature work"),
  cmd("skill:afx-session", "Capture session context and notes"),
  cmd("skill:afx-task", "Task management and coding workflow"),
  cmd("skill:afx-next", "Suggest the next best action"),
  cmd("shell:restart", "Restart the agent runtime"),
];

function renderPopup(props: Partial<React.ComponentProps<typeof SlashPopup>> = {}) {
  return render(
    <SlashPopup
      open
      commands={MOCK_COMMANDS}
      filterQuery=""
      onOpenChange={vi.fn()}
      onSelect={vi.fn()}
      onAction={vi.fn()}
      {...props}
    />,
  );
}

describe("displayCommandName", () => {
  it("converts skill:afx-* to /afx-*", () => {
    expect(displayCommandName({ name: "skill:afx-spec" })).toBe("/afx-spec");
    expect(displayCommandName({ name: "skill:afx-sprint" })).toBe("/afx-sprint");
  });

  it("adds leading slash to plain names", () => {
    expect(displayCommandName({ name: "help" })).toBe("/help");
  });

  it("preserves existing leading slash", () => {
    expect(displayCommandName({ name: "/help" })).toBe("/help");
  });
});

describe("SlashPopup", () => {
  it("renders all command groups when filterQuery is empty", () => {
    renderPopup();
    expect(screen.getByText("AFX skills")).toBeInTheDocument();
    expect(screen.getByText("Other commands")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("/afx-spec")).toBeInTheDocument();
    expect(screen.getByText("/shell:restart")).toBeInTheDocument();
  });

  it("narrows AFX skills by prefix filter (/afx-s → /afx-spec, /afx-sprint, /afx-session)", () => {
    renderPopup({ filterQuery: "afx-s" });
    expect(screen.getByText("/afx-spec")).toBeInTheDocument();
    expect(screen.getByText("/afx-sprint")).toBeInTheDocument();
    expect(screen.getByText("/afx-session")).toBeInTheDocument();
    expect(screen.queryByText("/afx-task")).not.toBeInTheDocument();
    expect(screen.queryByText("/afx-next")).not.toBeInTheDocument();
  });

  it("narrows by substring match (/spec → /afx-spec)", () => {
    renderPopup({ filterQuery: "spec" });
    expect(screen.getByText("/afx-spec")).toBeInTheDocument();
    expect(screen.queryByText("/afx-sprint")).not.toBeInTheDocument();
  });

  it("filters actions (/ne → /new, /ab → /abort)", () => {
    renderPopup({ filterQuery: "ne" });
    expect(screen.getByText("/new")).toBeInTheDocument();
    expect(screen.queryByText("/abort")).not.toBeInTheDocument();
  });

  it("shows empty state when no commands match", () => {
    renderPopup({ filterQuery: "xyz" });
    expect(screen.getByText(/No commands match "\/xyz"/i)).toBeInTheDocument();
  });

  it("shows empty state with quoted query when no commands match", () => {
    renderPopup({ commands: [], filterQuery: "xyz" });
    expect(screen.getByText(/No commands match "\/xyz"/i)).toBeInTheDocument();
  });

  it("does not render empty state when there are matches", () => {
    renderPopup({ filterQuery: "afx" });
    expect(screen.queryByText(/No commands match/i)).not.toBeInTheDocument();
  });

  it("calls onSelect with the command text when a row is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderPopup({ onSelect });
    await user.click(screen.getByText("/afx-spec"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("/afx-spec");
  });

  it("calls onAction for /new when clicked", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderPopup({ onAction });
    await user.click(screen.getByText("/new"));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("chat/newSession");
  });

  it("calls onAction for /abort when clicked", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderPopup({ onAction });
    await user.click(screen.getByText("/abort"));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("chat/abort");
  });

  it("is case-insensitive when filtering", () => {
    renderPopup({ filterQuery: "AFX-S" });
    expect(screen.getByText("/afx-spec")).toBeInTheDocument();
    expect(screen.getByText("/afx-sprint")).toBeInTheDocument();
    expect(screen.getByText("/afx-session")).toBeInTheDocument();
  });
});
