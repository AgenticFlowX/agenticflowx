# Changelog

<!-- markdownlint-disable MD024 -->

## [2.2.1] - 2026-05-24

### Changed

- **AFX Preview entry points** — the chat header action now labels the target file (`Preview <filename>`) and uses richer tooltips for the AFX Markdown Previewer.
- **Preview telemetry** — standalone AFX Preview sessions are tagged separately in Clarity with `afx_surface=preview`.

## [2.2.0] - 2026-05-24

### Added

- **AFX Preview** — added the editor-area AFX Preview panel and low-noise Preview entry points from chat composer headers.
- **Workbench document preview polish** — improved document rendering controls, reader width handling, tooltips, and preview icon affordances.

### Changed

- **Pi runtime package** — migrated the bundled runtime to `@earendil-works/pi-coding-agent@0.75.4`.
- **Chat settings and panels** — streamlined model setup, skills catalog, runtime recovery copy, and made the Modified files panel compact by default.
- **Dependencies** — refreshed minor and patch dependency updates, including the OSV scanner action.

### Fixed

- **Explore mode guardrails** — allow read-only repo and web inspection more reliably while continuing to block writes and mutating commands.
- **Output panel behaviour** — chat errors are logged without unexpectedly opening the VS Code Output panel.
- **Markdown preview workflow state** — preserved the AFX stepper in markdown preview and tightened related preview routing.
- **Runtime UX** — made slow model warm-up warnings configurable and improved recovery/timeline feedback.

## [2.1.0] - 2026-05-20

### Added

- **Composer intent modes** — added parent-aware Composer Intent prompts across Code and Explore, with shared prompt copy, intent strip UI, preview affordances, host protocol updates, and unit/e2e coverage.
- **Global mode defaults** — settings now let users choose explicit global or workspace scope for mode defaults, preserving workspace overrides while making global mode persistence the default path.
- **Privacy documentation** — added a simplified privacy document for clearer user-facing data-handling guidance.

### Changed

- **Dependency and verification refresh** — upgraded outdated packages and GitHub Actions, refreshed the lockfile, restored Turbo coverage outputs, and made package test scripts emit coverage artifacts instead of leaving verification signals implicit.
- **Screenshot verification** — added Playwright screenshot capture to the full verification path for the primary chat and workbench surfaces.

### Fixed

- **Mode and intent settings fallback** — automatic mode and Composer Intent saves now fall back to workspace settings when VS Code rejects a global user-settings write, keeping the sidebar controls responsive when User settings cannot be edited.
- **Security audit cleanup** — dependency updates and overrides clear the production audit gate while keeping full verification active.
- **Floating turn context layering** — transcript marker icons no longer render above the sticky prompt preview while long chat transcripts scroll.
- **Chat e2e dev server port** — restored the Playwright dev-server port after the temporary port change.

## [2.0.15] - 2026-05-18

### Added

- **Componentized chat window** — split the monolithic chat view into focused controller, timeline, composer, top bar, panel, and empty-state components, with route-contract, performance, and Playwright benchmark coverage.

### Changed

- **Chat UI structure** — refreshed the composer, file attachments panel, document actions panel, timeline, and result-action surfaces as part of the chat restructure.
- **Settings, logs, and support cleanup** — simplified Settings copy and support surfaces, tightened host/sidebar logging behaviour, and removed stale transport mock data.
- **Bundled AFX skills metadata** — refreshed the skills signature pin and clarified telemetry copy for the VS Code extension manifest.

### Fixed

- **Host-owned AFX next actions** — result actions now render action payloads supplied by the VS Code host overlay instead of relying on legacy in-message UI action markers.
- **VS Code e2e run order** — moved VS Code Electron tests to the explicit `test:e2e` path so full verification builds the extension bundle before launching the e2e host.

## [2.0.14] - 2026-05-12

### Changed

- **Documentation polish** — fixed README typo(s).

## [2.0.13] - 2026-05-11

### Fixed

- **Compact chat composer menus** — fixed layout and clipping issues in the compact composer action strip.

## [2.0.12] - 2026-05-11

### Added

- **Three-pill SDD spec stepper** — a navigation row above the composer shows three linked pills (Spec → Design → Tasks) for sprint documents. Clicking a pill opens the sibling document so you can move between spec phases without leaving the chat view.

### Changed

- **Onboarding polish** — refined the first-run experience and welcome flow.
- **README refresh** — updated project documentation.

### Fixed

- **Security** — addressed high-severity vulnerability in dependencies.

## [2.0.11] - 2026-05-10

### Added

- **Slash command auto-complete** — typing `/` in the chat composer now opens a filterable dropdown of available commands. Keystrokes after `/` incrementally narrow the list via case-insensitive substring match; `Tab` moves focus from the textarea into the dropdown for keyboard navigation; an empty state renders when no commands match the current query.

### Fixed

- **Next action chips** refined for clearer affordances.
- **Tooltips** added to long menus that were clipping or lacked hover hints.

