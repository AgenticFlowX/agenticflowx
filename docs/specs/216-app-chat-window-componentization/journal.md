---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-15T09:13:06.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["app", "chat", "componentization", "journal"]
spec: spec.md
---

# App Chat Window Componentization - Journal

## 2026-05-15T09:13:06.000Z - Durable Spec Created

Created this durable repo spec so future implementation `@see` annotations point to `afx-vscode/docs/specs/216-app-chat-window-componentization/` rather than temporary fleet/sprint planning documents.

Key decisions captured:

- `ChatWindow` is the composition root.
- `chat-controller.tsx` is a required state owner.
- New region files live in one shallow `components/chat/` directory.
- Composer mini-app surfaces are `ComposerPanelStack` / `ComposerPanel`.
- Attachment and chat-history surfaces are reserved but not implemented in this refactor.

## 2026-05-15T09:37:01.000Z - Validation Fixes Applied

Ran `/afx-spec validate 216-app-chat-window-componentization` checks and fixed structural issues across affected specs:

- Added missing `## Open Questions` sections to `210-app-chat/spec.md` and `216-app-chat-window-componentization/spec.md`.
- Restored sequential FR ordering in `213-app-chat-history/spec.md`.
- Marked completed durable-spec alignment tasks 0.1 and 0.2 in this feature's `tasks.md`.

## 2026-05-15T10:24:37.000Z - Surgical Task Plan Expanded

Expanded `tasks.md` from a compact phase list into a surgical implementation plan with explicit files, durable `@see` targets, behavior-preservation checks, tests, performance gates, accessibility gates, rollback/shadow-shell rules, and requirement coverage.

Implementation can now start from `216-app-chat-window-componentization/tasks.md` without consulting the temporary fleet sprint document.

## 2026-05-15T10:49:47.000Z - Implementation Started

Started implementation from the approved sprint and durable task source.

Completed:

- Created `apps/chat/src/components/chat/chat.types.ts` with flags, slice contracts, composer panel registry types, attachment item type, and reserved chat-history interfaces.
- Moved the existing chat implementation into `apps/chat/src/components/chat/chat-window.tsx` as `ChatWindow`.
- Reduced `apps/chat/src/views/chat.tsx` to a route shell that delegates to `ChatWindow`.
- Ran `pnpm --filter apps/chat check-types`; type-check passed.

Next implementation target: controller extraction (`1.2`) and/or shadow-gate refinement (`2.2`) before deeper region extraction.

## 2026-05-15T11:13:18.000Z - Region Extraction Pass

Extracted the first maintainability slice from `ChatWindow` into shallow `components/chat/` files while preserving behavior:

- Top/status, activity, footer, scroll button, conversation pane, timeline, and empty-state regions now have named component boundaries.
- Composer dock, panel stack, panel chrome, attachment tray, input shell, toolbar layout, and action layout now exist as future-ready boundaries.
- `ComposerPanelStack` now supports ordered registry-style panels, collapse, dismiss, and panel-scoped error isolation.
- Added `composer-panel-stack.test.tsx` coverage for ordering, collapse, dismiss, and error isolation.
- Ran `pnpm --filter apps/chat check-types` and chat unit tests; both passed.

Remaining high-value work: controller extraction, route shadow-gate refinement, deeper composer toolbar/actions/input ownership, timeline a11y/memo tests, and performance gates.

## 2026-05-15T11:50:29.000Z - Route Contract Smoke Added

Added `apps/chat/src/components/chat/chat-window.route-contract.test.tsx` to verify:

- `views/chat.tsx` still exports a stable route shell that renders `ChatWindow`.
- Internal region flags can hide top-level regions without using product/runtime settings.

