/**
 * FilesPanel — body unit tests.
 *
 * Chrome (title, count, dismiss, collapse) is owned by `ComposerPanel` /
 * `ComposerPanelStack` and covered by `composer-panel-stack.test.tsx`. These
 * tests cover only the body's rendering and the `onOpenFile` callback.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA]
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ModifiedFile } from "../lib/derive-modified-files";
import { FilesPanelBody, THRESHOLD } from "./files-panel";

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
  return Array.from({ length: count }, (_, i) => file(`src/file-${i + 1}.ts`));
}

describe("FilesPanelBody", () => {
  it("renders one pill per file", () => {
    render(
      <FilesPanelBody
        files={[file("src/a.ts"), file("src/b.ts"), file("src/c.ts")]}
        onOpenFile={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("files-panel-pill")).toHaveLength(3);
  });

  it("renders basename in the pill, not the full path", () => {
    render(
      <FilesPanelBody files={[file("packages/shared/src/messages.ts")]} onOpenFile={vi.fn()} />,
    );
    expect(screen.getByText("messages.ts")).toBeInTheDocument();
    expect(screen.queryByText("packages/shared/src/messages.ts")).not.toBeInTheDocument();
  });

  it("invokes onOpenFile with the full path and undefined line on pill click", () => {
    const onOpen = vi.fn();
    render(
      <FilesPanelBody files={[file("packages/shared/src/messages.ts")]} onOpenFile={onOpen} />,
    );
    fireEvent.click(screen.getByTestId("files-panel-pill"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("packages/shared/src/messages.ts", undefined);
  });

  it("forwards the file's line to onOpenFile when present", () => {
    const onOpen = vi.fn();
    render(<FilesPanelBody files={[file("src/messages.ts", "ok", 142)]} onOpenFile={onOpen} />);
    fireEvent.click(screen.getByTestId("files-panel-pill"));
    expect(onOpen).toHaveBeenCalledWith("src/messages.ts", 142);
  });

  it("renders a `:<line>` suffix and 'at line N' aria-label when line is set", () => {
    render(<FilesPanelBody files={[file("src/messages.ts", "ok", 42)]} onOpenFile={vi.fn()} />);
    expect(screen.getByText(":42")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open src\/messages\.ts at line 42/i }),
    ).toBeInTheDocument();
  });

  it("has accessible aria-label including the full path", () => {
    render(
      <FilesPanelBody files={[file("packages/shared/src/messages.ts")]} onOpenFile={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /Open packages\/shared\/src\/messages\.ts/i }),
    ).toBeInTheDocument();
  });

  it("reflects the file status via data-status on the pill", () => {
    render(<FilesPanelBody files={[file("a.ts", "running")]} onOpenFile={vi.fn()} />);
    expect(screen.getByTestId("files-panel-pill")).toHaveAttribute("data-status", "running");
  });

  it("renders settled SDD docs as one compact summary row with grouped actions", async () => {
    const user = userEvent.setup();
    const onOpenPreview = vi.fn();
    const onOpenWorkbench = vi.fn();
    const onCommand = vi.fn();
    render(
      <FilesPanelBody
        files={[file("docs/specs/checkout-redesign/spec.md")]}
        onOpenFile={vi.fn()}
        onOpenPreview={onOpenPreview}
        onOpenWorkbench={onOpenWorkbench}
        onCommand={onCommand}
      />,
    );

    const guide = screen.getByTestId("sdd-modified-guide");
    expect(guide).toHaveAttribute("data-status", "ok");
    expect(guide).toHaveTextContent("1 changed doc");
    expect(guide).toHaveClass("h-7", "max-h-7");
    expect(within(guide).queryByText("spec.md")).not.toBeInTheDocument();

    await user.click(within(guide).getByRole("button", { name: "Preview" }));
    await user.click(within(guide).getByRole("button", { name: "Open SDD Studio" }));
    await user.click(within(guide).getByRole("button", { name: "More SDD document actions" }));
    await user.click(screen.getByRole("menuitem", { name: /Refine spec/ }));
    await user.click(within(guide).getByRole("button", { name: "More SDD document actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Journal" }));

    expect(onOpenPreview).toHaveBeenCalledWith("docs/specs/checkout-redesign/spec.md");
    expect(onOpenWorkbench).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith("/afx-spec refine checkout-redesign", "insert");
    expect(onCommand).toHaveBeenCalledWith(
      "/afx-session capture --links checkout-redesign",
      "insert",
    );
  });

  it("keeps per-document actions and exactly one journal action in More", async () => {
    const user = userEvent.setup();
    render(
      <FilesPanelBody
        files={[
          file("docs/specs/checkout-redesign/spec.md"),
          file("docs/specs/checkout-redesign/design.md"),
        ]}
        onOpenFile={vi.fn()}
        onOpenPreview={vi.fn()}
        onOpenWorkbench={vi.fn()}
        onCommand={vi.fn()}
      />,
    );

    const guide = screen.getByTestId("sdd-modified-guide");
    expect(guide).toHaveTextContent("2 changed docs");
    expect(within(guide).queryByText("spec.md")).not.toBeInTheDocument();
    expect(within(guide).queryByText("design.md")).not.toBeInTheDocument();

    await user.click(within(guide).getByRole("button", { name: "More SDD document actions" }));
    expect(screen.getByRole("menuitem", { name: /Refine spec.*spec\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Refine design.*design\.md/ })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem", { name: "Journal" })).toHaveLength(1);
  });

  it("withholds actions for unsettled docs and reports running and error states", () => {
    const props = {
      onOpenFile: vi.fn(),
      onOpenPreview: vi.fn(),
      onOpenWorkbench: vi.fn(),
      onCommand: vi.fn(),
    };
    const { rerender } = render(
      <FilesPanelBody
        files={[file("docs/specs/checkout-redesign/spec.md", "running")]}
        {...props}
      />,
    );

    let guide = screen.getByTestId("sdd-modified-guide");
    expect(guide).toHaveAttribute("data-status", "running");
    expect(guide).toHaveTextContent("1 doc updating");
    expect(within(guide).queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <FilesPanelBody files={[file("docs/specs/checkout-redesign/spec.md", "error")]} {...props} />,
    );
    guide = screen.getByTestId("sdd-modified-guide");
    expect(guide).toHaveAttribute("data-status", "error");
    expect(guide).toHaveTextContent("1 doc needs attention");
    expect(within(guide).queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not render SDD guide for non-SDD markdown", () => {
    render(<FilesPanelBody files={[file("README.md")]} onOpenFile={vi.fn()} />);
    expect(screen.queryByTestId("sdd-modified-guide")).toBeNull();
  });
});

describe("FilesPanelBody truncation", () => {
  it("renders no toggle when files.length <= THRESHOLD", () => {
    render(<FilesPanelBody files={many(THRESHOLD)} onOpenFile={vi.fn()} />);
    expect(screen.queryByTestId("files-panel-toggle")).toBeNull();
    expect(screen.getAllByTestId("files-panel-pill")).toHaveLength(THRESHOLD);
  });

  it("renders THRESHOLD pills + toggle in compact mode when files.length > THRESHOLD", () => {
    render(<FilesPanelBody files={many(12)} onOpenFile={vi.fn()} />);
    expect(screen.getAllByTestId("files-panel-pill")).toHaveLength(THRESHOLD);
    const toggle = screen.getByTestId("files-panel-toggle");
    expect(toggle).toHaveTextContent(`+${12 - THRESHOLD} more`);
    expect(toggle).toHaveAttribute("data-expanded", "false");
  });

  it("toggle aria-label reflects overflow count when compact", () => {
    render(<FilesPanelBody files={many(15)} onOpenFile={vi.fn()} />);
    expect(screen.getByTestId("files-panel-toggle")).toHaveAttribute(
      "aria-label",
      `Show ${15 - THRESHOLD} more modified files`,
    );
  });

  it("clicking +N more expands to show all pills", () => {
    render(<FilesPanelBody files={many(12)} onOpenFile={vi.fn()} />);
    fireEvent.click(screen.getByTestId("files-panel-toggle"));
    expect(screen.getAllByTestId("files-panel-pill")).toHaveLength(12);
    const toggle = screen.getByTestId("files-panel-toggle");
    expect(toggle).toHaveTextContent("Show less");
    expect(toggle).toHaveAttribute("data-expanded", "true");
  });

  it("toggle aria-label flips to 'Show fewer modified files' when expanded", () => {
    render(<FilesPanelBody files={many(12)} onOpenFile={vi.fn()} />);
    fireEvent.click(screen.getByTestId("files-panel-toggle"));
    expect(screen.getByTestId("files-panel-toggle")).toHaveAttribute(
      "aria-label",
      "Show fewer modified files",
    );
  });

  it("clicking Show less returns to compact (THRESHOLD pills + +N more)", () => {
    render(<FilesPanelBody files={many(12)} onOpenFile={vi.fn()} />);
    const toggle = screen.getByTestId("files-panel-toggle");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getAllByTestId("files-panel-pill")).toHaveLength(THRESHOLD);
    expect(toggle).toHaveTextContent(`+${12 - THRESHOLD} more`);
    expect(toggle).toHaveAttribute("data-expanded", "false");
  });

  it("pills shown in compact mode are the first THRESHOLD entries (most recent first per derive order)", () => {
    // First entry is visible (head of the derived order); last is hidden behind +N more.
    const head = file("src/z.ts");
    const tail = file("src/hidden.ts");
    const filler = Array.from({ length: THRESHOLD }, (_, i) => file(`src/mid-${i}.ts`));
    render(<FilesPanelBody files={[head, ...filler, tail]} onOpenFile={vi.fn()} />);
    expect(screen.getByText("z.ts")).toBeInTheDocument();
    expect(screen.queryByText("hidden.ts")).toBeNull();
  });

  it("hidden pills are not in the DOM in compact mode", () => {
    const files = [...many(THRESHOLD), file("src/hidden.ts")];
    render(<FilesPanelBody files={files} onOpenFile={vi.fn()} />);
    expect(screen.queryByText("hidden.ts")).toBeNull();
  });

  it("hidden pills appear after expanding", () => {
    const files = [...many(THRESHOLD), file("src/hidden.ts")];
    render(<FilesPanelBody files={files} onOpenFile={vi.fn()} />);
    fireEvent.click(screen.getByTestId("files-panel-toggle"));
    expect(screen.getByText("hidden.ts")).toBeInTheDocument();
  });

  it("toggle does not render when files.length === THRESHOLD exactly", () => {
    render(<FilesPanelBody files={many(THRESHOLD)} onOpenFile={vi.fn()} />);
    expect(screen.queryByTestId("files-panel-toggle")).toBeNull();
  });

  it("toggle does not render when files.length === 0", () => {
    render(<FilesPanelBody files={[]} onOpenFile={vi.fn()} />);
    expect(screen.queryByTestId("files-panel-pill")).toBeNull();
    expect(screen.queryByTestId("files-panel-toggle")).toBeNull();
  });

  it("onOpenFile not invoked when clicking the toggle", () => {
    const onOpen = vi.fn();
    render(<FilesPanelBody files={many(12)} onOpenFile={onOpen} />);
    fireEvent.click(screen.getByTestId("files-panel-toggle"));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("live update: when files grows past THRESHOLD, toggle appears with correct count", () => {
    const onOpen = vi.fn();
    const initial = Math.max(1, THRESHOLD - 1);
    const grown = THRESHOLD + 6;
    const { rerender } = render(<FilesPanelBody files={many(initial)} onOpenFile={onOpen} />);
    expect(screen.queryByTestId("files-panel-toggle")).toBeNull();
    rerender(<FilesPanelBody files={many(grown)} onOpenFile={onOpen} />);
    const toggle = screen.getByTestId("files-panel-toggle");
    expect(toggle).toHaveTextContent(`+${grown - THRESHOLD} more`);
    expect(toggle).toHaveAttribute("data-expanded", "false");
  });

  it("pills are width-bounded (truncated) in compact mode but not in expanded mode", () => {
    render(<FilesPanelBody files={many(12)} onOpenFile={vi.fn()} />);
    // Compact: every visible pill must be marked truncated.
    for (const pill of screen.getAllByTestId("files-panel-pill")) {
      expect(pill).toHaveAttribute("data-truncated", "true");
    }
    // Expand → pills lose the truncation cap.
    fireEvent.click(screen.getByTestId("files-panel-toggle"));
    for (const pill of screen.getAllByTestId("files-panel-pill")) {
      expect(pill).toHaveAttribute("data-truncated", "false");
    }
  });

  it("pills are NOT truncated when files.length <= THRESHOLD (no toggle present)", () => {
    render(<FilesPanelBody files={many(THRESHOLD)} onOpenFile={vi.fn()} />);
    for (const pill of screen.getAllByTestId("files-panel-pill")) {
      expect(pill).toHaveAttribute("data-truncated", "false");
    }
  });

  it("truncation preserves full path in title (tooltip) and aria-label", () => {
    const longPath = "apps/chat/src/components/chat/chat-controller-with-very-long-name.tsx";
    const files: ModifiedFile[] = [file(longPath), ...many(THRESHOLD)];
    render(<FilesPanelBody files={files} onOpenFile={vi.fn()} />);
    const pill = screen.getAllByTestId("files-panel-pill")[0];
    // Visible text only carries the basename, but title + aria-label keep the full path.
    expect(pill).toHaveAttribute("data-truncated", "true");
    expect(pill.getAttribute("title")).toContain(longPath);
    expect(pill.getAttribute("aria-label")).toContain(longPath);
  });
});
