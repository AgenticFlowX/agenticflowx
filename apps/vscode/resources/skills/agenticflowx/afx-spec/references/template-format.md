# spec.md Template & Format Rules

**Template reference:** `assets/spec-template.md`

## Timestamp Format (MANDATORY)

When creating or updating frontmatter (`updated_at`, `approved_at`, `signed_at`, `created_at`), all timestamps MUST use ISO 8601 with millisecond precision. See `../afx-help/references/timestamp-rule.md` for the canonical rule (format, how to obtain the current timestamp, and the no-midnight-placeholder rule).

## Frontmatter (MANDATORY)

When creating or modifying spec documents, read `assets/spec-template.md` for the canonical structure and frontmatter schema:

```yaml
---
afx: true
type: SPEC
status: Draft
owner: "@handle"
version: "1.0"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["{feature}"]
---
```

**During approval**, add these fields (do NOT remove existing fields):

- `approved_at: YYYY-MM-DDTHH:MM:SS.mmmZ`
- `signed_at: YYYY-MM-DDTHH:MM:SS.mmmZ`
- `reviewer: "@handle"`
- Update `status: Approved` and `updated_at` to current timestamp

**Immutable fields** (must NOT be changed during approval): `afx`, `type`, `owner`, `created_at`.

## Post-Action Checklist (MANDATORY)

After completing any action that modifies `spec.md`, you MUST:

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in `spec.md` frontmatter.
2. **Contextual Tagging**: If changes introduce new domains or concepts, append to `tags` array.
3. **Dependency Tracking**: If changes introduce a reliance on another feature, add that feature's folder name to the `depends_on` array in frontmatter.
4. **Version & State Management**: If modifying a `spec.md` that is currently `status: Approved`, evaluate the change. If it alters scope or requirements, bump `version` (e.g., "1.0" → "1.1") and revert `status: Draft` to force re-approval.
5. **Format Preservation**: Frontmatter fields must remain in canonical order (see **Frontmatter (MANDATORY)** section). Use double quotes for all string values.
6. **Template Section Check**: Verify all 8 required sections from the canonical template are present as `##` headings. Requirement tables use sequential `FR-N` / `NFR-N` IDs with no gaps. Custom sections allowed but required ones must not be omitted. See **Template Format Rules (CRITICAL)** section.

## Template Format Rules (CRITICAL)

The AFX `spec.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it to extract sections, requirements, and status. Deviations cause **silent failures** in tools that render specs (e.g., the VS Code extension fails to display sections). These rules define the canonical format — custom sections are allowed but required ones must not be omitted.

**Template reference:** `assets/spec-template.md`

### Section Headings

Heading levels determine what AFX parsers can see:

- `#` (h1): Document title only — `# {Feature Name}`
- `##` (h2): Major sections — **captured by AFX parsers**
- `###` (h3): Sub-sections — **captured by AFX parsers**
- `####` and deeper: **NOT captured** — do not use for requirements or sections that need to be visible to AFX tools

### Required Sections

All `spec.md` files MUST contain these `##` sections (in order):

1. `## References`
2. `## Problem Statement`
3. `## User Stories` (with `### Primary Users` and `### Stories`)
4. `## Requirements` (with `### Functional Requirements` and `### Non-Functional Requirements`)
5. `## Acceptance Criteria`
6. `## Non-Goals (Out of Scope)`
7. `## Open Questions`
8. `## Dependencies`

Optional: `## Appendix` (with sub-sections for wireframes, data examples, glossary)

### Requirement ID Format

Requirements use table format with sequential IDs — no gaps allowed:

**Functional Requirements table:**

```markdown
| ID   | Requirement      | Priority  |
| ---- | ---------------- | --------- |
| FR-1 | Description here | Must Have |
| FR-2 | Description here | Should    |
```

**Non-Functional Requirements table:**

```markdown
| ID    | Requirement      | Target  |
| ----- | ---------------- | ------- |
| NFR-1 | Description here | < 200ms |
| NFR-2 | Description here | 99.9%   |
```

- IDs MUST be sequential: `FR-1, FR-2, FR-3` — not `FR-1, FR-3`
- IDs MUST be unique within the file
- These IDs are referenced by `@see` annotations in code and tasks.md

### Frontmatter

See **Frontmatter (MANDATORY)** section above for canonical field order and full schema. `type` MUST be `SPEC`.
