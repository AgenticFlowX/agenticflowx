# complete {id}

**Purpose:** Mark task as done.

**Implementation:**

1. Read `tasks.md`, find task `{id}`
2. Verify every completion criterion beneath the selected `### N.N` task-group heading is marked `[x]` (normally done by `code` after its checks pass)
3. If any criterion remains unchecked, stop and list it. Do not mark completion evidence without implementing and verifying that criterion.
4. **Locate `## Work Sessions`** at the bottom of `tasks.md`. Append a row:

   ```markdown
   | 2026-03-31 | {id} | Completed | auth.service.ts, auth.action.ts | [x] | [] |
   ```

5. Update `updated_at` in `tasks.md` frontmatter
6. Output confirmation and suggest next task
