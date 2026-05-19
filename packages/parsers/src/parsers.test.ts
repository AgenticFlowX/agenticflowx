/**
 * Smoke tests — verify parsers are exported and return expected shapes.
 *
 * @see docs/specs/120-package-parsers/spec.md [FR-1] [FR-2] [FR-3] [FR-4]
 * @see docs/specs/120-package-parsers/design.md [DES-TEST]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-14]
 */
import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "./frontmatter";
import { parseJournal } from "./journal";
import { parseSpec } from "./spec";
import { parseTasks } from "./tasks";

describe("parseFrontmatter", () => {
  it("extracts frontmatter data and content", () => {
    const raw = `---\ntitle: Test\nstatus: Draft\n---\n\nBody text.`;
    const result = parseFrontmatter(raw);
    expect(result.data).toMatchObject({ title: "Test", status: "Draft" });
    expect(result.content.trim()).toBe("Body text.");
  });

  it("returns empty data for input with no frontmatter", () => {
    const result = parseFrontmatter("No frontmatter here.");
    expect(result.data).toEqual({});
    expect(result.content).toBe("No frontmatter here.");
  });
});

describe("parseJournal", () => {
  it("returns empty discussions for plain text", () => {
    const result = parseJournal("No discussion IDs here.");
    expect(result.discussions).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("detects discussion IDs in journal content", () => {
    const raw = `**2026-04-25T10:00:00Z**\nSee 01-D001 for context.`;
    const result = parseJournal(raw);
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.discussions[0]?.id).toBe("01-D001");
  });
});

describe("parseSpec", () => {
  it("extracts frontmatter fields with defaults for missing values", () => {
    const raw = `---\nname: user-auth\ntype: SPEC\nstatus: Approved\nowner: "@rixrix"\nversion: "1.2"\ncreated_at: "2026-04-28T00:00:00.000Z"\nupdated_at: "2026-04-28T01:00:00.000Z"\ntags: [auth, security]\n---\n\nbody`;
    const result = parseSpec(raw);
    expect(result.frontmatter.name).toBe("user-auth");
    expect(result.frontmatter.type).toBe("SPEC");
    expect(result.frontmatter.status).toBe("Approved");
    expect(result.frontmatter.version).toBe("1.2");
    expect(result.frontmatter.tags).toEqual(["auth", "security"]);
  });

  it("falls back to default version 1.0 when frontmatter omits version", () => {
    const raw = `---\nname: foo\n---\n\nbody`;
    const result = parseSpec(raw);
    expect(result.frontmatter.version).toBe("1.0");
    expect(result.frontmatter.owner).toBe("");
  });

  it("extracts FR and NFR requirements with type discrimination", () => {
    const raw = `body\nFR-1 Login flow must redirect after auth\nNFR-2 P95 latency < 200ms\nFR-10 Session expires after 24h`;
    const result = parseSpec(raw);
    expect(result.requirements).toHaveLength(3);
    expect(result.requirements[0]).toEqual({
      id: "FR-1",
      text: "Login flow must redirect after auth",
      type: "FR",
    });
    expect(result.requirements[1]?.type).toBe("NFR");
    expect(result.requirements[2]?.id).toBe("FR-10");
  });

  it("extracts non-goals from a `## Non-Goals` section", () => {
    const raw = `## Requirements\nFR-1 X\n\n## Non-Goals\n- Multi-tenancy\n- Mobile app\n\n## Other`;
    const result = parseSpec(raw);
    expect(result.nonGoals).toContain("Multi-tenancy");
    expect(result.nonGoals).toContain("Mobile app");
  });

  it("returns empty requirements + nonGoals for content with neither", () => {
    const result = parseSpec("plain content with no FR markers.");
    expect(result.requirements).toEqual([]);
    expect(result.nonGoals).toEqual([]);
  });

  it("preserves the rawContent (post-frontmatter) in the result", () => {
    const raw = `---\nname: x\n---\n\nbody-text`;
    const result = parseSpec(raw);
    expect(result.rawContent.trim()).toBe("body-text");
  });
});

describe("parseTasks", () => {
  it("extracts open and done task items with ID+title+done flag", () => {
    const raw = `[ ] (1-1) Set up CI pipeline\n[x] (1-2) Configure pre-commit hook\n[X] (2-1) Write README`;
    const result = parseTasks(raw);
    expect(result.tasks).toHaveLength(3);
    const openTask = result.tasks.find((t) => t.id === "1-1");
    expect(openTask?.done).toBe(false);
    expect(openTask?.title).toBe("Set up CI pipeline");
    const doneTasks = result.tasks.filter((t) => t.done);
    expect(doneTasks).toHaveLength(2);
  });

  it("computes accurate total + done counts in stats", () => {
    const raw = `[ ] (1-1) Open\n[x] (1-2) Done\n[ ] (2-1) Open`;
    const result = parseTasks(raw);
    expect(result.stats.total).toBe(3);
    expect(result.stats.done).toBe(1);
  });

  it("attaches a 1-based line number to each task", () => {
    const raw = `header\n\n[ ] (1-1) First\n[ ] (1-2) Second`;
    const result = parseTasks(raw);
    expect(result.tasks[0]?.line).toBe(3);
    expect(result.tasks[1]?.line).toBe(4);
  });

  it("ignores task-like patterns that don't match the (X-Y) ID grammar", () => {
    const raw = `[ ] No id at all\n[ ] (bad) Wrong format\n[x] (1-1) Valid one`;
    const result = parseTasks(raw);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.id).toBe("1-1");
  });

  it("extracts phase groups from `## ` headings", () => {
    const raw = `## Phase 1: Setup\n[ ] (1-1) X\n## Phase 2: Build\n[ ] (2-1) Y`;
    const result = parseTasks(raw);
    expect(result.phases.length).toBeGreaterThan(0);
    expect(result.phases.some((p) => p.name.includes("Phase"))).toBe(true);
  });

  it("returns empty results for raw input with no tasks", () => {
    const result = parseTasks("just some prose with no checkboxes.");
    expect(result.tasks).toEqual([]);
    expect(result.stats).toEqual({ total: 0, done: 0 });
  });

  it("handles empty input cleanly", () => {
    const result = parseTasks("");
    expect(result.tasks).toEqual([]);
    expect(result.phases).toEqual([]);
    expect(result.stats.total).toBe(0);
  });
});

