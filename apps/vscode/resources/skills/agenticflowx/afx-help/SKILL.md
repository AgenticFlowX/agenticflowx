---
name: afx-help
description: AFX command reference — lists all available commands, role-based workflow guides, and quick-start cheatsheet
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,help,reference,guides"
---

# /afx-help

AFX (AgenticFlowX) command reference.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

If neither file exists, use defaults. See `.afx/.afx.yaml` for all available options.

## Usage

```bash
/afx-help
/afx-help guides  # View role-based workflows (Dev, QA, Ops, etc.)
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
- Do not introduce amendment directories or new artifact types for ordinary feature evolution.

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Display command reference and workflow guides

### Forbidden

- Create/modify/delete any files
- Run build/test/deploy/migration commands

If implementation is requested, respond with:

```text
Out of scope for /afx-help (read-only reference mode). Use the suggested command to proceed.
```

### Timestamp Format (MANDATORY)

When writing execution reports or creating journal entries, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`).

## Post-Action Checklist (MANDATORY)

Since this is a read-only help skill, no files are modified. However, after executing, you MUST:

1. Ensure you provided the user with actionable next steps rather than just a massive text dump.

### Proactive Journal Capture

When this skill detects a high-impact error or confusion event, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-help`**: User is repeatedly lost or commands are failing consecutively.

---

## Agent Instructions

### Trailing Parameters

When trailing arguments are passed (e.g., `/afx-help task`, `/afx-help guides session`), treat them as keyword filters to scope the reference output. This command is context-agnostic — it does not infer feature context from IDE state or cwd.

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-help` action, suggest the most appropriate next command based on context (e.g., `/afx-next` or `/afx-task pick`).

---

## Available Commands

### Intent Map

```bash
Refine   # Improve living docs: /afx-spec refine, /afx-design refine, /afx-task refine, /afx-sprint refine
Validate # Check artifact structure: /afx-spec validate, /afx-design validate, /afx-task validate
Review   # Judge readiness and gaps: /afx-spec review, /afx-design review, /afx-task review
Verify   # Check implementation evidence: /afx-task verify, /afx-check path|links|coverage|all
Approve  # Advance gates: /afx-spec approve, /afx-design approve, /afx-sprint * --approve
Evolve   # Post-ship change path: /afx-next, then sprint/spec/debug based on work type
```

### Context & Guidance

```bash
/afx-next                        # The "Golden Thread" - what to do next?
```

### Task Lifecycle

```bash
/afx-task plan <name>         # Draft tasks from approved design
/afx-task refine <name>       # Refine/draft tasks from approved design
/afx-task pick <id>           # Check out a task as active
/afx-task code <id>           # Implement task with @see traceability
/afx-task complete <id>       # Mark task done
/afx-task sync [spec] [issue] # Bidirectional GitHub sync
```

### Spec Lifecycle

```bash
/afx-spec create <name>                    # Start formal SDD work with spec.md
/afx-spec validate <name>                  # Validate spec structure integrity
/afx-spec refine <name>                    # Refine requirements through discussion + journal
/afx-spec discuss <name>                   # Alias of refine; kept for compatibility
/afx-spec review <name>                    # Review quality, readiness, gaps, and risk
/afx-spec approve <name> [--reviewer "@handle"]  # Lifecycle gate
```

### Design Lifecycle

```bash
/afx-design author <name>                  # Draft design.md from approved spec
/afx-design refine <name>                  # Refine/draft design.md from approved spec
/afx-design validate <name>                # Validate design structure and traceability
/afx-design review <name>                  # Review architecture quality, gaps, and risk
/afx-design approve <name>                 # Approve design (unlocks task planning)
```

### Sprint (Single-Document SDD)

```bash
/afx-sprint new <feature>                  # Scaffold <feature>.md + journal.md (single-doc)
/afx-sprint refine <feature> [section]     # Refine inferred/explicit sprint section
/afx-sprint spec <feature> [--approve]     # Refine or approve the Spec section
/afx-sprint design <feature> [--approve]   # Refine or approve the Design section (gated)
/afx-sprint task <feature> [--approve]     # Refine or approve the Tasks section (gated)
/afx-sprint verify <feature>               # Verify sprint readiness before coding
/afx-sprint code <feature> [task-id]       # Implement (delegates to /afx-task code)
/afx-sprint graduate <feature>             # Evolve into spec.md/design.md/tasks.md when scope grows
```

### Task Verification

```bash
/afx-task verify <task-id>     # Verify implementation evidence against spec/design/task
/afx-task brief <task-id>      # Get implementation summary
/afx-task review <name>        # Review task plan for gaps and sequencing risk
```

### Quality Checks

```bash
/afx-check path <feature-path>   # Trace execution path UI → DB (Gate 1)
/afx-check trace [path]          # Audit annotations for PRD compliance
/afx-check links <spec-path>     # Verify cross-references
/afx-check deps [feature]        # Validate dependency graph
/afx-check coverage <spec-path>  # Spec-to-code coverage map
/afx-check all <feature-path>    # Run all checks
```

### Development Actions

```bash
/afx-dev debug [error]           # Debug with spec trace
/afx-dev refactor [scope]        # Refactor maintaining spec alignment
/afx-dev review [scope]          # Code review against specs
/afx-dev test [scope]            # Run/generate tests
/afx-dev optimize [target]       # Performance optimization
```

