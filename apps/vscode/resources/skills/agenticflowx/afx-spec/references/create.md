# /afx-spec create

### create <name>

**Purpose:** Initialize new spec directory with all artifacts.

**Lifecycle Gate:** None — `create` is the entry point.

**Implementation:**

1. **Validate name**: Must be kebab-case. Error if not.
2. **Check existence**: If `docs/specs/<name>/` already exists, stop with error.
3. **Confirm with user**: Show file list and wait for confirmation.
4. **Read templates** from sibling skill `assets/` directories:
   - `assets/spec-template.md` (this skill)
   - `../afx-design/assets/design-template.md`
   - `../afx-task/assets/tasks-template.md`
   - `../afx-session/assets/journal-template.md`
5. **Create files** using the **Write tool** — substitute placeholders:
   - `{Feature Name}` → Title-cased name (e.g., `user-auth` → `User Auth`)
   - `{feature}` → the kebab-case name
   - `{YYYY-MM-DDTHH:MM:SS.mmmZ}` → current ISO 8601 timestamp
   - `@owner` → `@handle`
   - `<!-- prefix: XX -->` in journal.md → auto-derived prefix (first letter of each word, uppercase)
6. **Create `research/`** subdirectory (empty).
7. After scaffold, author **`spec.md` content only** (requirements, scope, acceptance criteria)
8. `design.md` and `tasks.md` remain as template scaffolds — content authoring is **blocked** until upstream documents are approved
9. `journal.md` gets initial discussion entry (always allowed)

**CRITICAL**: Do NOT author full `design.md` or `tasks.md` content during create. The spec must be reviewed, iterated, and approved first. Use `/afx-design author <name>` and `/afx-task plan <name>` after approval.

**Next Command:**

- `/afx-spec refine <name>` to iterate on spec requirements
- `/afx-spec review <name>` when ready for approval
