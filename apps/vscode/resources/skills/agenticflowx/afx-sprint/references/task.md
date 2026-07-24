# afx-sprint task

Refine the **Tasks** section (phased hierarchical checklist with `@see` anchors back to FR/DES), or approve it.

### Usage

```bash
/afx-sprint task [feature] [...context]   # Refine
/afx-sprint task [feature] --approve          # Mark Tasks section Approved (unlocks code)
```

### Gate

- **Prerequisite**: `approval.spec == Approved` AND `approval.design == Approved`.
- If either is Draft, stop and direct the user to the missing approval.

### Refinement Loop (when called without `--approve`)

1. **Read Tasks section** (`## 3. Tasks` through the line before `## 4. Work Sessions`).
2. **Run coverage scan**: cross-reference every `[FR-X]` / `[NFR-X]` from Section 1 and every `[DES-X]` from Section 2. List anchors that don't appear in any task group's `@see` comment.
3. **Understand the ask** — accept `[...context]` or prompt with the coverage report: _"These anchors aren't covered yet: [FR-3, DES-CACHE]. Want to add task groups for them, or refine existing ones?"_
4. **Propose diff** — new task groups written with the mandatory `@see` comment format:

   ```markdown
   #### 3.4 Redis setup and connection pool

   <!-- files: src/cache/redis.ts, src/cache/pool.ts -->
   <!-- @see docs/specs/<feature>/<feature>.md [FR-3] [DES-CACHE] -->

   - [ ] Add `ioredis` dependency
   - [ ] Write connection factory with retry/backoff
   - [ ] Unit-test connection failure paths
   ```

5. **Confirm** with user.
6. **Apply edits** using Edit tool. Never renumber existing task groups.
7. **Task numbering**: new group within existing phase = next `[X.Y]`; new phase = next `[X]`.
8. **Update `updated_at`**.

### Approval Path (when called with `--approve`)

1. **Check gate**.
2. **Read Tasks section**.
3. **Run mini-audit**: every WBS task group has an `@see` comment and at least one column-zero completion-criteria checkbox; every `[FR-X]`/`[NFR-X]`/`[DES-X]` from earlier sections appears in at least one `@see`; all criteria use valid `- [ ]` checkboxes.
4. **If audit fails**: report the exact gaps (missing `@see`, uncovered anchors, missing criteria, malformed checkboxes).
5. **If audit passes**: Edit `approval.tasks` → `Approved`. Also set top-level `status` → `Approved`. Update `updated_at`. Capture to journal.

### Output (refinement)

```text
Tasks section updated for <feature>.
Coverage: 4/4 FRs covered, 2/2 NFRs covered, 5/5 DES sections covered.
Changes:
  + 3.4: Redis setup and connection pool
  + 3.5: Cache invalidation hooks

Next: /afx-sprint task <feature> --approve   # When tasks are ready
```

### Output (approval)

```text
Tasks section approved for <feature>.
Approval state: spec=Approved, design=Approved, tasks=Approved
Overall status: Approved

Next: /afx-sprint code <feature>   # Start implementing
```
