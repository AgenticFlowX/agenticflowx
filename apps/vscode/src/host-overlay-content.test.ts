/**
 * VS Code host overlay prompt contract.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-5]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-AFX-HOST-OVERLAY]
 */
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("AFX VS Code host overlay prompt", () => {
  it("suppresses legacy marker blocks from stale AFX skill context", async () => {
    const content = await readFile(
      new URL("../resources/harness-overlays/common/agenticflowx-vscode.md", import.meta.url),
      "utf8",
    );

    expect(content).not.toContain(`AFX-UI-${"ACTIONS"}`);
    expect(content).toContain("legacy machine-readable UI action marker blocks");
    expect(content).toContain("older conversation context");
    expect(content).toContain("For non-AFX turns");
  });
});
