# AgenticFlowX

> The spec-driven AI coding environment.

Write the spec. Let agents build it. Every function traces back to a requirement — if it doesn't, it's a defect.

[![Alpha Release](https://img.shields.io/badge/status-alpha%20release-907aa9)](https://agenticflowx.github.io)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](./LICENSE)

[Website](https://agenticflowx.github.io) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) · [GitHub](https://github.com/AgenticFlowX/agenticflowx)

---

## What's inside

![AgenticFlowX in VS Code](https://agenticflowx.github.io/assets/screenshot.webp)

Most AI coding agents start from a prompt. AgenticFlowX starts from a spec.

Specs are first-class in this editor. You write the requirements. The agent builds to them. The extension reads them, injects them, validates against them. Code without a spec link is flagged. Spec requirements without code are flagged too.

28+ providers, MCP support, custom modes, checkpoints, codebase indexing. BYO API key, no vendor lock-in.

Same engine, different discipline:

- **CodeLens & traceability** — `@see` annotations link code to specs. Hover to preview, click to jump. Orphan code and ghost requirements surface in the Problems panel.
- **Spec injection** — the active spec, next task, and prior decisions are injected into every agent prompt automatically. The agent always knows the context.
- **Focus Track** — select a spec and the extension auto-loads the right skill based on its frontmatter metadata.
- **Agent tools** — spec-aware tools the agent can call to read specs, track tasks, check traceability, and log decisions.
- **Right-click dispatch** — send tasks to Copilot, Claude Code, Codex, or Gemini directly from `tasks.md`.
- **Hook engine** — event-driven automation: refresh the panel on file changes, auto-log sessions.
- **Bottom Panel** — a dedicated dashboard that no other coding agent has. 7 tabs: Pipeline to track feature progress across specs, Workbench to edit specs side-by-side, Board for kanban, Journal for session history, Documents to browse all spec artifacts, Notes for quick capture, and Analytics for health metrics.

---

## The Workflow

![AFX Workflow](https://agenticflowx.github.io/assets/workflow-mindmap.webp)

> Pause. Think. Plan. Ship.

The [AFX Workflow](https://github.com/AgenticFlowX/afx) is a portable, agent-agnostic standard for spec-driven development. It works with or without the extension.

Every feature lives in four files:

| File         | Purpose                                                   |
| ------------ | --------------------------------------------------------- |
| `spec.md`    | The WHAT — requirements, constraints, acceptance criteria |
| `design.md`  | The HOW — architecture, data models, API contracts        |
| `tasks.md`   | The WHEN — implementation checklist, ordered, checkable   |
| `journal.md` | Memory — session logs, decisions, discussion captures     |

Works with any AI coding agent: Claude Code, Copilot, Codex, Gemini.

---

## Quick start

**1. Install the extension** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx).

**2. Add the workflow:**

```bash
curl -sL https://raw.githubusercontent.com/AgenticFlowX/afx/main/afx-cli | bash -s -- .
```

---

## Early access

AgenticFlowX is in alpha release. The core workflow is stable and in daily use, but expect rough edges.

- [Report an issue](https://github.com/AgenticFlowX/agenticflowx/issues)
- [Start a discussion](https://github.com/AgenticFlowX/agenticflowx/discussions)

## Contributing

Community contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[Apache 2.0](./LICENSE) — Agent engine forked from [Roo Code](https://github.com/RooVetGit/Roo-Code).
