---
name: afx-session
description: Session discussion capture — smart notes, session logging, context recaps, and ADR promotion
license: MIT
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,session,notes,discussion,journal"
  afx-argument-hint: "note | log | recap | promote | capture"
---

# /afx-session

Session discussion capture and recall for multi-agent workflows.

## Trigger & Purpose

Capture important discussions with AI agents across multiple windows and topics. Unlike `/afx-next` (task state) or `research/` (permanent decisions), this captures the **in-between** — ideas, tips, and context that matter but aren't yet formal decisions.

```bash
/afx-session note "content" [tags] [--ref id]   # Smart Note (unifies note/capture/append)
/afx-session log [feature]                       # Save session to log
/afx-session recap [feature|all]                 # AI synthesis of context for resumption
/afx-session promote <id>                        # Promote to ADR
/afx-session capture [feature] [--trigger <kind>] [--links <anchors>] [--agent <name>] [--model <id>] [...context]  # Verbatim prompt + agent-reply excerpt at a pivotal moment
```

> **Display Rule:** Don't dump full discussion lists, search results, or status filters into chat unless the user explicitly asks. The user can browse `journal.md` directly, or use a UI host such as the AgenticFlowX VS Code extension (Journal Tab) if installed. These subcommands focus on operations that require agent reasoning or file mutation, not raw display.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides). If neither file exists, use defaults.

- `paths.specs` — Where spec files live (default: `docs/specs`)
- `paths.adr` — Where global ADRs live (default: `docs/adr`)
- `library.research` — Global research library path (default: `docs/research`)
- `prefixes` — Feature prefix mappings for discussion IDs

## Ownership & Mutation Boundary (STRICT)

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
Out of scope for /afx-session (session capture mode). Use /afx-task code to implement.
```

## Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/journal.md` → `user-auth`). If code is selected, use it as additional context for note capture.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Target the global journal (`docs/specs/journal.md`) if no feature can be inferred.
3. **Trailing parameters (`[...context]`):** Treat extra words as focus constraints for capture/summarization (e.g., `/afx-session log auth error handling` → focus the session log on auth error handling discussion).

## Non-Negotiable Invariants

- **Append-only.** `journal.md` is append-only history. Never edit or remove existing entries — only append new ones.
- **Sequential IDs.** New discussions use the next sequential `{PREFIX}-D{NNN}` ID; IDs never change once assigned.
- **Strict format.** The canonical journal format is parser-critical — deviations cause silent failures in tools that render journals. Full canon (structure, headers, inline metadata, mandatory sections, IDs, tags, Post-Action Checklist) lives in `references/formats.md`. Template: `assets/journal-template.md`.
- **Timestamps.** All timestamps use ISO 8601 millisecond precision per `../afx-help/references/timestamp-rule.md`. Get the current one via `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` — never guess or use midnight.
- **Living-doc boundary.** When a discussion changes current truth, route the follow-up to `/afx-spec refine`, `/afx-design refine`, or `/afx-task refine` — do not put chronological backstory, discarded options, or raw captures into `spec.md` / `design.md`.
- **Default location.** When no feature is specified, discussions go to `docs/specs/journal.md` (early-stage ideation, cross-cutting discussions, ideas that don't yet belong to a feature).
- **Proactive capture.** Follow the shared rule in `../afx-help/references/proactive-capture.md` (read-only skills never capture); the `/afx-session`-specific auto-capture mechanics live in `references/proactive-capture.md`.
- **Targeted reads.** Follow `../afx-help/references/query-helper.md` for recent journal entries and artifact maps; the helper is optional and has a targeted-search fallback.

## Subcommands

Determine the action from the first argument, then load the matching reference.

| Subcommand | Purpose                                             | Reference                                                          |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `note`     | Smart capture (handles notes, tags, and appending)  | Read `references/note.md` when running `note`                     |
| `log`      | Summarize conversation into permanent record        | Read `references/log.md` when running `log`                       |
| `recap`    | Generate comprehensive recap for session resumption | Read `references/recap.md` when running `recap`                   |
| `promote`  | Promote discussion to ADR or new feature spec       | Read `references/promote.md` when running `promote`               |
| `capture`  | Verbatim prompt + agent-reply excerpt at a pivot    | Read `references/capture.md` when running `capture`               |

**Stores discussions in**: `docs/specs/journal.md` (global) or `docs/specs/{feature}/journal.md` (feature-specific).

### When to use

- **note**: Capture thoughts during discussion or write directly — "Forgot to handle null case" or "look into Pulumi for IaC"
- **log**: Summarize a conversation into a permanent record
- **recap**: "What did we discuss last time?"
- **promote**: "This discussion is now an ADR or a new Feature"

### Supporting references (load as needed)

- `references/formats.md` — canonical `journal.md` format, hierarchical IDs, prefixes, tag auto-generation, Post-Action Checklist.
- `references/proactive-capture.md` — silent auto-capture mechanics, prompt-capture triggers, and the Significance Check gate.
- `references/next-actions.md` — full Next Command Suggestion table and Interactive Lifecycle Actions.
- `references/examples.md` — multi-window workflow and integration with other commands.

## Result & Next-Action Contract

**MANDATORY**: After EVERY `/afx-session` action, suggest the most appropriate next command based on context (top 3 context-driven, bottom 2 static). When a lifecycle gate is actionable (e.g., ADR-worthy note, unlogged captures piling up), offer the structured choice. Both the context→command mapping and the lifecycle-gate table are in `references/next-actions.md`.

Example tail:

```
Next (ranked):

1. /afx-next # Context-driven: Choose the safest next workflow step
2. /afx-session log {feature} # Context-driven: Summarize before moving on
3. /afx-session promote UA-D001 # Context-driven: Elevate to ADR if significant
   ──
4. /afx-next # Re-orient after capture
5. /afx-help # See all options
```
</content>
