/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { describe, expect, it } from "vitest";

import { parseFocuses, slugify } from "./focus-parser";

describe("parseFocuses", () => {
  it("parses spec H2 sections and skips non-focus boilerplate headings", () => {
    const focuses = parseFocuses(
      [
        "# Spec",
        "",
        "## Overview",
        "skip me",
        "## Functional Requirements",
        "body",
        "## Non-Functional Requirements",
        "skip me too",
        "## Acceptance Criteria",
      ].join("\n"),
      "spec",
    );

    expect(focuses).toEqual([
      {
        id: "functional-requirements",
        label: "Functional Requirements",
        slug: "functional-requirements",
        excerpt: "body",
        line: 5,
      },
    ]);
  });

  it("uses bracketed design IDs as stable command suffixes", () => {
    const focuses = parseFocuses(
      ["# Design", "", "## [DES-DATA] Data Model", "", "## [DES-API] Host Bridge"].join("\n"),
      "design",
    );

    expect(focuses).toEqual([
      {
        id: "des-data",
        label: "DES-DATA: Data Model",
        slug: "des-data-data-model",
        commandSuffix: "des-data",
        line: 3,
      },
      {
        id: "des-api",
        label: "DES-API: Host Bridge",
        slug: "des-api-host-bridge",
        commandSuffix: "des-api",
        line: 5,
      },
    ]);
  });

  it("parses tasks phase headings at H2 or deeper heading levels", () => {
    const focuses = parseFocuses(
      [
        "# Tasks",
        "",
        "## Task Breakdown",
        "intro",
        "### Phase 1: Parser",
        "- [ ] Build parser",
        "## Phase 2 - Bridge",
        "- [ ] Wire context",
      ].join("\n"),
      "tasks",
    );

    expect(focuses).toEqual([
      {
        id: "phase-1",
        label: "Phase 1: Parser",
        slug: "phase-1-parser",
        commandSuffix: "phase-1",
        excerpt: "Build parser",
        line: 5,
      },
      {
        id: "phase-2",
        label: "Phase 2 - Bridge",
        slug: "phase-2-bridge",
        commandSuffix: "phase-2",
        excerpt: "Wire context",
        line: 7,
      },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const focuses = parseFocuses(
      ["# Design", "", "```md", "## [DES-FAKE] Fake", "```", "", "## [DES-REAL] Real"].join("\n"),
      "design",
    );

    expect(focuses.map((focus) => focus.id)).toEqual(["des-real"]);
  });

  it("applies a source line offset when parsing a section slice", () => {
    const focuses = parseFocuses("## [DES-DATA] Data", "design", { lineOffset: 20 });
    expect(focuses[0]?.line).toBe(21);
  });

  it("captures a compact body excerpt for parsed design sections", () => {
    const focuses = parseFocuses(
      [
        "# Design",
        "",
        "## [DES-DATA] Data Model",
        "",
        "The composer stores local draft state, active focus targets, and bridge-ready commands.",
        "- [ ] Strip markdown checkboxes from previews.",
        "## [DES-API] Host Bridge",
      ].join("\n"),
      "design",
    );

    expect(focuses[0]).toMatchObject({
      id: "des-data",
      excerpt:
        "The composer stores local draft state, active focus targets, and bridge-ready commands. Strip markdown checkboxes from previews.",
    });
  });
});

describe("slugify", () => {
  it("normalizes bracket IDs, punctuation, and ampersands", () => {
    expect(slugify("[DES-DATA] Data & Flow")).toBe("des-data-data-and-flow");
  });
});
