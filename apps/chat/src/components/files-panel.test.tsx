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
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ModifiedFile } from "../lib/derive-modified-files";
import { FilesPanelBody } from "./files-panel";

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
});
