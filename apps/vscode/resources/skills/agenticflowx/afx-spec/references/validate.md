# /afx-spec validate

### validate <name>

**Purpose:** Structural compliance check for spec.md and its sibling files — deterministic, blocking for approval.

**Implementation:**

1. **File Existence**: Check all 4 required files exist:
   - `docs/specs/<name>/spec.md`
   - `docs/specs/<name>/design.md`
   - `docs/specs/<name>/tasks.md`
   - `docs/specs/<name>/journal.md`
2. **Frontmatter Validation** (spec.md):
   - Has `afx: true`, `type: SPEC`, `status` field
   - Has `version` (quoted string)
   - Has `created_at` and `updated_at` (non-midnight timestamps)
   - Has `tags` array
   - Field order is canonical: `afx → type → status → owner → version → created_at → updated_at → tags → [depends_on]`
3. **Frontmatter Validation** (sibling files):
   - Each has `afx: true` and correct `type` (DESIGN, TASKS, JOURNAL)
   - `design.md` has a lifecycle `status` field (`Draft`, `Approved`, or `Superseded`)
   - `tasks.md` and `journal.md` have no lifecycle `status`: task progress is derived from task groups and Work Sessions; journals are append-only
4. **Requirement ID Check** (spec.md):
   - Every row in the Functional Requirements table has a `FR-N` ID
   - Every row in the Non-Functional Requirements table has a `NFR-N` ID
   - All IDs are unique within the file (no duplicate `FR-1`)
   - IDs are sequential (no gaps — `FR-1, FR-2, FR-3`, not `FR-1, FR-3`)
5. **Template Section Compliance** (spec.md): Check all 8 required sections exist (see [template-format.md](template-format.md) → Required Sections for the canonical list)
6. **Cross-Reference Check**: Delegate to `/afx-check links` for internal link validation

**Output:**

```
Validation: user-authentication (spec.md)

File Structure: ✓ All 4 files present
Frontmatter: ✓ Valid (SPEC, canonical field order, timestamps present)
Requirement IDs: ✓ 5 FR + 3 NFR, all unique and sequential
Template Sections: ✓ All 8 required sections present
Cross-references: ✓ All links valid

Status: PASSED
```

If validation fails:

```
Validation: user-authentication (spec.md)

File Structure: ✗ Missing files
  - tasks.md not found
Frontmatter: ✗ Invalid
  - spec.md: missing 'version' field
  - spec.md: 'updated_at' uses midnight timestamp (must be precise)
Requirement IDs: ✗ Issues found
  - Duplicate: FR-2 appears twice
  - Gap: FR-1, FR-3 (missing FR-2 after dedup)
  - NFR table: missing ID column
Template Sections: ✗ Missing sections
  - No "Non-Goals" section
  - No "Open Questions" section

Status: FAILED (6 issues)
```

**Next Command:**

- If passed: `/afx-spec review <name>` for quality check
- If failed: Fix listed issues, then re-validate
