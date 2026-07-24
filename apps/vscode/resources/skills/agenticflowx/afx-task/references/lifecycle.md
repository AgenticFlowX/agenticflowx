# Lifecycle Precondition & Post-Action Checklist

## Lifecycle Precondition (BLOCKING)

**CRITICAL**: Task planning is gated behind design approval. Task coding is gated behind task planning.

| Action | Precondition                       | Check                      |
| ------ | ---------------------------------- | -------------------------- |
| `plan` | `design.md` status == `Approved`   | Read design.md frontmatter |
| `code` | Standard `tasks.md` or `type: DASH` exists with task `{id}` | Read the resolved task artifact |

Before planning, the agent **MUST**:

1. Read `design.md` frontmatter for the target feature
2. Check the `status` field
3. If `status` is NOT `Approved`, **STOP** and output:

```text
BLOCKED: Cannot author tasks.md content.

Precondition not met:
  design.md status is "{current_status}" (required: "Approved")

Approve the design first:
  /afx-design review {name}
  /afx-design approve {name}
```

---

## Post-Action Checklist (MANDATORY)

After completing any action that modifies a resolved task artifact (`tasks.md` or a Dash) or source code, you MUST:

1. **Verify Implementation vs. Governing Context**: For standard SDD, perform a mental reset against relevant `spec.md`/`design.md` sections. For Dash, re-read Purpose, the selected task, and escalation boundaries; do not require missing full-SDD artifacts.
2. **Update `updated_at`**: Set the current ISO 8601 timestamp in the resolved task artifact's frontmatter.
3. **Verify backlinks**: Standard `tasks.md` keeps `spec: spec.md` and `design: design.md`. A Dash instead keeps source links on its own `[N.N]` IDs.
4. **Contextual Tagging**: If changes introduce new domains or concepts, append to `tags` array.
5. **Version Management**: If a change alters task scope (adding/removing phases), bump `version`. (`tasks.md` carries no `Living` lifecycle status; progress is derived — see Sign Off.)
6. **Format Preservation**: Frontmatter fields must remain in canonical order. Use double quotes.
7. **Parser-Compatible Format Check**: Verify the generated/modified `tasks.md` follows the **Template Format Rules (CRITICAL)** section — phase headers match `## Phase N:`, checkboxes at column 0 with no indentation, Cross-Reference Index after all phases, Work Sessions last. Run `/afx-task validate <name>` if uncertain.
8. **Proactive Prevention Check**:
   - Error Handling: Does it match the project's error handling pattern?
   - Logging: Does it use the project's logging utility?
   - Consistency: Compare with 3 existing files in the project to ensure stylistic alignment.
9. **Work Sessions Table** (CRITICAL — agents frequently get this wrong):
   - The `## Work Sessions` section MUST be the **last section** in the resolved task artifact. In `tasks.md`, it follows all Phase sections and the Cross-Reference Index; in a Dash, it follows Tasks. If it has drifted, move it back to the bottom before appending.
   - After `pick`, `code`, `verify`, and `complete`, **append a new row** to the table. Do NOT replace existing rows.
   - Use this exact column structure — no variations:

     ```markdown
     | Date       | Task | Action    | Files Modified       | Agent | Human |
     | ---------- | ---- | --------- | -------------------- | ----- | ----- |
     | 2026-03-31 | 1.1  | Picked    | -                    | [x]   | []    |
     | 2026-03-31 | 1.1  | Coded     | auth.service.ts, ... | [x]   | []    |
     | 2026-03-31 | 1.1  | Completed | auth.service.ts, ... | [x]   | []    |
     ```

   - **Date**: `YYYY-MM-DD` (date only, not full ISO timestamp)
   - **Task**: WBS ID (e.g., `1.1`, `2.3`)
   - **Action**: One of `Picked`, `Coded`, `Completed`, `Verified`, `Reviewed`
   - **Files Modified**: Comma-separated list, or `-` if no files changed
   - **Agent/Human**: `[x]` for who performed, `[]` for pending human review

10. **`@see` Annotations (code subcommand only)**: Add `@see` links at the **class and function level** via JSDoc on exported classes, interfaces, and functions. Line-level annotations ONLY when a specific line implements a non-obvious requirement. **CRITICAL ANTI-PATTERN**: Do NOT dump blanket `@see` links at the top of the file. Do NOT annotate every line.
    - **Full path required**: Always use `docs/specs/{feature}/design.md`, never shorthand like `design.md` or `spec.md`
    - **Node IDs only**: After the file path, only use bracket-wrapped IDs: `[DES-UI]`, `[FR-12]`, `[NFR-1]`. Never append subsection numbers (e.g., `3.5.0.1`) — the code lens parser cannot parse them
    - **Format**: `@see docs/specs/{feature}/design.md [DES-UI]` — path + space + Node ID(s). Multiple Node IDs space-separated: `[FR-1] [FR-2]`
11. **Completion Criteria**: After `code`, mark only the selected task group's criteria that have supporting implementation and verification evidence. `complete` requires every criterion in that group to be `[x]`; it does not infer evidence.
