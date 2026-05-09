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

  it("routes standard spec.md to /afx-spec refine plus design authoring and approval", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "spec", format: "standard", section: "SPEC", feature: "auth" }),
    );
    expect(actions).toEqual([
      { label: "Refine", command: "/afx-spec refine auth", autoSend: false },
      { label: "Author", command: "/afx-design author auth", autoSend: false },
      { label: "Validate", command: "/afx-spec validate auth", autoSend: true },
      { label: "Review", command: "/afx-spec review auth", autoSend: true },
      { label: "Approve", command: "/afx-spec approve auth", autoSend: true },
    ]);
  });

  it("routes sprint SPEC section to refine, author next section, verify, and approve", () => {
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
      { label: "Author", command: "/afx-sprint design chat-foundation", autoSend: false },
      { label: "Verify", command: "/afx-sprint verify chat-foundation", autoSend: true },
      {
        label: "Approve",
        command: "/afx-sprint spec chat-foundation --approve",
        autoSend: true,
      },
    ]);
  });

  it("routes standard design.md to refine plus task authoring and approval", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "design", format: "standard", section: "DESIGN", feature: "auth" }),
    );
    expect(actions.map((a) => a.command)).toEqual([
      "/afx-design refine auth",
      "/afx-task plan auth",
      "/afx-design validate auth",
      "/afx-design review auth",
      "/afx-design approve auth",
    ]);
  });

  it("routes standard tasks.md without using the feature slug as a task id", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "tasks", format: "standard", section: "TASKS", feature: "auth" }),
    );
    expect(actions.map((a) => a.command)).toEqual([
      "/afx-task code all auth",
      "/afx-task verify all auth",
      "/afx-task pick",
      "/afx-task review auth",
      "/afx-task status auth",
    ]);
  });

  it("routes sprint TASKS section through /afx-sprint lifecycle commands", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "tasks", format: "sprint", section: "TASKS", feature: "feat" }),
    );
    expect(actions.map((a) => a.command)).toEqual([
      "/afx-sprint task feat",
      "/afx-sprint code feat",
      "/afx-sprint verify feat",
      "/afx-sprint task feat --approve",
      "/afx-sprint graduate feat",
    ]);
  });

  it("resolves old active-doc payloads when additive fields are missing", () => {
    const oldHostPayload = ctx({
      docKind: "tasks",
      format: "standard",
      section: "TASKS",
      feature: "auth",
    });

    expect(() => resolveDocActions(oldHostPayload)).not.toThrow();
    expect(resolveDocActions(oldHostPayload).map((a) => a.command)).toEqual([
      "/afx-task code all auth",
      "/afx-task verify all auth",
      "/afx-task pick",
      "/afx-task review auth",
      "/afx-task status auth",
    ]);
  });

  it("ignores additive active-doc payload fields until richer UI consumes them", () => {
    const newHostPayload = ctx({
      docKind: "tasks",
      format: "standard",
      section: "TASKS",
      feature: "auth",
      taskPhases: [
        {
          number: 2,
          name: "Bridge",
          completed: 0,
          total: 1,
          line: 20,
          items: [{ text: "Post task phases", completed: false, line: 21 }],
        },
      ],
      signOff: {
        ready: false,
        signable: false,
        allTasksChecked: false,
        allAgentVerified: true,
        pendingTasks: 1,
        pendingAgentRows: 0,
        pendingHumanRows: 0,
        alreadyLiving: false,
      },
      parsedFocuses: [{ id: "phase-2", label: "Phase 2: Bridge", slug: "phase-2-bridge" }],
      specStatus: "Approved",
      designStatus: "Approved",
      tasksStatus: "Draft",
      tasksCompleted: 0,
      tasksTotal: 1,
    });

    expect(() => resolveDocActions(newHostPayload)).not.toThrow();
    expect(resolveDocActions(newHostPayload)[0]?.command).toBe("/afx-task code all auth");
  });

  it("routes journal.md to supported /afx-session commands", () => {
    const actions = resolveDocActions(
      ctx({ docKind: "journal", format: "standard", feature: "auth" }),
    );
    expect(actions.map((a) => a.label)).toEqual(["Note", "Log", "Recap", "Promote", "Capture"]);
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
      { label: "Save", command: "/afx-context save", autoSend: false },
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
    expect(actions.find((action) => action.label === "Pick")?.command).toBe("/afx-task pick");
    expect(actions.find((action) => action.label === "Code")?.command).toBe(
      "/afx-task code all 227-app-workbench-shell",
    );
  });

  // ---------------------------------------------------------------------------
  // autoSend classification — the deterministic verbs (validate/approve/verify/
  // pick/list/load/recap) fire immediately; everything else is dialogic
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
    "tasks/Review",
    "tasks/Pick",
    "tasks/Verify",
    "tasks/Status",
    "tasks/Approve",
    "journal/Recap",
    "adr/List",
    "context/Load",
    "context/History",
  ]);
  const DRAFT_PAIRS = new Set([
    "spec/Refine",
    "spec/Author",
    "design/Refine",
    "design/Author",
    "tasks/Refine",
    "tasks/Code",
    "tasks/Graduate",
    "journal/Note",
    "journal/Log",
    "journal/Promote",
    "journal/Capture",
    "adr/Review",
    "adr/Supersede",
    "research/Explore",
    "research/Compare",
    "research/Summarize",
    "research/Finalize",
    "context/Save",
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
