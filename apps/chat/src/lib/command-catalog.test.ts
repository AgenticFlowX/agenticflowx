/**
 * AFX command-catalog guard tests.
 *
 * Static menu actions must resolve through the bundled SKILL.md command
 * contract, while known undocumented compatibility aliases stay draft-only.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { describe, expect, it } from "vitest";

import {
  AFX_COMMAND_CATALOG,
  DRAFT_ONLY_AFX_ALIASES,
  classifyAfxCommand,
  findSupportedAfxCommand,
} from "./command-catalog";

describe("AFX_COMMAND_CATALOG", () => {
  it("is frozen at the top level and per skill family", () => {
    expect(Object.isFrozen(AFX_COMMAND_CATALOG)).toBe(true);

    for (const entries of Object.values(AFX_COMMAND_CATALOG)) {
      expect(Object.isFrozen(entries)).toBe(true);
      for (const entry of entries) {
        expect(Object.isFrozen(entry)).toBe(true);
      }
    }
  });

  it("contains the supported menu command families", () => {
    expect(Object.keys(AFX_COMMAND_CATALOG).sort()).toEqual([
      "afx-adr",
      "afx-check",
      "afx-context",
      "afx-design",
      "afx-next",
      "afx-research",
      "afx-session",
      "afx-spec",
      "afx-sprint",
      "afx-task",
    ]);
  });

  it("validates representative supported commands from bundled skill usage", () => {
    const cases = [
      ["/afx-spec validate user-auth", true],
      ["/afx-spec refine user-auth requirements", false],
      ["/afx-spec discuss user-auth requirements", false],
      ["/afx-design author user-auth", false],
      ["/afx-design refine user-auth des-data", false],
      ["/afx-design approve user-auth", true],
      ["/afx-task refine user-auth dependencies", false],
      ["/afx-task brief 2.3", true],
      ["/afx-task code 2.3 tests first", false],
      ["/afx-check links docs/specs/user-auth", true],
      ["/afx-context save user-auth", false],
      ["/afx-context impact remove legacy flag", false],
      ["/afx-session log auth", false],
      ["/afx-session capture auth --trigger missed-req", false],
      ["/afx-adr accept adr-001", false],
      ["/afx-adr list", true],
      ["/afx-research finalize auth --to adr", false],
      ["/afx-next", true],
      ["/afx-sprint refine user-auth spec tighten FR-2", false],
      ["/afx-sprint verify user-auth --focus anchors", true],
    ] as const;

    for (const [command, autoSend] of cases) {
      const result = classifyAfxCommand(command);
      expect(result.kind, command).toBe("supported");
      expect(result.autoSend, command).toBe(autoSend);
    }
  });

  it("keeps unsupported compatibility aliases draft-only and out of supported lookup", () => {
    expect(DRAFT_ONLY_AFX_ALIASES.map((entry) => entry.command).sort()).toEqual([
      "/afx-session active",
    ]);

    for (const alias of DRAFT_ONLY_AFX_ALIASES) {
      const result = classifyAfxCommand(`${alias.command} user-auth`);

      expect(result.kind, alias.command).toBe("draft-only-alias");
      expect(result.autoSend, alias.command).toBe(false);
      expect(findSupportedAfxCommand(alias.family, alias.subcommand), alias.command).toBeNull();
    }
  });

  it("fails closed for unknown commands and unknown subcommands", () => {
    expect(classifyAfxCommand("/afx-task refine user-auth")).toMatchObject({
      kind: "supported",
      autoSend: false,
    });

    expect(classifyAfxCommand("/afx-task deploy user-auth")).toEqual({
      kind: "unknown",
      autoSend: false,
      family: "afx-task",
      subcommand: "deploy",
    });

    expect(classifyAfxCommand("/afx-dev code")).toEqual({
      kind: "unknown",
      autoSend: false,
      family: "afx-dev",
      subcommand: "code",
    });

    expect(classifyAfxCommand("please validate the spec")).toEqual({
      kind: "unknown",
      autoSend: false,
      family: null,
      subcommand: null,
    });
  });
});
