# /afx-task — Conventions, Usage & Related Commands

## Usage

```bash
# Task Planning (lifecycle-gated)
/afx-task plan <name>                      # Generate tasks.md from approved design
/afx-task refine <name>                    # Alias: refine or draft tasks.md from approved design

# Work Management
/afx-task pick <id>                        # Check out a task as active
/afx-task complete <id>                    # Mark task done

# Implementation (from afx-dev code)
/afx-task code <id>                        # Implement task with @see traceability
/afx-task code all <name>                  # Implement all open tasks in the feature, in tasks.md order

# Verification
/afx-task verify <task-id>                 # Verify task implementation vs spec
/afx-task verify <spec>#<task-id>          # Explicit spec (e.g., user-auth#7.1)
/afx-task verify all <name>                # Verify all tasks in a feature
/afx-task summary <task-id>                # Get implementation summary (preferred)
/afx-task brief <task-id>                  # Compatible alias

# Quality
/afx-task review <name>                    # Check for planning gaps
/afx-task validate <name>                  # Validate tasks.md against template + spec coverage
/afx-task status <name>                    # Phase completion overview

# GitHub Sync
/afx-task sync [spec] [issue]              # Bidirectional GitHub sync
```

> **Display Rule:** Don't dump full task lists or phase breakdowns into chat unless the user explicitly asks. The user can read `tasks.md` directly, or use a UI host such as the AgenticFlowX VS Code extension (Tasks Tab, Pipeline Tab) if installed. These subcommands focus on operations that require agent reasoning, not raw display.

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve living artifact content. In `/afx-task`, this maps to `refine` (preferred alias), `plan` (legacy-compatible initial draft), and targeted updates to `tasks.md`.
- **Validate**: check structural, parser, template, frontmatter, and coverage correctness for `tasks.md`.
- **Review**: apply LLM judgment for task planning gaps, sequencing risk, ambiguity, and missing coverage.
- **Verify**: check implementation evidence against the approved spec, design, and task intent.
- **Approve**: advance a lifecycle gate. Task approval is represented by completing planning readiness; task completion is separate.
- **Evolve**: handle post-ship feature, bug, or change work by refining living docs and capturing history in `journal.md` / `tasks.md`.

## Documentation Principles

- `spec.md` and `design.md` are living documents: they represent current product and technical truth.
- `journal.md` captures decisions, amendments, production notes, and change rationale.
- `tasks.md` captures execution plan, active work, verification history, and work sessions.
- Do not introduce amendment directories or new artifact types for ordinary feature evolution; update the living docs and preserve history in the log artifacts.

## Related Commands

### From Other Commands → `/afx-task`

- `/afx-design approve` → Suggest `/afx-task refine <name>`
- `/afx-check trace` → Suggest `/afx-task verify` if broken `@see` links found
- `/afx-next` → Suggest `/afx-task pick` if tasks are pending

### From `/afx-task` → Other Commands

- `/afx-task refine` / `/afx-task plan` → Suggest `/afx-task pick <first-id>`
- `/afx-task complete` → Suggest `/afx-task pick <next-id>` or `/afx-check path` for gate verification
- `/afx-task verify` ([OK]) → Suggest `/afx-task complete <id>`
- `/afx-task review` (gaps) → Suggest editing `tasks.md` to add missing tasks
