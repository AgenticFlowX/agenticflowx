/**
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-16]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-16]
 */
import { describe, expect, it } from "vitest";

import { nextWorkbenchView, visibleWorkbenchViews } from "./workbench-views";

describe("workbench view registry", () => {
  it("keeps Canvas capability independent from tab visibility", () => {
    expect(visibleWorkbenchViews(["canvas"], true)).not.toContain("canvas");
    expect(visibleWorkbenchViews([], false)).not.toContain("canvas");
    expect(visibleWorkbenchViews([], true)).toContain("canvas");
  });

  it("falls back deterministically and permits all-hidden recovery", () => {
    const visible = visibleWorkbenchViews(["workbench"], false);
    expect(nextWorkbenchView("workbench", visible)).toBe("pipeline");
    expect(
      visibleWorkbenchViews(
        ["workbench", "pipeline", "documents", "analytics", "journal", "board", "notes", "canvas"],
        true,
      ),
    ).toEqual([]);
  });
});
