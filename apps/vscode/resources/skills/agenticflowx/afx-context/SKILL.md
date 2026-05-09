---
name: afx-context
description: Session context transfer — save detailed context bundles for agent handoff, load previous context, track spec evolution, and analyze cross-feature impact
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,context,session,handoff,continuity"
  afx-argument-hint: "save | load | history | impact"
---

# 🤝 Session Context protocol for seamless context transfer between AI sessions.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where feature specs live (default: `docs/specs`)
- `paths.adr` - Where global ADR files live (default: `docs/adr`)

If neither file exists, use defaults.

## Usage

```bash
/afx-context save [feature]       # Generate context (auto-detects all features if omitted)
/afx-context load                 # Load context from .afx/context.md
/afx-context history [feature]    # Show spec evolution timeline
/afx-context impact <change>      # Analyze cross-feature impact
```

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/modify context bundles in `.afx/context/`
- Analyze spec evolution and cross-feature impact (read-only analysis)
- Append to `docs/specs/**/journal.md` (Captures only, via Proactive Capture Protocol)

### Forbidden

- Create/modify/delete source code in application directories
- Modify spec files (`spec.md`, `design.md`, `tasks.md`)
- Delete any files outside `.afx/context/`
- Run build/test/deploy/migration commands

If implementation is requested, respond with:

```text
Out of scope for /afx-context (context transfer mode). Use /afx-dev code to implement.
```

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-context`**: Cross-feature impact detected.

## Post-Action Checklist (MANDATORY)

After completing any action that modifies `.afx/context.md` or logs to `journal.md`, you MUST:

1. Ensure full compliance with the AFX `Canonical Frontmatter` schema, preserving strictly formatted timestamps.
2. Confirm the saved context contains actionable, comprehensive narrative details. Never output "empty" or overly abbreviated contexts, as the next agent depends completely on this details.

---

## Purpose

Formalize context transfer between AI agent sessions. When an agent times out, disconnects, or needs to hand off work, this command ensures the next agent can resume exactly where the previous one left off.

**Also serves as human memory refresh** — contexts are written detailed enough for a developer to recall a session from 3+ days ago, including reasoning, decisions, and research findings.

**Unique to AFX**: No other framework provides structured agent-to-agent context with context preservation.

## Living-Doc Boundary

Context bundles and history are memory artifacts, not living product/technical truth. Never copy chronological session narrative into `spec.md` or `design.md`; use `/afx-spec refine`, `/afx-design refine`, or `/afx-task refine` to update current state, and keep history in `journal.md` / `.afx/context.md`.

### Timestamp Format (MANDATORY)

When creating or updating context bundles (`saved` frontmatter, journal archive entries), all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/tasks.md` → `user-auth`).
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Prompt user: "Which feature context to save/load?"
3. **Trailing parameters (`[...context]`):** Treat extra words as constraints for context aggregation (e.g., `/afx-context save user-auth exclude dependencies` → exclude dependency analysis from the bundle).

### Next Command Suggestion (MANDATORY)

| Context                       | Suggested Next Command                      |
| ----------------------------- | ------------------------------------------- |
| After `save` (context ready)  | Share bundle, then session ends             |
| After `load` (context loaded) | `/afx-next` to choose the safest next step  |
| After `history` (reviewing)   | `/afx-next` or `/afx-task pick`             |
| After `impact` (analyzing)    | `/afx-spec refine` or `/afx-design refine` if current truth changes |

---

## Storage

**Single file**: `.afx/context.md`

- One centralized location — no scanning across spec folders
- `load` reads this file directly
- History preserved via one-liner archive entries in each feature's `journal.md` (historical contexts and narratives should _always_ go here, never in living documents like `design.md` or `spec.md`)

---

## Subcommands

---

## 1. save

Generate a detailed context bundle for the next agent session (or for human recall).

```bash
/afx-context save                 # Auto-detect all features from git diff + session context
/afx-context save user-auth       # Single feature override
```

### Process

1. If `.afx.yaml` not found, use `.afx/context.md` as default. If it exists and is NOT cleared, warn: "Existing context found. Overwrite?" Wait for confirmation before proceeding.
2. **Detect features**: From git diff + session context (or argument). Identify ALL features touched this session.
3. **Detect global ADRs**: Scan `docs/adr/*.md` for any Proposed ADRs or those modified in the current session.
4. **Read session state** (per feature):
   - Current/completed tasks from tasks.md
   - Recent journal.md entries and discussions
   - Key decisions with reasoning (Reminder: ensure all reasoning and history is logged to `journal.md` and _not_ to living docs like `design.md`)
   - Blockers (any BLOCKED entries in Work Sessions)
