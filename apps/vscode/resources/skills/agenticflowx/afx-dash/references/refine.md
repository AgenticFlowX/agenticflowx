# afx-dash refine

Adjust an existing Dash's Purpose or Tasks without changing execution evidence.

## Steps

1. Load the Dash (targeted read: frontmatter + Purpose + the task group being changed).
2. Fold the `[context]` argument into Purpose and/or Tasks. Preserve existing task IDs, checkboxes, file scopes, dependencies, and Work Sessions — never renumber completed work.
3. Adding scope: append new `### N.N` groups; do not overload an existing group.
4. Bump `updated_at`.
5. Re-run the complexity check (SKILL.md → Escalation). If the refine pushed the Dash past its shape, recommend Sprint/Full with concrete signals.

## Result

Outcome: CHANGED | NO-CHANGE, what changed, and the next step.
