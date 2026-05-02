---
afx: true
type: RES
status: Living
owner: "@rixrix"
created_at: "2026-04-26T02:19:44.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "pi-integration", "product-boundary", "security", "modes", "auth"]
---

# AFX Product Boundary and Pi Runtime Responsibilities

## Context

AFX is a VSCode product surface for spec-driven agentic workflows. Pi is the current coding-agent runtime behind that surface. This research separates what AFX must own from what the runtime already provides.

This research answers: **what belongs in AFX, what belongs in the Pi adapter, and what should stay out of the product surface for now?**

Triggering constraints:

- Keep the foundation lean: usable, Pi-backed, and protected by AFX's own safety layer.
- AFX is spec-driven (`spec.md` / `design.md` / `tasks.md` are the source of truth). Ephemeral todo-list tools are redundant unless they sync back to that system.
- MCP, code-index, checkpoints — all deferred until there is a specific product need.
- Auth: API keys live in VSCode `SecretStorage`. Pi's existing `auth.json` users keep working. Both must co-exist.
- Architectural rule: **AFX-native concerns** (security, modes, spec-awareness) stay runtime-agnostic. **Runtime concerns** (Pi adapter, hook wiring, auth bridge) live in a clearly named adapter package so the runtime can be changed without rewriting AFX.

---

## Findings

### 1. Pi already covers the low-level agent runtime

Pi (`@mariozechner/pi-coding-agent` and friends) provides a complete agent runtime:

| Runtime concern                                                  | Pi equivalent                                                                               | Verdict   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------- |
| `read-file-tool`, `write-to-file-tool`, `edit-file-tool`         | `read`, `write`, `edit` built-in                                                            | **drop**  |
| `execute-command-tool`                                           | `bash` built-in (streaming, truncation, `/tmp` spill, process-tree cleanup)                 | **drop**  |
| `search-files-tool`, `list-files-tool`                           | `grep`, `find`, `ls` built-in                                                               | **drop**  |
| `output-interceptor.ts` (436 LoC)                                | Pi bash output truncation + `/tmp/pi-bash-*.log` spill                                      | **drop**  |
| `packages/providers/` (16+ adapters)                             | `@mariozechner/pi-ai` (25+ providers, OAuth + API key + dynamic discovery)                  | **drop**  |
| `packages/core/` agent loop                                      | `@mariozechner/pi-agent-core` (tool execution loop, AbortSignal, parallel/sequential modes) | **drop**  |
| `update-todo-list-tool`                                          | AFX `tasks.md` is the truth; Pi `/tree` covers session branching                            | **drop**  |
| `new-task-tool`                                                  | Pi `/fork`, `/clone`, `/tree` slash commands                                                | **drop**  |
| `ask-followup-question-tool`                                     | Pi interactive TUI handles clarification natively                                           | **drop**  |
| `skill-tool`                                                     | Pi Agent Skills standard (auto-discovers `.claude/skills/`, `~/.pi/agent/skills/`, etc.)    | **drop**  |
| `run-slash-command-tool`                                         | Pi has slash commands as a first-class concept                                              | **drop**  |
| `attempt-completion-tool`                                        | Replaceable: model edits `tasks.md` → `/afx-task verify` validates outside the loop         | **drop**  |
| `switch-mode-tool`                                               | Pi slash command pattern (`/mode <slug>`)                                                   | **drop**  |
| `apply-patch-tool`, `search-and-replace-tool`, `apply-diff-tool` | Pi's `edit` is enough; **fewer diff variants = less surface to fail**                       | **drop**  |
| `code-index/` package                                            | Heavy indexing has high performance risk                                                    | **defer** |
| `checkpoints/` package                                           | Pi sessions cover most use cases                                                            | **defer** |
| All MCP tools                                                    | Per user direction                                                                          | **defer** |

### 2. AFX-owned capabilities worth carrying forward

| Capability                                         | Purpose                                                       | Status                          |
| -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| `parseCommand()`                                   | Shell-command parsing for safety policy                       | **carry forward (Tier 0)**      |
| `containsDangerousSubstitution()` + decision logic | Block risky command-substitution patterns before host execute | **carry forward (Tier 0)**      |
| Mode configs                                       | Product intent and tool permissions                           | **carry forward (Tier 1)**      |
| `tool-repetition-detector`                         | Prevent repeated failing tool loops                           | **carry forward (Tier 1)**      |
| Spec-awareness prompt section                      | Keep agent turns anchored to AFX specs/tasks/journals         | **carry forward (Tier 1)**      |
| Slim `.afxrules` reader                            | Workspace-local policy hints                                  | **reconsider after foundation** |

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

