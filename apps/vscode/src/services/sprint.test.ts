/**
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 * @see docs/specs/220-app-workbench/design.md [DES-WORKBENCH-SPRINT-SLICER]
 */
import { describe, expect, it } from "vitest";

import { findSectionAt, isSprintFile, parseSprintPath, sliceSprintSection } from "./sprint";

const MARKER_BODY = [
  "---", // 0
  "afx: true", // 1
  "type: SPRINT", // 2
  "---", // 3
  "", // 4
  "# Sprint", // 5
  "", // 6
  "## References", // 7
  "intro line", // 8
  "", // 9
  "<!-- SPRINT-SECTION-START: SPEC -->", // 10
  "## 1. Spec", // 11
  "spec body", // 12
  "<!-- SPRINT-SECTION-END: SPEC -->", // 13
  "", // 14
  "<!-- SPRINT-SECTION-START: DESIGN -->", // 15
  "## 2. Design", // 16
  "design body", // 17
  "<!-- SPRINT-SECTION-END: DESIGN -->", // 18
  "", // 19
  "<!-- SPRINT-SECTION-START: TASKS -->", // 20
  "## 3. Tasks", // 21
  "task body", // 22
  "<!-- SPRINT-SECTION-END: TASKS -->", // 23
].join("\n");

const HEADING_ONLY_BODY = [
  "---",
  "afx: true",
  "type: FLUID",
  "---",
  "",
  "# Heading-only sprint",
  "",
  "## Specification", // 7
  "spec body", // 8
  "",
  "## Design", // 10
  "design body", // 11
  "",
  "## Tasks", // 13
  "task body", // 14
].join("\n");

const H1_HEADING_BODY = [
  "---",
  "afx: true",
  "type: SPRINT",
  "---",
  "",
  "# H1 sprint",
  "",
  "## Sprint Status", // 7
  "status body", // 8
  "",
  "# 1. Spec", // 10
  "spec intro", // 11
  "## Requirements", // 12
  "spec detail", // 13
  "",
  "# 2. Design", // 15
  "design intro", // 16
  "## [DES-OVR] Overview", // 17
  "design detail", // 18
  "",
  "# 3. Tasks", // 20
  "task body", // 21
].join("\n");

describe("isSprintFile", () => {
  it("recognizes type: SPRINT", () => {
    expect(isSprintFile(MARKER_BODY)).toBe(true);
  });
  it("recognizes lower-case sprint frontmatter from non-canonical generated files", () => {
    expect(isSprintFile(MARKER_BODY.replace("type: SPRINT", "type: sprint"))).toBe(true);
  });
  it("recognizes type: FLUID", () => {
    expect(isSprintFile(HEADING_ONLY_BODY)).toBe(true);
  });
  it("rejects regular spec files", () => {
    expect(isSprintFile("---\ntype: SPEC\n---\n")).toBe(false);
  });
});

describe("findSectionAt", () => {
  it("returns the section enclosed by START/END markers", () => {
    expect(findSectionAt(MARKER_BODY, 11)).toBe("SPEC");
    expect(findSectionAt(MARKER_BODY, 16)).toBe("DESIGN");
    expect(findSectionAt(MARKER_BODY, 22)).toBe("TASKS");
  });
  it("returns undefined for content above the first section", () => {
    expect(findSectionAt(MARKER_BODY, 8)).toBeUndefined();
  });
  it("falls back to heading detection when markers are absent", () => {
    expect(findSectionAt(HEADING_ONLY_BODY, 8)).toBe("SPEC");
    expect(findSectionAt(HEADING_ONLY_BODY, 11)).toBe("DESIGN");
    expect(findSectionAt(HEADING_ONLY_BODY, 14)).toBe("TASKS");
  });
  it("recognizes H1 sprint sections and keeps nested H2 content inside them", () => {
    expect(findSectionAt(H1_HEADING_BODY, 8)).toBeUndefined();
    expect(findSectionAt(H1_HEADING_BODY, 13)).toBe("SPEC");
    expect(findSectionAt(H1_HEADING_BODY, 18)).toBe("DESIGN");
    expect(findSectionAt(H1_HEADING_BODY, 21)).toBe("TASKS");
  });
});

describe("sliceSprintSection", () => {
  it("returns marker-driven body without the marker lines", () => {
    const slice = sliceSprintSection(MARKER_BODY, "SPEC");
    expect(slice?.byMarker).toBe(true);
    expect(slice?.startLine).toBe(10);
    expect(slice?.contentStartLine).toBe(11);
    expect(slice?.content).toContain("## 1. Spec");
    expect(slice?.content).not.toContain("SPRINT-SECTION-START");
  });
  it("slices H1 sprint sections until the next H1", () => {
    const slice = sliceSprintSection(H1_HEADING_BODY, "DESIGN");
    expect(slice?.byMarker).toBe(false);
    expect(slice?.startLine).toBe(15);
    expect(slice?.contentStartLine).toBe(15);
    expect(slice?.content).toContain("# 2. Design");
    expect(slice?.content).toContain("## [DES-OVR] Overview");
    expect(slice?.content).not.toContain("# 3. Tasks");
  });
});

describe("parseSprintPath", () => {
  it("splits path#SECTION", () => {
    expect(parseSprintPath("docs/specs/foo/foo.md#SPEC")).toEqual({
      path: "docs/specs/foo/foo.md",
      section: "SPEC",
    });
  });
  it("returns undefined section when no fragment is present", () => {
    expect(parseSprintPath("docs/specs/foo/foo.md")).toEqual({
      path: "docs/specs/foo/foo.md",
      section: undefined,
    });
  });
  it("ignores unknown sections", () => {
    expect(parseSprintPath("foo.md#OTHER")).toEqual({
      path: "foo.md",
      section: undefined,
    });
  });
});
