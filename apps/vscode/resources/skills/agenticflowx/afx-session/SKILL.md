---
name: afx-session
description: Session discussion capture — smart notes, session logging, context recaps, and ADR promotion
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,session,notes,discussion,journal"
  afx-argument-hint: "note | log | recap | promote | capture"
---

# /afx-session

Session discussion capture and recall for multi-agent workflows.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADRs live (default: `docs/adr`)
- `library.research` - Global research library path (default: `docs/research`)
- `prefixes` - Feature prefix mappings for discussion IDs

If neither file exists, use defaults.

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/modify markdown files only in:
  - `docs/specs/**/journal.md` (feature session logs)
  - `docs/specs/journal.md` (global session log)
  - `docs/specs/**/research/` (ADR promotion only)
  - `docs/adr/` (ADR promotion only)

### Forbidden

- Create/modify/delete source code in application directories
- Modify spec files (`spec.md`, `design.md`, `tasks.md`)
- Delete any files
- Run build/test/deploy/migration commands

If implementation is requested, respond with:

```text
Out of scope for /afx-session (session capture mode). Use /afx-dev code to implement.
```

## Post-Action Checklist (MANDATORY)

After modifying `journal.md`, you MUST (see `assets/journal-template.md` for canonical structure):

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in `journal.md` frontmatter.
2. **Append-Only Entries**: Never edit or remove existing journal entries. Only append new ones.
3. **Format Preservation**: Maintain canonical frontmatter field order. Use double quotes.
4. **Discussion IDs**: New discussions must use the next sequential ID (e.g., if last is XX-D003, use XX-D004).
5. **Template Format Check**: Verify discussion headers use `### {PREFIX}-D{NNN} - Title` format, status uses backtick `` `status:active` `` markers, and all mandatory bold sections (`**Context**:`, `**Summary**:`, `**Decisions**:`) are present. Custom sections allowed but mandatory ones must not be omitted. See **Template Format Rules (CRITICAL)** section.

---

## Usage

```bash
/afx-session note "content" [tags] [--ref id]                        # Smart Note (unifies note/capture/append)
/afx-session log [feature]                                           # Save session to log
/afx-session recap [feature|all]                                     # AI synthesis of context for resumption
/afx-session promote <id>                                            # Promote to ADR
/afx-session capture [feature] [--trigger <kind>] [--links <anchors>] [--agent <name>] [--model <id>] [...context]  # Verbatim prompt + agent-reply excerpt at a pivotal moment
```

> **Display Rule:** Don't dump full discussion lists, search results, or status filters into chat unless the user explicitly asks. The user can browse `journal.md` directly, or use a UI host such as the AgenticFlowX VS Code extension (Journal Tab) if installed. These subcommands focus on operations that require agent reasoning or file mutation, not raw display.

## Purpose

Capture important discussions with AI agents across multiple windows and topics. Unlike `/afx-next` (task state) or `research/` (permanent decisions), this captures the **in-between** - ideas, tips, and context that matter but aren't yet formal decisions.

## Living-Doc Boundary

`journal.md` is append-only history. Do not put chronological backstory, discarded options, or raw captures into `spec.md` / `design.md`; when a discussion changes current truth, route the follow-up to `/afx-spec refine`, `/afx-design refine`, or `/afx-task refine`.

## Default Location

When no feature is specified, discussions go to `docs/specs/journal.md`. This is for:

- Early-stage ideation
- Cross-cutting discussions
- Ideas that don't yet belong to a feature

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/journal.md` → `user-auth`). If code is selected, use it as additional context for note capture.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Target the global journal (`docs/specs/journal.md`) if no feature can be inferred.
3. **Trailing parameters (`[...context]`):** Treat extra words as focus constraints for capture/summarization (e.g., `/afx-session log auth error handling` → focus the session log on auth error handling discussion).

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-session` action, suggest the most appropriate next command based on context:

| Context                         | Suggested Next Command                    |
| ------------------------------- | ----------------------------------------- |
| After `note` (more to discuss)  | Continue discussion or `/afx-session log` |
| After `note` (ready to work)    | `/afx-next` or `/afx-task pick <id>`      |
| After `note` (quick note added) | Continue working or `/afx-session recap`  |
| After `log`                     | `/afx-task pick <id>` or `/afx-task code` |
| After `recap` (resuming work)   | `/afx-next` then `/afx-task code`         |
| After `promote` (ADR created)   | `/afx-adr review <id>` then `/afx-next`   |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. /afx-next # Context-driven: Choose the safest next workflow step
2. /afx-session log {feature} # Context-driven: Summarize before moving on
3. /afx-session promote UA-D001 # Context-driven: Elevate to ADR if significant
   ──