```
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

Recommendation: ship the **fallback-resolver** path by default. Add a `/afx-auth promote` slash command later to migrate a SecretStorage key into Pi's `auth.json` if a user wants to consolidate.

### 5. Pi has no built-in mode/skill state

`AgentSession` (3,089 LoC, `pi-mono/packages/coding-agent/src/core/agent-session.ts`) tracks scoped models, steering messages, compaction state, retries, and pending follow-ups — but **no active-mode field**. Skills in Pi are per-invocation (`<skill>` block expansion), not stateful.

So AFX owns mode state.

| State                     | Storage                                                       |
| ------------------------- | ------------------------------------------------------------- |
| Active mode (per session) | VSCode `Memento` (workspaceState), `Map<sessionId, modeSlug>` |
| API/auth keys             | VSCode `SecretStorage`                                        |
| Skills/prompts/themes     | Pi's resource loader auto-discovers from convention dirs      |

### 6. AFX modes — the product intent surface

AFX modes are a product intent surface, not runtime state. The Focus track maps 1:1 to AFX slash commands.

**General track**: `architect`, `code`, `ask`, `debug`, `orchestrator`

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

For the foundation: flat `ModeConfig[]` with `{slug, name, whenToUse, allowedTools: string[], prompt}`. Skip Zod schemas, custom-mode override files, mode export/import.

### 7. Runtime risk check

| Failure mode             | AFX mitigation                                                           |
| ------------------------ | ------------------------------------------------------------------------ |
| 1. Loops on tool calls   | `tool-repetition-detector` ported as `beforeToolCall` hook               |
| 2. Terminal breaks       | Rely on Pi's bash handling (process-tree, signal cleanup, spill)         |
| 3. apply_diff failures   | Drop apply-diff/apply-patch/search-and-replace; Pi range `edit` only     |
| 4. Indexing pain         | Defer `code-index`; `/afx-discover` reads `docs/specs/` directly         |
| 5. MCP fragility         | Defer MCP entirely                                                       |
| 6. Network/auth          | Pi handles 25+ providers with mature auth                                |
| 7. Cost unpredictability | Pi has context compaction; add `afterToolCall` cost-telemetry hook later |
| 8. Provider mismatch     | Pi's unified adapter layer + dynamic model discovery                     |
| 9. Safety/trust problems | Mandatory security hook is the headline AFX value                        |

Every defer/drop maps to a documented failure pattern. This is defensive design, not minimalism for its own sake.

---

## Analysis

### AFX is the product surface. Pi is the runtime

AFX is its own product: a spec-driven workflow layer inside VSCode. Pi is the runtime choice for the foundation because it supplies the low-level agent loop, model/auth surface, tools, and streaming behavior that AFX should not reimplement. Pi is not AFX's identity, and it is not contractually permanent.

The four things AFX brings are runtime-agnostic by design:

1. **Spec-driven discipline** — `tasks.md` is the truth, not chat state
2. **Modes with intent** — General × Focus dual-track (already in the current build README)
3. **Command-execution safety** — runtimes typically punt this; AFX makes it mandatory
4. **Loop / repetition guard** — direct codex-issue mitigation

These belong in pure, runtime-agnostic packages (`packages/security`, `packages/modes`, `packages/policy`). The runtime adapter (`packages/agent/pi`) is the only place that knows about Pi's `beforeToolCall`, `transformContext`, or `authStorage` shapes.

### Runtime-adapter boundary

A small, named adapter layer is the swap point:

```
AFX core (runtime-agnostic)             Runtime adapter (Pi today)
─────────────────────────────           ──────────────────────────
ToolCallPolicy.evaluate(call) →   →     Pi beforeToolCall hook
SystemPromptInjection.render() →   →    Pi transformContext call
AuthResolver.resolve(provider) →   →    Pi authStorage.setFallbackResolver
ActiveModeStore (VSCode memento)        Pi sessionId → modeSlug lookup
```

If AFX changes runtime later, the AFX core packages don't change — only the runtime adapter is rewritten. This is the architectural promise that lets the choice of Pi stay reversible.

### Why a single composite tool-call gate

Whatever the runtime, three concerns (security, repetition, mode-permission) all answer the same question: "should this tool call run?" All return the same shape: `{ block, reason }`. Composing them as one ordered chain in a runtime-agnostic `ToolCallPolicy` interface, then wiring that into the runtime's hook surface in the adapter, keeps AFX free of agent-loop entanglement.

Pi's `beforeToolCall` happens to fit this shape perfectly. So would custom runtime's tool-call interception, or any custom Claude SDK build's pre-tool middleware. The interface generalizes; the wiring stays in the adapter.

### Why mode state lives in VSCode, not the runtime

Mode is identity-and-policy state (which persona is active, which tools are allowed). Runtime sessions are content-and-history state (messages, compaction, retries). Different concerns, different store. Putting mode state in VSCode `workspaceState` is also runtime-agnostic — it survives a runtime swap.

### Why fallback-resolver beats runtime-override for auth

For Pi specifically, `setRuntimeApiKey` would silently shadow a user's existing `auth.json`. A Pi CLI user who installs AFX would see their CLI keys quietly route through VSCode SecretStorage without consenting to it. `setFallbackResolver` only fills gaps, preserves explicit user choice, and keeps migration opt-in (`/afx-auth promote`). The same principle applies to any future runtime: AFX's auth resolver should be a fallback, not a hijacker.

---

## Recommendations

### Final package layout

```
.
├── packages/
│   ├── security/        ← AFX-NATIVE, runtime-agnostic
│   │                       parseCommand + dangerous-substitution + allow/deny  (~600 LoC pure)
│   ├── modes/           ← AFX-NATIVE, runtime-agnostic
│   │                       14 ModeConfigs + flat allowedTools[] + ActiveModeStore  (~400 LoC)
│   ├── policy/          ← AFX-NATIVE, runtime-agnostic — NEW
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

