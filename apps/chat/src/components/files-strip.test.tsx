/**
 * FilesStrip — component unit tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ModifiedFile } from "../lib/derive-modified-files";
import { FilesStrip } from "./files-strip";

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

describe("FilesStrip", () => {
  it("renders nothing when files is empty", () => {
    const { container } = render(
      <FilesStrip files={[]} onOpenFile={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders header with count when files are present", () => {
    render(
      <FilesStrip
        files={[file("src/a.ts"), file("src/b.ts"), file("src/c.ts")]}
        onOpenFile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Modified/i)).toBeInTheDocument();
    expect(screen.getByText(/·\s*3/)).toBeInTheDocument();
  });

  it("starts expanded by default — pills are visible without clicking the chevron", () => {
    render(<FilesStrip files={[file("src/a.ts")]} onOpenFile={vi.fn()} onDismiss={vi.fn()} />);
    // Pills should be visible immediately
    expect(screen.getByTestId("files-strip-pill")).toBeInTheDocument();
    // Header toggle should expose aria-expanded=true
    expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument();
  });

  it("renders all files as pills when expanded", () => {
    render(
      <FilesStrip
        files={[file("src/a.ts"), file("src/b.ts")]}
        onOpenFile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const pills = screen.getAllByTestId("files-strip-pill");
    expect(pills).toHaveLength(2);
  });

  it("collapses pills when the chevron toggle is clicked", () => {
    render(
      <FilesStrip
        files={[file("src/a.ts"), file("src/b.ts")]}
        onOpenFile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", { expanded: true });
    fireEvent.click(toggle);
    expect(screen.queryByTestId("files-strip-pill")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
  });

  it("renders basename in the pill, not the full path", () => {
    render(
      <FilesStrip
        files={[file("packages/shared/src/messages.ts")]}
        onOpenFile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("messages.ts")).toBeInTheDocument();
    expect(screen.queryByText("packages/shared/src/messages.ts")).not.toBeInTheDocument();
  });

  it("invokes onOpenFile with the full path and undefined line on pill click", () => {
    const onOpen = vi.fn();
    render(
      <FilesStrip
        files={[file("packages/shared/src/messages.ts")]}
        onOpenFile={onOpen}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("files-strip-pill"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("packages/shared/src/messages.ts", undefined);
  });

  it("forwards the file's line to onOpenFile when present", () => {
    const onOpen = vi.fn();
    render(
      <FilesStrip
        files={[file("src/messages.ts", "ok", 142)]}
        onOpenFile={onOpen}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("files-strip-pill"));
    expect(onOpen).toHaveBeenCalledWith("src/messages.ts", 142);
  });

  it("renders a `:<line>` suffix and 'at line N' aria-label when line is set", () => {
    render(
      <FilesStrip
        files={[file("src/messages.ts", "ok", 42)]}
        onOpenFile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(":42")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open src\/messages\.ts at line 42/i }),
    ).toBeInTheDocument();
  });

  it("invokes onDismiss when ✕ button is clicked", () => {
    const onDismiss = vi.fn();
    render(<FilesStrip files={[file("a.ts")]} onOpenFile={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has accessible aria-label including the full path", () => {
    render(
      <FilesStrip
        files={[file("packages/shared/src/messages.ts")]}
        onOpenFile={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Open packages\/shared\/src\/messages\.ts/i }),
    ).toBeInTheDocument();
  });
});
