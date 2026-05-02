/**
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-8] [DES-TEST] [3.2]
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
