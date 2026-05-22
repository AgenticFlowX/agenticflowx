/**
 * Extension-host runtime floor test.
 * Asserts the extension host runs on Node >=22.19.0 — the minimum required by
 * @earendil-works/pi-* packages spawned via the bundled Pi SDK.
 *
 * @see docs/specs/351-agent-pi/spec.md [NFR-4]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
 */
import * as assert from "node:assert";

suite("AFX Extension — extension-host Node runtime floor", () => {
  test("Node version is >=22.19.0 (required by @earendil-works/pi-*)", () => {
    const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
    const meetsFloor = major > 22 || (major === 22 && minor >= 19);
    assert.ok(
      meetsFloor,
      `Extension-host Node ${process.versions.node} is below the >=22.19.0 floor required by @earendil-works/pi-*`,
    );
  });
});
