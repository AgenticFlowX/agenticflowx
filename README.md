# AgenticFlowX

> Low-barrier spec-driven AI coding for VS Code. Chat first, switch to Spec mode when the work needs traceability.

AgenticFlowX is a VS Code workflow layer for AI coding. It gives you chat-first coding, Code / Explore / Spec modes, actionable markdown previews, an experimental project canvas, and repo-owned project memory for requirements, designs, tasks, journals, ADRs, notes, and traceability.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/sdd-demo.gif" alt="AgenticFlowX SDD walkthrough in VS Code" width="100%">
</p>

[![code-qa](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml/badge.svg)](https://github.com/AgenticFlowX/agenticflowx/actions/workflows/code-qa.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](./LICENSE)

[Website](https://agenticflowx.github.io) · [Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) · [Open VSX](https://open-vsx.org/extension/agenticflowx/agenticflowx) · [Changelog](./CHANGELOG.md) · [r/agenticflowx](https://www.reddit.com/r/agenticflowx/) · [GitHub](https://github.com/AgenticFlowX/agenticflowx)

---

## What you get

- **Chat first:** use AFX as a normal coding assistant for everyday implementation, debugging, edits, and follow-up.
- **Code / Explore / Spec modes:** choose full-access coding, read-only inspection, or a planning-first workflow with requirements, design, tasks, validation, review, and approval.
- **Markdown you can act on:** open rendered specs, designs, tasks, ADRs, notes, and journals with section-level workflow commands.
- **Experimental Canvas:** map specs, markdown files, notes, labels, architecture ideas, and code context visually while keeping the canvas file in your repo.
- **Flexible provider access:** use subscription-backed sign-ins, API keys, Pi, Ollama, llama.cpp-style runtimes, or any OpenAI-compatible endpoint.

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

## AFX Viewer: markdown you can act on

AFX Viewer turns repo markdown into an interactive work surface. Open a spec, design, task list, ADR, journal, or note; inspect the rendered document; then run commands from the document or a specific section.

Use it to refine, author, validate, review, approve, execute a task, or send a section back to chat without losing the source markdown.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/viewer-2.webp" alt="AFX Viewer rendering a design document with workflow actions and section commands" width="100%">
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
| `.afx/project.canvas`             | Experimental JSON Canvas for project maps and ideation   |

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/repo-documents.webp" alt="AgenticFlowX Documents panel showing workflow markdown files" width="100%">
</p>

## Project memory without another dashboard

The Workbench gives you views over the files already in the repo: Workbench, Pipeline, Documents, Analytics, Journal, Board, and Notes.

Use it to see what has been decided, what is next, and which pieces still need attention, without adding a separate workflow database.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/workbench.webp" alt="AgenticFlowX Workbench panel showing spec, design, and tasks side-by-side" width="100%">
</p>

## Experimental Canvas

Canvas is a workbench tab backed by `.afx/project.canvas`. Use it for architecture sketches, spec maps, impact views, markdown references, notes, labels, and early planning before the work becomes a formal spec.

The file stays plain JSON Canvas, so the map is portable and reviewable. Enable it from VS Code settings with `afx.experimental.canvas`.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/canvas-1.webp" alt="AgenticFlowX experimental Canvas tab with connected markdown, notes, labels, and planning cards" width="100%">
</p>

## Trace intent back to code

AFX extends VS Code with spec-awareness in the editor. `@see` CodeLens links code back to specs and designs, hover previews show the linked section inline, and go-to-definition can jump to requirement anchors like `[FR-1]` or task anchors like `[2.1]`.

The files stay plain markdown; the editor just knows how to move through them.

<p align="center">
  <img src="https://agenticflowx.github.io/assets/vscode/product/traceability.webp" alt="Editor with @see CodeLens preview linked to a design section" width="100%">
</p>

---

## Install

Grab it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AgenticFlowX.agenticflowx) or [Open VSX](https://open-vsx.org/extension/agenticflowx/agenticflowx). On first launch, open **Settings -> Provider**, connect a provider or add your keys, and pick a model.

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

AgenticFlowX supports three provider paths from Settings:

- **Subscription-backed accounts:** sign in with supported providers such as Claude/Anthropic, ChatGPT/Codex, and GitHub Copilot.
- **Bring your own keys:** store hosted provider keys in VS Code SecretStorage and choose defaults from the model picker.
- **Local-compatible runtimes:** use Ollama, llama.cpp-style servers, LM Studio, vLLM, or any OpenAI-compatible endpoint.

Already use [pi.dev](https://pi.dev)? AFX can detect your Pi CLI and route calls through Pi RPC. New to Pi? The Pi SDK ships inside the extension, so no separate Pi install is required for API Providers.

**Built-in providers:** OpenAI · Anthropic · Google Gemini · Google Vertex · GitHub Copilot · OpenRouter · Amazon Bedrock · Azure OpenAI · Groq · DeepSeek · Mistral · MiniMax · Kimi · Fireworks · Cerebras · Hugging Face · Vercel AI Gateway · xAI · Z.ai

**Plus presets** for Ollama, LM Studio, vLLM, OpenRouter, Vercel AI Gateway, Moonshot/Kimi, Anthropic-compatible proxies, Google AI Studio, and any OpenAI-compatible endpoint.

## Headless AFX

No VS Code? The AFX workflow also runs headless via the [AFX CLI and skill pack](https://github.com/AgenticFlowX/afx). It uses the same spec, design, task, journal, and traceability files.

Tested with Claude Code, Codex, Gemini CLI, and GitHub Copilot.

## Status

AgenticFlowX is open source under Apache 2.0. The extension is moving quickly; Canvas is experimental, and provider/settings surfaces continue to evolve.

- [Report an issue](https://github.com/AgenticFlowX/agenticflowx/issues)
- [Start a discussion](https://github.com/AgenticFlowX/agenticflowx/discussions)

## Contributing

Community contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[Apache 2.0](./LICENSE)