5. **Read uncommitted files**: `git diff --stat` + `git status`
6. **Generate bundle**: Detailed markdown using the template below
7. **Persist**: Write to `.afx/context.md` (overwrite)

### Template

**CRITICAL**: The save output must be detailed enough for a human to recall the session 3+ days later. Include reasoning, not just actions. Preserve specifics verbatim (numbers, counts, call sites). Use emojis and tables for visual scanning.

````markdown
---
afx: true
type: CONTEXT
status: Active
saved: { YYYY-MM-DDTHH:MM:SS.mmmZ }
branch: { branch-name }
features: [{ feature1 }, { feature2 }]
---

# 🤝 Context

📅 **Saved**: {date}
🌿 **Branch**: `{branch}`
⏱️ **Session Duration**: ~{estimate}
🏷️ **Features**: {feature1}, {feature2}

---

## 📋 Session Overview

> High-level narrative of what happened this session — written for a human
> reading this 3 days later. What was the goal? What was accomplished?
> What changed direction and why?

{2-4 paragraph narrative covering the session arc: goals → work done →
outcomes → what's next. Include reasoning, not just actions. Mention any
manual testing results, research findings, or exploratory work.}

---

## 🏛️ Architectural Decisions (ADRs)

> Global architectural decisions proposed or modified during this session.

| ADR  | Title   | Status   | Change Summary |
| ---- | ------- | -------- | -------------- |
| {id} | {title} | {status} | {brief change} |

---

## 🔍 Feature: {feature-name}

### ✅ Completed

| #    | Task        | Detail                                    | Verified                                    |
| ---- | ----------- | ----------------------------------------- | ------------------------------------------- |
| {id} | {task name} | {what was done, with file:line specifics} | {✅ Build / ✅ User / ✅ Test / ⏳ Pending} |

### 🔄 Active Task

> **Task {id}**: {task name}
> **Progress**: {Not started / Partial — what's done, what's left}
> **Blocked by**: {Nothing / specific blocker}
> **Test users**: {credentials if relevant}

### 🚨 Critical Items

> ⚠️ These MUST be preserved verbatim — numbers, counts, specifics matter.
> Never summarize or compress these. They are the most important details
> for the next session.

- **{count} {things}** {specific action needed} (e.g., "14 active call sites need swapping from `getUserService()` → `getUserPermissionService()`")
- **{requirement}** {why it matters} (e.g., "Migration 020 must run before testing 8.2+")

### 🧠 Decisions Made

> **Note**: Verify that all historical reasoning here has been properly logged to `journal.md`. Living documents like `design.md` should only contain the final design state, without historical backstory.

