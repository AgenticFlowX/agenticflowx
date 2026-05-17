---
name: afx-task
description: Implementation lifecycle — plan tasks, pick work, implement code, verify, complete, and sync with GitHub
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,task,implementation,coding,verification,lifecycle"
  afx-argument-hint: "plan | refine | pick | code | verify | complete | sync | brief | review | validate | status"
  modeSlugs:
    - focus-review-tasks
    - focus-code
    - code
---

# /afx-task

Implementation lifecycle engine for `tasks.md` artifacts and source code. Owns the full journey from task planning through coding to completion.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)

If neither file exists, use defaults.

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
/afx-task brief <task-id>                  # Get implementation summary

# Quality
/afx-task review <name>                    # Check for planning gaps
/afx-task validate <name>                  # Validate tasks.md against template + spec coverage
/afx-task status <name>                    # Phase completion overview

# GitHub Sync
/afx-task sync [spec] [issue]              # Bidirectional GitHub sync
```

> **Display Rule:** Don't dump full task lists or phase breakdowns into chat unless the user explicitly asks. The user can read `tasks.md` directly, or use a UI host such as the AgenticFlowX VS Code extension (Tasks Tab, Pipeline Tab) if installed. These subcommands focus on operations that require agent reasoning, not raw display.

## Purpose

Owns the `tasks.md` artifact AND the implementation engine. Owns coding with traceability, task state management, and GitHub sync. All spec-driven coding is tied to a task ID.

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

## Context Resolution

When task ID alone is provided (e.g., `7.1`), resolve spec in this order:

1. **Environment detection** — Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **IDE: Active file** — Infer `[feature]` from the active file path (e.g., `docs/specs/user-auth/tasks.md` → `user-auth`). If code is selected, use it as additional implementation context.
3. **CLI: Explicit args** — If a feature name is passed alongside the task ID (e.g., `/afx-task code user-auth#7.1`), use it directly.
4. **Conversation context** — Recently discussed spec (file reads, GitHub issues, prior commands).
5. **Branch name** — Extract from `feat/{feature-name}` pattern.
6. **Open GitHub issues** — If only one feature has open issues.
7. **Fallback** — Require explicit: `/afx-task verify user-auth#7.1`

---

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/update `tasks.md` only in `docs/specs/**/`
- Create/modify source code and test files in application directories (via `code` subcommand)
- Run build, test, and lint commands (via `code` subcommand)
- Run shell commands for GitHub sync (`gh` CLI, via `sync` subcommand)
- Append to `docs/specs/**/journal.md` (captures only, via Proactive Capture Protocol)

### Forbidden

- Create/modify/delete `spec.md` (owned by `/afx-spec`)
- Create/modify/delete `design.md` (owned by `/afx-design`)
- Delete any spec files or directories
- Delete source code files (refactoring may remove code within files, but deleting entire files requires user confirmation)
- Run deploy/migration commands without explicit user confirmation
- Modify `.afx.yaml` or `.afx/` configuration
- **Destructive File Rewrites**: Never replace the entire contents of an existing `tasks.md`, `journal.md`, or source code file using a full-file rewrite. Always use targeted line-level replacements or append actions to preserve manually written human content.

If out-of-scope work is requested, return:

```text
Out of scope for /afx-task (implementation-lifecycle mode). Use /afx-spec for spec changes, /afx-design for design changes.
```

### Architectural Core "Hard Anchor" Rule

The following are **Hard Anchors** and MUST NOT be modified during `/afx-task code` without a prior approved Design update:

- Authentication flow & Security protocols
- Database schema & Data migration patterns
- Global state management architecture
- External API integration contracts

If a task requires modifying a Hard Anchor, STOP and escalate: `/afx-design review {name}`.

---

### Timestamp Format (MANDATORY)

All timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Frontmatter (MANDATORY)

When creating or modifying `tasks.md`, enforce the canonical AFX frontmatter schema:

```yaml
---
afx: true
type: TASKS
status: Draft
owner: "@handle"
version: "1.0"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["{feature}"]
spec: spec.md
design: design.md
---
```

