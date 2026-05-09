/**
 * Doc-action routing — covers Spec mode composer-strip and welcome-card actions.
 *
 * Asserts:
 *  - 3-action cap per docKind
 *  - Sprint vs standard 4-file routing
 *  - Feature-arg threading (including nested-folder paths)
 *  - Friendly labels for the strip title
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { describe, expect, it } from "vitest";

import { type ActiveDocCtx, EMPTY_DOC_CTX, describeDoc, resolveDocActions } from "./doc-actions";

function ctx(overrides: Partial<ActiveDocCtx>): ActiveDocCtx {
  return { ...EMPTY_DOC_CTX, ...overrides };
}

describe("resolveDocActions", () => {
  it("returns no actions when docKind is null", () => {
    expect(resolveDocActions(EMPTY_DOC_CTX)).toEqual([]);
  });

  it("caps every kind at 5 actions (composer-strip readability)", () => {
    const kinds = ["spec", "design", "tasks", "journal", "adr", "research", "context"] as const;
    for (const kind of kinds) {
      const actions = resolveDocActions(ctx({ docKind: kind, format: "standard", feature: "foo" }));
      expect(actions.length, `expected ≤5 actions for docKind=${kind}`).toBeLessThanOrEqual(5);
    }
  });

  it("routes standard spec.md to /afx-spec refine|validate|review|approve", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "spec", format: "standard", section: "SPEC", feature: "auth" }),
    );
    expect(actions).toEqual([
      { label: "Refine", command: "/afx-spec refine auth", autoSend: false },
      { label: "Validate", command: "/afx-spec validate auth", autoSend: true },
      { label: "Review", command: "/afx-spec review auth", autoSend: true },
      { label: "Approve", command: "/afx-spec approve auth", autoSend: true },
    ]);
  });

  it("routes sprint SPEC section to /afx-sprint spec|verify|spec --approve (verify replaces validate+review)", () => {
    const actions = resolveDocActions(
      ctx({
        docKind: "spec",
        format: "sprint",
        section: "SPEC",
        feature: "chat-foundation",
      }),
    );
    expect(actions).toEqual([
      { label: "Refine", command: "/afx-sprint spec chat-foundation", autoSend: false },
      { label: "Verify", command: "/afx-sprint verify chat-foundation", autoSend: true },
      {
        label: "Approve",
        command: "/afx-sprint spec chat-foundation --approve",
        autoSend: true,
      },
    ]);
  });

  it("routes standard design.md to /afx-design refine|validate|review|approve", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "design", format: "standard", section: "DESIGN", feature: "auth" }),
    );
    expect(actions.map((a) => a.command)).toEqual([
      "/afx-design refine auth",
      "/afx-design validate auth",
      "/afx-design review auth",
      "/afx-design approve auth",
    ]);
  });

  it("routes standard tasks.md to /afx-task pick|code|verify|status", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "tasks", format: "standard", section: "TASKS", feature: "auth" }),
    );
    expect(actions.map((a) => a.command)).toEqual([
      "/afx-task pick auth",
      "/afx-task code auth",
      "/afx-task verify auth",
      "/afx-task status auth",
    ]);
  });

  it("routes sprint TASKS section through /afx-sprint code|verify (Pick + Status stay /afx-task)", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "tasks", format: "sprint", section: "TASKS", feature: "feat" }),
    );
    expect(actions.map((a) => a.command)).toEqual([
      "/afx-task pick feat",
      "/afx-sprint code feat",
      "/afx-sprint verify feat",
      "/afx-task status feat",
    ]);
  });

  it("routes journal.md to /afx-session note|log|recap|active|promote", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "journal", format: "standard", feature: "auth" }),
    );
    expect(actions.map((a) => a.label)).toEqual(["Note", "Log", "Recap", "Active", "Promote"]);
    expect(actions.every((a) => a.command.startsWith("/afx-session "))).toBe(true);
  });

  it("routes ADR docs to /afx-adr review|supersede|list", () => {
    const actions = resolveDocActions(ctx({ docKind: "adr", format: "standard", feature: null }));
    expect(actions.map((a) => a.label)).toEqual(["Review", "Supersede", "List"]);
    expect(actions.every((a) => a.command.startsWith("/afx-adr "))).toBe(true);
  });

  it("routes research docs to /afx-research explore|compare|summarize|finalize", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "research", format: "standard", feature: "auth" }),
    );
    expect(actions.map((a) => a.label)).toEqual(["Explore", "Compare", "Summarize", "Finalize"]);
    expect(actions.every((a) => a.command.startsWith("/afx-research "))).toBe(true);
  });

  it("routes .afx/context.md to /afx-context load|save|history|impact", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "context", format: "standard", feature: null }),
    );
    expect(actions).toEqual([
      { label: "Load", command: "/afx-context load", autoSend: true },
      { label: "Save", command: "/afx-context save", autoSend: true },
      { label: "History", command: "/afx-context history", autoSend: true },
      { label: "Impact", command: "/afx-context impact", autoSend: false },
    ]);
  });

  it("omits the feature suffix when feature is null", () => {
    const actions = resolveDocActions(ctx({ docKind: "spec", format: "standard", feature: null }));
    expect(actions[0]?.command).toBe("/afx-spec refine");
  });

  it("preserves nested-folder feature paths verbatim in the command suffix", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "tasks", format: "standard", feature: "227-app-workbench-shell" }),
    );
    expect(actions[0]?.command).toBe("/afx-task pick 227-app-workbench-shell");
  });

  // ---------------------------------------------------------------------------
  // autoSend classification — the deterministic verbs (validate/approve/verify/
  // pick/list/load/save/recap) fire immediately; everything else is dialogic
  // and stays in the draft so the user can refine before sending.
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  // ---------------------------------------------------------------------------

  // Per-(docKind, label) classification map. `Review` is autoSend for spec /
  // design (LLM judgment pass takes no extra args) but DRAFT for ADR (we don't
  // currently plumb the ADR ID into the bridge payload).
  const AUTO_PAIRS = new Set([
    "spec/Validate",
    "spec/Review",
    "spec/Approve",
    "spec/Verify", // sprint variant
    "design/Validate",
    "design/Review",
    "design/Approve",
    "design/Verify", // sprint variant
    "tasks/Pick",
    "tasks/Verify",
    "tasks/Status",
    "journal/Log",
    "journal/Recap",
    "journal/Active",
    "adr/List",
    "context/Load",
    "context/Save",
    "context/History",
  ]);
  const DRAFT_PAIRS = new Set([
    "spec/Refine",
    "design/Refine",
    "tasks/Code",
    "journal/Note",
    "journal/Promote",
    "adr/Review",
    "adr/Supersede",
    "research/Explore",
    "research/Compare",
    "research/Summarize",
    "research/Finalize",
    "context/Impact",
  ]);

  it("classifies every action correctly per (docKind, label)", () => {
    const docKinds = ["spec", "design", "tasks", "journal", "adr", "research", "context"] as const;
    for (const docKind of docKinds) {
      const actions = resolveDocActions(ctx({ docKind, format: "standard", feature: "auth" }));
      for (const action of actions) {
        const key = `${docKind}/${action.label}`;
        if (AUTO_PAIRS.has(key)) {
          expect(action.autoSend, `${key} should auto-send`).toBe(true);
        } else if (DRAFT_PAIRS.has(key)) {
          expect(action.autoSend, `${key} should stay draft`).toBe(false);
        } else {
          throw new Error(
            `Unclassified action ${key}: add it to AUTO_PAIRS or DRAFT_PAIRS in the test`,
          );
        }
      }
    }
  });

  it("preserves autoSend=true for sprint approval (--approve flag is the gate, no extra context)", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "spec", format: "sprint", section: "SPEC", feature: "feat" }),
    );
    const approve = actions.find((a) => a.label === "Approve");
    expect(approve?.autoSend).toBe(true);
    expect(approve?.command).toContain("--approve");
  });

  it("keeps every research action draft — the verbs are inherently dialogic", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "research", format: "standard", feature: "auth" }),
    );
    expect(actions.every((a) => a.autoSend === false)).toBe(true);
  });
});

describe("describeDoc", () => {
  const cases: Array<[ActiveDocCtx, string]> = [
    [ctx({ docKind: "spec" }), "spec.md"],
    [ctx({ docKind: "design" }), "design.md"],
    [ctx({ docKind: "tasks" }), "tasks.md"],
    [ctx({ docKind: "journal" }), "journal.md"],
    [ctx({ docKind: "adr" }), "ADR"],
    [ctx({ docKind: "research" }), "research note"],
    [ctx({ docKind: "context" }), ".afx/context.md"],
    [ctx({ docKind: null, format: "sprint", feature: "user-auth" }), "user-auth.md"],
    [ctx({ docKind: null, format: "sprint", feature: null }), "sprint.md"],
    [ctx({ docKind: null, format: null }), "AFX doc"],
  ];

  for (const [input, expected] of cases) {
    it(`returns "${expected}" for docKind=${input.docKind} format=${input.format}`, () => {
      expect(describeDoc(input)).toBe(expected);
    });
  }
});
