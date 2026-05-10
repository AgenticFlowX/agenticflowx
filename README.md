# AgenticFlowX

> Your AI coding agent, with the workflow already wired up.

Chat-first by default. Spec-driven when the work calls for it. Same chat, same files, same panels. Apache 2.0 for VS Code.

![AgenticFlowX — chat, editor with @see CodeLens, and workbench panels](https://agenticflowx.github.io/assets/afx-workbench-overview.webp)

[![code-qa](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml/badge.svg)](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](./LICENSE)

[Website](https://agenticflowx.github.io) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) · [GitHub](https://github.com/AgenticFlowX/agenticflowx)

---

## Two lanes, one chatbox

**Code mode** for chat-first AI coding — ask, mention, switch models, ship. **Spec mode** for when the work earns a paper trail — `spec.md → design.md → tasks.md → journal.md`, refined as you go. **Explore mode** for read-only investigation. The Mode picker lives at the chatbox; switch with `⌘⇧M` (`Ctrl+Shift+M` on Windows/Linux).

Most coding stays in chat. The workflow steps in when the work needs traceability between intent, design, tasks, and code. Same discipline as SDD, lower friction to start.

![Mode picker open at the chatbox — Code (default), Explore (experimental), Spec (SDD)](https://agenticflowx.github.io/assets/vscode-tab-chat-mode-picker.webp)

---

## The workflow produces the files. The panels display them

AFX writes plain markdown to your repo. Diff-able, PR-able, grep-able, AI-portable. There's no proprietary directory and no separate database — the files are just there.

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

## Three modes

| Mode        | Stance                                               | One line                                                                                                                   |
| ----------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Code**    | _Default · full access_                              | Chat-first by default. Repo-backed notes, tasks, and docs you can actually see.                                            |
| **Explore** | _Read-only · runtime tools blocked_                  | Use it to inspect code, trace behavior, and plan changes — without accidentally editing files or running commands.         |
| **Spec**    | _Planning-only · docs and specs · guardrails active_ | Plan before you code. We'll refine requirements, validate structure, and gate approval — without touching production code. |

Mode is enforced via a system-prompt prefix on every turn. Explore additionally hard-blocks runtime tool calls; Code and Spec rely on the guardrail prompt and the agent following it. Switch lanes with `⌘⇧M`, or pick from the Mode menu in the chat status bar.

![Spec mode active on `design.md` — the SpecStepper shows progress (spec approved, design in flight, tasks next), with the action row and a Related row pinned to the feature's Journal and Work Sessions](https://agenticflowx.github.io/assets/vscode-tab-chat-mode-spec.webp)

In Spec mode the chat composer carries a SpecStepper (e.g. `1 Spec ✓ — 2 Design ✓ — 3 Tasks`), an action row mapped to skill-driven slash commands, and a Related row linking the feature's Journal and Work Sessions:

| Action   | What it does                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Refine   | Drafts `/afx-spec refine` (or `/afx-design refine`) into the composer for you to steer                |
| Author   | Advances the workflow — `spec.md` Author runs design authoring; `design.md` Author runs task planning |
| Validate | Runs validation against the spec/design and reports gaps                                              |
| Review   | Runs a structured review pass                                                                         |
| Approve  | Marks the document approved and unlocks the next stage                                                |

Sprint mode collapses Validate + Review into a single Verify, for small work that lives in one document and graduates when scope grows.

---

## Inside the Workbench

| Tab           | What it surfaces                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Workbench** | Spec, design, tasks, and sessions side-by-side per feature. Toggle columns, edit inline, drift indicator footer   |
| **Pipeline**  | Every feature — filterable, sortable. Simple KPI tiles, Timeline, or Grid views. Up-next continuations            |
| **Documents** | All workflow files in one filterable tree. Inline markdown render, content search across the repo                 |
| **Analytics** | Tasks done %, sessions, streak, pipeline distribution, contribution-style activity heatmap (7d / 30d / 90d / All) |
| **Journal**   | Dated timeline of discussions, decisions, and summaries. Auto-written by skills via `/afx-session log`            |
| **Board**     | Markdown-backed kanban. Drag cards, reorder columns, edit inline — flip to raw markdown any time                  |
| **Notes**     | Quick capture — type, Enter, done. Filter by Today / Week / Month / All. Stored in `.afx/notes.md`                |

![Workbench tab over the RoomLedger Check-In feature — Spec, Design, Tasks, and Sessions side-by-side, with the editor above showing an `@see` CodeLens hover preview](https://agenticflowx.github.io/assets/workbench.webp)

![Pipeline tab — every feature, filterable, with Simple KPI tiles and an Up Next list](https://agenticflowx.github.io/assets/pipeline.webp)

---

## The editor knows about the workflow too

AFX extends VS Code with spec-awareness built into the editor — not just a panel on the side.

- **`@see` CodeLens** — Hover any `@see` annotation to preview the linked spec inline. Jump to the requirement without leaving your code.
- **Bidirectional traceability** — Every function links to a requirement; every requirement maps to code. Trace audits run as an AFX skill (`/afx-check trace`) over the `@see` annotations the editor surfaces.
- **Code actions** — Right-click any selection to explain, review, improve, generate tests, or add a `@see` link back to spec.
- **Go-to-definition on `@see`** — Cmd-click a path or a bracket id (`[FR-1]`, `[NFR-3]`, `[DES-AUTH]`, `[2.1]`) to jump to the spec section it references.
- **Session continuity** — Every session appends a `journal.md` entry. Pick up where you left off — decisions intact.

![Editor with @see CodeLens preview — hovering an annotation reveals the linked spec section inline](https://agenticflowx.github.io/assets/codelens-spec.webp)

---

## Backed by Pi at the moment — two routes

AFX runs your coding agent through Pi today. Whether or not you have Pi installed, AFX uses Pi to reach the providers below.

|                    | How it works                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Already use Pi** | AFX detects your Pi CLI and routes every call through Pi RPC. Your config, your keys — nothing re-entered.                    |
| **New to Pi**      | The Pi SDK ships inside the extension. Add provider keys in Settings (stored in VS Code SecretStorage). No Pi install needed. |

**Built-in providers:** OpenAI · Anthropic · Google Gemini · Google Vertex · GitHub Copilot · OpenRouter · Amazon Bedrock · Azure OpenAI · Groq · DeepSeek · Mistral · MiniMax · Kimi · Fireworks · Cerebras · Hugging Face · Vercel AI Gateway · xAI · Z.ai

**Plus presets** for Ollama, LM Studio, vLLM, OpenRouter, Vercel AI Gateway, Moonshot/Kimi, Anthropic-compatible proxies, Google AI Studio, and any OpenAI-compatible endpoint.

The runtime is swappable in principle. The [AFX workflow skills](https://github.com/AgenticFlowX/afx) also run standalone — outside the extension — with Claude Code, Codex, Gemini CLI, or Copilot Chat.

---

## Installation

Grab it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx). On first launch, open **Settings → Provider**, add your API keys, and pick a model.

### 60-second quickstart (chat-first)

1. Open the **AgenticFlowX** chat panel.
2. Ask for help like you normally would — right-click a selection → **AgenticFlowX → Send Selection**.
3. Use file mentions (`@path/to/file`) when you want the agent to pull full file context.

### 60-second quickstart (spec-driven, optional)

1. Open the **AgenticFlowX** chat panel.
2. Switch to Spec mode (`⌘⇧M`) and run `/afx-scaffold spec my-first-feature`.
3. Open the generated `spec.md` under `docs/specs/` and tweak requirements.
4. Use the action row — Refine / Author / Validate / Review / Approve — or run `/afx-next` to pick the next task and start implementing.

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

## Same skills. Same files. Same rules

The AFX skills run inside the extension and standalone — outside it — with whatever coding agent you're already paying for. No vendor lock-in, no credit pool, no single-cloud inference. Apache 2.0.

---

## Early access

Public alpha. The core workflow is stable and in daily use; settings, modes, and examples are still moving.

- [Report an issue](https://github.com/AgenticFlowX/agenticflowx/issues)
- [Start a discussion](https://github.com/AgenticFlowX/agenticflowx/discussions)

## Contributing

Community contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[Apache 2.0](./LICENSE)