4. /afx-next # Re-orient after capture
5. /afx-help # See all options
```

### Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use `ask_followup_question` to present options as clickable buttons instead of text-only suggestions.

**Trigger conditions:**

| Condition                                                          | Question                                                              | Options                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------- |
| After `note` with decision or ADR-worthy content                   | "This looks like an architectural decision. Promote to ADR?"          | "Promote to ADR" / "Keep as note" / "Not now"        |
| After `note --ref` appends to a discussion with `status:closed`    | "This discussion is closed. Reopen it or start a new one?"            | "Reopen discussion" / "New discussion" / "Not now"   |
| After `log` with unresolved items                                  | "Session logged. Some items are unresolved. Continue?"                | "Continue discussion" / "Pick next task" / "Not now" |
| After `log` with all items resolved                                | "Session logged. All items resolved — ready to move on?"              | "Pick next task" / "Save context" / "Not now"        |
| After `recap` showing stale context                                | "Context is stale. Save a fresh context bundle?"                      | "Save context" / "Continue working" / "Not now"      |
| After `recap` showing open decisions across multiple features      | "Open decisions span multiple features. Review cross-feature impact?" | "Review impact" / "Continue working" / "Not now"     |
| After `promote` to ADR completes                                   | "ADR created. Ready to implement the decision?"                       | "Implement now" / "Review ADR" / "Not now"           |
| After `promote --to` creates new feature spec                      | "New feature spec created. Author the spec?"                          | "Author spec" / "Pick task" / "Not now"              |
| `## Captures` has 5+ unlogged entries (detected during any action) | "Multiple captures are piling up. Consolidate into a discussion?"     | "Log session" / "Keep capturing" / "Not now"         |
| Discussion has 3+ notes appended (detected during `note --ref`)    | "This discussion has grown. Summarize into a new log entry?"          | "Log summary" / "Keep appending" / "Not now"         |

**Rules:**

- Only trigger when the lifecycle gate is actually actionable (preconditions met)
- Include "Not now" as the last option — never force the user
- If user selects an action, execute it immediately (run the promote/log/save flow)
- If user selects "Not now", continue normally — do not re-ask in the same conversation
- Keep existing text-only "Next Command Suggestion" for non-lifecycle contexts
- These buttons complement, not replace, the text suggestions

---

### Timestamp Format (MANDATORY)

When creating or updating journal entries, captures, notes, and discussion metadata, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Frontmatter (MANDATORY)

All ADRs created via `promote` MUST include AFX frontmatter:

```yaml
---
afx: true
type: ADR
status: Proposed
owner: "@handle"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: [<dynamic-feature>, <dynamic-topic>]
source: journal.md#<discussion-id>
---
```

**Tag rules:** Tags are **dynamic** — derived from the feature name and discussion topic (e.g., `[auth, token-storage]`). Do not use generic placeholders.

---

### 1. Parse Subcommand

Determine action from first argument:

| Subcommand | Purpose                                             |
| ---------- | --------------------------------------------------- |
| `note`     | Smart capture (handles notes, tags, and appending)  |
| `log`      | Summarize conversation into permanent record        |
| `recap`    | Generate comprehensive recap for session resumption |
| `promote`  | Promote discussion to ADR or new feature spec       |

**Stores discussions in**: `docs/specs/journal.md` (global) or `docs/specs/{feature}/journal.md` (feature-specific).

### When to use

- **note**: Capture thoughts during discussion or write directly — "Forgot to handle null case" or "look into Pulumi for IaC"
- **log**: Summarize a conversation into a permanent record
- **recap**: "What did we discuss last time?"
- **promote**: "This discussion is now an ADR or a new Feature"

---

## Template Format Rules (CRITICAL)

The AFX `journal.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it to display discussions, statuses, and notes. Deviations cause **silent failures** in tools that render journals (e.g., the VS Code extension fails to display entries). These rules define the canonical format — custom sections are allowed but mandatory ones must not be omitted.

**Template reference:** `assets/journal-template.md`

### Document Structure

Mandatory sections in order:

1. YAML frontmatter (between `---` delimiters)
2. `# Journal - {Feature Name}` (h1 title)
3. `<!-- prefix: XX -->` comment (defines discussion ID prefix)
4. `## Captures` section (quick notes during active chat)
5. `## Discussions` section (recorded discussions with IDs)

### Frontmatter

**Canonical field order**: `afx → type → status → owner → created_at → updated_at → tags`. `type` MUST be `JOURNAL`, `status` MUST be `Living`. See `assets/journal-template.md` for full schema.

### Discussion Headers

**Required format**: `### {PREFIX}-D{NNN} - Topic Title`

- MUST be an h3 heading (`### `)
- Prefix: 2-4 uppercase letters derived from feature name (e.g., `user-auth` → `UA`)
- ID number: zero-padded 3 digits (`D001`, `D042`, `D999`)
- Separator between prefix-ID and title: `-` (space-dash-space)
- NO date in the heading — date goes in inline metadata below
- **NOT**: `## UA-D001` (wrong level), `### UA-D1` (not zero-padded), `### UA-D001 - 2026-04-09 - Title` (date in heading)

