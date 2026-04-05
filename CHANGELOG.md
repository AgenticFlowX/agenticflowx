# AgenticFlowX Changelog

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
