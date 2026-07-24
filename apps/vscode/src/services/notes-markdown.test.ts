/**
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-12] [NFR-5]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-MARKDOWN] [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import { NotesMarkdownDocument, notesContentRevision } from "./notes-markdown";

const FIXTURE = `---
afx: true
type: NOTES
---

# Fleeting notes

Keep this preamble byte-for-byte.

## 2026-07-19

### 12:30:00.000
First paragraph.

#### Nested heading

- [ ] Verify parser
- [x] Keep comments

\`\`\`md
### 09:00:00.000
\`\`\`

<!-- opaque comment -->

### 12:30:00.000
Duplicate timestamp, distinct note.

## 2026-07-18

### 08:00:00.100
Older multiline
body.
`;

describe("NotesMarkdownDocument", () => {
  it("parses multiline canonical notes, nested headings, fences, and duplicate times", () => {
    const document = NotesMarkdownDocument.parse(FIXTURE);

    expect(document.valid).toBe(true);
    expect(document.notes).toHaveLength(3);
    expect(new Set(document.notes.map((note) => note.id)).size).toBe(3);
    expect(
      document.notes.filter((note) => note.timestamp === "2026-07-19T12:30:00.000"),
    ).toHaveLength(2);
    expect(document.notes.find((note) => note.text.startsWith("First paragraph"))?.text).toContain(
      "### 09:00:00.000",
    );
    expect(
      document.notes.find((note) => note.text.startsWith("First paragraph"))?.checkboxes,
    ).toEqual([
      expect.objectContaining({ text: "Verify parser", completed: false }),
      expect.objectContaining({ text: "Keep comments", completed: true }),
    ]);
    expect(document.content).toBe(FIXTURE);
    expect(document.revision).toBe(notesContentRevision(FIXTURE));
  });

  it("edits only the selected duplicate note and preserves unrelated bytes", () => {
    const document = NotesMarkdownDocument.parse(FIXTURE);
    const selected = document.notes.find((note) => note.text.startsWith("Duplicate timestamp"));
    expect(selected).toBeDefined();

    const result = document.apply({
      kind: "edit",
      noteId: selected!.id,
      text: "Updated duplicate.",
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, changed: true }));
    if (!result.ok) return;
    expect(result.content).toContain("First paragraph.");
    expect(result.content).toContain("Keep this preamble byte-for-byte.");
    expect(result.content).toContain("### 12:30:00.000\nUpdated duplicate.");
    expect(result.content).not.toContain("Duplicate timestamp, distinct note.");
  });

  it("keeps no-op edits byte-identical", () => {
    const document = NotesMarkdownDocument.parse(FIXTURE);
    const selected = document.notes[0]!;

    expect(document.apply({ kind: "edit", noteId: selected.id, text: selected.text })).toEqual({
      ok: true,
      content: FIXTURE,
      changed: false,
    });
  });

  it("toggles exactly one checkbox by fingerprint", () => {
    const document = NotesMarkdownDocument.parse(FIXTURE);
    const selected = document.notes.find((note) => note.text.startsWith("First paragraph"))!;
    const checkbox = selected.checkboxes[0]!;

    const result = document.apply({
      kind: "toggleCheckbox",
      noteId: selected.id,
      itemFingerprint: checkbox.fingerprint,
      completed: true,
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, changed: true }));
    if (!result.ok) return;
    expect(result.content).toContain("- [x] Verify parser");
    expect(result.content).toContain("- [x] Keep comments");
  });

  it("fails closed for stale note and checkbox identities", () => {
    const document = NotesMarkdownDocument.parse(FIXTURE);
    const selected = document.notes[0]!;

    expect(document.apply({ kind: "delete", noteId: "stale" })).toEqual({
      ok: false,
      reason: "note-not-found",
    });
    expect(
      document.apply({
        kind: "toggleCheckbox",
        noteId: selected.id,
        itemFingerprint: "stale",
        completed: true,
      }),
    ).toEqual({ ok: false, reason: "checkbox-not-found" });
  });

  it("deletes one note and removes an empty managed date section safely", () => {
    const source = `Intro\n\n## 2026-07-19\n\n### 10:00:00.000\nOnly note.\n\n## 2026-07-18\n\n### 09:00:00.000\nKeep.\n`;
    const document = NotesMarkdownDocument.parse(source);
    const selected = document.notes.find((note) => note.date === "2026-07-19")!;

    const result = document.apply({ kind: "delete", noteId: selected.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe("Intro\n\n## 2026-07-18\n\n### 09:00:00.000\nKeep.\n");
  });

  it("retains a date heading when unrelated content remains", () => {
    const source = `## 2026-07-19\n\nContext for the day.\n\n### 10:00:00.000\nOnly note.\n`;
    const document = NotesMarkdownDocument.parse(source);

    const result = document.apply({ kind: "delete", noteId: document.notes[0]!.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain("## 2026-07-19");
    expect(result.content).toContain("Context for the day.");
  });

  it("appends into an existing day without normalizing CRLF content", () => {
    const source =
      "---\r\nafx: true\r\ntype: NOTES\r\n---\r\n\r\n## 2026-07-19\r\n\r\n### 09:00:00.000\r\nExisting.\r\n";
    const document = NotesMarkdownDocument.parse(source);
    const result = document.apply({
      kind: "append",
      text: "New multiline\n- item",
      now: new Date(2026, 6, 19, 11, 2, 3, 4),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toContain(
      "## 2026-07-19\r\n### 11:02:03.004\r\nNew multiline\n- item\r\n\r\n",
    );
    expect(result.content).toContain("### 09:00:00.000\r\nExisting.\r\n");
  });

  it("uses an existing empty day section instead of creating a duplicate heading", () => {
    const source = "# Preamble\n\n## 2026-07-19\n";
    const result = NotesMarkdownDocument.parse(source).apply({
      kind: "append",
      text: "First note of the day",
      now: new Date(2026, 6, 19, 7, 0, 0, 0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.match(/^## 2026-07-19$/gm)).toHaveLength(1);
    expect(result.content).toContain("### 07:00:00.000\nFirst note of the day");
  });

  it("creates a new date section after frontmatter without rewriting the preamble", () => {
    const source = "---\nafx: true\ntype: NOTES\n---\n# Existing heading\n";
    const result = NotesMarkdownDocument.parse(source).apply({
      kind: "append",
      text: "Captured",
      now: new Date(2026, 6, 20, 8, 9, 10, 11),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe(
      "---\nafx: true\ntype: NOTES\n---\n## 2026-07-20\n\n### 08:09:10.011\nCaptured\n\n# Existing heading\n",
    );
  });

  it("parses, edits, and deletes legacy inline records independently", () => {
    const source =
      "# Legacy\n\n- **2026-07-19T10:00:00.000** First\n- **2026-07-19T10:00:00.000** Second\n";
    const document = NotesMarkdownDocument.parse(source);
    expect(document.notes).toHaveLength(2);
    const second = document.notes.find((note) => note.text === "Second")!;

    const edited = document.apply({ kind: "edit", noteId: second.id, text: "Updated" });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.content).toContain("**2026-07-19T10:00:00.000** First");
    expect(edited.content).toContain("**2026-07-19T10:00:00.000** Updated");

    const deleted = document.apply({ kind: "delete", noteId: second.id });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.content).toBe("# Legacy\n\n- **2026-07-19T10:00:00.000** First\n");
  });

  it("targets a legacy inline checkbox by its exact fingerprint", () => {
    const source = "- **2026-07-19T10:00:00.000** - [ ] Legacy task\n";
    const document = NotesMarkdownDocument.parse(source);
    const note = document.notes[0]!;
    expect(note.checkboxes).toEqual([
      expect.objectContaining({ text: "Legacy task", completed: false }),
    ]);

    const result = document.apply({
      kind: "toggleCheckbox",
      noteId: note.id,
      itemFingerprint: note.checkboxes[0]!.fingerprint,
      completed: true,
    });

    expect(result).toEqual({
      ok: true,
      content: "- **2026-07-19T10:00:00.000** - [x] Legacy task\n",
      changed: true,
    });
  });

  it("rejects destructive mutations when frontmatter is malformed", () => {
    const source = "---\nafx: true\n## 2026-07-19\n### 10:00:00.000\nDo not touch\n";
    const document = NotesMarkdownDocument.parse(source);

    expect(document.valid).toBe(false);
    expect(document.diagnostics).toContain("Unterminated YAML frontmatter.");
    expect(document.apply({ kind: "append", text: "Unsafe" })).toEqual({
      ok: false,
      reason: "invalid-document",
    });
  });
});
