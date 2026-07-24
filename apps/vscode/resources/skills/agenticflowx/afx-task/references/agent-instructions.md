# Agent Instructions

## Trailing Parameters (`[...context]`)

When trailing arguments are passed (either via CLI or IDE context):

- Treat them as explicit user constraints or focus areas (e.g., `/afx-task code 1.2 oauth` → implement task 1.2 with a focus on OAuth).
- **Multiple Tasks:** If multiple Task IDs are detected (e.g., `1.3 and 1.5`), perform the action and update the `Work Sessions` table for **all** matching tasks simultaneously.
- If an explicit feature name is detected alongside a Task ID, use it to override the Context Resolution chain above.

## Persistence Checkpoint (MANDATORY)

Do not auto-write `tasks.md` during `plan`. Before persisting:

1. Present the proposed content to the user
2. Wait for explicit confirmation before writing
3. `journal.md` append-only entries may be written without checkpoint
4. Source code changes during `code` do NOT require a checkpoint (normal development flow)

## Next Command Suggestion (MANDATORY)

After EVERY `/afx-task` action, suggest the next command:

| Context                     | Suggested Next Command                          |
| --------------------------- | ----------------------------------------------- |
| After `plan`                | `/afx-task pick <first-task-id>` to start work  |
| After `refine`              | `/afx-task review <name>` to validate task plan |
| After `pick {id}`           | `/afx-task code {id}` to implement              |
| After `code {id}`           | `/afx-task verify {id}` to check implementation |
| After `verify` ([OK])       | `/afx-task complete {id}` to mark done          |
| After `verify` ([PARTIAL])  | `/afx-task code {id}` to finish implementation  |
| After `verify` ([MISSING])  | `/afx-task code {id}` to implement              |
| After `complete {id}`       | `/afx-task pick <next-id>` for next task        |
| After `summary` / `brief`   | `/afx-task code {id}` or `/afx-task pick`       |
| After `review` (gaps found) | Address gaps in tasks.md                        |
| After `validate` (passed)   | Proceed with implementation or `/afx-task refine` |
| After `validate` (failed)   | Fix format issues in tasks.md                   |
| After `status`              | `/afx-task pick <next-id>` based on overview    |
| After `sync`                | `/afx-task pick` to resume work                 |

**Host Rendering:** Emit the plain next-command prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert the prose into clickable actions when concrete commands are present.

## Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use the host's structured-choice capability when available (otherwise numbered text options) to present the options.

**Trigger conditions:**

| Condition                                                                       | Question                                                                            | Options                                                 |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| After `plan` generates tasks                                                    | "Tasks planned. Pick the first task?"                                               | "Pick first task" / "Review tasks" / "Not now"          |
| After `pick` checks out a task                                                  | "Task checked out. Start implementing?"                                             | "Code task" / "View brief" / "Not now"                  |
| After `code` completes                                                          | "Implementation done. Verify against spec?"                                         | "Verify implementation" / "Continue coding" / "Not now" |
| After `verify` returns [OK]                                                     | "Task verified successfully. Mark as complete?"                                     | "Complete task" / "Pick next task" / "Not now"          |
| After `verify` returns [PARTIAL]                                                | "Task partially implemented. Continue coding?"                                      | "Continue coding" / "View gaps" / "Not now"             |
| After `verify` returns [MISSING]                                                | "Task not yet implemented. Start coding?"                                           | "Code task" / "Pick different task" / "Not now"         |
| After `complete` with more tasks remaining in current phase                     | "Task completed. Pick the next task in this phase?"                                 | "Pick next task" / "Review progress" / "Not now"        |
| After all tasks in a phase complete                                             | "Phase {N} complete. Start next phase?"                                             | "Start Phase {N+1}" / "Review progress" / "Not now"     |
| After all tasks in ALL phases complete                                          | "All tasks complete. Run final quality check?"                                      | "Run quality check" / "Sync to GitHub" / "Not now"      |
| After `validate` passes (all checks ✓)                                          | "Tasks validated. Ready to start implementation?"                                   | "Pick first task" / "Review gaps" / "Not now"           |
| After `validate` fails (format or coverage issues)                              | "Validation found issues in tasks.md. Fix them now?"                                | "Show issues" / "Not now"                               |
| After `review` finds coverage gaps                                              | "Requirements without tasks detected. Add missing tasks?"                           | "Add tasks" / "Review gaps" / "Not now"                 |
| After `sync` finds discrepancies (task done but issue open, or vice versa)      | "GitHub sync found mismatches. Reconcile now?"                                      | "Reconcile" / "View details" / "Not now"                |
| Code drift detected during `code` (design mismatch)                             | "Logic drift detected — implementation conflicts with design. Review the analysis?" | "Review in journal" / "Update design" / "Not now"       |
| After `code` modifies a Hard Anchor file (detected via Architectural Core rule) | "Hard Anchor file modified. This requires a design update first."                   | "Review design" / "Revert changes" / "Not now"          |
| Task has unmet dependency (detected during `pick`)                              | "Task {id} depends on {dep-id} which is not complete yet."                          | "Pick dependency first" / "Pick anyway" / "Not now"     |

**Rules:**

- Only trigger when the lifecycle gate is actually actionable (preconditions met)
- Include "Not now" as the last option — never force the user
- If user selects an action, execute it immediately (run the verify/complete/pick flow)
- If user selects "Not now", continue normally — do not re-ask in the same conversation
- Keep existing text-only "Next Command Suggestion" for non-lifecycle contexts
- These buttons complement, not replace, the text suggestions
