# AgenticFlowX Changelog

## 1.0.7 — 2026-04-12

### Fixed

- **Smart Switch messaging** — "Switched to Focus: X" confirmation now shows correctly after auto-switch; was regressing to "Switch to..." suggestion due to `autoSwitchFired` being incorrectly reset on non-spec file navigation
- **`autoSwitchFired` provenance** — treated as durable state (only cleared when track actually leaves Focus), not a per-event flag; eliminates the "hint disappears on README browse" bug
- **Webview as single source of truth** — extension now reports raw detection (`isSpecArtifact`) only; all Smart Switch branching logic moved to webview, ending split-authority drift
- **Cold-start file detection** — `webviewDidLaunch` fires `detectAndPostFileContext` after `postStateToWebview` so hint strip and context bar populate correctly on panel open
- **Toggle re-evaluation** — SmartSwitchChip posts `requestFileContext` after mode change; Auto→Manual with `autoSwitchFired` reverts track to General and re-evaluates as suggestion
- **ContextHintStrip UI** — replaced cryptic `↩` icon with "Undo" text link; label ("Switch to / Switched to Focus: X") anchored to same visual position in both suggestion and confirmation states
- **Fixed-height chatbox slots** — 26px reserved for hint strip [A], 20px for context bar [C]; chatbox height no longer shifts when hints appear/disappear
- **FeatureContextBar placement** — correctly positioned inside chatbox border (flex-col-reverse container owns border/bg; DynamicTextArea is transparent within it)
- **State sync on init** — `track`, `smartSwitchMode`, and `groundedFeature` synced from extension workspace state to webview on every `postStateToWebview`, eliminating drift after panel reloads

### Changed

- **Design spec v1.3** — added `autoSwitchFired` Provenance Rules (§3.5.0.1a), cold-start scenarios M1–M6 (§3.6.2a), revised toggle truth table T1–T6 with revert/retroactive behavior, UI anchoring rule for hint strip label position
- **`@see` annotations** — fixed 7 annotations across staged files: Node IDs only (`[DES-*]`), no subsection refs (`§x.y.z`, `UI-x.y.z`)

## 1.0.6 — 2026-04-12

### Added

- **Focus Track Autopilot UX** — three new context surfaces that make spec-driven workflow discoverable without expertise
    - **Context Hint Strip** — transient strip above textarea showing file detection, spec match, and spec capture signals with dismiss/switch actions
    - **Feature Context Bar** — persistent read-only bar inside the chatbox showing grounded feature, artifact, and task progress
    - **Smart Switch chip** — Auto/Manual toggle in bottom strip controlling whether Focus track switches automatically on spec file detection
    - **Feature Picker Card** — welcome screen "Pick up where you left off" showing top 3 recent features by `updated_at`
    - **Spec Awareness Protocol** — General mode agent detects conversation matching existing specs and suggests grounding
    - **Context-aware input hints** — helper text adapts to active artifact (spec/design/tasks/journal/research/adr)
- **Task progress parsing** — `parseTaskProgress()` counts checkboxes in tasks.md, shown in context bar and welcome screen
- **Feature scanner** — `scanRecentFeatures()` scans docs/specs/ for recent features sorted by latest frontmatter date
- **`openFeatureFiles` message handler** — opens spec/design/tasks files from welcome screen feature click
- **`persistTrackState` message handler** — persists Smart switch mode, track, and grounded feature to workspaceState

### Changed

- **Welcome screen** — AfxHero shows hero banner + feature picker together (not either/or), single border card (no card-in-card)
- **Responsive layout** — welcome screen and chatbox adapt to narrow sidebar via `@container` queries (title, tagline, progress, Quick start visibility)
- **`debugLog()` utility** — dev-only lifecycle logging gated behind `ExtensionMode.Development`
- **`.vite-port` path resolution** — fixed for monorepo structure (3 levels up from `apps/vscode/dist/`)
- **`watch:tsc` script** — fixed stale `src/tsconfig.json` path from pre-monorepo era
- **`tasks.json`** — `watch:tsc` uses custom background problem matcher compatible with pnpm output

