/**
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-DEPS]
 */
import { describe, expect, it } from "vitest";

import { skillReleaseRef } from "../../apps/vscode/scripts/skill-release-ref.mjs";

describe("skill manifest release pin", () => {
  it("preserves release tags and the unpinned development default", () => {
    expect(skillReleaseRef("v2.6.1")).toBe("v2.6.1");
    expect(skillReleaseRef("main")).toBe("main");
    expect(skillReleaseRef(undefined)).toBe("main");
  });

  it.each(["v1.2.3?token=private", "../private", "v01.2.3", "v1.2.3\n", {}, 42])(
    "rejects non-release manifest data: %j",
    (value) => {
      expect(() => skillReleaseRef(value)).toThrow("afxSkillsPin must be");
    },
  );
});
