# status <name>

**Purpose:** Quick phase-by-phase task completion overview.

**Implementation:**

1. Read tasks.md and count `### N.N` task groups per phase
2. Derive each task group's progress from its completion criteria: Planned = none checked, In Progress = some checked, Complete = at least one criterion and all checked
3. Find blocked tasks (dependency not met) and next actionable task
4. Output progress bars + next action suggestion

**Output:**

```
Status: 39-package-ec3

Phase 1 (Core Types): ████████░░ 80% (4/5 tasks)
Phase 2 (Providers): ██░░░░░░░░ 20% (1/5 tasks)
Phase 3-6: Not started
Phase 7-9 (Backlog): Pending

Blocked: None
Next Action: /afx-task pick 2.2
```
