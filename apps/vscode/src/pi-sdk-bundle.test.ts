/**
 * Guard the shipped API-provider bootstrap from depending on workspace
 * node_modules at runtime.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("bundled Pi SDK bootstrap", () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const resourceRoot = path.resolve(dirname, "../resources/pi-sdk");

  it("does not ship bare @mariozechner imports", () => {
    const bootstrapPath = path.resolve(resourceRoot, "bootstrap.js");
    const source = readFileSync(bootstrapPath, "utf8");

    expect(source).not.toMatch(
      /^\s*import\s+[\s\S]*?\s+from\s+["']@mariozechner\/|import\(\s*["']@mariozechner\//m,
    );
  });

  it("marks the resource folder as ESM for Node startup", () => {
    const packageJsonPath = path.resolve(resourceRoot, "package.json");

    expect(JSON.parse(readFileSync(packageJsonPath, "utf8"))).toMatchObject({
      type: "module",
    });
  });

  it("ships Pi runtime assets required during RPC startup", () => {
    expect(existsSync(path.resolve(resourceRoot, "dist/modes/interactive/theme/dark.json"))).toBe(
      true,
    );
    expect(existsSync(path.resolve(resourceRoot, "dist/modes/interactive/theme/light.json"))).toBe(
      true,
    );
    expect(existsSync(path.resolve(resourceRoot, "dist/core/export-html/template.html"))).toBe(
      true,
    );
  });
});
