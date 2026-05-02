/**
 * Smoke test — verifies shared constants are exported and have expected shapes.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-3]
 * @see docs/specs/100-package-shared/design.md [DES-DATA]
 */
import { describe, expect, it } from "vitest";

import { AFX_COMMANDS, AFX_MODES, AFX_VERSION } from "./constants";

describe("shared constants", () => {
  it("AFX_VERSION is a non-empty string", () => {
    expect(typeof AFX_VERSION).toBe("string");
    expect(AFX_VERSION.length).toBeGreaterThan(0);
  });

  it("AFX_MODES contains expected entries", () => {
    expect(AFX_MODES).toContain("spec");
    expect(AFX_MODES).toContain("dev");
  });

  it("AFX_COMMANDS contains VSCode command ids", () => {
    expect(AFX_COMMANDS.OPEN_SIDEBAR).toMatch(/^afx\./);
    expect(AFX_COMMANDS.OPEN_WORKBENCH).toMatch(/^afx\./);
  });
});
