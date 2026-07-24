/**
 * @see docs/specs/221-app-workbench-board/spec.md [FR-5] [FR-8] [FR-14] [NFR-3] [NFR-5]
 * @see docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-BOARD-SERIALIZATION] [DES-BOARD-PORTABLE-LINK]
 */
import { describe, expect, it } from "vitest";

import { mutateKanbanMarkdown, parseKanbanMarkdown } from "./kanban-markdown";

const BOARD = `---
afx: true
type: KANBAN
title: "Release"
custom: keep-me
---

# Release

Preamble **must stay**.

## Todo

- First card
- [Task 2.4](docs/specs/example/tasks.md#24)
  <!-- afx:card {"v":1,"id":"work-one","workItem":{"kind":"task","root":"repo","path":"docs/specs/example/tasks.md","wbs":"2.4"}} -->

### Multiline card

Body line one.
Body line two.

<!-- opaque todo comment -->

## Todo

- First card

## Done

## Board Rules

- This opaque rule is not a card.
`;

describe("KanbanMarkdownDocument", () => {
  it("parses duplicate columns/cards with stable unique source identities and no rewrite", () => {
    const document = parseKanbanMarkdown(BOARD);

    expect(document.error).toBeUndefined();
    expect(document.content).toBe(BOARD);
    expect(document.columns.map((column) => column.title)).toEqual(["Todo", "Todo", "Done"]);
    expect(new Set(document.columns.map((column) => column.id)).size).toBe(3);
    expect(document.columns[0]?.cards.map((card) => card.text)).toEqual([
      "First card",
      "[Task 2.4](docs/specs/example/tasks.md#24)",
      "Multiline card\nBody line one.\nBody line two.\n\n<!-- opaque todo comment -->",
    ]);
    expect(document.columns[0]?.cards[1]?.link).toEqual({
      version: 1,
      kind: "task",
      source: {
        rootUri: "",
        rootName: "repo",
        relativePath: "docs/specs/example/tasks.md",
      },
      wbsId: "2.4",
    });
  });

  it("keeps byte-identical Markdown for explicit no-op card and column moves", () => {
    const document = parseKanbanMarkdown(BOARD);
    const column = document.columns[0];
    const card = column?.cards[0];
    if (!column || !card) throw new Error("fixture missing no-op targets");

    const cardResult = mutateKanbanMarkdown(document, {
      kind: "moveCard",
      cardId: card.id,
      toColumnId: column.id,
      beforeCardId: card.id,
    });
    expect(cardResult).toEqual({ ok: true, content: BOARD });

    const columnResult = mutateKanbanMarkdown(document, {
      kind: "moveColumn",
      columnId: column.id,
      beforeColumnId: column.id,
    });
    expect(columnResult).toEqual({ ok: true, content: BOARD });
  });

  it("fails closed when one card has ambiguous portable metadata", () => {
    const ambiguous = `## Todo\n\n- Linked item\n  <!-- afx:card {"v":1,"workItem":{"kind":"spec","root":"repo","path":"docs/specs/a/spec.md"}} -->\n  <!-- afx:card {"v":1,"workItem":{"kind":"spec","root":"repo","path":"docs/specs/b/spec.md"}} -->\n`;
    const document = parseKanbanMarkdown(ambiguous);

    expect(document.content).toBe(ambiguous);
    expect(document.error).toMatch(/Ambiguous portable metadata/);
    expect(document.columns).toEqual([]);
    expect(mutateKanbanMarkdown(document, { kind: "addColumn", title: "Done" })).toMatchObject({
      ok: false,
      reason: "ambiguous",
    });
  });

  it("keeps frontmatter, preamble, opaque comments, and Board Rules while adding a column", () => {
    const document = parseKanbanMarkdown(BOARD);
    const result = mutateKanbanMarkdown(document, { kind: "addColumn", title: "Blocked" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain("custom: keep-me");
    expect(result.content).toContain("Preamble **must stay**.");
    expect(result.content).toContain("<!-- opaque todo comment -->");
    expect(result.content.indexOf("## Blocked")).toBeLessThan(
      result.content.indexOf("## Board Rules"),
    );
    expect(result.content).toContain("- This opaque rule is not a card.");
  });

  it("renames only the selected duplicate column heading", () => {
    const document = parseKanbanMarkdown(BOARD);
    const second = document.columns[1];
    if (!second) throw new Error("fixture missing second column");

    const result = mutateKanbanMarkdown(document, {
      kind: "renameColumn",
      columnId: second.id,
      title: "Next",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.match(/^## Todo$/gm)).toHaveLength(1);
    expect(result.content).toContain("## Next");
  });

  it("moves a linked card and its adjacent metadata as one source unit", () => {
    const document = parseKanbanMarkdown(BOARD);
    const source = document.columns[0];
    const target = document.columns[2];
    const card = source?.cards[1];
    if (!source || !target || !card) throw new Error("fixture missing move target");

    const result = mutateKanbanMarkdown(document, {
      kind: "moveCard",
      cardId: card.id,
      toColumnId: target.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.match(/<!-- afx:card/g)).toHaveLength(1);
    const reparsed = parseKanbanMarkdown(result.content);
    expect(reparsed.columns[0]?.cards.some((item) => item.link)).toBe(false);
    expect(reparsed.columns[2]?.cards[0]?.link?.kind).toBe("task");
  });

  it("adds portable linked cards without absolute paths or transient state", () => {
    const document = parseKanbanMarkdown(BOARD);
    const target = document.columns[2];
    if (!target) throw new Error("fixture missing Done column");

    const result = mutateKanbanMarkdown(document, {
      kind: "addCard",
      columnId: target.id,
      text: "Task 4.1 · Link work",
      link: {
        version: 1,
        kind: "task",
        source: {
          rootUri: "file:///repo",
          rootName: "repo",
          relativePath: "docs/specs/221-app-workbench-board/tasks.md",
        },
        wbsId: "4.1",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain("[Task 4.1 · Link work]");
    expect(result.content).toContain('"root":"repo"');
    expect(result.content).not.toContain("file:///repo");
    expect(result.content).not.toContain('"status"');
    expect(parseKanbanMarkdown(result.content).columns[2]?.cards[0]?.link).toMatchObject({
      kind: "task",
      wbsId: "4.1",
    });
  });

  it("preserves CRLF and unknown afx metadata versions byte-for-byte around edits", () => {
    const source = [
      "---",
      "afx: true",
      "---",
      "",
      "## Todo",
      "",
      "- Keep metadata",
      '  <!-- afx:card {"v":99,"extension":{"keep":true}} -->',
      "",
      "## Done",
      "",
    ].join("\r\n");
    const document = parseKanbanMarkdown(source);
    const done = document.columns[1];
    if (!done) throw new Error("fixture missing Done column");

    const result = mutateKanbanMarkdown(document, {
      kind: "addCard",
      columnId: done.id,
      text: "Ship",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain('<!-- afx:card {"v":99,"extension":{"keep":true}} -->');
    expect(result.content.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("fails closed for stale identities and invalid headings", () => {
    const document = parseKanbanMarkdown(BOARD);

    expect(
      mutateKanbanMarkdown(document, {
        kind: "renameColumn",
        columnId: "column:stale",
        title: "Lost",
      }),
    ).toMatchObject({ ok: false, reason: "missing" });
    expect(
      mutateKanbanMarkdown(document, {
        kind: "addColumn",
        title: "Bad\nHeading",
      }),
    ).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects traversal metadata but preserves it as ordinary markdown", () => {
    const source = `## Todo\n\n- Outside\n  <!-- afx:card {"v":1,"workItem":{"kind":"spec","root":"repo","path":"../../secret.md"}} -->\n`;
    const document = parseKanbanMarkdown(source);

    expect(document.columns[0]?.cards[0]?.link).toBeUndefined();
    expect(document.content).toBe(source);
  });

  it("keeps backtick and tilde fenced headings inside multiline card content", () => {
    const source = `## Todo

### Parser hardening

\`\`\`\`typescript
## Not a column
### Not a card
- not a list card
\`\`\`\`\`

~~~mermaid
## Also not a column
### Also not a card
~~~~

Keep this body.

## Done
`;
    const document = parseKanbanMarkdown(source);

    expect(document.error).toBeUndefined();
    expect(document.columns.map((column) => column.title)).toEqual(["Todo", "Done"]);
    expect(document.columns[0]?.cards).toHaveLength(1);
    expect(document.columns[0]?.cards[0]?.text).toContain("## Not a column");
    expect(document.columns[0]?.cards[0]?.text).toContain("### Also not a card");
    expect(document.columns[0]?.cards[0]?.text).toContain("- not a list card");
    expect(document.content).toBe(source);
  });

  it("mutates only real headings around fenced examples and keeps explicit no-ops byte-identical", () => {
    const source = `## Todo

### Example

\`\`\`markdown
## Done
\`\`\`

## Done
`;
    const document = parseKanbanMarkdown(source);
    const todo = document.columns[0];
    const done = document.columns[1];
    if (!todo || !done) throw new Error("fixture missing real columns");

    expect(
      mutateKanbanMarkdown(document, {
        kind: "moveColumn",
        columnId: todo.id,
        beforeColumnId: todo.id,
      }),
    ).toEqual({ ok: true, content: source });

    const renamed = mutateKanbanMarkdown(document, {
      kind: "renameColumn",
      columnId: done.id,
      title: "Shipped",
    });
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.content.match(/^## Done$/gm)).toHaveLength(1);
    expect(renamed.content.match(/^## Shipped$/gm)).toHaveLength(1);
    expect(renamed.content).toContain("```markdown\n## Done\n```");
  });

  it("fails closed when an unclosed fence makes a later heading non-addressable", () => {
    const source = `## Todo

### Example

~~~~js
## Hidden
`;
    const document = parseKanbanMarkdown(source);

    expect(document.columns.map((column) => column.title)).toEqual(["Todo"]);
    expect(document.columns[0]?.cards[0]?.text).toContain("## Hidden");
    expect(
      mutateKanbanMarkdown(document, {
        kind: "renameColumn",
        columnId: "column:hidden",
        title: "Visible",
      }),
    ).toMatchObject({ ok: false, reason: "missing" });
    expect(document.content).toBe(source);
  });
});
