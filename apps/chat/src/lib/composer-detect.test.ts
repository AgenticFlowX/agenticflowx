import { describe, expect, it } from "vitest";

import { detectComposerTrigger } from "./composer-detect";

describe("detectComposerTrigger", () => {
  it("detects slash at an empty composer start", () => {
    expect(detectComposerTrigger("/")).toEqual({ kind: "slash", start: 0, query: "" });
  });

  it("detects slash after leading whitespace", () => {
    expect(detectComposerTrigger("  /afx")).toEqual({ kind: "slash", start: 2, query: "afx" });
  });

  it("ignores slash mid-sentence", () => {
    expect(detectComposerTrigger("run /afx")).toBeNull();
  });

  it("detects mention after whitespace", () => {
    expect(detectComposerTrigger("read @src/foo")).toEqual({
      kind: "mention",
      start: 5,
      query: "src/foo",
    });
  });

  it("ignores escaped triggers", () => {
    expect(detectComposerTrigger(String.raw`\@src/foo`)).toBeNull();
  });

  it("ignores triggers inside code fences", () => {
    expect(detectComposerTrigger("```\n@src/foo")).toBeNull();
  });
});
