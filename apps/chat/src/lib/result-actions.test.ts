/**
 * Result-action parser tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { describe, expect, it } from "vitest";

import { parseResultActions } from "./result-actions";

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
