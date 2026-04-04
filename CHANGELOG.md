# AgenticFlowX Changelog

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
