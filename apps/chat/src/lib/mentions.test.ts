import { describe, expect, it } from "vitest";

import { extractMentions } from "./mentions";

describe("extractMentions", () => {
  it("extracts bare workspace paths", () => {
    expect(extractMentions("@src/foo.ts")).toEqual(["src/foo.ts"]);
  });

  it("deduplicates multiple mentions while preserving order", () => {
    expect(extractMentions("Read @src/a.ts and @src/b.ts then @src/a.ts")).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("ignores email-style false positives", () => {
    expect(extractMentions("Email me@example.com about @src/foo.ts")).toEqual(["src/foo.ts"]);
  });

  it("strips trailing punctuation", () => {
    expect(extractMentions("Refactor @src/foo.ts, then @src/bar.ts.")).toEqual([
      "src/foo.ts",
      "src/bar.ts",
    ]);
  });

  it("ignores escaped mentions", () => {
    expect(extractMentions(String.raw`Keep \@src/foo.ts literal`)).toEqual([]);
  });
});
