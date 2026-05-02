---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-04-26T14:58:19.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: ["chat-foundation", "journal"]
---

# Journal - Chat Foundation

<!-- prefix: CF -->

> Quick captures and discussion history for AI-assisted development sessions.
> See [agenticflowx.md](../../agenticflowx/agenticflowx.md) for workflow.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

---

## Discussions

<!-- Recorded discussions with IDs: CF-D001, CF-D002, etc. -->
<!-- Chronological order: oldest first, newest last -->

### CF-D001 - Sprint scaffolded from research

`status:active` `2026-04-26T14:58:19.000Z` `[scaffold, foundation, research-promotion]`

**Context**: User asked `/afx-sprint` to turn `docs/research/afx/res-afx-chat-foundation.md` into a sprint doc. Research had verified Pi's `--skill` flag against `pi-mono` source, locking in plan A1 (spawn-flag bundling) over A2 (materialize-on-activate).

**Summary**: Single sprint covers four foundation pieces — A: skill bundling via `--skill`, B: drop Explorer / add Skills tab, C: model selector, D: slash-command foundation. Phases 1–5 sequenced so 1 (bundling) validates end-to-end first, then 2 (shared contract) unlocks 3/4/5 in parallel.

**Progress**:

- [x] Sprint file created at `docs/specs/chat-foundation/chat-foundation.md`
- [x] Journal created
- [ ] Spec section approved
- [ ] Plan section approved
- [ ] Tasks section approved
- [ ] Implementation begun

**Decisions**:

- Sprint slug: `chat-foundation`. Lives inside `docs/specs/`, not workspace root, because the code work is in the current build and `@see` annotations need to resolve from that anchor.
- Single sprint covering A/B/C/D rather than four narrower sprints — total task surface ~16 task groups across 5 phases, comfortably within sprint scope. `/afx-sprint graduate` available if scope grows.
- Skill delivery: A1 (`--skill <bundleRoot>` spawn flag) confirmed against `pi-mono/packages/coding-agent/src/cli/args.ts:132-134` and `core/skills.ts:168-199`.
- Slash-prefix rewrite location: Pi runtime adapter, not chat app. Keeps chat runtime-agnostic per `res-afx-product-boundary.md` boundary rule.
- `AgentStatus.model` shape: expand from `string` to `{provider, id, name?}` rather than add a separate `getModel()` round-trip.

**Tips/Ideas**:

- Phase 1 (bundling) can be smoke-tested standalone via `get_commands` before Phases 2–5 land.
- Phase 2 (shared contract) is the choke point — once it's in, Phases 3, 4, 5 can be developed in parallel by different agents/sessions.
- Open Q-1 (which subdir under `apps/vscode/`) and Q-2 (build mechanism) should be resolved during `design --approve`; they affect Phase 1.1 only.

**Notes**:

- **[CF-D001.N1]** **[2026-04-26T14:58:19.000Z]** Initial scaffold from `res-afx-chat-foundation.md`. All sections still Draft. `[seed]`

**Related Files**: docs/research/afx/res-afx-chat-foundation.md, docs/research/pi/res-pi-rpc-features.md, docs/research/afx/res-afx-chat-display-surface.md, docs/research/afx/res-afx-product-boundary.md, apps/chat/src/app.tsx, apps/chat/src/views/chat.tsx, apps/chat/src/views/explorer.tsx, apps/vscode/src/agent-factory.ts, packages/agent/pi/src/rpc-manager.ts, packages/shared/src/agent.ts
**Participants**: @richard-sentino

---

### CF-D002 - Composer cleanup, `@` mention, and Settings tab content added to scope

`status:active` `2026-04-26T15:24:16.000Z` `[scope-add, composer, mentions, settings]`

**Context**: User asked design refinement to (1) review research and add `@` reference support, (2) drop unused composer buttons (`+`, `📎`), (3) define what the Settings tab contains. Original brief had Settings as just a one-line disclosure (FR-10).

**Summary**: Added FR-11 (drop unused toolbar buttons), FR-12 (`@` file mention with submit-time expansion), and FR-13 (Settings tab with five sections: Engine, Providers, Chat, Diagnostics, About). New design anchors [DES-MENTION] and [DES-SETTINGS] cover the host-side expansion algorithm and the Settings layout. Two new task phases (6 and 7) added.

**Progress**:

