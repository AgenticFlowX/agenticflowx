---
afx: true
type: JOURNAL
status: Living
owner: "@owner"
created_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
updated_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
tags: ["{feature}", "journal"]
---

# Journal - {Feature Name}

<!-- prefix: XX -->

> Quick captures and discussion history for AI-assisted development sessions.
> See [agenticflowx.md](../agenticflowx.md) for workflow.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

---

## Discussions

<!-- Recorded discussions with IDs: XX-D001, XX-D002, etc. -->
<!-- Chronological order: oldest first, newest last -->

### XX-D001 - Topic Title

`status:active` `YYYY-MM-DDTHH:MM:SS.mmmZ` `[tag1, tag2]`

**Context**: What prompted this discussion

**Summary**: Key points in 2-3 sentences

**Progress**:

- [x] Completed item _(N1)_
- [ ] Pending item 2

**Decisions**:

- Decision 1
- Decision 2

**Tips/Ideas**:

- Tip 1
- Tip 2

**Notes**:

- **[XX-D001.N1]** **[YYYY-MM-DDTHH:MM:SS.mmmZ]** Note content `[tags]`

**Related Files**: file1.ts, file2.ts
**Participants**: @{owner}

---

## Prompt Captures

<!-- Verbatim user prompts + agent reply excerpts at pivotal moments. Append-only. -->
<!-- IDs: {PREFIX}-P001, {PREFIX}-P002, ... (P for "prompt", distinct from D for "discussion") -->
<!-- Trigger kinds: new-fr | new-nfr | removed-fr | design-pivot | missed-req | scope-cut | ambiguity-resolved | question-resolved | other -->

<!-- Example entry (remove when populating):

### XX-P001 — {One-line summary of what the prompt surfaced}

- `type:prompt-capture` `{YYYY-MM-DDTHH:MM:SS.mmmZ}` `[tag1, tag2]`
- trigger: {kind}
- triggered-change: {FR-X, DES-X, ...}
- agent: {claude-code | codex | copilot | gemini-code-assist | other | unknown}
- model: {claude-opus-4-7 | claude-sonnet-4-6 | gpt-5-codex | gemini-2.5-pro | ... | unknown}

**User prompt** (verbatim):

> {Exact user text, preserving line breaks}

**Agent reply** (excerpt):

> {1–5 sentence excerpt covering the decision; use [...] for omissions}

**Outcome**: {Concrete file/anchor changes produced by this exchange}

-->

---

## Template Notes

### Discussion Entry Structure

Each discussion has:

| Field             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `status:active`   | Inline status tag (active/blocked/closed)           |
| `[tags]`          | Auto-generated from content keywords                |
| **Context**       | What prompted the discussion                        |
| **Summary**       | 2-3 sentence overview                               |
| **Progress**      | Checkbox items for tracking (auto-synced on append) |
| **Decisions**     | Key decisions made                                  |
| **Tips/Ideas**    | Insights captured during discussion                 |
| **Notes**         | Later additions via `/afx-session note --ref ID`    |
| **Related Files** | Cumulative list of files mentioned across all notes |
| **Participants**  | Who was involved                                    |

### Prompt Capture Entry Structure

Prompt captures preserve **verbatim** user prompts + focused agent-reply excerpts at pivotal moments — complementing summary-style Discussions. Appended by `/afx-session capture`.

| Field                 | Purpose                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type:prompt-capture` | Inline marker distinguishing from discussion entries                                                                                                     |
| ISO 8601 timestamp    | When the exchange happened                                                                                                                               |
| `[tags]`              | Auto-generated from content keywords                                                                                                                     |
| `trigger`             | Kind: `new-fr`, `new-nfr`, `removed-fr`, `design-pivot`, `missed-req`, `scope-cut`, `ambiguity-resolved`, `question-resolved`, `other`                   |
| `triggered-change`    | Anchors affected (FR-X, DES-X, task X.Y) — lets future agents trace why an anchor exists                                                                 |
| `agent`               | Agent identity: `claude-code`, `codex`, `copilot`, `gemini-code-assist`, `other`, or `unknown`. Follows the git co-author convention.                    |
| `model`               | Model identifier: e.g., `claude-opus-4-7`, `claude-sonnet-4-6`, `gpt-5-codex`, `gemini-2.5-pro`, or `unknown`. Lets reviewers filter by capability tier. |
| **User prompt**       | Exact text from the conversation, quoted as a markdown blockquote                                                                                        |
| **Agent reply**       | Focused excerpt (1–5 sentences) covering the decision; `[...]` for omissions                                                                             |
| **Outcome**           | Bullet list of concrete file/anchor changes the prompt produced                                                                                          |

IDs use `{PREFIX}-P{NNN}` to distinguish from discussion IDs (`{PREFIX}-D{NNN}`). Append-only, chronological, never rewrite.

### Related Files Tracking

The `**Related Files**:` field is **cumulative** - it grows as notes are appended:

1. When recording a discussion, include files mentioned in context
2. When appending notes, add any new files mentioned to the list
3. Keep files comma-separated for easy scanning
4. Include both source files and config files as relevant

**Example accumulation**:

```markdown
# Initial record

**Related Files**: .env, packages/configs/src/backend.ts

# After N1 mentions amplify config

**Related Files**: .env, packages/configs/src/backend.ts, infrastructure/amplify/amplify.yml

# After N2 mentions dashboard config

**Related Files**: .env, packages/configs/src/backend.ts, infrastructure/amplify/amplify.yml, infrastructure/amplify/amplify-dashboard.yml
```

### Prefix Convention

Each feature journal uses a 2-4 character prefix for discussion IDs:

| Feature           | Prefix | Example    |
| ----------------- | ------ | ---------- |
| (global)          | `GEN`  | `GEN-D001` |
| user-auth         | `UA`   | `UA-D001`  |
| infrastructure    | `INF`  | `INF-D001` |
| users-permissions | `UP`   | `UP-D001`  |

Define prefix in `<!-- prefix: XX -->` comment after title.
