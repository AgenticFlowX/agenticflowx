# AgenticFlowX

> The spec-driven AI coding environment.

**Forked from Roo Code v3.51.1** — fully standalone, no cloud, no login, BYO API key.

Chat that remembers why. A workbench that tracks what's shipped. All inside VS Code — so your agents and your specs live in the same room.

[![Alpha Release](https://img.shields.io/badge/status-alpha%20release-907aa9)](https://agenticflowx.github.io)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](./LICENSE)

[Website](https://agenticflowx.github.io) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) · [GitHub](https://github.com/AgenticFlowX/agenticflowx)

---

## Why spec-driven

![AgenticFlowX in VS Code](https://agenticflowx.github.io/assets/screenshot.webp)

Most AI coding agents start from a prompt. AgenticFlowX starts from a spec.

Specs are first-class in this editor. You write the requirements. The agent builds to them. The extension reads them, injects them, validates against them. Code without a spec link is flagged. Spec requirements without code are flagged too.

Every function traces back to a requirement. If it doesn't, it's a defect.

**7 panels · 28+ providers · 23 tools · 0 accounts · Apache 2.0 — always free.**

---

## Two surfaces, one loop

**Side panel — Chat.** An agent that reads your specs, not just your cursor. Dual-track modes: **General** when you're coding; **Focus** for spec, design, tasks, research, or discovery — lean prompts tuned for one job at a time.

**Bottom panel — Workbench.** The bird's-eye view your chat has been missing. Seven tabs across the bottom, each a different lens on the same project: what's in flight, what's specced, what's shipped, what's still thinking.

---

## Inside the Workbench

![AFX Workbench — spec, design, and tasks side by side](https://agenticflowx.github.io/assets/workbench.webp)

| Tab           | What it does                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| **Workbench** | Spec, design, and tasks side-by-side. Toggle which columns are open, edit inline, live progress & freshness |
| **Pipeline**  | Every feature — filterable, sortable. Timeline by stage, Grid of cards, or Kanban by next action            |
| **Documents** | Markdown, PDFs, images — one filterable tree. Inline markdown render, content search across the repo        |
| **Analytics** | Health %, velocity, shipped count, weekly heatmap, attention cards, traceability coverage (7D/30D/90D/All)  |
| **Journal**   | Dated timeline of discussions, decisions, and summaries. Every entry links back to the source markdown      |
| **Board**     | Markdown-backed kanban. Drag cards, reorder columns, edit inline — flip to raw markdown any time            |
| **Notes**     | Quick capture — type, Enter, done. Filter by Today / Week / Month / All. Stored in `.afx/notes.md`          |

---

## What AFX adds on top

- **@see CodeLens** — Hover any `@see` annotation to preview the linked spec inline. Jump to the requirement without leaving your code.
- **Focus Track** — Select a spec, the right skill auto-loads based on its frontmatter. Context strips follow you across files and chats.
- **Spec injection** — The active spec, next task, and prior decisions are injected into every agent prompt. The agent always knows the context.
- **Bidirectional traceability** — Every function links to a requirement; every requirement maps to code. `/afx-check trace` enforces it across the repo.
- **Quality gates** — Structural, path, link, and trace checks via `/afx-check`. Ship with confidence, not vibes.
- **Session continuity** — Every session appends a `journal.md` entry. Pick up where you (or another agent) left off — with the decisions intact.
- **Agent tools** — Spec-aware tools the agent can call to read specs, track tasks, check traceability, and log decisions.
- **Hook engine** — Event-driven automation: refresh the panel on file changes, auto-log sessions, and more.
- **No login. BYO API.** — No account, no cloud, no proxy. 28+ providers — your keys, your data, your call.

---

## The AFX Workflow

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

Specs are plain markdown. Run any agent on any feature — in parallel, same blueprint, zero conflict.

---

## Quick start

### Option A — Start with a blank repo

**1. Install the extension** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx).

**2. Add the AFX toolchain to your repo:**

```bash
curl -sL https://raw.githubusercontent.com/agenticflowx/afx/main/afx-cli | bash -s -- .
```

**3. Scaffold your first spec from the AFX chat:**

```
/afx-scaffold spec my-first-feature
```

Focus mode drafts a spec, a design, and tasks — pinned to your Workbench.

### Option B — Try a working example

**1. Install the extension** (same as above).

**2. Pull the RoomLedger example into a folder** — a real project with spec, design, and tasks already wired up, ready to build:

```bash
curl -sL https://raw.githubusercontent.com/agenticflowx/afx/main/afx-cli | bash -s -- example full .
```

**3. Open the folder in VS Code, launch the AFX chat, and resume:**

```
/afx-next
```

AFX picks up the in-progress ticket and tells you what to do.

> Three flavors ship with AFX: `starter` (spec only), `basic` (one feature ready to build), `full` (four features). List them with `afx-cli example list`.

For the full command list, run `/afx-help` once the skills are installed.

---

## Early access

AgenticFlowX is in alpha release. The core workflow is stable and in daily use, but expect rough edges.

- [Report an issue](https://github.com/AgenticFlowX/agenticflowx/issues)
- [Start a discussion](https://github.com/AgenticFlowX/agenticflowx/discussions)

## Contributing

Community contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[Apache 2.0](./LICENSE) — Agent engine forked from [Roo Code](https://github.com/RooVetGit/Roo-Code).
