/**
 * Exercise the installed transitive package so an unapplied patch cannot pass.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-19] [FR-20] [DES-SUPPLY]
 * @see docs/specs/410-dx-quality/design.md [DES-ARCH]
 */
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const fromLint = createRequire(require.resolve("markdownlint-cli2"));
const fromMatch = createRequire(fromLint.resolve("micromatch"));
const braces = fromMatch("braces") as {
  parse: (input: string) => unknown;
  compile: (input: string) => string;
  expand: (input: string) => string[];
};
const fromUi = createRequire(new URL("../../packages/ui/package.json", import.meta.url));
const fromShadcn = createRequire(fromUi.resolve("shadcn"));
const deepmerge = fromShadcn("deepmerge") as (
  target: object,
  source: object,
) => Record<string, unknown>;

describe("GHSA-gcqx-w48m-w2h4 local mitigation", () => {
  it.each(["target", "source"])("rejects prototype keys from the %s", (side) => {
    const payload = JSON.parse('{"__proto__":{"polluted":true},"safe":1}') as object;
    const empty = Object.create(null) as object;
    const result = side === "target" ? deepmerge(payload, empty) : deepmerge(empty, payload);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.polluted).toBeUndefined();
    expect(Object.hasOwn(result, "__proto__")).toBe(false);
    expect(result.safe).toBe(1);
  });

  it("protects nested objects while preserving arrays and symbol keys", () => {
    const marker = Symbol("marker");
    const result = deepmerge(
      { nested: JSON.parse('{"__proto__":{"polluted":true},"safe":1}'), items: [1] },
      { nested: { other: 2 }, items: [2], [marker]: "kept" },
    );
    expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype);
    expect(result.nested).toEqual({ safe: 1, other: 2 });
    expect(result.items).toEqual([1, 2]);
    expect(Reflect.get(result, marker)).toBe("kept");
  });
});

describe("GHSA-vfj7-8cjw-p6xm local mitigation", () => {
  it.each(["parse", "compile", "expand"] as const)(
    "bounds nesting before %s can exhaust the stack",
    (mode) => {
      for (const [open, close] of [
        ["{", "}"],
        ["(", ")"],
      ]) {
        const input = open!.repeat(4000) + "a,b" + close!.repeat(4000);
        expect(() => braces[mode](input)).toThrow("Input nesting exceeds maximum depth (100)");
      }
    },
  );

  it("preserves ordinary expansions and escaped literal braces", () => {
    expect(braces.expand("a{b,{c,d}}")).toEqual(["ab", "ac", "ad"]);
    expect(() => braces.parse("\\{".repeat(1000))).not.toThrow();
  });
});
