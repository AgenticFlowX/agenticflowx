/**
 * Workbench markdown reader tests.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PRD-READER] [DES-TEST]
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { cleanMarkdownForReading } from "./markdown-cleanup";
import { MinimalMarkdown } from "./markdown-render";

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
});

describe("cleanMarkdownForReading", () => {
  it("protects fenced code while cleaning visible prose", () => {
    const cleaned = cleanMarkdownForReading(NOISY_PRD);

    expect(cleaned).not.toContain("AFX managed marker");
    expect(cleaned).not.toContain("@see docs");
    expect(cleaned).toContain("## Functional Requirements");
    expect(cleaned).toContain("Keep literal [FR-1] trace token in code.");
    expect(cleaned).toContain("<!-- keep comment in code -->");
  });
});