### Inline Metadata

Line immediately below the discussion header:

```markdown
`status:active` `2026-04-09T14:30:00.000Z` `[tag1, tag2]`
```

- **Status**: `` `status:active` ``, `` `status:blocked` ``, or `` `status:closed` `` — backtick-quoted, no spaces around colon, lowercase value
- **Timestamp**: ISO 8601 with milliseconds in backticks
- **Tags**: comma-separated in backticks with square brackets

### Mandatory Bold Section Headers

Every discussion MUST include at minimum:

| Section   | Format           | Purpose                      |
| --------- | ---------------- | ---------------------------- |
| Context   | `**Context**:`   | What prompted the discussion |
| Summary   | `**Summary**:`   | 2-3 sentence overview        |
| Decisions | `**Decisions**:` | List items with `- ` prefix  |

Format rule: `**Word**:` — double-asterisk bold, immediately followed by colon and space.

### Optional Standard Sections

These are expected but not strictly required:

- `**Progress**:` — checkbox items (`- [x]` / `- [ ]`)
- `**Tips/Ideas**:` — list items
- `**Notes**:` — append-only notes with sub-ID format `**[XX-D001.N1]** **[timestamp]** content`
- `**Related Files**:` — cumulative comma-separated file list (grows as notes are appended)
- `**Participants**:` — @handles

---

## Subcommands

---

## 1. note (Smart Note)

**Usage**:

```bash
/afx-session note "content"                    # Auto-tags based on context
/afx-session note "content" #idea #auth        # Explicit tags (Obsidian style)
/afx-session note --ref UA-D001 "content"      # Append to existing discussion
```

### Purpose

Unifies all "input" actions. Whether you are capturing a fleeting thought, adding a formal manual note, or appending to an existing discussion, just use `note`.

### Process

1. **Parse Arguments**:
   - Check for `#tags` in content OR `--tags` flag.
   - Check for `--ref <id>` to determine if this is an append action.
   - Detect feature context (argument or inferred).

2. **Smart Tagging (Active Inference)**:
   - **If tags present**: Use them.
   - **If no tags**: Analyze content + recent context.
     - "We need to fix the auth0 callback" -> `[auth, bug, high-priority]`
     - "Maybe we use Redis here" -> `[architecture, idea, database]`
   - **Obsidian Compatibility**: Convert output tags to `#hash-tags` in the markdown file for interoperability.

3. **Routing**:
   - **If `--ref`**: Append to `**Notes**` section of that discussion ID.
   - **Default**: Append to `## Captures` section of `journal.md`.

### Output Example

```
Captured: "Fix auth callback" [#auth #bug]
to: docs/specs/user-auth/journal.md
```

---

## 2. log

**Usage**: `/afx-session log [feature]`

Summarize the current session's captures into a permanent discussion entry.

### Process

1. **Read Conversation**: Analyze recent chat history or provided summary.
2. **Generate Discussion ID**:
   - Read `<!-- prefix: XX -->` from `journal.md`
   - Find last ID (e.g. `UA-D005`) -> New ID `UA-D006`
3. **Format Entry**: Create structured markdown entry with metadata.
4. **Append to Journal**: Write to `## Discussions` section **at the end** (chronological order - oldest first, newest last).
5. **Clear Scratchpad**: Remove items from `## Captures` if they are covered.

### Active Inference Protocol (CRITICAL)

**When to suggest saving**:
The Agent MUST actively monitor the conversation depth. Suggest `/afx-session log` when:

1.  **key decisions** are made ("Let's use Postgres").
2.  **complex logic** is explained ("The flow requires step A then B").
3.  **session is ending** or context switching.

**Do NOT wait for the user.** If the user says "Okay, that makes sense, let's move on", you SHOULD interject:

> "Before we move on, should I save this decision about Postgres to the session log?

> `> /afx-session log`"

### Proactive Capture Protocol (MANDATORY)

**Cross-cutting rule**: This protocol applies to ALL AFX skills, not just `/afx-session`. When any skill detects a high-impact context change during its operation, it MUST auto-capture to `journal.md` without waiting for the user to invoke `/afx-session`.

**Triggers for `/afx-session`**: User discusses complex architectural trade-offs, scope cuts, or defers decisions without explicitly running `log`.

#### Trigger Conditions

Auto-capture (without asking) when the agent detects:

| Trigger              | Example                               | What to capture                        |
| -------------------- | ------------------------------------- | -------------------------------------- |
| Decision deferred    | "not now", "later", "future phase"    | Decision + reason + what it blocks     |
| ADR-impacting choice | "let's use Postgres instead of Mongo" | The decision + alternatives considered |
| Spec deviation       | "skip that requirement for MVP"       | Which FR/NFR is affected + why         |
| Research finding     | "turns out X doesn't support Y"       | Finding + source + impact              |
| Architecture change  | "move auth to a separate service"     | What changed + what's affected         |
| Scope cut            | "drop feature X from this release"    | What's cut + where to track it         |

