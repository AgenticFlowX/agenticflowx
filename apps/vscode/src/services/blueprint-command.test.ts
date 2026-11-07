import { describe, expect, it } from "vitest";

import { parseBlueprintCommand } from "./blueprint-command";

describe("Blueprint host commands", () => {
  it.each([
    ["", "status"],
    ["sync", "check"],
    ["resync", "rebuild"],
    ["apply", "save"],
    ["reject", "discard"],
    ["sprint", "sprint"],
    ["end", "end-session"],
  ])("routes %s locally to %s", (argument, action) => {
    expect(parseBlueprintCommand(`/afx-blueprint ${argument}`)?.action).toBe(action);
  });
  it("accepts installed-skill aliases and rejects malformed reserved arguments", () => {
    expect(parseBlueprintCommand("/skill:afx-blueprint check")?.action).toBe("check");
    expect(parseBlueprintCommand("/afx:blueprint")?.action).toBe("status");
    expect(() => parseBlueprintCommand("/afx-blueprint update everything now")).toThrow(/Unknown/);
    expect(() => parseBlueprintCommand("/afx-blueprint deploy")).toThrow(/Unknown/);
    expect(parseBlueprintCommand("What is /afx-blueprint?")).toBeUndefined();
    expect(parseBlueprintCommand("/afx-blueprint-other")).toBeUndefined();
  });
});
