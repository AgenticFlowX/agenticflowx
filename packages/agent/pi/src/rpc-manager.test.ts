/**
 * @see docs/specs/351-agent-pi/spec.md [FR-1]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import { rewriteAfxCommandPrompt } from "./rpc-manager";
import { normalizePiToolArgs } from "./tool-args";

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

describe("normalizePiToolArgs", () => {
  it("preserves common Pi tool argument aliases for shell tools", () => {
    expect(
      normalizePiToolArgs(
        {
          arguments: {
            command:
              'curl -s "https://api.open-meteo.com/v1/forecast?latitude=-36.8485&longitude=174.7633&forecast_days=3"',
          },
        },
        "bash",
      ),
    ).toEqual({
      command:
        'curl -s "https://api.open-meteo.com/v1/forecast?latitude=-36.8485&longitude=174.7633&forecast_days=3"',
    });

    expect(normalizePiToolArgs({ input: "ls -la" }, "bash")).toEqual({ command: "ls -la" });
    expect(normalizePiToolArgs({ args: ["curl", "-s", "https://example.com"] }, "bash")).toEqual({
      command: ["curl", "-s", "https://example.com"],
    });
  });

  it("wraps scalar non-shell inputs without pretending they are commands", () => {
    expect(normalizePiToolArgs({ input: "package.json" }, "read_file")).toEqual({
      input: "package.json",
    });
  });
});
