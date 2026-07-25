/**
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
import { describe, expect, it } from "vitest";

import { computeSnapshotDelta } from "./agent";

describe("computeSnapshotDelta", () => {
  it("returns only the appended text when the snapshot grows by prefix", () => {
    expect(computeSnapshotDelta("hello", "hello world")).toBe(" world");
  });

  it("returns the unseen remainder when the snapshot shifts as a rolling tail", () => {
    // Rolling window dropped "line1\n"; "line2\n" is the shared overlap.
    expect(computeSnapshotDelta("line1\nline2\n", "line2\nline3\n")).toBe("line3\n");
  });

  it("picks the longest overlap, not the first partial match", () => {
    expect(computeSnapshotDelta("abcabc", "abcabcd")).toBe("d");
    expect(computeSnapshotDelta("xxabab", "ababyy")).toBe("yy");
  });

  it("returns the full snapshot when there is zero overlap", () => {
    expect(computeSnapshotDelta("abc", "xyz")).toBe("xyz");
  });

  it("returns the full snapshot when previous is empty", () => {
    expect(computeSnapshotDelta("", "abc")).toBe("abc");
  });

  it("returns an empty delta for identical snapshots", () => {
    expect(computeSnapshotDelta("abc", "abc")).toBe("");
  });

  it("handles large rolling-tail snapshots within the scan cap", () => {
    const previous = "a".repeat(1000) + "MARKER" + "b".repeat(1000);
    const next = "MARKER" + "b".repeat(1000) + "-tail";
    expect(computeSnapshotDelta(previous, next)).toBe("-tail");
  });
});
