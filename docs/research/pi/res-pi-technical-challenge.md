---
afx: true
type: RES
status: Living
owner: "@rixrix"
created_at: "2026-04-27T12:39:09.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [research, AFX, pi, rpc, vscode, agent-runtime, safety]
---

# Pi RPC Integration Challenge - AFX Work Plan

## Purpose

This document captures the current technical assessment for AgenticFlowX's Pi-backed chat runtime and turns it into the next work queue. It should be used as the working research brief before updating specs, ADRs, tasks, or implementation.

The short version: Pi's RPC mode is thin by design. It gives us a powerful engine boundary over stdio, but the AFX host must own the IDE experience: session control, commands, model selection, extension UI, safety policy, editor integration, lifecycle recovery, and traceability.

## Current Assessment

### Integration Thesis

Pi should be treated as a backend agent engine, not as the product architecture. AFX should keep its own runtime abstraction, normalize Pi events into AFX events, and keep all VS Code, chat UI, skill, permission, and spec-driven workflow behavior on the AFX side.

This matches the current current direction:

- `packages/agent/pi` owns Pi-specific RPC process management.
- `packages/shared` owns runtime-neutral agent types and message contracts.
- `apps/vscode` owns the VS Code host bridge.
- `apps/chat` owns the webview UI.
- Bundled AFX skills are passed to Pi with `--skill`.

### Research Finding

The hard part is not spawning Pi. The hard part is making a long-running, streaming, tool-using agent feel native and safe inside VS Code.

Pi's RPC mode streams JSON over stdio and exposes extension UI requests such as select, confirm, input, and editor interactions. That means AFX must implement a responsive host loop, robust frame handling, request correlation, UI request routing, cancellation behavior, and permission boundaries.

## What Is Working Well

- The extension repo already has a good runtime boundary: Pi is isolated behind `AgentManager`.
- The adapter handles JSONL framing, request correlation, model/command discovery, state normalization, compacting, steering, follow-up, queue mode, and runtime settings.
- The VS Code host already passes bundled skills to Pi and bridges chat messages to the runtime.
- The chat app has the right high-level surfaces: Chat, History, Settings, model selector, thinking control, slash commands, mentions, compact, queue strip, and debug/status panels.
- The implementation mostly respects the intended monorepo boundaries: chat does not import Pi directly.

## Primary Risks

### 1. Safety and Permission Policy Is Still Deferred

The research risk is real: a custom IDE embedding Pi should not assume the RPC bridge is safe by default. AFX currently relies heavily on Pi/runtime behavior and limited host-side file mention constraints.

The next serious AFX decision should define host-side policy for:

- Shell/tool approval.
- Filesystem read/write scope.
- Workspace trust.
- Dangerous command handling.
- Extension UI confirmations.
- Auditability in chat/session history.

Recommended artifact: ADR or sprint spec for `tool-call-policy`.

### 2. Spec and Code Have Drifted

`chat-foundation.md` still describes several features as deferred even though code now implements parts of them:

- Thinking level picker.
- Compact.
- Auto compaction flags.
- Queue mode.
- Mid-stream steer/follow-up.
- Runtime settings.

This should be reconciled before more implementation lands, otherwise future agents will follow stale scope.

Recommended action: update `chat-foundation.md` so requirements, design, acceptance criteria, tasks, and work-session notes agree.

### 3. ADRs and Design Docs Contain Stale Architecture

Some older docs still reference deleted or superseded paths such as `apps/vscode/src/engine/*`. ADR-0001 also says the extension does not bundle skills, which conflicts with the current current build.

Recommended action: update or supersede stale ADR/design sections rather than letting them focus with the current architecture.

### 4. Interactive UI Protocol Is Not Settled

ADR-0005 points toward chat-rendered UI requests, while the current build handles many UI requests with native VS Code dialogs. That can be a valid interim decision, but it needs to be explicit.

Open decision:

- Should extension UI requests render inside the chat webview, through VS Code native prompts, or through a hybrid policy?

Recommended artifact: update ADR-0005 or create a follow-up ADR that defines the interim and target behavior.

