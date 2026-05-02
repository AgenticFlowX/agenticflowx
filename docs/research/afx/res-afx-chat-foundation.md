---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "0.1.0"
created_at: "2026-04-26T14:52:31.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "chat-foundation", "skill-bundling", "models", "slash-commands", "pi-rpc"]
---

# AFX Chat Foundation — Skill Bundling, Tab Cleanup, Model Selector, Slash Commands

## Context

AFX is RPC-first against Pi as the runtime ([res-pi-rpc-features.md](../pi/res-pi-rpc-features.md)). The chat shell is wired (status bar, streaming, tool timeline, abort, thinking) but four foundation gaps block delivering value to a real user:

1. **Skill bundling** — `afx/skills/agenticflowx/*` is mirrored under `.claude/skills/`, `.agents/skills/`, and `.afx/skills/agenticflowx/`, but Pi is spawned with `cwd = vscode.workspace.workspaceFolders[0]` (the user's project), not the extension dir. Skills shipped inside the VSIX must reach Pi when Pi runs in arbitrary user workspaces.
2. **Tab cleanup** — `apps/chat/src/views/explorer.tsx` is a `ComingSoon` stub. We want one real-now tab in its place.
3. **Model selector** — the composer renders a stub `Sparkles` button labeled "GPT-5.3 AI agent" with no transport. Pi's RPC exposes `get_available_models` / `set_model`; the AFX `AgentManager` contract does not yet.
4. **Slash-command foundation** — chat composer mentions `/` for commands but no picker exists; the Pi runtime adapter does not yet rewrite `/afx-*` to Pi's `/skill:afx-*`.

The user's directive was scope-limiting: lay the foundation now, defer spec-mode (mode-aware tool gating, focus-mode prompts) to a later pass.

This research answers: **what shape should each foundation piece take, and where does it live, given Pi's verified surface?**

---

## Findings

### 1. Pi `--skill <path>` is the right bundling mechanism (verified)

Pi documents and implements a CLI flag tailored exactly to this case.

| Question                                                       | Verified at                                                       | Answer                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is `--skill <path>` a real, repeatable CLI flag?               | `pi-mono/packages/coding-agent/src/cli/args.ts:132-134`           | Yes — `if (arg === "--skill" && i + 1 < args.length) result.skills.push(args[++i])`. Repeatable; accumulates into `parsed.skills`.                                                                                     |
| Does it survive RPC mode?                                      | `pi-mono/packages/coding-agent/src/main.ts:514-543`               | Yes — `resolveCliPaths(cwd, parsed.skills)` flows into `additionalSkillPaths` on the resource loader, which is created once for every mode (interactive, RPC, headless).                                               |
| Does passing a parent dir recursively discover SKILL.md files? | `pi-mono/packages/coding-agent/src/core/skills.ts:168-199`        | Yes. Header comment: "if a directory contains SKILL.md, treat it as a skill root and do not recurse further; recurse into subdirectories to find SKILL.md." One `--skill <bundleRoot>` covers an arbitrary skill tree. |
| Are bundled skills surfaced through RPC?                       | `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts:634-639` | Yes — `get_commands` returns one `skill:<name>` entry per loaded skill, alongside Pi extension commands and prompt templates.                                                                                          |
| Caveat with `--no-skills`?                                     | `pi-mono/packages/coding-agent/docs/skills.md:41`                 | "Disable discovery with `--no-skills` (explicit `--skill` paths still load)." Useful escape hatch: AFX can later choose to suppress workspace-discovered skills while keeping bundled AFX skills loaded.               |

**Implication.** No fs-write fallback (materialize-on-activate) is needed. The cleanest delivery is: ship `resources/skills/` inside the VSIX, append `--skill <extensionPath>/resources/skills` on Pi spawn. The arg array on `PiClientOptions` ([packages/agent/pi/src/rpc-client.ts:34-45](../../../packages/agent/pi/src/rpc-client.ts)) already accepts extras; the change reduces to one new option on `PiRpcManagerOptions` (e.g. `additionalSkillPaths?: readonly string[]`) and a few lines in [agent-factory.ts](../../../apps/vscode/src/agent-factory.ts) to compute the bundled path.

### 2. Pi RPC handlers for model + command control are real (verified)

| Handler                | Verified at           | Used for                                                                     |
| ---------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `get_state`            | `rpc-mode.ts:422-437` | Current model object, thinking level, streaming flags, session id            |
| `set_model`            | `rpc-mode.ts:444-451` | Validated against authenticated providers; mutates Pi default                |
| `get_available_models` | `rpc-mode.ts:462-464` | Returns full model list grouped by provider                                  |
| `get_commands`         | `rpc-mode.ts:613-643` | Returns Pi built-ins + extension commands + skill commands as `skill:<name>` |

`set_model` mutates Pi's persisted default — confirmed in [res-pi-rpc-features.md §Model Control](../pi/res-pi-rpc-features.md). Acceptable for the current foundation; surface as Settings-tab disclosure rather than build a session-scoped override now.

### 3. Tab inventory — only Explorer is dead weight

`apps/chat/src/app.tsx:16-21` mounts four tabs:

| Tab      | State                                                                          | Decision                                                                            |
| -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Chat     | Functional — streaming, tools, thinking, abort, status bar, usage pill         | Keep.                                                                               |
| Explorer | `ComingSoon` stub at `apps/chat/src/views/explorer.tsx`                        | **Drop.** Replace, don't shrink.                                                    |
| History  | Functional — rebuilds turns from `chat/state` events; per-day grouping; search | Keep. Could fold into Chat as a session drawer later — out of scope for foundation. |
| Settings | Real                                                                           | Keep.                                                                               |

Most natural replacement for Explorer: **Skills tab** driven by `get_commands`. This makes the just-bundled skills (Finding 1) immediately visible and acts as the discovery surface for the slash-command picker (Finding 5). Grouping: `AFX (skill:afx-*)`, `Pi built-ins`, `Other extensions`.

### 4. AgentManager contract gaps (model + commands)

`packages/shared/src/agent.ts` currently exposes `send / abort / newSession / getStatus / getUsage / respondToUiRequest` only. To wire model-selector and slash-command picker, the contract grows by three methods plus a small status field expansion:

```ts
// New AgentManager methods
getAvailableModels(): Promise<AgentModel[]>;
setModel(target: { provider: string; modelId: string }): Promise<AgentModel>;
getCommands(): Promise<AgentCommand[]>;

// AgentStatus.model expansion (currently `string | undefined`)
model?: { provider: string; id: string; name?: string };
```

These are the minimum surface needed. They are runtime-agnostic; every adapter implements them.

### 5. Slash-command rewrite belongs in the Pi runtime adapter

Per [res-afx-chat-display-surface.md §AFX Command Picker](res-afx-chat-display-surface.md), AFX presents `/afx-task`, `/afx-next`, etc. and rewrites to Pi's `/skill:afx-task` before sending. The architecture rule from [res-afx-product-boundary.md §Runtime-adapter boundary](res-afx-product-boundary.md): runtime specifics live in `packages/agent/pi/`, not in the chat app.

So the rewrite happens inside `rpc-manager.ts` on the way into `c.request({ type: "prompt", message })`. The chat app sends user-facing text verbatim; the adapter normalizes. Free-text without leading `/` flows unchanged.

The chat app's responsibility is the picker UI: show available commands, insert into the textarea, let the user submit. No special routing, no handler table.

### 6. Existing wires we can lean on

- Composer already has the placeholder button slot at [chat.tsx:332-342](../../../apps/chat/src/views/chat.tsx) — needs only data + handler.
- Bridge protocol pattern (`bridgeOn` / `bridgeSend`) is already used for `chat/state`, `chat/messageStart`, `chat/usage`, etc. New messages slot in cleanly.
- `getStatus()` already calls `get_state` and extracts model name ([rpc-manager.ts:319-330](../../../packages/agent/pi/src/rpc-manager.ts)). Expanding to `{provider, id, name}` is a few lines.
- `apps/vscode/src/agent-factory.ts` is the single Pi-aware chokepoint — keeps the runtime-adapter boundary clean.

### 7. `@`-file references and image input — host-side responsibility under RPC

Pi supports both `@file` resolution and image attachments, but the support is split across CLI vs RPC, and **RPC mode delegates resolution to the host**. AFX must implement the picker + resolution itself.

**`@file` is a CLI-arg feature, not an inline-prompt parser.**

| Question                                    | Verified at                                                      | Answer                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is `@file` recognized inside a prompt body? | `pi-mono/packages/coding-agent/src/cli/file-processor.ts`        | No. `processFileArguments` runs over `parsed.fileArgs` (positional CLI args), not over the prompt string. There is no in-message `@`-mention scanner.                                                                                                                    |
| What is the documented usage?               | `pi-mono/packages/coding-agent/src/cli/args.ts:200`              | `pi [options] [@files...] [messages...]` — `@files` are separate argv entries before/after the message.                                                                                                                                                                  |
| Does RPC mode honor `@file` CLI args?       | `pi-mono/packages/coding-agent/src/main.ts:475`                  | No. `if (parsed.mode === "rpc" && parsed.fileArgs.length > 0)` is an explicit error path — RPC sessions reject startup `@file` args.                                                                                                                                     |
| What does `@file` resolution actually do?   | `pi-mono/packages/coding-agent/src/cli/file-processor.ts:24-99`  | Per arg: resolve path → reject missing → skip empty → branch by MIME. Text files inline as `<file name="…">…</file>`. Image files (jpg/png/gif/webp) become `ImageContent` (base64) plus a stub `<file name="…"></file>` reference; auto-resize to 2000×2000 by default. |
| What is the RPC `prompt` payload shape?     | `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts:21-23` | `{ type: "prompt"; message: string; images?: ImageContent[]; streamingBehavior? }` — `steer` and `follow_up` carry the same `images` field. No `files` or `paths` field.                                                                                                 |

**Implication.** Under RPC, AFX is the only thing that can interpret `@`. The chat composer is the picker UI; the runtime adapter is the resolver. Pi does nothing with `@` until AFX has expanded it into either (a) inlined text wrapped in `<file>` tags inside `message`, or (b) entries on the `images` array.

**Image support is real and end-to-end on Pi.**

| Capability                                               | Verified at                                                                                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ImageContent` is a first-class message-part type        | `pi-mono/packages/coding-agent/src/core/messages.ts:9,49,125`                                                                                                     |
| `read` tool returns image files as attachments           | `pi-mono/packages/coding-agent/src/core/tools/read.ts:130` ("Supports text files and images (jpg, png, gif, webp). Images are sent as attachments.")              |
| RPC carries images on prompt/steer/follow_up             | `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts:21-23`                                                                                                  |
| Auto-resize and global block toggles                     | `pi-mono/packages/coding-agent/src/core/settings-manager.ts:39-41,961-978`; user-facing in `docs/settings.md:119-120` (`images.autoResize`, `images.blockImages`) |
| Terminal display gates (TUI only — irrelevant under RPC) | `docs/settings.md:112-117` (`terminal.showImages`, `terminal.imageWidthCells`)                                                                                    |
| Model capability gating                                  | `docs/models.md:195` — only models declaring `input: ["text", "image"]` accept image parts                                                                        |
| TUI drag-drop precedent                                  | `pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts:615` — "drop files to attach"                                                            |

**AFX contract gaps.**

- `AgentManager.send(message: string)` ([packages/shared/src/agent.ts:104](../../../packages/shared/src/agent.ts)) is text-only. To carry attachments through the runtime-agnostic boundary, the signature needs an optional second arg (e.g. `send(message: string, attachments?: AgentAttachment[])`), where `AgentAttachment` is a small structural type the chat app produces and each adapter renders into its runtime's shape.
- The Pi adapter `send` ([packages/agent/pi/src/rpc-manager.ts:296-298](../../../packages/agent/pi/src/rpc-manager.ts)) currently issues `c.request({ type: "prompt", message })` with no images. It needs to (1) accept the new attachments arg, (2) for image attachments, append to the request's `images` array, and (3) for `@`-resolved text/folder content, inline as `<file name="…">…</file>` blocks into `message` to match Pi's own CLI convention.
- The composer has no `@` picker yet. The trigger surface mirrors the slash-command picker (Finding 5) — caret-position trigger on `@` at word boundary, popup with file/folder suggestions sourced from VS Code's workspace API (`vscode.workspace.findFiles`), insert as a token the adapter knows how to resolve.

**Resolution boundary.** Two viable splits:

- **Chat-app resolves before send** — composer turns `@src/foo.ts` into a fully-formed attachment record (path + read content) before hitting `AgentManager.send`. Simpler typing, but pushes fs reads into the webview process and means non-Pi adapters re-receive already-inlined text.
- **Adapter resolves on send** — composer ships `{ type: "file-ref"; path: string }` tokens; the Pi adapter resolves paths, branches on MIME using Pi's same algorithm, and produces `<file>` tags + `images[]`. Keeps the chat app runtime-agnostic and matches the runtime-adapter boundary rule from `res-afx-product-boundary.md`.

The second split is consistent with the architecture used for the slash rewrite in Finding 5: chat app stays runtime-naive, adapter normalizes for Pi. Same principle, same place.

**Out of foundation scope.** Folder expansion semantics (recurse? respect `.gitignore`? token budget?) and binary-file handling beyond images are non-trivial and should land as a follow-up — foundation only needs single text files, single images, and a working picker.

---

## Analysis

### Why bundle, not require workspace `.agents/skills/`

Pi auto-discovers `.agents/skills/` in cwd and ancestors. We could rely on that and tell users to install AFX skills in their own workspace. We don't, because:

- A VSCode extension whose value depends on the user authoring skill files first has a bad first-run.
- The AFX skill set is the product surface (`/afx-task`, `/afx-next`, etc.). Treating it as installable optional content makes it easy to deviate.
- The VSIX is the natural distribution boundary. `--skill` lets us hit it without polluting the user's workspace tree.

Workspace-discovered skills still load (Pi's normal discovery is unchanged); bundled skills are additive.

### Why the Pi runtime adapter owns the slash rewrite

If the chat app rewrote `/afx-*` to `/skill:afx-*`, swapping Pi for another runtime later (future runtime, custom runtime) would require touching the chat app. The architecture rule from `res-afx-product-boundary.md` is explicit: runtime specifics live in `packages/agent/<runtime>/`. The chat app talks `AgentManager.send(text)`; the adapter chooses how to format text for its runtime.

This is a small but load-bearing call: keeps the chat-app dependency on Pi exactly zero, which is the architectural promise that makes Pi the current runtime, not AFX's identity.

### Why the Skills tab earns its slot

A Skills tab does three things at once:

1. Validates that bundling worked — empty list = something is wrong with `--skill` resolution.
2. Acts as a passive discovery surface — users scan once, learn what's available.
3. Powers the slash-command picker — same data, two views.

Without it, the bundle is invisible until a user happens to type `/`. That's an unforced error.

### Why `AgentStatus.model` should grow rather than add a separate `getModel()`

`getStatus()` already calls `get_state`. The model object is in the response. Extracting `{provider, id, name}` instead of `name ?? id ?? provider` is a few lines. A separate `getModel()` would mean a second `get_state` round-trip per panel render. single source, expanded shape — same call site as today, more useful payload.

### Scope guardrails — what this foundation is not

- Not spec-mode. No mode-permission gate, no focus-mode prompt selection. `AFX-native modes` package per `res-afx-product-boundary.md §6` is its own spec.
- Not the security policy hook. `ToolCallPolicy` (composite security + repetition + mode-permission) per `res-afx-product-boundary.md §3` is a separate ADR.
- Not auth bridging. SecretStorage → Pi `setFallbackResolver` per `res-afx-product-boundary.md §4` is deferred.
- Not custom-mode files (`.afxmodes/`).
- Not the full chat status strip. The current bar (model + run dot + usage pill) is sufficient for foundation; adding context % + compact button per `res-afx-chat-display-surface.md` is a follow-up.
- Not folder-recursion or non-image binary attachments for `@`. Foundation supports single text files and single images; folder expansion (with `.gitignore` and token budgets) is a follow-up.

This keeps the foundation roughly five small specs/ADRs (one per topic A/B/C/D/E), each independently shippable.

---

## Recommendations

### A. Skill bundling (decision: A1, spawn-flag)

- Build step: copy `afx/skills/agenticflowx/` → `apps/vscode/resources/skills/` during VSIX packaging.
- Spawn change: extend `PiRpcManagerOptions` with `additionalSkillPaths?: readonly string[]`; thread to `PiClient` `args` as `--skill <path>` per entry.
- Wiring: `apps/vscode/src/agent-factory.ts` resolves `extensionPath/resources/skills` and passes it in.
- Verify: at runtime, `get_commands` returns `skill:afx-task` etc.

**Promote to ADR.** Single decision, single option, verified against Pi source.

### B. Tab cleanup → Skills tab

- Delete `apps/chat/src/views/explorer.tsx` and the `coming-soon.tsx` import if unused elsewhere.
- Add `apps/chat/src/views/skills.tsx` driven by a new `agent/commands` event.
- Update `app.tsx` `TABS` to swap `explorer` → `skills`.
- Render: grouped list (`AFX (skill:afx-*)`, `Pi built-ins`, `Other extensions`), each with name + description, clickable to insert into composer as `/<name>`.

**Promote to spec under `210-app-chat`.**

### C. Model selector

- Extend `AgentManager` with `getAvailableModels()` and `setModel({provider, modelId})`.
- Expand `AgentStatus.model` from `string | undefined` to `{provider, id, name?} | undefined`. Update `getStatus()` in [rpc-manager.ts:319-330](../../../packages/agent/pi/src/rpc-manager.ts) accordingly.
- Add chat-protocol messages: `chat/getModels` → `agent/models`, `chat/setModel` → `agent/modelChanged`.
- Wire the existing composer button to a real combobox grouped by provider per [res-afx-chat-display-surface.md §Model Picker](res-afx-chat-display-surface.md).
- Settings-tab copy: "Switching models updates Pi's default for future CLI runs."

**Promote to spec under `210-app-chat`.** Touches `100-package-shared` (contract) and `300-infra-pi` (adapter), so cross-spec links matter.

### D. Slash-command foundation

- Extend `AgentManager` with `getCommands()`.
- Add chat-protocol messages: `chat/getCommands` → `agent/commands`.
- Composer popup: triggered by `/` at start of empty/whitespace line; shows union of Pi-reported commands; `/afx-*` rendered for skills with `skill:afx-` prefix, plain names for everything else; click/Enter inserts into the textarea (does not auto-submit).
- Adapter rewrite: in `rpc-manager.ts` `send(message)`, if `message` matches `^\s*/afx-\S+`, rewrite the prefix to `/skill:afx-` before issuing the `prompt` request. Free text is unchanged.
- Defer: fuzzy match scoring, command help drawer, command argument completion.

**Promote to spec under `210-app-chat`.** Cross-references `300-infra-pi` for the AFX rule.

### E. `@`-file references and image input

- Extend `AgentManager.send` from `(message: string)` to `(message: string, attachments?: AgentAttachment[])` in [packages/shared/src/agent.ts:104](../../../packages/shared/src/agent.ts).
- Define `AgentAttachment` in `packages/shared/src/agent.ts` as a discriminated union: `{ type: "file-ref"; path: string }` (composer-resolved later by adapter) and `{ type: "image"; mimeType: string; data: string }` (already-base64, e.g. paste/drop).
- Adapter resolution: in [packages/agent/pi/src/rpc-manager.ts:296-298](../../../packages/agent/pi/src/rpc-manager.ts), expand `file-ref` attachments using Pi's algorithm — text files → append `<file name="${path}">${content}</file>` to `message`; image files → push to a local `images[]` array. Pass the merged `images` array on the `prompt` request.
- Reuse Pi's MIME/resize logic conceptually, but do not import Pi internals — re-implement minimal MIME detection in the adapter (jpg/png/gif/webp → image, otherwise text). Keep Pi's `images.autoResize` setting authoritative; the adapter can ship full-size and let Pi resize.
- Composer UX: caret-trigger picker on `@` at word boundary, sourced via `vscode.workspace.findFiles`, insert as a styled token. Image paste/drop in the textarea produces `{ type: "image", ... }` directly.
- New chat-protocol messages: `chat/searchFiles` (query → list) for the picker; `send` payload grows an `attachments` array.
- Surface model gating: if `AgentStatus.model` (Recommendation C) reports a model whose `input` lacks `image`, hide the paste/drop affordance and warn on `@` of an image file.
- Defer: folder expansion (recurse + gitignore + token budget), non-image binary attachments, drag-drop from Explorer into chat.

**Promote to spec under `210-app-chat`.** Touches `100-package-shared` (contract change to `AgentManager.send`) and `300-infra-pi` (resolver in adapter). Sequence after C — the model-capability gate depends on the expanded `AgentStatus.model` shape.

### Decision Readiness

- **Ready for ADR**: A (skill bundling). Decided: spawn-flag, recursive single-root path.
- **Ready for spec**: B, C, D, E — all under `210-app-chat`. Each is a small, sequenced increment; E sequences after C.
- **Not ready**: spec-mode, security hook, auth bridge, custom-mode files, folder-recursion semantics for `@`. Out of foundation scope by user direction.

---

## References

### Pi source paths (verified during this research)

- `pi-mono/packages/coding-agent/src/cli/args.ts:132-134` — `--skill <path>` parsing
- `pi-mono/packages/coding-agent/src/main.ts:514-543` — `resolveCliPaths(cwd, parsed.skills)` → `additionalSkillPaths`
- `pi-mono/packages/coding-agent/src/core/skills.ts:168-199` — recursive SKILL.md discovery
- `pi-mono/packages/coding-agent/src/core/resource-loader.ts` — `additionalSkillPaths` consumption
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts:422` — `get_state`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts:444` — `set_model`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts:462` — `get_available_models`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts:613-643` — `get_commands` (emits `skill:<name>` entries)
- `pi-mono/packages/coding-agent/docs/skills.md` — locations, discovery rules, `--skill` semantics
- `pi-mono/packages/coding-agent/src/cli/args.ts:200` — documented usage `pi [options] [@files...] [messages...]`
- `pi-mono/packages/coding-agent/src/cli/file-processor.ts:24-99` — `processFileArguments` MIME branch + `<file>` wrapping + image base64
- `pi-mono/packages/coding-agent/src/main.ts:475` — RPC mode rejects startup `@file` CLI args
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts:21-23` — `prompt`/`steer`/`follow_up` carry `images?: ImageContent[]`
- `pi-mono/packages/coding-agent/src/core/messages.ts:9,49,125` — `ImageContent` as a first-class message part
- `pi-mono/packages/coding-agent/src/core/tools/read.ts:130` — `read` tool returns image files as attachments
- `pi-mono/packages/coding-agent/src/core/settings-manager.ts:39-41,961-978` — `images.autoResize`, `images.blockImages`
- `pi-mono/packages/coding-agent/docs/models.md:195` — model `input: ["text", "image"]` capability gate

### AFX source paths (foundation touchpoints)

- [apps/chat/src/app.tsx](../../../apps/chat/src/app.tsx) — tab shell
- [apps/chat/src/views/chat.tsx](../../../apps/chat/src/views/chat.tsx) — composer + status bar
- [apps/chat/src/views/explorer.tsx](../../../apps/chat/src/views/explorer.tsx) — to be replaced
- [apps/chat/src/lib/bridge.ts](../../../apps/chat/src/lib/bridge.ts) — message bridge
- [apps/vscode/src/agent-factory.ts](../../../apps/vscode/src/agent-factory.ts) — single Pi-aware chokepoint
- [packages/shared/src/agent.ts](../../../packages/shared/src/agent.ts) — `AgentManager` contract
- [packages/agent/pi/src/rpc-manager.ts](../../../packages/agent/pi/src/rpc-manager.ts) — RPC adapter
- [packages/agent/pi/src/rpc-client.ts](../../../packages/agent/pi/src/rpc-client.ts) — spawn args plumbing

### Related research

- [res-pi-rpc-features.md](res-pi-rpc-features.md) — full RPC surface
- [res-afx-chat-display-surface.md](res-afx-chat-display-surface.md) — display priority and command picker behavior
- [res-afx-product-boundary.md](res-afx-product-boundary.md) — runtime-adapter boundary, AFX-native vs runtime concerns

---

## Next Steps

- [ ] Promote A (skill bundling via `--skill`) to ADR — single decision, source-verified.
- [ ] Fold B/C/D/E into a foundation spec under `210-app-chat` (or split per-topic if the spec gets long).
- [ ] Decide bundle layout: `apps/vscode/resources/skills/` is the natural location; confirm against the VSIX packaging script.
- [ ] Decide UX for "switching models updates Pi's default" disclosure (Settings copy vs first-use confirm).
- [ ] Decide whether History stays a top-level tab post-foundation or folds into Chat as a session drawer.
- [ ] Decide `AgentAttachment` resolution split — adapter-resolves (preferred, runtime-agnostic) vs chat-app-resolves (simpler typing).
- [ ] Decide image-paste UX: clipboard image → auto-attach as `image` attachment, or require explicit drop into the composer.
