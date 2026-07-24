# pick {id}

**Purpose:** Check out a task as active.

**Implementation:**

1. Read `tasks.md`, find task `{id}`
2. Verify the task group is not already complete (it is complete only when every completion criterion beneath its `### N.N` heading is `[x]`)
3. **Check dependencies**: If the task has a `<!-- depends: X.Y -->` comment, verify every completion criterion in task group X.Y is marked `[x]`. If not, warn the user and suggest picking the dependency first.
4. **Locate `## Work Sessions`** — it must be the last section. If missing, create it at the bottom. If misplaced, move it to the bottom.
5. Append a row to the Work Sessions table:

   ```markdown
   | 2026-04-01 | {id} | Picked | - | [x] | [] |
   ```

6. Update `updated_at` in `tasks.md` frontmatter
7. Output the task-group description and completion criteria for context
