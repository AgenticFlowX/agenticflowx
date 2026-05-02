---
afx: true
type: ADR
status: Accepted
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-24T16:19:06.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["adr", "architecture", "vscode-extension", "pi", "engine", "agenticflowx", "rpc"]
---

# ADR-0001: Pi Engine Integration Strategy

## Context

AgenticFlowX is a spec-driven VSCode product surface for agentic development workflows. The first runtime behind that surface is **`pi`** (`@mariozechner/pi-coding-agent`, currently v0.70.2) — a focused coding-agent runtime authored by Mario Zechner.

The extension runs end-to-end against pi: a chat webview sends prompts via a typed `postMessage` bridge to the extension host, which forwards them to a child `pi --mode rpc` process and streams responses back. The Pi integration in `apps/vscode/src/engine/` handles process spawn, restart, JSONL framing, request correlation, and event streaming.

Before investing further in this integration, we need to decide **how AFX integrates with pi long-term**. Three architectural options are on the table:

1. **Pure RPC** (current): spawn `pi --mode rpc`, communicate over JSONL on stdin/stdout
2. **Pure embedded SDK**: import `@mariozechner/pi-coding-agent` directly into the extension and call `createAgentSession()` in-process
3. **Hybrid**: bundle pi but use both — embedded for synchronous calls, subprocess for long-running agent loops

---

## Decision

**Adopt Pure RPC. Do not bundle pi. Do not implement a hybrid path.**

Concretely:

1. **Engine transport**: extension host spawns `pi --mode rpc` as a child process via [`apps/vscode/src/engine/pi-client.ts`](../../apps/vscode/src/engine/pi-client.ts) and communicates over JSONL.
2. **No pi packages in the extension bundle.** `@mariozechner/pi-coding-agent` stays as an extension `devDependency` only (for protocol types like `RpcCommand` / `RpcResponse`), not bundled into `out/extension.js`.
3. **Lean harder on pi's extension points** for AFX-specific behaviour (skills, custom tools, event hooks) instead of building parallel systems in the extension host.

---

## Rationale

### Why not bundle (option 2)

| Concern                      | Detail                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release cadence mismatch** | Pi ships ~2–3 releases per week. Bundling means rebuilding/republishing the extension on every pi update, or tolerating staleness. RPC decouples release cycles.                                                                                                                                                                            |
| **Filesystem assumptions**   | Pi's `ResourceLoader` eagerly reads `~/.pi/auth.json`, `~/.pi/models.json`, `~/.pi/skills/`, project-local `.pi/` config, and extensions from disk. All of these assume a CLI process lifestyle. Embedding into a VSCode extension requires a custom ResourceLoader for the sandbox — a multi-week rabbit hole with no user-visible payoff. |
| **Crash isolation lost**     | A pi-side crash (network timeout, OOM, infinite loop in a tool) currently terminates the subprocess and we restart cleanly. Embedded, it would take down the extension host.                                                                                                                                                                |
| **TUI imports leak in**      | `pi-coding-agent` imports `@mariozechner/pi-tui` transitively for interactive mode. Bundling requires `external: ['@mariozechner/pi-tui']` in esbuild and careful tree-shaking. Easy to get wrong.                                                                                                                                          |
| **No real upside**           | Subprocess startup is ~50ms once per session. Negligible for an interactive sidebar. There is no latency-sensitive call pattern that justifies embedding.                                                                                                                                                                                   |

### Why not hybrid (option 3)

| Concern                    | Detail                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Two code paths**         | Every feature needs to decide "is this fast enough for in-process, or does it go through RPC?" — and the answer drifts as pi's API evolves.                                                |
| **State synchronisation**  | Embedded SDK has its own `AgentSession` instance; RPC subprocess has another. Reconciling session state, message history, tool execution status across both is a known class of hard bugs. |
| **Solves no real problem** | The only argument for hybrid is "what if subprocess overhead becomes a bottleneck?" — there is no measurement showing this is the case.                                                    |

### Why pure RPC wins

- **Architectural cleanliness**: the extension host owns VSCode integration; pi owns agent orchestration; the boundary is one typed JSONL protocol.
- **Pi-mono is already designed for this**: `pi --mode rpc` is a first-class entry point with documented, stable protocol (`pi-mono/packages/coding-agent/docs/rpc.md`).
- **Crash-safe**: pi can die and we restart it. The `pi-manager.ts` lifecycle handles this cleanly.
- **Debuggable**: the entire engine surface is observable as JSONL on a pipe. We can `tee` it to a log file and replay later.

---

## What pi-mono offers that we should adopt

### 1. Skills (`.pi/skills/*.md`)

Pi loads markdown files with YAML frontmatter from `~/.pi/skills/` and project-local `.pi/skills/` and exposes them as `/skill-name` slash commands.

**Implication for AFX**: AFX prompt templates (spec scaffolding, ADR creation, journal entries, the entire `/afx-*` command surface) should ship as pi skills, not as a separate prompt system inside the extension. This is a single source of truth and gets us VSCode + CLI parity for free.

### 2. Custom tools via `ToolDefinition[]`

Pi accepts custom tools registered via `createAgentSession({ customTools: [...] })`. Tools are pure functions with a JSON schema — pi handles the model wiring.

**Implication for AFX**: AFX-specific actions (e.g., `afx.scaffoldSpec`, `afx.appendJournal`, `afx.checkLinks`) should be pi tools, not extension-host commands the model has to be told about separately. The model invokes them naturally during agent loops.

### 3. Extension hooks for cross-cutting concerns

