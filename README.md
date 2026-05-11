# AgenticFlowX

> Low-barrier spec-driven AI coding for VS Code. Chat first, switch to Spec mode when the work needs traceability.

AgenticFlowX is a VS Code workflow layer for AI coding. Backed by [pi.dev](https://pi.dev) today, it gives you a normal coding chat plus an optional spec-driven path for requirements, designs, tasks, journals, and reviewable project memory.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/sdd-demo.gif" alt="AgenticFlowX SDD walkthrough in VS Code" width="100%">
</p>

[![code-qa](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml/badge.svg)](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](./LICENSE)

[Website](https://agenticflowx.github.io) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) · [GitHub](https://github.com/AgenticFlowX/agenticflowx)

---

## Chat first

Start with normal coding chat: ask, mention files, switch models, and follow up while the work is still fresh. Most work can stay here.

Use file mentions when the agent needs exact context, quick commands when you want structure, and the model picker when you want to change lanes without leaving VS Code.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/chat-first.webp" alt="AgenticFlowX chat panel with quick commands and model picker" width="560">
</p>

## Switch lanes when the work needs structure

Code mode is the default for day-to-day implementation. Explore mode is read-only inspection for tracing behavior and planning changes. Spec mode is planning-first: useful when the work needs requirements, design notes, tasks, and an approval trail.

Switch modes from the chatbox with `Cmd+Shift+M` on macOS or `Ctrl+Shift+M` on Windows/Linux.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/mode-picker.webp" alt="Mode picker open at the chatbox showing Code, Explore, and Spec modes" width="560">
</p>

## Spec mode makes the next step obvious

Spec-driven development should not feel like joining a methodology cult. In AFX, it starts as a mode in the chatbox: refine the spec, shape the design, break work into tasks, and approve each step when it matters.

The action row maps to the workflow: Refine, Author, Validate, Review, Approve, and continue from where you left off.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/spec-mode-actions.webp" alt="Spec mode active on spec.md with Refine, Validate, and workflow stepper actions" width="560">
</p>

## The workflow stays in your repo

AFX writes plain markdown to your workspace. Diff-able, PR-able, grep-able, and easy to move between humans and agents.

| Where it lands                    | What it is                                               |
| --------------------------------- | -------------------------------------------------------- |
| `docs/specs/<feature>/spec.md`    | The WHAT: requirements, constraints, acceptance criteria |
| `docs/specs/<feature>/design.md`  | The HOW: architecture, data models, API contracts        |
| `docs/specs/<feature>/tasks.md`   | The WHEN: implementation checklist, ordered, checkable   |
| `docs/specs/<feature>/journal.md` | Memory: session logs, decisions, discussion captures     |
| `.afx/notes.md`                   | Quick notes for the Notes tab                            |
| `.afx/kanban/*.md`                | Markdown-backed kanban for the Board tab                 |

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/repo-documents.webp" alt="AgenticFlowX Documents panel showing workflow markdown files" width="100%">
</p>

## Project memory without another dashboard

The Workbench gives you views over the files already in the repo: Workbench, Pipeline, Documents, Analytics, Journal, Board, and Notes.

Use it to see what has been decided, what is next, and which pieces still need attention, without adding a separate workflow database.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/workbench.webp" alt="AgenticFlowX Workbench panel showing spec, design, and tasks side-by-side" width="100%">
</p>

## Trace intent back to code

AFX extends VS Code with spec-awareness in the editor. `@see` CodeLens links code back to specs and designs, hover previews show the linked section inline, and go-to-definition can jump to requirement anchors like `[FR-1]` or task anchors like `[2.1]`.

The files stay plain markdown; the editor just knows how to move through them.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/traceability.webp" alt="Editor with @see CodeLens preview linked to a design section" width="100%">
</p>

---

## Install

Grab it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx). On first launch, open **Settings -> Provider**, add your API keys, and pick a model.

### 60-second quickstart: chat-first

1. Open the **AgenticFlowX** chat panel.
2. Ask for help like you normally would, or right-click a selection and choose **AgenticFlowX -> Send Selection**.
3. Use file mentions such as `@path/to/file` when you want the agent to pull full file context.

### 60-second quickstart: spec-driven

1. Open the **AgenticFlowX** chat panel.
2. Switch to Spec mode with `Cmd+Shift+M` on macOS or `Ctrl+Shift+M` on Windows/Linux.
3. Run `/afx-scaffold spec my-first-feature`.
4. Open the generated `spec.md` under `docs/specs/` and use the action row: Refine, Author, Validate, Review, Approve.

## Runtime and providers

AgenticFlowX is backed by Pi today. Whether or not you have Pi installed, AFX uses Pi to reach the providers below.

- **Already use Pi:** AFX detects your Pi CLI and routes calls through Pi RPC. Your config and keys stay where they are.
- **New to Pi:** The Pi SDK ships inside the extension. Provider keys are stored in VS Code SecretStorage. No Pi install required.

**Built-in providers:** OpenAI · Anthropic · Google Gemini · Google Vertex · GitHub Copilot · OpenRouter · Amazon Bedrock · Azure OpenAI · Groq · DeepSeek · Mistral · MiniMax · Kimi · Fireworks · Cerebras · Hugging Face · Vercel AI Gateway · xAI · Z.ai

**Plus presets** for Ollama, LM Studio, vLLM, OpenRouter, Vercel AI Gateway, Moonshot/Kimi, Anthropic-compatible proxies, Google AI Studio, and any OpenAI-compatible endpoint.

## Headless AFX

No VS Code? The AFX workflow also runs headless via the [AFX CLI and skill pack](https://github.com/AgenticFlowX/afx). It uses the same spec, design, task, journal, and traceability files.

Tested with Claude Code, Codex, Gemini CLI, and GitHub Copilot.

## Early access

Public alpha. Useful today; settings, modes, and examples are still moving.

- [Report an issue](https://github.com/AgenticFlowX/agenticflowx/issues)
- [Start a discussion](https://github.com/AgenticFlowX/agenticflowx/discussions)

## Contributing

Community contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[Apache 2.0](./LICENSE)