### Changed

- **Author and approve commands** surfaced in the composer action strip.
- Internal reference and documentation clean-ups.

## [2.0.10] - 2026-05-09

### Added

- **Spec-mode composer strip enhancements** — workflow-position breadcrumb showing Spec → Design → Tasks → Code progress with status indicators; Sign Off button that surfaces on tasks.md when all body checkboxes and Work Sessions Agent cells are ticked and at least one Human cell remains, with a confirm popover previewing the atomic edit (`Tick N Human cells` + `Promote status to Living` + `Update updated_at`); Session Memory anchor in the strip header with a dropdown of memory-recap and memory-context options; compact action set for Code/Explore modes that trims Review/Approve/Status into the More overflow; WBS-indexed task dropdowns for Code and Pick that filter completed items while keeping "Code all" always available; fallback WBS computation from task row positions when explicit IDs are missing; sprint format routing that threads the feature name through `/afx-sprint code <feature> <wbsId>`.

### Changed

- **Light and dark theme visibility** — checkbox, radio, switch, tabs, and input surfaces now render with guaranteed contrast in both VS Code light and dark themes. Dropdown menu borders are strengthened so popovers don't blend into the background.

### Fixed

- **Style format consistency** — cleaned up formatting throughout the chat UI layer.

## [2.0.9] - 2026-05-09

### Added

- **Custom provider configuration** — add, edit, and remove API providers and models directly from Settings. Ships with presets for OpenAI, Anthropic, Google, Ollama, Mistral, Cohere, Groq, and DeepSeek, plus a "Custom" option for arbitrary OpenAI-compatible endpoints. Each provider carries its own API key (stored in VS Code SecretStorage or read from `PI_API_KEY_*` environment variables), base URL, and model list. The bundled Pi SDK runtime bootstraps custom providers at startup and injects them into the model combobox alongside built-in models. Includes ADR-0008 (Custom Providers Adapter Pattern), full test coverage, and redaction of secrets in logs.

### Fixed

- **Light and dark theme visibility** — checkbox, radio, switch, tabs, and input surfaces now render with guaranteed contrast in both VS Code light and dark themes. Dropdown menu borders are strengthened so popovers don't blend into the background.

## [2.0.8] - 2026-05-08

### Added

- **Spec mode** — third workspace posture for Spec-Driven Development. The agent refines specs, designs, tasks, journals, ADRs, and research notes while leaving source code untouched. Includes a doc-aware composer strip with action buttons that auto-send (e.g. "Save spec", "Open design") and a guided onboarding card with `Create first spec`, `Explore an idea`, `Start lean`, and `Resume workflow` starters.
- **Per-runtime instance cards in Settings** — API Providers (bundled SDK) and Pi RPC each render their own card with status pill, restart, view-logs, and lifecycle controls. Reflects the multi-instance reality of `MultiplexedAgentManager` instead of presenting SDK and RPC as a mutually exclusive choice.
- **Models tab sub-tabs** — `Built-in` (provider tile grid) and `Custom Models` (placeholder for the upcoming Pi SDK / Pi RPC two-track editor; the Pi RPC track ships a working `Open models.json` deep-link with create-if-missing).

### Changed

- **Settings UX consolidated to 5 groups** — Workspace, Runtimes, Models, Look, Support (down from 11 sections). Sticky header strip surfaces per-instance status pills, restart-active, and a file-context chip. Every control gets an inline description plus a shadcn-backed `[?]` tooltip so settings is self-documenting until external docs ship.
- **Composer always renders the active style** — the chat composer keeps its ring/border on idle, empty, and unfocused states. Disabled state gets a clearly muted treatment so users can tell the box is dormant rather than just bored.
- **Onboarding refresh** — Code, Explore, and Spec modes each show their own welcome card and starter prompts; the legacy "Ready when you are" copy was retired.
- **Light/dark theme visibility** — Switch thumbs and tracks now read against both VS Code light and dark themes; dropdown borders strengthened so popovers don't blend into the surface.

### Fixed

- **Amazon Bedrock crashed the runtime on first request** — pi-ai's Bedrock provider is intentionally lazy-loaded, but the resolver `import("./amazon-bedrock.js")` had no file to find inside the extension bundle. Bedrock is now pre-bundled as a sibling file (3.3 MB) and only loaded into memory when a user picks a Bedrock model.
- Settings "Open models.json" opened the VS Code Settings UI instead of the file. It now opens (and creates with the canonical empty shape if missing) `~/.pi/agent/models.json`, honouring `PI_CODING_AGENT_DIR`.
- "Report an issue" links pointed at the wrong repo; corrected to `github.com/AgenticFlowX/agenticflowx/issues`.
- Removed the non-functional "+ New session" button from the Pi RPC card. `/new` in the Support tab continues to work.
- `knip` cleanup — removed unused exports flagged by the unused-symbol auditor.

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
