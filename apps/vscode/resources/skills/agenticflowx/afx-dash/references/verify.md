# afx-dash verify

Verify a Dash task against its criteria by delegating to shared `/afx-task verify`.

## Steps

1. Resolve the target (`[name|task-id]`).
2. Delegate to `/afx-task verify` using its explicit **Dash task-artifact profile** with the Dash path, Purpose, task group, acceptance criteria, and file scope. Do not require full-SDD artifacts or approvals.
3. Verification compares implementation evidence with the task's stated criteria — it does not approve a spec/design (a Dash has no approval chain).
4. Append a new canonical `Verified` Work Sessions row; do not mutate the earlier `Coded` row:

   ```markdown
   | YYYY-MM-DD | N.N | Verified | - | [x] | [] |
   ```

   Keep Human sign-off independent. Use the shared column order exactly: `Date | Task | Action | Files Modified | Agent | Human`.
5. If verification reveals a real intent conflict or new scope, stop and recommend refine or graduation.

## Result

Outcome: PASS | BLOCKED, the criteria checked, evidence, and the next step.
