---
name: afx-adr
description: ADR management — create, review, list, and supersede Architecture Decision Records
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,adr,architecture,decisions"
  afx-argument-hint: "create | review | accept | list | supersede"
---

# /afx-adr

Architecture Decision Record management for AgenticFlowX projects.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.adr` - Where global ADRs live (default: `docs/adr`)

If neither file exists, use defaults.

## Usage

```bash
/afx-adr create <title>
/afx-adr review <id>
/afx-adr accept <id>
/afx-adr list
/afx-adr supersede <id> <new-id>
```

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/update markdown files only in:
  - `docs/adr/` (global ADRs)
  - `docs/specs/**/research/` (feature-local ADRs)

### Forbidden

- Create/modify/delete source code in application directories
- Delete any files or directories
- Run build/test/deploy/migration commands
- Modify `.afx.yaml` or `.afx/` configuration

If implementation is requested, respond with:

```text
Out of scope for /afx-adr (decision management mode). Use /afx-dev code after the ADR is accepted.
```

---

### Timestamp Format (MANDATORY)

All timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17` or `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-adr`**: ADR accepted that changes architecture, ADR superseded.

## Post-Action Checklist (MANDATORY)

After creating or modifying any ADR file, you MUST:

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in frontmatter.
2. **Canonical Frontmatter**: Use `type: ADR`. Field order: `afx → type → status → owner → version → created_at → updated_at → tags → [superseded_by]`. Double quotes for all string values.
3. **Contextual Tagging**: Append relevant keywords to `tags` array based on the decision domain.
4. **Format Preservation**: Maintain canonical field order. Use double quotes.

### Frontmatter (MANDATORY)

All ADRs created by this skill MUST include AFX frontmatter:

```yaml
---
afx: true
type: ADR
status: Proposed
owner: "@handle"
version: "1.0"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["adr", "<dynamic-domain>"]
---
```

**Status transitions:** `Proposed` → `Accepted` | `Rejected` | `Deprecated` → `Superseded`

**Tag rules:**

- First tag is always `adr`
- Remaining tags are **dynamic** — derived from the decision domain (e.g., `["adr", "database", "persistence"]`)
- Do not use generic placeholders — infer specific tags from context

---

## Context Resolution

When arguments are omitted or ambiguous, resolve in this order:

1. **Conversation context** — recently discussed ADR, feature, or decision topic
2. **Active feature** — infer from git branch (`feat/{feature-name}`) or recent `/afx-spec` commands
3. **Recent journal entries** — scan `journal.md` for discussion threads about architecture decisions
4. **Fallback** — prompt the user: "Which ADR? Available: ADR-0001, ADR-0002, ..."

**Subcommand-specific inference:**

| Subcommand  | What to infer          | From                                    |
| ----------- | ---------------------- | --------------------------------------- |
| `create`    | Title / decision topic | Conversation context, recent discussion |
| `review`    | ADR ID                 | Most recent Proposed ADR, or branch     |
| `accept`    | ADR ID                 | Most recent clean Proposed ADR          |
| `list`      | (no args needed)       | —                                       |
| `supersede` | Old + new ID           | Always require explicit                 |

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/spec.md` → `user-auth`). Useful for scoping ADR creation to a feature context.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** ADRs are often global — proceed without feature scope if none can be inferred.
3. **Trailing parameters (`[...context]`):** Treat extra words as constraints for ADR content (e.g., `/afx-adr create "api versioning" graphql only` → scope the ADR to GraphQL API versioning).

### Next Command Suggestion (MANDATORY)

After EVERY `/afx-adr` action, suggest the most appropriate next command:

| Context                       | Suggested Next Command                          |
| ----------------------------- | ----------------------------------------------- |
| After `create`                | Edit `docs/adr/ADR-NNNN-*.md` to fill content   |
| After `review` (issues found) | Fix issues, then `/afx-adr review <id>` again   |
| After `review` (clean)        | `/afx-adr accept <id>` or share for team review |
| After `accept`                | `/afx-next` to route implementation or doc updates |
| After `list`                  | `/afx-adr review <id>` on any Proposed ADRs     |
| After `supersede`             | `/afx-adr create <title>` for replacement ADR   |

---

## Subcommands

## 1. create

Create a global architecture decision record in `docs/adr/`.

### Usage

```bash
/afx-adr create <title>
```

`<title>` is a short noun phrase (e.g., `"database choice"`, `"api versioning strategy"`). Gets kebab-cased into the filename slug.

### Process

1. Read `paths.adr` from `.afx.yaml` (default: `docs/adr`)
2. Use **Glob** to scan `docs/adr/ADR-*.md` for the highest existing `ADR-NNNN` number
3. Increment → next number, zero-padded to 4 digits
4. Slugify title → kebab-case
5. Read `assets/adr-template.md` for the file structure and frontmatter format
6. **Generate real content** using the Write tool — use the title to write a meaningful first draft:
   - **Context**: Describe the problem space and why this decision is needed now
   - **Decision**: State "To be decided" with the key options identified
   - **Rationale**: Leave as "Pending analysis"
   - **Consequences**: List likely trade-offs for each option being considered
   - **Alternatives Considered**: List 2-3 concrete alternatives relevant to the title
7. Write `docs/adr/ADR-{NNNN}-{slug}.md` with the generated content

**IMPORTANT**: Do NOT copy the template with `{placeholder}` text. Generate real, meaningful content for each section based on the ADR title and available project context.

### Output

```
ADR created: docs/adr/ADR-{NNNN}-{slug}.md

