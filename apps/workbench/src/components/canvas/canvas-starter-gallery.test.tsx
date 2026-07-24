/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-27] [FR-38] [FR-44]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CanvasStarterGallery, canvasStarterLabel } from "./canvas-starter-gallery";

describe("CanvasStarterGallery", () => {
  it("offers beginner, planning, low-fidelity, architecture, and presentation paths", () => {
    render(<CanvasStarterGallery onApply={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Blank canvas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan a feature/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Low-fidelity workshop/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Architecture map/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Presentation map/ })).toBeInTheDocument();
  });

  it("applies the selected portable starter explicitly", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<CanvasStarterGallery onApply={onApply} />);

    await user.click(screen.getByRole("button", { name: /Architecture map/ }));
    expect(onApply).toHaveBeenCalledWith("architecture");
  });

  it("renders a compact sidebar-safe strip", () => {
    const { container } = render(<CanvasStarterGallery compact onApply={vi.fn()} />);

    expect(container.querySelector(".overflow-x-auto")).toBeInTheDocument();
    expect(screen.queryByText("What are you mapping?")).not.toBeInTheDocument();
    expect(canvasStarterLabel("high-fidelity")).toBe("Presentation map");
  });
});
