/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { describe, expect, it } from "vitest";

import { classifyAfxCommand } from "./command-catalog";
import {
  COMMAND_CONTEXT_PRESETS,
  type ContextPresetCtx,
  getContextPresets,
  resolveContextPreset,
  resolveContextPresets,
} from "./context-presets";

const FULL_CTX: ContextPresetCtx = {
  feature: "user-auth",
  featurePath: "docs/specs/user-auth",
  filePath: "docs/specs/user-auth/design.md",
  WBS: "2.3",
  desId: "DES-AUTH-FLOW",
  topic: "token refresh",
  change: "remove legacy session cache",
};

describe("COMMAND_CONTEXT_PRESETS", () => {
  it("is frozen and only references verified supported base commands", () => {
    expect(Object.isFrozen(COMMAND_CONTEXT_PRESETS)).toBe(true);

    for (const [baseCommand, presets] of Object.entries(COMMAND_CONTEXT_PRESETS)) {
      expect(Object.isFrozen(presets), baseCommand).toBe(true);
      expect(classifyAfxCommand(baseCommand).kind, baseCommand).toBe("supported");

      for (const preset of presets) {
        expect(Object.isFrozen(preset), `${baseCommand} ${preset.label}`).toBe(true);
        const resolved = resolveContextPreset(baseCommand, preset, FULL_CTX);
        expect(resolved, `${baseCommand} ${preset.label}`).not.toBeNull();
        expect(classifyAfxCommand(resolved?.command ?? "").kind, resolved?.command).toBe(
          "supported",
        );
      }
    }
  });

  it("resolves every supported placeholder from active doc context-ish data", () => {
    expect(
      resolveContextPresets("/afx-design refine", FULL_CTX).map((entry) => entry.command),
    ).toContain("/afx-design refine user-auth DES-AUTH-FLOW");
    expect(
      resolveContextPresets("/afx-task code", FULL_CTX).map((entry) => entry.command),
    ).toContain("/afx-task code 2.3 tests first");
    expect(
      resolveContextPresets("/afx-check path", FULL_CTX).map((entry) => entry.command),
    ).toEqual([
      "/afx-check path docs/specs/user-auth",
      "/afx-check path docs/specs/user-auth/design.md",
    ]);
    expect(
      resolveContextPresets("/afx-context impact", FULL_CTX).map((entry) => entry.command),
    ).toEqual(["/afx-context impact remove legacy session cache"]);
    expect(
      resolveContextPresets("/afx-research finalize", FULL_CTX).map((entry) => entry.command),
    ).toEqual(["/afx-research finalize token refresh --to adr --feature user-auth"]);
  });

  it("fails closed for unsupported commands and missing placeholder values", () => {
    expect(getContextPresets("/afx-dev code")).toEqual([]);
    expect(resolveContextPresets("/afx-dev code", FULL_CTX)).toEqual([]);

    const [taskPreset] = getContextPresets("/afx-task code");
    expect(taskPreset).toBeDefined();
    if (!taskPreset) throw new Error("Expected /afx-task code preset");
    expect(resolveContextPreset("/afx-task code", taskPreset, { feature: "user-auth" })).toBeNull();
  });

  it("keeps presets draft-first except deterministic no-open-arg commands", () => {
    expect(resolveContextPresets("/afx-task verify", FULL_CTX)[0]).toMatchObject({
      command: "/afx-task verify 2.3",
      autoSend: false,
    });

    expect(resolveContextPresets("/afx-context load", FULL_CTX)[0]).toMatchObject({
      command: "/afx-context load",
      autoSend: true,
    });

    expect(resolveContextPresets("/afx-next", FULL_CTX)[0]).toMatchObject({
      command: "/afx-next",
      autoSend: true,
    });
  });

  it("caps visible presets at four per command family", () => {
    const visibleByFamily = new Map<string, number>();

    for (const [baseCommand, presets] of Object.entries(COMMAND_CONTEXT_PRESETS)) {
      const family = baseCommand.match(/^\/(afx-[a-z]+)/)?.[1];
      expect(family, baseCommand).toBeDefined();
      visibleByFamily.set(family!, (visibleByFamily.get(family!) ?? 0) + presets.length);
    }

    for (const [family, count] of visibleByFamily) {
      expect(count, family).toBeLessThanOrEqual(4);
    }
  });
});
