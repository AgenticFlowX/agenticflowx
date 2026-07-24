import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CanvasAttachMenu, normalizeCanvasUrl } from "./canvas-attach-menu";

const source = {
  id: "board:roadmap",
  label: "Roadmap",
  kind: "board" as const,
  source: {
    rootUri: "file:///workspace",
    rootName: "workspace",
    relativePath: ".afx/boards/roadmap.md",
  },
};

describe("CanvasAttachMenu", () => {
  it("offers portable files, images, and a normalized URL", async () => {
    const user = userEvent.setup();
    const onPickFiles = vi.fn();
    const onAddUrl = vi.fn();
    render(
      <CanvasAttachMenu
        profile="essentials"
        onPickFiles={onPickFiles}
        onAddUrl={onAddUrl}
        onAttachSource={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Attach to canvas" }));
    await user.click(screen.getByRole("button", { name: "Images" }));
    expect(onPickFiles).toHaveBeenCalledWith("image");

    await user.click(screen.getByRole("button", { name: "Attach to canvas" }));
    await user.type(screen.getByRole("textbox", { name: "URL to attach" }), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Add URL" }));
    expect(onAddUrl).toHaveBeenCalledWith("https://example.com/");
  });

  it("keeps live Notes and Boards scoped to the AFX profile", async () => {
    const user = userEvent.setup();
    const onAttachSource = vi.fn();
    const { rerender } = render(
      <CanvasAttachMenu
        profile="essentials"
        sources={[source]}
        onPickFiles={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachSource={onAttachSource}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Attach to canvas" }));
    expect(screen.queryByRole("button", { name: /Roadmap/ })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    rerender(
      <CanvasAttachMenu
        profile="afx"
        sources={[source]}
        onPickFiles={vi.fn()}
        onAddUrl={vi.fn()}
        onAttachSource={onAttachSource}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Attach to canvas" }));
    await user.click(screen.getByRole("button", { name: /Roadmap/ }));
    expect(onAttachSource).toHaveBeenCalledWith(source);
  });

  it("rejects unsafe schemes and embedded credentials", () => {
    expect(normalizeCanvasUrl("javascript:alert(1)")).toEqual({
      ok: false,
      message: "Only http and https URLs can be attached.",
    });
    expect(normalizeCanvasUrl("https://user:secret@example.com")).toEqual({
      ok: false,
      message: "Remove credentials from the URL before attaching it.",
    });
  });
});
