/**
 * SDD workflow guide derivation tests.
 *
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
 */
import { describe, expect, it } from "vitest";

import type { ChatMessageView } from "@afx/shared";

import { parseResultActions } from "./result-actions";
import { deriveSddWorkflowGuide } from "./sdd-workflow-guide";

describe("deriveSddWorkflowGuide", () => {
  it("creates a timeline guide from changed SDD files and ranked next actions", () => {
    const actions = parseResultActions(`
Next:
1. /afx-design review billing-export
2. /afx-task verify billing-export
`);
    const guide = deriveSddWorkflowGuide(
      assistant("a1", "Created the spec.", [
        {
          toolCallId: "write-spec",
          toolName: "write_file",
          status: "ok",
          args: { path: "docs/specs/billing-export/spec.md" },
          summary: "wrote spec",
        },
      ]),
      actions,
    );

    expect(guide).toMatchObject({
      feature: "billing-export",
      eventLabel: "SDD document changed",
      currentStep: "spec",
      previewPath: "docs/specs/billing-export/spec.md",
      // Phase-aware: recommend advancing to the next lifecycle step, not refining
      // the document just written.
      recommended: {
        label: "Author design",
        command: "/afx-design author billing-export",
        mode: "insert",
      },
    });
    expect(guide?.files).toEqual([
      expect.objectContaining({
        path: "docs/specs/billing-export/spec.md",
        label: "Spec",
        primary: true,
      }),
    ]);
    // The guide is the single action owner for SDD turns, including parsed
    // agent actions that would otherwise render in a separate Run Next rail.
    const alternativeCommands = guide?.alternatives.map((action) => action.command);
    expect(alternativeCommands).toContain("/afx-spec refine billing-export");
    expect(alternativeCommands).toContain("/afx-session capture --links billing-export");
    expect(alternativeCommands).toContain("/afx-design review billing-export");
    expect(alternativeCommands).toContain("/afx-task verify billing-export");
  });

  it("uses result actions to choose the current SDD phase when several docs changed", () => {
    const actions = parseResultActions(`
Next:
1. /afx-task verify billing-export
2. /afx-design review billing-export
`);
    const guide = deriveSddWorkflowGuide(
      assistant("a1", "Updated the SDD set.", [
        {
          toolCallId: "write-spec",
          toolName: "write_file",
          status: "ok",
          args: { path: "docs/specs/billing-export/spec.md" },
          summary: "wrote spec",
        },
        {
          toolCallId: "write-design",
          toolName: "write_file",
          status: "ok",
          args: { path: "docs/specs/billing-export/design.md" },
          summary: "wrote design",
        },
        {
          toolCallId: "write-tasks",
          toolName: "write_file",
          status: "ok",
          args: { path: "docs/specs/billing-export/tasks.md" },
          summary: "wrote tasks",
        },
      ]),
      actions,
    );

    expect(guide).toMatchObject({
      currentStep: "tasks",
      previewPath: "docs/specs/billing-export/tasks.md",
      // Tasks plan written → next step is to start implementing, not re-verify.
      recommended: {
        label: "Start implementation",
        command: "/afx-task code billing-export",
        mode: "insert",
      },
    });
    expect(guide?.files[0]).toMatchObject({
      path: "docs/specs/billing-export/tasks.md",
      primary: true,
    });
    // Agent-surfaced actions stay reachable in the guide overflow.
    expect(guide?.alternatives.map((action) => action.command)).toContain(
      "/afx-task verify billing-export",
    );
    expect(guide?.alternatives.map((action) => action.command)).toContain(
      "/afx-task status billing-export",
    );
  });

  it("ignores streaming messages and non-SDD file changes", () => {
    expect(
      deriveSddWorkflowGuide(
        { ...assistant("a1", "writing", []), streaming: true },
        parseResultActions("Next: /afx-next"),
      ),
    ).toBeNull();
    expect(
      deriveSddWorkflowGuide(
        assistant("a2", "changed code", [
          {
            toolCallId: "write-code",
            toolName: "write_file",
            status: "ok",
            args: { path: "apps/chat/src/index.ts" },
            summary: "wrote code",
          },
        ]),
        [],
      ),
    ).toBeNull();
  });
});

function assistant(
  id: string,
  content: string,
  tools: NonNullable<ChatMessageView["tools"]>,
): ChatMessageView {
  return {
    id,
    role: "assistant",
    content,
    createdAt: Date.UTC(2026, 5, 20, 10, 0, 0),
    tools,
  };
}
