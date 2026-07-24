# Execution Contract (STRICT)

## Allowed

- Read/list/search files anywhere in workspace
- Create/update `tasks.md` only in `docs/specs/**/`
- Create/modify source code and test files in application directories (via `code` subcommand)
- Run build, test, and lint commands (via `code` subcommand)
- Run shell commands for GitHub sync (`gh` CLI, via `sync` subcommand)
- Append to `docs/specs/**/journal.md` (captures only, via Proactive Capture Protocol)

## Forbidden

- Create/modify/delete `spec.md` (owned by `/afx-spec`)
- Create/modify/delete `design.md` (owned by `/afx-design`)
- Delete any spec files or directories
- Delete source code files (refactoring may remove code within files, but deleting entire files requires user confirmation)
- Run deploy/migration commands without explicit user confirmation
- Modify `.afx.yaml` or `.afx/` configuration
- **Destructive File Rewrites**: Never replace the entire contents of an existing `tasks.md`, `journal.md`, or source code file using a full-file rewrite. Always use targeted line-level replacements or append actions to preserve manually written human content.

If out-of-scope work is requested, return:

```text
Out of scope for /afx-task (implementation-lifecycle mode). Use /afx-spec for spec changes, /afx-design for design changes.
```

## Architectural Core "Hard Anchor" Rule

The following are **Hard Anchors** and MUST NOT be modified during `/afx-task code` without a prior approved Design update:

- Authentication flow & Security protocols
- Database schema & Data migration patterns
- Global state management architecture
- External API integration contracts

If a task requires modifying a Hard Anchor, STOP and escalate: `/afx-design review {name}`.
