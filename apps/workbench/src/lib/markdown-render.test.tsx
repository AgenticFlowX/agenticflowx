/**
 * Workbench markdown reader tests.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PRD-READER] [DES-TEST]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cleanInlineMarkdownText, cleanMarkdownForReading } from "./markdown-cleanup";
import { MinimalMarkdown } from "./markdown-render";
import { ALL_PREVIEW_FIXTURES } from "./preview-fixtures.test-data";

const NOISY_PRD = `---
afx: true
type: SPEC
---

<!-- AFX managed marker that should not render -->
# [DES-OVR] Warranty Claims PRD

## [FR-1] Functional Requirements

@see docs/specs/410-warranty-claims/spec.md [FR-1]

See [tasks.md](./tasks.md) for implementation details.

| Role | Access |
| ---- | ------ |
| Contractor | Own claims |
| Admin | All claims |

\`\`\`text
Keep literal [FR-1] trace token in code.
<!-- keep comment in code -->
\`\`\`
`;

describe("MinimalMarkdown", () => {
  it("renders a cleaned PRD with tables while hiding AFX reader noise", () => {
    render(<MinimalMarkdown content={NOISY_PRD} hideTitle />);

    expect(screen.queryByText("Warranty Claims PRD")).not.toBeInTheDocument();
    expect(screen.queryByText(/AFX managed marker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@see docs/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Functional Requirements" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Own claims" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "tasks.md" })).toHaveAttribute("href", "./tasks.md");
  });

  it("contains long prose, inline code, and ascii diagrams inside the reader pane", () => {
    render(
      <MinimalMarkdown
        content={`## Diagram

This paragraph includes \`packages/configs/src/edge/marketplace/themes/super-long-config-key.ts\` and a verylongunbrokenimplementationidentifierthatshouldwrapinsidecolumns.

\`\`\`text
+----------------------+     +----------------------+
| spec.md              | --> | tasks.md             |
+----------------------+     +----------------------+
\`\`\`
`}
      />,
    );

    const paragraph = screen.getByText(/verylongunbrokenimplementationidentifier/i).closest("p");
    const inlineCode = screen.getByText(/super-long-config-key/i).closest("code");
    const diagram = screen.getByText(/\+----------------------\+/).closest("pre");

    expect(paragraph).toHaveClass("[overflow-wrap:anywhere]");
    expect(inlineCode).toHaveClass("[overflow-wrap:anywhere]");
    expect(diagram).toHaveClass("overflow-x-auto");
  });

  it("renders AFX label/value blockquotes as definition callouts", () => {
    render(
      <MinimalMarkdown
        content={`> **Format**: Single-document SDD.
> **Approval gates**: Sections must be approved.
> **Graduation**: Run \`/afx-sprint graduate demo\`.`}
      />,
    );

    const callout = screen.getByText("Format").closest("aside");

    expect(callout).toHaveAttribute("data-afx-md-section", "definition-callout");
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.getByText("Approval gates")).toBeInTheDocument();
    expect(screen.getByText("Graduation")).toBeInTheDocument();
    expect(screen.getByText(/Single-document SDD/i)).toBeInTheDocument();
    expect(screen.getByText("/afx-sprint graduate demo")).toBeInTheDocument();
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  });

  it("keeps prose blockquotes as ordinary quotes", () => {
    render(<MinimalMarkdown content={"> The WHAT — requirements, acceptance, scope."} />);

    expect(screen.getByText(/The WHAT/i).closest("blockquote")).toBeInTheDocument();
    expect(screen.queryByText(/The WHAT/i)?.closest("aside")).not.toBeInTheDocument();
  });

  it("repairs loose table rows so work-session bodies stay inside the table", () => {
    render(
      <MinimalMarkdown
        content={`## Work Sessions

| Date | Task | Action |
| ---- | ---- | ------ |

| 2026-04-28 | 0.1 | Completed |
| 2026-04-28 | 0.2 | Completed |
`}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "0.1" })).toBeInTheDocument();
    expect(screen.queryByText(/\| 2026-04-28 \| 0\.1/i)).not.toBeInTheDocument();
  });

  it("keeps adjacent tables split when a blank line precedes a new table header", () => {
    render(
      <MinimalMarkdown
        content={`| Stable field | Purpose |
| ------------ | ------- |
| format | Document shape |

| Supporting type | Shape |
| --------------- | ----- |
| FocusOption | Stable display label |
`}
      />,
    );

    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Supporting type" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: /---------------/ })).not.toBeInTheDocument();
  });

  it("emits toggle targets for spaced and compact markdown task checkboxes", () => {
    const onCheckboxToggle = vi.fn();
    render(
      <MinimalMarkdown
        content={`- [] Compact open
- [x] Done
`}
        onCheckboxToggle={onCheckboxToggle}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const [compactOpen, done] = checkboxes;
    if (!compactOpen || !done) {
      throw new Error("Expected markdown task checkboxes to render.");
    }
    expect(compactOpen).not.toBeChecked();
    expect(done).toBeChecked();

    fireEvent.click(compactOpen);

    expect(onCheckboxToggle).toHaveBeenCalledWith({
      kind: "task",
      checked: false,
      completed: true,
      line: 1,
      checkboxIndex: 0,
    });
  });

  it("renders Work Sessions signoff cells as toggleable checkboxes", () => {
    const onCheckboxToggle = vi.fn();
    render(
      <MinimalMarkdown
        content={`## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-28 | 1.1 | Completed | a.ts | [x] | [] |
`}
        onCheckboxToggle={onCheckboxToggle}
      />,
    );

    const human = screen.getByRole("checkbox", { name: "Toggle human signoff row 1" });
    expect(human).not.toBeChecked();
    fireEvent.click(human);

    expect(onCheckboxToggle).toHaveBeenCalledWith({
      kind: "session",
      checked: false,
      completed: true,
      line: 5,
      sessionIndex: 0,
      column: "human",
    });
  });

  it("keeps every Work Sessions Agent/Human marker live after reader cleanup", () => {
    const onCheckboxToggle = vi.fn();
    render(
      <MinimalMarkdown
        content={`---
afx: true
type: TASKS
status: Draft
---

## 4. Work Sessions

<!-- Columns: Date | Task | Action | Files Modified | Agent | Human -->
| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-28 | 7.1 | Coded | .github/dependabot.yml | [x] | [] |
| 2026-04-29 | 7.2 | Coded | .github/PULL_REQUEST_TEMPLATE.md | [x] | [ ] |
`}
        onCheckboxToggle={onCheckboxToggle}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Toggle agent signoff row 2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Toggle human signoff row 2" })).not.toBeChecked();
    expect(screen.queryByRole("cell", { name: "[x]" })).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "[ ]" })).not.toBeInTheDocument();
  });

  it("renders archived generated Work Sessions markers as line-targeted controls", () => {
    const onCheckboxToggle = vi.fn();
    render(
      <MinimalMarkdown
        content={`## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-25 | 6.2 | Coded | .github/workflows/marketplace-publish.yml | [x] | [ ] |
| 2026-04-25 | 7.1 | Coded | .github/dependabot.yml | [x] | [ ] |
| 2026-04-25 | 7.2 | Coded | .github/PULL_REQUEST_TEMPLATE.md, .github/ISSUE_TEMPLATE/\\*, .gitmessage | [x] | [ ] |
`}
        onCheckboxToggle={onCheckboxToggle}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.queryByRole("cell", { name: "[x]" })).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "[ ]" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle human signoff row 3" }));

    expect(onCheckboxToggle).toHaveBeenCalledWith({
      kind: "session",
      checked: false,
      completed: true,
      line: 7,
      sessionIndex: 2,
      column: "human",
    });
  });

  it("does not bind unrelated table checkbox markers to Work Sessions toggles", () => {
    const onCheckboxToggle = vi.fn();
    render(
      <MinimalMarkdown
        content={`| Flag | Meaning |
| ---- | ------- |
| [x] | Display only |

## Work Sessions

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
| 2026-04-28 | 1.1 | Completed | a.ts | [x] | [] |
`}
        onCheckboxToggle={onCheckboxToggle}
      />,
    );

    expect(screen.getByRole("cell", { name: "[x]" })).toBeInTheDocument();

    const human = screen.getByRole("checkbox", { name: "Toggle human signoff row 1" });
    fireEvent.click(human);

    expect(onCheckboxToggle).toHaveBeenCalledWith({
      kind: "session",
      checked: false,
      completed: true,
      line: 9,
      sessionIndex: 0,
      column: "human",
    });
  });

  for (const fixture of ALL_PREVIEW_FIXTURES) {
    it(`renders sanitized preview fixture markdown: ${fixture.id}`, () => {
      render(<MinimalMarkdown content={fixture.content} />);

      expect(screen.getByRole("heading", { level: 1, name: fixture.title })).toBeInTheDocument();
      expect(screen.getAllByText(fixture.finalText, { exact: false }).length).toBeGreaterThan(0);
      if (fixture.tableCell) {
        expect(screen.getAllByRole("cell", { name: fixture.tableCell }).length).toBeGreaterThan(0);
      }
      if (fixture.rawTextAbsent) {
        expect(screen.queryByText(fixture.rawTextAbsent)).not.toBeInTheDocument();
      }
      expect(screen.queryByText(/afx:\s*true/i)).not.toBeInTheDocument();
    });
  }
});

describe("cleanMarkdownForReading", () => {
  it("cleans markdown heading labels while preserving literal code content", () => {
    expect(
      cleanInlineMarkdownText("ADR-0009: Migrate Pi Packages to `@earendil-works/*` Scope [ADR-1]"),
    ).toBe("ADR-0009: Migrate Pi Packages to @earendil-works/* Scope");
    expect(cleanInlineMarkdownText("Why not pick adapter #2 here")).toBe(
      "Why not pick adapter #2 here",
    );
  });

  it("protects fenced code while cleaning visible prose", () => {
    const cleaned = cleanMarkdownForReading(NOISY_PRD);

    expect(cleaned).not.toContain("AFX managed marker");
    expect(cleaned).not.toContain("@see docs");
    expect(cleaned).toContain("## Functional Requirements");
    expect(cleaned).toContain("Keep literal [FR-1] trace token in code.");
    expect(cleaned).toContain("<!-- keep comment in code -->");
  });

  it("removes blank lines that split markdown table headers from rows", () => {
    const cleaned = cleanMarkdownForReading(`| Date | Task |
| ---- | ---- |

| 2026-04-28 | 0.1 |
`);

    expect(cleaned).toContain("| --- | --- |\n| 2026-04-28 | 0.1 |");
  });

  it("does not treat internal sprint dividers as frontmatter", () => {
    const cleaned = cleanMarkdownForReading(`## References

- Existing context

---

## 1. Spec

#### Functional Requirements

| ID | Requirement | Priority |
| -- | ----------- | -------- |
| FR-1 | Preserve the section after a divider. | Must Have |
`);

    expect(cleaned).toContain("## 1. Spec");
    expect(cleaned).toContain("#### Functional Requirements");
    expect(cleaned).toContain("| FR-1 | Preserve the section after a divider. | Must Have |");
  });
});
