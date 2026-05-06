# Changelog

<!-- markdownlint-disable MD024 -->

## [2.0.7] - 2026-05-06

### Added

- Workspace **Code** and **Explore** modes selectable from chat settings, the sidebar panel, and a new `afx.setMode` command. Code is the default full-access Pi-backed mode; Explore is a read-only, experimental posture for inspection, tracing, and planning. New `afx.mode.active` setting persists the default.

### Changed

- Consolidated the chat composer's model picker and thinking-level menu into a single footer combobox.

### Fixed

- Mode switching edge cases that left the chat view and sidebar panel in an inconsistent state.
- Experimental mode behaviour where state could drift between the chat webview and the host.

## [2.0.6] - 2026-05-05

### Added

- Active-file context toggle in the chat composer and Settings, with host-owned file injection before prompts reach Pi.
- End-to-end prompt-shaping docs showing how the chat draft, explicit file mentions, and selected file context become the final runtime payload.

### Changed

- Composer toolbar controls now use compact shadcn tooltips and filename-based context labels so the narrow layout stays readable.
- Shared message protocol, VS Code host handling, tests, and spec/design docs were updated to keep the context flow synchronized across the repo.

## [2.0.5] - 2026-05-04

### Fixed

- Chat UX fixes for streaming queues, thinking state, transcript hydration, system commands, notes, and AFX upstream sync.

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
