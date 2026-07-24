# Journal Format Canon

The AFX `journal.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it to display discussions, statuses, and notes. Deviations cause **silent failures** in tools that render journals (e.g., the VS Code extension fails to display entries). These rules define the canonical format — custom sections are allowed but mandatory ones must not be omitted.

**Template reference:** `assets/journal-template.md`

## Post-Action Checklist (MANDATORY)

After modifying `journal.md`, you MUST (see `assets/journal-template.md` for canonical structure):

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in `journal.md` frontmatter.
2. **Append-Only Entries**: Never edit or remove existing journal entries. Only append new ones.
3. **Format Preservation**: Maintain canonical frontmatter field order. Use double quotes.
4. **Discussion IDs**: New discussions must use the next sequential ID (e.g., if last is XX-D003, use XX-D004).
5. **Template Format Check**: Verify discussion headers use `### {PREFIX}-D{NNN} - Title` format, status uses backtick `` `status:active` `` markers, and all mandatory bold sections (`**Context**:`, `**Summary**:`, `**Decisions**:`) are present. Custom sections allowed but mandatory ones must not be omitted. See **Template Format Rules (CRITICAL)** section.

## Template Format Rules (CRITICAL)

### Document Structure

Mandatory sections in order:

1. YAML frontmatter (between `---` delimiters)
2. `# Journal - {Feature Name}` (h1 title)
3. `<!-- prefix: XX -->` comment (defines discussion ID prefix)
4. `## Captures` section (quick notes during active chat)
5. `## Discussions` section (recorded discussions with IDs)

### Frontmatter

**Canonical field order**: `afx → type → owner → created_at → updated_at → tags`. `type` MUST be `JOURNAL`. Journals are append-only and carry no lifecycle `status`. See `assets/journal-template.md` for full schema.

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
</content>