**Canonical field order**: `afx → type → status → owner → version → created_at → updated_at → tags → spec → design`. Use double quotes for all string values.

**Immutable fields** (must NOT be changed during plan/pick/complete): `afx`, `type`, `owner`, `created_at`.

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-task`**:

- Spec-implementation mismatch that requires decision
- Task blocked by external dependency
- Scope change discovered during coding
- Discussion about task sequencing, implementation approach, or design direction
- Verify/review request without explicit coding (discussion context)

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): task scope cut, re-plan of `tasks.md` phases, missed task discovered mid-implementation. After applying the change, run the [Significance Check](../afx-session/SKILL.md#significance-check-context-aware-gate) first — skip silently for cosmetic edits (reordering, rewording, typo fixes). Only call `/afx-session capture --trigger scope-cut|missed-req --links <task-id>` when the change encodes a real scope shift or discovery. See [Prompt Capture Triggers](../afx-session/SKILL.md#prompt-capture-triggers-propose--confirm).

**Discussion Context Triggers (automated journal capture):**

```
User: "should task 3.2 be done before 3.1?"
→ Journal: Task dependency question: 3.2 vs 3.1 sequencing

User: "let's discuss the EC3 API approach"
→ Journal: EC3 API approach discussed — see [DES-API]

User: "verify bottom up"
→ Journal: Bottom-up verify requested — task→spec trace

User: "what about FR-4?"
→ Journal: Question about FR-4 coverage — referenced in 9.1
```

**Output format:**

```
## Session: Discussion (2026-04-09T14:30:00.000Z)

### Context
Triggered by: verify bottom up question
Spec: 39-package-ec3

### Discussion Points
- Task 3.2 vs 3.1 dependency discussed
- Next: verify all tasks before coding

---
```

---

## Lifecycle Precondition (BLOCKING)

**CRITICAL**: Task planning is gated behind design approval. Task coding is gated behind task planning.

| Action | Precondition                       | Check                      |
| ------ | ---------------------------------- | -------------------------- |
| `plan` | `design.md` status == `Approved`   | Read design.md frontmatter |
| `code` | `tasks.md` exists with task `{id}` | Read tasks.md              |

Before planning, the agent **MUST**:

1. Read `design.md` frontmatter for the target feature
2. Check the `status` field
3. If `status` is NOT `Approved`, **STOP** and output:

```text
BLOCKED: Cannot author tasks.md content.

Precondition not met:
  design.md status is "{current_status}" (required: "Approved")

Approve the design first:
  /afx-design review {name}
  /afx-design approve {name}
```

---

## Post-Action Checklist (MANDATORY)

After completing any action that modifies `tasks.md` or source code, you MUST:

1. **Verify Implementation vs. Spec**: Perform a "Mental Reset"—read the entire `spec.md` and `design.md` for the feature and confirm the new code doesn't violate any previously implemented requirements.
2. **Update `updated_at`**: Set to current ISO 8601 timestamp in `tasks.md` frontmatter.
3. **Verify backlinks**: Ensure `spec: spec.md` and `design: design.md` are present in `tasks.md` frontmatter.
4. **Contextual Tagging**: If changes introduce new domains or concepts, append to `tags` array.
5. **Version & State Management**: If modifying a `tasks.md` that is currently `status: Living` and the change alters task scope (adding/removing phases), bump `version`.
6. **Format Preservation**: Frontmatter fields must remain in canonical order. Use double quotes.
7. **Parser-Compatible Format Check**: Verify the generated/modified `tasks.md` follows the **Template Format Rules (CRITICAL)** section — phase headers match `## Phase N:`, checkboxes at column 0 with no indentation, Cross-Reference Index after all phases, Work Sessions last. Run `/afx-task validate <name>` if uncertain.
8. **Proactive Prevention Check**:
   - Error Handling: Does it match the project's error handling pattern?
   - Logging: Does it use the project's logging utility?
   - Consistency: Compare with 3 existing files in the project to ensure stylistic alignment.
