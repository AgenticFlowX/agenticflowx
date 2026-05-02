/**
 * Panels boundary guard — only `agent-factory.ts` may know which adapter is in
 * use. Files under `apps/vscode/src/panels/**` must depend on `AgentManager`
 * from `@afx/shared` and never reach into `@afx/agent-pi` or
 * `@mariozechner/*`. Covers the Phase 8.4 optional third guard.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-ABSTRACTION] [8.4]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [FR-6]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("vscode panels boundary", () => {
  it("does not import agent adapter packages", () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    // After Phase 3 file move (see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-6]),
    // this test lives at apps/vscode/src/panels/no-pi-imports.test.ts — `dirname` is the panels dir itself.
    const panelsRoot = dirname;
    const offenders = walk(panelsRoot)
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts"))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /from\s+["']@afx\/agent-[^"']+["']|from\s+["']@mariozechner\//.test(source);
      });
    expect(offenders).toEqual([]);
  });
});

function walk(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
