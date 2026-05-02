@AGENTS.md

> **Verification**: Run `pnpm verify` after every change; `pnpm fix` to auto-resolve mechanical violations. See `## Verification` in AGENTS.md for the full loop.

<!-- AFX:START - Managed by AFX. Do not edit manually. -->
<!-- AFX Version: 2.5.4 -->

## Documentation References (Living Documentation Traceability)

> **AFX**: Bidirectional code↔spec linking ensures AI agents maintain alignment with specifications.

All spec-driven files MUST have a top-level JSDoc with `@see` references linking back to the relevant spec documents.

**Required links** (enforced by `/afx-check trace`):

| File Type         | Required Links                                           |
| ----------------- | -------------------------------------------------------- |
| `*.repository.ts` | spec.md requirement + design.md section                  |
| `*.service.ts`    | spec.md requirement + design.md section                  |
| `*.action.ts`     | spec.md requirement + design.md section (if spec-driven) |
| `*.model.ts`      | design.md section (if spec-driven)                       |
| `*.constants.ts`  | research doc or design.md (if decision-driven)           |

**Optional links** (allowed but not enforced):

| Target     | When to use                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `tasks.md` | Developer wants a breadcrumb to the originating task — useful but not required since tasks are transactional history |

**Format:**

```typescript
/**
 * [Brief description]
 *
 * @see docs/specs/[feature]/spec.md [FR-X]
 * @see docs/specs/[feature]/design.md [DES-SECTION]
 */
```

**Example (single requirement):**

```typescript
/**
 * User Repository Interface
 *
 * @see docs/specs/user-auth/spec.md [FR-1]
 * @see docs/specs/user-auth/design.md [DES-REPO]
 */
```

**Example (multiple requirements from same spec):**

```typescript
/**
 * Authentication service — handles login, session, and token refresh.
 *
 * @see docs/specs/user-auth/spec.md [FR-1] [FR-2] [NFR-1]
 * @see docs/specs/user-auth/design.md [DES-AUTH] [DES-SESSION]
 */
```

Multiple Node IDs on the same `@see` line means the function implements all of those requirements. Use one `@see` line per file, with multiple IDs space-separated.

**Node ID Format:**

- **Spec anchors:** Use `[FR-X]` or `[NFR-X]` matching the requirement ID in the spec table (e.g., `[FR-1]`, `[NFR-3]`)
- **Design anchors:** Use `[DES-SECTION]` with uppercase kebab-case section name (e.g., `[DES-REPO]`)
- **Task anchors (optional):** Use `[X.Y]` where X is phase, Y is task number (e.g., `[2.1]`)
- **Research anchors:** Link directly to research file (e.g., `research/decision-name.md`)

**Inline Annotations:**

Use standard annotation format + `@see` link. **At least one link MUST point to a spec or design** (`docs/specs/`). External links are optional.

```typescript
// ❌ BAD: Orphaned TODO
// TODO: implement pagination

// ✅ GOOD: Spec link required
// TODO: Implement pagination for claim history
// @see docs/specs/feature/spec.md [FR-4]
// @see docs/specs/feature/design.md [DES-API]
```

Standard annotations: `TODO`, `FIXME`, `XXX`, `HACK`, `NOTE`, `BUG`, `OPTIMIZE`, `REVIEW`

### AFX Frontmatter Schema

All AFX-managed files use YAML frontmatter for Obsidian/Dataview compatibility. The `afx: true` marker identifies AFX-owned documents.

**Full Schema (SPEC, DESIGN, TASKS):**

```yaml
---
afx: true # AFX ownership marker (required)
type: SPEC # Document type (required)
status: Draft # Draft | Approved | Living
owner: "@handle" # GitHub handle
version: "1.0" # Semantic versioning (quoted string)
created_at: YYYY-MM-DDTHH:MM:SS.mmmZ # ISO 8601 creation timestamp (millisecond precision)
updated_at: YYYY-MM-DDTHH:MM:SS.mmmZ # Last review timestamp (millisecond precision)
tags: [feature, topic] # Content tags (Obsidian convention)
---
```

**Minimal Schema (COMMAND, JOURNAL):**

```yaml
---
afx: true
type: COMMAND
status: Living
tags: [afx, command, topic]
---
```

**Document Types:**

| Type      | Purpose               | Location                                                     |
| --------- | --------------------- | ------------------------------------------------------------ |
| `SPEC`    | Feature specification | docs/specs/{feature}/spec.md                                 |
| `DESIGN`  | Technical design      | docs/specs/{feature}/design.md                               |
| `TASKS`   | Implementation tasks  | docs/specs/{feature}/tasks.md                                |
| `JOURNAL` | Session log           | docs/specs/{feature}/journal.md                              |
| `RES`     | Research/exploration  | docs/specs/{feature}/research/\*.md                          |
| `ADR`     | Architecture decision | docs/adr/ (global) or docs/specs/{feature}/research/ (local) |