### Fixed

- **Smart Switch respects Manual mode** — `setMode()` no longer fires when Manual mode + General track (truth table rows 10–15)
- **Hint strip resets on toggle** — switching Auto↔Manual dismisses active hint and resets state (truth table T1–T6)
- **Feature context bar placement** — moved inside chatbox border container, flush under helper text

## 1.0.5 — 2026-04-09

### Changed

- **Monorepo restructure** — split `webview-ui/` into `packages/webapp-core` (public) and `packages/webapp-panel` (private git submodule)
- **Build output renamed** — `src/webview-ui/build/` → `src/webapp-core/build/` to match new package structure
- **webapp-panel as submodule** — extracted to `AgenticFlowX/webapp-panel` private repo, included via git submodule
- **Conditional panel view** — bottom panel hidden when panel assets absent (clean UX for public/open-source builds)
- **Turbo dynamic deps** — bundle task uses `^build` with `optionalDependencies` for graceful degradation when webapp-panel is absent

## 1.0.4

### Welcome & Onboarding

- **Revised tips** — replaced 5 unverified "Power tips" with 3 verified features: Focus Track, AFX Panel, Spec-Driven Development with repo link
- **DRY tips data** — WelcomeViewProvider now imports shared TIPS array from AfxTips

### Fixes

- **Traceability annotations** — converted hash-fragment @see annotations to [DES-*] node IDs
- **Spec paths** — updated @see paths after spec folder prefix rename

## 1.0.3

### Welcome & Onboarding

- **Welcome page redesign** — 3-card onboarding layout: What is AFX (hero, philosophy strip, SDD explainer), Why spec-driven (value props), Quick Start (provider setup, CLI install, examples)
- **Collapsible sections** — SDD four-file explainer, value propositions, and power tips collapse to reduce visual noise
- **ChatView quick start** — new chat empty state shows Hero + Quick Start (CLI install + collapsible examples) + Power Tips
- **Telemetry disclosure** — Welcome page footer shows privacy notice with link to settings
- **Documentation link** — Welcome page footer links to agenticflowx.github.io

### Assets & Packaging

- **Updated extension icons**
- **Removed Discord references**

### Fixes

- **Bedrock credentials type** — fixed AWS SDK type compatibility for credentials config

## 1.0.2

### Telemetry & Privacy

- **Telemetry opt-in checkbox** — About page, toggling anonymous usage reporting
- **Microsoft Clarity integration** — session replay and heatmaps for UX improvement, gated behind telemetry setting
- **Strict masking** — all text content (chat, code, inputs, markdown, terminal output) masked client-side before transmission; Clarity dashboard set to Strict mode
- **CSP hardened** — Clarity domains added to Content-Security-Policy for both main sidebar and bottom panel webviews
- **Privacy disclosure** — PRIVACY.md updated with full session replay disclosure, masking details, and Clarity privacy policy link
- **Marketplace compliance** — `package.json` declares telemetry metadata

## 1.0.0

### The Spec Layer

- **Bottom Panel** — 7-tab dashboard: Pipeline, Workbench, Board, Journal, Documents, Notes, Analytics
- **CodeLens & traceability** — `@see` annotations link code to specs. Hover to preview, click to jump. Orphan and ghost warnings in Problems panel.
- **Focus Track** — select a spec and the extension auto-loads the right skill based on frontmatter metadata
- **Spec injection** — active spec, next task, and prior decisions injected into every agent prompt automatically
- **Agent tools** — `read_spec`, `list_tasks`, `check_traceability`, `update_task`, `log_session`, `log_discussion`
- **@afx Copilot Chat** — `/status`, `/next`, `/spec` commands
- **Multi-agent dispatch** — route tasks to Copilot, Claude Code, Codex, or Gemini from `tasks.md`
- **Hook engine** — event-driven automation: panel refresh on file changes, auto-log sessions

### The Engine

Based on Roo Code v3.51.1 — all core capabilities intact: 28+ AI providers, 22 built-in tools, custom modes, MCP server support, checkpoints, codebase indexing. Stripped of cloud services, account login, and telemetry. BYO API key only.
