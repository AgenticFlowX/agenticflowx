/**
 * @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-ABSTRACTION] [8.4]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("shared package boundary", () => {
  it("does not import React, VSCode, or agent adapters", () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const offenders = walk(path.resolve(dirname))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return /from\s+["'](react|vscode|@afx\/agent-[^"']+|@mariozechner\/[^"']+)["']/.test(
          source,
        );
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
