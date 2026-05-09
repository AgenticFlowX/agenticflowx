---
name: afx-scaffold
description: Scaffold spec directories, research docs, and ADRs from canonical templates
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,scaffolding,feature,spec,research,adr"
  afx-argument-hint: "spec | research | adr"
---

# /afx-scaffold

Scaffold new spec directories, research documents, and ADRs for AgenticFlowX projects.

This skill does NOT own templates — it reads them from the owning skill's `assets/` directory.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADRs live (default: `docs/adr`)
- `library.research` - Global research library path (default: `docs/research`)

If neither file exists, use defaults.

## Template Sources

Templates are co-located with the skill that owns each artifact type.

**Delegated artifacts** — these are handled by the delegated skill; do NOT read their templates from this skill:

| Artifact     | Delegated to       | Template owned by that skill             |
| ------------ | ------------------ | ---------------------------------------- |
| `spec.md`    | `/afx-spec create` | `afx-spec/assets/spec-template.md`       |
| `design.md`  | `/afx-spec create` | `afx-design/assets/design-template.md`   |
| `tasks.md`   | `/afx-spec create` | `afx-task/assets/tasks-template.md`      |
| `journal.md` | `/afx-spec create` | `afx-session/assets/journal-template.md` |
| ADR          | `/afx-adr create`  | `afx-adr/assets/adr-template.md`         |

**Directly owned** — this skill reads this template itself for the `research` subcommand:

| Artifact | Relative path (from this SKILL.md's folder)   |
| -------- | --------------------------------------------- |
| Research | `../afx-research/assets/research-template.md` |

> **Path resolution:** The base is the folder containing this SKILL.md (e.g., `<skills-root>/afx-scaffold/`). `../afx-research/` means go up one level to `<skills-root>/`, then into `afx-research/`. Do NOT prepend `assets/` to the base.

## Usage

```bash
/afx-scaffold spec <name>         # Create new feature spec directory
/afx-scaffold research <name>     # Create new research document
/afx-scaffold adr <title>         # Delegates to /afx-adr create <title>
```

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create new directories and markdown files in:
  - `docs/specs/` (feature scaffolding)
  - `docs/research/` (research scaffolding)
  - `docs/adr/` (ADR creation — via delegation)

### Forbidden

- Create/modify/delete source code in application directories
- Modify existing spec content (only scaffolds new empty specs)
- Delete any files or directories
- Run build/test/deploy/migration commands
- Modify `.afx.yaml` or `.afx/` configuration

If implementation is requested, respond with:

```text
Out of scope for /afx-scaffold (scaffolding mode). Use /afx-dev code after spec approval.
```

---

### Timestamp Format (MANDATORY)

All timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-scaffold`**: Feature scope decision during scaffolding.

## Post-Action Checklist (MANDATORY)

After scaffolding any new feature or artifact, you MUST:

1. **Canonical Frontmatter**: All generated files use the canonical schema — `afx → type → status → owner → version → created_at → updated_at → tags → [backlinks]`. Double quotes for all string values. `version` quoted as `"1.0"`.
2. **Full Spec Body**: `spec.md` must contain ALL template sections (Problem Statement, User Stories, FR/NFR tables, Acceptance Criteria, Non-Goals, Open Questions, Dependencies). Do NOT generate a stripped-down skeleton.
3. **Node IDs in Design**: `design.md` scaffold must include `[DES-ID]` prefixes on all `##` headings.
4. **Timestamps**: Run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` to get the current timestamp for `created_at` and `updated_at`. Never use midnight timestamps.
5. **Feature Registration**: If `.afx.yaml` has a `features` list, register the new feature.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/spec.md` → `user-auth`). Useful for `/afx-scaffold research` when inside an existing feature directory.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Require explicit `<name>` — scaffolding always needs a target name.
3. **Trailing parameters (`[...context]`):** Treat extra words as constraints for scaffolding output. If delegating to another command (e.g., `/afx-spec create`), pass the `[...context]` string along unchanged.

### Next Command Suggestion (MANDATORY)

After EVERY `/afx-scaffold` action, suggest the most appropriate next command:

| Context          | Suggested Next Command                                |
| ---------------- | ----------------------------------------------------- |
| After `spec`     | `/afx-spec refine <name>` to fill living spec content |
| After `research` | Edit the research doc to begin exploration            |
| After `adr`      | Edit `docs/adr/ADR-NNNN-*.md` to fill content         |

---

## Subcommands

---

## 1. spec

Create a new feature spec directory. **Delegates to `/afx-spec create <name>`.**

### Usage

```bash
/afx-scaffold spec <name>
```

### Process

Delegates entirely to `/afx-spec create <name>`. See `/afx-spec` skill for full process.

---

## 2. research

Create a new research document.

### Usage

```bash
/afx-scaffold research <name>
```

`<name>` is a short descriptive slug (e.g., `caching-strategy`, `auth-provider-comparison`). Gets kebab-cased into the filename.

### Process

1. **Validate name**: Must be kebab-case. Error if not.
2. Resolve research path: `library.research` → `docs/research` (default)
3. **Check existence**: If `<research-path>/res-<name>.md` already exists, stop with error.
4. **Confirm with user**: Show the target path and wait for confirmation.
5. **Read template** from `../afx-research/assets/research-template.md`.
6. **Create file** using the **Write tool** — substitute placeholders:
   - `{Research Title}` → Title-cased name
   - `{YYYY-MM-DDTHH:MM:SS.mmmZ}` → current ISO 8601 timestamp
   - `@owner` → `@handle`
7. Write to `<research-path>/res-<name>.md`

### Output

```
Research doc created: docs/research/res-{name}.md

Next: /afx-research explore {name}
```

---

## 3. adr

Create a global architecture decision record. **Delegates to `/afx-adr create`.**

### Usage

```bash
/afx-scaffold adr <title>
```

### Process

Delegates entirely to `/afx-adr create <title>`. See `/afx-adr` skill for full process.

---

## Error Handling

**Feature already exists:**

```
Error: 'user-auth' already exists at docs/specs/user-auth/
Use a different name or work with the existing spec.
```

**Invalid name format:**

```
Error: Name must be kebab-case (lowercase with hyphens)
Example: /afx-scaffold spec my-new-feature
```

**ADR title missing:**

```
Error: Title required
Usage: /afx-scaffold adr <title>
Example: /afx-scaffold adr "database choice"
```

**Research doc already exists:**

```
Error: 'caching-strategy' already exists at docs/research/res-caching-strategy.md
Use a different name or work with the existing research doc.
```

---

## Related Commands

| Command              | Relationship                                        |
| -------------------- | --------------------------------------------------- |
| `/afx-adr`           | ADR management (create delegates to this)           |
| `/afx-spec refine`   | Fill and improve living spec content after scaffold |
| `/afx-spec validate` | Check scaffold structure after spec creation        |
| `/afx-research`      | Research workflow after research scaffolding        |
| `/afx-session note`  | Capture initial ideas in journal                    |
| `/afx-check links`   | Verify spec cross-references                        |
