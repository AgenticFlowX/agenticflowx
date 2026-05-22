---
afx: true
type: SPRINT
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T14:58:19.000Z"
updated_at: "2026-05-22T08:05:29.000Z"
tags: ["chat-foundation", "sprint", "skill-bundling", "models", "slash-commands", "pi-rpc"]
approval:
  spec: Approved
  design: Approved
  tasks: Draft
---

# Chat Foundation — Sprint Brief

> **Format**: Single-document SDD. Carries spec + design + tasks in one file for fast, surgical foundation work.
> **Approval gates**: Sections must be approved in order — Spec → Design → Tasks → Code. Track via the `approval` block in frontmatter.
> **Graduation**: Run `/afx-sprint graduate chat-foundation` to split into `spec.md` / `design.md` / `tasks.md` if scope grows beyond foundation.

---

<!-- SPRINT-SECTION-START: SPEC (maps to spec.md on graduation — includes References + Section 1 body; drop `## 1. Spec` wrapper, promote ### → ##) -->

## References

> **Upstream Context**: Research that drove this sprint.

- **Research**: [docs/research/afx/res-afx-chat-foundation.md](../../research/afx/res-afx-chat-foundation.md)
- **Research**: [docs/research/pi/res-pi-rpc-features.md](../../research/pi/res-pi-rpc-features.md)
- **Research**: [docs/research/afx/res-afx-chat-display-surface.md](../../research/afx/res-afx-chat-display-surface.md)
- **Research**: [docs/research/afx/res-afx-product-boundary.md](../../research/afx/res-afx-product-boundary.md)
- **Architecture**: [AGENTS.md](../../../AGENTS.md) — current layout, runtime-adapter boundary
- **Existing spec**: [210-app-chat/spec.md](../210-app-chat/spec.md), [210-app-chat/design.md](../210-app-chat/design.md)

---

## 1. Spec

> The WHAT — requirements, acceptance, scope. Mirrors `afx-spec/assets/spec-template.md`. Use `[FR-X]` / `[NFR-X]` anchors so code `@see` links can be retargeted cleanly after graduation.

### Problem Statement

AFX is RPC-first against Pi as the runtime. The chat shell is wired (status bar, streaming tool timeline, abort, thinking blocks) but four foundation gaps block delivering real value:

1. **AFX skills are not reaching Pi** — `afx/skills/agenticflowx/*` exists at workspace root and is mirrored under `.claude/skills/`, `.agents/skills/`, `.afx/skills/`, but Pi spawns with `cwd = vscode.workspace.workspaceFolders[0]` (the user's project). Skills bundled inside the VSIX never load.
2. **Explorer tab is dead weight** — `apps/chat/src/views/explorer.tsx` is a `ComingSoon` stub. It occupies a real-estate slot we could use to validate the bundle and surface skill discovery.
3. **Model selector is a stub** — composer renders a non-functional `Sparkles` button labeled "GPT-5.3 AI agent". Pi RPC has `get_available_models`/`set_model`; the AFX `AgentManager` contract does not.
4. **No slash-command surface** — composer mentions `/` for commands but no picker exists. The Pi runtime adapter does not yet rewrite `/afx-*` to Pi's `/skill:afx-*`. AFX skills are unreachable from chat even after they're bundled.

This sprint lays the foundation only — no spec-mode, no security policy, no auth bridge.

### User Stories

#### Primary Users

VSCode extension users running AFX commands; AFX skill authors; developers iterating on the chat UI.

#### Stories

**As a** VSCode user
**I want** AFX skills (`/afx-task`, `/afx-next`, etc.) to be available out of the box
**So that** I don't have to author or copy skill files into my workspace before chat is useful.

**As a** VSCode user
**I want** to switch models from the chat composer
**So that** I don't have to edit `settings.json` to change provider.

**As a** VSCode user
**I want** a static listing of available commands somewhere I can scan
**So that** I can discover commands without typing `/` to probe — surfaced in Settings → Available Skills, with the slash popup as the primary discovery surface.

**As a** developer maintaining AFX
**I want** the Pi runtime adapter to own all Pi-specific behavior (skill bundling args, slash-command rewrite)
**So that** swapping Pi for another runtime later means rewriting only `packages/agent/pi/`, not the chat app.

### Requirements

#### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Priority    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | The AFX `agenticflowx` skill pack (with `assets/`) MUST be vendored under `apps/vscode/resources/skills/agenticflowx/` and committed to the extension repo. Sync via `pnpm sync:skills`, which executes the canonical curl-pipe form `curl -sL https://raw.githubusercontent.com/AgenticFlowX/afx/<ref>/afx-cli \| bash -s -- --skills-only --target <tmpdir> --yes` against a pinned `<ref>` (default `main`, override via `AFX_REF`), then keeps only `<tmpdir>/.afx/skills/agenticflowx/` (with per-skill `assets/`), drops the rest (`starter/`, `.agents/`, `.claude/`, `.afx.yaml`, `.afx/.cache/`), and copies to `apps/vscode/resources/skills/agenticflowx/`. | Must Have   |
| FR-2  | When Pi spawns, the Pi runtime adapter MUST append `--skill <extensionPath>/resources/skills` to its CLI args. Pi recurses to find `SKILL.md` files inside `agenticflowx/<skill>/`, so bundled skills load regardless of user workspace.                                                                                                                                                                                                                                                                                                                                                                                                                               | Must Have   |
| FR-3  | After load, `agent/commands` MUST surface bundled AFX skills as `skill:afx-*` entries (verifiable end-to-end).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Must Have   |
| FR-4  | The `AgentManager` contract MUST gain `getAvailableModels()`, `setModel({provider, modelId})`, `getCommands()`, and `getStderr()` methods. All four are runtime-agnostic; non-process runtimes may return an empty diagnostic buffer for `getStderr()`.                                                                                                                                                                                                                                                                                                                                                                                                                | Must Have   |
| FR-5  | `AgentStatus.model` MUST expand from `string \| undefined` to `{provider: string, id: string, name?: string} \| undefined`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Must Have   |
| FR-6  | The chat composer's existing model button MUST be replaced by a real combobox driven by `agent/models`, grouped by provider; selecting a model issues `chat/setModel`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Must Have   |
| FR-7  | The composer MUST show a `/`-trigger popup listing commands from `agent/commands`. AFX skills (`skill:afx-*`) MUST render as `/afx-*`. Click/Enter inserts into the textarea (no auto-submit).                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Must Have   |
| FR-8  | The Pi runtime adapter MUST rewrite outgoing prompts matching `^\s*/afx-\S+` by replacing the `/afx-` prefix with `/skill:afx-` before issuing the Pi `prompt` request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Must Have   |
| FR-9  | The Explorer tab MUST be removed from the chat shell. Final tabs: **Chat, History, Settings** — no dedicated Skills tab. Slash popup is the primary discovery surface; the static skill listing lives in Settings → Available Skills (FR-13.f).                                                                                                                                                                                                                                                                                                                                                                                                                        | Must Have   |
| FR-10 | Settings tab MUST disclose: "Switching models updates Pi's default for future CLI runs."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Should Have |
| FR-11 | The composer toolbar MUST drop unwired placeholder buttons (`+` "Add context", `📎` "Attach file"). Retained controls: `@` mention, model selector, send/abort. Buttons in [DES-IMPROVEMENTS] (thinking-level, Compact, etc.) are added only when promoted in a follow-up sprint.                                                                                                                                                                                                                                                                                                                                                                                      | Must Have   |
| FR-12 | The composer MUST support `@`-trigger file mention. Typing `@` (or clicking the `@` button) opens a workspace file picker scoped to text/code files. Selecting a file inserts an `@<workspace-relative-path>` token into the textarea. On submit, the host layer expands `@<path>` tokens by reading file contents and prepending them as a fenced context block before the user's prompt text.                                                                                                                                                                                                                                                                        | Must Have   |
| FR-13 | The Settings tab MUST present at minimum: (a) provider summary (which providers report at least one available model), (b) Pi binary path (read-only + link to VSCode setting), (c) bundled-skills resource path + count, (d) the model-default disclosure (FR-10), (e) a Diagnostics section (log level, view Pi stderr, new session), (f) **Available Skills** — read-only `get_commands` listing grouped by resource type (`skill` / `extension` / `prompt`) plus AFX-curated `actions`, AFX-prefixed names rendered as `/afx-*`.                                                                                                                                    | Must Have   |

#### Non-Functional Requirements

| ID    | Requirement                                     | Target                                                                                                                                                                                 |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Runtime-adapter boundary                        | The chat app MUST NOT import from `@afx/agent-pi`. All Pi-specific knowledge stays in `packages/agent/pi/` and `agent-factory`.                                                        |
| NFR-2 | Bundle delivery is additive                     | Bundled skills MUST NOT overwrite or shadow user-authored workspace skills. Pi's `--skill` flag is additive by spec.                                                                   |
| NFR-3 | No fs writes on activate                        | The bundle MUST NOT be materialized to the user's workspace or to a global config dir at activation.                                                                                   |
| NFR-4 | Slash rewrite is reversible                     | The rewrite MUST be a pure prefix substitution; if Pi's skill-prefix convention changes, the change is one regex.                                                                      |
| NFR-5 | Build affects only `apps/vscode` package output | Skill bundling MUST NOT add a new package or pull in skill content at runtime; copy is a build-time step.                                                                              |
| NFR-6 | Existing UI primitives only                     | New v1 chat controls MUST compose `@afx/ui` shadcn primitives; no app-local primitive framework or hand-rolled popover/listbox keyboard behavior when an existing primitive covers it. |

### Acceptance Criteria

- [ ] Building the VSIX produces `apps/vscode/resources/skills/agenticflowx/<skill>/SKILL.md` for every skill in `afx/skills/agenticflowx/`.
- [ ] Spawning Pi from the extension, then issuing `get_commands` over RPC, returns at least `skill:afx-task`, `skill:afx-next`, `skill:afx-spec`, `skill:afx-design`, `skill:afx-research` (representative AFX bundle).
- [ ] Opening the chat panel shows three tabs (Chat, History, Settings) — no Explorer, no Skills tab.
- [ ] Clicking the model button opens a real combobox listing models grouped by provider; picking one issues `set_model` and the status bar reflects the change.
- [ ] Typing `/` in the composer opens a popup listing AFX commands as `/afx-*`; selecting one inserts into the textarea.
- [ ] Submitting `/afx-task code T-001` results in Pi receiving `prompt` with `/skill:afx-task code T-001` (verified via RPC log or unit test in the adapter).
- [ ] No file in `apps/chat/` imports from `@afx/agent-pi` (NFR-1).
- [ ] Settings tab includes the model-default disclosure copy (FR-10).
- [ ] Composer toolbar shows only `@` mention, model selector, and send/abort — no `+`, no `📎`.
- [ ] Typing `@` in the composer opens a file picker; selecting a file inserts `@<path>` into the textarea (no auto-submit).
- [ ] Submitting `Refactor @src/foo.ts to use ioredis` results in Pi receiving the file contents prepended as a fenced block followed by the original prompt text.
- [ ] Settings tab shows Engine (Pi binary, bundled skills count), Providers, model-default disclosure, Diagnostics, **Available Skills**, and About sections per FR-13.
- [ ] New model, slash, mention, and Settings controls use `@afx/ui` shadcn primitives (`Combobox`, `Popover`, `Command`, `Badge`, `ScrollArea`, `Tooltip`, `Button`, etc.) rather than custom primitives.

### Non-Goals (Out of Scope)

- Spec-mode (mode-aware tool gating, focus-mode prompt selection) — separate spec.
- Security policy hook (`ToolCallPolicy` composing security + repetition + mode-permission) — separate ADR.
- Auth bridge (VSCode `SecretStorage` → Pi `setFallbackResolver`) — deferred.
- Custom-mode files (`.afxmodes/`) — deferred to v1.1.
- History tab refactor (folding into Chat as a session drawer) — out of foundation.
- Full chat status strip from `res-afx-chat-display-surface.md` (context %, compact button, thinking selector) — follow-up.
- Fork/clone/export session UI affordances.
- Fuzzy-match scoring or argument completion in the slash popup.
- `@` mention does NOT support globs, remote URLs, image/binary files, or recursive directory inlining. Single-file mentions only; files larger than the cap are referenced by path with a "[truncated]" marker.
- Settings tab does NOT include auth provisioning UI. Configure providers via Pi CLI (`pi auth login <provider>`); Settings only surfaces the resulting state.
- Settings tab does NOT include log-stream tail or live-tracing. The "View Pi stderr" entry shows the buffered stderr captured by the adapter; richer diagnostics are post-foundation.

### Open Questions

| #   | Question                                                                                                                                                         | Status   | Blocking | Resolution                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which exact subdir under `apps/vscode/` holds the bundled skills — `resources/skills/`, `assets/skills/`, or another path required by the VSIX packaging script? | Resolved | No       | `apps/vscode/resources/skills/agenticflowx/` (vendored). Verified: `apps/vscode/.vscodeignore` excludes only `.turbo/`, `src/`, `tsconfig.json`, `esbuild.mjs`, `node_modules/`, `.vscode/`, `**/*.map`. `resources/skills/**` ships in the VSIX without further config changes. |
| 2   | Should the model picker confirm before the first `set_model` call (since it mutates Pi default)?                                                                 | Resolved | No       | No confirm. Settings tab discloses the side-effect (FR-10). Revisit only if users report surprise.                                                                                                                                                                               |
| 3   | If `get_available_models` returns an empty list (no auth configured), what does the picker show?                                                                 | Resolved | No       | Empty-state copy "No models available — configure a provider in Pi auth" with a link to the Settings tab. Captured in [DES-ERR] and the model-combobox empty-state mockup.                                                                                                       |
| 4   | If multiple skills with the same name come from bundle and workspace, what wins? Pi documents "first wins"; what's our preferred ordering on `--skill` arg list? | Resolved | No       | Workspace-discovered skills win on name collision. Adapter spawn args pass `--skill <bundle>` AFTER Pi's auto-discovery, so Pi keeps the workspace skill. Captured in [DES-DEC].                                                                                                 |
| 5   | Does `/afx-research` (etc., any skill we ship outside the extension repo) belong in the bundle at all, or only `/afx-*` that make sense from a chat surface?     | Resolved | No       | Bundle the full pack as returned by `afx-cli --skills-only` (currently 17 skills under the `agenticflowx` pack). No trim list — what afx-cli ships, we ship. Trim later only if a specific skill misbehaves in chat.                                                             |
| 6   | Where does the `@` mention file list come from — VSCode `workspace.findFiles` (host-side) or Pi `bash`/`find` (RPC)?                                             | Resolved | No       | Host-side `vscode.workspace.findFiles("**/*", undefined, 200)`. Second arg `undefined` uses default `files.exclude` + `.gitignore` patterns. 200-result cap. Captured in [DES-DEC] and [DES-MENTION].                                                                            |
| 7   | What is the per-file size cap for `@` mention expansion? Files above the cap get a `[truncated]` marker with the path preserved.                                 | Resolved | No       | 64 KB default cap. Soft — token stays in prompt with `[truncated: file too large]` marker; agent can still use its own `read` tool to scan. Adjustable post-foundation if needed.                                                                                                |
| 8   | Does `@` mention expansion require a separate `chat/readFile` message?                                                                                           | Resolved | No       | No. The chat app sends `chat/send` with `mentions?: string[]`; the host validates and reads files internally before calling `AgentManager.send()`. `chat/listFiles` is the only file-picker request exposed to the webview.                                                      |
| 9   | How does Settings show buffered Pi stderr without importing the Pi adapter?                                                                                      | Resolved | No       | Add runtime-agnostic `AgentManager.getStderr()`. Pi returns `PiClient.getStderr()`; future runtimes may return an empty string or their diagnostic buffer.                                                                                                                       |
| 10  | Do Settings rows call `AgentManager` directly?                                                                                                                   | Resolved | No       | No. React uses typed transport messages only. Skill rows trigger local app state to switch to Chat and insert text; action rows dispatch existing bridge messages such as `chat/newSession` and `chat/abort`.                                                                    |
| 11  | How strict is the v1 UI implementation while the design system is still being finalized?                                                                         | Resolved | No       | Strict on primitives, loose on final visuals: use existing `@afx/ui` shadcn primitives and current tokens, but do not invent final UX polish or app-local UI primitives in this sprint.                                                                                          |

### Dependencies

- `100-package-shared` — `AgentManager` interface lives here; this sprint extends it (FR-4, FR-5).
- `210-app-chat` — composer + tab shell change here (FR-6, FR-7, FR-9, FR-10).
- `300-infra-pi` — Pi runtime adapter changes here (FR-2, FR-8, plus contract impl for FR-4/FR-5).
- `200-app-vscode` — `agent-factory.ts` resolves bundled-skills path, passes `additionalSkillPaths` into `PiRpcManagerOptions` (FR-2).
- `310-infra-build` — VSIX packaging step copies `afx/skills/agenticflowx/` into `apps/vscode/resources/skills/` (FR-1).

<!-- SPRINT-SECTION-END: SPEC -->

---

<!-- SPRINT-SECTION-START: DESIGN (maps to design.md on graduation; promote ### → ##) -->

## 2. Design

> The HOW — architecture, decisions, data model. Mirrors `afx-design/assets/design-template.md`. Use `[DES-X]` anchors on section headings so code `@see` links can be retargeted cleanly after graduation.

### [DES-OVR] Overview

Bundle the AFX skill set into the VSIX, pass it to Pi via the verified `--skill <path>` CLI flag, and surface skills in chat via the slash popup (primary discovery surface) plus a static read-only listing in Settings → Available Skills. Drop the Explorer tab; final tabs are Chat, History, Settings. Add a real model selector. Keep the chat app runtime-agnostic by hosting all Pi-specific behavior — skill flag wiring and slash-prefix rewrite — inside `packages/agent/pi/`.

### [DES-ARCH] Architecture

#### System Context

```text
┌────────────────────┐     chat/setModel
│   apps/chat        │ ──────────────────► ┌──────────────────┐    AgentManager     ┌──────────────────────┐
│  • Settings:       │ ◄─────────────────── │ apps/vscode      │ ──────────────────► │ packages/agent/pi    │
│    Available Skills│
│  • Slash popup     │     agent/commands  │  agent-factory:  │   getAvailableModels│  rpc-manager.ts      │
│  • Model combobox  │     agent/models    │  resolves        │   setModel          │   • RPC: set_model   │
│  • Status bar      │                     │  bundledSkills,  │   getCommands       │   • RPC: get_avail.. │
└────────────────────┘                     │  builds          │   getStderr         │   • RPC: get_command │
        │ ▲                                │  PiRpcMgr opts   │   /afx-* prefix)    │   • RPC: prompt      │
        │ │ chat/state etc.                └──────────────────┘                     └──────────────────────┘
        │ │                                                                                      │
        │ └──── @afx/transport ──────────────────────────────────────────────────────────────────┘
        ▼                                                                                       │
   webview postMessage                                                            Pi subprocess (--mode rpc
                                                                                  --skill <bundleRoot>)
```

The chat app talks through the shared message protocol and transport only. The extension host talks to `AgentManager`. The single Pi-aware site is `apps/vscode/src/agent-factory.ts`, which resolves `extensionPath/resources/skills/agenticflowx` and passes it as `additionalSkillPaths` into `PiRpcManagerOptions`. The Pi runtime adapter writes those into the spawn args as repeated `--skill` entries, then rewrites outgoing prompts on the way to Pi.

#### Component Diagram

```text
┌────────────────── apps/chat ──────────────────┐
│                                               │
│  views/chat.tsx ──► views/settings.tsx        │
│       │              (Available Skills + …)   │
│       │                                       │
│       ▼                                       │
│  composer:                                    │
│   • <ModelCombobox>     (NEW)                 │
│   • <SlashPopup>        (NEW)                 │
│                                               │
└──────────────────── lib/bridge.ts ────────────┘
                          │
                          ▼  Transport (webview ↔ host)
┌─────────────── apps/vscode ───────────────────┐
│                                               │
│  agent-factory.ts                             │
│   • resolves <ext>/resources/skills/agenticflowx│
│   • passes via PiRpcManagerOptions            │
│                                               │
│  panels/sidebar-panel.ts                      │
│   • new bridge handlers:                      │
│     chat/getModels → AgentManager.getAvailableModels │
│     chat/setModel  → AgentManager.setModel    │
│     chat/getCommands → AgentManager.getCommands │
│     chat/getStderr → AgentManager.getStderr     │
│     chat/listFiles/openSettings → VSCode host APIs │
│                                               │
└────────── packages/agent/pi ──────────────────┘
                          │
                          ▼
┌─────────────── packages/agent/pi ─────────────┐
│                                               │
│  rpc-manager.ts                               │
│   • implements getAvailableModels/setModel/getCommands/getStderr │
│   • send() rewrites /afx-* → /skill:afx-*     │
│   • getStatus() expands model into {provider,id,name} │
│                                               │
│  rpc-client.ts                                │
│   • PiRpcManagerOptions.additionalSkillPaths │
│     thread to spawn args: --skill <p>...      │
│                                               │
└───────────────────────────────────────────────┘
```

### [DES-ABSTRACTION] Runtime-agnostic boundary

The chat app and host bridge MUST NOT depend on Pi. The single Pi-aware site is `apps/vscode/src/agent-factory.ts`, where the runtime is selected and instantiated. Everything else talks to `AgentManager` from `@afx/shared`.

```text
              ┌──────────────────────────── runtime-agnostic ────────────────────────────┐
              │                                                                          │
              │     apps/chat/**         packages/shared/**          apps/vscode/**      │
              │     (webview UI)         (types + protocol)          (host bridge only)  │
              │                                                                          │
              │  Talks: AgentEvent      Defines: AgentManager,        Calls: manager.*   │
              │         (from           AgentModel, AgentCommand,                        │
              │          shared)        AgentAction, ChatToAgent,                        │
              │                         AgentToChat, SettingsSnapshot                    │
              │                                                                          │
              └──────────────────────────────────┬───────────────────────────────────────┘
                                                 │  (single Pi-aware boundary below)
                                                 ▼
                                  apps/vscode/src/agent-factory.ts
                                  (switch on AgentRuntime kind)
                                                 │
              ┌──────────────────────────────────┼─────────────────────────────────────┐
              │                                  │                                     │
              ▼                                  ▼                                     ▼
   packages/agent/pi/                packages/agent/future/             packages/agent/custom-sdk/
   (today, --mode rpc)               (future)                          (future)
```

Future-runtime contract: adding a new runtime means adding `packages/agent/<name>/` that:

1. Implements `AgentManager` from `@afx/shared` end-to-end.
2. Translates the runtime's native event shape into `AgentEvent` (the runtime-agnostic union in `packages/shared/src/agent.ts`).
3. Owns its own slash-prefix rewrite (or none) inside `send()` — chat app never knows about runtime-specific prefix conventions.
4. Resolves auth/secrets via `AuthResolver` (deferred contract; not in foundation).

`agent-factory.ts` extends to:

```ts
type AgentRuntime = "pi" | "future"; // grow this union to register a runtime
function createConfiguredAgentInstances(opts): AgentInstance[] {
  return [
    { id: "pi", label: "Pi", runtime: "pi", manager: createPiAgentManager(opts) },
    // future: { id: "example", … manager: createExampleAgentManager(opts) }
  ];
}
```

Boundary invariants (enforced by `/afx-check trace` and grep at PR time):

- No file under `apps/chat/**` imports from `@afx/agent-pi` or `@earendil-works/*`.
- No file under `apps/vscode/src/panels/**` imports from `@afx/agent-pi` directly — it only uses `AgentManager` returned by `agent-factory.ts`.
- All adapter-specific knowledge (Pi RPC commands, `--skill` args, slash rewrite) lives in `packages/agent/pi/**`.
- `packages/shared/**` has zero adapter imports and zero React.

### [DES-UI] User Interface & UX

V1 UI scope: validate Pi integration inside the existing chat shell. New controls MUST compose existing `@afx/ui` shadcn primitives (`Button`, `Tabs`, `Popover`, `Command`, `Combobox`, `ScrollArea`, `Badge`, `Tooltip`, `Separator`, `Textarea`, etc.) and current Meridian/Lyra tokens. Do not introduce app-local primitive components, a new styling system, or final UX polish in this sprint.

#### Composite chat tab — Pi-RPC-driven chrome (ASCII)

The status bar remains compact and lights up only the Pi RPC fields needed for v1: run state, model, context, and cost. The composer keeps only working controls: `@` mention, model selector, send, and abort. Thinking-level, Compact, pending queue, and cache indicators stay deferred to [DES-IMPROVEMENTS].

```text
┌─ Tabs ─────────────────────────────────────────────────────────────┐
│  Chat    History    Settings                                       │
├─ Status bar  (get_state.model + get_session_stats) ────────────────┤
│  ● gpt-5.2     82k/400k 21%      $0.42                             │
├─ Transcript ───────────────────────────────────────────────────────┤
│                                                                     │
│  ● You · 12:14                                                      │
│  └─ How does the auth middleware work?                              │
│                                                                     │
│  ○ AFX · 12:14                                                      │
│  ├ 🔧 Read auth.ts — 240 lines           ✓                         │
│  ├ 🔧 Searched "verify"  — 4 hits        ✓                         │
│  └ It validates tokens via Pi auth-storage…                         │
│      ┊ 1.2k tok · $0.07 · 18% ctx · stop:end_turn                  │
│                                                                     │
│  ○ AFX · thinking…                                       ●●●        │
│                                                                     │
├─ Activity bar  (during stream) ────────────────────────────────────┤
│  🧠 Thinking: examining auth flow…                              ●  │
├─ Composer ─────────────────────────────────────────────────────────┤
│  ╭───────────────────────────────────────────────────────────────╮ │
│  │ Type your next message…                                       │ │
│  │                                                               │ │
│  ╰───────────────────────────────────────────────────────────────╯ │
│  [AtSign]    [Sparkles gpt-5.2 ChevronDown]              [ArrowUp] │
│  ────────────────────────────────────────────────────────────────  │
│  AFX may make mistakes. Verify important output.            ⌘ ⏎    │
└────────────────────────────────────────────────────────────────────┘
```

Status-bar cell sources (left → right):

| Cell    | Pi RPC source                                              | Render rule                                                          | Foundation? |
| ------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| Run dot | `getStatus().running` / `isStreaming`                      | pulse on streaming; success on idle; red on down                     | YES         |
| Model   | `getStatus().model.{name}`                                 | from `get_state.model.name` (Pi `Model.name`, always present)        | YES (FR-5)  |
| Context | `getUsage().contextUsage.{tokens, contextWindow, percent}` | `82k/400k 21%`; "recalculating" when `tokens` or `percent` is `null` | YES         |
| Cost    | `getUsage().cost`                                          | from `get_session_stats.cost`; precision scales by magnitude         | YES         |

Per-message meta line (`1.2k tok · $0.07 · 18% ctx · stop:end_turn`) sources from the existing `chat/usage` event payload (already wired in `apps/chat/src/views/chat.tsx:194-202`). No new fields.

Cells deferred to [DES-IMPROVEMENTS] and intentionally **not** in the foundation status bar: `thinkingLevel` (cycle/set thinking control), `toolCalls` count, `pendingMessageCount`, cache-hit indicator. Each maps 1:1 to a Pi RPC field already verified — promotion is wiring, not redesign.

#### Available Skills (Settings section, FR-13.f)

The static skill listing lives inside the Settings tab as a section, not as a dedicated tab. Slash popup is the primary discovery surface; this section gives a passive scan of what's bundled.

- Top: section heading "Available Skills" + count badge (`get_commands.length` + 2 actions).
- Body: scroll list grouped by source. Groups match Pi's `RpcSlashCommand.source` enum exactly (`extension` | `prompt` | `skill`) plus an AFX-curated `actions` group rendered by the chat app (NOT from `get_commands`).
  - **AFX SKILLS** (`get_commands` rows where `source === "skill"` and name starts with `skill:afx-`) — primary group, shown first
  - **OTHER SKILLS** (`source === "skill"`, name doesn't start with `skill:afx-`)
  - **EXTENSION COMMANDS** (`source === "extension"` — Pi extensions registered as commands)
  - **PROMPT TEMPLATES** (`source === "prompt"` — prompt files invoked via slash)
  - **ACTIONS** — AFX-curated (`/new`, `/abort`); these dispatch typed chat bridge messages (`chat/newSession`, `chat/abort`) rather than calling `AgentManager` from React. Pi's TUI built-ins (`/quit`, `/login`, `/settings`, …) are NOT shown — they aren't returned by `get_commands` and don't apply over RPC.
- Each row: bold name (rendered as `/afx-task` for `skill:afx-task`), description on second line, source badge. Icons per [DES-ICONS].
- Click on a skill/prompt/extension row → app-level handler switches to Chat tab and inserts `/<command-name>` into the composer. Click on an ACTION row → dispatches the corresponding typed bridge message without inserting text.

(See the Settings tab mockup below for the inline rendering of this section.)

#### Composer slash popup

- Trigger: typing `/` at start of empty/whitespace line in the composer.
- Floating list above composer; arrow keys to navigate; Enter inserts; Esc dismisses.
- Inserts only — does not auto-submit. User reviews, edits args, sends explicitly.

ASCII mockup (popover anchored above composer when user types `/`):

```text
  ╭──────────────────────────────────────────────────────────╮
  │  AFX SKILLS               (get_commands → source="skill") │
  │   /afx-task     Pick, verify, code, complete tasks       │
  │   /afx-next     Context-aware next action                │
  │   /afx-discover Discover infra & capabilities            │
  │   /afx-spec     Manage spec.md lifecycle                 │
  │   /afx-design   Author technical designs                 │
  │   /afx-research Explore, compare, summarize              │
  │   /afx-session  Capture notes, log sessions              │
  │   …7 more                                                │
  │                                                          │
  │  ACTIONS                  (AFX-curated; chat bridge)     │
  │   /new          New session         chat/newSession      │
  │   /abort        Abort active run    chat/abort           │
  ╰──────────────────────────────────────────────────────────╯
                              ▲
┌──────────────────────────────────────────────────────────────┐
│ /                                                            │
│ [AtSign]   [Sparkles gpt-5.2 ChevronDown]            [ArrowUp]│
└──────────────────────────────────────────────────────────────┘
```

#### Model combobox

- Replaces the existing stub button at [chat.tsx:332-342](../../../apps/chat/src/views/chat.tsx#L332-L342).
- Click opens a popover; rows grouped by `provider`.
- Implement with `@afx/ui/components/combobox` primitives; use app-local code only for grouping, formatting, and bridge dispatch.
- Each row: `name ?? id`, secondary text shows `id` (when name differs) and context-window size if Pi reports it.
- Selecting a row dispatches `chat/setModel`; the picker closes; status bar updates on the next `agent/status` event.
- Empty state: "No models available — configure a provider in Pi auth" with link target `/afx-help` or Settings tab (TBD during build).

ASCII mockup (popover anchored to the model button at bottom of composer):

```text
                                ╭───────────────────────────╮
                                │  🔍 Search models…        │
                                ├───────────────────────────┤
                                │  ANTHROPIC                │
                                │   ○ claude-sonnet-4.6     │
                                │     200k · reasoning      │
                                │   ○ claude-opus-4.7       │
                                │     200k · reasoning      │
                                │                           │
                                │  OPENAI                   │
                                │   ✓ gpt-5.2  ← current   │
                                │     400k · reasoning      │
                                │   ○ gpt-5.4               │
                                │     400k                  │
                                │                           │
                                │  ─────────────────────── │
                                │  ⓘ Switching updates Pi   │
                                │    default for CLI runs.  │
                                ╰───────────────────────────╯
                                            ▲
┌──────────────────────────────────────────────────────────────┐
│ [AtSign]   [Sparkles gpt-5.2 ChevronDown]            [ArrowUp]│
└──────────────────────────────────────────────────────────────┘
```

Empty state mockup (no `get_available_models` results):

```text
                                ╭───────────────────────────╮
                                │  No models available.     │
                                │                           │
                                │  Configure a provider in  │
                                │  Pi auth to enable model  │
                                │  switching.               │
                                │                           │
                                │  → Open Settings          │
                                ╰───────────────────────────╯
```

#### [DES-ICONS] Icon legend (Lucide-only, no invented glyphs)

Mockups annotate every icon as `[IconName]` matching a real `lucide-react@1.11.0` export. No emojis, no symbol fonts, no SVG-only ad-hoc shapes. Each icon name below was verified to exist in the installed package.

| Symbol in mockup  | Lucide icon     | Use                                                           |
| ----------------- | --------------- | ------------------------------------------------------------- |
| Run dot (filled)  | `Circle`        | Status bar — render with `fill-current` for streaming/running |
| Run dot (outline) | `Circle`        | Idle/disconnected state                                       |
| `[Check]`         | `Check`         | Active/selected row marker (e.g. current model in combobox)   |
| `[Sparkles]`      | `Sparkles`      | Model selector trigger (already in `chat.tsx` imports)        |
| `[Brain]`         | `Brain`         | Thinking-level indicator (deferred — see [DES-IMPROVEMENTS])  |
| `[Inbox]`         | `Inbox`         | Pending-queue badge (deferred — `pendingMessageCount > 0`)    |
| `[Wrench]`        | `Wrench`        | Tool-call icon (already used in chat.tsx tool descriptors)    |
| `[Search]`        | `Search`        | Filter / search inputs                                        |
| `[RefreshCw]`     | `RefreshCw`     | Refresh action (already used in `history.tsx`)                |
| `[ArrowUp]`       | `ArrowUp`       | Send button (already used in `chat.tsx`)                      |
| `[Square]`        | `Square`        | Abort/stop button (already used)                              |
| `[ExternalLink]`  | `ExternalLink`  | "Open in VSCode setting" links in Settings                    |
| `[Info]`          | `Info`          | Inline disclosure callouts                                    |
| `[ChevronDown]`   | `ChevronDown`   | Combobox / popover triggers (already used)                    |
| `[ChevronUp]`     | `ChevronUp`     | Popover-anchor "▲" indicator                                  |
| `[AtSign]`        | `AtSign`        | Mention button + `@`-trigger popup (already used)             |
| `[AlertTriangle]` | `AlertTriangle` | Error rows (already used)                                     |
| `[Database]`      | `Database`      | Cache-hit indicator (deferred — see [DES-IMPROVEMENTS])       |
| `[PlugZap]`       | `PlugZap`       | Settings → Engine section heading                             |
| `[Key]`           | `Key`           | Settings → Providers section heading                          |
| `[FileText]`      | `FileText`      | Settings → Diagnostics → "View buffered stderr"               |
| `[Settings2]`     | `Settings2`     | Settings tab icon                                             |
| `[Activity]`      | `Activity`      | About section / version row                                   |
| `[Folder]`        | `Folder`        | Bundled-skills path display                                   |
| `[FolderOpen]`    | `FolderOpen`    | Workspace-folder rows in `@` mention picker (already used)    |
| `[FileCode]`      | `FileCode`      | Code/text file rows in `@` mention picker (already used)      |
| `[XCircle]`       | `CircleX`       | Clear / dismiss / cancel actions                              |
| `[CircleCheck]`   | `CircleCheck`   | Validated / success badges (e.g. provider with valid auth)    |

Implementation rule (FR-11 supplement): every icon used in `apps/chat/src/**` MUST be a named import from `lucide-react`. The chat app MUST NOT import emoji libraries, glyph fonts, or hand-rolled SVGs except for the AFX brand mark in [`packages/ui/src/tokens/`](../../../packages/ui/src/tokens/) (theme-managed only).

#### [DES-MENTION] `@` file mention popover and expansion

Composer detects `@` at a word boundary (start of input or preceded by whitespace) and opens a workspace file picker. Selecting a file inserts a token like `@apps/chat/src/views/chat.tsx` (workspace-relative). On submit, the chat app tokenizes the draft into an ordered unique `mentions?: string[]` array on `chat/send`; the host (`apps/vscode/src/panels/sidebar-panel.ts`) validates those paths, reads each file via the VSCode FS API, and inflates the prompt before passing it to `AgentManager.send()`. The webview itself never touches the filesystem or receives file contents.

ASCII mockup (popover anchored to the `@` button or to the cursor when the user types `@`):

```text
                                ╭───────────────────────────╮
                                │  [Search] Filter files…   │
                                ├───────────────────────────┤
                                │  OPEN FILES               │
                                │   (vscode.window.tabGroups)│
                                │   ○ src/auth/middleware.ts│
                                │   ○ packages/shared/types │
                                │   ○ docs/specs/.../spec…  │
                                │                           │
                                │  WORKSPACE                │
                                │   (workspace.findFiles)   │
                                │   ○ apps/chat/src/app.tsx │
                                │   ○ apps/vscode/src/ext…  │
                                │   ○ packages/shared/agent │
                                │   …N more (200 cap)       │
                                │                           │
                                │  ─────────────────────── │
                                │  [Info] Selected files    │
                                │    inlined on submit      │
                                │    (≤ 64 KB).             │
                                ╰───────────────────────────╯
                                          ▲
┌──────────────────────────────────────────────────────────────┐
│ Refactor @                                                   │
│ [AtSign]   [Sparkles gpt-5.2 ChevronDown]            [ArrowUp]│
└──────────────────────────────────────────────────────────────┘
```

Submit-time expansion algorithm:

````text
1. Chat app tokenizes the message text for `@<path>` where <path> matches [\w./_\-]+
   and the `@` is not preceded by an alphanumeric (so `email@example.com` is not matched).
2. Chat app sends `chat/send` with `content` plus ordered unique `mentions`.
3. For each mention, host validates and reads the workspace file:
   - resolve relative to workspaceFolders[0]
   - reject paths outside the workspace (no `../` escape, no absolute paths)
   - skip if not a regular file or if file is binary (heuristic: NUL byte in first 512B)
   - if size > FR-12 cap (default 64 KB), keep token but mark `[truncated]`
4. Build the inflated prompt:
       The user referenced these files:

       ### apps/chat/src/views/chat.tsx
       ```tsx
       <file contents>
       ```

       Then asked:
       <original message text, with @<path> tokens preserved>
5. Send the inflated text via AgentManager.send().
````

Tokens that fail to resolve (deleted file, outside workspace, binary, oversize) are kept in the prompt as plain `@<path> [unavailable: <reason>]` so the agent sees the user's intent and can ask clarifying questions or use its `read` tool.

#### [DES-SETTINGS] Settings tab content

The Settings tab pulls from typed bridge handlers and the runtime-agnostic `AgentManager` surface. Provider list is derived from `get_available_models` (group authenticated providers); Pi binary path comes from VSCode setting `afx.agentBinaryPath` (read-only here, edited via VSCode settings UI); bundled-skills info comes from extension state; stderr comes from `AgentManager.getStderr()`.

ASCII mockup:

```text
┌─ Tabs ─────────────────────────────────────────────────────────────┐
│  Chat    History    Settings                                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ENGINE                                                             │
│  ────────────────────────────────────────────────────────────────  │
│   Pi binary       /opt/homebrew/bin/pi   [ExternalLink] afx.agentBinaryPath │
│   Bundled skills  resources/skills/agenticflowx (17 skills)        │
│   Ephemeral mode  [ ]  off               [ExternalLink] afx.agentEphemeralSession │
│                                                                     │
│  PROVIDERS    (derived from getAvailableModels())                   │
│  ────────────────────────────────────────────────────────────────  │
│   [CircleCheck] Anthropic       3 models available                  │
│   [CircleCheck] OpenAI          5 models available                  │
│   [Info] Add a provider via Pi CLI: pi auth login <provider>       │
│                                                                     │
│  CHAT                                                               │
│  ────────────────────────────────────────────────────────────────  │
│   [Info] Switching the model from the chat composer updates Pi's   │
│   default for future CLI runs.                                      │
│                                                                     │
│  AVAILABLE SKILLS                  (FR-13.f; getCommands() + actions)│
│  ────────────────────────────────────────────────────────────────  │
│   AFX SKILLS · 17   (source: "skill", prefix "skill:afx-")          │
│    /afx-task        Pick, verify, code, complete tasks              │
│    /afx-next        Context-aware next action                       │
│    /afx-discover    Discover infra & capabilities                   │
│    …14 more  [v Show all]                                           │
│                                                                     │
│   ACTIONS · 2       (AFX-curated; chat bridge messages)             │
│    /new             New session         chat/newSession             │
│    /abort           Abort active run    chat/abort                  │
│                                                                     │
│  DIAGNOSTICS                                                        │
│  ────────────────────────────────────────────────────────────────  │
│   Log level       info        [ExternalLink] afx.logLevel          │
│   Pi stderr       [ View buffered stderr ]   (plain <pre>, 200 ln) │
│   Reset session   [ New session ]            chat/newSession       │
│                                                                     │
│  ABOUT                                                              │
│  ────────────────────────────────────────────────────────────────  │
│   AFX chat foundation   v0.1.0  (apps/vscode/package.json)          │
│   spec                 docs/specs/chat-foundation                  │
└────────────────────────────────────────────────────────────────────┘
```

Section sources:

| Section          | Source                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine           | `extensionContext.extensionUri` (skills path), VSCode `afx.agentBinaryPath`, `afx.agentEphemeralSession` (verified in `apps/vscode/package.json`)                                       |
| Providers        | Host bridge calls `manager.getAvailableModels()`; chat groups by `Model.provider`                                                                                                       |
| Chat (FR-10)     | Static disclosure copy                                                                                                                                                                  |
| Available Skills | Host bridge calls `manager.getCommands()`; chat filters/groups by `RpcSlashCommand.source`; AFX-prefixed names rewrite `skill:afx-*` → `/afx-*`; actions dispatch typed bridge messages |
| Diagnostics      | VSCode `afx.logLevel`, host bridge calls `manager.getStderr()`, existing `chat/newSession` bridge message                                                                               |
| About            | `apps/vscode/package.json` `version` + spec path constant                                                                                                                               |

#### [DES-IMPROVEMENTS] Considered improvements (Pi RPC unlocks, deferred from foundation FR scope)

These are realistic chat enhancements unlocked by RPC handlers Pi already exposes. None are foundation-FRs; the table is here so a follow-up sprint can promote one with a single source citation. Mockup placeholders are already laid out (e.g. `[🧠 high ▾]` button, `Compact` action, `📥 N` cell) so promotion is mostly wiring, not redesign.

| Improvement                                 | Pi RPC source(s)                                                              | Why deferred from foundation                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Thinking-level picker in composer           | `set_thinking_level`, `cycle_thinking_level`, `get_state.thinkingLevel`       | Mockup placeholder added; FR not in scope. Promote when users ask to control speed/cost.             |
| `Compact` action button (auto-shown ≥ 70%)  | `compact`, `get_session_stats.contextUsage.percent`, `get_state.isCompacting` | Mockup placeholder added; useful escape hatch but not foundation-critical.                           |
| Pending-queue indicator (`📥 N`)            | `get_state.pendingMessageCount`                                               | Mockup placeholder added; rare condition in the foundation.                                          |
| Tool-count badge in status                  | `get_session_stats.toolCalls`                                                 | Mockup placeholder added; trivial wire-up, low standalone value.                                     |
| Cache-hit indicator (`💾 N cached`)         | `tokens.cacheRead`, `tokens.cacheWrite`                                       | Per-message meta line shows it; promote if cost-savings visibility becomes a request.                |
| Session name + rename                       | `get_state.sessionName`, `set_session_name`                                   | Multi-session UX is post-foundation.                                                                 |
| New session button                          | `new_session` (already on `AgentManager`)                                     | Method exists; UI hook not part of foundation.                                                       |
| Export to HTML                              | `export_html`                                                                 | Power-user surface; defer until users ask.                                                           |
| Fork from message                           | `fork`, `get_fork_messages`                                                   | Multi-session UX, post-foundation.                                                                   |
| Session switcher                            | `switch_session`, `getSessions`                                               | Multi-session UX, post-foundation.                                                                   |
| Per-message usage drill-down                | `get_messages` (per-message usage)                                            | Already mocked as expandable meta; defer the explicit drill-down UI.                                 |
| Persistent inline error banner              | `agent_error` event                                                           | Currently appended as `⚠` message; promote if errors warrant a sticky banner.                        |
| Reconnect button when Pi is down            | `getStatus().running == false`                                                | Currently text-only ("engine not connected"); a button is a small follow-up.                         |
| Auto-compaction toggle in Settings          | `set_auto_compaction`, `get_state.autoCompactionEnabled`                      | Settings tab gains one toggle; defer until needed.                                                   |
| Auto-retry toggle in Settings               | `set_auto_retry`, `abort_retry`                                               | Settings tab gains one toggle; defer until needed.                                                   |
| Native UI bridge for `extension_ui_request` | `extension_ui_request` event surface (`select`/`confirm`/`input`/…)           | Adapter already normalizes the event; chat app handler is foundation-adjacent — TBD.                 |
| Cycle-model keyboard shortcut (⌘P)          | `cycle_model` (RPC, rpc-types.ts:32)                                          | One keystroke to rotate scoped models; useful with `--models` filter.                                |
| Cycle thinking-level shortcut               | `cycle_thinking_level` (RPC, rpc-types.ts:37)                                 | Pairs with the deferred thinking-level picker; one keystroke to bump high↔medium.                    |
| Steer / follow-up while streaming           | `steer`, `follow_up` (RPC, rpc-types.ts:22-23)                                | Lets users push corrections mid-response without aborting the run.                                   |
| Image-attached prompt                       | `prompt.images?: ImageContent[]` (RPC, rpc-types.ts:21)                       | Clipboard paste / drag-drop image into composer; chat layer encodes and forwards.                    |
| Steering / follow-up queue mode controls    | `set_steering_mode`, `set_follow_up_mode` (RPC, rpc-types.ts:40-41)           | Power-user behavior over how queued inputs are applied.                                              |
| AFX-curated `/actions` chat group           | `new_session` / `abort` bridge messages; `compact` deferred                   | Already in foundation Settings + slash popup; broader action set (e.g. `/compact`, `/export`) defer. |
| `setStatus`/`setWidget` host UI bridge      | Pi `extension_ui_request.setStatus` / `setWidget` (rpc-types.ts:235-246)      | Lets Pi extensions control VSCode status bar + editor widgets via the host.                          |
| Session import resume                       | `switch_session` (RPC, rpc-types.ts:58)                                       | "Resume previous chat" entry in History tab once multi-session lands.                                |

Global UI tokens (Tailwind 4, Meridian theme, Lucide icons, Shadcn primitives) come from project `CLAUDE.md` / `AGENTS.md`. This sprint adds no new design tokens.

### [DES-DEC] Key Decisions

| Decision                              | Options Considered                                                                                                                           | Choice                                                                   | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill delivery mechanism              | A1 spawn-flag (`--skill`); A2 materialize-on-activate to a workspace dir Pi auto-scans; A3 rely on user-authored workspace `.agents/skills/` | **A1**                                                                   | Verified at `pi-mono/src/cli/args.ts:132-134`, `core/skills.ts:168-199`, `modes/rpc/rpc-mode.ts:634-639`. Repeatable, recursive, RPC-compatible, no fs writes. A3 fails the first-run UX requirement.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Where slash-prefix rewrite lives      | (a) chat app rewrites; (b) bridge layer rewrites; (c) Pi runtime adapter rewrites                                                            | **(c) — Pi runtime adapter**                                             | Architecture rule from `res-afx-product-boundary.md`: runtime specifics live in `packages/agent/<runtime>/`. (a) and (b) couple the chat app to Pi; (c) keeps it portable.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `AgentStatus.model` shape             | (i) keep `string`; (ii) add separate `getModel()`; (iii) expand to `{provider, id, name?}`                                                   | **(iii)**                                                                | `getStatus()` already calls `get_state` and gets the full object. Single call site, more useful payload. (ii) adds a redundant round-trip per render.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Tab cleanup approach                  | (x) drop Explorer + shrink to 3 tabs (Chat, History, Settings); (y) drop Explorer + add Skills tab; (z) collapse to 2 (Chat, Settings)       | **(x) — drop Explorer; keep History; merge skill listing into Settings** | Slash popup is already the primary discovery surface. A dedicated Skills tab duplicates the same data; moving the static listing into Settings → Available Skills keeps it scannable without burning a top-level slot. History stays — already wired and useful for reviewing past turns. UI redesign rounds will revisit tabs holistically.                                                                                                                                                                                                                                                                                  |
| Bundle source path inside the VSIX    | (m) `apps/vscode/resources/skills/`; (n) `apps/vscode/assets/skills/`; (o) `packages/skills-bundle/` (new package)                           | **(m) — `apps/vscode/resources/skills/`**                                | Convention name matches VSCode-extension idioms. Keeps the bundle scoped to the host app, no new package to maintain. Confirm against `apps/vscode/package.json` `files` array during build.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Workspace vs bundled skill precedence | Pass bundled first (overrides workspace) vs workspace first (bundled fallback)                                                               | **Workspace first, bundled second**                                      | Respects the user's authored content. Pi's auto-discovery already passes workspace skills; we append `--skill <bundle>` after, so on name collision Pi keeps the first (workspace).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `@` mention file-list source          | (a) VSCode `workspace.findFiles` host-side; (b) Pi `bash`/`find` over RPC                                                                    | **(a) — host-side**                                                      | Already runs in the VSCode host; no extra Pi round-trip per keystroke; respects `.vscodeignore` and editor-known files; offline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `@` mention expansion location        | (i) chat-app expands client-side; (ii) host-side at the bridge boundary before `AgentManager.send()`; (iii) Pi tool call to fetch            | **(ii) — host-side at bridge**                                           | Webview cannot read the filesystem. Doing it in `sidebar-panel.ts` keeps the chat app pure and avoids spawning a Pi `bash` per submit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Composer toolbar scope                | (1) keep `+` and `📎` as future placeholders; (2) drop the unused buttons now                                                                | **(2) — drop now**                                                       | Placeholder buttons that do nothing read as broken UI. Mockups for promoted-from-`[DES-IMPROVEMENTS]` controls are kept in those rows; the foundation toolbar shows only what works.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Settings provider-list source         | (p) new `getProviders()` RPC; (q) derive from `get_available_models()` grouped by `provider`                                                 | **(q) — derive from existing handler**                                   | Pi has no "list providers regardless of auth" RPC. Showing only providers with at least one available model is honest and requires no contract growth.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Skill bundling — vendor vs generated  | Vendor committed skills via `pnpm sync:skills`; build-time generated skills (.gitignored)                                                    | **Vendor committed skills**                                              | Extension builds standalone; reviewer sees skill changes inline; CI drift check is `pnpm sync:skills && git diff --quiet`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Skill sync mechanism                  | Direct `afx-cli --skills-only` into `apps/vscode/resources/`; manual copy; curl-pipe + prune helper script                                   | **curl-pipe + prune**                                                    | Use AFX's canonical install pattern (`curl -sL .../afx-cli \| bash -s -- <args>`) with `--skills-only --target <tmpdir>` so AFX never depends on an unpublished CLI binary or extra checkout. Verified by dry-run that `afx-cli --skills-only` writes 3 mirrors (`.afx/`, `.agents/`, `.claude/`) plus `.afx.yaml` and `.afx/.cache/` — built for live AFX projects, not VSIX bundling. The selected path shells the curl-pipe to a temp dir, keeps only `agenticflowx/` (with `assets/`), drops the rest, copies into `apps/vscode/resources/skills/agenticflowx/`. Works standalone; same script in CI for drift detection. |

### [DES-DATA] Data Model

#### TypeScript Interfaces (new + expanded)

```typescript
// packages/shared/src/agent.ts — additions

// Mirrors Pi `Model<TApi>` (pi-mono/packages/ai/src/types.ts:426). Required-ness matches Pi
// so adapters can re-shape directly. AFX contract is runtime-agnostic; a non-Pi adapter that
// reports a thinner shape still has to satisfy `name`, `provider`, and `id`.
export interface AgentModel {
  provider: string; // Pi `Model.provider`
  id: string; // stable selection key, Pi `Model.id`
  name: string; // friendly label, Pi `Model.name` (always present)
  reasoning: boolean; // Pi `Model.reasoning`
  contextWindow: number; // Pi `Model.contextWindow`
  maxTokens: number; // Pi `Model.maxTokens`
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number }; // optional in AFX
}

// Mirrors Pi `RpcSlashCommand.source` exactly (pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts:82).
// `"builtin"` is intentionally absent — Pi's TUI built-ins (/quit, /login, /settings, …) are NOT in
// `get_commands` and the chat does not expose them.
export interface AgentCommand {
  name: string; // e.g. "skill:afx-task" (skill), "git" (extension), "summarize" (prompt)
  description?: string;
  source: "extension" | "prompt" | "skill";
}

// AFX-curated quick actions are NOT remote slash commands — React dispatches typed bridge
// messages instead of calling AgentManager directly. They render alongside `AgentCommand`s in the
// slash popup and Settings → Available Skills under a separate "ACTIONS" group.
export interface AgentAction {
  name: "new" | "abort";
  label: string;
  description: string;
  chatMessage: "chat/newSession" | "chat/abort";
}

// AgentStatus.model expansion (BREAKING change to AgentStatus shape)
export interface AgentStatus {
  running: boolean;
  isStreaming: boolean;
  model?: { provider: string; id: string; name: string }; // was: string | undefined; `name` matches Pi `Model.name` required-ness
}

// AgentManager additions — runtime-agnostic. Every adapter implements
// these. `getStderr()` returns the recent diagnostic stream for process runtimes; non-process
// runtimes may return an empty string.
export interface AgentManager {
  // existing methods unchanged …
  getAvailableModels(): Promise<AgentModel[]>;
  setModel(target: { provider: string; modelId: string }): Promise<AgentModel>;
  getCommands(): Promise<AgentCommand[]>;
  getStderr(): string;
}
```

#### PiRpcManagerOptions extension

```typescript
// packages/agent/pi/src/rpc-manager.ts
export interface PiRpcManagerOptions {
  // existing fields unchanged …
  additionalSkillPaths?: readonly string[]; // new — appended as --skill <p> entries
}
```

### [DES-API] API Contracts

#### Chat ↔ Agent message protocol additions

```typescript
// packages/shared/src/messages.ts — existing ChatToAgent change
| { type: "chat/send"; requestId: string; content: string; mentions?: string[] }

// packages/shared/src/messages.ts — new ChatToAgent variants
| { type: "chat/getModels"; requestId: string }
| { type: "chat/setModel"; requestId: string; provider: string; modelId: string }
| { type: "chat/getCommands"; requestId: string }
| { type: "chat/listFiles"; requestId: string; query?: string; limit?: number }
| { type: "chat/getSettingsSnapshot"; requestId: string }
| { type: "chat/getStderr"; requestId: string; maxLines?: number }
| { type: "chat/openSettings"; requestId: string; key: "afx.agentBinaryPath" | "afx.agentEphemeralSession" | "afx.logLevel" }

// packages/shared/src/messages.ts — new AgentToChat variants
| { type: "agent/models"; requestId: string; models: AgentModel[] }
| { type: "agent/modelChanged"; model: AgentModel }
| { type: "agent/commands"; requestId: string; commands: AgentCommand[] }
| { type: "agent/files"; requestId: string; files: Array<{ path: string; recent?: boolean }> }
| { type: "agent/settingsSnapshot"; requestId: string; snapshot: SettingsSnapshot }
| { type: "agent/stderr"; requestId: string; content: string; truncated?: boolean }
| { type: "agent/error"; requestId?: string; message: string } // existing? confirm during build

// New shared type powering the Settings tab snapshot (FR-13).
export interface SettingsSnapshot {
  engine: { piBinary: string; bundledSkillsPath: string; bundledSkillCount: number; ephemeral: boolean };
  providers: Array<{ name: string; modelCount: number }>;
  diagnostics: { logLevel: string };
  about: { extensionVersion: string; specPath: string };
}

// chat/piStatus already carries model — payload shape changes from `model?: string`
// to `model?: { provider, id, name? }` consistent with AgentStatus.model.
```

The chat app sends `chat/getModels` on tab focus and on `agent_start` events. The popover renders from cached state until next refresh.

#### Pi RPC handlers consumed (no changes to Pi)

- `get_available_models` — `rpc-mode.ts:462`
- `set_model` — `rpc-mode.ts:444`
- `get_state` — `rpc-mode.ts:422` (model object source)
- `get_commands` — `rpc-mode.ts:613-643`

### [DES-FILES] File Structure

| File                                                           | Purpose                                                                                                                                                                                                                                                                                                                                                                               | Change    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `apps/vscode/resources/skills/agenticflowx/**`                 | Vendored — committed to extension repo; produced by `pnpm sync:skills`. Includes per-skill `assets/` (templates).                                                                                                                                                                                                                                                                     | NEW       |
| `apps/vscode/scripts/sync-skills.mjs`                          | New — shells `curl -sL https://raw.githubusercontent.com/AgenticFlowX/afx/${AFX_REF}/afx-cli \| bash -s -- --skills-only --target <tmp> --yes` (the canonical AFX install form) to a tmp dir, keeps only `.afx/skills/agenticflowx/` (with `assets/`), copies to `resources/skills/agenticflowx/`. Idempotent; drops `starter/`, `.agents/`, `.claude/`, `.afx.yaml`, `.afx/.cache/`. | NEW       |
| `apps/vscode/package.json`                                     | Add `scripts.sync:skills` → `node ./scripts/sync-skills.mjs`. Confirm `resources/skills/**` is included in the VSIX (no `.vscodeignore` exclusion).                                                                                                                                                                                                                                   | EDIT      |
| `apps/vscode/src/agent-factory.ts`                             | Resolve `extensionPath/resources/skills/agenticflowx`; pass via `additionalSkillPaths`                                                                                                                                                                                                                                                                                                | EDIT      |
| `packages/agent/pi/src/rpc-manager.ts`                         | Accept `additionalSkillPaths`; thread to client args; implement `getAvailableModels`/`setModel`/`getCommands`/`getStderr`; rewrite `/afx-*` in `send()`; expand `getStatus().model` shape                                                                                                                                                                                             | EDIT      |
| `packages/agent/pi/src/rpc-client.ts`                          | (Likely no change — `args` already accepts extras)                                                                                                                                                                                                                                                                                                                                    | NONE/EDIT |
| `packages/shared/src/agent.ts`                                 | Add `AgentModel`, `AgentCommand`; expand `AgentStatus.model`; add four methods to `AgentManager`                                                                                                                                                                                                                                                                                      | EDIT      |
| `packages/shared/src/messages.ts`                              | Add model/command/settings/stderr/open-settings messages; update `chat/send` with `mentions?: string[]`                                                                                                                                                                                                                                                                               | EDIT      |
| `apps/vscode/src/panels/sidebar-panel.ts`                      | Wire new bridge handlers to `AgentManager` methods; validate/read mention paths before `manager.send()`                                                                                                                                                                                                                                                                               | EDIT      |
| `apps/chat/src/app.tsx`                                        | Drop Explorer from `TABS`; final tabs `[Chat, History, Settings]`. No Skills tab. Own controlled tab state + command insertion handoff from Settings to Chat.                                                                                                                                                                                                                         | EDIT      |
| `apps/chat/src/views/explorer.tsx`                             | Delete                                                                                                                                                                                                                                                                                                                                                                                | DELETE    |
| `apps/chat/src/views/chat.tsx`                                 | Drop unwired toolbar buttons (`+`, `📎`); replace stub model button with real combobox; add slash popup + `@` mention popup; consume new bridge events                                                                                                                                                                                                                                | EDIT      |
| `apps/chat/src/components/model-combobox.tsx`                  | New — provider-grouped combobox built from `@afx/ui/components/combobox`                                                                                                                                                                                                                                                                                                              | NEW       |
| `apps/chat/src/components/slash-popup.tsx`                     | New — `/`-trigger picker built from `@afx/ui` `Popover` + `Command` primitives                                                                                                                                                                                                                                                                                                        | NEW       |
| `apps/chat/src/components/mention-popup.tsx`                   | New — `@`-trigger workspace file picker built from `@afx/ui` `Popover` + `Command` primitives (recently-opened + workspace list)                                                                                                                                                                                                                                                      | NEW       |
| `apps/chat/src/lib/mentions.ts`                                | New — pure tokenizer for `@<path>` extraction (used by composer + tests)                                                                                                                                                                                                                                                                                                              | NEW       |
| `apps/chat/src/views/settings.tsx`                             | Replace placeholder with Engine / Providers / Chat / **Available Skills** / Diagnostics / About sections per FR-13                                                                                                                                                                                                                                                                    | EDIT      |
| `packages/shared/src/messages.ts`                              | Adds `chat/listFiles`, `agent/files`, `chat/getSettingsSnapshot`, `agent/settingsSnapshot`, `chat/getStderr`, `agent/stderr`, `chat/openSettings` (in addition to model/command messages)                                                                                                                                                                                             | EDIT      |
| `packages/agent/pi/src/rpc-manager.test.ts` (or new test file) | Unit-test `/afx-*` → `/skill:afx-*` prefix rewrite                                                                                                                                                                                                                                                                                                                                    | NEW       |
| `apps/chat/src/lib/mentions.test.ts`                           | Unit-test `@<path>` tokenizer (boundary cases, email-style false positives, escape rules)                                                                                                                                                                                                                                                                                             | NEW       |
| `apps/chat/src/lib/composer-detect.ts` (+ `.test.ts`)          | Pure helpers — detect `@`/`/` triggers from textarea state; isolated for unit testing                                                                                                                                                                                                                                                                                                 | NEW       |
| `apps/chat/src/lib/settings-snapshot.ts` (+ `.test.ts`)        | Pure composer for `SettingsSnapshot` payload — host-side helper that takes raw inputs and returns the typed shape                                                                                                                                                                                                                                                                     | NEW       |
| `apps/chat/src/components/model-combobox.test.tsx`             | Component test — render with `createMockTransport` "modelsLoaded" scenario; assert keyboard nav + `chat/setModel` dispatch                                                                                                                                                                                                                                                            | NEW       |
| `apps/chat/src/components/slash-popup.test.tsx`                | Component test — populated/empty states; AFX rewriting (`skill:afx-*` → `/afx-*`); inserts on Enter                                                                                                                                                                                                                                                                                   | NEW       |
| `apps/chat/src/components/mention-popup.test.tsx`              | Component test — workspace + recent groups; selection inserts `@<path>`; close on Esc                                                                                                                                                                                                                                                                                                 | NEW       |
| `apps/chat/src/views/settings.test.tsx`                        | Component test — Available Skills section renders five groups (or empty groups gracefully); AFX rewrite (`skill:afx-*` → `/afx-*`); ACTIONS row click dispatches `chat/newSession` / `chat/abort` bridge messages                                                                                                                                                                     | NEW       |
| `apps/chat/src/views/settings.test.tsx`                        | Component test — Engine/Providers/Chat/Diagnostics/About against `settingsSnapshotLoaded` mock scenario                                                                                                                                                                                                                                                                               | NEW       |
| `apps/chat/src/test-utils/mock-agent-manager.ts`               | New — `createMockAgentManager()` factory returning a fully-typed `AgentManager` with vitest spies                                                                                                                                                                                                                                                                                     | NEW       |
| `packages/transport/src/scenarios/`                            | Add scenarios: `modelsLoaded`, `modelsEmpty`, `commandsLoaded`, `filesListed`, `stderrLoaded`, `settingsSnapshotLoaded` — each a tiny canned conversation                                                                                                                                                                                                                             | EDIT      |
| `apps/chat/e2e/chat.spec.ts`                                   | NO CHANGES in foundation (e2e deferred per [DES-TEST]); existing baseline stays valid                                                                                                                                                                                                                                                                                                 | NONE      |

### [DES-DEPS] Dependencies

- No new runtime dependencies. All flows use existing Pi RPC handlers and shared transport.
- Vendoring dependency: `pnpm sync:skills` requires network access to `https://raw.githubusercontent.com/AgenticFlowX/afx/<ref>/afx-cli` plus a working `bash` and `curl` on PATH (standard on macOS/Linux runners; Windows runners use `git-bash` or WSL — out of foundation scope). The pinned `<ref>` (default `main`, override via `AFX_REF` env var) is read from a top-of-script constant.
- The script invokes the canonical AFX install pipe `curl -sL https://.../afx-cli | bash -s -- --skills-only --target <tmpdir> --yes` against the pinned `<ref>` — same pattern users invoke for `./afx-cli` installs, with sync-specific args. After the pipe finishes, `cp -R <tmp>/.afx/skills/agenticflowx/` (which contains each skill's `SKILL.md` and `assets/`) to `apps/vscode/resources/skills/agenticflowx/`. Tmp dir is cleaned in a `finally` block.
- CI dependency: `.github/workflows/code-qa.yml` adds a `skills-drift` job that runs `pnpm sync:skills` then `git diff --quiet apps/vscode/resources/skills` against the same pinned `<ref>`. Fails on drift; passes when vendored content matches upstream.

### [DES-SEC] Security Considerations

- **Bundled skills are trusted code we ship.** Treat them with the same trust as the extension code itself. CI must include them in any code-review process.
- **Workspace-discovered skills are user content.** Pi already documents this risk; AFX inherits it. No new attack surface introduced by this sprint.
- **`set_model` mutates Pi default** (documented). User-visible disclosure required (FR-10).

### [DES-ERR] Error Handling

| Scenario                                             | Handling                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Bundle directory missing on activate                 | Log a warning; spawn Pi without the `--skill` flag. Do not block extension activation.      |
| `get_available_models` returns empty                 | Combobox shows empty-state copy + link to Settings. Do not block typing in the composer.    |
| `set_model` rejects (unauth provider, unknown model) | Surface the Pi error message in a transient toast/inline notice; revert combobox selection. |
| `get_commands` rejects                               | Settings → Available Skills shows empty-state copy; slash popup falls back to ACTIONS only. |
| Pi process not running when chat sends a control msg | Existing `_transport not initialised` warning path applies; no new behavior needed.         |

### [DES-TEST] Testing Strategy

> Foundation testing is fast, unit-and-component only. **No Playwright e2e changes.** The user prefers fast iteration and a real-extension smoke pass over expensive UI e2e — but every component must remain easily testable later. Extra rules in [DES-TESTABILITY] enforce this.

- **Unit (vitest, packages/agent/pi)**: prefix rewrite — `/afx-task code T-001` → `/skill:afx-task code T-001`, `/afx-` mid-string is NOT rewritten, leading whitespace tolerance, `/skill:` already present is unchanged, plain text passes through.
- **Unit (vitest, packages/shared)**: `AgentStatus.model` type check; message-protocol round-trip for new variants; `AgentCommand.source` enum exhaustiveness vs Pi `RpcSlashCommand.source`.
- **Unit (vitest, apps/chat/src/lib)**: `mentions.ts` tokenizer (boundary cases, email-style false positives, escape rules); `composer-detect.ts` for `@`/`/` trigger detection if extracted; settings-snapshot composer.
- **Component (vitest + @testing-library/react, apps/chat/src/components)**: `<ModelCombobox>`, `<SlashPopup>`, `<MentionPopup>`, settings-tab sections — render against `createMockTransport` from `@afx/transport` with named scenarios; assert keyboard nav (Tab / Esc / Enter) and event dispatch (`chat/setModel`, `chat/listFiles`, etc.). No real Pi spawn.
- **Integration (apps/vscode build)**: `pnpm --filter "./apps/vscode" build` succeeds and produces VSIX with `resources/skills/agenticflowx/SKILL.md` files.
- **Manual smoke (F5)**: open chat → three tabs (Chat, History, Settings); type `/` in composer → slash popup populated with `skill:afx-*` + ACTIONS; open Settings → Available Skills → same listing visible; switch model in combobox → status bar reflects; type `Refactor @<file>` → host expansion produces fenced block in the prompt.
- **No e2e changes for foundation.** The existing `apps/chat/e2e/chat.spec.ts` stays as-is. New e2e selectors for Settings sections / combobox / mention popup are deferred. Component tests give us regression coverage of the new surfaces.

### [DES-TESTABILITY] Testability rules (since e2e is dropped from foundation)

Each rule is enforced at PR time by a grep or a test-coverage gate. The intent: **every new UI surface must be unit-and-component testable without spawning Pi or VSCode.**

1. **Pure helpers in `apps/chat/src/lib/`**: tokenizer, command-rewrite detection, settings-snapshot rendering, slash-trigger detection — all pure functions with zero React imports. Their tests are vitest only, no DOM.
2. **Components consume `Transport` via injection.** No component imports `bridgeSend`/`bridgeOn` from a module-level singleton in tests. Composer/popups accept either a `Transport` prop or read from a React context that the test wraps with `createMockTransport()`.
3. **`@afx/transport` mock scenarios.** Every new bridge message gains at least one `MockTransport` scenario in `packages/transport/src/scenarios/` so component tests can pick a scenario by name (`mock.scenarios.skillsLoaded`, `mock.scenarios.emptyModels`, etc.).
4. **No mocking of `vscode` API in chat tests.** Chat-app component tests run in jsdom; the `vscode` module never reaches the webview by design. Host-side handlers (in `apps/vscode/src/panels/sidebar-panel.ts`) get their own vitest suite that mocks the `vscode` namespace via `vi.mock("vscode", ...)`.
5. **One file = one default export = one test file.** Each new component (`model-combobox.tsx`, `slash-popup.tsx`, `mention-popup.tsx`, `views/settings.tsx`) ships with a sibling `*.test.tsx`. Coverage is enforced at the file level (no rule yet, but PR-review checklist).
6. **Snapshot tests OFF by default.** Render assertions check semantic structure (roles, accessible names, data attributes) — not pixel diffs. Easier to maintain during fast iteration.
7. **Stable test IDs.** Where ARIA roles are insufficient, components add `data-testid="afx-<area>-<element>"` (e.g. `afx-composer-model-button`, `afx-slash-popup-row`). The test id namespace is small and documented in [DES-FILES].
8. **`createMockAgentManager()` factory.** New helper in `packages/shared/src/testing/` (or `apps/chat/src/test-utils/`) returns a fully-typed `AgentManager` whose methods are vitest spies. Used by host-handler tests and any component that needs to assert manager calls without going through the bridge.

### [DES-ROLLOUT] Migration / Rollout Plan

- No data migration. No persisted state schema change.
- `AgentStatus.model` shape change is the one breaking type-level change; all consumers (only the chat panel today) update in lockstep.
- `apps/chat/src/views/explorer.tsx` deletion is irreversible without git revert; that's fine — no production users yet.
- Roll forward: bump `apps/vscode/package.json` version, ship VSIX with bundled skills, panels render new tabs.
- Rollback: revert the chat-foundation merge commit. Pi process keeps working; older AFX skill commands not loaded but the rest of the chat is fine.

### Open Technical Questions

| #   | Question                                                                                                                                 | Status                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does `apps/vscode/package.json` already have a `files` allowlist or `.vscodeignore` that needs updating to include `resources/`?         | Resolved — current `apps/vscode/.vscodeignore` excludes `.turbo/`, `src/`, `tsconfig.json`, `esbuild.mjs`, `node_modules/`, `.vscode/`, `**/*.map`. **No `resources/` exclusion**, so `apps/vscode/resources/skills/**` ships in the VSIX by default. No config change required.                                                                                    |
| 2   | Should the build-time skill copy be a pnpm hook in `apps/vscode/package.json`, a Turbo task, or a one-line script in the bundler?        | Resolved — `pnpm sync:skills` (manual + CI), not build-step. See [DES-DEC] "Skill sync mechanism".                                                                                                                                                                                                                                                                  |
| 3   | Is there an existing `getCommands`-shaped event on the bridge that we can extend, or do we add a new pair?                               | Resolved — `packages/shared/src/messages.ts:60-146` shows current `ChatToAgent` is `chat/ready`/`chat/send`/`chat/abort`/`chat/newSession`/`chat/getState`. No request/response pair pattern exists yet. Add the new pairs (`chat/getModels`+`agent/models`, etc.) per [DES-API]; reuse the established `requestId` field for correlation.                          |
| 4   | What happens to the model picker's selection state when Pi compacts mid-session (`isCompacting === true`)?                               | Resolved — disable the combobox while `isCompacting === true`. Show an `[Info]` tooltip "Wait for compaction to finish" on hover. Pi's `set_model` may reject mid-compaction anyway; queueing the change is more complexity than benefit for foundation. Re-enable when next `chat/piStatus` event reports `isCompacting=false`.                                    |
| 5   | Sidebar-panel.ts is the only host-side bridge handler today — are there constraints around throughput / per-request IDs?                 | Resolved — verified at `apps/vscode/src/panels/sidebar-panel.ts` (691 lines, single `webview.onDidReceiveMessage` at line 624). `state.currentRequestId` tracks only the in-flight `chat/send`. New request/response pairs (`chat/getModels`, `chat/listFiles`, etc.) carry their own `requestId` and run independently of the send pipeline. No global throttling. |
| 6   | For `@` mention listing, what's the right `workspace.findFiles` glob — `**/*` minus `.vscodeignore`, or a tighter pattern?               | Resolved — `vscode.workspace.findFiles("**/*", undefined, 200)`. Passing `undefined` for `exclude` uses the default `files.exclude` setting + `.gitignore` patterns. 200-result cap (popup search filters by query; virtualization is post-foundation).                                                                                                             |
| 7   | Where does the host stash the `@` mention "Recently opened" list — VSCode `workspaceState`, in-memory MRU, or `vscode.window.tabGroups`? | Resolved — `vscode.window.tabGroups.all.flatMap(g => g.tabs)` for the "Open Files" group (currently open tabs). No persistent MRU in foundation; the list reflects what the user is actively working on, not historical opens. A workspace-state-backed MRU is post-foundation.                                                                                     |
| 8   | Pi stderr buffer: render as plain `<pre>` or wrap with the existing `MarkdownMessage` component? Length cap?                             | Resolved — plain `<pre>` with monospace, 200-line cap (truncate from the head with a "…<N> earlier lines hidden" marker so the user sees the most recent output), Copy-to-clipboard button. Markdown rendering would mangle stack traces and ANSI escape sequences.                                                                                                 |

<!-- SPRINT-SECTION-END: DESIGN -->

---

<!-- SPRINT-SECTION-START: TASKS (maps to tasks.md on graduation; promote ### → ##, #### → ###) -->

## 3. Tasks

> The WHEN — hierarchical implementation checklist. Mirrors `afx-task/assets/tasks-template.md`. Every task group references the FR/DES it implements via an `@see` comment using the full project-relative sprint brief path while sprint mode is active.

### Task Numbering Convention

- **1.x** — Phase 1: Skill bundling (A) — must come first; validates end-to-end
- **2.x** — Phase 2: AgentManager contract extension (shared baseline for C/D/B)
- **3.x** — Phase 3: Slash-command foundation (D) — depends on 2.x
- **4.x** — Phase 4: Model selector (C) — depends on 2.x
- **5.x** — Phase 5: Tab cleanup (drop Explorer; final tabs Chat/History/Settings) — independent
- **6.x** — Phase 6: Composer cleanup + `@` mention — depends on 4.x (composer rework site)
- **7.x** — Phase 7: Settings tab content — depends on 2.x
- **8.x** — Phase 8: Testability harness + abstraction guards — independent; can land first or last

References use Node IDs: `[FR-X]`, `[NFR-X]` (Spec section), `[DES-X]` (Design section), `[X.Y]` (this Tasks section).

### Phase 1: Skill bundling (`--skill` flag)

> Ref: [FR-1], [FR-2], [FR-3], [DES-DEC] (decision A1), [DES-FILES]

#### 1.1 Vendor the agenticflowx skill pack via `pnpm sync:skills`

<!-- files: apps/vscode/scripts/sync-skills.mjs (NEW), apps/vscode/package.json, apps/vscode/resources/skills/agenticflowx/** (NEW, vendored), .github/workflows/code-qa.yml -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-1] [FR-3] [NFR-3] [NFR-5] [DES-DEC] [DES-FILES] [DES-DEPS] -->

- [x] Add `apps/vscode/scripts/sync-skills.mjs`: top-of-file `AFX_REF` constant (default `"main"`, override via `process.env.AFX_REF`); create one tmp dir for the `--target`; shell out to the canonical AFX install pipe (`bash -c 'curl -fsSL https://raw.githubusercontent.com/AgenticFlowX/afx/'"$AFX_REF"'/afx-cli | bash -s -- --skills-only --target '"$TMP"' --yes'`); verify `<tmp>/.afx/skills/agenticflowx/` exists (fail fast otherwise — likely network/ref problem); `rm -rf apps/vscode/resources/skills/agenticflowx`; `cp -R <tmp>/.afx/skills/agenticflowx apps/vscode/resources/skills/agenticflowx`; remove the tmp dir on success and on error (try/finally).
- [x] Validate post-conditions: `apps/vscode/resources/skills/agenticflowx/<skill>/SKILL.md` present for the canonical pack; per-skill `assets/` carried over (verify against `afx-spec`, `afx-design`, `afx-task`, `afx-research`, `afx-sprint`, `afx-session`, `afx-adr` — those have `assets/`); no `starter/`, `.agents/`, `.claude/`, `.afx.yaml`, `.afx/.cache/` artifacts left in `resources/`.
- [x] Add `"sync:skills": "node ./scripts/sync-skills.mjs"` to `apps/vscode/package.json` `scripts`.
- [x] Confirm `apps/vscode/package.json` `files` (or `.vscodeignore`) ships `resources/skills/**` — resolves Open Q-1.
- [x] Run `pnpm --filter "./apps/vscode" sync:skills` once; commit the resulting `apps/vscode/resources/skills/agenticflowx/` tree.
- [x] Add a `skills-drift` job to `.github/workflows/code-qa.yml`: checkout, `pnpm install`, `pnpm --filter "./apps/vscode" sync:skills`, `git diff --quiet apps/vscode/resources/skills` (fails if upstream drifted from vendored copy).
- [x] Run `pnpm --filter "./apps/vscode" build` and confirm VSIX output contains `resources/skills/agenticflowx/<skill>/SKILL.md`.

#### 1.2 Adapter wiring — accept and apply `additionalSkillPaths`

<!-- files: packages/agent/pi/src/rpc-manager.ts, packages/agent/pi/src/rpc-client.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-2] [NFR-2] [DES-DATA] [DES-DEC] -->

- [x] Add `additionalSkillPaths?: readonly string[]` to `PiRpcManagerOptions`.
- [x] In `createAgentManager`, fold paths into `args` as repeated `["--skill", <p>]` entries, appended after the existing `--no-session` (if any).
- [x] Decide ordering: append after Pi's auto-discovery so workspace skills win on name collision (DES-DEC; resolves Open Q-4).
- [x] No change to `rpc-client.ts` expected — confirm `args` plumbing already works.

#### 1.3 Extension factory wiring

<!-- files: apps/vscode/src/agent-factory.ts, apps/vscode/src/extension.ts (read-only check) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-2] [DES-ARCH] [DES-ERR] -->

- [x] Resolve bundled skills path from `extensionContext.extensionUri` (e.g. `Uri.joinPath(uri, "resources/skills/agenticflowx").fsPath`).
- [x] Pass via `AgentFactoryOptions` → `PiRpcManagerOptions.additionalSkillPaths`.
- [x] Handle missing-bundle gracefully (warn + skip, per DES-ERR).

#### 1.4 End-to-end verification

<!-- files: (manual) apps/vscode -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-3] [DES-TEST] -->

- [ ] F5 launch; in chat panel, send a debug message that triggers `get_commands` (or temporarily wire an inspect button).
- [ ] Confirm `skill:afx-task`, `skill:afx-next`, `skill:afx-spec`, `skill:afx-design`, `skill:afx-research`, etc. appear in the response.
- [ ] If any skill is missing, check `pi --mode rpc` stderr for SKILL.md validation warnings.

### Phase 2: AgentManager contract extension

> Ref: [FR-4], [FR-5], [DES-DATA], [DES-API], [NFR-1]

#### 2.1 Shared types + interface

<!-- files: packages/shared/src/agent.ts, packages/shared/src/messages.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-4] [FR-5] [DES-DATA] -->

- [x] Add `AgentModel` interface.
- [x] Add `AgentCommand` interface.
- [x] Expand `AgentStatus.model` from `string | undefined` to the structured shape; update all call sites that consumed it as a string.
- [x] Add `getAvailableModels`, `setModel`, `getCommands`, `getStderr` methods to `AgentManager`.
- [x] Add `chat/getModels`, `chat/setModel`, `chat/getCommands`, `chat/getStderr`, `chat/openSettings`, `agent/models`, `agent/modelChanged`, `agent/commands`, `agent/stderr` to message protocol.
- [x] Update existing `chat/send` payload with optional `mentions?: string[]`.
- [x] Update existing `chat/piStatus` payload's `model` field to the structured shape.

#### 2.2 Pi adapter implementation

<!-- files: packages/agent/pi/src/rpc-manager.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-4] [FR-5] [DES-API] -->

- [x] Implement `getAvailableModels()` calling `c.request({ type: "get_available_models" })` and shaping into `AgentModel[]`.
- [x] Implement `setModel({provider, modelId})` calling `c.request({ type: "set_model", provider, modelId })`; return the resolved model.
- [x] Implement `getCommands()` calling `c.request({ type: "get_commands" })`; map to `AgentCommand[]` while preserving Pi's `source` enum (`extension` / `prompt` / `skill`) exactly.
- [x] Implement `getStderr()` by returning `rpcClient?.getStderr() ?? ""` without starting Pi solely for diagnostics.
- [x] Update `getStatus()` to return `model: {provider, id, name?}` (was `name ?? id ?? provider`).

#### 2.3 Host bridge handlers

<!-- files: apps/vscode/src/panels/sidebar-panel.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-4] [DES-API] -->

- [x] Wire `chat/getModels` → `manager.getAvailableModels()` → `agent/models` reply.
- [x] Wire `chat/setModel` → `manager.setModel()` → `agent/modelChanged` broadcast + status refresh.
- [x] Wire `chat/getCommands` → `manager.getCommands()` → `agent/commands` reply.
- [x] Wire `chat/getStderr` → `manager.getStderr()` → `agent/stderr` reply with optional 200-line truncation.
- [x] Wire `chat/openSettings` → `vscode.commands.executeCommand("workbench.action.openSettings", key)`.
- [x] Update existing `chat/piStatus` payload composer to use new `model` shape.

#### 2.4 Type-check + smoke tests

<!-- files: (vitest run) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [DES-TEST] -->

- [x] `pnpm check:types` clean.
- [x] Add a vitest case for the new manager methods (returns shape; no Pi-specific knowledge in shared tests).

### Phase 3: Slash-command foundation

> Ref: [FR-7], [FR-8], [DES-DEC] (rewrite location), [DES-UI]

#### 3.1 Adapter rewrite — `/afx-*` → `/skill:afx-*`

<!-- files: packages/agent/pi/src/rpc-manager.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-8] [NFR-1] [NFR-4] [DES-DEC] -->

- [x] In `send(message)`, before issuing `prompt`, apply prefix rewrite: `^\s*/afx-` → leading whitespace + `/skill:afx-`.
- [x] Confirm: leading whitespace tolerated; `/afx-` mid-string ignored; `/skill:` already present unchanged; plain text untouched.

#### 3.2 Adapter rewrite — unit tests

<!-- files: packages/agent/pi/src/rpc-manager.test.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-8] [DES-TEST] -->

- [x] Cases: bare `/afx-task`, `/afx-task code T-001`, leading whitespace, mid-string `/afx-`, plain prompt, already-prefixed `/skill:afx-task`.
- [x] Assert the request payload Pi receives has the expected `message`.

#### 3.3 Composer slash popup

<!-- files: apps/chat/src/components/slash-popup.tsx (NEW), apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-7] [NFR-6] [DES-UI] [DES-API] -->

- [x] New `<SlashPopup>` component: receives `commands: AgentCommand[]`, controlled visibility, and composes `@afx/ui` `Popover` + `Command` primitives for keyboard navigation.
- [x] In chat composer, detect `^\s*/$` (or `/` at start) → open popup; close on Esc, Enter (insert), or selection change away.
- [x] AFX skills render as `/afx-<name>` (strip `skill:` prefix); other commands render verbatim.
- [x] Insert action: replaces the leading `/` with the full command in the textarea; does not auto-submit.
- [x] On chat ready, request `chat/getCommands` once and cache; refresh on `agent_start` if needed.

### Phase 4: Model selector

> Ref: [FR-6], [FR-10], [DES-UI], [DES-ERR]

#### 4.1 Model combobox component

<!-- files: apps/chat/src/components/model-combobox.tsx (NEW) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-6] [NFR-6] [DES-UI] [DES-ERR] [DES-ICONS] -->

- [x] New `<ModelCombobox>`: replaces stub at chat.tsx:332-342 and composes `@afx/ui/components/combobox`; rows group by `provider`, secondary text for context window.
- [x] Empty state per DES-ERR (no models → copy + Settings link).
- [x] Focus management: arrow keys, Enter to select, Esc to close.

#### 4.2 Composer integration + bridge wiring

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/lib/bridge.ts (read) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-6] [DES-API] -->

- [x] On chat ready, dispatch `chat/getModels`; cache the response.
- [x] Bind selection → `chat/setModel`; on `agent/modelChanged`, refresh local state and `piStatus.model`.
- [x] Status bar already renders `piStatus.model` — confirm new shape renders cleanly (e.g. show `name ?? id`).

#### 4.3 Settings disclosure

<!-- files: apps/chat/src/views/settings.tsx -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-10] -->

- [x] Add a callout in Settings explaining: "Switching the model from the chat composer updates Pi's default for future CLI runs."

### Phase 5: Tab cleanup (drop Explorer)

> Ref: [FR-9], [DES-UI]. Skills tab is NOT introduced — slash popup + Settings → Available Skills cover discovery (see Phase 7.2).

#### 5.1 Drop Explorer; finalize tabs to Chat / History / Settings

<!-- files: apps/chat/src/app.tsx, apps/chat/src/views/explorer.tsx, apps/chat/src/components/coming-soon.tsx -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-9] [DES-UI] -->

- [x] Update `TABS` in `app.tsx`: remove the `{ value: "explorer", label: "Explorer" }` entry. Final array: `[Chat, History, Settings]`. Drop the matching `<TabsContent value="explorer">` block.
- [x] Convert `Tabs` to controlled state so Settings skill rows can switch to Chat and pass a command insertion request without global mutable state.
- [x] Delete `apps/chat/src/views/explorer.tsx`.
- [x] Check `apps/chat/src/components/coming-soon.tsx` for other refs (`grep`); if zero, delete it. (Workbench has its own `apps/workbench/src/components/coming-soon.tsx` used by `notes.tsx` — left intact.)
- [x] Verify no test or e2e selector references `value="explorer"` or the Explorer label. (Existing checks in `app.test.tsx` and `chat.spec.ts` are negative regression assertions and stay.)

### Phase 6: Composer cleanup + `@` mention

> Ref: [FR-11], [FR-12], [DES-MENTION], [DES-DEC] (composer toolbar scope, `@` file-list source, `@` expansion location)

#### 6.1 Drop unused composer toolbar buttons

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-11] [DES-UI] -->

- [x] Remove the `+` "Add context" `<Button>` and the `📎` "Attach file" `<Button>` from the composer toolbar at chat.tsx:303-331.
- [x] Keep the `@` button — it now opens the mention popover (Phase 6.2).
- [x] Confirm no e2e selectors are still anchored on the removed buttons.

#### 6.2 Mention popover component

<!-- files: apps/chat/src/components/mention-popup.tsx (NEW), apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-12] [NFR-6] [DES-MENTION] [DES-UI] [DES-ICONS] -->

- [x] New `<MentionPopup>` component: receives `files: Array<{path, recent?}>`, controlled visibility, and composes `@afx/ui` `Popover` + `Command` primitives for keyboard navigation/search.
- [x] In chat composer, detect `@` at word boundary or click on `@` button → open popup; close on Esc, selection, or selection change away.
- [x] On select, insert `@<workspace-relative-path>` at the cursor; replace any partial `@<typed>` token already entered.
- [x] Render two groups: "Recently opened" (top), "Workspace" (alphabetical with limit + "…N more").

#### 6.3 Host file-listing bridge handler

<!-- files: apps/vscode/src/panels/sidebar-panel.ts, packages/shared/src/messages.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-12] [DES-API] [DES-MENTION] -->

- [x] Add `chat/listFiles` handler: call `vscode.workspace.findFiles(query ?? "**/*", excludes, limit)`; map to `{path, recent}` (recent = path is in `vscode.window.tabGroups`).
- [x] Wire into `agent/files` reply message. Do NOT expose a `chat/readFile` message to the webview in v1; file content is read only during host-side submit expansion.

#### 6.4 Submit-time mention expansion

<!-- files: apps/chat/src/lib/mentions.ts (NEW), apps/chat/src/lib/mentions.test.ts (NEW), apps/vscode/src/panels/sidebar-panel.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-12] [DES-MENTION] [DES-TEST] -->

- [x] Implement pure tokenizer in `apps/chat/src/lib/mentions.ts`: extract `@<path>` tokens not preceded by alphanumerics; return list of unique paths preserving order.
- [x] Unit-test the tokenizer: bare `@src/foo.ts`, multiple mentions, email-style false positive (`me@example.com` — not extracted), trailing punctuation, escaped `\@`.
- [x] On submit, chat sends `chat/send` with `mentions?: string[]`; host validates and reads each mention internally before calling `manager.send()`. Inflated prompt format per [DES-MENTION] algorithm.
- [x] Tokens that fail to resolve get `[unavailable: <reason>]` markers, not silently dropped.

### Phase 7: Settings tab content

> Ref: [FR-13], [DES-SETTINGS], [DES-API] (`SettingsSnapshot`)

#### 7.1 Settings snapshot bridge

<!-- files: packages/shared/src/messages.ts, apps/vscode/src/panels/sidebar-panel.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-13] [DES-API] [DES-SETTINGS] -->

- [x] Add `SettingsSnapshot` shared type and the `chat/getSettingsSnapshot` / `agent/settingsSnapshot` message pair.
- [x] Add `chat/getStderr` / `agent/stderr` and `chat/openSettings` message pairs.
- [x] Host handler composes snapshot from: `extensionContext.extensionUri` (skills path), `vscode.workspace.getConfiguration("afx").get("agentBinaryPath")`, `getAvailableModels()` grouped by provider, `vscode.workspace.getConfiguration("afx").get("logLevel")`, `apps/vscode/package.json` version.
- [x] Bundled-skill count: read directory entries under the resolved skills path; cache for the lifetime of the extension host.

#### 7.2 Settings view sections

<!-- files: apps/chat/src/views/settings.tsx -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [FR-13] [FR-10] [NFR-6] [DES-SETTINGS] [DES-ICONS] -->

- [x] Replace the existing placeholder layout with six sections per [DES-SETTINGS]: Engine, Providers, Chat (FR-10 disclosure), **Available Skills** (FR-13.f — `getCommands()` listing + AFX-curated ACTIONS), Diagnostics, About.
- [x] Available Skills section: render groups in this order — AFX SKILLS (`source==="skill"` and `name.startsWith("skill:afx-")`), OTHER SKILLS, EXTENSION COMMANDS (`source==="extension"`), PROMPT TEMPLATES (`source==="prompt"`), ACTIONS (foundation = `/new`, `/abort`). AFX-prefixed names render as `/afx-*`. Clicking a skill row switches to Chat tab and inserts `/<name>` into composer via app-level state; clicking an ACTIONS row dispatches `chat/newSession` or `chat/abort`.
- [x] On mount, dispatch `chat/getSettingsSnapshot` AND `chat/getCommands`; render from the matching reply events.
- [x] "View buffered stderr" opens an expandable plain `<pre>` region (mono font, 200-line head-truncation, Copy button — per Design Q-8 resolution). Source: `AgentManager.getStderr()` surfaced via `chat/getStderr`.
- [x] "New session" button dispatches the existing `chat/newSession` message (already wired at `apps/vscode/src/panels/sidebar-panel.ts:527`).
- [x] All `[ExternalLink] afx.<key>` cells dispatch `chat/openSettings` (new) → host runs `vscode.commands.executeCommand("workbench.action.openSettings", "afx.<key>")`.

### Phase 8: Testability harness + abstraction guards

> Ref: [NFR-1], [DES-ABSTRACTION], [DES-TESTABILITY], [DES-TEST]. Foundational; enables the component tests every other phase relies on.

#### 8.1 Mock-transport scenarios for new messages

<!-- files: packages/transport/src/scenarios/, packages/transport/src/index.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-TESTABILITY] -->

- [x] Add named scenarios: `modelsLoaded`, `modelsEmpty`, `commandsLoaded`, `filesListed`, `stderrLoaded`, `settingsSnapshotLoaded`.
- [x] Each scenario is a tiny canned dialogue (sequence of `agent/*` events). Component tests pick by name.
- [x] DEV `<DebugPanel>` ([apps/chat/src/components/debug-panel.tsx](../../../apps/chat/src/components/debug-panel.tsx)) auto-detects new scenarios.

#### 8.2 `createMockAgentManager()` factory

<!-- files: apps/chat/src/test-utils/mock-agent-manager.ts (NEW) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-TESTABILITY] -->

- [x] Export a typed `AgentManager` whose every method is a `vi.fn()` spy with sensible defaults (e.g. `getStatus` resolves to a Pi-shaped status, `getAvailableModels` to a small fixture).
- [x] Expose helpers like `mockManager.emitEvent({type: "agent_start"})` for tests that drive event listeners.
- [x] Used by host-handler unit tests in `apps/vscode/src/panels/sidebar-panel.test.ts` (9 tests covering chat/getModels, chat/setModel, chat/getCommands, chat/getStderr, chat/abort, chat/newSession, chat/send, listener registration, and malformed inbound; passes with `pnpm --filter "./apps/vscode" exec vitest run src/panels/sidebar-panel.test.ts`).

#### 8.3 Pure-helper extraction + tests

<!-- files: apps/chat/src/lib/composer-detect.ts (NEW + .test.ts), apps/chat/src/lib/settings-snapshot.ts (NEW + .test.ts) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [DES-TESTABILITY] [DES-MENTION] [DES-SETTINGS] -->

- [x] `composer-detect.ts`: pure functions for `@`/`/` trigger detection given `(text, caretIndex)`. Unit-test: empty composer, mid-word, after whitespace, after newline, escaped, inside code-fence.
- [x] `settings-snapshot.ts`: pure composer that takes raw inputs (extension version, available models, log level, paths) and returns a `SettingsSnapshot`. Unit-test: empty providers, multi-provider, missing fields → defaults.

#### 8.4 Abstraction-boundary guards

<!-- files: apps/chat/__tests__/no-pi-imports.test.ts (NEW), packages/shared/__tests__/no-react.test.ts (NEW) -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-ABSTRACTION] -->

- [x] Add a vitest "import guard" test that walks `apps/chat/src/**` and asserts no file imports from `@afx/agent-pi` or any `@earendil-works/*` package. Acts as a future-runtime guard.
- [x] Add a similar guard for `packages/shared/src/**` — no React, no `@afx/agent-*`, no `vscode`.
- [x] Optional: a third guard for `apps/vscode/src/panels/**` blocking direct adapter imports (only `agent-factory.ts` knows runtimes). Implemented at `apps/vscode/__tests__/no-pi-imports-panels.test.ts`; passes against `apps/vscode/src/panels/{sidebar-panel,workbench-panel,webview-html}.ts`.

#### 8.5 Foundation readiness pass

<!-- files: (review) apps/chat/src/**, apps/vscode/src/**, packages/agent/pi/src/**, packages/shared/src/** -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [DES-OVR] [DES-ERR] [DES-IMPROVEMENTS] [DES-ROLLOUT] [DES-SEC] -->

- [x] Before implementation starts, confirm tasks still match v1 foundation scope: Pi integration first, final UI/UX polish deferred per [DES-IMPROVEMENTS]. (Retrospective on 2026-04-27: all 8 phases map 1-to-1 to FRs in the Spec section; nothing from DES-IMPROVEMENTS was implemented.)
- [x] Review error-state handling across adapter, host bridge, and chat UI against [DES-ERR], especially missing bundles, empty models, rejected model changes, and `get_commands` failures. (Verified: missing-bundle warn at `apps/vscode/src/extension.ts:65-68`; empty-models state at `apps/chat/src/components/model-combobox.tsx:61`; normalized `error` event emission at `packages/agent/pi/src/rpc-manager.ts:180,210`.)
- [x] Confirm implementation did not introduce runtime dependencies, activation-time filesystem writes, auth provisioning UI, or security-policy hooks beyond [DES-SEC]. (Verified: `apps/vscode/package.json` runtime deps are unchanged — `@afx/shared`, `@afx/agent-pi`, `@types/vscode`; only an `existsSync` read happens at activate; no auth or `ToolCallPolicy` code anywhere.)
- [x] Confirm rollout and rollback notes in [DES-ROLLOUT] still match the implementation order chosen for coding. (Implementation order followed: skill bundling → AgentManager extensions → Pi adapter contract → slash rewrite → UI controls; matches DES-ROLLOUT's "Pi integration first" guidance.)

### Cross-Reference Index

| Task                                       | Spec Requirements                | Design Sections                                                    |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------ |
| 1.1 — Bundle layout + build copy           | [FR-1], [FR-3], [NFR-3], [NFR-5] | [DES-FILES], [DES-DEPS]                                            |
| 1.2 — Adapter wiring                       | [FR-2], [NFR-2]                  | [DES-DATA], [DES-DEC]                                              |
| 1.3 — Extension factory wiring             | [FR-2]                           | [DES-ARCH], [DES-ERR]                                              |
| 1.4 — End-to-end verification              | [FR-3]                           | [DES-TEST]                                                         |
| 2.1 — Shared types + interface             | [FR-4], [FR-5], [NFR-1]          | [DES-DATA], [DES-API]                                              |
| 2.2 — Pi adapter implementation            | [FR-4], [FR-5]                   | [DES-DATA], [DES-API]                                              |
| 2.3 — Host bridge handlers                 | [FR-4]                           | [DES-API]                                                          |
| 2.4 — Type-check + smoke tests             | (all FR/NFR)                     | [DES-TEST]                                                         |
| 3.1 — Adapter rewrite                      | [FR-8], [NFR-1], [NFR-4]         | [DES-DEC]                                                          |
| 3.2 — Adapter rewrite tests                | [FR-8]                           | [DES-TEST]                                                         |
| 3.3 — Composer slash popup                 | [FR-7], [NFR-6]                  | [DES-UI], [DES-API]                                                |
| 4.1 — Model combobox component             | [FR-6], [NFR-6]                  | [DES-UI], [DES-ERR], [DES-ICONS]                                   |
| 4.2 — Composer integration + bridge wiring | [FR-6]                           | [DES-API]                                                          |
| 4.3 — Settings disclosure                  | [FR-10]                          | [DES-UI]                                                           |
| 5.1 — Drop Explorer; no Skills tab         | [FR-9]                           | [DES-UI]                                                           |
| 6.1 — Drop unused composer toolbar buttons | [FR-11]                          | [DES-UI], [DES-DEC]                                                |
| 6.2 — Mention popover component            | [FR-12], [NFR-6]                 | [DES-UI], [DES-MENTION], [DES-ICONS]                               |
| 6.3 — Host file-listing handler            | [FR-12]                          | [DES-API], [DES-MENTION]                                           |
| 6.4 — Submit-time mention expansion        | [FR-12]                          | [DES-MENTION], [DES-TEST]                                          |
| 7.1 — Settings snapshot bridge             | [FR-13]                          | [DES-API], [DES-SETTINGS]                                          |
| 7.2 — Settings view sections               | [FR-13], [FR-10], [NFR-6]        | [DES-SETTINGS], [DES-ICONS]                                        |
| 8.1 — Mock-transport scenarios             | [NFR-1]                          | [DES-TESTABILITY]                                                  |
| 8.2 — `createMockAgentManager()`           | [NFR-1]                          | [DES-TESTABILITY], [DES-ABSTRACTION]                               |
| 8.3 — Pure-helper extraction + tests       | [FR-12], [FR-13]                 | [DES-TESTABILITY], [DES-MENTION], [DES-SETTINGS]                   |
| 8.4 — Abstraction-boundary guards          | [NFR-1]                          | [DES-ABSTRACTION]                                                  |
| 8.5 — Foundation readiness pass            | (cross-cutting)                  | [DES-OVR], [DES-ERR], [DES-IMPROVEMENTS], [DES-ROLLOUT], [DES-SEC] |

<!-- SPRINT-SECTION-END: TASKS -->

---

<!-- SPRINT-SECTION-START: SESSIONS (appended to tasks.md on graduation — tasks-template.md requires Work Sessions as the last section) -->

## 4. Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in chat-foundation.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-sprint code, /afx-task pick, /afx-task code, /afx-task complete -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action (Picked/Coded/Completed/Verified/Reviewed) | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date       | Task    | Action                          | Files Modified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Agent | Human |
| ---------- | ------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 2026-04-26 | 1.1     | Coded                           | .github/workflows/code-qa.yml, apps/vscode/package.json, apps/vscode/scripts/sync-skills.mjs, apps/vscode/resources/skills/agenticflowx/\*\*                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [x]   | []    |
| 2026-04-26 | 1.2-8.4 | Coded + Verified                | packages/shared/src/\*\*, packages/agent/pi/src/\*\*, apps/vscode/src/\*\*, apps/chat/src/\*\*, packages/transport/src/\*\*, tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [x]   | []    |
| 2026-04-27 | 5.1     | Completed                       | apps/chat/src/views/explorer.tsx (deleted), apps/chat/src/components/coming-soon.tsx (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [x]   | []    |
| 2026-04-27 | audit   | Reviewed                        | Demoted `tasks` and top-level `status` to Draft — Phases 1.4 (manual F5 verify), 8.2 (sidebar-panel.test.ts wiring), 8.4 (optional 3rd guard), 8.5 (readiness pass) still unchecked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [x]   | []    |
| 2026-04-27 | 8.2     | Coded                           | apps/vscode/src/panels/sidebar-panel.test.ts (NEW, 9 tests using createMockAgentManager — covers chat/getModels, chat/setModel, chat/getCommands, chat/getStderr, chat/abort, chat/newSession, chat/send, listener registration, malformed inbound). 27 vscode tests passing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | []    |
| 2026-04-27 | 8.4     | Coded                           | apps/vscode/**tests**/no-pi-imports-panels.test.ts (NEW, the optional 3rd boundary guard for apps/vscode/src/panels/\*\*).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | []    |
| 2026-04-27 | 8.5     | Reviewed                        | Foundation readiness review: all 4 items pass (foundation scope match, error-state handling present in adapter/host/UI, no new runtime deps or fs writes or auth/policy code, rollout order matches DES-ROLLOUT).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | []    |
| 2026-04-27 | 1.4     | Pending verify                  | Live F5 functional test scheduled — being run by human; check off when `get_commands` returns the expected `skill:afx-*` set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | []    | []    |
| 2026-04-27 | 1.4     | Bug-fixed                       | F5 test surfaced two real bugs in the Pi adapter: `getAvailableModels` and `getCommands` were checking `Array.isArray(response)` against pi's wrapped shape (`data: { models: [...] }`, `data: { commands: [...] }`) and always returning `[]`. Fixed in `packages/agent/pi/src/rpc-manager.ts` to unwrap. Added 6 regression tests in `rpc-manager-unwrap.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | []    |
| 2026-04-27 | FR-10   | Bug-fixed                       | "Switching updates Pi's default…" disclosure was rendered in two places (combobox dropdown footer + Settings card). Per FR-10 only Settings should disclose; removed the duplicate from `apps/chat/src/components/model-combobox.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [x]   | []    |
| 2026-04-27 | FR-13   | Improved                        | Settings tab responsive layout for narrow VSCode panel widths: `ConfigRow` now wraps value below label on narrow widths via flex-wrap + flex-basis; provider rows + Diagnostics buttons also `flex-wrap`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | []    |
| 2026-04-27 | doc-fix | Reviewed                        | Retargeted 11 stale `@see docs/specs/01-agenticflowx-overview/...` references (10 source-config files + apps/chat/vitest.config.unit.ts) to canonical specs (420-dx-testing, 100/120/130/210/220-app/package, 310-infra-build, 320-infra-scripts, 400-dx-conventions, 410-dx-quality, 500-ci-code-qa).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [x]   | []    |
| 2026-04-27 | FR-13   | Bug-fixed                       | Settings ConfigRow had a `sm:basis-auto` breakpoint that switched the value from "stack below label" (narrow) to "inline" (≥640px) — at the breakpoint the inline value overlapped the icon button. Removed the breakpoint switch; value now always stacks below the label with `pl-[18px] break-all`, so VSCode side panel widths from ~200px upward render cleanly with no overlap. Provider rows kept inline (short content).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | []    |
| 2026-04-27 | FR-4    | Diagnostics                     | Round-2 F5 test still showed empty model dropdown despite the unwrap fix being in the bundle (verified via grep for `response?.models` + `response.models` in `out/extension.js`). Added `log.debug` lines to `getAvailableModels` and `getCommands` that emit raw response shape + array length + normalized length to the AFX output channel. To diagnose: set `afx.logLevel` to `debug`, re-launch F5, open chat panel, look in Output → AFX for `getAvailableModels: raw=...` and `getCommands: raw=...`.                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | []    |
| 2026-04-27 | FR-6    | Bug-fixed                       | Round-2 screenshot revealed it was a UI bug, not a data bug: `ComboboxEmpty` from base-ui was rendering "No models available." simultaneously with the actual model groups (MiniMax, OpenAI). Replaced `<ComboboxEmpty>` with a plain conditional render based on `models.length === 0` in `apps/chat/src/components/model-combobox.tsx` so the empty state and the list are mutually exclusive. The unwrap fix from earlier was actually correct all along.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [x]   | []    |
| 2026-04-27 | FR-7    | Hardened                        | Defensive UX fix in `apps/chat/src/components/slash-popup.tsx`: the "AFX skills" `CommandGroup` heading now only renders when `afxCommands.length > 0` (matches the existing pattern for "Other commands"). Avoids showing an orphan heading when Pi hasn't loaded any `skill:afx-*` entries. Diagnostic log from FR-4 row above will tell whether Pi is actually returning the AFX skills.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | []    |
| 2026-04-27 | FR-7    | Bug-fixed                       | `/new` and `/abort` from the slash-popup Actions group were inserting text into the textarea (then submitted to Pi as a regular prompt — Pi's response: "/new isn't an AFX command. What would you like to create?"). Added a `SlashAction` discriminator + `onAction` prop to `SlashPopup`; chat.tsx wires `selectSlashAction` which clears the leading `/` + query from the textarea and dispatches `chat/newSession` or `chat/abort` directly. Skill commands still go through `onSelect` (textarea insertion); only the Actions group dispatches.                                                                                                                                                                                                                                                                                                                                                              | [x]   | []    |
| 2026-04-27 | UX      | Added                           | New-session affordance added to the StatusBar (top strip, right-aligned next to the usage pill): icon-only `MessageSquarePlus` button, ghost-on-hover, `aria-label="Start new session"`. Placement is intentionally off the top-right header toolbar pattern most chat extensions use — it lives in the compact status strip instead. Backed by `chat/newSession` (same handler `handleNewSession` in `sidebar-panel.ts:744-758` that the Settings Actions row uses).                                                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | []    |
| 2026-04-27 | Tier-1  | Added                           | Pi RPC pass-through: `compact`, `steer`, `follow_up`, `set_thinking_level`, `set_steering_mode`, `set_follow_up_mode`, `set_auto_compaction`, `set_auto_retry`. AgentManager (`packages/shared/src/agent.ts`) gained 8 methods + 9 new fields on `AgentStatus` (`thinkingLevel`, `isCompacting`, `steeringMode`, `followUpMode`, `autoCompactionEnabled`, `autoRetryEnabled`, `sessionId`, `sessionName`, `messageCount`). Pi adapter (`packages/agent/pi/src/rpc-manager.ts`) wires each to the corresponding RPC + a `mapPiStateToStatus()` helper. New chat protocol entries: `chat/compact`, `chat/steer`, `chat/followUp`, `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`, `chat/setAutoCompaction`, `chat/setAutoRetry`, plus reply events `agent/runtimeSettings` and `agent/compacted`. Both mock fixtures updated.                                                               | [x]   | []    |
| 2026-04-27 | UX      | Added                           | Compact icon button in the StatusBar (between usage pill and new-session). Disabled+pulsing while `runtime.isCompacting`. Same styling vocabulary as the new-session button — they're a left-to-right chrome group at the strip's right edge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | []    |
| 2026-04-27 | UX      | Added                           | `ThinkingLevelToggle` segmented control in the composer toolbar — only renders when the active model has `reasoning: true`. 5 abbreviated buttons (min/lo/med/hi/x) inline next to the model selector. Optimistic UI on click, then host re-broadcasts `agent/runtimeSettings` from `get_state` to confirm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | []    |
| 2026-04-27 | UX      | Added                           | **Mid-stream queue UX**: rather than locking input during streaming (source pattern), the composer stays open. `⌘⏎` while streaming dispatches `chat/steer` (Pi `steer` — interrupts mid-turn); `⌘⇧⏎` dispatches `chat/followUp` (queues for after). Send button icon swaps from `ArrowUp` (idle) to `Zap` (streaming). New `QueueStrip` component renders above the composer Card showing a list of submitted-while-streaming messages with mode (zap = steer, clock = follow-up) and a per-row dismiss button. Auto-clears when `isStreaming` flips false. Strip header: "N queued · steering · applies when current turn pauses".                                                                                                                                                                                                                                                                               | [x]   | []    |
| 2026-04-27 | FR-13   | Rebuilt                         | **Settings tab fully migrated to shadcn `Field` with `orientation="responsive"`**. The previous hand-rolled `flex-col` row was the source of the small-screen overlap problems. shadcn's `FieldGroup` sets up a `@container/field-group`; `Field orientation="responsive"` is vertical until the parent reaches 28rem, then auto-promotes to horizontal — pure container-query CSS, no JS, no breakpoint surprise transitions. Replaced custom `ConfigRow` with `ConfigField` using `Field`/`FieldContent`/`FieldLabel`/`FieldDescription`. Added a new "Runtime" card with 5 controls: thinking-level (`NativeSelect`), steering mode (`NativeSelect`), follow-up mode (`NativeSelect`), auto-compaction (`Switch`), auto-retry (`Switch`). Each disabled until the host broadcasts the corresponding `runtime.*` field, optimistic on click, confirmed by the host's re-broadcast.                               | [x]   | []    |
| 2026-04-27 | FR-13   | Bug-fixed (P1)                  | User flagged Settings as still broken at small/normal sidebar widths — root cause: `Field orientation="responsive"` flips at `@md/field-group` (28rem ≈ 448px), but the **VSCode primary sidebar minimum is 170px** (snaps to hidden below). The entire normal sidebar range (170–400px) sat in `vertical` mode, where `*:w-full` stretched Switch controls and small icon buttons full-width. Replaced shadcn `Field` in `apps/chat/src/views/settings.tsx` with explicit row primitives sized for 170px+: `SwitchRow` (horizontal always, label/desc `flex-1 min-w-0`, Switch `shrink-0`), `SelectRow` (vertical always, NativeSelect `w-full` for long option labels), `ConfigField` (label + icon-button on one row with truncate/shrink-0, value wraps below with `break-all`). Removed `Field`/`FieldGroup`/`FieldContent`/`FieldLabel`/`FieldDescription`/`Separator` imports. See [CF-D010] in journal.md. | [x]   | []    |
| 2026-04-27 | FR-13   | Bug-fixed (P1, real root cause) | User re-reported "issue still there" after the row-primitive rewrite. Real culprit was the **radix `<ScrollArea>`** wrapping Settings. Radix injects an inner viewport child with `display: table; min-width: 100%`, which forces the inner box width to `max(100%, intrinsic-content-min-width)`. Any non-shrinkable child (SVG icon, Switch, unbreakable string) sets the floor, and `min-w-0` on descendants does nothing because the table-display box itself doesn't honor it. Replaced `<ScrollArea>` with native `<div className="h-full overflow-y-auto bg-muted/10 [scrollbar-width:thin] …">` (same pattern the chat scroller uses, see chat.tsx:486). Settings now shrinks cleanly down to the 170px sidebar minimum. Type-check + chat build + extension bundle re-verified.                                                                                                                           | [x]   | []    |

<!-- SPRINT-SECTION-END: SESSIONS -->
