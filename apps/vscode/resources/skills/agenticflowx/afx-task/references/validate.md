# validate <name>

**Purpose:** Structural AND spec compliance check for `tasks.md` — validates against the canonical template (`assets/tasks-template.md`) AND verifies spec requirement coverage.

**Template Reference:** `assets/tasks-template.md`

**Implementation:**

1. **File Existence**: Check `tasks.md` exists at `docs/specs/<name>/tasks.md`
2. **Template Alignment**: Compare tasks.md structure against `assets/tasks-template.md`:
   - Frontmatter schema matches (afx, type, owner, version, created_at, updated_at, tags, spec, design); reject a stored task lifecycle `status`
   - Section order: `## Phase N:`, `## Implementation Flow`, `## Cross-Reference Index`, `## Work Sessions` (last)
   - Each `### N.N` heading is a dispatchable task group; its completion criteria use column-zero `- [ ]` checkboxes
   - WBS numbering uses `N.x` format (not `FEATURE-N.x`)
3. **Content Validation**:
   - Tasks have `@see` links to design/spec
   - No orphaned tasks (tasks without `@see` links)
   - No duplicate task IDs
4. **Spec Compliance**:
   - Read `spec.md` from same directory
   - Extract all `FR-*` and `NFR-*` requirements
   - For each FR/NFR, verify at least one task has a `@see` reference to it
   - Report any FR/NFR without task coverage

**Output:**

```
Validation: 39-package-ec3 (tasks.md)

--- Template Alignment ---
Frontmatter: ✓ Matches template
Section Order: ✓ Correct
Task Format: ✓ Uses checkboxes, WBS N.x
--- Content Validation ---
@see Links: ✓ All tasks linked
Orphaned Tasks: ✓ None
Duplicate IDs: ✓ None
--- Spec Compliance ---
FR Coverage: 11/11 (100%)
NFR Coverage: 6/6 (100%)

Status: PASSED
```

**FR/NFR Coverage Logic:**

```
For each requirement in spec.md:
  1. Extract pattern: ### FR-{number} or ### NFR-{number}
  2. In tasks.md, grep for "@see ... [FR-N]"
  3. If found → ✓ covered
  4. If not found → ✗ GAP

Coverage = (requirements with tasks) / (total requirements)
```
