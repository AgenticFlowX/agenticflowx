/**
 * Workbench launchpad tests.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD] [DES-TEST]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkbenchProvider } from "../context/workbench-context";
import { _resetBridgeForTest, initWorkbenchBridge } from "../lib/bridge";
import { WorkbenchLaunchpad } from "./workbench-launchpad";

function renderLaunchpad() {
  return render(
    <WorkbenchProvider initialState={{ isLoading: false }}>
      <WorkbenchLaunchpad />
    </WorkbenchProvider>,
  );
}

describe("WorkbenchLaunchpad", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    initWorkbenchBridge();
  });

  afterEach(() => {
    postMessage.mockRestore();
    _resetBridgeForTest();
  });

  it("renders starter actions for chat commands and sample docs", () => {
    renderLaunchpad();

    expect(screen.getByText("Workflow map")).toBeInTheDocument();
    expect(screen.queryByText("First 10 minutes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Full spec/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sprint doc/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sample SDD set/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sample sprint/i })).toBeInTheDocument();
  });

  it("sends typed launchpad messages", () => {
    renderLaunchpad();

    fireEvent.click(screen.getByRole("button", { name: /^Full spec/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Sample SDD set/i }));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "afxOpenChatCommand", mode: "insert" }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "afxCreateSampleDocs", kind: "full-spec" },
      "*",
    );
  });
});