### 5. Slash and Mention Filtering Likely Needs UX Work

The chat composer detects query text for `/` and `@`, but the current popup components do not appear to receive that query as controlled input. This can make `/afx` and `@path` feel noisy because users may still see broad unfiltered lists.

Recommended fix:

- Pass `activeTrigger.query` to slash and mention popups.
- Filter slash commands and file mentions using the typed query.
- Add component tests for popup filtering and keyboard selection.

### 6. Verification Is Incomplete

Automated checks passed for tests, types, lint, and build, but markdown lint currently fails. Manual F5 verification for the real Pi runtime still needs to be treated as a release gate.

Known verification status:

- `pnpm test`: passed.
- `pnpm check:types`: passed.
- `pnpm check:lint`: passed.
- `pnpm build`: passed with a large chunk warning.
- `pnpm check:md`: failed with markdownlint errors in docs.

## Recommended Next Work

### Phase 1 - Capture the Current Truth

- [ ] Update `chat-foundation.md` to match implemented current behavior.
- [ ] Check or rewrite acceptance criteria so they reflect current runtime, UI, and skill behavior.
- [ ] Mark unresolved manual verification explicitly instead of leaving mixed task/session signals.
- [ ] Add a short "Implemented Beyond Original Scope" section if needed, then decide whether to bless or defer those features.

### Phase 2 - Clean the Architecture Record

- [ ] Update stale Pi path references in 300-infra-pi design docs.
- [ ] Update or supersede ADR-0001 where it conflicts with bundled skills.
- [ ] Reconcile ADR-0005 with the current host-native extension UI behavior.
- [ ] Add a short map of current current runtime boundaries.

### Phase 3 - Decide Safety Policy

- [ ] Create ADR/spec for `tool-call-policy`.
- [ ] Define what requires user confirmation.
- [ ] Define workspace/file boundaries.
- [ ] Define shell command policy.
- [ ] Define how permission decisions are surfaced in chat history.
- [ ] Define minimum behavior for denied, failed, or timed-out tool requests.

### Phase 4 - Fix Chat UX Gaps

- [ ] Pass composer trigger query into slash and mention popups.
- [ ] Add filtering for slash commands and file mentions.
- [ ] Add tests for slash popup behavior.
- [ ] Add tests for mention popup behavior.
- [ ] Add tests for model combobox behavior.
- [ ] Review queued-message dismiss behavior so it cannot be mistaken for cancellation.

### Phase 5 - Verify Against Real Pi

- [ ] Run VS Code F5 with a real Pi binary.
- [ ] Verify `--skill` paths are passed and AFX commands appear in `get_commands`.
- [ ] Verify slash rewrite from `/afx-*` into normal Pi prompts.
- [ ] Verify model discovery and model switching.
- [ ] Verify compact, thinking level, steer, follow-up, and queue mode.
- [ ] Verify extension UI requests: select, confirm, input, notify, editor-related methods.
- [ ] Record gaps back into the spec or ADRs.

### Phase 6 - Clean CI Gates

- [ ] Fix markdownlint failures.
- [ ] Decide whether the Vite chunk-size warning is acceptable for extension preview.
- [ ] Add a no-Pi-import boundary check for `apps/chat`.
- [ ] Add targeted tests around mention inflation, file caps, and blocked paths.

## Suggested Work Order

1. Reconcile `chat-foundation.md`.
2. Update stale ADR/design records.
3. Add the safety-policy ADR.
4. Fix slash/mention filtering.
5. Add the missing UI tests.
6. Run real Pi F5 verification.
7. Clean markdownlint and CI.

This order keeps the source of truth stable before more code changes land.

## Source Notes

- Pi RPC docs: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md>
- Pi extensions docs: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md>
- Implementation target: repository root
- Main working spec: `docs/specs/chat-foundation/chat-foundation.md`
- Pi adapter: `packages/agent/pi/`
- VS Code bridge: `apps/vscode/src/panels/sidebar-panel.ts`
- Chat surface: `apps/chat/src/views/chat.tsx`