9. **Work Sessions Table** (CRITICAL — agents frequently get this wrong):
   - The `## Work Sessions` section MUST be the **last section** in `tasks.md`, after all Phase sections and after the Cross-Reference Index. If it has drifted above other sections, move it back to the bottom before appending.
   - After `pick`, `code`, and `complete`, **append a new row** to the table. Do NOT replace existing rows.
   - Use this exact column structure — no variations:

     ```markdown
     | Date       | Task | Action    | Files Modified       | Agent | Human |
     | ---------- | ---- | --------- | -------------------- | ----- | ----- |
     | 2026-03-31 | 1.1  | Picked    | -                    | [x]   | []    |
     | 2026-03-31 | 1.1  | Coded     | auth.service.ts, ... | [x]   | []    |
     | 2026-03-31 | 1.1  | Completed | auth.service.ts, ... | [x]   | []    |
     ```

   - **Date**: `YYYY-MM-DD` (date only, not full ISO timestamp)
   - **Task**: WBS ID (e.g., `1.1`, `2.3`)
   - **Action**: One of `Picked`, `Coded`, `Completed`, `Verified`, `Reviewed`
   - **Files Modified**: Comma-separated list, or `-` if no files changed
   - **Agent/Human**: `[x]` for who performed, `[]` for pending human review

10. **`@see` Annotations (code subcommand only)**: Add `@see` links at the **class and function level** via JSDoc on exported classes, interfaces, and functions. Line-level annotations ONLY when a specific line implements a non-obvious requirement. **CRITICAL ANTI-PATTERN**: Do NOT dump blanket `@see` links at the top of the file. Do NOT annotate every line.
    - **Full path required**: Always use `docs/specs/{feature}/design.md`, never shorthand like `design.md` or `spec.md`
    - **Node IDs only**: After the file path, only use bracket-wrapped IDs: `[DES-UI]`, `[FR-12]`, `[NFR-1]`. Never append subsection numbers (e.g., `3.5.0.1`) — the code lens parser cannot parse them
    - **Format**: `@see docs/specs/{feature}/design.md [DES-UI]` — path + space + Node ID(s). Multiple Node IDs space-separated: `[FR-1] [FR-2]`
11. **Task Checkbox**: After `code` and `complete`, mark the relevant task checkbox `[x]`.

---

## Agent Instructions

### Trailing Parameters (`[...context]`)

When trailing arguments are passed (either via CLI or IDE context):

- Treat them as explicit user constraints or focus areas (e.g., `/afx-task code 1.2 oauth` → implement task 1.2 with a focus on OAuth).
- **Multiple Tasks:** If multiple Task IDs are detected (e.g., `1.3 and 1.5`), perform the action and update the `Work Sessions` table for **all** matching tasks simultaneously.
- If an explicit feature name is detected alongside a Task ID, use it to override the Context Resolution chain above.

### Persistence Checkpoint (MANDATORY)

Do not auto-write `tasks.md` during `plan`. Before persisting:

1. Present the proposed content to the user
2. Wait for explicit confirmation before writing
3. `journal.md` append-only entries may be written without checkpoint
4. Source code changes during `code` do NOT require a checkpoint (normal development flow)

### Next Command Suggestion (MANDATORY)

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
| After `brief`               | `/afx-task code {id}` or `/afx-task pick`       |
| After `review` (gaps found) | Address gaps in tasks.md                        |
| After `validate` (passed)   | Proceed with implementation or `/afx-task refine` |
| After `validate` (failed)   | Fix format issues in tasks.md                   |
| After `status`              | `/afx-task pick <next-id>` based on overview    |
| After `sync`                | `/afx-task pick` to resume work                 |

**Host Rendering:** Emit the plain next-command prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert the prose into clickable actions when concrete commands are present.

### Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use `ask_followup_question` to present options as clickable buttons instead of text-only suggestions.

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

---

## Template Format Rules (CRITICAL)

The AFX `tasks.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it with strict regex patterns. Deviations cause **silent failures** in tools that render tasks (e.g., the VS Code extension shows 0 phases and 0 tasks). These rules are **non-negotiable**.

### Phase Headers

**Required format**: `## Phase N: {Phase Name}`

