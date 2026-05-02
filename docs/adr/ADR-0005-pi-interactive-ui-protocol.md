---
afx: true
type: ADR
status: Proposed
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-27T03:38:44.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags:
  [
    "adr",
    "architecture",
    "pi",
    "chat",
    "ui",
    "interactive",
    "dialog",
    "extensions",
    "agent-manager",
  ]
---

# ADR-0005: Pi Interactive UI via Extension UI Sub-Protocol

## Context

The Pi agent has no native "ask the user a question" event type. Its `AgentEvent` stream only emits assistant text, thinking, and tool calls — see `pi-mono/packages/agent/src/types.ts` lines 350–365. An LLM running under Pi cannot pause mid-turn and request user input through the agent event channel itself.

However, Pi **does** ship a separate, well-specified **Extension UI sub-protocol** that any extension (or the host directly via RPC) can use to drive interactive dialogs. It exposes four request/response methods (`select`, `confirm`, `input`, `editor`) and five fire-and-forget methods (`notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`). Each request carries a unique `id`; the host responds with a matching `extension_ui_response` carrying `value`, `confirmed`, or `cancelled`. References:

- `pi-mono/packages/coding-agent/docs/rpc.md` lines 984–1174 (full protocol spec)
- `pi-mono/packages/coding-agent/src/core/extensions/types.ts` lines 123–270 (`ExtensionUIContext` interface)
- `pi-mono/packages/coding-agent/examples/rpc-extension-ui.ts` (working RPC host implementation)

The chat-foundation spec (`docs/specs/chat-foundation/chat-foundation.md`) needs to support common UX patterns where the agent asks the user something — most notably, "the LLM poses a question and offers selectable options" — but also confirmation prompts, free-text inputs, and inline notifications. We need to decide **where this capability comes from** and **how the chat UI consumes it** before we ship interactive flows.

Three architectural options are on the table:

1. **Lean on Pi's Extension UI sub-protocol.** Use `extension_ui_request`/`extension_ui_response` exactly as Pi defines them. The Pi runtime adapter normalizes Pi-shaped requests into a runtime-agnostic `AgentUiRequest` union in `@afx/shared` and exposes a single `respondToUiRequest()` method on `AgentManager`. The chat webview renders each variant deterministically.
2. **Define an AFX-specific `ask_user` tool.** Register a custom tool (`name: "ask_user"`, args `{ question, options }`) via Pi's `customTools` registry. The model "calls" the tool; the host catches the call, surfaces it as UI, and returns the user's reply as the tool result.
3. **Parse free-form assistant text** for question-and-options patterns and render them as buttons in the chat view.

Option 1's plumbing already exists in the current build:

- `AgentUiRequest`, `AgentUiResponse`, and `respondToUiRequest()` are defined in [`packages/shared/src/agent.ts`](../../packages/shared/src/agent.ts) lines 245–297 and 362.
- `AgentUiRequest` is a member of the `AgentEvent` union (line 321), so existing event listeners already see it.
- The Pi adapter translates Pi's native `extension_ui_request` into `AgentUiRequest` in [`packages/agent/pi/src/rpc-manager.ts`](../../packages/agent/pi/src/rpc-manager.ts) lines 257–327, and forwards responses via `extension_ui_response` at line 547–551.

What is **not** decided is the strategy: which option AFX commits to long-term, what the chat webview is responsible for rendering, and how future adapters (per ADR-0004) interact with this contract.

---

## Decision

**Adopt Pi's Extension UI sub-protocol — surfaced through the existing `AgentUiRequest` / `AgentUiResponse` / `respondToUiRequest` contract in `@afx/shared` — as the single mechanism for all interactive UI in AgenticFlowX. Do not parse assistant text. Do not invent an AFX-specific `ask_user` tool.**

Concretely:

1. **The `AgentUiRequest` union in `@afx/shared` is the canonical interactive-UI contract.** Today it covers nine methods mirroring Pi's `ExtensionUIContext`: `select`, `confirm`, `input`, `editor`, `notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`. Adapters MUST translate their native UI primitives into this union. The chat webview MUST render against this union, not against any adapter-specific shape.