The AFX-native packages have **zero Pi dependencies**. Changing runtimes means rewriting only the runtime adapter.

### Foundation surface budget

- **AFX-native** (~1,100 LoC ports): security 600, modes 400, repetition 95, spec-awareness 60
- **Pi runtime adapter** (~400 LoC): Pi hook wiring, auth bridge, mode-state lookup
- **VSCode glue** (~100 LoC): SecretStorage adapter, workspaceState memento
- **Tests** (~1,500 LoC)
- **Total ~3,000 LoC** for the foundation

### Foundation explicit non-goals

Each maps to a documented risk above:

- No MCP layer
- No code-index package
- No checkpoints layer
- No apply-diff / apply-patch / search-and-replace tools
- No custom-mode file loader (`.afxmodes/` deferred)
- No in-house provider adapters (runtime covers them)
- No in-house agent loop (runtime covers it)
- No `update_todo_list` / `new_task` / `ask_followup_question` / `skill_tool` / `run_slash_command` tools (runtime-native equivalents)

### ADRs ready to write

Two layers of decisions — keep them separate so the runtime-adapter ADR can be revisited independently if AFX swaps runtimes later.

**AFX-native (runtime-agnostic)**:

1. **ADR-A**: `ToolCallPolicy` — composite gate chaining security → repetition → mode-permission
2. **ADR-B**: AFX modes — flat tool permissions, VSCode `workspaceState`-stored, no custom-mode file format in the foundation
3. **ADR-D**: Foundation explicit non-goals

**Runtime-adapter (Pi-specific foundation work)**:

1. **ADR-C**: Pi adapter — wires `ToolCallPolicy` to `beforeToolCall`, `AuthResolver` to `setFallbackResolver`, mode-state via `sessionId` lookup

### Decision Readiness

**Ready for ADR**: All four candidates above.

**Ready for spec**: A foundation spec can absorb ADR-A/B/D (the AFX-native decisions); ADR-C lives alongside as the runtime-adapter contract.

---

## References

### Historical implementation notes

- Shell parsing and dangerous-substitution checks are existing AFX concepts worth carrying forward into a runtime-agnostic safety package.
- Tool repetition detection is worth carrying forward as a policy concern, not as runtime loop code.
- Spec-awareness belongs in AFX prompt/system-context generation, not inside the Pi adapter.
- Mode configuration should be re-authored into a compact AFX-native model rather than copied wholesale from older implementation shapes.

### Pi implementation paths (integration points)

- `pi-mono/packages/agent/src/types.ts` — `BeforeToolCallContext`, `BeforeToolCallResult`, `transformContext` shape
- `pi-mono/packages/coding-agent/src/core/auth-storage.ts` — auth precedence (runtimeOverrides → stored → env → fallback)
- `pi-mono/packages/coding-agent/src/core/agent-session.ts` — confirms no built-in mode/skill state
- `pi-mono/packages/coding-agent/src/core/slash-commands.ts` — built-in slash command set

### Related research