- MUST start with `## ` (h2 markdown heading)
- MUST contain the word `Phase` followed by a space and a digit
- Colon after the digit is conventional but optional for the parser
- Example: `## Phase 1: Core Types`, `## Phase 3: Integration Testing`
- **NOT**: `## 1. Core Types`, `## Step 1:`, `### Phase 1:`, `# Phase 1:`
- Parser regex: `/^##\s+Phase\s+(\d+):?\s+(.*)$/`

### Task Checkboxes

**Required format**: `- [ ] {Task text}` or `- [x] {Task text}` at column 0

- MUST start at the beginning of the line (column 0) — NO indentation
- MUST use `- [ ] ` (incomplete) or `- [x] ` / `- [X] ` (complete)
- **Each checkbox = one task** when rendered by AFX tools. Do NOT use checkboxes for acceptance criteria sub-items
- File scope, `@see` links, and acceptance criteria go in HTML comments or indented text BELOW the checkbox
- **NOT**: `  - [ ] indented`, `* [ ] asterisk`, `- [ ] **1.1** bold-prefixed`
- Parser regex: `/^-\s+\[([ xX])\]\s+(.*)$/`

### Section Order

After frontmatter, the parser expects this order:

1. `# Title`
2. `## Task Numbering Convention` (optional)
3. `## Phase 0:` through `## Phase N:` (phases in order)
4. `## Implementation Flow` (optional)
5. `## Cross-Reference Index`
6. `## Notes` (optional)
7. `## Work Sessions` — **MUST be last**

**CRITICAL**: `## Cross-Reference Index` must come AFTER all Phase sections. `## Work Sessions` must be the absolute last section — nothing below it.

### Work Sessions Table

- Header regex: `/^##\s+Work\s+Sessions/i`
- Row format: `| YYYY-MM-DD | task-id | Action | files | [x]/[] | [x]/[] |`
- Date column must start with a 4-digit year
- Row regex: `/^\|\s*(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/`

---

## Subcommands

### refine <name>

**Purpose:** Preferred alias for `plan`; refine or draft `tasks.md` from an approved design.

**Behavior:** Execute the same core flow as `plan <name>`. If `tasks.md` is empty or scaffold-only, generate the implementation plan from the approved design. If `tasks.md` already has content, perform targeted refinement that preserves task IDs, Work Sessions, and human-authored task notes. Do not modify source code during `refine`.

Keep `plan` supported indefinitely for compatibility, but prefer `refine` in new UI labels, help text, and examples.

### plan <name>

**Purpose:** Generate implementation task breakdown from approved design.

**Lifecycle Gate:** `design.md` status MUST be `Approved`.

**Implementation:**

1. **Read Approved Spec + Design**
   - Load `spec.md` — extract requirements for traceability
   - Load `design.md` — extract components, interfaces, data models, Node IDs
   - Load `journal.md` — extract any task-related decisions

2. **Design Feedback** (advisory — does not block planning)

   Scan `design.md` for gaps that will affect task quality. For each major design section, check if it has substantive content (not just placeholder text). Report findings before generating tasks:

   ```
   Design Feedback:
     ⚠ [DES-ERR] Error handling section is empty — tasks will define error cases inline
     ⚠ [DES-TEST] No integration test strategy specified
     ✓ [DES-API] API contracts well-defined
     ✓ [DES-DATA] Data model complete

   Recommendation: /afx-design review {name} to address gaps before finalizing tasks
   ```

   If critical sections are empty (`[DES-ARCH]`, `[DES-API]`, `[DES-DATA]`), warn the user but continue — do not block.

