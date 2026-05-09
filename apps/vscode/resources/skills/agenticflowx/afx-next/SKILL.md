---
name: afx-next
description: Context-aware guidance — analyzes git state, active tasks, and session history to recommend the best next action
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,context,guidance,golden-thread"
  modeSlugs:
    - focus-next
    - architect
---

# /afx-next

The "Golden Thread" command. intelligently analyzes your current context (git state, active tasks, session history) and tells you exactly what to do next.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADR files live (default: `docs/adr`)

If neither file exists, use defaults.

## Usage

```bash
/afx-next
```

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve living artifact content (`spec.md`, `design.md`, `tasks.md`, or sprint sections).
- **Validate**: check structural, parser, template, frontmatter, and cross-reference correctness.
- **Review**: apply LLM judgment for quality, readiness, ambiguity, risk, and missing coverage.
- **Verify**: check implementation evidence against approved intent.
- **Approve**: advance a lifecycle gate after validation and review.
- **Evolve**: handle post-ship feature, bug, or change work using living docs plus `journal.md` / `tasks.md` history.

## Documentation Principles

- `spec.md` and `design.md` are living documents: they represent current product and technical truth.
- `journal.md` captures decisions, amendments, production notes, and change rationale.
- `tasks.md` captures execution plan and work sessions.
- Do not suggest amendment directories or new artifact types for ordinary evolution; route users to refine living docs and capture history.

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Analyze git state, active tasks, and session history

### Forbidden

- Create/modify/delete any files
- Run build/test/deploy/migration commands

If implementation is requested, respond with:

```text
Out of scope for /afx-next (read-only advisor mode). Use the suggested command to proceed.
```

### Timestamp Format (MANDATORY)

When writing execution reports or creating journal entries, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

## Post-Action Checklist (MANDATORY)

Since this is a read-only advisor skill, no files are modified. However, after executing, you MUST:

1. Strictly follow the Analysis Logic to provide context-aware command suggestions.

### Proactive Journal Capture

When this skill detects a high-impact context switch or critical gap, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-next`**: Major context loss detected, multiple incomplete tasks found.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/tasks.md` → `user-auth`, or `docs/specs/user-auth/user-auth.md` → `user-auth` for sprint-format). If code is selected, use it as additional input context for the analysis.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Analyse all features if no context can be inferred — `/afx-next` is valid without a feature scope.
3. **Format detection**: check whether the feature uses **sprint format** (`<feature>.md` present with `type: SPRINT`) or **standard 4-file format** (`spec.md`, `design.md`, `tasks.md`). Sprint-format features route suggestions through `/afx-sprint` subcommands; 4-file features use `/afx-spec`, `/afx-design`, `/afx-task`. A feature with neither is untouched — suggest `/afx-scaffold spec` or `/afx-sprint new`.
4. **Trailing parameters (`[...context]`):** Treat extra words as focus constraints (e.g., `/afx-next user-auth` scopes the analysis to that feature only).

### Analysis Logic

You must perform a deep context scan to determine the user's state. Follow this priority logic:

1.  **Check Plan Mode / Gates**:
    - Is `<system-reminder>Plan mode is active</system-reminder>` present?
      - **Suggestion**: "Continue planning. Edit the plan or request review."
    - Is a task waiting for review?
      - **Suggestion**: `/afx-task complete <task> "note"` (if you are the reviewer) or "Wait for human review."

2.  **Check Global ADRs** (`ls docs/adr/*.md`):
    - Are there ADRs with `status: Proposed`?
      - **Situation**: Architectural decisions are pending review.
      - **Suggestion**: "Review Proposed ADR: docs/adr/ADR-NNNN-\*.md"

3.  **Check Git State** (`git status --short`):
    - Are there uncommitted changes?
      - **Situation**: Work is in progress but not saved/verified.
      - **Suggestion**:
        1.  If strictly code changes: `/afx-check path <path>` (Verify it works)
        2.  If ready to commit: `/afx-task code` (Completing the subtask)
        3.  If just exploring: `/afx-session note "findings"` (Capture thought)