Validation passed:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test -- src/components/chat/chat-window.route-contract.test.tsx`

## 2026-05-15T12:03:35.000Z - Conversation And Composer Leaf Tests Added

Completed the next extraction/test stage:

- `ConversationTimeline` now has `role="log"`, polite live-region attributes, assertive error notification, row memoization, and focused tests.
- `ConversationEmptyStates` now has focused assertions for setup/loading/code/explore/spec variants.
- `ConversationPane` now composes `ConversationScrollButton` and has a focused behavior test.
- `ComposerAttachmentTray`, `ComposerToolbar`, and `ComposerActions` now have focused tests.
- `ComposerToolbar` now owns mention/model/mode/file-context controls.
- `ComposerActions` now owns memory/send/follow-up/steer/stop controls.

Validation passed across the touched slices with `pnpm --filter apps/chat check-types` and targeted chat test runs.

## 2026-05-15T12:06:37.000Z - Leaf Action/Status Tests Completed

Completed additional leaf-region coverage:

- Added `chat-top-bar.test.tsx` for top-bar action dispatch and disabled runtime states.
- Added `composer-footer.test.tsx` for usage/cost/context hints and Pi runtime warning behavior.
- Added `composer-activity-bar.test.tsx` for idle, streaming thinking, and shell execution states.

Validation passed with `pnpm --filter apps/chat check-types` and targeted chat test runs.

## 2026-05-15T12:08:06.000Z - Composer Input Accessibility Covered

Completed a focused composer input accessibility slice:

- Added `role="form"` / `aria-label="Compose message"` to the composer input group.
- Added `aria-label="Chat composer"` to the textarea.
- Added `composer-input.test.tsx` for textarea event dispatch and shell warning behavior.

Validation passed with `pnpm --filter apps/chat check-types` and targeted chat test runs.

## 2026-05-15T12:12:05.000Z - Controller Boundary Started

Started the controller extraction stage:

- Added `apps/chat/src/components/chat/chat-controller.ts` with `useChatController`, `ChatController`, persisted chat view ownership, bridge facade, and stable controller actions. The controller was later renamed to `chat-controller.tsx`.
- Moved persisted transcript/hydration helpers out of `chat-window.tsx`.
- Wired `ChatWindow` through `useChatController` for flags and persisted initial state without visual behavior changes.
- Added `chat-controller.test.tsx` for persisted view state and stable controller action identity.

Validation passed:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test -- src/components/chat/chat-controller.test.tsx`

## 2026-05-15T12:15:11.000Z - Bridge Subscription Helper Wired

Continued controller extraction:

- Added `useChatBridgeSubscriptions` in the controller as the controller-owned bridge subscription lifecycle helper.
- Replaced raw `bridgeOn(...)` subscription setup in `chat-window.tsx` with `useChatBridgeSubscriptions` and the controller bridge facade.
- Added controller test coverage for bridge subscription cleanup.

Validation passed:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test -- src/components/chat/chat-controller.test.tsx`

## 2026-05-15T12:17:48.000Z - Reserved History Surface Confirmed

Completed the reserved history surface stage:

- Added a reserved `historyStore: ChatHistoryStore | null` slot to `ChatController` without implementing persistence behavior.
- Extended `chat-controller.test.tsx` to assert the reserved controller slot remains present and null.
- Extended `composer-panel-stack.test.tsx` to verify a future `id: "history"`, zone `context` panel is accepted and ordered before workflow panels.
- Confirmed no chat history load/export behavior was introduced in this refactor slice.

Validation passed:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test -- src/components/chat/chat-controller.test.tsx src/components/chat/composer-panel-stack.test.tsx`

## 2026-05-15T12:20:21.000Z - Future Action Triggers Reserved

Completed another extension-boundary slice:

- Added `extraActions` to `ChatTopBar` so future history load/export actions can be inserted without changing layout.
- Added a reserved optional attachment trigger to `ComposerToolbar` (`onOpenAttachmentPicker`) with `aria-label="Attach file or image"`; no upload behavior was implemented.
- Updated focused tests for top-bar extra action placement and toolbar attach trigger dispatch.