Pi's extension system exposes lifecycle hooks (`before_agent`, `before_provider_request`, `on_turn_end`, `on_session_compact`) and a UI sub-protocol for dialogs.

**Implication for AFX**: telemetry, audit trails, traceability checks (the `/afx-check trace` workflow) are extension hooks on the pi side, not host-side wrappers around the RPC protocol.

### 4. MCP (deliberate non-decision)

Pi explicitly does **not** ship built-in MCP support: _"Build CLI tools with READMEs (see Skills), or build an extension that adds MCP support."_

**Implication for AFX**: if/when we want MCP, it goes in as a pi extension, **not** as host-side MCP hub code.

---

## Consequences

### Positive

- **Sharp boundary**: extension host = VSCode integration + UI; pi = agent + tools + sessions + skills. No engine code in the host repo.
- **Crash isolation maintained**: pi failures don't take down the editor.
- **Independent release cycles**: pi can ship daily without forcing extension republish.
- **Closer to pi's grain**: by moving prompts → skills and tools → pi `customTools`, AFX-specific behaviour ships as data + extension code that pi treats as first-class.

### Negative / accepted trade-offs

- **One subprocess per session**: ~50ms startup, ~50–100MB resident. Acceptable for a single-user IDE.
- **JSONL protocol coupling**: when pi changes the RPC protocol (rare — mostly additive changes), our dispatcher needs to keep up. We accept this risk in exchange for architectural cleanliness.
- **No in-process synchronous calls**: any "give me the model name" or "what's the current session id" requires a roundtrip. We mitigate by caching aggressively in the host.
- **Auth interop work needed**: pi has its own `AuthStorage` that reads from `~/.pi/auth.json`. The extension uses `context.secrets`. A small bridge is needed. See research doc [`docs/research/pi/res-pi-integration-strategy.md`](../research/pi/res-pi-integration-strategy.md) for the recommended `setFallbackResolver` approach.

### Risks

- **Pi project health**: we are strategically dependent on a single-author OSS project. Mitigations: (a) the project is active with frequent releases, (b) it's MIT-licensed and we can fork if needed, (c) pi's design is well-modularised so a fork would be tractable, (d) the RPC protocol is documented and we could reimplement against the same protocol.
- **Skills format lock-in**: by moving prompt templates to pi skills, our content depends on pi's skill loader. If we ever need to use the same prompts outside pi, we'd need to extract them.

---

## First-run & packaging concerns

### 1. Installing pi when the AFX extension is installed

**Problem**: the extension requires `pi` on `PATH` (or at a configured path — see `afx.agentBinaryPath` setting). If it's missing, the sidebar shows `engine not connected` and the user has no obvious remediation.

**Recommendation**: On activation, probe `pi --version`. If missing, show a notification: _"AFX needs pi. Install with `npm i -g @mariozechner/pi-coding-agent`? [Install] [I'll do it myself] [Use custom path]"_. "Install" runs the command in a VSCode terminal so the user sees the output. Cache the "user dismissed" answer in globalState to avoid nagging.

### 2. Configuring providers through AFX settings

**Problem**: pi manages its own provider auth in `~/.pi/auth.json` via `AuthStorage`. The extension manages API keys via `context.secrets`. Today these are two unrelated secret stores.

**Recommendation (MVP)**: When spawning pi, pass `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. via the child-process `env`. Pi's provider registry already picks up env vars. Later: investigate whether `pi --mode rpc` exposes a `set_auth` runtime command (Option C in the research doc) so keys stay in OS keychain and never hit disk.

### 3. Shipping AFX skills

**Recommendation**: The VSCode extension itself does **not** bundle skills as files. It ships commands that invoke `afx-cli` via terminal delegation. `afx-cli` is responsible for writing skills into `~/.pi/skills/<pack-name>/`. This preserves a single source of truth for skills (the `afx/` repo) and gives users pack-level granularity.

---

## What this ADR explicitly does NOT decide

- **API key / auth bridging** between extension `context.secrets` and pi's `AuthStorage` — separate ADR.
- **Prompt template migration plan** from existing AFX commands → pi skills — needs a tasks.md.
- **Custom tool inventory** for AFX — needs a design doc enumerating which `/afx-*` commands become tools.
- **Settings UI ↔ pi settings** mapping — defer until pi's settings shape stabilises.

---

## Open questions for follow-up ADRs

1. **Auth storage bridge**: how does `context.secrets` interop with pi's `AuthStorage`? Single source of truth or two-way sync?
2. **Skills migration plan**: which existing `/afx-*` commands become pi skills, in what order?
3. **Custom tool inventory**: full list of AFX-specific tools to register via pi's `customTools`.
4. **Settings mapping**: when do we expose pi settings in the AFX settings UI vs. defer to `pi --mode interactive` for power users?
5. **MCP-as-pi-extension**: design and timeline if/when we add MCP.
6. **Multi-workspace support**: one pi process per workspace folder, or one shared?

---

## References

- Pi integration: [`apps/vscode/src/engine/pi-client.ts`](../../apps/vscode/src/engine/pi-client.ts), [`apps/vscode/src/engine/pi-manager.ts`](../../apps/vscode/src/engine/pi-manager.ts)
- Integration research: [`docs/research/pi/res-pi-integration-strategy.md`](../research/pi/res-pi-integration-strategy.md)
- Pi RPC protocol docs: `pi-mono/packages/coding-agent/docs/rpc.md`
- Pi SDK docs: `pi-mono/packages/coding-agent/docs/sdk.md`
