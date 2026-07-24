# afx-dash new

Create a new Dash at `docs/specs/<name>/<name>.md` from `assets/dash-template.md`.

## Steps

1. Run the suitability check (SKILL.md → Suitability). If the root cause is unknown, recommend Explore first and stop. If the work has explicit requirements/design implications, recommend Sprint.
2. Resolve `<name>` to a short kebab-case feature slug. Reuse the active feature folder when one is in context.
3. Copy the template. Fill frontmatter: real `created_at`/`updated_at` via `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` (see `../afx-help/references/timestamp-rule.md`), `owner` from AFX/project config or Git identity, `tags`.
4. Write **Purpose** from the `[context]` argument and the conversation: observed/current situation, intended outcome, bounded scope. Keep it to one concise section.
5. Write the first **Tasks** group(s) as `### N.N` WBS groups with column-zero `- [ ]` criteria and a `<!-- files: ... -->` scope comment where known.
6. Leave the empty **Work Sessions** section as the final section, preserving the exact shared columns: `Date | Task | Action | Files Modified | Agent | Human`.
7. Do **not** emit `status` or `version` — progress is derived from task/evidence state.

## Result

Report Outcome: CHANGED, the created path, the task groups, and the recommended next step (`/afx-dash code <name> 1.1` or a contextual `start the first task`).