3. **Generate Task Breakdown** using the tasks template (`assets/tasks-template.md`):

   **FORMAT ENFORCEMENT** — AFX parsers (CLI, the VS Code extension, and any other AFX-aware tool) will silently break if these are violated. See **Template Format Rules (CRITICAL)** section above for the full regex reference.
   - Phase headers MUST be `## Phase N: {Name}` (h2, the word "Phase", a digit, colon, name)
   - Task checkboxes MUST be `- [ ] {text}` at column 0 — NO indentation, NO bold task ID prefix
   - Each `- [ ]` line = one task when rendered by AFX tools. Do NOT use checkboxes for acceptance criteria sub-items
   - Section order: Phases first, then Cross-Reference Index, then Work Sessions (last)
   - Cross-Reference Index MUST come AFTER all Phase sections, never before

   **Task content requirements:**
   - Organize into phases (setup, core, integration, testing, docs)
   - Each task must have:
     - WBS numbering (Phase.Task, e.g., `1.1`, `2.3`)
     - Clear description of what to implement
     - File scope — list the specific files this task creates or modifies (use `<!-- files: ... -->` comment)
     - `@see` links using Node ID syntax with **full paths** (use `<!-- @see docs/specs/{feature}/design.md [DES-API] | docs/specs/{feature}/spec.md [FR-1] -->` comment)
     - Acceptance criteria — as plain text or indented sub-items, NOT as checkboxes
   - **Parallelization**: Tasks within a phase should be **independent by default** — no shared mutable state, no file overlap. When two tasks in the same phase DO depend on each other, note the dependency explicitly: `<!-- depends: 1.1 -->`. Cross-phase dependencies are implicit (phase N depends on phase N-1).
   - Order phases by dependency (setup before core, core before integration)
   - Generate Cross-Reference Index table linking tasks → spec requirements → design sections

4. **Persistence Checkpoint** (MANDATORY) — present to user, wait for confirmation

5. **Write tasks.md** — replace scaffold, preserve frontmatter, update `updated_at`, set backlinks

6. **Update journal.md** — append entry recording task planning session

---

### pick {id}

**Purpose:** Check out a task as active.

**Implementation:**

1. Read `tasks.md`, find task `{id}`
2. Verify task is not already marked complete (`[x]`)
3. **Check dependencies**: If the task has a `<!-- depends: X.Y -->` comment, verify that task X.Y is marked complete. If not, warn the user and suggest picking the dependency first.
4. **Locate `## Work Sessions`** — it must be the last section. If missing, create it at the bottom. If misplaced, move it to the bottom.
5. Append a row to the Work Sessions table:

   ```markdown
   | 2026-04-01 | {id} | Picked | - | [x] | [] |
   ```

6. Update `updated_at` in `tasks.md` frontmatter
7. Output task description and acceptance criteria for context

---

### code {id}

**Purpose:** The implementation engine. Loads full spec context and writes code with `@see` traceability.

**Absorbed from:** `afx-dev code`

**Implementation:**

1. **Load Context**
   - Read `spec.md` — requirements and acceptance criteria
   - Read `design.md` — architecture, data models, API contracts, Node IDs
   - Read `tasks.md` — task definition, acceptance criteria, related tasks
   - Read existing source code — understand current patterns and architecture

2. **Implement**
   - Write source code fulfilling the task requirements
   - Follow existing code patterns and architecture in the project
   - Run build/test/lint as needed

**`code all <name>` variant:** Resolve the feature's `tasks.md`, collect all unchecked task IDs in document order, and run the same `code {id}` implementation flow for each task one at a time. Stop after the first failed build/test/verification gate and report the next remaining task instead of continuing blindly.

### Code Drift Guardrail (MANDATORY)

During implementation, if you discover that the requested logic fundamentally conflicts with the codebase, introduces severe edge cases unaccounted for in `design.md`, or requires >5 lines of unmapped complex logic:

1. **STOP CODING.** Do not hack around the design or unilaterally invent new architecture.
2. **Proactive Capture:** Log the drift in `journal.md` detailing the discrepancy, the impact, and your recommended architectural course correction.
3. **Escalate:** Stop execution and prompt the user: _"I've hit a logic conflict with the design. See `journal.md` for my analysis. We need to update the design via `/afx-design` or `/afx-spec` before I can continue coding this task."_
4. **Resume:** Once the user updates the source of truth, resume the `/afx-task code {id}` command.

