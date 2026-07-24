# Sign Off (extension-side action)

**Purpose:** Atomic human-verification step that closes the Work Sessions loop on a `tasks.md`. Surfaced by AFX UI hosts (e.g. the AgenticFlowX VS Code extension) as a brass-accented `[Sign Off ▾]` button, not an LLM round-trip.

**Two visibility gates** — strict and relaxed:

The strict gate (`ready`) holds when **all four** conditions are true:

1. Every task-group completion-criteria checkbox in `tasks.md` is `[x]` — the implementation work is finished.
2. Every Work Sessions row has `Agent: [x]` — the agent has verified each completed task.
3. At least one Work Sessions row still has `Human: [ ]` — there is something to sign off.
4. `tasks.md` is the active editor (UI hosts only; CLI surfaces resolve the file from arguments).

The loose gate (`signable`) holds whenever **condition 3** alone is true. Hosts SHOULD use the loose gate for button visibility so users can tick Human cells mid-flight; the popover MUST surface unmet strict conditions as warnings (e.g. "2 tasks still unchecked", "1 Agent row not yet `[x]`"). When neither gate holds (no pending Human cells), the affordance MUST NOT render — no greyed-out / disabled state.

**Atomic mutation** (single transaction; one undo entry):

1. Tick every Work Sessions row where `Agent: [x]` and `Human: [ ]` so its `Human` cell becomes `[x]`. **Always runs** when at least one such row exists, regardless of whether the strict gate held.
2. Record Human verification evidence only — Sign Off does **not** set a `Living` (or any) lifecycle status on `tasks.md`. Human sign-off is tracked via the Human cells ticked in step 1, kept separate from task progress.
3. Bump frontmatter `updated_at` to the current ISO 8601 timestamp with millisecond precision. Always runs when step 1 ticked at least one row.

`tasks.md` carries no stored lifecycle status. Completion is **derived** — Planned → In Progress → Complete — from task groups and Work Sessions, independent of spec/design approval and independent of Human sign-off. UI copy SHOULD show derived progress and Human sign-off as separate indicators rather than a single status badge.

**Why extension-side, not a slash command:**

- **Deterministic** — the mutation is parsing + rewriting markdown, not a probabilistic LLM operation.
- **Cheap** — no model token cost, no latency.
- **Auditable** — the diff is computed before sending; the host SHOULD show a confirm popover that previews exactly what will change (rows ticked, status promotion, `updated_at` bump).
- **Single undo** — UI hosts SHOULD apply the three changes as one transactional edit so `Cmd/Ctrl+Z` reverts everything in one step.

**Cross-harness contract:**

Any AFX UI host (VS Code extension, web UI, CLI prompt) MAY implement this action so users can finalize a `tasks.md` without leaving the workflow. The conditions and atomic mutations above are the canonical contract — implementations MUST NOT auto-tick a `Human` cell whose corresponding `Agent` cell is still `[ ]`.

**Reference implementation:** afx-vscode `apps/vscode/src/services/tasks-signoff.ts` (`buildTasksSignOffEdit` + `applyTasksSignOff`).
