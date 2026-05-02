/**
 * Naming and folder-shape guard — enforces conventions documented in AGENTS.md
 * that lint rules cannot see (tree shape, presence of forbidden directories).
 *
 * Three rules:
 *   1. No `__tests__/` directories anywhere (tests are colocated with source).
 *   2. No `*.spec.ts(x)` outside Playwright e2e dirs (Playwright convention only).
 *   3. No `*.test.ts(x)` inside Playwright e2e dirs.
 *
 * vscode-test-electron tests at `apps/vscode-e2e/src/**` keep `*.test.ts` —
 * that runner has no `.spec` convention. Only Playwright (`apps/chat/e2e/**`)
 * uses `.spec.ts`.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6] [DES-NAMING]
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..");

// Only Playwright dirs use *.spec.ts. Everything else uses *.test.ts.
const SPEC_ONLY_DIRS = [/\/apps\/chat\/e2e(\/|$)/, /\/apps\/workbench\/e2e(\/|$)/];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  ".turbo",
  "coverage",
  ".vscode-test",
  ".git",
  ".vite",
  ".next",
]);

describe("test-naming and folder conventions (430-dx-enforcement FR-5/FR-6)", () => {
  it("has no __tests__ directories", () => {
    const offenders = walkDirs(REPO_ROOT).filter((d) => path.basename(d) === "__tests__");
    expect(offenders, `Found __tests__ directories — colocate tests with source instead.`).toEqual(
      [],
    );
  });

  it("has no .spec.ts(x) outside Playwright dirs", () => {
    const offenders = walkFiles(REPO_ROOT)
      .filter((f) => /\.spec\.tsx?$/.test(f))
      .filter((f) => !SPEC_ONLY_DIRS.some((re) => re.test(f)));
    expect(
      offenders,
      `Found .spec.ts(x) outside apps/chat/e2e/ — rename to .test.ts or move to a Playwright dir.`,
    ).toEqual([]);
  });

  it("has no .test.ts(x) inside Playwright dirs", () => {
    const offenders = walkFiles(REPO_ROOT)
      .filter((f) => /\.test\.tsx?$/.test(f))
      .filter((f) => SPEC_ONLY_DIRS.some((re) => re.test(f)));
    expect(
      offenders,
      `Found .test.ts(x) inside apps/chat/e2e/ — Playwright dirs use .spec.ts only.`,
    ).toEqual([]);
  });
});

function walkDirs(root: string): string[] {
  const out: string[] = [];
  for (const entry of safeReaddir(root)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(root, entry);
    if (!isDir(full)) continue;
    out.push(full);
    out.push(...walkDirs(full));
  }
  return out;
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of safeReaddir(root)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(root, entry);
    if (isDir(full)) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function safeReaddir(p: string): string[] {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
