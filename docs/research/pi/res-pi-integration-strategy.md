---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T02:19:44.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "pi-integration", "product-boundary", "security", "modes", "auth"]
---

# Pi Integration Strategy: What AFX Builds vs. What Pi Provides

## Context

AgenticFlowX is a spec-driven VSCode product surface for agentic development workflows. The first runtime behind that surface is Pi (`@mariozechner/pi-coding-agent`).

This research answers: **what should AFX build natively, and what should it delegate to Pi?**

Constraints:

- Keep the product surface lean — rely on Pi for runtime concerns; AFX owns its own security layer.
- AFX is spec-driven (`spec.md` / `design.md` / `tasks.md` are the source of truth).
- MCP, code-index, checkpoints — deferred.
- Auth: API keys live in VSCode `SecretStorage`. Pi's existing `auth.json` users keep working. Both must co-exist.
- **AFX-native concerns** (security, modes, spec-awareness) stay runtime-agnostic. **Runtime concerns** (Pi adapter, hook wiring, auth bridge) live in a clearly-named adapter package so the runtime can be swapped without rewriting AFX.

---

## Findings

### 1. Pi covers the agent runtime completely

Pi (`@mariozechner/pi-coding-agent` and friends) provides a complete agent runtime:

| Capability                 | Pi equivalent                                                                               | Verdict      |
| -------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| File read/write/edit tools | `read`, `write`, `edit` built-in                                                            | **delegate** |
| Command execution          | `bash` built-in (streaming, truncation, `/tmp` spill, process-tree cleanup)                 | **delegate** |
| Search/list tools          | `grep`, `find`, `ls` built-in                                                               | **delegate** |
| Provider adapters          | `@mariozechner/pi-ai` (25+ providers, OAuth + API key + dynamic discovery)                  | **delegate** |
| Agent loop                 | `@mariozechner/pi-agent-core` (tool execution loop, AbortSignal, parallel/sequential modes) | **delegate** |
| Session branching          | Pi `/tree`, `/fork`, `/clone` slash commands                                                | **delegate** |
| Clarification flow         | Pi interactive TUI handles clarification natively                                           | **delegate** |
| Skill loading              | Pi Agent Skills standard (auto-discovers `.claude/skills/`, `~/.pi/agent/skills/`, etc.)    | **delegate** |
| Slash commands             | Pi has slash commands as a first-class concept                                              | **delegate** |
| Code-index / vector search | Pi deferred — causes freezes at scale                                                       | **defer**    |
| Checkpoints                | Pi sessions cover most use cases                                                            | **defer**    |
| MCP tools                  | Per product direction                                                                       | **defer**    |

### 2. AFX-native capabilities to build

These are the four things AFX adds that no upstream agent runtime provides. They are runtime-agnostic by design.

| Item                                                                    | LoC estimate | Priority |
| ----------------------------------------------------------------------- | ------------ | -------- |
| `parseCommand()` + `containsDangerousSubstitution()` — command security | ~600         | Tier 0   |
| 14 ModeConfigs (5 General + 9 Focus) + `ActiveModeStore`                | ~400         | Tier 1   |
| `tool-repetition-detector`                                              | ~95          | Tier 1   |
| Spec-awareness prompt section                                           | ~60          | Tier 1   |

### 3. Pi `beforeToolCall` hook is the integration point

Verified in `pi-mono/packages/agent/src/types.ts`:

```ts
beforeToolCall?: (
  ctx: BeforeToolCallContext,
  signal?: AbortSignal
) => Promise<BeforeToolCallResult | undefined>;

interface BeforeToolCallResult { block?: boolean; reason?: string; }
interface BeforeToolCallContext {
  assistantMessage: AssistantMessage;
  toolCall: AgentToolCall;
  args: unknown;
  context: AgentContext;
}
```

A single composite hook chains AFX's three concerns:

1. **Security**: parse `bash` command → check dangerous substitution → check allow/deny prefixes
2. **Repetition**: hash tool-call signature → block if seen N times in window
3. **Mode permission**: look up active mode → check `toolCall.name` against `mode.allowedTools`

All three return the same `{ block, reason }` shape. No agent forking, no loop re-implementation.

### 4. Pi auth precedence map (the co-existence contract)

From `pi-mono/packages/coding-agent/src/core/auth-storage.ts`:

```text
1. runtimeOverrides Map     ← authStorage.setRuntimeApiKey(provider, key)
2. stored auth.json         ← ~/.pi/agent/auth.json (mode 0600, file-locked)
3. env vars                 ← getEnvApiKey(provider) → ANTHROPIC_API_KEY, etc.
4. fallbackResolver         ← authStorage.setFallbackResolver(p => …)
```

