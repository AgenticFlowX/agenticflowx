/**
 * Result-action parser tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { describe, expect, it } from "vitest";

import {
  parseResultActions,
  stripLegacyUiActionBlocks,
  stripResultActionSections,
} from "./result-actions";

const LEGACY_MARKER = `AFX-UI-${"ACTIONS"}`;

describe("parseResultActions", () => {
  it("extracts inline Next commands without requiring blockquotes", () => {
    const actions = parseResultActions("Done.\nNext: /afx-task verify 2.3");

    expect(actions).toMatchObject([
      {
        command: "/afx-task verify 2.3",
        label: "Verify",
        group: "quality",
        autoSend: true,
        status: "supported",
      },
    ]);
  });

  it("ignores commands outside explicit Next sections", () => {
    const actions = parseResultActions(`
Ran /afx-task verify 2.3 while checking the task.

Outcome: passed.
`);

    expect(actions).toEqual([]);
  });

  it("extracts ranked numbered lists and backtick-wrapped commands", () => {
    const actions = parseResultActions(`
Next (ranked):
1. \`/afx-spec validate chat-foundation\`
2. \`/afx-design review chat-foundation\`
3. /afx-task code 4.1 - implement the selected task
`);

    expect(actions.map((action) => action.command)).toEqual([
      "/afx-spec validate chat-foundation",
      "/afx-design review chat-foundation",
      "/afx-task code 4.1",
    ]);
    expect(actions.map((action) => action.group)).toEqual(["quality", "quality", "action"]);
    expect(actions.map((action) => action.autoSend)).toEqual([true, true, false]);
  });

  it("extracts markdown-emphasized Next labels with prose-led commands", () => {
    const actions = parseResultActions(`
Result: NOT YET READY FOR CODING.

**Next:**

1. /afx-sprint task postgresql-marketplace-backend-rewrite — add missing Refs mappings.
2. Then /afx-sprint task postgresql-marketplace-backend-rewrite -- approve — advance the task gate.
3. Then re-run /afx-sprint verify postgresql-marketplace-backend-rewrite
`);

    expect(actions.map((action) => action.command)).toEqual([
      "/afx-sprint task postgresql-marketplace-backend-rewrite",
      "/afx-sprint task postgresql-marketplace-backend-rewrite --approve",
      "/afx-sprint verify postgresql-marketplace-backend-rewrite",
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      "Refine Tasks",
      "Refine Tasks",
      "Verify",
    ]);
  });

  it("extracts bare unlisted commands after an inline Next label", () => {
    const feature = "999-fleeting/postgresql-marketplace-backend-rewrite";
    const actions = parseResultActions(`
4. Design lacks an explicit Key Decisions table or an explicit N/A note.

Result: NOT READY FOR CODING

Next: /afx-sprint task ${feature} convert Refs lines to canonical @see comments
/afx-sprint design ${feature} add explicit Key Decisions table or N/A note
/afx-sprint spec ${feature} --approve
`);

    expect(actions.map((action) => action.command)).toEqual([
      `/afx-sprint task ${feature} convert Refs lines to canonical @see comments`,
      `/afx-sprint design ${feature} add explicit Key Decisions table or N/A note`,
      `/afx-sprint spec ${feature} --approve`,
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      "Refine Tasks",
      "Refine Design",
      "Refine Spec",
    ]);
  });

  it("splits multiple bare commands from one inline Next paragraph", () => {
    const feature = "999-fleeting/postgresql-marketplace-backend-rewrite";
    const actions = parseResultActions(
      `Next: /afx-sprint task ${feature} fix refs /afx-sprint design ${feature} fix decisions`,
    );

    expect(actions.map((action) => action.command)).toEqual([
      `/afx-sprint task ${feature} fix refs`,
      `/afx-sprint design ${feature} fix decisions`,
    ]);
  });

  it("limits rendered candidates to the top three actions", () => {
    const actions = parseResultActions(`
Next (ranked):
1. /afx-task verify 2.3
2. /afx-task code 2.4
3. /afx-check path docs/specs/chat
4. /afx-next
`);

    expect(actions.map((action) => action.command)).toEqual([
      "/afx-task verify 2.3",
      "/afx-task code 2.4",
      "/afx-check path docs/specs/chat",
    ]);
  });

  it("stops parsing at ranked-section separators and ignores static entries below", () => {
    const actions = parseResultActions(`
Next (ranked):

1. /afx-sprint design dapi-394-warm-container-app-poc --approve
2. /afx-sprint task dapi-394-warm-container-app-poc --approve
3. /afx-sprint verify dapi-394-warm-container-app-poc
   ──
4. /afx-next
5. /afx-session note "capture"
`);

    expect(actions.map((action) => action.command)).toEqual([
      "/afx-sprint design dapi-394-warm-container-app-poc --approve",
      "/afx-sprint task dapi-394-warm-container-app-poc --approve",
      "/afx-sprint verify dapi-394-warm-container-app-poc",
    ]);
  });

  it("dedupes commands while preserving first-seen order", () => {
    const actions = parseResultActions(`
Next: /afx-check all docs/specs/chat
1. \`/afx-check all docs/specs/chat\`
2. /afx-next
`);

    expect(actions.map((action) => action.command)).toEqual([
      "/afx-check all docs/specs/chat",
      "/afx-next",
    ]);
  });

  it("preserves long spec commands while removing trailing reasons", () => {
    const longSpec = "dapi-394-warm-container-app-poc-with-approval-gates-and-long-name";
    const actions = parseResultActions(`
Next (ranked):
1. /afx-sprint design ${longSpec} --approve # Design is still Draft
2. /afx-sprint task ${longSpec} --approve # Tasks are still Draft
3. /afx-sprint verify ${longSpec} # Confirm all gates pass
`);

    expect(actions.map((action) => action.command)).toEqual([
      `/afx-sprint design ${longSpec} --approve`,
      `/afx-sprint task ${longSpec} --approve`,
      `/afx-sprint verify ${longSpec}`,
    ]);
  });

  it("keeps unknown commands draft-only", () => {
    const actions = parseResultActions("Next: `/afx-task deploy prod`");

    expect(actions).toEqual([
      {
        command: "/afx-task deploy prod",
        family: "afx-task",
        subcommand: "deploy",
        label: "Deploy",
        group: "unknown",
        autoSend: false,
        status: "unknown",
      },
    ]);
  });

  it("recognizes draft-only aliases from the command catalog", () => {
    const actions = parseResultActions("Next: /afx-session active user-auth");

    expect(actions).toMatchObject([
      {
        command: "/afx-session active user-auth",
        label: "Active",
        group: "unknown",
        autoSend: false,
        status: "draft-only-alias",
      },
    ]);
  });
});

describe("stripResultActionSections", () => {
  it("removes parsed Next prose including static entries below the separator", () => {
    const stripped = stripResultActionSections(`
Review complete.

Next (ranked):

1. /afx-task verify 2.3
2. /afx-task code 2.4
   ──
3. /afx-next

Evidence remains visible.
`);

    expect(stripped).toBe("Review complete.\n\nEvidence remains visible.");
  });

  it("removes inline Next lines without disturbing surrounding prose", () => {
    const stripped = stripResultActionSections("Done.\nNext: /afx-task verify 2.3\nStill here.");

    expect(stripped).toBe("Done.\nStill here.");
  });

  it("removes markdown-emphasized Next blocks", () => {
    const stripped = stripResultActionSections(`
Result remains visible.

**Next:**


1. /afx-sprint task postgresql-marketplace-backend-rewrite — add missing Refs mappings.
2. Then /afx-sprint verify postgresql-marketplace-backend-rewrite
`);

    expect(stripped).toBe("Result remains visible.");
  });

  it("removes bare unlisted commands after an inline Next label", () => {
    const feature = "999-fleeting/postgresql-marketplace-backend-rewrite";
    const stripped = stripResultActionSections(`
Result: NOT READY FOR CODING

Next: /afx-sprint task ${feature} convert Refs lines to canonical @see comments
/afx-sprint design ${feature} add explicit Key Decisions table or N/A note
/afx-sprint spec ${feature} --approve
`);

    expect(stripped).toBe("Result: NOT READY FOR CODING");
  });
});

describe("stripLegacyUiActionBlocks", () => {
  it("removes obsolete commented marker blocks without touching surrounding prose", () => {
    const stripped = stripLegacyUiActionBlocks(`
Review complete.

<!-- ${LEGACY_MARKER}:START -->
{"actions":[{"label":"Run"}]}
<!-- ${LEGACY_MARKER}:END -->

Evidence remains visible.
`);

    expect(stripped).toBe("Review complete.\n\nEvidence remains visible.");
  });

  it("removes obsolete plain marker blocks from stale persisted transcripts", () => {
    const stripped = stripLegacyUiActionBlocks(`
Before.
${LEGACY_MARKER}:START
{"actions":[]}
${LEGACY_MARKER}:END
After.
`);

    expect(stripped).toBe("Before.\nAfter.");
  });
});
