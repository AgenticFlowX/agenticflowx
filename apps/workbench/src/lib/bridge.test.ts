/**
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-4]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE]
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { _resetBridgeForTest, initWorkbenchBridge, workbenchOn } from "./bridge";

describe("workbench message boundary", () => {
  afterEach(() => _resetBridgeForTest());

  it("ignores foreign origins before dispatching host messages", () => {
    initWorkbenchBridge();
    const listener = vi.fn();
    workbenchOn("afxCanvasLibrary", listener);
    const data = { type: "afxCanvasLibrary", canvases: [] };
    window.dispatchEvent(
      new MessageEvent("message", { origin: "https://other.example.com", data }),
    );
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { origin: window.origin, data }));
    expect(listener).toHaveBeenCalledExactlyOnceWith(data);
  });
});