5. **Add `@see` Annotations** (class and function level):

   ```typescript
   /**
    * User authentication service
    *
    * @see docs/specs/user-auth/design.md [DES-API]
    * @see docs/specs/user-auth/tasks.md [2.1]
    */
   export class AuthService {
     /**
      * @see docs/specs/user-auth/spec.md [FR-1]
      * @see docs/specs/user-auth/design.md [DES-SEC]
      */
     async login(credentials: LoginInput): Promise<AuthResult> {
       // implementation
     }
   }
   ```

   **Annotation Rules:**
   - Annotate exported classes, interfaces, and functions that fulfill spec requirements
   - Use Node ID syntax: `@see path/to/file.md [NODE-ID]`
   - Line-level annotations ONLY for non-obvious requirement implementations
   - **NEVER** dump blanket `@see` at the top of the file
   - **NEVER** annotate every line — that creates noise

6. **Update tasks.md**:
   - Mark task checkbox `[x]`
   - **Locate `## Work Sessions`** at the bottom. Append a `Coded` row with the files you modified:

     ```markdown
     | 2026-03-31 | {id} | Coded | auth.service.ts, auth.action.ts | [x] | [] |
     ```

   - Update `updated_at`

---

### verify <task-id>

**Purpose:** Verify task implementation against spec requirements (static verification).

Unlike `/afx-check path` which verifies runtime execution paths, this verifies if a specific task matches its spec.

**Implementation:**

1. **Read tasks.md** — find task definition
2. **Check files exist** — verify files mentioned in task exist
3. **Scan for `@see` backlinks** — check source code for `@see` references to this task
4. **Scan for incomplete markers** — grep for `TODO`, `FIXME` related to this task
5. **Check Work Sessions table** — verify a session log entry exists
6. **Output verification result**:

```markdown
## Task 7.1 Verify

**Spec**: user-auth
**Task**: Create supplier constants
**Status**: [OK] Implemented | [PARTIAL] Partial | [MISSING] Missing

### Implementation Evidence

| Check                 | Status | Details                                |
| --------------------- | ------ | -------------------------------------- |
| Files exist           | [OK]   | feature-claim-supplier.constants.ts    |
| @see backlinks        | [OK]   | 2 files reference this task            |
| Session log entry     | [OK]   | 2025-12-13: Created supplier constants |
| No incomplete markers | [OK]   | No TODO/FIXME for 7.1                  |
| Pattern Consistency   | [OK]   | Error handling/logging matches project |
| Structural Integrity  | [OK]   | No unauthorized Hard Anchor changes    |

### Verdict

[OK] **Task 7.1 is fully implemented**
```

**Verification Status Definitions:**

| Status            | Meaning                     | Criteria                                 |
| ----------------- | --------------------------- | ---------------------------------------- |
| [OK] Implemented  | Task fully complete         | Files exist, backlinks present, no TODOs |
| [PARTIAL] Partial | Task started but incomplete | Some files exist, or TODOs remain        |
| [MISSING] Missing | Task not started            | No files, no session log, no backlinks   |

---

### complete {id}

**Purpose:** Mark task as done.

**Implementation:**

1. Read `tasks.md`, find task `{id}`
2. Verify task checkbox is marked `[x]` (should be done by `code`)
3. If not marked, mark it now
4. **Locate `## Work Sessions`** at the bottom of `tasks.md`. Append a row:

   ```markdown
   | 2026-03-31 | {id} | Completed | auth.service.ts, auth.action.ts | [x] | [] |
   ```

5. Update `updated_at` in `tasks.md` frontmatter
6. Output confirmation and suggest next task

---

### Sign Off (extension-side action)

**Purpose:** Atomic human-verification step that closes the Work Sessions loop on a `tasks.md`. Surfaced by AFX UI hosts (e.g. the AgenticFlowX VS Code extension) as a brass-accented `[Sign Off ▾]` button, not an LLM round-trip.

**Two visibility gates** — strict and relaxed:

The strict gate (`ready`) holds when **all four** conditions are true:

1. Every body checkbox in `tasks.md` is `[x]` — the implementation work is finished.
2. Every Work Sessions row has `Agent: [x]` — the agent has verified each completed task.
3. At least one Work Sessions row still has `Human: [ ]` — there is something to sign off.
4. `tasks.md` is the active editor (UI hosts only; CLI surfaces resolve the file from arguments).