Two co-existence strategies, both supported without forking Pi:

| Strategy                                               | How                                                               | UX                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------ |
| **AFX overrides Pi**                                   | `setRuntimeApiKey()` at startup with VSCode `SecretStorage` value | AFX-stored key always wins                             |
| **Pi takes precedence, AFX as fallback** (recommended) | `setFallbackResolver(p => secretStorage.get(`afx.${p}`))`         | Pi-existing-users see zero change; AFX only fills gaps |

Recommendation: ship the **fallback-resolver** path by default. Add an `/afx-auth promote` slash command later to migrate a SecretStorage key into Pi's `auth.json` if a user wants to consolidate.

### 5. Pi has no built-in mode/skill state

`AgentSession` tracks scoped models, steering messages, compaction state, retries, and pending follow-ups — but **no active-mode field**. Skills in Pi are per-invocation (`<skill>` block expansion), not stateful.

AFX owns mode state.

| State                     | Storage                                                       |
| ------------------------- | ------------------------------------------------------------- |
| Active mode (per session) | VSCode `Memento` (workspaceState), `Map<sessionId, modeSlug>` |
| API/auth keys             | VSCode `SecretStorage`                                        |
| Skills/prompts/themes     | Pi's resource-loader auto-discovers from convention dirs      |

### 6. AFX modes — the full set worth building

**General track** (5): `architect`, `code`, `ask`, `debug`, `orchestrator`

**Focus track** (9, AFX-native):

| Mode                  | Maps to slash command                 |
| --------------------- | ------------------------------------- |
| `focus-review-spec`   | `/afx-spec review`                    |
| `focus-review-design` | `/afx-design review`                  |
| `focus-review-tasks`  | `/afx-task list` / `/afx-task status` |
| `focus-research`      | `/afx-research explore`               |
| `focus-discover`      | `/afx-discover capabilities`          |
| `focus-next`          | `/afx-next`                           |
| `focus-code`          | `/afx-task code`                      |
| `focus-debug`         | `/afx-dev debug`                      |
| `focus-refactor`      | `/afx-dev refactor`                   |

Modes set persona; slash commands route to it. Same intent surface, different invocation form.

Use flat `ModeConfig[]` with `{slug, name, whenToUse, allowedTools: string[], prompt}`. Skip Zod schemas, custom-mode override files, mode export/import.

---

## Analysis

### AFX is the product surface. Pi is the runtime

Pi is the runtime because it supplies the low-level agent loop, model/auth surface, tools, and streaming behavior that AFX should not reimplement. Pi is not AFX's identity and is not contractually permanent.

The four things AFX brings that no upstream agent runtime provides — these are runtime-agnostic by design:

1. **Spec-driven discipline** — `tasks.md` is the truth, not chat state
2. **Modes with intent** — General × Focus dual-track
3. **Command-execution safety** — runtimes typically punt this; AFX makes it mandatory
4. **Loop / repetition guard** — prevents agent spin-loops

These belong in pure, runtime-agnostic packages (`packages/security`, `packages/modes`, `packages/policy`). The runtime adapter (`packages/agent/pi`) is the only place that knows about Pi's `beforeToolCall`, `transformContext`, or `authStorage` shapes.

### Runtime-adapter boundary

A small, named adapter layer is the swap point:

```text
AFX core (runtime-agnostic)             Runtime adapter (Pi today)
─────────────────────────────           ──────────────────────────
ToolCallPolicy.evaluate(call) →   →     Pi beforeToolCall hook
SystemPromptInjection.render() →   →    Pi transformContext call
AuthResolver.resolve(provider) →   →    Pi authStorage.setFallbackResolver
ActiveModeStore (VSCode memento)        Pi sessionId → modeSlug lookup
```

If Pi is swapped for a different runtime, the AFX core packages don't change — only the runtime adapter is rewritten. This is the architectural promise that lets the runtime choice stay reversible.

### Why a single composite tool-call gate

Whatever the runtime, three concerns (security, repetition, mode-permission) all answer the same question: "should this tool call run?" All return the same shape: `{ block, reason }`. Composing them as one ordered chain in a runtime-agnostic `ToolCallPolicy` interface, then wiring that into the runtime's hook surface in the adapter, keeps the agent loop clean.

Pi's `beforeToolCall` fits this shape perfectly. So would any custom agent SDK's pre-tool middleware. The interface generalizes; the wiring stays in the adapter.

