/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-43] [FR-44]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CanvasCommandMenu } from "./canvas-command-menu";

describe("CanvasCommandMenu", () => {
  it("starts with a compact Essentials surface and runs a promoted command", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <CanvasCommandMenu
        profile="essentials"
        capabilities={{ afx: true, architecture: true, canExport: true }}
        onProfileChange={vi.fn()}
        onCommand={onCommand}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Search Canvas commands" }));
    await user.click(screen.getByRole("button", { name: /Add card/ }));

    expect(onCommand).toHaveBeenCalledWith("add-card");
  });

  it("lets beginners discover advanced commands without changing profile", async () => {
    const user = userEvent.setup();
    render(
      <CanvasCommandMenu
        profile="essentials"
        capabilities={{ afx: true, architecture: true, canExport: true }}
        onProfileChange={vi.fn()}
        onCommand={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Search Canvas commands" }));
    await user.type(screen.getByRole("textbox", { name: "Find a Canvas command" }), "layout");

    expect(screen.getByRole("button", { name: /Reformat canvas/ })).toBeEnabled();
    expect(screen.getAllByText("Architecture")).toHaveLength(2);
  });

  it("explains unavailable AFX commands instead of exposing a broken action", async () => {
    const user = userEvent.setup();
    render(
      <CanvasCommandMenu
        profile="essentials"
        capabilities={{ afx: false, architecture: true, canExport: true }}
        onProfileChange={vi.fn()}
        onCommand={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Search Canvas commands" }));
    await user.type(screen.getByRole("textbox", { name: "Find a Canvas command" }), "attach board");

    const action = screen.getByRole("button", { name: /Attach AFX Board/ });
    expect(action).toBeDisabled();
    expect(screen.getByText(/Available when AFX workspace capabilities/)).toBeInTheDocument();
  });

  it("switches profile through a presentation-only selector", async () => {
    const user = userEvent.setup();
    const onProfileChange = vi.fn();
    render(
      <CanvasCommandMenu
        profile="essentials"
        capabilities={{ afx: true, architecture: true, canExport: true }}
        onProfileChange={onProfileChange}
        onCommand={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Canvas tools profile" }), "afx");

    expect(onProfileChange).toHaveBeenCalledWith("afx");
  });

  it("supports controlled opening for global keyboard shortcuts", () => {
    const onOpenChange = vi.fn();
    render(
      <CanvasCommandMenu
        profile="essentials"
        capabilities={{ afx: false, architecture: true, canExport: true }}
        onProfileChange={vi.fn()}
        onCommand={vi.fn()}
        open
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Canvas command menu" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Find a Canvas command" })).toHaveFocus();
  });
});