| Decision           | Reasoning                             | Reference                                                   |
| ------------------ | ------------------------------------- | ----------------------------------------------------------- |
| {what was decided} | {why — include trade-offs considered} | [{discussion-id}](docs/specs/{feature}/journal.md#{anchor}) |

### 💬 Discussions & Research

> Summaries of key discussions — enough to recall the reasoning without
> re-reading the full journal. Include conclusions, not just topics.
> Link to journal/research for deep dive.

**{Discussion Title}** ({feature}):
{3-5 sentence summary of what was discussed, what was concluded, and why.
Include specific numbers, findings, or outcomes.}
📄 [{link text}]({path-to-journal-or-research-doc})

### ⚠️ Watch Out

- {Specific gotcha with enough context to understand why it matters}
- {Another gotcha}

### 📎 References

| Type     | Link                                                 | Why                  |
| -------- | ---------------------------------------------------- | -------------------- |
| Tasks    | [{section}](docs/specs/{feature}/tasks.md#{anchor})  | {what to find there} |
| Design   | [{section}](docs/specs/{feature}/design.md#{anchor}) | {what to find there} |
| Journal  | [{id}](docs/specs/{feature}/journal.md#{anchor})     | {what to find there} |
| Research | [{doc}](docs/specs/{feature}/research/{file})        | {what to find there} |

---

## 🔍 Feature: {feature-name-2}

{Repeat same structure for each feature touched in session}

---

## 📁 Uncommitted Files

| Status  | File          | Changes                        |
| ------- | ------------- | ------------------------------ |
| {M/A/D} | `{file-path}` | {brief description of changes} |

> 📊 Total: {N} files ({M} modified, {A} added, {D} deleted)

---

## ➡️ Next Agent Instructions

> Prioritized, actionable steps with specifics. Not vague — include
> task IDs, file paths, and concrete actions.

| Priority | Action   | Detail                                      |
| -------- | -------- | ------------------------------------------- |
| 1        | {action} | {specific detail with task IDs, file paths} |
| 2        | {action} | {specific detail}                           |
| 3        | {action} | {specific detail}                           |

## 🚀 Commands to Start

```bash
/afx-context load           # Load this context
/afx-task pick              # Continue implementation
```
````

---

## 2. load

Load context from a previous context. Fast — reads a single file.

### Usage

```bash
/afx-context load                 # Load from .afx/context.md
```

### Process

1. **Read** `.afx/context.md`
2. **Check empty**: If `.afx/context.md` has `status: Cleared` or is missing, inform user "No active context found" and suggest `/afx-context save`
3. **Output full content**: Display the context bundle as-is. **DO NOT compress, summarize, or omit details** — the save step already structured it for consumption
4. **Archive**: Provide a one-liner archive entry for the user to optionally paste into their `journal.md` under `## Contexts`:

   ```markdown
   ### {date} — Context Loaded

   **Saved**: {original save date}
   **Features**: {feature list}
   ```

### Output

The full context bundle content, followed by:

```markdown
---

✅ **Context loaded from** `.afx/context.md`

Next (ranked):

1. /afx-dev code # Context-driven: Continue implementation
2. /afx-task pick # Context-driven: Pick up from task queue
3. /afx-session recap {feature} # Context-driven: Review more context
   ──
4. /afx-next # Re-orient after context load
5. /afx-help # See all options
```

---

## 3. history

Show spec evolution timeline - what changed and when.

### Usage

```bash
/afx-context history user-auth
/afx-context history all               # All specs
```

### Process

1. **Read git log**: Commits touching spec files
2. **Build timeline**: Summarize commits and sort by date

### Output

```markdown
## Spec Timeline: user-auth

### 2025-12-16 - v1.3 (Current)

- Added: Phase 7 supplier assignment
- Changed: Anchor format to dot notation (#7.1-slug)
- Source: UA-D001 discussion promoted

### 2025-12-15 - v1.2

- Added: Session log Work Sessions format
- Fixed: Missing pagination spec in tasks.md

### 2025-12-14 - v1.1

- Added: Phase 6 testing requirements
- Changed: ClaimStatus enum to UPPERCASE

### 2025-12-02 - v1.0

- Initial spec created
- Phases 0-5 defined

---

### Files Changed

| Version | spec.md | design.md | tasks.md |
| ------- | ------- | --------- | -------- |
| v1.3    | -       | +section  | +phase7  |
| v1.2    | -       | -         | +session |
| v1.1    | +enum   | +diagram  | +phase6  |

Next: /afx-task pick user-auth # Continue with latest spec
```

---

## 4. impact

Analyze cross-feature impact when specs change.

### Usage

```bash
/afx-context impact "Remove ClaimStatus.DRAFT"
/afx-context impact design.md#supplier-assignment
```

### Process

1. **Parse change**: Identify affected symbols/sections
2. **Search code**: Find @see references to affected sections
3. **Search specs**: Find cross-references between specs
4. **Calculate risk**: Based on number of affected files

### Output

```markdown
## Impact Analysis: Remove ClaimStatus.DRAFT

**Risk Level**: HIGH
**Affected locations**: 18

---

### Code Impact

| Package/App | Files | References    |
| ----------- | ----- | ------------- |
| apps/admin  | 8     | 12 references |
| apps/portal | 4     | 5 references  |
| packages/db | 2     | 3 references  |

**Files to update**:

- src/features/user-auth/claim-list.tsx:45
- src/features/user-auth/claim-form.tsx:89
- packages/db/src/core/services/claim.service.ts:23
- ...

---

### Spec Impact

| Spec              | Cross-References             |
| ----------------- | ---------------------------- |
| users-permissions | Links to user-auth design.md |
| agenticflow       | Example uses ClaimStatus     |

---

### Recommendation

**Breaking Change** - Requires careful migration:

1. Deprecation period: Mark DRAFT as deprecated
2. Migration script: Update existing DRAFT claims
3. Code update: Remove DRAFT from enum
4. Spec update: Remove from design.md

**Estimated effort**: 2-4 hours

Next: /afx-dev code # Start migration if approved
```

---

## Integration

| Command              | Relationship                                    |
| -------------------- | ----------------------------------------------- |
| `/afx-next`          | Quick state; context is comprehensive           |
| `/afx-session recap` | Discussion summary; context includes work state |
| `/afx-report`        | Metrics; context is per-session context         |