### Why mode state lives in VSCode, not the runtime

Mode is identity-and-policy state (which persona is active, which tools are allowed). Runtime sessions are content-and-history state (messages, compaction, retries). Different concerns, different store. Putting mode state in VSCode `workspaceState` is also runtime-agnostic — it survives a runtime swap.

### Why fallback-resolver beats runtime-override for auth

`setRuntimeApiKey` would silently shadow a user's existing `auth.json`. A Pi-CLI user who also installs the extension would see their CLI keys quietly route through VSCode SecretStorage without consenting to it. `setFallbackResolver` only fills gaps, preserves explicit user choice, and keeps migration opt-in. The same principle applies to any future runtime: AFX's auth resolver should be a fallback, not a hijacker.

---

## Recommendations

### Future package layout

```text
packages/
│   ├── security/        ← AFX-NATIVE, runtime-agnostic
│   │                       parseCommand + dangerous-substitution + allow/deny  (~600 LoC pure)
│   ├── modes/           ← AFX-NATIVE, runtime-agnostic
│   │                       14 ModeConfigs + flat allowedTools[] + ActiveModeStore  (~400 LoC)
│   ├── policy/          ← AFX-NATIVE, runtime-agnostic
│   │                       ToolCallPolicy interface (composes security + repetition + mode-perm)
│   │                       SystemPromptInjection interface (spec-awareness)
│   │                       AuthResolver interface (VSCode SecretStorage bridge)
│   ├── agent/
│   │   └── pi/          ← RUNTIME ADAPTER
│   │                       Wires AFX policies into Pi's hook surface:
│   │                       • beforeToolCall: ToolCallPolicy.evaluate() → { block, reason }
│   │                       • transformContext: SystemPromptInjection.render()
│   │                       • authStorage.setFallbackResolver(AuthResolver.resolve)
│   │                       • workspaceState memento: Map<sessionId, modeSlug>
│   │                       • Pi slash command surface: /afx-* via skill discovery
│   ├── parsers/         ← EXISTS: spec/tasks/journal/frontmatter
│   ├── shared/          ← EXISTS: common types
│   ├── transport/       ← EXISTS
│   └── ui/              ← EXISTS
└── apps/
    ├── chat/            ← Composes Pi adapter + AFX core packages → Pi-backed agent surface
    └── vscode/          ← EXISTS (webview shell)
```

The AFX-native packages have **zero Pi dependencies**. Swapping runtimes means rewriting `packages/agent/pi/` only.

### Surface budget

- **AFX-native** (~1,100 LoC): security 600, modes 400, repetition 95, spec-awareness 60
- **Pi runtime adapter** (~400 LoC): Pi hook wiring, auth bridge, mode-state lookup
- **VSCode glue** (~100 LoC): SecretStorage adapter, workspaceState memento
- **Tests** (~1,500 LoC)
- **Total ~3,000 LoC** for the agent

### Explicit non-goals

- No MCP layer
- No code-index package
- No checkpoints layer
- No apply-diff / apply-patch / search-and-replace tools
- No custom-mode file loader (deferred)
- No in-house provider adapters (runtime covers them)
- No in-house agent loop (runtime covers it)

### ADRs to write

**AFX-native (runtime-agnostic)**:

1. **ADR-A**: `ToolCallPolicy` — composite gate chaining security → repetition → mode-permission
1. **ADR-B**: Modes — flat tool permissions, VSCode `workspaceState`-stored, no custom-mode file format
1. **ADR-D**: Explicit non-goals and deferred scope

**Runtime-adapter (Pi-specific)**:

1. **ADR-C**: Pi adapter — wires `ToolCallPolicy` to `beforeToolCall`, `AuthResolver` to `setFallbackResolver`, mode-state via `sessionId` lookup

### Decision Readiness

**Ready for ADR**: All four candidates above (single-option decisions, validated against Pi source for ADR-C).

**Ready for spec**: A foundation spec at `docs/specs/001-overview/` absorbs the AFX-native decisions; the runtime-adapter contract lives alongside as the Pi-specific ADR.

---

## Pi source paths (integration points)

- `pi-mono/packages/agent/src/types.ts` — `BeforeToolCallContext`, `BeforeToolCallResult`, `transformContext` shape
- `pi-mono/packages/coding-agent/src/core/auth-storage.ts` — auth precedence (runtimeOverrides → stored → env → fallback)
- `pi-mono/packages/coding-agent/src/core/agent-session.ts` — confirms no built-in mode/skill state
- `pi-mono/packages/coding-agent/src/core/slash-commands.ts` — built-in slash command set