describe("parseSpec edge cases", () => {
  it("handles spec with no Non-Goals section", () => {
    const raw = `---\ntitle: T\n---\n\nFR-1 hello\nNFR-2 world`;
    const result = parseSpec(raw);
    expect(result.requirements).toHaveLength(2);
    expect(result.nonGoals).toEqual([]);
  });
});

describe("parseJournal edge cases", () => {
  it("handles empty input", () => {
    const result = parseJournal("");
    expect(result.discussions).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("extracts heading discussions with generated IDs and status classification", () => {
    const raw = [
      "## Resolved 2026-04-25T10:00:00.000Z",
      "",
      "Body",
      "## Promoted: Carry forward",
      "",
      "2026-04-26T11:30Z",
      "## Open follow-up",
    ].join("\n");

    const result = parseJournal(raw);

    expect(result.discussions).toEqual([
      {
        id: "J-001",
        timestamp: "2026-04-25T10:00:00.000Z",
        status: "resolved",
        summary: "Resolved 2026-04-25T10:00:00.000Z",
        line: 1,
      },
      {
        id: "J-002",
        timestamp: "2026-04-26T11:30Z",
        status: "promoted",
        summary: "Promoted: Carry forward",
        line: 4,
      },
      {
        id: "J-003",
        timestamp: "",
        status: "open",
        summary: "Open follow-up",
        line: 7,
      },
    ]);
  });

  it("deduplicates multiple discussion IDs on the same journal line", () => {
    const result = parseJournal("01-D001 links to 01-D002");

    expect(result.discussions).toHaveLength(1);
    expect(result.discussions[0]?.id).toBe("01-D001");
  });

  it("handles discussion without timestamp on prior line", () => {
    const raw = `\n\n01-D001 some discussion`;
    const result = parseJournal(raw);
    expect(result.discussions).toHaveLength(1);
    expect(result.discussions[0]?.timestamp).toBe("");
  });
});