2. **The chat app handles every `AgentUiRequest` deterministically.** It MUST never silently drop a UI request. Each method has a defined rendering target ([rendering map](#rendering-map) below). For methods the chat does not yet support, the adapter MUST be configured to either degrade (auto-cancel) or block at startup with a clear error — not allow runtime ambiguity.

3. **The webview never speaks Pi's wire format.** It dispatches a typed bridge message containing `AgentUiResponse`; the extension host calls `agent.respondToUiRequest(response)`; the adapter is responsible for translating to `extension_ui_response`. The chat app remains adapter-agnostic per AGENTS.md "architecture boundaries".

4. **AFX skills and prompts SHOULD use Pi's `ctx.ui.*` API directly** for any interactive flow. We do not build an "AFX dialog tool" wrapper. If a skill or extension on Pi's side calls `ctx.ui.select(...)`, the request flows through this same pipeline with no AFX-specific code.

5. **Free-form assistant text is NOT parsed** for questions, options, or confirmations. The agent has exactly two ways to ask the user something: (a) emit an `AgentUiRequest` via the sub-protocol, or (b) emit assistant text that the user replies to as their next message. There is no third path.

6. **Future adapters (per ADR-0004) MUST map their interactive primitives onto `AgentUiRequest`** or document the gap explicitly:
   - **Future JSON-RPC runtime**: maps permission prompts to `confirm`/`select`.
   - **Future SDK runtime**: maps native dialog calls to the same union.
   - **Future runtime without host UI**: degrades explicitly; `AgentUiRequest` events are simply not emitted.
   - Any new method needed by adapter #2 is added to the union by ADR amendment, not by adding a parallel channel.

---

## Rationale

### Why option 1 (Pi sub-protocol) wins

- **Zero new mechanics.** Pi already implements the request/response loop, including unique IDs, optional timeouts, AbortSignal cancellation, and concurrent dialogs. Re-implementing this would duplicate ~250 lines of well-tested code in `pi-mono`.
- **Skills and extensions get it for free.** Any Pi skill or extension that calls `ctx.ui.select(...)` automatically works in the AFX chat — no AFX-specific glue. This matters because per ADR-0001, AFX prompt templates are migrating to Pi skills.
- **Symmetric across modes.** Pi's TUI mode renders the same `ctx.ui.*` calls natively; RPC mode emits them as protocol events. The host-side surface (chat webview vs. TUI) varies, but the agent-side code is the same. AFX users running `pi --mode interactive` outside VSCode get identical behaviour.
- **Adapter-agnostic by design.** The `AgentUiRequest` union in `@afx/shared` is already runtime-neutral. Pi happens to be the first adapter; future runtimes plug in without changing the chat UI. This is the same alignment ADR-0002 / ADR-0004 require for everything else on the agent contract.
- **The plumbing is already shipped.** [packages/shared/src/agent.ts:245-322](../../packages/shared/src/agent.ts#L245-L322) and [packages/agent/pi/src/rpc-manager.ts:257-327](../../packages/agent/pi/src/rpc-manager.ts#L257-L327). What remains is webview rendering, not protocol design.

### Why not option 2 (AFX `ask_user` custom tool)

| Concern                          | Detail                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parallel mechanics**           | Pi already has a UI sub-protocol. Adding a parallel tool-based path means two ways to ask the user the same question, with no rule for which to use when. This is the kind of "design by accretion" ADR-0001 explicitly rejected. |
| **Doesn't cover non-questions**  | A custom tool only solves the "ask a question" case. Confirmations, fire-and-forget notifications, status lines, and widgets all need the sub-protocol anyway. Choosing the tool path means doing both.                           |
| **Skill authors lose it**        | A custom tool registered by the AFX adapter is invisible to Pi skill authors writing `ctx.ui.select(...)` in a skill. They'd have to learn a separate AFX-only path or duplicate logic.                                           |
| **Bigger surface area to test**  | Tool-call args go through the model. Sub-protocol args are emitted directly by skills/extensions. The latter is more deterministic and easier to test.                                                                            |
| **Wrong layer for confirmation** | "Confirm before running this destructive tool" is naturally an extension hook (`tool_call`) calling `ctx.ui.confirm`, not a separate tool the model has to remember to invoke.                                                    |

### Why not option 3 (parse free-form text)

- **Models phrase questions a hundred different ways.** "Would you prefer A or B?" "Pick one: A, B, or C." "I can do this with A. Or B. Which?" Reliable parsing requires either a strict format the model has to learn (effectively a tool call by another name) or a fragile heuristic that breaks under load.
- **No structured `id` for the response.** Without a request ID, the host cannot reliably correlate the user's reply to the original question, especially under concurrent or queued turns.
- **Cannot express non-questions.** Confirmation, free-text input, and notifications have no natural surface in free-form assistant text.
- **The model already supports the structured path.** Modern frontier models call tools and emit structured outputs reliably. Parsing prose is a workaround for a problem we don't have.

### Why not extend `AgentEvent` with new variants

The chat-foundation spec does not need anything Pi's sub-protocol doesn't already cover. Adding AFX-specific UI events (e.g. `ask_user_with_options`) would mean inventing a parallel envelope on top of `AgentUiRequest` and forking from Pi's vocabulary. We pay no cost by staying on Pi's union — the variants are general enough — and we keep the door open for future adapters to map cleanly. If a future need surfaces (e.g. a "multi-select" variant), we extend the union by ADR amendment; we don't fork.

---

## Rendering map

Concrete rendering decisions for the chat webview. This locks the contract; exact component design lives in `chat-foundation/design.md`.

| Method            | Chat webview rendering                                                                                                 | Response shape                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `select`          | Inline message bubble: `title` as text, `options[]` as clickable chips. One click sends the selected string back.      | `{ id, value: <option> }` or `{ id, cancelled }`    |
| `confirm`         | Inline message bubble: `title` + `message`, with `[Confirm]` and `[Cancel]` buttons.                                   | `{ id, confirmed: boolean }` or `{ id, cancelled }` |
| `input`           | Inline message bubble: `title` + single-line text field with `placeholder`. Submit on Enter.                           | `{ id, value: <text> }` or `{ id, cancelled }`      |
| `editor`          | Modal multi-line editor with `prefill`. Submit / Cancel buttons.                                                       | `{ id, value: <text> }` or `{ id, cancelled }`      |
| `notify`          | Toast in chat (info / warning / error variants). No response.                                                          | n/a (fire-and-forget)                               |
| `setStatus`       | Update keyed slot in the status bar.                                                                                   | n/a                                                 |
| `setWidget`       | Render keyed widget above or below the composer (per `widgetPlacement`). Empty `widgetLines` clears the widget.        | n/a                                                 |
| `setTitle`        | No-op in chat (terminal-only concept). The adapter MAY drop this before forwarding, but it remains valid in the union. | n/a                                                 |
| `set_editor_text` | Replace composer textarea contents with `text`.                                                                        | n/a                                                 |

**Concurrency:** the webview supports multiple in-flight request-response dialogs (each keyed by `id`). New requests stack as additional bubbles; the user can answer them in any order.

**Timeouts:** `select`, `confirm`, and `input` may carry an optional `timeout` (milliseconds). Pi auto-resolves on the agent side if the host doesn't respond — the chat UI does not need its own timer, but it SHOULD visually indicate the time pressure when present.

**Cancellation:** dismissing a dialog (e.g. closing the modal, a session reset, abort) MUST send `{ id, cancelled: true }`. Adapters and Pi handle this as an explicit dismissal, not a missing response.

---

## Consequences

### Positive

- **Single source of truth for interactive UI.** One union, one response method, one rendering layer.
- **No new protocol design work.** We inherit Pi's design wholesale. Documentation, edge cases, and timeout semantics are already nailed down.
- **Skills and extensions are first-class citizens.** Anything a Pi skill author writes works in the chat with no AFX-specific code path.
- **Adapter contract stays clean.** ADR-0002's runtime-agnostic boundary is preserved; ADR-0004's roadmap stays on track.
- **The chat webview never speaks Pi.** Per AGENTS.md `apps/chat` boundaries, the webview imports from `@afx/shared` only.

### Negative / accepted trade-offs

- **Coupled to Pi's vocabulary.** If Pi adds a new `ctx.ui.*` method (or removes one), the union has to track. Mitigated by Pi's stable RPC docs and the fact that breaking changes there have been rare.
- **No multi-select today.** Pi's `select` returns a single value. Multi-select use cases (e.g. "pick which files to include") need either an extension of the union (ADR amendment) or a workaround using `editor`. We accept this trade until a concrete need surfaces.
- **Rendering surface is non-trivial.** Nine methods means nine UI affordances to design and maintain. Most are simple (notify, setStatus), but they are real surface area.
- **Adapters that don't support some methods must degrade explicitly.** Some future runtimes may have no equivalent at all; others may support only a subset. This is a documentation discipline burden, not a technical one.

### Risks

- **Pi sub-protocol drift.** If Pi changes the `extension_ui_request` shape, the adapter at `packages/agent/pi/src/rpc-manager.ts` lines 257–327 needs to keep pace. Mitigation: pinned Pi version + integration tests covering each method.
- **Webview unresponsiveness.** A request never answered (because the chat dropped a render or the user closed the panel) leaves the agent waiting up to its timeout. Mitigation: dispose/cleanup paths in the host ALWAYS send `cancelled: true` for outstanding `id`s. Chat-foundation tasks must include this.
- **Spec creep into "we should parse text after all"** when an LLM phrases a question in prose without using the sub-protocol. Mitigation: this is a prompt-engineering concern, not a protocol concern. We address it via skill design and tool descriptions — not by reopening this ADR.

---

## What this ADR explicitly does NOT decide

- **Visual design of each dialog variant.** Component composition, theming, animation — chat-foundation's `design.md` owns that.
- **Multi-select extension.** If/when needed, propose by ADR amendment with the new union variant and adapter-side mapping.
- **Skill-side authoring guidance.** A separate AFX skill-authoring guide should describe when to use `ctx.ui.select` vs. `ctx.ui.confirm` vs. plain assistant text.
- **Mode-aware suppression.** Some flows may want to suppress notifications when running headless; that policy lives in the host, not this contract.
- **Adapter #2's UI mapping in detail.** Per ADR-0004, adapter #2 isn't picked yet. When picked, that ADR enumerates the mapping.

---

## Open questions for follow-up

1. **Should `setTitle` be silently dropped at the adapter level for chat hosts?** It is a terminal-only concept in Pi. Cleaner if the adapter strips it before emitting the union; cleaner-still if the union flags it as "TUI-only" so multiple host types can agree.
2. **Per-session UI policy.** Should the host be allowed to disable interactive UI entirely (e.g., for unattended automation) and have the adapter auto-cancel every request? If so, where does the toggle live?
3. **Widget lifecycle.** `setWidget` with empty `widgetLines` clears the widget by key, but what about session reset / agent restart? The adapter SHOULD clear all widgets on session boundaries; confirm and document.
4. **Latency budget for `select`/`confirm`.** Acceptable round-trip from agent emit to user response. Affects whether streaming pauses or continues during a dialog.
5. **Audit trail.** Whether and how to log UI request/response pairs (e.g., for `/afx-check trace`). Likely yes; format TBD.

---

## References

- Pi extension UI protocol: `pi-mono/packages/coding-agent/docs/rpc.md` lines 984–1174
- Pi `ExtensionUIContext` interface: `pi-mono/packages/coding-agent/src/core/extensions/types.ts` lines 123–270
- Pi RPC example: `pi-mono/packages/coding-agent/examples/rpc-extension-ui.ts`
- `AgentUiRequest` / `AgentUiResponse` union: [`packages/shared/src/agent.ts`](../../packages/shared/src/agent.ts) lines 245–297
- `AgentManager.respondToUiRequest`: [`packages/shared/src/agent.ts`](../../packages/shared/src/agent.ts) line 362
- Pi adapter normalization: [`packages/agent/pi/src/rpc-manager.ts`](../../packages/agent/pi/src/rpc-manager.ts) lines 257–327, 547–551
- Related ADRs: [ADR-0001](ADR-0001-pi-engine-integration.md) (RPC strategy), [ADR-0002](ADR-0002-afx-agent-manager-abstraction.md) (runtime-agnostic contract), [ADR-0004](ADR-0004-afx-agent-adapter-roadmap.md) (agent-adapter roadmap)
- Consumer spec: [`docs/specs/chat-foundation/chat-foundation.md`](../specs/chat-foundation/chat-foundation.md)
