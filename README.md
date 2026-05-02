# AgenticFlowX

> A VS Code workflow layer around [pi.dev](https://pi.dev).

Chat-first by default. Repo-backed notes, tasks, and docs you can actually see.

And the **<u>spec-driven</u>** workflow — sure, the whole buzzword. Spec → design → tasks, refined as you go. The usual ceremony, just faster. Opt-in only.

![AgenticFlowX — chat, editor with @see CodeLens, and workbench panels](https://agenticflowx.github.io/assets/afx-workbench-overview.webp)

[![code-qa](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml/badge.svg)](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](./LICENSE)

[Website](https://agenticflowx.github.io) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) · [GitHub](https://github.com/AgenticFlowX/agenticflowx)

---

## pi.dev runs the coding — AgenticFlowX owns the workflow

[pi.dev](https://pi.dev) handles the coding agent. AgenticFlowX adds the structure around it: a workflow that produces real files, panels that surface those files, and an editor that understands them.

**Side panel — Chat.** Day-to-day coding stays in chat. Streaming, tool calls, file mentions, model switching. Steer or follow up while a turn is running.

**Bottom panel — Workbench.** Seven tabs built around what the AFX workflow produces. Not a project management layer bolted on — a view directly over the markdown files the workflow writes.

---

## The workflow produces the files — the panels display them

The [AFX skills](https://github.com/AgenticFlowX/afx) run in chat and produce plain markdown in your repo:

In practice:

- Feature work lands under `docs/specs/<feature>/` (including `journal.md` for the feature).
- Quick notes and kanban live under `.afx/` (e.g. `.afx/notes.md`).

| Where it lands                    | What it is                                                |
| --------------------------------- | --------------------------------------------------------- |
| `docs/specs/<feature>/spec.md`    | The WHAT — requirements, constraints, acceptance criteria |
| `docs/specs/<feature>/design.md`  | The HOW — architecture, data models, API contracts        |
| `docs/specs/<feature>/tasks.md`   | The WHEN — implementation checklist, ordered, checkable   |
| `docs/specs/<feature>/journal.md` | Memory — session logs, decisions, discussion captures     |
| `docs/research/**/*.md`           | Exploration and comparison docs                           |
| `docs/adr/ADR-*.md`               | Architecture decisions, linked to specs                   |
| `.afx/notes.md`                   | Quick notes for the Notes tab                             |
| `.afx/kanban/*.md`                | Markdown-backed kanban for the Board tab                  |

The Workbench panels are built to navigate exactly these files — no separate database, no sync, no export. The files are already there.

---

## Inside the Workbench

| Tab           | What it surfaces                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| **Workbench** | Spec, design, and tasks side-by-side. Toggle columns, edit inline, live progress & freshness               |
| **Pipeline**  | Every feature — filterable, sortable. Timeline by stage, Grid of cards, or Kanban by next action           |
| **Documents** | All workflow files in one filterable tree. Inline markdown render, content search across the repo          |
| **Analytics** | Health %, velocity, shipped count, weekly heatmap, attention cards, traceability coverage (7D/30D/90D/All) |
| **Journal**   | Dated timeline of discussions, decisions, and summaries. Every entry links back to the source markdown     |
| **Board**     | Markdown-backed kanban. Drag cards, reorder columns, edit inline — flip to raw markdown any time           |
| **Notes**     | Quick capture — type, Enter, done. Filter by Today / Week / Month / All. Stored in `.afx/notes.md`         |

---

## The editor knows about the workflow too

AFX extends VS Code with spec-awareness built into the editor — not just a panel on the side.

- **@see CodeLens** — Hover any `@see` annotation to preview the linked spec inline. Jump to the requirement without leaving your code.
- **Bidirectional traceability** — Every function links to a requirement; every requirement maps to code. `/afx-check trace` enforces it across the repo.
- **Code actions** — Right-click any selection to explain, review, improve, generate tests, or add a `@see` link back to spec.
- **Go-to-definition on `@see`** — Jump straight from a code annotation to the spec section it references.
- **Session continuity** — Every session appends a `journal.md` entry. Pick up where you left off — decisions intact.

---

## Two routes to pi.dev

Whether or not you have pi.dev installed, AFX uses Pi to reach providers.

|                    | How it works                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Already use Pi** | AFX detects your Pi CLI and routes every call through Pi RPC. Your config, your keys — nothing re-entered.                    |
| **New to Pi**      | The Pi SDK ships inside the extension. Add provider keys in Settings (stored in VS Code SecretStorage). No Pi install needed. |

**Providers:** OpenAI · Anthropic · Google Gemini · Google Vertex · GitHub Copilot · OpenRouter · Amazon Bedrock · Azure OpenAI · Groq · DeepSeek · Mistral · MiniMax · Kimi · Fireworks · Cerebras · Hugging Face · Vercel AI Gateway · xAI · Z.ai · Ollama

The [AFX workflow skills](https://github.com/AgenticFlowX/afx) also run standalone — outside the extension — with Claude Code, Codex, or Copilot Chat.

---

## Installation

Grab it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx). On first launch, open **Settings → Provider**, add your API keys, and pick a model.

### 60-second quickstart (chat-first)

1. Open the **AgenticFlowX** chat panel.
2. Ask for help like you normally would — right-click a selection → **AgenticFlowX → Send Selection**.
3. Use file mentions (`@path/to/file`) when you want the agent to pull full file context.

### 60-second quickstart (spec-driven, optional)

1. Open the **AgenticFlowX** chat panel.
2. Run `/afx-scaffold spec my-first-feature`.
3. Open the generated `spec.md` under `docs/specs/` and tweak requirements.
4. Ask `/afx-next` to pick the next task and start implementing.

---

## Scaffolding

### Start fresh

Open the AFX chat and run:

```text
/afx-scaffold spec my-first-feature
```

AFX drafts a spec, a design, and tasks — pinned to your Workbench.

### Try a working example — pull RoomLedger into a folder

A real project with spec, design, and tasks already wired up — ready to build:

> Security note: the command below downloads a script from GitHub and executes it. Review it first if you prefer.

```bash
curl -sL https://raw.githubusercontent.com/agenticflowx/afx/main/afx-cli | bash -s -- example full .
```

Review-then-run alternative:

```bash
curl -sL https://raw.githubusercontent.com/agenticflowx/afx/main/afx-cli -o ./agenticflowx-cli
cat ./agenticflowx-cli
bash ./agenticflowx-cli example full .
```

Open the folder in VS Code, launch the AFX chat, and ask `/afx-next` — AFX picks up the in-progress ticket.

> Three flavors: `starter` (spec only), `basic` (one feature ready to build), `full` (four features).

For the full command list, run `/afx-help` in the AFX chat.

---

## Early access

Public alpha. The core workflow is stable and in daily use, but provider settings, modes, and examples are still moving.

- [Report an issue](https://github.com/AgenticFlowX/agenticflowx/issues)
- [Start a discussion](https://github.com/AgenticFlowX/agenticflowx/discussions)

## Contributing

Community contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[Apache 2.0](./LICENSE)
