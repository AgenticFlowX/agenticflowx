import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CANVAS_SEMANTIC_ICON_NAMES,
  CanvasSemanticIcon,
  isKnownCanvasSemanticIcon,
} from "./canvas-semantic-icon";

describe("CanvasSemanticIcon", () => {
  it("renders a finite semantic icon vocabulary without arbitrary markup", () => {
    const { container } = render(<CanvasSemanticIcon name="database" />);
    expect(container.querySelector('[data-canvas-icon="database"]')).toBeInTheDocument();
    expect(isKnownCanvasSemanticIcon("database")).toBe(true);
    expect(CANVAS_SEMANTIC_ICON_NAMES).toContain("server");
  });

  it("uses an inert fallback for unknown metadata", () => {
    render(<CanvasSemanticIcon name="<script>" />);
    expect(screen.queryByText("<script>")).not.toBeInTheDocument();
    expect(isKnownCanvasSemanticIcon("<script>")).toBe(false);
  });
});
