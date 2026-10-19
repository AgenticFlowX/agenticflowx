/**
 * @see docs/specs/110-package-transport/spec.md [FR-2]
 * @see docs/specs/110-package-transport/design.md [DES-TRANSPORT-VSCODE-ADAPTER]
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVscodeTransport } from "./vscode";

describe("VS Code message boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects foreign origins and accepts messages from the webview origin", () => {
    const target = Object.assign(new EventTarget(), { origin: "https://example.com" });
    vi.stubGlobal("window", target);
    const transport = createVscodeTransport();
    const handler = vi.fn();
    transport.on("chat/messageEnd", handler);
    const data = { type: "chat/messageEnd", id: "message-1" };
    target.dispatchEvent(
      new MessageEvent("message", { origin: "https://other.example.com", data }),
    );
    expect(handler).not.toHaveBeenCalled();
    target.dispatchEvent(new MessageEvent("message", { origin: target.origin, data }));
    expect(handler).toHaveBeenCalledExactlyOnceWith(data);
    transport.dispose();
    target.dispatchEvent(new MessageEvent("message", { origin: target.origin, data }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