The loose gate (`signable`) holds whenever **condition 3** alone is true. Hosts SHOULD use the loose gate for button visibility so users can tick Human cells mid-flight; the popover MUST surface unmet strict conditions as warnings (e.g. "2 tasks still unchecked", "1 Agent row not yet `[x]`"). When neither gate holds (no pending Human cells), the affordance MUST NOT render — no greyed-out / disabled state.

**Atomic mutation** (single transaction; one undo entry):

1. Tick every Work Sessions row where `Agent: [x]` and `Human: [ ]` so its `Human` cell becomes `[x]`. **Always runs** when at least one such row exists, regardless of whether the strict gate held.
2. Promote frontmatter `status` to `Living` — **only when the strict gate (`ready`) held** AND the file isn't already `Living`. Under the relaxed gate the file stays at its current status until body tasks + Agent rows are also clean; users re-run Sign Off later to promote.
3. Bump frontmatter `updated_at` to the current ISO 8601 timestamp with millisecond precision. Always runs when step 1 ticked at least one row.

The `tasks.md` lifecycle is `Draft → Living` — there is no `Approved` intermediate state for tasks, so when Sign Off DOES promote, the file moves straight to `Living` regardless of the prior value. UI copy SHOULD say "Promote status to Living" rather than naming a source state.

**Why extension-side, not a slash command:**

- **Deterministic** — the mutation is parsing + rewriting markdown, not a probabilistic LLM operation.
- **Cheap** — no model token cost, no latency.
- **Auditable** — the diff is computed before sending; the host SHOULD show a confirm popover that previews exactly what will change (rows ticked, status promotion, `updated_at` bump).
- **Single undo** — UI hosts SHOULD apply the three changes as one transactional edit so `Cmd/Ctrl+Z` reverts everything in one step.

**Cross-harness contract:**

Any AFX UI host (VS Code extension, web UI, CLI prompt) MAY implement this action so users can finalize a `tasks.md` without leaving the workflow. The conditions and atomic mutations above are the canonical contract — implementations MUST NOT auto-tick a `Human` cell whose corresponding `Agent` cell is still `[ ]`.

**Reference implementation:** afx-vscode `apps/vscode/src/services/tasks-signoff.ts` (`buildTasksSignOffEdit` + `applyTasksSignOff`).

---

### sync [spec] [issue]

**Purpose:** Bidirectional GitHub sync.

**Implementation:**

1. **Tasks → GitHub**: For each uncompleted task in `tasks.md`, ensure a corresponding GitHub issue or checklist item exists
2. **GitHub → Tasks**: For each closed GitHub issue, check if corresponding task checkbox is marked
3. **Reconcile**: Report discrepancies (task done in code but issue open, or issue closed but task unchecked)
4. Uses `gh` CLI for GitHub operations

---

### brief <task-id>

**Purpose:** Generate concise summary of what was built for a task.

**Implementation:**

1. Read task definition from tasks.md
2. Find session log entries in Work Sessions table
3. Find files modified (from session logs and `@see` backlinks)
4. Summarize implementation

---

### review <name>

**Purpose:** Check for planning gaps — advisory, not blocking.

**Implementation:**

1. Extract all requirements from `spec.md` (FR-xxx, NFR-xxx)
2. Extract all tasks from `tasks.md` with their `@see` references
3. Cross-reference:
   - Find requirements without corresponding tasks (gaps)
   - Find tasks without requirement links (orphans)
   - Calculate coverage percentage
4. Check if design sections have corresponding tasks
5. Output gap analysis:

```
Gap Analysis: user-authentication

Requirements Coverage: 6/8 (75%)

Requirements WITHOUT Tasks (GAPS):
  ✗ [FR-4] Password complexity
  ✗ [NFR-3] Token expiry

Orphaned Tasks (no requirement link):
  ⚠ Task 1.1: Setup database schema

Recommendations:
  1. Add task for [FR-4] (password complexity)
  2. Add task for [NFR-3] (token expiry)
  3. Link task 1.1 to a requirement or remove if unnecessary
```

---

### validate <name>

**Purpose:** Structural AND spec compliance check for `tasks.md` — validates against the canonical template (`assets/tasks-template.md`) AND verifies spec requirement coverage.