#### Capture Format

Append to `## Captures` section in the appropriate `journal.md`:

```markdown
- **{YYYY-MM-DDTHH:MM:SS.mmmZ}** - [AUTO:{skill}] {one-line summary}
  `[{auto-tags}, auto-capture]`
  **Impact**: {what this affects: ADR/spec/code/research}
  **Action**: {deferred|decided|changed|cut} → {when/what to revisit}
```

#### Rules

1. **Write to `## Captures`** — not `## Discussions` (that's for `/afx-session log`)
2. **Tag with `auto-capture`** — so entries are filterable
3. **Include source skill** — prefix: `[AUTO:afx-dev]`, `[AUTO:afx-spec]`, etc.
4. **No duplicates** — if the same decision was just captured, skip
5. **Feature routing** — if the context has an active feature, write to `docs/specs/{feature}/journal.md`. Otherwise write to `docs/specs/journal.md`
6. **Consolidation** — still suggest `/afx-session log` at natural breakpoints to consolidate captures into full discussion entries

#### Example

During `/afx-dev code`, the user says "let's skip pagination for now, we'll do it in Phase 2":

```markdown
- **2025-03-17T14:30:00.000Z** - [AUTO:afx-dev] Pagination deferred to Phase 2
  `[pagination, deferred, phase-2, auto-capture]`
  **Impact**: spec — FR-7 (pagination) remains unimplemented
  **Action**: deferred → revisit in Phase 2 planning
```

#### Prompt Capture Triggers (propose + confirm)

Separate from auto-capture above, **prompt captures** preserve the verbatim user prompt + agent-reply excerpt at pivotal moments. Unlike auto-capture (silent summary), prompt captures are **proposed to the user for confirmation** before writing. Delegate to `/afx-session capture` when detecting:

| Observed change                                                            | Inferred trigger           |
| -------------------------------------------------------------------------- | -------------------------- |
| New `FR-X` / `NFR-X` row added to spec                                     | `new-fr` / `new-nfr`       |
| FR/NFR row removed or moved to Non-Goals                                   | `removed-fr` / `scope-cut` |
| New `[DES-X]` section added, or Key Decisions table entry changed          | `design-pivot`             |
| Open Question moved from `Open` → `Resolved`                               | `question-resolved`        |
| User phrases: "oh wait", "actually", "I missed", "what about", "we forgot" | `missed-req`               |
| Ambiguity clarified mid-conversation (no artifact change yet)              | `ambiguity-resolved`       |
| Any other pivotal moment the user explicitly marks                         | `other`                    |

When a caller skill (`/afx-sprint`, `/afx-spec`, `/afx-design`, `/afx-task`, `/afx-research`, `/afx-dev`) detects one of these triggers **after applying** the artifact edit, it should:

1. **Apply the Significance Check** below. If the change fails, skip silently — do not propose.
2. Otherwise call `/afx-session capture` with the detected `trigger` kind and `links` (anchors just modified).
3. Let `/afx-session capture` compose and show the preview.
4. Only write on user confirmation.

Prompt captures complement — don't replace — the silent summary captures above. Both can fire for the same event (summary for fast recall, prompt capture for verbatim fidelity).

##### Significance Check (Context-Aware Gate)

Triggers in the table above are **pattern-based** — they fire on any edit that matches. Many such edits are cosmetic (typo, rewording, reformatting) and shouldn't create journal noise. Before proposing a capture, every **proactive** invocation MUST run the following two-stage gate. **Manual invocations of `/afx-session capture` skip this gate entirely** — the user has already decided.

**Stage 1 — Hard Skips** (always skip, no capture):

- Only whitespace, punctuation, or casing changed
- Pure synonym swap / rewording with no semantic shift (e.g., "users can" → "a user can")
- User phrased the edit as `typo`, `fix wording`, `polish`, `reformat`, `style`, `nit`, `cleanup`
- Reverting a change made less than 3 turns ago (treat as correction, not decision)
- Change is limited to a heading's formatting or a table's column width
- `updated_at` / version / metadata-only edits

**Stage 2 — Significance Rubric** (propose only if **at least one** is yes):

1. **New decision or reversal?** — Does the change encode a new decision, new constraint, or reversal of a prior decision? (new FR, removed FR, `[DES-X]` pivot, Open Question → Resolved, requirement demoted from Must Have to Should Have, scope moved in/out of Non-Goals.)
2. **Institutional knowledge at stake?** — Would a future reader (agent or human) need to know **why** this change happened to correctly interpret the spec? If the edit is self-explanatory from the current artifact alone, answer no.
3. **Earned through discussion?** — Did the change emerge from meaningful back-and-forth in the conversation? Signals: ≥3 conversation turns spent on it, user used pivot phrases (`wait`, `actually`, `I missed`, `we forgot`, `let's pivot`), or the user pushed back on an earlier agent proposal.

**Ambiguity rule**: if all three questions answer `maybe` (no clear yes, no clear no), **default to skip**. Err on the side of fewer captures. The journal is better sparse-and-meaningful than dense-and-noisy. The user can always run `/afx-session capture` manually to force a capture.

**Logging skipped triggers**: do not log, do not announce. Skipped triggers are invisible — the conversation continues without interruption.

**Example — trigger fires, significance check skips:**

> User: "tiny fix — FR-2 should say 'can log in' not 'is able to log in'"
> Agent: applies the edit, detects `edit to FR-2 pattern`, enters Significance Check:
>
> - Hard Skip stage: user phrased as "tiny fix" → **Skip**. No capture proposed.

**Example — trigger fires, significance check proceeds:**

> User: "wait, we need rate limiting on login — had a credential stuffing incident last quarter"
> Agent: adds FR-4, detects `new FR` trigger, enters Significance Check:
>
> - Hard Skip stage: no match.
> - Rubric: Q1 yes (new constraint), Q2 yes (incident rationale would be lost), Q3 yes (pivot phrase "wait"). → **Propose capture**. Shows preview, user confirms, entry appended.

---

## 3. Recap Mode

**Usage**: `/afx-session recap [feature|all]` or `/afx-session recap [feature|all] --tag <tag>`

Generate comprehensive recap for session resumption:

1. **Gather** discussions from specified scope
2. **If `--tag` specified**: Filter to discussions containing that tag
3. **Sort** by date (most recent first)
4. **Generate** recap with tags shown:

```markdown
## Session Recap

### Last 7 Days

#### user-auth (2 discussions)

- **2025-12-15T10:30:00.000Z**: Supplier assignment - Decided on hardcoded Phase 1 approach
- **2025-12-14T16:00:00.000Z**: Email notifications - Deferred to Phase 2

#### agenticflow (1 discussion)

- **2025-12-15T09:15:00.000Z**: PRD-first traceability - Validated uniqueness vs competitors

### Key Decisions Made

1. PRD links required, external links optional (agenticflow)
2. Supplier table deferred to Phase 2 (user-auth)

### Open Items

- [ ] Implement supplier email notifications
- [ ] Create supplier database table

### Resume From

Continue with: {most recent incomplete work}

Next: /afx-next # Then continue with suggested task
```

---

## 4. Promote Mode

**Usage**:

- `/afx-session promote <discussion-id>` - Promote to ADR (e.g., `UA-D001` promotes within user-auth)
- `/afx-session promote <discussion-id> --to <new-feature>` - Promote from `_sessions` to new feature spec (e.g., `GEN-D001 --to multi-tenant`)

#### 4a. Promote to ADR (within feature)

1. **Parse prefix** from discussion ID to determine feature (e.g., `UA-D001` → user-auth)
2. **Find** discussion by ID in `docs/specs/{feature}/journal.md`
3. **Create** ADR in `docs/specs/{feature}/research/{topic-slug}.md`

#### 4b. Promote to New Feature (from \_sessions)

1. **Find** discussion by ID in `docs/specs/journal.md`
2. **Create** new feature spec structure:
   ```text
   docs/specs/{new-feature}/
   ├── spec.md         # Stub with discussion summary as starting point
   ├── design.md       # Empty template
   ├── tasks.md        # Empty template
   └── journal.md  # Move discussion here
   ```
3. **Move** the discussion from `journal.md` to new feature's journal.md
4. **Update** `journal.md` with link: `**Promoted**: [new-feature](../new-feature/journal.md)`

#### ADR Template (for promote to ADR):

```markdown
---
afx: true
type: ADR
status: Accepted
owner: "@handle"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: [<dynamic-feature>, <dynamic-topic>]
source: journal.md#{discussion-id}
---

# ADR: {Topic Title}

**Promoted From**: [journal.md#UA-D001](journal.md#wc-d001---topic-title)

## Context

{Context from discussion}

## Decision

{Decisions from discussion}

## Consequences

{Derived from tips/ideas}

## Related

- {Related files}
```

3. **Update** discussion entry with link: `**Promoted**: [ADR](research/{slug}.md)`
4. **Confirm** promotion

5. **Suggest next command**:

```
Next: /afx-dev code   # Implement the decision from the ADR
```

Or for new feature promotion:

```
Next: /afx-task pick docs/specs/{new-feature}/tasks.md   # Start implementing new feature
```

---

## 5. capture

Preserve a **verbatim user prompt + focused agent-reply excerpt** at a pivotal moment, linked to the artifact change it produced. Complements the summary-style Discussions — stores the _how_, not just the _what_.

### Usage

```bash
/afx-session capture [feature] [--trigger <kind>] [--links <anchors>] [--agent <name>] [--model <id>] [...context]
```

- `[feature]`: feature slug. Omitted → inferred from IDE/CLI context, falls back to global journal (`docs/specs/journal.md`).
- `--trigger <kind>`: one of `new-fr`, `new-nfr`, `removed-fr`, `design-pivot`, `missed-req`, `scope-cut`, `ambiguity-resolved`, `question-resolved`, `other`. Optional — agent infers from recent changes if omitted.
- `--links <anchors>`: comma-separated anchors affected (e.g., `FR-4,DES-RATE-LIMIT,1.3`). Optional — agent infers from recent tool-use if omitted.
- `--agent <name>`: explicit agent identity override (e.g., `claude-code`, `codex`, `copilot`, `gemini-code-assist`). Optional — defaults to the running agent's self-reported name.
- `--model <id>`: explicit model identifier override (e.g., `claude-opus-4-7`, `claude-sonnet-4-6`, `gpt-5-codex`, `gemini-2.5-pro`). Optional — defaults to the running agent's self-reported model.
- `[...context]`: free-text hint about which exchange to capture or why it matters (e.g., `"the lockout discussion"`, `"that security pivot"`).

### Process (Manual Invocation)

1. **Resolve feature** and target `journal.md` (feature-scoped or global).
2. **Identify the pivotal exchange** in the recent conversation:
   - If trailing context names it (`"last exchange about lockouts"`), use it to locate the turns.
   - Otherwise scan recent turns and pick the most recent significant exchange based on artifact edits or user signal phrases.
3. **Compose entry**:
   - Extract the **verbatim user prompt** (trim only leading/trailing whitespace; preserve line breaks exactly).
   - Extract a **focused excerpt** from the agent's reply — 1–5 sentences covering the decision. Use `[...]` for omitted portions. Do not paraphrase.
   - **Infer trigger** if not provided: consult the Prompt Capture Triggers table in the Proactive Capture Protocol.
   - **Compute outcome links**: scan recent Edit / Write tool-use for file modifications that align with this exchange. List concrete file:anchor changes.
   - **Resolve agent + model identity**:
     - If `--agent` and `--model` flags provided → use verbatim.
     - Otherwise → the running agent self-reports its own name and model (each AFX-supported agent has runtime access to this: Claude Code, Codex, Copilot, Gemini Code Assist, etc.).
     - Use canonical names matching the git co-author convention: `claude-code`, `codex`, `copilot`, `gemini-code-assist`. For model, use the official model ID (e.g., `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `gpt-5-codex`, `gemini-2.5-pro`).
     - If identity cannot be determined → write `unknown` for either field. **Never fabricate** an agent or model name.
   - **Tag**: auto-generate 2–5 tags from prompt keywords + the trigger kind.
4. **Show preview** (complete markdown block, exactly as it will be appended) and ask `Apply this capture? [y/n]`.
5. **On confirm**: append to `## Prompt Captures` section in `journal.md`, assigning next available `{PREFIX}-P{NNN}` ID. Update `updated_at` frontmatter to the current ISO 8601 timestamp.
6. **On reject**: drop silently. No orphan state, no partial write.

### Process (Proactive Invocation from Caller Skill)

Called by `/afx-sprint`, `/afx-spec`, `/afx-design`, `/afx-task`, `/afx-research`, `/afx-dev` after they apply a triggering edit. The caller passes `--trigger` and `--links` directly. Step 2 is skipped:

1. Use caller-supplied `trigger` and `links`.
2. Use the caller's just-completed agent reply as the excerpt source and the preceding user prompt as the verbatim.
3. Proceed to step 3 (compose) → step 4 (preview + confirm) → step 5 (append).

The user confirmation gate is **always required**, even for proactive invocations. Captures are never written silently.

### Entry Format

Appended to `## Prompt Captures` in `journal.md`:

```markdown
### {PREFIX}-P{NNN} — {One-line summary of what the prompt surfaced}

- `type:prompt-capture` `{YYYY-MM-DDTHH:MM:SS.mmmZ}` `[tag1, tag2, trigger-kind]`
- trigger: {kind}
- triggered-change: {FR-X}, {[DES-X]}, {task X.Y}, ...
- agent: {claude-code | codex | copilot | gemini-code-assist | other | unknown}
- model: {claude-opus-4-7 | claude-sonnet-4-6 | gpt-5-codex | gemini-2.5-pro | ... | unknown}

**User prompt** (verbatim):

> {Exact user text, preserving line breaks}

**Agent reply** (excerpt):

> {1–5 sentence excerpt; `[...]` for omissions}

**Outcome**: {path/to/file.md anchor added}, {path/to/other.md section changed}, ...
```

### ID Convention

- `{PREFIX}` = feature prefix already defined in `journal.md`'s `<!-- prefix: XX -->` comment.
- `-P` distinguishes **prompt captures** from discussions (`-D`).
- `{NNN}` = next sequential zero-padded integer within the Prompt Captures section.
- Example: `UA-P001`, `UA-P002` in `docs/specs/user-auth/journal.md`.

### Example

User running `/afx-sprint spec dark-mode "add FR for keyboard shortcut"`:

1. Sprint applies the edit → adds `FR-4: Toggle via Cmd+Shift+D shortcut`.
2. Sprint delegates to `/afx-session capture --trigger new-fr --links FR-4`.
3. Capture composes and previews:

   ```markdown
   ### DM-P001 — Added keyboard shortcut to toggle dark mode

   - `type:prompt-capture` `2026-04-19T10:14:22.000Z` `[dark-mode, keyboard, a11y, new-fr]`
   - trigger: new-fr
   - triggered-change: FR-4
   - agent: claude-code
   - model: claude-opus-4-7

   **User prompt** (verbatim):

   > add FR for keyboard shortcut

   **Agent reply** (excerpt):

   > Adding FR-4: Toggle via Cmd+Shift+D. This also hits the a11y goal in NFR-2 — keyboard-only users can switch themes without a pointer.

   **Outcome**: docs/specs/dark-mode/dark-mode.md FR-4 added
   ```

4. User confirms `y` → appended to `docs/specs/dark-mode/journal.md`.

### Error Handling

**No recent pivotal exchange found:**

```text
No pivotal exchange detected in the last 10 turns.
Hint: pass [...context] to point at an earlier moment, or use /afx-session note for a quick summary instead.
```

**Target journal.md missing:**

```text
Error: docs/specs/<feature>/journal.md not found.
Run: /afx-scaffold spec <feature>   # Create the feature structure first
```

**User rejects preview:**

```text
Capture discarded. No changes written.
```

### Next Command Suggestion

| Context                           | Suggested Next Command                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| After successful capture          | Continue the current flow (`/afx-sprint spec ...`, etc.)                                     |
| After rejected preview            | `/afx-session note "<summary>"` as a lighter alternative                                     |
| Capture surfaced a decision       | `/afx-session log <feature>` to consolidate into a discussion                                |
| Capture implies ADR-worthy choice | `/afx-session promote <P-id>` (future — not yet implemented; use `/afx-adr create` manually) |

---

## Session Log File Structure

**Path**: `docs/specs/{feature}/journal.md`

**IMPORTANT**: Discussions are stored in **chronological order** (oldest first, newest last) for natural reading flow.

```markdown
# Session Log - {Feature Name}

<!-- prefix: XX -->

> Quick captures and discussion history for AI-assisted development sessions.
> See [agenticflowx.md](../../_templates/agenticflowx.md) for workflow.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

- **2025-12-17T14:30:00.000Z** - Remember to handle edge case X
  `[validation, edge-case]`
- **2025-12-17T14:45:00.000Z** - User prefers approach B over A
  `[architecture, decision]`

---

## Discussions

<!-- Chronological order: oldest first, newest last -->

### XX-D001 - First Topic

`status:active` `2025-12-14T09:00:00.000Z` `[database, migration]`

**Context**: Initial database setup discussion
...

---

### XX-D002 - Second Topic

`status:active` `2025-12-15T10:30:00.000Z` `[auth, jwt, multi-tenant, architecture]`

**Context**: What prompted this discussion
**Summary**: Key points in 2-3 sentences
**Decisions**:

- Decision 1
- Decision 2

**Tips/Ideas**:

- Tip 1
- Tip 2

**Notes**:

- **[XX-D002.N1]** **[2025-12-16T10:30:00.000Z]** Later insight after testing `[testing]`

**Related Files**: file1.ts, file2.ts
**Participants**: @rix, Claude

---

### XX-D003 - Latest Topic

`status:active` `2025-12-17T14:00:00.000Z` `[api, refactor]`

...
```

> **Note**: Work Sessions table lives in `tasks.md`, not `journal.md`. It is updated by `/afx-task` and `/afx-dev` commands, NOT by `/afx-session`.
> **Two-stage verification**: Agent marks `[x]` after checks pass, Human marks `[x]` after code review.
> See [agenticflowx.md#work-sessions](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md#work-sessions) for update rules.

---

## Hierarchical Reference IDs

Each discussion and note gets a globally unique ID with a feature prefix for easy verbal/written reference:

| Level      | Format                 | Example      | Purpose                                       |
| ---------- | ---------------------- | ------------ | --------------------------------------------- |
| Feature    | `{PREFIX}`             | `UA`         | Reference all discussions in a feature        |
| Discussion | `{PREFIX}-D{NNN}`      | `UA-D001`    | Reference a specific discussion               |
| Note       | `{PREFIX}-D{NNN}.N{N}` | `UA-D001.N1` | Reference a specific note within a discussion |

**Usage Examples**:

- "Check the WC discussions" → All user-auth discussions
- "See UA-D001 for context" → Specific discussion
- "Edge case documented in UA-D001.N2" → Specific note within discussion

### Feature Prefixes

| Feature               | Prefix | Example    |
| --------------------- | ------ | ---------- |
| `_sessions` (general) | `GEN`  | `GEN-D001` |
| `user-auth`           | `UA`   | `UA-D001`  |
| `users-permissions`   | `UP`   | `UP-D001`  |
| `agenticflow`         | `AFX`  | `AFX-D001` |

### Prefix Convention

- 2-4 uppercase characters
- Derived from feature folder name (first letters or abbreviation)
- Defined in each feature's `journal.md` via `<!-- prefix: XX -->` comment
- New features: derive prefix, check for conflicts, document in header

### Session Log Header with Prefix

```markdown
# Session Log - Warranty Claims

<!-- prefix: WC -->

## Discussions

### UA-D001 - Topic Title
```

**Rules**:

- Prefixes are globally unique across all features
- The `<!-- prefix: XX -->` comment MUST appear after the title line
- IDs auto-increment within each feature (UA-D001, UA-D002, etc.)
- IDs never change once assigned
- When promoting to ADR, the full prefixed ID is preserved in frontmatter
- Markdown anchor format: `#wc-d001---topic-title`

---

## Tag Auto-Generation

Tags are automatically generated to enable filtering and recall across sessions.

### Tag Sources (in priority order)

1. **Note content keywords**: auth, database, api, email, validation, migration, etc.
2. **Conversation topic**: What's being discussed in the current session
3. **Files mentioned/modified**: Infer domain from file paths (e.g., `feature-claim.ts` → `user-auth`)
4. **Existing tags**: Reuse tags already in the session-log for consistency
5. **Explicit `--tags`**: User-provided tags are merged with auto-generated ones

### Common Auto-Tags

| Category     | Tags                                        |
| ------------ | ------------------------------------------- |
| Domain       | auth, booking, listing, user-auth           |
| Technical    | database, api, migration, validation        |
| Architecture | architecture, design, refactor, performance |
| Process      | decision, bug, edge-case, phase-1, phase-2  |
| Integration  | email, notification, webhook, third-party   |

### Tag Aggregation in Log Mode

When logging a discussion:

1. Collect all tags from captures in this session
2. Analyze discussion summary for additional tags
3. Deduplicate and sort alphabetically
4. Display aggregated tags on discussion header

---

## Multi-Window Workflow

This command supports working across multiple agent windows:

```
Window 1: Discussing feature A
  > /afx-session note feature-a "important point"
  > Continue discussing...
  > /afx-session log feature-a

Window 2: Discussing feature B
  > /afx-session note feature-b "different topic"
  > Continue discussing...
  > /afx-session log feature-b

Later (any window):
  > /afx-session recap all
  > See summary across both features
```

---

## Integration with Other Commands

| Command      | Relationship                                     |
| ------------ | ------------------------------------------------ |
| `/afx-task`  | Shows task state; `/afx-session` for discussions |
| `/afx-task`  | Reads session logs for task verification         |
| `/afx-check` | Cross-references journal.md                      |
| `/afx-dev`   | Captures discussions about implementation        |

---

## Examples

### Human note (direct entry)

```
/afx-session note "look into Pulumi for IaC" --tags iac,future
```

→ Saves to `docs/specs/journal.md` with explicit tags
→ No agent context needed - just writes directly

### Human note (feature-specific)

```
/afx-session note infrastructure "evaluate CloudWatch vs Datadog" --tags monitoring,decision
```

→ Saves to `docs/specs/infrastructure/journal.md`

### Quick note (agent context)

```
/afx-session note "interesting approach for multi-tenant auth"
```

→ Saves to `docs/specs/journal.md`
→ Agent infers tags from conversation

### Quick note (feature-specific)

```
/afx-session note user-auth "supplier email should include claim number in subject"
```

→ Saves to `docs/specs/user-auth/journal.md`

### Log session summary

```
/afx-session log                       # Log to _sessions
/afx-session log user-auth             # Log to specific feature
```

### Append to existing discussion

```
/afx-session note --ref UA-D001 "edge case: supplier with no email should fail gracefully"
```

→ Parses `UA` prefix → user-auth feature
→ Auto-assigns Note ID `UA-D001.N1` (or next available)
→ Adds to UA-D001's **Notes** section: `- **[UA-D001.N1]** **[timestamp]** edge case...`
→ Output: `Appended to UA-D001: "edge case: supplier..."`

### Recap after time away

```
/afx-session recap all
```

### Promote discussion to ADR (within feature)

```
/afx-session promote UA-D001
```

→ Parses `UA` prefix → user-auth feature
→ Creates `docs/specs/user-auth/research/0002-topic.md`
→ Links back to `journal.md#UA-D001`

### Promote idea to new feature spec

```
/afx-session promote GEN-D003 --to multi-tenant-auth
```

→ Creates `docs/specs/multi-tenant-auth/` with full spec structure
→ Moves discussion GEN-D003 from `_sessions` to new feature
→ New feature gets its own prefix (e.g., `MTA`)