### Session Notes

```bash
/afx-session note "content" [tags]                                                # Smart Note (capture/append logic)
/afx-session log [feature]                                                        # Save session to log
/afx-session recap [feature|all]                                                  # AI synthesis for session resumption
/afx-session promote <id>                                                         # Promote to ADR
/afx-session capture [feature] [--trigger <kind>] [--links <anchors>] [--agent <name>] [--model <id>] [...context] # Verbatim prompt + agent-reply excerpt at a pivotal moment
```

### Reporting

```bash
/afx-report orphans [path]      # Find code without @see links
/afx-report coverage <spec>     # Spec → Code coverage map
/afx-report stale [days]        # Specs not updated recently
```

### Help & Guides

```bash
/afx-help guides                         # List all role-based guides
```

### Environment Check

```bash
/afx-hello                    # Verify AFX installation and environment
```

---

## Quick Reference

> **Human Cheatsheet**: [cheatsheet.md](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/cheatsheet.md)

| Command             | Purpose                    |
| ------------------- | -------------------------- |
| `/afx-next`         | "What do I do now?"        |
| `/afx-task pick`    | "What's next task?"        |
| `/afx-task verify`  | "Is task done correctly?"  |
| `/afx-check path`   | "Does code actually work?" |
| `/afx-session note` | "Remember this idea"       |
| `/afx-session log`  | "Save this discussion"     |
| `/afx-hello`        | "Is AFX set up correctly?" |

---

## Typical Workflow

```
1. /afx-next                  # Check current state
2. /afx-task pick <id>        # Get next task assignment
3. /afx-task code <id>        # Implement with traceability
4. /afx-check path <path>     # Verify execution path
5. /afx-task verify <task>     # Audit task vs spec
6. /afx-session log          # Save session notes
```

## Quick Start / Cheatsheet

| I want to...              | Run...                        |
| :------------------------ | :---------------------------- |
| **Start/Resume Work**     | `/afx-next` (Find context)    |
| **Pick Next Task**        | `/afx-task pick <id>`         |
| **Code Feature**          | `/afx-task code <id>`         |
| **Check It Runs**         | `/afx-check path <path>`      |
| **Check It Matches Spec** | `/afx-task verify <task-id>`  |
| **Log Discussion**        | `/afx-session note "content"` |
| **Review Usage**          | `/afx-help`                   |

---

## Guides (Role-Based Workflows)

Run `/afx-help guides` to view these.

### 1. The "Feature Builder" (Developer)

**Goal**: Build a new requirement from scratch.

```bash
# 1. Get Task
/afx-task pick 1.1
# 2. Implement
/afx-task code 1.1
# 3. Verify
/afx-check path apps/webapp/claims
# 4. Audit
/afx-task verify 2.1
# 5. Log
/afx-session log
```

### 2. The "Bug Hunter" (Debugger)

**Goal**: Fix a reported bug.

```bash
# 1. Trace & Fix
/afx-dev debug "Submit button unresponsive"
# 2. Verify Fix
/afx-check path apps/webapp/claims
# 3. Ensure Compliance
/afx-task verify 2.1
```

### 3. The "Product Owner" (Ticket Creator)

**Goal**: Define new work (Task, Feature, Bug).

```bash
# New Task (from Spec)
/afx-task plan "Create phase 3 tasks"
# New Feature Spec
/afx-spec create "new-feature"
# New Bug Report
gh issue create --label "bug" --title "Fix login timeout"
```

### 4. The "Architect" (Planner)

**Goal**: Design system and ensure integrity.

```bash
# 1. Verify Spec Integrity
/afx-check links docs/specs/user-auth
# 2. Promote Decision
/afx-session promote user-auth UA-D001
```

### 5. The "Tester" (QA)

**Goal**: Quality assurance and sign-off.

```bash
# 1. Generate Tests
/afx-dev test packages/db
# 2. Verify Flows
/afx-check path apps/webapp/claims
# 3. Approve
/afx-task complete 2.1 "Verified edge cases"
```

### 6. The "Security Auditor" (SecOps)

**Goal**: Vulnerability assessment.

```bash
# 1. Find Orphans & TODOs
/afx-check trace
# 2. Review for Security
/afx-dev review security
# 3. Audit Scope
/afx-task verify 2.1
```

### 7. The "DevOps Engineer" (Ops)

**Goal**: Maintain project health.

```bash
# 1. Optimization
/afx-dev optimize "Claim submission query"
# 2. Find Orphaned Code
/afx-report orphans
# 3. Sync
/afx-task sync user-auth
```

---

## Command Categories

| Category    | Commands | Purpose                       |
| ----------- | -------- | ----------------------------- |
| **Spec**    | spec     | Spec authoring and review     |
| **Design**  | design   | Design authoring and review   |
| **Task**    | task     | Implementation lifecycle      |
| **Dev**     | dev      | Development actions           |
| **Check**   | check    | Quality gates and compliance  |
| **Session** | session  | Session discussion capture    |
| **Report**  | report   | Traceability metrics          |
| **Hello**   | hello    | Environment and install check |
| **Help**    | help     | This reference                |

---

## See Also

- [AFX Manual](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md) - Full AFX documentation
- [CLAUDE.md](../../CLAUDE.md) - Project coding standards
