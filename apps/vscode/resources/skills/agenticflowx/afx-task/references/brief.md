# summary <task-id> (alias: brief)

**Purpose:** Generate concise summary of what was built for a task.

**Implementation:**

1. Read task definition from tasks.md
2. Find session log entries in Work Sessions table
3. Find files modified (from session logs and `@see` backlinks)
4. Summarize implementation