**Template Reference:** `assets/tasks-template.md`

**Implementation:**

1. **File Existence**: Check `tasks.md` exists at `docs/specs/<name>/tasks.md`
2. **Template Alignment**: Compare tasks.md structure against `assets/tasks-template.md`:
   - Frontmatter schema matches (afx, type, status, version, created_at, updated_at, tags, spec, design)
   - Section order: `## Phase N:`, `## Implementation Flow`, `## Cross-Reference Index`, `## Work Sessions` (last)
   - Task format uses `- [ ]` checkboxes
   - WBS numbering uses `N.x` format (not `FEATURE-N.x`)
3. **Content Validation**:
   - Tasks have `@see` links to design/spec
   - No orphaned tasks (tasks without `@see` links)
   - No duplicate task IDs
4. **Spec Compliance**:
   - Read `spec.md` from same directory
   - Extract all `FR-*` and `NFR-*` requirements
   - For each FR/NFR, verify at least one task has a `@see` reference to it
   - Report any FR/NFR without task coverage

**Output:**

```
Validation: 39-package-ec3 (tasks.md)

--- Template Alignment ---
Frontmatter: ✓ Matches template
Section Order: ✓ Correct
Task Format: ✓ Uses checkboxes, WBS N.x
--- Content Validation ---
@see Links: ✓ All tasks linked
Orphaned Tasks: ✓ None
Duplicate IDs: ✓ None
--- Spec Compliance ---
FR Coverage: 11/11 (100%)
NFR Coverage: 6/6 (100%)

Status: PASSED
```

**FR/NFR Coverage Logic:**

```
For each requirement in spec.md:
  1. Extract pattern: ### FR-{number} or ### NFR-{number}
  2. In tasks.md, grep for "@see ... [FR-N]"
  3. If found → ✓ covered
  4. If not found → ✗ GAP

Coverage = (requirements with tasks) / (total requirements)
```

---

### status <name>

**Purpose:** Quick phase-by-phase task completion overview.

**Implementation:**

1. Read tasks.md, count total tasks per phase
2. Count completed (`[x]`) vs total tasks per phase
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

---

### verify all <name>

**Purpose:** Bottom-up verification — verify ALL tasks against spec coverage.

**Implementation:**

1. For each uncompleted task in tasks.md:
   - Run existing `verify <task-id>` logic
2. Aggregate results
3. Output: list of [OK] / [PARTIAL] / [MISSING] across all tasks

**Output:**

```
Verify All: 39-package-ec3 (13 tasks)

OK (9): 1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1
PARTIAL (2): 4.3, 5.2
MISSING (2): 6.1, 7.1

Recommendation: /afx-task code <id> for PARTIAL/MISSING tasks
```

---

## Error Handling

### Common Errors

1. **Design Not Approved (plan)**

   ```text
   BLOCKED: Cannot author tasks.md content.

   Precondition not met:
     design.md status is "Draft" (required: "Approved")

   Approve the design first:
     /afx-design review {name}
     /afx-design approve {name}
   ```

2. **Task Not Found**

   ```text
   Error: Task 7.5 not found in docs/specs/user-auth/tasks.md
   Available tasks in Phase 7: 7.1, 7.2, 7.3, 7.4
   ```

3. **Ambiguous Spec**

   ```text
   Error: Cannot determine spec context.
   Recent activity spans multiple specs: user-auth, users-permissions

   Specify explicitly:
     /afx-task verify user-auth#7.1
   ```

4. **Task Already Complete**

   ```text
   Task 2.1 is already marked complete.

   To re-open: uncheck the task in tasks.md and run /afx-task pick 2.1
   ```

5. **Drift Detected**

   ```text
   BLOCKED: Logic drift detected in Task 2.1.

   The required implementation deviates from design.md [DES-API] regarding token rotation.

   Action Taken:
     - Analysis logged to docs/specs/auth/journal.md
     - Coding paused to prevent technical debt

   Next Step:
     - Review analysis in journal.md
     - Update design: /afx-design modify auth
   ```

---

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
