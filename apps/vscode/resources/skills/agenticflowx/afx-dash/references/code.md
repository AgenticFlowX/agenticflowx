# afx-dash code

Implement a Dash task by delegating to the shared `/afx-task code` mechanics.

## Steps

1. Resolve the target task group (`[task-id]`, or the first incomplete `### N.N`).
2. Load the targeted context: the task group and its criteria, the Purpose, the `<!-- files: -->` scope, and any dependencies.
3. Delegate execution to `/afx-task code` using its explicit **Dash task-artifact profile** with: the Dash path, Purpose, selected task + criteria, file scope, dependencies, and the `[context]` argument. The Dash profile does not require `spec.md`, `design.md`, or `tasks.md`. Do not create a second implementation engine.
4. Apply `@see` traceability. Until graduation, source annotations may link directly to the Dash task ID (`docs/specs/<name>/<name>.md` [N.N]).
5. Append a canonical `Coded` Work Sessions row; never edit or replace an earlier row:

   ```markdown
   | YYYY-MM-DD | N.N | Coded | path/to/file.ts, ... | [x] | [] |
   ```

   Use the shared column order exactly: `Date | Task | Action | Files Modified | Agent | Human`.
6. Re-run the complexity check. Escalate if implementation revealed new scope or a hard boundary.

## Result

Outcome: PASS | BLOCKED | CHANGED, evidence, and the next step (`/afx-dash verify` or the next task).
