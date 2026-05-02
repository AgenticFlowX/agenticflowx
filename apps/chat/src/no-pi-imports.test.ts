/**
 * Chat runtime boundary guard — webview must not import any agent adapter package.
 * After Phase 3 file move (see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-6]),
 * this test lives at apps/chat/src/ — `dirname` IS the src/ root, so we walk it directly.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-ABSTRACTION] [8.4]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [FR-6]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("chat runtime boundary", () => {
  it("does not import Pi adapter packages", () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const offenders = walk(dirname)
      .filter(
        (file) =>
          /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"),
      )
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /from\s+["']@afx\/agent-pi["']|from\s+["']@mariozechner\//.test(source);
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
