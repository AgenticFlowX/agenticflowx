# afx-sprint code

Dispatch implementation. **Delegates to `/afx-task code`** with the sprint file as the source of truth.

### Usage

```bash
/afx-sprint code [feature] [task-id] [...context]
```

### Gate

- **Prerequisite**: `approval.spec`, `approval.design`, and `approval.tasks` all equal `Approved`.
- If any section is still `Draft`, stop and respond:

  ```text
  Code is gated on all three sections being Approved.
  Current: spec=<s>, design=<d>, tasks=<t>

  Fix: run the matching /afx-sprint <section> --approve after reviewing.
  ```

### Process

1. **Locate file**: `docs/specs/<feature>/<feature>.md`. Error if missing.
2. **Check approval gate** (see above). Stop if any section is Draft.
3. **Resolve target task**: if `[task-id]` is given, find that WBS task group. Otherwise list groups with at least one unchecked completion criterion and ask the user to pick.
4. **Verify target task has `@see` comment**: if not, error and direct to `/afx-sprint task` to add traceability.
5. **Compose delegation** to `/afx-task code` with:
   - `feature`: `<feature>`
   - `sprint_brief`: `docs/specs/<feature>/<feature>.md`
   - `task_id`: the `[X.Y]` anchor
   - `spec_context`: extracted from Section 1 of `<feature>.md`
   - `design_context`: extracted from Section 2 of `<feature>.md`
   - `task_context`: the target task group plus any sibling notes that affect execution
   - `instruction`: the trailing `[...context]` forwarded verbatim
6. **Instruct `/afx-task code`** that sprint-mode source-code `@see` annotations MUST use full sprint paths while the single-doc format is active:
   - `@see docs/specs/<feature>/<feature>.md [FR-X]`
   - `@see docs/specs/<feature>/<feature>.md [NFR-X]`
   - `@see docs/specs/<feature>/<feature>.md [DES-X]`
   - `@see docs/specs/<feature>/<feature>.md [X.Y]`
7. **On completion**, append a row to the Work Sessions table in `<feature>.md` Section 4 using the same `YYYY-MM-DD` date-only format as `tasks.md`. Implementation does not change the sprint's status — it remains `Approved`; do not promote to `Living`.

### Output

Delegates to `/afx-task code`; that skill produces its own output. After completion:

```text
Work session logged in <feature>.md Section 4.
Next: /afx-check path <feature-path>   # Verify implementation against the sprint brief
```

### Error Handling

**Approval gate failed:**

```text
Error: Cannot run code — sections not all Approved.
Current: spec=Approved, design=Draft, tasks=Draft

Run: /afx-sprint design <feature> --approve   (and then task)
```

**Task missing `@see`:**

```text
Error: Task <X.Y> has no `@see` comment pointing to FR/DES anchors.
Run: /afx-sprint task <feature>   # Add traceability before coding
```

**No matching task:**

```text
Error: Task <task-id> not found in <feature>.md Section 3.
Available unchecked tasks: 3.1, 3.2, 3.4
```
