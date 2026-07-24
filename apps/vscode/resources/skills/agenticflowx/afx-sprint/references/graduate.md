# afx-sprint graduate

Split the sprint file into the standard 4-file structure when scope has grown.

### Usage

```bash
/afx-sprint graduate [feature] [...context]
```

Trailing context is captured as the rationale in the graduation journal entry (e.g., `scope grew — mobile added`, `PM requires formal review gate`, `splitting for cross-team coordination`).

### Gate

- **Prerequisite**: all three sections `Approved` AND `/afx-sprint verify` passes.

### Process

1. **Locate file**: `docs/specs/<feature>/<feature>.md`. Error if missing.
2. **Check approval gate**: if any section is Draft, stop with:

   ```text
   Cannot graduate — not all sections Approved.
   Current: spec=<s>, design=<d>, tasks=<t>
   ```

3. **Run `/afx-sprint verify`** inline. If it fails, stop and report gaps — don't graduate a broken brief.
4. **Confirm with user**:

   ```text
   Ready to graduate <feature> into 4-file format?

   This will CREATE:
     docs/specs/<feature>/spec.md      (from Spec section)
     docs/specs/<feature>/design.md    (from Design section)
     docs/specs/<feature>/tasks.md     (from Tasks section)

   And RENAME:
     docs/specs/<feature>/<feature>.md → docs/specs/<feature>/<feature>.md.archived

   journal.md stays. Any `@see` annotations that still point at `<feature>.md` will be retargeted to canonical `spec.md` / `design.md` / `tasks.md` paths.

   Proceed? [y/n]
   ```

5. **Split content by section markers**: the sprint template uses `<!-- SPRINT-SECTION-START: <NAME> ... -->` / `<!-- SPRINT-SECTION-END: <NAME> -->` boundary comments. Extract content between them:
   - **SPEC** block → `spec.md` body. Drop the `## 1. Spec` wrapper heading and its blockquote. Keep `## References` as-is (it was already at h2). Promote inner headings: `###` → `##`, `####` → `###`. Use `afx-spec/assets/spec-template.md` frontmatter with `approval.spec`'s state mapped to top-level `status`.
   - **DESIGN** block → `design.md` body. Drop the `## 2. Design` wrapper. Promote `###` → `##`, `####` → `###`. `[DES-X]` anchors become `## [DES-X]` section headings. Use `afx-design/assets/design-template.md` frontmatter; set `spec: spec.md`, `status` ← `approval.design`.
   - **TASKS** block → `tasks.md` body. Drop the `## 3. Tasks` wrapper. Promote `###` → `##`, `####` → `###`. Phase headings become `## Phase N:`, task groups become `### N.Y`. Use `afx-task/assets/tasks-template.md` frontmatter and set `spec: spec.md`, `design: design.md`. Do **not** copy `approval.tasks` into a lifecycle `status`; split `tasks.md` progress is derived from its task groups and Work Sessions.
   - **SESSIONS** block → appended to the bottom of `tasks.md` as the `## Work Sessions` section (matches tasks-template.md's mandatory last-section rule).
6. **Rewrite `@see` comments** inside tasks.md: change `docs/specs/<feature>/<feature>.md` references to canonical split-doc paths based on anchor type:
   - `FR-X` / `NFR-X` → `docs/specs/<feature>/spec.md`
   - `DES-X` → `docs/specs/<feature>/design.md`
   - `X.Y` task IDs → `docs/specs/<feature>/tasks.md`
     Mixed anchors on one comment split into multiple `@see` lines so each line targets exactly one destination file.
7. **Rewrite source-code `@see` annotations** across the workspace that still reference `docs/specs/<feature>/<feature>.md`, preserving Node IDs while retargeting them to `spec.md`, `design.md`, or `tasks.md` by the same rule as above. This is a path migration only — do not alter implementation logic.
8. **Rename original** to `<feature>.md.archived` — do not delete. Preserves history and lets the user recover if split was wrong.
9. **Update journal.md** with a graduation entry (via proactive capture). Include the trailing-context phrase as the rationale.

### Output

```text
Graduated <feature> to 4-file format.

Created:
  docs/specs/<feature>/spec.md
  docs/specs/<feature>/design.md
  docs/specs/<feature>/tasks.md

Archived:
  docs/specs/<feature>/<feature>.md → docs/specs/<feature>/<feature>.md.archived

Sprint-path @see annotations retargeted to canonical spec/design/tasks paths; FR/DES/task IDs preserved.

Next: /afx-spec validate <feature>   # Confirm the split output
```

### Error Handling

**Verify failed:**

```text
Error: /afx-sprint verify failed. Fix gaps before graduating.
Run: /afx-sprint verify <feature>
```

**Conflicting files exist:**

```text
Error: spec.md / design.md / tasks.md already exist in docs/specs/<feature>/.
Cannot graduate — would overwrite. Move or remove them first.
```
