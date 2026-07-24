# afx-sprint verify

Sanity-check the sprint brief before coding. Read-only audit.

### Usage

```bash
/afx-sprint verify [feature] [...context]
```

Trailing context narrows focus. Examples:

- `/afx-sprint verify dark-mode anchors only` — run only anchor-integrity + coverage checks.
- `/afx-sprint verify dark-mode focus approvals` — report approval state without running content audits.
- `/afx-sprint verify dark-mode why is spec still Draft` — run full verify and highlight what's blocking the Spec approval.

### Checks

1. **Frontmatter**: required fields present, timestamps ISO 8601 with milliseconds, `type: SPRINT`, `approval` block present.
2. **Approval state**: report each section's approval status; flag any Draft section blocking forward progress.
3. **Spec section**: at least one FR, non-empty Acceptance Criteria, no Open Question row with `Blocking = Yes` unless it is already `Resolved`.
4. **Design section**: at least one `[DES-X]` section, Key Decisions table is filled (or explicitly marked N/A).
5. **Tasks section**: every task group has an `@see` comment using `docs/specs/<feature>/<feature>.md`, and every `[FR-X]` / `[NFR-X]` / `[DES-X]` anchor from sections 1–2 appears in at least one `@see`.
6. **Anchor integrity**: `[FR-X]` IDs are unique, `[DES-X]` IDs are unique, task numbers `[X.Y]` are unique.
7. **Task parseability**: each WBS heading is one task group with at least one valid column-zero `- [ ]` or `- [x]` completion criterion.

### Output (pass)

```markdown
## Sprint Verify: <feature>

| Check             | Result                                                      |
| ----------------- | ----------------------------------------------------------- |
| Frontmatter       | Pass                                                        |
| Approvals         | spec=Approved, design=Approved, tasks=Approved              |
| Spec coverage     | 4 FRs, 2 NFRs                                               |
| Plan coverage     | 5 [DES-X] sections                                          |
| Task coverage     | 4/4 FRs referenced, 2/2 NFRs referenced, 5/5 DES referenced |
| Anchor integrity  | Pass                                                        |
| Task parseability | Pass                                                        |

Result: READY FOR CODING
Next: /afx-sprint code <feature>
```

### Output (fail)

```markdown
## Sprint Verify: <feature> — FAILED

### Gaps

1. **FR-3** has no matching task `@see` — add a task that references it
2. **Task 3.2** missing `@see` comment — add traceability
3. **Open Question #1** is unresolved and `Blocking = Yes` — resolve before coding

Next: /afx-sprint task <feature> # Fix gaps
```
