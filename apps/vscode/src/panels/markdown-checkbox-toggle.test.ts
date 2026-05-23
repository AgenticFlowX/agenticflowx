/**
 * Markdown checkbox mutation helper tests.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-API] [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { describe, expect, it } from "vitest";

import {
  approveWorkSessionCheckboxes,
  toggleAllWorkSessionCheckboxes,
  toggleMarkdownCheckboxLine,
  toggleWorkSessionCheckbox,
  toggleWorkSessionCheckboxLine,
} from "./markdown-checkbox-toggle";

describe("markdown checkbox toggles", () => {
  it("toggles spaced and compact task markers on a source line", () => {
    expect(toggleMarkdownCheckboxLine("- [ ] Open task", 1, true)).toBe("- [x] Open task");
    expect(toggleMarkdownCheckboxLine("- [] Open task", 1, true)).toBe("- [x] Open task");
    expect(toggleMarkdownCheckboxLine("- [x] Done task", 1, false)).toBe("- [ ] Done task");
  });

  it("toggles the requested Work Sessions Agent/Human cell", () => {
    const raw = `## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-28 | 1.1 | Completed | a.ts | [x] | [] |
| 2026-04-29 | 1.2 | Completed | b.ts | [ ] | [ ] |
`;

    expect(toggleWorkSessionCheckbox(raw, 0, "human", true)).toContain(
      "| 2026-04-28 | 1.1 | Completed | a.ts | [x] | [x] |",
    );
    expect(toggleWorkSessionCheckbox(raw, 1, "agent", true)).toContain(
      "| 2026-04-29 | 1.2 | Completed | b.ts | [x] | [ ] |",
    );
  });

  it("bulk toggles and approves Work Sessions signoff cells", () => {
    const raw = `## 4. Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-28 | 1.1 | Completed | a.ts | [x] | [] |
| 2026-04-29 | 1.2 | Completed | b.ts | [ ] | [ ] |
`;

    expect(toggleAllWorkSessionCheckboxes(raw, "agent", true)).toContain(
      "| 2026-04-29 | 1.2 | Completed | b.ts | [x] | [ ] |",
    );
    expect(approveWorkSessionCheckboxes(raw)).toContain(
      "| 2026-04-28 | 1.1 | Completed | a.ts | [x] | [x] |",
    );
    expect(approveWorkSessionCheckboxes(raw)).toContain(
      "| 2026-04-29 | 1.2 | Completed | b.ts | [ ] | [ ] |",
    );
  });

  it("toggles Work Sessions cells by source line to avoid row-index drift", () => {
    const raw = `## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-25 | 6.2 | Coded | .github/workflows/marketplace-publish.yml | [x] | [ ] |
| 2026-04-25 | 7.1 | Coded | .github/dependabot.yml | [x] | [ ] |
| 2026-04-25 | 7.2 | Coded | .github/PULL_REQUEST_TEMPLATE.md, .github/ISSUE_TEMPLATE/\\*, .gitmessage | [x] | [ ] |
`;

    expect(toggleWorkSessionCheckboxLine(raw, 7, "human", true)).toContain(
      "| 2026-04-25 | 7.2 | Coded | .github/PULL_REQUEST_TEMPLATE.md, .github/ISSUE_TEMPLATE/\\*, .gitmessage | [x] | [x] |",
    );
  });
});
