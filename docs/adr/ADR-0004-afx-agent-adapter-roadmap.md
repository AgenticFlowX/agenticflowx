---
afx: true
type: ADR
status: Accepted
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T14:29:39.000Z"
updated_at: "2026-05-31T00:30:27.000Z"
tags: ["adr", "architecture", "agent", "agent-adapter", "roadmap", "adapter"]
---

# ADR-0004: AFX Agent Adapter Roadmap

## Context

ADR-0002 shipped the runtime-agnostic `AgentManager` contract in `@afx/shared`, extracted Pi into `@afx/agent-pi` as a transport-explicit JSONL adapter, and structured `apps/vscode/src/agent-factory.ts` to return an `AgentInstance[]` ready for additional runtimes. The current build ships with one Pi-backed instance; the abstraction is in place.

A research doc (`docs/research/afx/res-afx-agent-adapter-rpc-substrate.md`) explored the broader question of unifying coding-agent integration around an adapter boundary. Most of that doc's architectural direction is already realised by ADR-0002. What remains is a roadmap question: when should AFX add a second runtime adapter, and which shared constraints must every adapter honor?

This ADR is that roadmap. It locks the vocabulary, records the evaluation criteria, and lists the abstractions we explicitly defer until adoption forces them. _(v1.0 deliberately left adapter #2 open; v1.1 — 2026-05-31 — now names it: see **Decision Update**.)_

The goal is to keep the next adapter PR from re-litigating ground that ADR-0002 already settled, and to prevent speculative work (a shared transport core, a JSON-RPC 2.0 envelope refactor) from happening before there is concrete evidence that two adapters need it.

---

## Decision

**Adopt the agent-adapter pattern as the long-term shape of runtime integration in AFX. Defer all second-adapter and shared-transport work until a concrete adoption decision is made.**

Concretely:

1. **Lock the vocabulary** for all future adapter work:
   - **Engine adapter** — a workspace package under `packages/agent/<runtime>/` that implements `AgentManager` from `@afx/shared`. Pure Node.js. Never imports `vscode`.
   - **Normalized event union** — `AgentEvent` from `@afx/shared`. Every adapter translates its native event shapes into this union _inside_ the adapter; no native shapes leak to consumers.
   - **Transport-explicit naming** — file names signal the mechanism, not the runtime. `rpc-client.ts`/`rpc-manager.ts` for stdio JSON-or-JSON-RPC subprocesses; `ws-client.ts` for WebSocket transports; `sdk-client.ts` for in-process SDKs. ADR-0002's rationale stands.
   - **Per-spec engine selection** — agent-adapter routing (e.g. spec frontmatter `engine: "pi"`) is the eventual UX target, but is not built until at least two adapters ship.

2. **Use a criteria-first adapter shortlist.** A future runtime is eligible for adapter work only when it satisfies the criteria below. Specific runtime/vendor comparison research belongs outside this product repository.

   | Criterion          | Required bar                                                                 |
   | ------------------ | ---------------------------------------------------------------------------- |
   | User pull          | Clear user need, not curiosity-driven integration work                       |
   | Automation surface | Programmatic session start, message send, cancellation, and event streaming  |
   | Tool visibility    | Tool calls, edits, prompts, model state, and errors can be surfaced safely   |
   | Containment model  | Host permissions and filesystem scope can be controlled by AFX               |
   | Adapter isolation  | Implementation can live in `packages/agent/<runtime>/` with no VSCode import |
   | Testability        | Local tests can exercise protocol framing and normalized event translation   |

3. **State the wire-format reality plainly.** Pi's protocol is JSONL with a custom envelope (`type: "response"`, custom event types) — see `packages/agent/pi/src/rpc-client.ts` lines 100-129. It is **not** strict JSON-RPC 2.0. Future runtimes may use strict JSON-RPC, WebSocket, SDK calls, or another structured transport. The `AgentManager` contract is what is uniform; the wire is not.

4. **Defer the shared transport core.** A package such as `@afx/agent-rpc-core` (a generic JSON-RPC 2.0 client primitive composable by adapters) is not built today. Trigger condition: two shipped adapters share ≥30 % of subprocess-lifecycle, framing, or correlation code. Until then, each adapter owns its transport in full.

5. **Adapter #2 is now decided (v1.1, see Decision Update below): oh-my-pi (omp), RPC-first; OpenCode follows.** The shared-transport-core deferral (point 4) still holds — adapter #2 owns its transport until the ≥30% overlap trigger fires.

6. **Defer WebSocket transport.** If a future adapter needs WebSocket, that adapter's ADR decides the transport. Stdio remains the default mental model because it matches the current Pi implementation.

7. **Defer multi-agent UX.** Per-message `agentId`, UI selection, and routing rules belong to a UI design pass, not this roadmap.

---

## Decision Update (2026-05-31) — Adapter #2 selected

This ADR moves **Proposed → Accepted**. The roadmap stands as written; one deferred item is now resolved.

**Adapter #2 = oh-my-pi (`omp`), integrated RPC-first. OpenCode is adapter #3.** Order chosen for least code / fastest adoption.

- **omp first** — its RPC is a **superset of Pi's JSONL protocol**, so it lands as a thin `packages/agent/omp/` adapter reusing the Pi RPC client (~50 LoC + factory wiring), no new transport. Transient OMP sprint notes must be promoted to a durable adapter spec before source traceability is added.
- **OpenCode next** — a local **HTTP server** (not RPC-JSONL); a server-driven adapter, more work than omp — hence second.
- **Auth posture for both:** RPC/external harnesses are **harness-owned auth** — they run their own login and self-refresh (`~/.pi/agent/auth.json` etc.). AFX **defers** to them (surfaces "run the harness login"); it does **not** inject credentials or run OAuth for them. AFX-host-owned OAuth (PKCE/loopback/SecretStorage) is scoped to the **bundled Pi-SDK** path only — see `docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]` and `docs/specs/355-agent-sdk-credential-injection/design.md [DES-EXTERNAL]`. omp brings ~39 OAuth providers via its own `registerOAuthProvider`, so RPC-first yields broad subscription coverage cheaply.

**Still deferred (unchanged):** the shared transport core / `@afx/agent-rpc-core` (point 4 — fires only at ≥30% overlap), WebSocket transport, multi-agent routing UX. A speculative cross-harness `HarnessCapabilities` descriptor was **considered and rejected** (it duplicates `AgentManager` and pre-empts the ≥30% trigger); extensibility rides the existing adapter pattern + per-provider `oauthCapable`/`oauthFlow` flags + `AgentModel.authMethod` tagging instead.

---

## Rationale

### Why an ADR rather than just a code change

The Change Gate in `AGENTS.md` requires a spec or ADR before behavioural or architectural change. This ADR introduces no behaviour; it commits to _not_ doing speculative work and to using a fixed vocabulary when adapter #2 lands. That vocabulary lock is itself an architectural decision and worth a stable record.

### Why not refactor `rpc-client.ts` to JSON-RPC 2.0 today

Pi's wire format is upstream-defined by `@mariozechner/pi-coding-agent`. Wrapping Pi's native shape in a `jsonrpc: "2.0"` envelope inside our adapter would not change what we send to or receive from Pi — it would add a translation layer between our adapter's request method and itself. There is no caller above the adapter that benefits, because `AgentManager` already abstracts over the wire. The refactor is pure cost.

If Pi ever exposes a strict JSON-RPC 2.0 mode upstream, we revisit. Until then, `rpc-client.ts`'s use of "RPC" is the generic English meaning, not a claim of JSON-RPC 2.0 compliance.

### Why no shared `@afx/agent-rpc-core` yet

Premature abstraction in a transport core would force adapter #2 to fit a shape predicted from one example (Pi). The cheapest way to discover the right shared shape is to ship adapter #2 with its own transport, then extract the overlap. ADR-0002's Negative-consequences section already implicitly defers this; ADR-0004 makes it explicit and sets a concrete trigger (≥30 % shared code).

### Why adapter #2 is now named (was: "why not pick it here")

The original v1.0 left adapter #2 open pending a concrete user signal. That signal arrived (2026-05-31): a confirmed product direction to support multiple harnesses RPC-first for adoption, with **omp** the cheapest integration (RPC superset of Pi's) and a clear user need (subscription/model breadth). Per the criteria-first shortlist (Decision §2), omp satisfies every bar, so the choice is recorded here rather than spun out to a fresh ADR. See **Decision Update (2026-05-31)**.

---

## Consequences

### Positive

- Future adapter PRs have a fixed vocabulary and a known set of deferred questions. No re-bikeshedding.
- We stay correct about the wire format: the codebase doesn't claim JSON-RPC 2.0 conformance it doesn't have.
- We avoid building a transport-core package that would constrain adapter #2 before its requirements are known.
- The research doc has a stable promotion target; it can be marked `promoted_to: docs/adr/ADR-0004-afx-agent-adapter-roadmap.md` and remain Living for long-form rationale.

### Negative / accepted trade-offs

- Adapter #2 will own its transport in full. Some duplication with `@afx/agent-pi` is expected and accepted as the cost of correct abstraction discovery.
- "RPC" remains intentionally broad inside the codebase. Naming follows transport shape, not protocol conformance; individual adapter ADRs own exact wire-format claims.

### Not decided here

- ~~Which runtime is adapter #2.~~ **Decided 2026-05-31: omp (RPC-first), then OpenCode.** See Decision Update.
- WebSocket transport adoption.
- Whether `@afx/agent-rpc-core` ever exists (depends on observed code overlap once adapter #2 ships).
- Per-spec engine selection UX, multi-agent session routing, and per-message `agentId`.

---

## References

- ADR-0001: Pi Engine Integration Strategy — chose subprocess RPC over SDK/hybrid.
- ADR-0002: AgentManager Abstraction + `packages/agent/pi` Extraction — shipped the substrate this roadmap commits to.
- `docs/research/afx/res-afx-agent-adapter-rpc-substrate.md` — long-form rationale for the adapter boundary.
- `docs/specs/100-package-shared/spec.md [FR-5]` — `AgentManager` runtime-agnostic contract.
- `docs/specs/300-infra-pi/spec.md [FR-1] [FR-3] [FR-4] [FR-5]` — Pi adapter requirements that fix the precedent.
