/**
 * Workbench Clarity helper tests.
 *
 * @see docs/specs/901-cross-telemetry/spec.md [FR-1] [FR-3]
 * @see docs/specs/901-cross-telemetry/design.md [DES-TELEMETRY-CATALOG]
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueuedClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

describe("workbench clarity", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = "";
    delete (window as { clarity?: QueuedClarityFn }).clarity;
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      value: "0",
    });
  });

  it("tags standalone preview sessions separately from the workbench panel", async () => {
    const { setClarityEnabled } = await import("./clarity");

    setClarityEnabled(true, "preview");

    const clarity = (window as { clarity?: QueuedClarityFn }).clarity;
    expect(clarity?.q).toContainEqual(["set", "afx_app", "workbench"]);
    expect(clarity?.q).toContainEqual(["set", "afx_surface", "preview"]);
    expect(
      document.querySelector('script[src="https://www.clarity.ms/tag/w6orgkccwz"]'),
    ).not.toBeNull();
  });
});
