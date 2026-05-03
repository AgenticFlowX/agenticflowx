/**
 * @see docs/specs/351-agent-pi/spec.md [FR-1]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import { rewriteAfxCommandPrompt } from "./rpc-manager";

describe("rewriteAfxCommandPrompt", () => {
  it.each([
    ["/afx-task", "/skill:afx-task"],
    ["/afx-task code T-001", "/skill:afx-task code T-001"],
    ["   /afx-task code T-001", "   /skill:afx-task code T-001"],
    ["Explain /afx-task", "Explain /afx-task"],
    ["plain prompt", "plain prompt"],
    ["/skill:afx-task code T-001", "/skill:afx-task code T-001"],
  ])("rewrites %j to %j", (input, output) => {
    expect(rewriteAfxCommandPrompt(input)).toBe(output);
  });
});
