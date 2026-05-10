import { describe, expect, it } from "vitest";

import { normalizeAfxUiActions, parseAfxUiActions, stripAfxUiActionBlocks } from "./afx-ui-actions";

describe("parseAfxUiActions", () => {
  it("parses ranked actions from the marker-bounded fenced JSON block", () => {
    const actions = parseAfxUiActions(`
Done.

<!-- AFX-UI-ACTIONS:START -->

\`\`\`json
[
  {
    "rank": 2,
    "label": "Review design",
    "command": "/afx-design review onboarding",
    "mode": "run",
    "reason": "Design is drafted.",
    "vocabulary": "Review = quality judgment."
  },
  {
    "rank": 1,
    "label": "Approve spec",
    "command": "/afx-spec approve onboarding",
    "mode": "run"
  }
]
\`\`\`

<!-- AFX-UI-ACTIONS:END -->
`);

    expect(actions).toEqual([
      {
        rank: 1,
        label: "Approve spec",
        command: "/afx-spec approve onboarding",
        mode: "run",
      },
      {
        rank: 2,
        label: "Review design",
        command: "/afx-design review onboarding",
        mode: "run",
        reason: "Design is drafted.",
        vocabulary: "Review = quality judgment.",
      },
    ]);
  });

  it("returns no actions for invalid JSON or missing markers", () => {
    expect(parseAfxUiActions("Next: /afx-next")).toEqual([]);
    expect(
      parseAfxUiActions(`
<!-- AFX-UI-ACTIONS:START -->
\`\`\`json
not json
\`\`\`
<!-- AFX-UI-ACTIONS:END -->
`),
    ).toEqual([]);
  });

  it("drops unsafe or malformed actions and keeps valid insert actions", () => {
    const actions = normalizeAfxUiActions([
      {
        rank: 1,
        label: "Shell",
        command: "rm -rf .",
        mode: "run",
      },
      {
        rank: 2,
        label: "Injected",
        command: "/afx-spec review foo && rm -rf .",
        mode: "run",
      },
      {
        rank: 3,
        label: "Bad mode",
        command: "/afx-next",
        mode: "open",
      },
      {
        rank: 4,
        label: "Draft refine",
        command: "/afx-spec refine onboarding",
        mode: "insert",
      },
    ]);

    expect(actions).toEqual([
      {
        rank: 4,
        label: "Draft refine",
        command: "/afx-spec refine onboarding",
        mode: "insert",
      },
    ]);
  });

  it("dedupes commands and renders at most three actions", () => {
    const content = `
<!-- AFX-UI-ACTIONS:START -->
[
  { "rank": 1, "label": "Next", "command": "/afx-next", "mode": "run" },
  { "rank": 2, "label": "Next again", "command": "/afx-next", "mode": "run" },
  { "rank": 3, "label": "Validate", "command": "/afx-spec validate a", "mode": "run" },
  { "rank": 4, "label": "Review", "command": "/afx-spec review a", "mode": "run" },
  { "rank": 5, "label": "Approve", "command": "/afx-spec approve a", "mode": "run" }
]
<!-- AFX-UI-ACTIONS:END -->
`;

    expect(parseAfxUiActions(content).map((action) => action.command)).toEqual([
      "/afx-next",
      "/afx-spec validate a",
      "/afx-spec review a",
    ]);
  });

  it("strips raw action blocks from visible assistant prose", () => {
    expect(
      stripAfxUiActionBlocks(`
Done.

<!-- AFX-UI-ACTIONS:START -->
[{"rank":1,"label":"Next","command":"/afx-next","mode":"run"}]
<!-- AFX-UI-ACTIONS:END -->

Next (ranked): /afx-next
`),
    ).toBe("Done.\n\nNext (ranked): /afx-next");
  });
});
