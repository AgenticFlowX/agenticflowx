/**
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
import { describe, expect, it } from "vitest";

import { shouldUseShellForBinary } from "./rpc-client";

describe("shouldUseShellForBinary", () => {
  it("uses the Windows shell for PATH-resolved command shims", () => {
    expect(shouldUseShellForBinary("pi", "win32")).toBe(true);
    expect(shouldUseShellForBinary("pi.cmd", "win32")).toBe(true);
    expect(shouldUseShellForBinary("pi.bat", "win32")).toBe(true);
  });

  it("does not use the shell for native executables or non-Windows platforms", () => {
    expect(shouldUseShellForBinary("pi.exe", "win32")).toBe(false);
    expect(shouldUseShellForBinary("pi", "darwin")).toBe(false);
    expect(shouldUseShellForBinary("pi", "linux")).toBe(false);
  });
});