Next: Edit docs/adr/ADR-{NNNN}-{slug}.md to complete the decision
```

---

## 2. review

Validate an ADR's structure and content quality.

### Usage

```bash
/afx-adr review <id>
```

`<id>` is the ADR number (e.g., `1`, `0001`) or filename slug.

### Process

1. Resolve ADR file from `<id>` — match against `docs/adr/ADR-{NNNN}-*.md`
2. Read the ADR file
3. Check structural completeness:
   - Frontmatter has all required fields (`afx`, `type`, `status`, `owner`, `version`, `created_at`, `updated_at`, `tags`)
   - All sections present: Context, Decision, Rationale, Consequences, Alternatives Considered
   - No `{placeholder}` text remaining
4. Check content quality:
   - Context describes a clear problem
   - Decision is stated (not just "TBD")
   - At least one alternative is considered
5. Report findings with pass/fail per check

### Output

```
ADR Review: ADR-{NNNN}-{slug}.md

  Frontmatter:    PASS
  Sections:       PASS
  Placeholders:   PASS
  Content depth:  WARN — Decision is still "To be decided"

Overall: 3/4 checks passed. Address warnings before accepting.
```

---

## 3. accept

Mark a reviewed ADR as accepted.

### Usage

```bash
/afx-adr accept <id>
```

### Preconditions

- ADR exists and has `status: Proposed`
- ADR passes `/afx-adr review <id>` with no blocking structural issues

### Process

1. Resolve ADR file from `<id>`.
2. Re-run the same structural checks as `review`.
3. If blocking issues exist, stop and report them.
4. Update frontmatter:
   - `status: Accepted`
   - `updated_at: <current ISO timestamp>`
5. Append a short acceptance note to the ADR body if the template has an acceptance/history section; otherwise preserve body content.

### Output

```text
ADR accepted: ADR-{NNNN}-{slug}.md

Next: /afx-next # Route implementation or living-doc updates
```

---

## 4. list

> **Display Rule:** Don't dump the full ADR list into chat unless the user explicitly asks. Point them to `docs/adr/` for direct file browsing, or to a UI host such as the AgenticFlowX VS Code extension if installed.

List all ADRs grouped by status.

### Usage

```bash
/afx-adr list
```

### Process

1. Read `paths.adr` from `.afx.yaml` (default: `docs/adr`)
2. Glob `docs/adr/ADR-*.md`
3. Parse frontmatter `status` from each file
4. Group and display by status

### Output

```
Architecture Decision Records

  Accepted (3):
    ADR-0001 database-choice
    ADR-0002 api-versioning
    ADR-0003 auth-strategy

  Proposed (1):
    ADR-0004 caching-layer

  Superseded (1):
    ADR-0001 database-choice → ADR-0005
```

---

## 5. supersede

Mark an ADR as superseded and link to its replacement.

### Usage

```bash
/afx-adr supersede <id> <new-id>
```

### Process

1. Resolve both ADR files from `<id>` and `<new-id>`
2. Update the old ADR:
   - Set `status: Superseded` in frontmatter
   - Add `superseded_by: "ADR-{NNNN}"` to frontmatter
   - Add note at top of body: `> **Superseded** by [ADR-{NNNN}](ADR-{NNNN}-{slug}.md)`
3. Update the new ADR:
   - Add `supersedes: "ADR-{NNNN}"` to frontmatter
   - Reference the old ADR in the Context section
4. Update `updated_at` on both files

### Output

```
ADR-{old} marked as Superseded → ADR-{new}

Updated:
  docs/adr/ADR-{old}-{slug}.md (status: Superseded)
  docs/adr/ADR-{new}-{slug}.md (supersedes: ADR-{old})
```

---

## Error Handling

**ADR not found:**

```
Error: No ADR matching '42' found in docs/adr/
Available: ADR-0001, ADR-0002, ADR-0003
```

**Title missing:**

```
Error: Title required
Usage: /afx-adr create <title>
Example: /afx-adr create "database choice"
```

**Invalid supersede (same ID):**

```
Error: Cannot supersede an ADR with itself
Usage: /afx-adr supersede <old-id> <new-id>
```

---

## Related Commands

| Command             | Relationship                                     |
| ------------------- | ------------------------------------------------ |
| `/afx-research`     | Research workflow that promotes findings to ADRs |
| `/afx-scaffold adr` | Quick ADR creation (delegates to this skill)     |
| `/afx-spec`         | Move ADR decisions into formal specs             |
| `/afx-session note` | Capture discussion context before ADR creation   |
