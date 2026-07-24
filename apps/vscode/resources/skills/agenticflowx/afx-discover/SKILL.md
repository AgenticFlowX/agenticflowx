---
name: afx-discover
description: Project discovery — find infrastructure scripts, automation tools, deployment workflows, and development capabilities in your codebase
license: MIT
allowed-tools: Read Grep Glob Bash
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,discovery,infrastructure,tools,capabilities"
  afx-argument-hint: "infra | scripts | tools | capabilities"
---

# /afx-discover

Discover what exists in your project: infrastructure scripts, automation tools, deployment workflows, and development capabilities.

This router dispatches to a subcommand. Read the matching `references/<subcommand>.md` for that subcommand's search strategy, keywords, and output templates before producing results.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADR files live (default: `docs/adr`)

If neither file exists, use defaults.

## Usage

```bash
/afx-discover infra [type] [--all]        # Find infrastructure provisioning scripts
/afx-discover scripts [keyword] [--all]   # Find automation/deployment scripts
/afx-discover tools                       # List dev/deployment tools
/afx-discover capabilities                # High-level project automation overview
```

## Ownership & Mutation Boundary (STRICT)

`/afx-discover` is a **read-only discovery skill**. It never creates, modifies, or deletes files, and never writes `journal.md`.

### Allowed

- Read/list/search files anywhere in workspace
- Discover infrastructure scripts, automation tools, deployment workflows

### Forbidden

- Create/modify/delete any files
- Run build/test/deploy/migration commands

If implementation is requested, respond with:

```text
Out of scope for /afx-discover (read-only discovery mode). Use /afx-task code to implement or /afx-scaffold to scaffold.
```

## Non-Negotiable Invariants

- **Read-only.** No file writes, no build/test/deploy/migration commands.
- **Timestamp format.** Any timestamp written in an execution report MUST follow `../afx-help/references/timestamp-rule.md` (ISO 8601 millisecond precision; run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"`).
- **Surface, do not capture.** When a discovery is high-impact (significant architectural pattern or missing infrastructure), surface it in the output and recommend `/afx-session note` — never write the journal directly. See `../afx-help/references/proactive-capture.md`.

## Context Resolution (CLI & IDE)

Resolve scan scope in this order:

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer scan scope from the active file path (e.g., `scripts/deploy.sh` → focus discovery on deployment tooling).
   - **CLI:** Infer from explicit arguments first, then cwd, then conversation history.
   - **Fallback:** Discover across the entire project if no scope is specified.
3. **Trailing parameters (`[...context]`):** Treat extra words as discovery constraints (e.g., `/afx-discover scripts deploy kubernetes` → filter scripts related to Kubernetes deployment).

## Subcommand Routing

Dispatch on the first argument. Load the referenced file for that subcommand's full search strategy, keyword tables, and output templates; the shared scan paths / deep-scan patterns / exclusions live in `references/discovery-scope.md`.

| Subcommand     | Purpose                                              | Reference — load when running this subcommand      |
| -------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `infra`        | Find infrastructure provisioning/management scripts  | `references/infra.md`                              |
| `scripts`      | Find automation, deployment, and utility scripts     | `references/scripts.md`                            |
| `tools`        | List dev/deployment tools configured in the project  | `references/tools.md`                              |
| `capabilities` | High-level project automation & tooling overview     | `references/capabilities.md`                       |
| _(any)_        | Shared scan paths, deep-scan patterns, exclusions    | `references/discovery-scope.md` — load with `infra`/`scripts` deep scans |

### Invalid Subcommand

```
Error: Unknown subcommand "{subcommand}"
Usage: /afx-discover [infra|scripts|tools|capabilities]

Examples:
  /afx-discover infra database
  /afx-discover scripts deploy
  /afx-discover tools
  /afx-discover capabilities
```

### No Type Specified (when helpful)

```
Tip: Narrow your search with a type keyword

Examples:
  /afx-discover infra database      # Find database scripts
  /afx-discover scripts deploy      # Find deployment scripts

Or run without type to see all:
  /afx-discover infra               # All infrastructure scripts
  /afx-discover scripts             # All automation scripts
```

## Result & Next-Action Contract

Since this is a read-only discovery skill, no files are modified. After executing any discovery action, you MUST:

1. Clearly state what infrastructure or scripts were discovered.
2. Formulate proper Markdown output based on the discovery type (see the subcommand reference for the exact template).

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-discover` action, suggest the most appropriate next command based on context:

| Context                          | Suggested Next Command                              |
| -------------------------------- | --------------------------------------------------- |
| After `infra` (scripts found)    | Use the discovered script or `/afx-next`            |
| After `infra` (nothing found)    | `/afx-scaffold spec` or `/afx-sprint new`           |
| After `scripts` (found relevant) | Run the script or document in AFX                   |
| After `tools` (inventory shown)  | `/afx-next` or `/afx-task pick`                     |
| After `capabilities` (overview)  | `/afx-discover <specific>` for deeper investigation |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. Run discovered script: {command} # Context-driven: If script found
2. /afx-scaffold spec {name} # Context-driven: If nothing found
3. /afx-session note "Missing: {capability}" # Context-driven: Document gap
   ──
4. /afx-next # Re-orient after discovery
5. /afx-help # See all options
```

## Related Commands

| Command         | Relationship                                      |
| --------------- | ------------------------------------------------- |
| `/afx-scaffold` | Scaffold new spec directories and ADRs            |
| `/afx-session`  | Document infrastructure gaps                      |
| `/afx-dev`      | Implement discovered tooling improvements         |
| `/afx-task`     | Continue with tasks after infrastructure is ready |