Validation passed:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test -- src/components/chat/chat-top-bar.test.tsx src/components/chat/composer-toolbar.test.tsx`

## 2026-05-15T12:26:52.000Z - Integration And Validation Gates Passed

Completed the integration/validation stage:

- Ran Prettier over touched chat component files and affected specs, then verified repo formatting.
- Fixed lint issues found by full repo lint (`FooterSlice.usage` type, unnecessary test assertions, hook dependency/unbound-method warning).
- Confirmed no source `@see` annotations in the new chat files point to fleet/sprint docs.
- Confirmed route shell remains lightweight and covered by route-contract tests.

Validation passed:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test` — 46 files / 367 tests passing
- `pnpm run build:chat`
- `pnpm run check:lint`
- `pnpm run check:format`
- `pnpm run check:md`

Note: the Vite chat build still emits the pre-existing >500kB chunk-size warning; build exits successfully.

## 2026-05-15T12:30:41.000Z - Work Sessions Recovered

Fixed task-document metadata and work-session tracking issues reported from the selected task view:

- Repaired malformed YAML frontmatter in `tasks.md` and `journal.md` caused by a previous timestamp edit.
- Added the required `## Work Sessions` section as the last section of `tasks.md`.
- Backfilled session rows for the completed implementation stages so the AFX Tasks UI can display session history for the selected task.
- Verified markdown with `pnpm run check:md`.

## 2026-05-15T13:12:09.000Z - Final Migration Gates Completed

Completed the remaining componentization migration gates without reintroducing fleet/sprint source traceability:

- Moved remaining composer strip surfaces (`QueueStrip`, `BlockedCommandStrip`, `ModeSuggestStrip`, `AfxCommandSuggestStrip`, `QueueRow`) into `composer-panels.tsx` with focused tests.
- Moved prompt-history collection, local UID creation, and placeholder generation out of the monolithic window body.
- Mounted slash and mention popovers through `ComposerInput` while keeping the reusable root-level popup components in place.
- Added controller region slices and memoization tests.
- Added render-isolation coverage proving the memoized timeline does not re-render on composer keystrokes or unrelated activity/status updates.
- Added/verified a11y landmarks and live-region behavior for the chat window, top bar, conversation pane/timeline, composer dock, composer input, panels, popovers, and scroll button.
- Removed the obsolete `useNewShell` flag after reconciling that the old inline shell was already eliminated; rollback is now git/release revert.
- Recorded source-audit and performance baseline/after artifacts in the fleet sprint context while keeping durable implementation `@see` references on `docs/specs/216-app-chat-window-componentization/`.

