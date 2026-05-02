# Changelog

## [2.0.0] - 2026-05-02

### Breaking Changes

- AgenticFlowX v2 is a clean-slate rewrite and is intentionally incompatible with v1 lineage.
- This baseline release resets public history; prior v1 commit ancestry, tags, and migration assumptions do not apply.

### Added

- VS Code workflow layer around pi.dev with Chat and Workbench panels.
- Repo-backed spec-driven workflow artifacts (`spec.md`, `design.md`, `tasks.md`, `journal.md`).
- Workbench tabs for pipeline, documents, analytics, journal, board, and notes.
- Right-click editor actions for sending selections, inserting context, review, improvements, tests, and traceability helpers.
- Provider setup through VS Code settings and SecretStorage, with bundled Pi SDK support when Pi CLI is not installed.
- Markdown-backed workflow surfaces with no separate database or sync layer.

### Changed

- Release notes for this baseline are curated as a single manual entry, not a commit-rollup changelog.