- [x] FR-11/12/13 added to spec
- [x] Acceptance criteria, non-goals, open questions extended
- [x] [DES-MENTION] and [DES-SETTINGS] subsections + ASCII mockups added
- [x] [DES-DEC] table extended with 4 new decisions (file-list source, expansion location, toolbar scope, provider-list source)
- [x] [DES-FILES], [DES-API] expanded with mention/settings files and `SettingsSnapshot` type
- [x] Phase 6 (composer cleanup + mention) and Phase 7 (settings) added to tasks
- [x] Cross-Reference Index extended
- [ ] Spec section approved
- [ ] Design section approved

**Decisions**:

- `@` mention file list source: VSCode `workspace.findFiles` host-side (not Pi RPC). No keystroke round-trip; respects `.vscodeignore`.
- `@` mention expansion location: host-side at the bridge boundary (not chat-app, not Pi tool call). Webview can't read FS; doing it in `sidebar-panel.ts` keeps the chat app pure.
- Composer toolbar: drop `+` and `📎` now (don't keep as future placeholders). Mockups for `[DES-IMPROVEMENTS]` controls (thinking-level, Compact) live in those rows; foundation toolbar shows only what works.
- Settings provider list: derived from `getAvailableModels()` grouped by provider — Pi has no "list providers regardless of auth" RPC, and adding one is unjustified. Showing only providers with at least one available model is honest.
- Mention size cap: 64 KB default; oversize files keep the token with a `[truncated]` marker.

**Tips/Ideas**:

- Tokenizer for `@<path>` should be a pure function in `apps/chat/src/lib/mentions.ts` so it's unit-testable without webview/host plumbing — same pattern as the slash-rewrite test.
- `SettingsSnapshot` is a single round-trip (Settings tab opens → request snapshot → render). No need for live streaming; refresh on tab focus.
- Recently-opened file list can come from `vscode.window.tabGroups.all.flatMap(g => g.tabs)` — no extra state to maintain.

**Notes**:

- **[CF-D002.N1]** **[2026-04-26T15:24:16.000Z]** Spec stayed Draft throughout — no approval demotion needed since gate hadn't been met. `[design-pass]`

**Related Files**: apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/components/mention-popup.tsx (NEW), apps/chat/src/lib/mentions.ts (NEW), apps/vscode/src/panels/sidebar-panel.ts, packages/shared/src/messages.ts
**Participants**: @richard-sentino

---

### CF-D003 - Pi validation pass, Lucide icon legend, runtime abstraction, e2e dropped

`status:active` `2026-04-26T15:39:15.000Z` `[validation, abstraction, testability, lucide, pi-types]`

**Context**: User asked to (1) validate mockups against Pi repo, (2) use real Lucide icons only, (3) make Pi/AgentManager abstraction explicit for future runtimes, (4) skip e2e tests for fast iteration but keep components testable, (5) add Pi-derived improvements.

**Summary**: Read `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts`, `pi-ai/src/types.ts`, `agent-session.ts`, and `slash-commands.ts` end-to-end. Found and fixed several invented claims. Verified all 50+ proposed Lucide icon names against the installed `lucide-react@1.11.0`. Added [DES-ICONS], [DES-ABSTRACTION], [DES-TESTABILITY] subsections. Pi-side findings drove 8 new rows in [DES-IMPROVEMENTS]. Phase 8 (testability harness + abstraction guards) added.

**Progress**:

- [x] Pi RPC types verified — `RpcSlashCommand.source` is exactly `"extension" | "prompt" | "skill"` (no "builtin"); `Model.name` is required; `get_available_models` wraps in `{models: ...}`; `RpcSessionState` shape captured
- [x] `AgentCommand.source` enum corrected — dropped `"builtin"`
- [x] `AgentModel` shape tightened to mirror Pi `Model<TApi>` exactly
- [x] `AgentStatus.model.name` made required (was optional)
- [x] "PI BUILT-INS" group removed from Skills tab + slash popup mockups (was invented — `get_commands` doesn't return TUI built-ins)
- [x] AFX-curated "ACTIONS" group added (compact / new / abort) — these dispatch via `AgentManager` methods, not via `prompt`
- [x] Composer mockups now annotate icons as `[Sparkles]`, `[AtSign]`, `[ArrowUp]`, `[ChevronDown]` — every name verified against `lucide-react@1.11.0`
- [x] [DES-ICONS] subsection added — full Lucide legend with imports
- [x] [DES-ABSTRACTION] subsection added — runtime-agnostic boundary diagram + future-runtime contract
- [x] [DES-TESTABILITY] subsection added — 8 rules ensuring components stay unit-testable without Pi/VSCode
- [x] [DES-TEST] updated — "no e2e changes" now first-class; component tests via vitest + RTL + mock transport
- [x] 8 new Pi-derived rows added to [DES-IMPROVEMENTS] (cycle_model, cycle_thinking_level, steer/follow_up, image input, queue modes, AFX actions, setStatus/setWidget bridge, session import)
- [x] [DES-FILES] expanded with 9 new test/test-utility files; e2e marked NONE
- [x] Phase 8 added (4 task groups: scenarios, mock manager, pure helpers, boundary guards)
- [x] Cross-Reference Index extended

**Decisions**:

- **No `"builtin"` in `AgentCommand.source`** — Pi truth: `get_commands` returns only `extension | prompt | skill`. TUI built-ins (`/quit`, `/login`, `/settings`, …) are not RPC-routable. AFX-curated quick actions (`/compact`, `/new`, `/abort`) are a separate `AgentAction` type that dispatches via `AgentManager` methods, not as text prompts.
- **`AgentModel.name` is required** — matches Pi `Model.name: string` (no `?`). Adapters that don't have a name field must synthesize one from `id`.
- **Lucide-only icon policy** — every icon in `apps/chat/src/**` must be a `lucide-react` import. No emojis, no glyph fonts, no hand-rolled SVGs (except theme-managed brand assets in `packages/ui/src/tokens/`). Verified against installed package.
- **Runtime-agnostic boundary is invariant.** `apps/chat/**` and `packages/shared/**` know nothing about Pi. `agent-factory.ts` is the single Pi-aware site. Future runtimes slot in as `packages/agent/<name>/`. Phase 8.4 guards the boundary with grep tests.
- **No Playwright e2e changes in foundation.** Coverage replacement: vitest + @testing-library/react component tests against `createMockTransport` scenarios; new pure helpers (`mentions.ts`, `composer-detect.ts`, `settings-snapshot.ts`); `createMockAgentManager()` factory. Existing `apps/chat/e2e/chat.spec.ts` stays as-is.

**Tips/Ideas**:

- Pi `cycle_model` and `cycle_thinking_level` could be wired to keyboard shortcuts (⌘P / ⌥⇧T) without UI surface — a "free" win post-foundation.
- Pi `prompt.images?: ImageContent[]` already exists — clipboard-paste image support is two days of work and a real differentiator for chat.
- `extension_ui_request.setStatus`/`setWidget` opens the door to Pi extensions controlling VSCode status bar — interesting for power users.
- The boundary-grep guards (Phase 8.4) double as documentation: anyone who tries to import Pi from chat sees a failing test with a clear error.

**Notes**:

- **[CF-D003.N1]** **[2026-04-26T15:39:15.000Z]** Lucide icon name verification used a one-liner `for n in <names>; do test -f $n.mjs ...` against the installed package's `dist/esm/icons/` dir. All names confirmed. `[lucide]`
- **[CF-D003.N2]** **[2026-04-26T15:39:15.000Z]** Pi-mono read targets: `packages/coding-agent/src/modes/rpc/rpc-types.ts`, `rpc-mode.ts:613-643` (get_commands handler), `core/skills.ts:168-199` (recursive discovery), `core/slash-commands.ts:17-40` (BUILTIN_SLASH_COMMANDS — TUI-only, NOT in get_commands), `core/agent-session.ts:200` (SessionStats), `packages/ai/src/types.ts:426` (Model<TApi>). `[pi-types]`

**Related Files**: docs/specs/chat-foundation/chat-foundation.md, pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts, pi-mono/packages/ai/src/types.ts, apps/chat/src/views/chat.tsx, apps/vscode/src/agent-factory.ts, packages/shared/src/agent.ts
**Participants**: @richard-sentino

---

### CF-D004 - Skill bundling via pnpm sync:skills + remote afx-cli + prune

`status:active` `2026-04-26T16:21:49.000Z` `[skill-bundling, vendor, afx-cli, ci-drift]`

**Context**: Original FR-1 had skill bundling as build-time copy from `afx/skills/agenticflowx/` (gitignored). User asked whether to vendor + commit instead, and whether `afx-cli` already had a "skills-only" option to use as the sync mechanism. Verified afx-cli help and ran a real `--skills-only` dry-run + sync into `/tmp` to inspect actual output.

**Summary**: afx-cli has `--skills-only` but its output is built for "install AFX into a live project" — writes 3 mirrors (`.afx/skills/`, `.agents/skills/`, `.claude/skills/`) plus `.afx.yaml` and `.afx/.cache/`. Wrong shape for VSIX bundling. User chose the pragmatic middle path: keep `afx-cli` as the canonical install mechanism but write a tiny `pnpm sync:skills` wrapper that runs the **remote** `afx-cli` to a tmp dir and prunes everything except the canonical `agenticflowx/` tree (with `assets/`).

**Progress**:

- [x] Verified `afx-cli --skills-only` real output via a temporary sync directory
- [x] FR-1 rewritten — vendor + `pnpm sync:skills` + prune
- [x] FR-2 path noted unchanged (`<extensionPath>/resources/skills`); Pi recurses into `agenticflowx/`
- [x] [DES-DEC] gained 2 new rows: "Skill bundling — vendor vs generated" and "Skill sync mechanism"
- [x] [DES-FILES] gained `apps/vscode/scripts/sync-skills.mjs` (NEW); bundle path = `apps/vscode/resources/skills/agenticflowx/` (vendored, committed)
- [x] [DES-DEPS] documents the remote-fetch dependency, AFX_REF env var, and CI drift job
- [x] Phase 1.1 task rewritten — sync script spec, post-conditions, CI drift job
- [x] Open Q-2 marked Resolved; Q-1 noted as confirmed-during-1.1

**Decisions**:

- **Vendor (commit), not build-generated.** the extension must build standalone with no external checkout dependency. Reviewer sees skill changes inline; CI drift check makes drift loud.
- **Use remote `afx-cli` for sync, not a local source override.** Remote fetch via `https://raw.githubusercontent.com/AgenticFlowX/afx/<ref>/afx-cli` works in any environment with network access.
- **Tiny prune helper, not afx-cli's raw output.** afx-cli writes 3 mirrors (`.afx/`, `.agents/`, `.claude/`) plus config (`.afx.yaml`, `.afx/.cache/`) — that layout is built for live agent harnesses, not artifact bundling. The `sync-skills.mjs` script keeps only `.afx/skills/agenticflowx/` (with per-skill `assets/`) and copies it to `apps/vscode/resources/skills/agenticflowx/`. Result: clean VSIX bundle, ~14 skill dirs instead of 42.
- **`AFX_REF` env var pins the upstream version.** Default `main`. CI uses the same pinned ref; drift = upstream changed but vendored copy didn't. Override locally for testing branch builds.

**Tips/Ideas**:

- A future afx-cli `--bundle` mode (single-tree output for VSIX consumers) could remove this wrapper; until then, the prune is 5–10 lines.
- `AFX_REF` could later be promoted to a top-level AFX config (e.g., `.afx.yaml` in the current build root) so multiple consumers in the current build share the pin.
- Drift CI job catches both directions: upstream changes that need vendoring AND accidental local edits to `apps/vscode/resources/skills/` that don't trace to upstream.

**Notes**:

- **[CF-D004.N1]** **[2026-04-26T16:21:49.000Z]** afx-cli dry-run output: `apps/vscode/resources/.afx/skills/agenticflowx/<skill>/SKILL.md`, `.agents/skills/<skill>/SKILL.md`, `.claude/skills/<skill>/SKILL.md`, `.afx.yaml`, `.afx/.cache/` — 3 mirrors plus config. Confirmed not suitable for direct VSIX bundling. `[verification]`
- **[CF-D004.N2]** **[2026-04-26T16:21:49.000Z]** Per-skill `assets/` are real and matter — `afx-spec`, `afx-design`, `afx-task`, `afx-research`, `afx-sprint`, `afx-session`, `afx-adr` all carry templates loaded by their respective skills at runtime. Sync MUST preserve them. `[assets]`

**Related Files**: apps/vscode/scripts/sync-skills.mjs (NEW), apps/vscode/resources/skills/agenticflowx/**(NEW, vendored), apps/vscode/package.json, .github/workflows/code-qa.yml
**Participants\*\*: @rixrix

---

### CF-D005 - Open questions closed: 15 resolved, 0 outstanding

`status:closed` `2026-04-26T16:31:54.000Z` `[open-questions, defaults, ready-for-approval]`

**Context**: Going into approval, the brief had 7 Spec Open Questions and 8 Design Open Technical Questions. Walked each one — resolved most from code investigation, decided the remaining two with user input.

**Summary**: All 15 open questions now Resolved. User confirmed: bundle the full pack as afx-cli ships it (Spec Q-5); plain `<pre>` with mono font, 200-line cap, Copy button for Pi stderr (Design Q-8). Other 13 settled by reading source: `apps/vscode/.vscodeignore`, `packages/shared/src/messages.ts`, `apps/vscode/src/panels/sidebar-panel.ts`, plus standard VSCode API references (`workspace.findFiles`, `window.tabGroups`).

**Progress**:

- [x] Spec Q-1 (bundle subdir) → vendored at `apps/vscode/resources/skills/agenticflowx/`; `.vscodeignore` doesn't exclude `resources/`
- [x] Spec Q-2 (set_model first-use confirm) → no confirm; FR-10 disclosure
- [x] Spec Q-3 (empty `get_available_models`) → empty-state copy + Settings link (already in [DES-ERR] + mockup)
- [x] Spec Q-4 (workspace vs bundled precedence) → workspace first; bundled `--skill` arg appended after
- [x] Spec Q-5 (bundle scope) → full pack as afx-cli ships it (17 skills today); no AFX-side trim list
- [x] Spec Q-6 (`@` mention file source) → host-side `vscode.workspace.findFiles`
- [x] Spec Q-7 (mention size cap) → 64 KB default + `[truncated]` marker
- [x] Design Q-1 (VSIX `files`/`.vscodeignore`) → no change needed; resources/ ships by default
- [x] Design Q-2 (build mechanism) → already resolved via `pnpm sync:skills`
- [x] Design Q-3 (existing getCommands-shaped event) → no existing pair; introduce new pairs reusing the `requestId` convention
- [x] Design Q-4 (model picker during compaction) → disable combobox while `isCompacting === true`; tooltip prompts user to wait
- [x] Design Q-5 (sidebar-panel constraints) → no global throttling; new pairs use independent `requestId`
- [x] Design Q-6 (findFiles glob) → `workspace.findFiles("**/*", undefined, 200)` — defaults respect `files.exclude` + `.gitignore`
- [x] Design Q-7 (recently-opened MRU source) → `vscode.window.tabGroups.all` (currently-open tabs); no persistent MRU
- [x] Design Q-8 (Pi stderr render) → plain `<pre>` mono, 200-line cap with head-truncation marker, Copy button

**Decisions**:

- **Bundle scope = whatever afx-cli ships.** No AFX-side trim list; if a specific skill misbehaves in chat, fix it upstream or add a runtime filter, not a vendoring exception. Keeps drift detection trivial (one diff, no allowlist).
- **No first-use `set_model` confirm.** Settings discloses the side-effect; Pi-CLI users who hit it will read Settings.
- **Disable combobox during compaction, not queue.** Queueing model changes adds state machinery for an edge condition; disabling is honest and 1-line. Reasoning: Pi `set_model` may reject mid-compaction anyway (compaction holds the session lock).
- **No persistent recently-opened MRU.** `tabGroups.all` is sufficient signal; users mention what they're actively viewing. Avoids one workspace-state migration concern post-foundation.
- **Plain `<pre>` for Pi stderr, not Markdown.** Stack traces and ANSI escapes don't survive markdown rendering. 200-line head-truncation puts the most recent output on screen.

**Tips/Ideas**:

- The `tabGroups` source for "Open Files" generalizes to a future "Recently Closed" tab once VSCode's editor history API is reachable.
- 200-line stderr cap mirrors how the existing tool-call summary renders truncated output. Good consistency.
- 64 KB mention cap could be a `vscode.workspace.getConfiguration("afx").get("mention.fileSizeLimit")` setting later — same shape as `afx.logLevel`.

**Notes**:

- **[CF-D005.N1]** **[2026-04-26T16:31:54.000Z]** Ready for `/afx-sprint spec chat-foundation --approve` — Spec audit (≥1 FR, non-empty Acceptance, no Blocking unresolved) passes. `[approval-ready]`

**Related Files**: docs/specs/chat-foundation/chat-foundation.md, apps/vscode/.vscodeignore, packages/shared/src/messages.ts, apps/vscode/src/panels/sidebar-panel.ts
**Participants**: @richard-sentino

---

### CF-D006 - Tab consolidation + mockup audit (Pi-RPC implementability)

`status:active` `2026-04-26T16:37:37.000Z` `[tabs, mockups, implementability, scope-cut]`

**Context**: User asked whether 4 tabs were needed for foundation given a UI redesign is coming. Then directed: drop Skills tab; keep History; merge skill listing into Settings. Also: "make sure mockups are implementable, no synthetic code — must be from Pi and we can implement it."

**Summary**: Final tabs: **Chat, History, Settings** (3, not 4). Skill listing moves into Settings → Available Skills. All foundation mockups audited against Pi `pi-mono/.../rpc-types.ts` + verified VSCode setting keys; deferred-only items removed from foundation visuals. AgentAction enum trimmed to `"new-session" | "abort"` (foundation can't dispatch `compact()` without growing AgentManager).

**Progress**:

- [x] FR-9 rewritten: drop Explorer; final tabs [Chat, History, Settings]; no Skills tab
- [x] FR-13 expanded with bullet (f) — Available Skills section in Settings
- [x] Acceptance criteria updated: "three tabs (Chat, History, Settings)"; Available Skills section called out
- [x] User Story for skill discovery updated to point at Settings → Available Skills
- [x] Composite chat tab status bar AUDIT: dropped `· high` (thinkingLevel — deferred), `🔧 18` (toolCalls — deferred), `📥 2` (pendingMessageCount — deferred), `💾 38k cached` per-message marker (deferred). Foundation status bar = run dot + model name + context% + cost only.
- [x] Status-bar cell sources table tightened: 4 foundation cells + explicit "Foundation? YES" column; deferred cells listed below table with [DES-IMPROVEMENTS] pointer
- [x] Slash popup mockup ACTIONS group: removed `/compact` (requires growing AgentManager); foundation is `/new` + `/abort` only
- [x] Skills tab subsection rewritten as "Available Skills (Settings section, FR-13.f)" — same content, lives inside Settings
- [x] Settings tab mockup expanded to include AVAILABLE SKILLS section; uses verified VSCode setting keys (`afx.agentBinaryPath`, `afx.agentEphemeralSession`, `afx.logLevel`); icons annotated as Lucide
- [x] @ mention popover groups updated: "RECENTLY OPENED" → "OPEN FILES (vscode.window.tabGroups)"; "WORKSPACE" annotated as `(workspace.findFiles)`; cap shown as "200 cap"
- [x] [DES-OVR], [DES-ARCH] System Context + Component diagrams updated — no more "Skills tab" or `views/skills.tsx`
- [x] [DES-DEC] "Tab cleanup approach" row rewritten: option (x) chosen — drop Explorer + keep History + merge skill listing into Settings
- [x] AgentAction enum: `compact` removed — only `"new-session" | "abort"` for foundation
- [x] [DES-FILES]: dropped `apps/chat/src/views/skills.tsx`, dropped `apps/chat/src/views/skills.test.tsx`; renamed test row to `apps/chat/src/views/settings.test.tsx`; settings.tsx scope grew to include Available Skills
- [x] [DES-ERR]: `get_commands` rejects → Settings empty-state + slash popup falls back to ACTIONS
- [x] [DES-TEST] manual smoke updated: 3 tabs + slash popup verification + Settings → Available Skills verification (no Skills tab in steps)
- [x] [DES-TESTABILITY] sibling-test list: `views/settings.tsx` replaces `views/skills.tsx`
- [x] Phase 5 simplified: just "drop Explorer + finalize TABS to [Chat, History, Settings]" — no Skills tab creation
- [x] Phase 7.2 Settings expanded: Available Skills section spec with explicit group order and click behavior; verified `getStderr()` already exists at `packages/agent/pi/src/rpc-client.ts:57`; "New session" button uses existing `chat/newSession` message
- [x] Cross-Reference Index: dropped 5.2 row

**Decisions**:

- **3 tabs, not 4.** Skills tab was redundant with the slash popup. Settings → Available Skills gives the static scan-list without burning a top-level slot. Saves one view + one component test in foundation.
- **History stays.** Already wired and useful single-session for reviewing past turns; multi-session redesign later will revisit holistically.
- **No `compact()` in foundation AgentManager.** Adding it expands FR-4 contract; not justified for foundation. AFX-curated ACTIONS group is `/new` + `/abort` only. The deferred row in [DES-IMPROVEMENTS] already tracks promotion when ready.
- **Foundation status bar = 4 cells, not 7.** Dropped `thinkingLevel`, `toolCalls`, `pendingMessageCount`, cache-hit indicator from the rendered mockup — they live in [DES-IMPROVEMENTS] until promoted. The deferred items are still real Pi RPC fields, so promotion stays cheap.
- **Mockup icons are 100% Lucide.** Verified all referenced icons in installed `lucide-react@1.11.0`. No emojis, no glyph fonts.
- **Settings VSCode setting keys verified.** `afx.agentBinaryPath` and `afx.agentEphemeralSession` actually exist in `apps/vscode/package.json` (initial reads earlier showed the contributes block). The earlier mockup used `afx.binaryPath`/`afx.ephemeral` which were inaccurate.

**Tips/Ideas**:

- The 3-tab shape gives a clean target for the upcoming design-system pass — fewer surfaces to redesign holistically.
- Available Skills inside Settings means users always have ONE place to scan everything; slash popup is for fast-typing, Settings is for browsing.
- `/compact` could come back as the [DES-IMPROVEMENTS] row "Compact action button (auto-shown ≥ 70%)" lands; that promotion adds `manager.compact()` and a new ACTIONS row in one go.

**Notes**:

- **[CF-D006.N1]** **[2026-04-26T16:37:37.000Z]** Audit pass: every visual element in foundation mockups now traces to a verified Pi RPC field (rpc-types.ts), an existing VSCode API, an existing AgentManager method, or an existing AFX file. Zero synthetic placeholders. `[implementability]`
- **[CF-D006.N2]** **[2026-04-26T16:37:37.000Z]** Pi `getStderr()` exists at `packages/agent/pi/src/rpc-client.ts:57` (the `getStderr: () => stderrBuffer` accessor). Diagnostics → "View buffered stderr" surfaces this verbatim, no new collection logic. `[verified]`

**Related Files**: docs/specs/chat-foundation/chat-foundation.md, apps/vscode/package.json, apps/chat/src/app.tsx, apps/chat/src/views/explorer.tsx, apps/chat/src/views/settings.tsx, packages/agent/pi/src/rpc-client.ts
**Participants**: @richard-sentino

---

### CF-D007 - V1 integration scope and protocol cleanup

`status:closed` `2026-04-26T16:57:14.000Z` `[protocol, ui-primitives, v1-scope, ambiguity-resolved]`

**Context**: User clarified that chat-foundation is v1 of the chatbox with full Pi integration. UI/UX changes will come later, while the design system is still being finalized. Follow-up asked whether the remaining protocol gaps needed user input or could be fixed now.

**Summary**: Tightened the sprint brief so implementation cannot accidentally become a design-system project. The sprint now encodes explicit integration choices for mention expansion, stderr diagnostics, Settings actions, and UI primitive usage.

**Decisions**:

- **`@` mentions use `chat/send.mentions`.** The chat app tokenizes selected `@<path>` references and sends an ordered unique `mentions?: string[]`; the host validates/reads files internally before `AgentManager.send()`. No `chat/readFile` content bridge in v1.
- **Settings actions use transport, not direct manager calls.** Skill rows switch to Chat and insert text through app-level state; `/new` and `/abort` rows dispatch `chat/newSession` / `chat/abort`.
- **Pi stderr is runtime-agnostic.** Add `AgentManager.getStderr()`; Pi returns `PiClient.getStderr()`, future runtimes may return an empty diagnostic buffer.
- **UI is strict on primitives, loose on final visuals.** New controls must compose existing `@afx/ui` shadcn primitives and current tokens. No app-local primitive framework or final UX polish in this sprint.

**Notes**:

- **[CF-D007.N1]** **[2026-04-26T16:57:14.000Z]** Added NFR-6 for `@afx/ui` primitive-only implementation and updated acceptance criteria accordingly. `[ui-primitives]`
- **[CF-D007.N2]** **[2026-04-26T16:57:14.000Z]** Resolved protocol ambiguity: `chat/send` now carries `mentions?: string[]`; `chat/getStderr`, `agent/stderr`, and `chat/openSettings` are explicit shared message variants. `[protocol]`

**Related Files**: docs/specs/chat-foundation/chat-foundation.md, packages/shared/src/messages.ts, packages/shared/src/agent.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/chat/src/app.tsx, apps/chat/src/views/settings.tsx
**Participants**: @richard-sentino

---

### CF-D008 - Spec and design approved

`status:closed` `2026-04-26T17:06:35.000Z` `[approval, sprint-gate, spec, design]`

**Context**: User approved both the Spec and Design sections for `chat-foundation` after the protocol cleanup and v1 integration-scope clarification.

**Summary**: Ran the `/afx-sprint` mini-audits and advanced the sprint approval gate through Design. Tasks remain Draft, so implementation is still gated until `/afx-sprint task chat-foundation --approve`.

**Approval State**:

- Spec: `Approved`
- Design: `Approved`
- Tasks: `Draft`
- Overall sprint status: `Draft`

**Notes**:

- **[CF-D008.N1]** **[2026-04-26T17:06:35.000Z]** Spec audit passed: FRs and acceptance criteria are present; no blocking unresolved Open Questions remain. `[approval]`
- **[CF-D008.N2]** **[2026-04-26T17:06:35.000Z]** Design audit passed: multiple `[DES-*]` sections are present and [DES-DEC] records key decisions. `[approval]`

**Related Files**: docs/specs/chat-foundation/chat-foundation.md
**Participants**: @richard-sentino

---

### CF-D009 - Tasks approved

`status:closed` `2026-04-26T17:13:01.000Z` `[approval, sprint-gate, tasks, implementation-ready]`

**Context**: User approved the Tasks section after the traceability patch added full FR/NFR/DES coverage.

**Summary**: Ran the `/afx-sprint task --approve` mini-audit and advanced the sprint to fully approved. Implementation is now unlocked, with the sprint brief as the source of truth.

**Approval State**:

- Spec: `Approved`
- Design: `Approved`
- Tasks: `Approved`
- Overall sprint status: `Approved`

**Notes**:

- **[CF-D009.N1]** **[2026-04-26T17:13:01.000Z]** Task audit passed: 26 task groups, all with sprint-format `@see` comments. `[approval]`
- **[CF-D009.N2]** **[2026-04-26T17:13:01.000Z]** Coverage passed: 13/13 FRs, 6/6 NFRs, and 18/18 DES sections are referenced by task `@see` comments; malformed checkboxes: 0. `[traceability]`

**Related Files**: docs/specs/chat-foundation/chat-foundation.md
**Participants**: @richard-sentino

---

### CF-D010 - Settings layout retargeted to VSCode sidebar minimum width (170px)

`status:closed` `2026-04-27T01:53:29.000Z` `[design-pivot, settings, ui, narrow-screen]`

**Context**: User flagged Settings as a P1 — looked broken at small/normal sidebar widths. Initial fix used shadcn's `Field orientation="responsive"` which flips at `@md/field-group` (28rem ≈ 448px). Below that the `vertical` variant applies `*:w-full`, stretching the Switch and small icon buttons full-width — visually broken. Above 448px it inlines, but the entire normal VSCode sidebar range (170–400px) sits below that threshold, so users never saw the inlined form anyway.

**Decision**: Drop the responsive `Field` abstraction in [apps/chat/src/views/settings.tsx](../../../apps/chat/src/views/settings.tsx). Replace with explicit per-control row primitives sized for the **170px VSCode sidebar minimum**:

- `SwitchRow` — horizontal at all widths. Label/desc on the left (`flex-1 min-w-0`, wraps), Switch on the right (`shrink-0`).
- `SelectRow` — vertical at all widths. Label/desc on top, NativeSelect full-width below — long option labels (e.g. "All — apply queued messages together") get the full row to render.
- `ConfigField` — label + optional icon-button on a single row (label `flex-1` truncate, button `shrink-0`); value wraps below with `break-all`.

**Rationale**: 170px is the VSCode `Sidebar.MIN_WIDTH` before snap-to-hide. Designing for the breakpoint makes the entire sidebar range usable instead of betting on the user widening past 448px.

**Notes**:

- **[CF-D010.N1]** **[2026-04-27T01:53:29.000Z]** `Field`/`FieldGroup`/`FieldContent`/`FieldLabel`/`FieldDescription` removed from settings.tsx; `Separator` removed (no longer needed — row borders handled by `border-b` on `ConfigField`). `[refactor]`
- **[CF-D010.N2]** **[2026-04-27T01:53:29.000Z]** Type-check + chat build green. Extension bundle rebuilt at out/extension.js (71516 bytes). `[verification]`
- **[CF-D010.N3]** **[2026-04-27T01:53:29.000Z]** **Real root cause** — user re-flagged the issue after the row-primitive rewrite. Settings used radix `<ScrollArea>`, whose viewport auto-injects an inner div with `display: table; min-width: 100%` so the scrollbar can extend full height. That `display: table` makes the inner box width = `max(100%, intrinsic-content-min-width)`, so any non-shrinkable child (e.g. an SVG icon, a Switch, an unbreakable token) dictates the panel's minimum width — content cannot shrink below that, even with `min-w-0`. Replaced with native `<div className="h-full overflow-y-auto …">` matching how the chat tab scrolls. Now layout shrinks freely down to 170px. `[bug-root-cause, scroll-area, narrow-screen]`

**Related Files**: apps/chat/src/views/settings.tsx
**Participants**: @richard-sentino

---

## Prompt Captures

<!-- Verbatim user prompts + agent reply excerpts at pivotal moments. Append-only. -->
<!-- IDs: CF-P001, CF-P002, ... (P for "prompt", distinct from D for "discussion") -->
<!-- Trigger kinds: new-fr | new-nfr | removed-fr | design-pivot | missed-req | scope-cut | ambiguity-resolved | question-resolved | other -->