4.  **Check Active Task** (`/afx-next` logic):
    - Is there an active task in `journal.md` or GitHub?
      - **Situation**: Task is assigned but git is clean.
      - **Suggestion**: `/afx-task code` (Start/Resume implementation)

5.  **Check recent completion**:
    - Did the last session end with "Completed"?
      - **Situation**: Task done, need verification.
      - **Suggestion**: `/afx-task verify <task-id>` (Verify against spec)

6.  **Check Idle State**:
    - No active task, clean git state.
      - **Situation**: Ready for new work.
      - **Suggestion**:
        1. `/afx-task pick <spec>` if an approved feature has pending tasks
        2. `/afx-sprint new <feature>` for a small new feature, bug fix, or change
        3. `/afx-spec create <feature>` for formal or cross-cutting new work

7.  **Check Post-Ship Evolution**:
    - Are all tasks complete, checks clean, or the user mentions shipped/production/new bug/new request?
      - **Situation**: Existing living docs may need to evolve.
      - **Suggestion**:
        1. New feature: `/afx-sprint new <feature>` for small work or `/afx-spec create <feature>` for formal work
        2. Bug: `/afx-dev debug <symptom>` to reproduce first, then refine docs only if expected behavior or design changes
        3. Change request: classify impact before editing living `spec.md` / `design.md`

8.  **Fallbacks**:
    - Confused?
      - **Suggestion**: `/afx-help guides` (Browse workflows) or `/afx-next` (Re-orient)

### Output Format

```markdown
## Context: {Brief State Description}

**Detected**: {Uncommitted changes | Active Task X.Y | Idle | Review Pending}

Next (ranked):

1. /afx-command <args> # Context-driven: {why this is best}
2. /afx-alt1 # Context-driven: {reason}
3. /afx-alt2 # Context-driven: {reason}
   ──
4. /afx-next # Re-orient
5. /afx-session note "<note>" # Capture context
```

## Examples

**Scenario 1: Mid-Implementation**
(User has modified files but hasn't run checks)

```markdown
## Context: Implementation in Progress

**Detected**: 3 uncommitted files (modified), Task 7.4 Active

Next (ranked):

1. /afx-check path apps/webapp/claims # Context-driven: Verify uncommitted changes
2. /afx-task code "continue" # Context-driven: Continue writing code
3. /afx-dev test claims # Context-driven: Run tests before commit
   ──
4. /afx-next # Re-orient
5. /afx-session note "context" # Capture before switching
```

**Scenario 2: Task Done**
(User just finished coding, git is clean/committed)

```markdown
## Context: Implementation Complete?

**Detected**: Git Clean, Task 7.4 marked "Done" in last session log.

Next (ranked):

1. /afx-task verify 7.4 # Context-driven: Validate against spec
2. /afx-task complete 7.4 "done" # Context-driven: Mark task complete
3. /afx-task pick docs/specs/{feature} # Context-driven: Move to next task
   ──
4. /afx-next # Re-orient
5. /afx-session note "<note>" # Capture learnings
```

**Scenario 3: Proposed ADRs**
(User created an ADR but hasn't finalized it)

```markdown
## Context: Architectural Decision Pending

**Detected**: 1 Proposed ADR (docs/adr/ADR-0001-database-choice.md)

Next (ranked):

1. Review docs/adr/ADR-0001-database-choice.md # Context-driven: ADR needs review
2. /afx-research explore "database choice" # Context-driven: Research before deciding
3. /afx-session note "ADR review" # Context-driven: Capture review notes
   ──
4. /afx-next # Re-orient
5. /afx-help # See all options
```

**Scenario 4: Idle**
(No active task)

```markdown
## Context: Ready for Work

**Detected**: No active tasks found.

Next (ranked):

1. /afx-task pick <feature> # Context-driven: Pick next pending task
2. /afx-scaffold spec <name> # Context-driven: Start something new
3. /afx-discover capabilities # Context-driven: Explore project state
   ──
4. /afx-next # Check full project state
5. /afx-session recap all # Refresh memory from past sessions
```