> **Rule:** All timestamps in AFX-generated documents — frontmatter (`created_at`, `updated_at`), inline metadata, journal entries, session captures — MUST use **ISO 8601 with millisecond precision**: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). To get the current timestamp, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via shell. Never guess or use midnight (`T00:00:00.000Z`).

## AgenticFlowX - Session Continuity

This project uses **AgenticFlowX (AFX)** for spec-driven development with session continuity. GitHub tickets serve as living execution logs, not just task lists.

### Core Principle

The spec tells you _what_ to build. The GitHub ticket tells you _where you left off_.

### Session Continuity Rules

**CRITICAL**: After completing work on a GitHub ticket, ALWAYS update:

1. **Session Log**: Add timestamped entry with task, action, files modified
2. **Discovered Issues**: Document any unexpected findings
3. **Decisions Made**: Record rationale for choices
4. **Subtask Checkboxes**: Mark completed items

### Agent Resumption Workflow

When starting or resuming work on a ticket:

1. **READ** GitHub ticket - see current state, what's done, what's pending
2. **CHECK** Session Log - understand last session's work
3. **CHECK** Discovered Issues - see pending edge cases
4. **READ** linked spec/design - get exact values, interfaces, patterns
5. **CONTINUE** from next unchecked subtask
6. **UPDATE** Session Log when done

### Global vs Feature Context (UI/UX)

- **Global Brain (`CLAUDE.md`)**: Contains your system-wide design tokens (e.g., "Use Tailwind", "Use Shadcn components", "Brand colors").
- **Feature Brain (`docs/specs/*/design.md`)**: Contains the specific component composition and visual layout for the current feature.
  **Rule:** ALWAYS check `CLAUDE.md` for global UI constraints before implementing a feature's local design spec. Do not define global component library rules inside local feature specs.

### Commands

#### Discovery

- `/afx-discover capabilities` - High-level project overview (what exists)
- `/afx-discover infra [type]` - Find infrastructure provisioning scripts
- `/afx-discover scripts [keyword]` - Find automation/deployment scripts
- `/afx-discover tools` - List dev/deployment tools

#### Work Orchestration

- `/afx-next` - Quick state check after interruption
- `/afx-task pick <spec-path>` - Pick next task from spec
- `/afx-task resume [spec|num]` - Continue in-progress work
- `/afx-task sync [spec] [issue]` - Bidirectional GitHub sync
- `/afx-task plan [instruction]` - Generate tickets from specs

#### Task Verification

- `/afx-task verify <task-id>` - Verify task implementation vs spec
- `/afx-task brief <task-id>` - Get implementation summary
- `/afx-task list [phase]` - List tasks by phase
- `/afx-task status` - Overall task completion

#### Quality Checks

- `/afx-check path <feature-path>` - Trace execution path UI → DB (Gate 1)
- `/afx-check trace [path]` - Audit annotations for PRD compliance
- `/afx-check links <spec-path>` - Verify cross-references
- `/afx-check all <feature-path>` - Run all checks

#### Development Actions

- `/afx-task code [instruction]` - Implement with @see traceability
- `/afx-dev debug [error]` - Debug with spec trace
- `/afx-dev refactor [scope]` - Refactor maintaining spec alignment
- `/afx-dev review [scope]` - Code review against specs
- `/afx-dev test [scope]` - Run/generate tests

#### Session Capture

- `/afx-session note "content" [tags]` - Smart note (unifies capture/append)
- `/afx-session log [feature]` - Save session to log
- `/afx-session active [feature|all]` - Show active discussions
- `/afx-session recap [feature|all]` - Recap for resumption
- `/afx-session promote <id>` - Promote discussion to ADR
- `/afx-next` - Context-aware "Golden Thread" guidance

#### Reporting

- `/afx-report health [spec]` - Overall traceability metrics
- `/afx-report orphans [path]` - Code without @see links
- `/afx-report coverage <spec>` - Spec → Code coverage map

#### Setup & Context

- `/afx-scaffold spec <name>` - Create new feature spec
- `/afx-adr create <title>` - Create global ADR in `docs/adr/`
- `/afx-context save [feature]` - Generate context bundle
- `/afx-context load` - Load context from previous context
- `/afx-help` - Show command reference

### Session Discussion Capture

Use `/afx-session` to capture important discussions with AI agents:

```bash
/afx-next                                  # "What do I do now?"
/afx-session note "content"                # Smart note (auto-tags)
/afx-session note --ref UA-D001 "content"  # Append to discussion
/afx-session log [feature]                 # Summarize session to log
/afx-session active [feature|all]           # Show active discussions
/afx-session promote <id>                  # Promote to ADR
```

Discussions are stored in `docs/specs/{feature}/journal.md` with auto-generated tags for filtering.

<!-- AFX:END -->