Validation in this pass:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test` — 48 files / 377 tests passing
- `pnpm run check:lint`
- `pnpm run check:format` after formatting `composer-panels.tsx`

## 2026-05-15T13:52:59.000Z - Review Fixes And Benchmark Baseline Added

Closed the post-validation gaps found while reviewing staged changes against this plan:

- Preserved `ComposerPanel` local state across collapse/expand while keeping dismiss as the unmount boundary.
- Fixed mode-only persisted chat state hydration to avoid flashing the wrong welcome card.
- Wired the reserved attachment trigger through `ChatWindow` and preserved composer focus after top-bar actions.
- Added reserved `ChatHistoryPanel`, `ChatHistoryLoadAction`, and `ChatHistoryExportAction` placeholder exports.
- Added IME-submit protection and wired the composer textarea to the footer hint with `aria-describedby`.
- Added a deterministic mock `coding-benchmark` transcript and Playwright e2e coverage for long coding-chat hydration, composer typing responsiveness, DOM size, and Chromium heap delta.
- Recorded the first e2e benchmark baseline in `performance-baseline.json`.

Validation in this pass:

- `pnpm --filter @afx/transport exec vitest run src/mock.test.ts`
- `pnpm --filter apps/chat exec vitest run --config vitest.config.unit.ts ...focused chat tests`
- `pnpm --filter apps/chat exec playwright test e2e/chat-window-benchmark.spec.ts`

## 2026-05-15T23:01:53.000Z - Phase 8: State Lift, Action Surface, Panel Registry Consumer

A code review of Phases 1–7 found the controller pattern was structurally scaffolded but not load-bearing: ~30 `useState` calls, all bridge handler bodies, and every action callback were still inline in `ChatWindow`; the `TopBarSlice` / `ConversationSlice` / `ComposerSlice` / `FooterSlice` types were unused; the `ComposerPanelStack` registry had zero production consumers; and several `[x]` markers across Phase 7 plus the fleet sprint acceptance list were aspirational rather than honest.

Phase 8 closes the load-bearing gap and makes the doc honest:

**Code:**

- Lifted cross-region state — `messages`, `noteEvents`, `commandOutputs`, `runtime`, `usage`, `queued`, `workspaceMode` — from `ChatWindow` into the controller. Surfaced via `controller.state.*`. Composer-local state (`draft`, `slashOpen`, `mentionOpen`, `userScrolledUp`, `activeTrigger`) intentionally stays in `ChatWindow` per `[DES-STATE]` ownership rule.
- Migrated the bridge `on()` handler bodies that update those atoms into the controller. The subscription factory was already controller-owned; the **handler bodies** were not, which is what the spec actually required.
- Lifted action callbacks `abort`, `setMode`, `acceptHostWorkspaceMode`, `setThinkingLevel`, `dispatchHostAction` to `controller.actions.*` with stable `useCallback` identity. `submit` deliberately stays in `ChatWindow` this pass — it depends on composer-local state and 6+ derived flags; lifting it cleanly requires the rest of the state lift planned for `08-003`.
- Built production-shape `QueuePanel` + `QueueRows` + `QueueClearAllAction` exports in `composer-panels.tsx`. Added `actions?: ReactNode` slot to `ComposerPanelDefinition` and threaded it through `ComposerPanelStack` to `ComposerPanel`. `composer-panel-stack.test.tsx` mounts the queue panel through the registry end-to-end (body, clear-all callback, per-row dismiss). The remaining strips later migrated into the same registry.
- Added render-count assertions for `ChatTopBar`, `ComposerFooter`, `ComposerActions` so the `[DES-PERF]` memoization table is enforceable.

**Spec honesty:**

- `[DES-STATE]` rewritten so the current controller surface is documented as primary.
- `08-001` fleet sprint acceptance criteria reorganized into a Phase 5 block with explicit `[ ]` for deferred items (lifting the remaining state atoms, migrating the other strips, materializing region slices).
- `216/tasks.md` Phase 7 `[x]` markers reconciled (e.g., render-count assertions are partial; screen-reader QA is deferred); Phase 8 added with `[ ]` markers for follow-on work.

**Deferred to follow-on sprint `08-003-composer-panel-registry-rollout`:**

- Lift remaining state atoms (`agentStatus`, `models`, `commands`, `files`, `activeFileContext`, `activeDocContext`, `customProviderLabels`, `onboardingFlags`, `blockedAction`, snapshot-received gates, `internalAgentStatus`, `includeActiveFileContext`, `thinking`).
- Lift remaining action surface (`handleMemorySelect`, `handleOpenModifiedFile`, queue/blocked/note actions, `toggleIncludeActiveFileContext`).
- Migrate the other 5 strips to `ComposerPanelDefinition`.
- Materialize region slices once the rest of the state has lifted.

Validation in this pass:

- `pnpm --filter apps/chat check-types`
- `pnpm --filter apps/chat test --run`
- `pnpm --filter apps/chat exec eslint --max-warnings 0 'src/components/chat' 'src/views/chat.tsx'`
- `pnpm --filter apps/chat exec prettier --check 'src/components/chat' 'src/views/chat.tsx'`
- `pnpm exec markdownlint-cli2 'docs/specs/216-app-chat-window-componentization/**/*.md'`

## 2026-05-16T00:28:58.000Z - Phase 9 (fleet 08-001 Phase 6) Started: Full Lift

User redirected after Phase 8: "make this right in full force, 100% accuracy. drift toward better is allowed; just make sure docs trace it back." This phase finishes what Phase 8 partially did: lifts all remaining state and bridge handlers into the controller, lifts the full action surface (with `ComposerLocalCallbacks` for composer-coupled actions), migrates all 6 strips to the panel registry, and materializes region slices.

Target end-state:

- `ChatWindow` is ~250–350 lines: composer-local state + DOM refs + composition JSX. Zero `bridge.on()` calls. Zero business logic.
- `chat-controller.tsx` owns everything else: state, bridge handlers, derived flags, actions, region slices, panel-stack config.
- `[DES-STATE]` documents the current `controller.slices.*` surface.
- Render-count budgets enforced for every region in `[DES-PERF]`'s memoization table.
- All 6 strips render through `ComposerPanelDefinition`; legacy `ComposerStrip` remains in `components/composer-strip.tsx` for non-chat callers but is no longer rendered by `ChatWindow`.

This journal entry will get a closing summary when the phase lands. Granular task tracking lives in `tasks.md` Phase 9.

## 2026-05-16T00:28:58.000Z - Phase 9 (fleet 08-001 Phase 6) Landed: Full Lift Complete

End-state achieved:

**Controller (`chat-controller.tsx`, ~1.8k lines):**

- Owns every cross-region / bridge-sourced / persisted state atom: `messages`, `noteEvents`, `commandOutputs`, `runtime`, `usage`, `queued`, `workspaceMode`, `hasReceivedStateSnapshot`, `hasReceivedSettingsSnapshot`, `internalAgentStatus`, `thinking`, `models`, `commands`, `files`, `activeFileContext`, `activeDocContext`, `customProviderLabels`, `onboardingFlags`, `blockedAction`, `includeActiveFileContext`, `dismissedDocActionsStrip`, `afxCommandSuggestVisible`, `afxCommandSuggestDismissed`, `dismissedAtAssistantMessageId`.
- All ~23 bridge `on()` handler bodies live in a single `useChatBridgeSubscriptions` call inside the controller. `ChatWindow` makes zero direct bridge subscriptions. Mount-time handshake (`chat/getState`, `chat/getModels`, `chat/getCommands`, `chat/getSettingsSnapshot`) moves with them. Toasts fired from handlers (`chat/error`, `chat/aborted`, `agent/signOffComplete`, `agent/compacted`) live next to the handler.
- All lifecycle refs (`pendingWorkspaceModeRef`, `latestWorkspaceModeRef`, `afxCommandSuggestDismissedRef`, `pendingAfxCommandSuggestRef`, `activeCommandRef`, `pendingDangerousRef`) moved with the state.
- Computed `controller.derived.*`: `agentStatus`, `isStreaming`, `isCompacting`, `runtimeUnavailable`, `runtimeUnconfigured`, `rpcEnabled`, `isExploreMode`.
- Full action surface on `controller.actions.*` with **stable identity** via a new `useStableCallback(fn)` helper (ref-based, identity stays stable for the controller's lifetime — critical so memoized children don't re-render when state changes invalidate action closures). 26 actions including `submit`, `saveAsNote`, `startNewSession`, `startCompact`, `handleMemorySelect`, `handleOpenModifiedFile`, `dismissModifiedFiles`, queue/blocked/note actions, `toggleIncludeActiveFileContext`, `selectModel`, `setOnboardingFlag`, `dispatchSlashAction`, `sendNow`, `restartAgent`, plus the Phase 5 actions.
- Region slices materialized on `controller.slices.*`: `topBar`, `conversation`, `composer`, `composerActivity`, `footer`, and `history`. `chat.types.ts` slice interfaces tightened — no `unknown[]` placeholders.
- `composerPanelStackConfig: ComposerPanelStackConfig` built from current state + lifted strip actions. All 6 strips render as `ComposerPanelDefinition` entries (Files, Queue, Blocked, DocActions, ModeSuggest, AfxCommandSuggest). Ordering matches the visible order shipped through Phase 5.
- Accepts `composerLocal` as input so panel-registry actions (e.g. blocked-command "Switch to Code", doc-actions `onInsert`) can wire through composer-side effects without re-implementing them.

**ChatWindow (~615 lines):**

- Composer-local state only: `slashOpen`, `mentionOpen`, `activeTrigger`, `userScrolledUp`, scroll/composer DOM refs, `insertedCommandRef`, `historyCursorRef`, `draftBeforeHistoryRef`.
- Composer-local DOM helpers built up-front (`getTextarea`, `focusComposer`, `closePopovers`, `clearDraft`, `setDraftDirect`, `resetScroll`, `resetPromptHistoryCursor`) — bundled into `ComposerLocalCallbacks` and passed to the controller.
- All cross-region state read via `controller.state.*`; all actions invoked via `controller.actions.*`; all panel content rendered via `<ComposerPanelStack config={controller.composerPanelStackConfig} />`.
- Wrappers like `handleNewSession`, `handleSubmit`, `handleMemorySelect`, `handleSendCommand`, `handleSwitchToSpec`, `handleScrollToLatest` all use `useStableCallback` so memoized children don't re-render on incidental state changes.
- Pure composition: ChatTopBar + ConversationPane (with timeline/empty-state routing) + ComposerActivityBar + ComposerDock (PanelStack + AttachmentTray + Input with helpers + Toolbar + Actions) + ComposerFooter.

**Panel chrome (`ComposerPanel`):**

- Extended with `count?: number`, `tone?: 'neutral' | 'brand' | 'warning'`, `headerExtras?: ReactNode`, `monoHeader?: boolean` for parity with what the strips needed.
- `ComposerPanelStack` threads all of those plus the existing `actions?` slot through to panels and honors `defaultCollapsed`.

**Legacy paths deleted:**

- `composer-strip.tsx` removed entirely.
- `QueueStrip`, `BlockedCommandStrip`, `ModeSuggestStrip`, `AfxCommandSuggestStrip`, `FilesStrip`, `ChatDocActionsStrip` deleted.
- Strip bodies extracted as `QueuePanel`, `BlockedCommandPanelBody`, `ModeSuggestPanelBody` / `ModeSuggestPanelTitle`, `AfxCommandSuggestPanelBody`, `FilesPanelBody`, `ChatDocActionsPanelBody` / `ChatDocActionsPanelTitle` / `ChatDocActionsPanelHeaderExtras`.
- `files-strip.tsx` → `files-panel.tsx`; `chat-doc-actions-strip.tsx` → `chat-doc-actions-panel.tsx` (tests renamed with them).
- All "legacy" comments scrubbed from production code.
- CSS keyframe `composer-strip-fill` removed.

**Tests:**

- 394 unit tests pass. Updated: `composer-panels.test.tsx` (now tests panel bodies), `files-panel.test.tsx` (tests `FilesPanelBody`), `chat-doc-actions-panel.test.tsx` (tests `ChatDocActionsPanelBody` + `ChatDocActionsPanelHeaderExtras`), `chat-controller.test.tsx` (drops obsolete `writers` test, adds derived + slice surface assertion + lifted-state hydration + setMode/acceptHostWorkspaceMode interaction + setThinkingLevel/abort/dispatchHostAction bridge dispatch).
- `chat-window.performance.test.tsx` now uses baseline-then-delta pattern and asserts render isolation for ConversationTimeline, ChatTopBar, ComposerFooter, ComposerActions across both draft changes and agent-status changes. All five render-isolation assertions pass.
- `composer-panel-stack.test.tsx` continues to cover before/after ordering, collapse-preserves-state, dismiss-unmounts, error-boundary isolation, and the queue-panel end-to-end through the registry.

**Spec drift closed.** Validation:

- `pnpm --filter apps/chat check-types` ✓
- `pnpm --filter apps/chat test --run` — 49 files / 394 tests ✓
- `pnpm --filter apps/chat exec eslint --max-warnings 0 'src/components/chat' 'src/views/chat.tsx' 'src/components/files-panel.tsx' 'src/components/files-panel.test.tsx' 'src/components/chat-doc-actions-panel.tsx' 'src/components/chat-doc-actions-panel.test.tsx'` ✓
- `pnpm --filter apps/chat exec prettier --check ...` ✓
- `pnpm exec markdownlint-cli2 'docs/specs/216-app-chat-window-componentization/**/*.md'` ✓

Out of scope (carried as documented post-refactor work): screen-reader QA pass on macOS VoiceOver / NVDA / JAWS.
