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
