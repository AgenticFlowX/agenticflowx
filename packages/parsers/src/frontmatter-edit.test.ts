/**
 * @see docs/specs/230-app-workbench-spec-authoring/spec.md [FR-8] [FR-9]
 * @see docs/specs/230-app-workbench-spec-authoring/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import { editFrontmatterList } from "./frontmatter-edit";

const FLOW = `---
afx: true
type: SPEC
depends_on: [110-cart, 130-payments]
tags: [checkout, feature]
---

# Checkout
body`;

const BLOCK = `---
afx: true
type: SPEC
depends_on:
  - 110-cart
  - 130-payments
---

# Checkout`;

describe("editFrontmatterList — add", () => {
  it("appends to an existing flow list preserving other keys and body", () => {
    const { content, changed } = editFrontmatterList(FLOW, "depends_on", "140-tax", "add");
    expect(changed).toBe(true);
    expect(content).toContain('depends_on: [110-cart, 130-payments, "140-tax"]');
    expect(content).toContain("tags: [checkout, feature]");
    expect(content).toContain("# Checkout\nbody");
  });

  it("appends to an existing block list at the right indentation", () => {
    const { content, changed } = editFrontmatterList(BLOCK, "depends_on", "140-tax", "add");
    expect(changed).toBe(true);
    expect(content).toContain('  - 110-cart\n  - 130-payments\n  - "140-tax"');
  });

  it("is idempotent — adding an existing entry is a no-op success", () => {
    const flow = editFrontmatterList(FLOW, "depends_on", "110-cart", "add");
    expect(flow.changed).toBe(false);
    expect(flow.content).toBe(FLOW);
    const block = editFrontmatterList(BLOCK, "depends_on", "110-cart", "add");
    expect(block.changed).toBe(false);
    expect(block.content).toBe(BLOCK);
  });

  it("creates an absent key just before the closing delimiter", () => {
    const { content, changed } = editFrontmatterList(FLOW, "supersedes", "090-legacy", "add");
    expect(changed).toBe(true);
    expect(content).toContain('supersedes: ["090-legacy"]');
    // Existing keys and body untouched.
    expect(content).toContain("depends_on: [110-cart, 130-payments]");
    expect(content).toContain("# Checkout\nbody");
  });

  it("preserves comments and unrelated content", () => {
    const withComment = `---
afx: true
# ownership note
depends_on: [110-cart]
---
x`;
    const { content } = editFrontmatterList(withComment, "depends_on", "130-payments", "add");
    expect(content).toContain("# ownership note");
    expect(content).toContain('depends_on: [110-cart, "130-payments"]');
  });

  it("quotes an entry that could be misread as YAML", () => {
    const { content } = editFrontmatterList(FLOW, "depends_on", "a: b", "add");
    expect(content).toContain('"a: b"');
  });

  it.each(["123", "true", "null", "2026-01-01"])("quotes the YAML-coercible string %s", (entry) => {
    const { content } = editFrontmatterList(FLOW, "depends_on", entry, "add");
    expect(content).toContain(`"${entry}"`);
  });

  it("edits a multiline flow list without reformatting existing entries", () => {
    const multiline = `---
afx: true
depends_on:
  [
    "110-cart",
    "130-payments",
  ]
---
body`;
    const { content, changed } = editFrontmatterList(multiline, "depends_on", "140-tax", "add");
    expect(changed).toBe(true);
    expect(content).toBe(`---
afx: true
depends_on:
  [
    "110-cart",
    "130-payments",
    "140-tax",
  ]
---
body`);
  });

  it("preserves quoted commas and a trailing flow-list comment", () => {
    const source = `---
afx: true
relates_to: ["ADR,phase"] # rationale
---
body`;
    const { content } = editFrontmatterList(source, "relates_to", "next", "add");
    expect(content).toContain('relates_to: ["ADR,phase", "next"] # rationale');
  });

  it("edits only a root mapping key, never a nested key with the same name", () => {
    const source = `---
metadata:
  depends_on: [internal]
depends_on: [actual]
---
body`;
    const { content } = editFrontmatterList(source, "depends_on", "new", "add");
    expect(content).toContain("  depends_on: [internal]");
    expect(content).toContain('depends_on: [actual, "new"]');
  });

  it("refuses to edit a scalar (non-list) value", () => {
    const scalar = `---\ntitle: Checkout\n---\nx`;
    const { content, changed, outcome } = editFrontmatterList(scalar, "title", "extra", "add");
    expect(changed).toBe(false);
    expect(outcome).toBe("unsupported");
    expect(content).toBe(scalar);
  });

  it.each(["|", ">"])("refuses to treat a %s block scalar as a list", (indicator) => {
    const scalar = `---
relates_to: ${indicator}
  - prose-one
  - prose-two
---
body`;
    const { content, changed, outcome } = editFrontmatterList(
      scalar,
      "relates_to",
      "target",
      "add",
    );
    expect(changed).toBe(false);
    expect(outcome).toBe("unsupported");
    expect(content).toBe(scalar);
  });

  it("is a no-op on a document without a frontmatter block", () => {
    const raw = "# Just a heading\n\nbody";
    const { content, changed } = editFrontmatterList(raw, "depends_on", "x", "add");
    expect(changed).toBe(false);
    expect(content).toBe(raw);
  });
});

describe("editFrontmatterList — remove", () => {
  it("removes a middle entry from a flow list", () => {
    const { content, changed } = editFrontmatterList(FLOW, "depends_on", "110-cart", "remove");
    expect(changed).toBe(true);
    expect(content).toContain("depends_on: [130-payments]");
  });

  it("removes an entry from a block list preserving the rest", () => {
    const { content, changed } = editFrontmatterList(BLOCK, "depends_on", "110-cart", "remove");
    expect(changed).toBe(true);
    expect(content).toContain("  - 130-payments");
    expect(content).not.toContain("110-cart");
    expect(content).toContain("depends_on:");
  });

  it("removes the whole key when the last flow entry is removed", () => {
    const single = `---\nafx: true\ndepends_on: [110-cart]\ntags: [x]\n---\nbody`;
    const { content, changed } = editFrontmatterList(single, "depends_on", "110-cart", "remove");
    expect(changed).toBe(true);
    expect(content).not.toContain("depends_on");
    expect(content).toContain("tags: [x]");
    expect(content).toContain("afx: true");
  });

  it("removes the whole key when the last block entry is removed", () => {
    const single = `---\nafx: true\ndepends_on:\n  - 110-cart\ntags: [x]\n---\nbody`;
    const { content, changed } = editFrontmatterList(single, "depends_on", "110-cart", "remove");
    expect(changed).toBe(true);
    expect(content).not.toContain("depends_on");
    expect(content).not.toContain("110-cart");
    expect(content).toContain("tags: [x]");
  });

  it("is a no-op when the entry is absent", () => {
    const { content, changed } = editFrontmatterList(FLOW, "depends_on", "999-missing", "remove");
    expect(changed).toBe(false);
    expect(content).toBe(FLOW);
  });

  it("is a no-op when the key is absent", () => {
    const { content, changed } = editFrontmatterList(FLOW, "supersedes", "x", "remove");
    expect(changed).toBe(false);
    expect(content).toBe(FLOW);
  });

  it("removes a legacy URI-qualified value when asked to remove its bare token (flow)", () => {
    const legacy = `---\nafx: true\ndepends_on: ["file:///Users/x/afx-cm:120-package-db-core", 130-payments]\n---\nbody`;
    const { content, changed } = editFrontmatterList(
      legacy,
      "depends_on",
      "120-package-db-core",
      "remove",
    );
    expect(changed).toBe(true);
    expect(content).not.toContain("file:///");
    expect(content).toContain("130-payments");
  });

  it("removes a legacy URI-qualified value when asked to remove its bare token (block)", () => {
    const legacy = `---\nafx: true\ndepends_on:\n  - "file:///Users/x/afx-cm:120-package-db-core"\n---\nbody`;
    const { content, changed } = editFrontmatterList(
      legacy,
      "depends_on",
      "120-package-db-core",
      "remove",
    );
    expect(changed).toBe(true);
    expect(content).not.toContain("file:///");
    expect(content).not.toContain("depends_on");
  });

  it("removes a path-qualified value using its canonical extensionless token", () => {
    const source = `---
afx: true
relates_to: [docs/adr/ADR-0001-foo.md, other]
---
body`;
    const { content, changed } = editFrontmatterList(
      source,
      "relates_to",
      "docs/adr/ADR-0001-foo",
      "remove",
    );
    expect(changed).toBe(true);
    expect(content).toContain("relates_to: [other]");
  });

  it("removes an entry from a multiline flow list", () => {
    const source = `---
depends_on:
  [
    "110-cart",
    "130-payments",
  ]
---
body`;
    const { content, changed } = editFrontmatterList(source, "depends_on", "110-cart", "remove");
    expect(changed).toBe(true);
    expect(content).toBe(`---
depends_on:
  [
    "130-payments",
  ]
---
body`);
  });
});

describe("editFrontmatterList — round-trip and formatting fidelity", () => {
  it("add then remove returns to the original", () => {
    const added = editFrontmatterList(FLOW, "depends_on", "140-tax", "add");
    const removed = editFrontmatterList(added.content, "depends_on", "140-tax", "remove");
    expect(removed.content).toBe(FLOW);
  });

  it("preserves CRLF line endings", () => {
    const crlf = FLOW.replace(/\n/g, "\r\n");
    const { content } = editFrontmatterList(crlf, "depends_on", "140-tax", "add");
    expect(content).toContain("\r\n");
    expect(content).not.toContain("110-cart, 130-payments, 140-tax\n"); // not a bare LF join
  });

  it("preserves mixed line endings outside the edited scalar", () => {
    const mixed = "---\r\nafx: true\ndepends_on: [110-cart]\r\n---\nbody\r\n";
    const { content } = editFrontmatterList(mixed, "depends_on", "140-tax", "add");
    expect(content).toBe('---\r\nafx: true\ndepends_on: [110-cart, "140-tax"]\r\n---\nbody\r\n');
  });
});
