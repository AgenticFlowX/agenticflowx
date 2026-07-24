/**
 * Image presentation authoring keeps JSON Canvas portable and preserves unknown metadata.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-23] [FR-36]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-SEC]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CanvasFileNode } from "@afx/shared";

import { CanvasImageControls } from "./canvas-image-controls";

function imageNode(afxMedia?: unknown): CanvasFileNode {
  return {
    id: "image",
    type: "file",
    file: "assets/architecture.png",
    x: 0,
    y: 0,
    width: 320,
    height: 220,
    ...(afxMedia === undefined ? {} : { afxMedia }),
  };
}

describe("CanvasImageControls", () => {
  it("authors fit, alt, and caption while preserving unknown metadata", () => {
    const onUpdate = vi.fn();
    const node = imageNode({
      version: 1,
      fit: "contain",
      alt: "System context diagram",
      caption: "Current architecture",
      futureField: { keep: true },
    });
    render(<CanvasImageControls node={node} onUpdate={onUpdate} />);

    const trigger = screen.getByRole("button", { name: "Edit image presentation" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Image presentation" });
    fireEvent.change(screen.getByRole("combobox", { name: "Image fit" }), {
      target: { value: "cover" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Image alt text" }), {
      target: { value: "Architecture dependency map" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Image caption" }), {
      target: { value: "Release topology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply image presentation" }));

    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onUpdate).toHaveBeenCalledWith({
      afxMedia: {
        version: 1,
        fit: "cover",
        alt: "Architecture dependency map",
        caption: "Release topology",
        futureField: { keep: true },
      },
    });
  });

  it("treats malformed metadata as defaults and bounds authored text", () => {
    const onUpdate = vi.fn();
    render(
      <CanvasImageControls
        node={imageNode({ version: 9, fit: "stretch", alt: 42, caption: [], vendor: "keep" })}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit image presentation" }));
    expect(screen.getByRole("combobox", { name: "Image fit" })).toHaveValue("contain");
    expect(screen.getByRole("textbox", { name: "Image alt text" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Image caption" })).toHaveValue("");

    fireEvent.change(screen.getByRole("textbox", { name: "Image alt text" }), {
      target: { value: `  ${"a".repeat(300)}\u0000  ` },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Image caption" }), {
      target: { value: `  ${"c".repeat(700)}\u0007  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply image presentation" }));

    const patch = onUpdate.mock.calls[0]?.[0] as { afxMedia?: Record<string, unknown> };
    expect(patch.afxMedia).toMatchObject({ version: 1, fit: "contain", vendor: "keep" });
    expect(patch.afxMedia?.alt).toHaveLength(240);
    expect(patch.afxMedia?.caption).toHaveLength(500);
    expect(String(patch.afxMedia?.alt)).not.toContain("\u0000");
    expect(String(patch.afxMedia?.caption)).not.toContain("\u0007");
  });
});
