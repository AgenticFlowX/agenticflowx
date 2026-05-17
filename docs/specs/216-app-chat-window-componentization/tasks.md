---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-15T09:13:06.000Z"
updated_at: 2026-05-17T09:00:46.473Z
tags: ["app", "chat", "componentization", "tasks"]
spec: spec.md
design: design.md
---

# App Chat Window Componentization - Tasks

## Task Execution Rules

- Source-code `@see` annotations must reference durable specs under `docs/specs/**`, especially `docs/specs/216-app-chat-window-componentization/design.md`; never reference `docs/specs/900-fleet/**`.
- Keep `apps/chat/src/views/chat.tsx` as the stable route shell and default export throughout the refactor.
- Use one shallow implementation directory: `apps/chat/src/components/chat/`.
- Do not move existing reusable root-level components unless a later approved spec says to; import/wrap them from chat-region files.
- The obsolete `ChatWindowFlags.useNewShell` rollback flag has been removed after the old inline shell was eliminated; route rollback now uses git/release revert.
- Preserve bridge protocol, persisted view state semantics, shortcuts, copy, visibility, and current UI behavior unless a task explicitly says otherwise.

---

## 0. Spec Alignment, Existing-Source Audit, And Baseline

### 0.1 Durable spec routing complete

<!-- files: afx-vscode/docs/specs/210-app-chat/spec.md, afx-vscode/docs/specs/210-app-chat/design.md, afx-vscode/docs/specs/211-app-chat-composer/spec.md, afx-vscode/docs/specs/211-app-chat-composer/design.md, afx-vscode/docs/specs/212-app-chat-messages/spec.md, afx-vscode/docs/specs/212-app-chat-messages/design.md, afx-vscode/docs/specs/213-app-chat-history/spec.md, afx-vscode/docs/specs/213-app-chat-history/design.md -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-TRACE] -->

- [x] Update parent/child durable specs so `210`, `211`, `212`, and `213` route componentization work to this spec.
- [x] Replace fleet/sprint `@see` references with durable references to this `216` spec or child specs.
- [x] Confirm all affected specs have required sections and sequential FR/NFR IDs.

### 0.2 Existing source audit before extraction

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/*.tsx, afx-vscode/apps/chat/src/lib/*.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-FILES] -->

- [x] Inventory local components/functions currently embedded in `views/chat.tsx` and map each to the target file in `[DES-FILES]`.
- [x] Identify all bridge subscriptions, persisted view-state helpers, shared state, derived state, refs, and callbacks that must move to `chat-controller.tsx`.
- [x] Identify state that must remain leaf-local: prompt history cursor/draft refs, IME composition, popover refs/open state, panel collapse state, scroll position unless shared by two or more regions.
- [x] Confirm existing reusable root-level imports to keep in place: `FilesStrip`, `ChatDocActionsStrip`, `ModelCombobox`, `MentionPopup`, `SlashPopup`, `OutputCard`, `ResultActions`, `NextActionRail`, `DebugPanel`, `Toast`.
- [x] Record any discovered mismatch as a design/task follow-up before moving code.

### 0.3 Capture performance baseline

<!-- files: afx-vscode/apps/chat/perf/baseline.spec.ts, docs/specs/900-fleet/08-001-refactor-chat-window-components/perf-baseline.json -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF] -->

- [x] Capture `[DES-PERF]` baseline scenarios: timeline-small, timeline-large, streaming, composer-keystroke, panel-stack-churn, footer-usage-updates. Note: old inline shell was removed before a stored pre-move capture existed, so the artifact records the earliest reliable retrospective baseline and this reconciliation.
- [x] Store baseline measurements in the fleet/sprint artifact or another planning artifact, not in source code.
- [x] Note the 10% regression budget and stop-the-line criteria in the fleet/sprint artifact.

### 0.4 Confirm implementation validation commands

<!-- files: afx-vscode/package.json, afx-vscode/apps/chat/package.json -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-TEST] -->

- [x] Confirm these commands still exist before coding starts: `pnpm --filter apps/chat check-types`, `pnpm --filter apps/chat test`, `pnpm run build:chat`, `pnpm run check:lint`, `pnpm run check:format`, `pnpm run check:md`.
- [x] If scripts differ, update `design.md [DES-TEST]` before implementation.

---

## 1. Controller Foundation And Shared Types

### 1.1 Create shared chat types

<!-- files: afx-vscode/apps/chat/src/components/chat/chat.types.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-STATE] -->

- [x] Define `ChatWindowFlags` and default internal/shadow-rollout flags; obsolete `useNewShell` was removed after old-shell cleanup.
- [x] Define `TopBarSlice`, `ConversationSlice`, `ComposerSlice`, and `FooterSlice` with narrow region-owned fields.
- [x] Define `ComposerPanelZone`, `ComposerPanelDefinition`, `ComposerPanelStackConfig`, and `ComposerAttachmentItem`.
- [x] Define reserved `ChatHistoryStore` and `ChatHistorySession` interfaces/types as stubs only; do not implement history persistence.
- [x] Keep types importable by new chat-region files without importing the full route shell.

### 1.2 Create controller and bridge wrapper

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts, afx-vscode/apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE] -->

- [x] Create `useChatController(props)` and the `ChatController` surface.
- [x] Consolidate raw `bridgeOn(...)` subscriptions into one controller-owned bridge hook/helper.
- [x] Move persisted view-state ownership (`bridgeGetState`, `bridgeSetState`, cached transcript/hydration state) into the controller without changing hydration behavior.
- [x] Move shared state read by two or more regions into controller state.
- [x] Expose stable actions through `controller.actions` using stable callback identity.
- [x] Expose memoized region slices; regions must not consume the full controller by default.
- [x] Add route-shell compatibility so current rendering path can consume the controller without visual changes.

### 1.3 Controller tests and safety checks

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.test.tsx, afx-vscode/apps/chat/test/bridge-harness.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE] [DES-TEST] -->

- [x] Add or update a typed bridge harness for controller tests.
- [x] Test ownership rules: bridge-sourced state, shared state, persisted state, derived state.
- [x] Test stable action identity across unrelated state updates.
- [x] Test slice memoization so unrelated updates do not invalidate every region slice.
- [x] Test hydration semantics: cached transcript renders before live host snapshot; truly empty cold start still shows setup/loading.

---

## 2. Shadow ChatWindow Route Shell

### 2.1 Create ChatWindow composition root

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-window.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-API] [DES-UI] -->

- [x] Create `ChatWindow(props: ChatWindowProps)` as the visual composition root.
- [x] Merge partial flags with default flags inside `ChatWindow` or a small helper.
- [x] Compose regions in visual order, initially preserving the existing rendered structure behind placeholders/wrappers as needed.
- [x] Keep region conditionals at `ChatWindow`, `ConversationPane`, `ComposerDock`, or `ComposerPanelStack` boundaries.

### 2.2 Preserve route default export and shadow gate

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/chat-window.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-API] [DES-ROLLOUT] -->

- [x] Keep `views/chat.tsx` default export as `Chat(props: ChatProps)`.
- [x] Route through the controller once and render the extracted `ChatWindow`; the old inline shell no longer exists.
- [x] Remove obsolete `useNewShell` gate after validation showed no retained old-shell branch.
- [x] Add `chat-window.route-contract.test.tsx` or equivalent route smoke coverage.

### 2.3 Shadow-shell smoke tests

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-window.test.tsx, afx-vscode/apps/chat/src/app.test.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-TEST] [DES-ROLLOUT] -->

- [x] Confirm old shell branch is removed and cannot be selected by stale `useNewShell` flags.
- [x] Test `ChatWindow` renders through the route shell with bridge state mocked.
- [x] Test region flags hide/show top-level regions without changing product settings.

---

## 3. Leaf Region Extraction

### 3.1 Extract ChatTopBar

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/chat-top-bar.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES] -->

- [x] Move the current top action/status row into `ChatTopBar`.
- [x] Preserve memory menu, compact session, new session, restart/recovery controls, disabled states, labels, and visual placement.
- [x] Consume `TopBarSlice` or narrow props only.
- [x] Keep existing `ChatMemoryMenuButton` / `MemoryDropdown` reusable components in their current locations.
- [x] Add/update tests for disabled states and action dispatch.

### 3.2 Extract ComposerActivityBar

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-activity-bar.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER] -->

- [x] Move the current idle/thinking/shell activity strip into `ComposerActivityBar`.
- [x] Preserve live thinking preview, idle copy, runtime-busy state, and shell/local execution status.
- [x] Ensure activity updates do not re-render the conversation timeline except when timeline data changes.
- [x] Add render-count or smoke coverage if practical in this phase.

### 3.3 Extract ComposerFooter

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-footer.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER] -->

- [x] Move footer hint/runtime/usage UI into `ComposerFooter`.
- [x] Preserve `PiPill`, usage tooltip, context/cost display, runtime unavailable hints, streaming hints, and keyboard hint behavior.
- [x] Consume `FooterSlice` or narrow props only.
- [x] Add/update footer copy and usage-state tests.

### 3.4 Extract ConversationScrollButton

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/conversation-scroll-button.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-A11Y] [DES-FILES] -->

- [x] Move the floating jump-to-latest button into `ConversationScrollButton`.
- [x] Preserve visibility condition, click behavior, positioning, focus style, and `aria-label="Scroll to latest"`.
- [x] Keep scroll state pane-local unless it becomes shared by two or more regions.

---

## 4. Conversation Region Extraction

### 4.1 Extract ConversationTimeline

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/conversation-timeline.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-PERF] -->
<!-- @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-EVENT-FLOW] -->

- [x] Move timeline event flattening and row rendering into `ConversationTimeline`.
- [x] Move or colocate `Timeline`, `TimelineRow`, `Marker`, `EventHeader`, `EventBody`, `ToolEvent`, `ToolEventRow`, `AssistantMeta`, `CompactionCard`, and related timeline utilities.
- [x] Preserve user, assistant, tool, shell output, note, info/error, compaction, thinking, usage, and stop-reason rendering.
- [x] Keep `MarkdownMessage`, `OutputCard`, `ResultActions`, and `NextActionRail` imports stable from existing reusable locations.
- [x] Add `role="log"`, polite live-region behavior, and assertive error announcement only as described in `[DES-A11Y]`.
- [x] Add `React.memo` to timeline and row boundaries where safe.
- [x] Add `conversation-timeline.test.tsx` for core row kinds and render-count expectations.

### 4.2 Extract ConversationEmptyStates

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/conversation-empty-states.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES] -->
<!-- @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC] -->

- [x] Move `AgentSetupState`, workspace loading state, Code welcome, Explore welcome, Spec welcome, and active-document welcome surfaces into `ConversationEmptyStates`.
- [x] Preserve mode-specific copy, starter prompts, quick commands, doc-aware actions, runtime-unconfigured warning, and insertion/auto-send semantics.
- [x] Keep doc-action behavior routed through existing reusable helpers/components.
- [x] Add snapshots or explicit assertions for each empty-state variant.

### 4.3 Extract ConversationPane

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/conversation-pane.tsx, afx-vscode/apps/chat/src/components/chat/conversation-scroll-button.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-STATE] [DES-FILES] -->

- [x] Create `ConversationPane` as the scroll viewport and state router between `ConversationTimeline` and `ConversationEmptyStates`.
- [x] Own scroll refs, scroll-to-latest behavior, and `userScrolledUp` unless `[DES-STATE]` requires controller ownership.
- [x] Preserve auto-scroll behavior during streaming and hydration.
- [x] Compose `ConversationScrollButton` inside the pane.
- [x] Ensure conversation region can be profiled independently from composer updates.

---

## 5. Composer Region Extraction

### 5.1 Extract ComposerPanel and ComposerPanelStack

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-panel.tsx, afx-vscode/apps/chat/src/components/chat/composer-panel-stack.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-FILES] [DES-HISTORY] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] [DES-COMPOSER-QUEUE] [DES-COMPOSER-FILES-STRIP] -->

- [x] Implement `ComposerPanel` chrome with title, optional collapse, optional dismiss, actions/body slot, and panel-scoped error boundary.
- [x] Implement `ComposerPanelStack` ordering using `before?: string` / `after?: string` from `ComposerPanelDefinition`.
- [x] Preserve existing strip ordering for modified files, queue, blocked command, doc actions, mode suggestion, and AFX command suggestion.
- [x] Compose existing `FilesStrip`, `ChatDocActionsStrip`, `SpecStepper`, `composer-strip`, and suggestion surfaces without moving them.
- [x] Preserve dismiss/collapse behavior and existing per-turn visibility semantics.
- [x] Reserve `id: "history"`, zone `context` for future `ChatHistoryPanel`; do not create history UI.
- [x] Add `composer-panel-stack.test.tsx` for ordering, collapse keeps local state, dismiss unmounts, and panel error isolation.

### 5.2 Extract ComposerAttachmentTray

<!-- files: afx-vscode/apps/chat/src/components/chat/composer-attachment-tray.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-FILES] -->

- [x] Create `ComposerAttachmentTray` as a reserved boundary for selected file/image chips and previews.
- [x] Render nothing or current file-selection equivalent when there are no attachment items.
- [x] Support `ComposerAttachmentItem` shape for `file` and `image` kinds.
- [x] Preserve current behavior; do not implement full file/image upload or persistence in this refactor.
- [x] Expose remove callbacks in the component contract for future behavior.

### 5.3 Extract ComposerInput

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-input.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-A11Y] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS] [DES-COMPOSER-HELPERS] -->

- [x] Move textarea and shell warning row into `ComposerInput`.
- [x] Preserve placeholder behavior, disabled state, Enter/Shift+Enter/Cmd+Enter/Cmd+Shift+Enter/Escape behavior, prompt-history recall, IME guard, and focus restoration.
- [x] Keep `SlashPopup` and `MentionPopup` in their current reusable locations and mount/anchor them through `ComposerInput`.
- [x] Maintain textarea labels/descriptions and popover listbox accessibility.
- [x] Add `composer-input.test.tsx` for prompt history, popover anchoring, and IME behavior.

### 5.4 Extract ComposerToolbar

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-toolbar.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-CONTEXT] [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] -->

- [x] Move mention trigger, model/thinking combobox, workspace mode control, active-file context toggle, and future attach trigger into `ComposerToolbar`.
- [x] Preserve dropdown behavior, tooltip/copy, disabled states, mode badges, active-file context persistence calls, and mouse-down behavior.
- [x] Keep `ModelCombobox` root-level and import it.
- [x] Define/reserve `ComposerAttachButton` trigger semantics without implementing full attachments.
- [x] Add/update toolbar tests for mode/model/file-context interactions.

### 5.5 Extract ComposerActions

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-actions.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-KEYS] -->

- [x] Move memory/send/follow-up/steer/stop controls into `ComposerActions`.
- [x] Preserve streaming vs idle action switching, shell command send semantics, stop/abort behavior, disabled states, and mouse-down behavior.
- [x] Keep `ChatMemoryMenuButton` in its current reusable location and import it.
- [x] Ensure actions call stable controller callbacks rather than raw bridge calls.
- [x] Add/update tests for idle send, streaming follow-up, steering, stop, shell command dispatch, and disabled runtime states.

### 5.6 Extract ComposerDock

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/composer-dock.tsx, afx-vscode/apps/chat/src/components/chat/composer-activity-bar.tsx, afx-vscode/apps/chat/src/components/chat/composer-panel-stack.tsx, afx-vscode/apps/chat/src/components/chat/composer-input.tsx, afx-vscode/apps/chat/src/components/chat/composer-toolbar.tsx, afx-vscode/apps/chat/src/components/chat/composer-actions.tsx, afx-vscode/apps/chat/src/components/chat/composer-footer.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES] -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENTS] -->

- [x] Create `ComposerDock` as the bottom-region composition root.
- [x] Compose in order: `ComposerActivityBar`, `ComposerPanelStack`, `ComposerAttachmentTray`, `ComposerInput`, `ComposerToolbar`, `ComposerActions`, `ComposerFooter`.
- [x] Preserve form/submit semantics and prevent duplicate submits.
- [x] Ensure composer keystrokes do not re-render `ConversationTimeline`.
- [x] Add `aria-label="Compose message"` form semantics where compatible with current behavior.

---

## 6. ChatWindow Integration And Old-Shell Reduction

### 6.1 Wire extracted regions into ChatWindow

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-window.tsx, afx-vscode/apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-API] [DES-ROLLOUT] -->

- [x] Replace temporary shadow-shell placeholders with extracted Phase 3-5 regions.
- [x] Verify `ChatWindow` composes `ChatTopBar`, `ConversationPane`, and `ComposerDock` in visual order.
- [x] Keep toast stack and dev debug panel as app-level/global overlays unless existing imports require passthrough.
- [x] Confirm feature flags only gate internal/test/shadow-rollout behavior.

### 6.2 Reduce views/chat.tsx to route shell while preserving rollback

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-API] [DES-ROLLOUT] -->

- [x] Remove region implementation from `views/chat.tsx` once extracted and covered by `ChatWindow`.
- [x] Remove stale old-inline-shell rollback requirement; old shell branch was already eliminated when `views/chat.tsx` became the route shell.
- [x] Confirm default export remains stable for `app.tsx` and existing tests.
- [x] Ensure no source `@see` annotation points to fleet/sprint docs.

### 6.3 Reserved history surfaces confirmation

<!-- files: afx-vscode/apps/chat/src/components/chat/chat.types.ts, afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat-top-bar.tsx, afx-vscode/apps/chat/src/components/chat/composer-panel-stack.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-QUESTIONS] -->

- [x] Confirm `ChatHistoryStore` interface slot exists on the controller.
- [x] Confirm top-bar action ordering can accept future `ChatHistoryLoadAction` / `ChatHistoryExportAction` without re-layout.
- [x] Confirm `ComposerPanelStack` can accept a future `ChatHistoryPanel` with `id: "history"` and zone `context`.
- [x] Do not create history load/export behavior in this refactor.

---

## 7. Validation, Performance, Accessibility, And Rollout

### 7.1 Focused unit/integration tests

<!-- files: afx-vscode/apps/chat/src/components/chat/*.test.tsx, afx-vscode/apps/chat/src/app.test.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-TEST] -->

- [x] Add/verify `chat-controller.test.tsx`.
- [x] Add/verify `chat-window.test.tsx` and route-contract coverage.
- [x] Add/verify `conversation-timeline.test.tsx`.
- [x] Add/verify `conversation-empty-states.test.tsx`.
- [x] Add/verify `composer-panel-stack.test.tsx`.
- [x] Add/verify `composer-input.test.tsx`.
- [x] Preserve existing tests for root-level reusable components.

### 7.2 Performance comparison

<!-- files: docs/specs/900-fleet/08-001-refactor-chat-window-components/perf-baseline.json, docs/specs/900-fleet/08-001-refactor-chat-window-components/perf-after.json -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF] -->

- [x] Capture post-refactor measurements for all `[DES-PERF]` scenarios.
- [x] Compare with baseline and confirm no scenario regresses more than 10% unless explicitly accepted in a follow-up design note.
- [x] Add render-count assertions for memoized regions where practical.
- [x] Block shell flip if timeline re-renders on unrelated footer/composer updates.

### 7.3 Accessibility check

<!-- files: afx-vscode/apps/chat/src/components/chat/*.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-A11Y] -->

- [x] Verify landmarks/roles for `ChatWindow`, `ChatTopBar`, `ConversationTimeline`, `ComposerDock`, `ComposerPanel`, popovers, textarea, and scroll button.
- [x] Verify focus behavior for panel mount/dismiss, popover open/close, new session, and restart.
- [x] Verify streaming live-region announcements do not announce every token.
- [x] Verify keyboard reachability and visible focus for composer actions and panel controls.

### 7.4 Chat-focused validation commands

<!-- files: afx-vscode/package.json, afx-vscode/apps/chat/package.json -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-TEST] -->

- [x] Run `pnpm --filter apps/chat check-types`.
- [x] Run `pnpm --filter apps/chat test`.
- [x] Run `pnpm run build:chat`.
- [x] Run `pnpm run check:lint`.
- [x] Run `pnpm run check:format`.
- [x] Run `pnpm run check:md`.
- [x] Record any failures as implementation follow-ups before flipping the shell.

### 7.5 Flip shell and keep rollback window

<!-- files: afx-vscode/apps/chat/src/components/chat/chat.types.ts, afx-vscode/apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-ROLLOUT] -->

- [x] Remove obsolete `ChatWindowFlags.useNewShell` instead of flipping it; there is no retained old-shell branch.
- [x] Confirm old inline shell branch is absent; rollback is release/git revert of the componentization changes.
- [x] Document release-window rollback instructions in the implementation summary.

### 7.6 Remove old shell after one release

<!-- files: afx-vscode/apps/chat/src/views/chat.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-ROLLOUT] -->

- [x] Remove old inline shell code; `views/chat.tsx` is already a lightweight route shell.
- [x] Remove `useNewShell` from `ChatWindowFlags` after old shell removal.
- [x] Re-run 7.1-7.4 after cleanup.
- [x] Confirm `views/chat.tsx` is a lightweight route shell.

### 7.7 Practical performance and memory benchmark baseline

<!-- files: afx-vscode/apps/chat/e2e/chat-window-benchmark.spec.ts, afx-vscode/packages/transport/src/mock.ts, afx-vscode/docs/specs/216-app-chat-window-componentization/performance-baseline.json -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF] [DES-TEST] -->

- [x] Add a deterministic long AI coding-chat mock scenario with markdown, code blocks, tool summaries, usage, and compaction context.
- [x] Add Playwright e2e coverage for long-transcript hydration, composer typing responsiveness, DOM size, and Chromium heap delta.
- [x] Record the first benchmark measurements and budgets in a durable baseline artifact.
- [x] Keep thresholds loose enough to catch catastrophic regressions without pretending dev-mode Playwright is a lab benchmark.

---

## 8. State Lift, Action Surface, And Panel Registry Consumer

> Added in response to the Phase 0–7 code review (see `08-001` fleet sprint Phase 5). Phases 1–7 landed the structural shell; this phase makes the controller pattern load-bearing.

### 8.1 Lift cross-region state into the controller

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts, afx-vscode/apps/chat/src/components/chat/chat-window.tsx, afx-vscode/apps/chat/src/components/chat/chat-controller.test.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE] [DES-DATA] -->

- [x] Move `messages`, `noteEvents`, `commandOutputs`, `runtime`, `usage`, `queued`, `workspaceMode` ownership to `chat-controller.tsx`.
- [x] Surface them on `controller.state.*`.
- [x] Migrate the bridge `on()` handler bodies that write those atoms into the controller.
- [x] `ChatWindow` reads via `controller.state.*` instead of declaring the `useState`s itself.
- [x] Composer-local state stays in `ChatWindow` per `[DES-STATE]` ownership rule.

### 8.2 Move action surface to the controller

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat-window.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE] [DES-API] -->

- [x] Lift `abort`, `setMode`, `acceptHostWorkspaceMode`, `setThinkingLevel`, `dispatchHostAction` to `controller.actions.*` with stable `useCallback` identity.
- [x] `ChatWindow` invokes `controller.actions.X`.
- [ ] Lift `submit`, `saveAsNote`, `startCompact`, `startNewSession`, `handleMemorySelect`, `handleOpenModifiedFile`, `handleDismissModifiedFiles`, queue/blocked/note actions, `toggleIncludeActiveFileContext`, `openAttachmentPicker`. **Deferred** to `08-003`. `submit` depends on composer-local state and many derived flags; lifting it requires either lifting that state too or threading 8+ params, both too large for this pass.

### 8.3 Migrate one strip to `ComposerPanelDefinition`

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-window.tsx, afx-vscode/apps/chat/src/components/chat/composer-panels.tsx, afx-vscode/apps/chat/src/components/chat/composer-panel-stack.test.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] -->

- [x] Build production-shape panel for the queue: `QueuePanel`, `QueueRows`, `QueueClearAllAction` exported from `composer-panels.tsx`. These extract the queue body and the "Clear all" action without the legacy `ComposerStrip` chrome.
- [x] Add `actions?: ReactNode` slot to `ComposerPanelDefinition` and pass it through `ComposerPanelStack` → `ComposerPanel`. Header now hosts panel-scoped buttons like "Clear all".
- [x] `composer-panel-stack.test.tsx` mounts the queue panel through `ComposerPanelStack`'s `config` prop; asserts body render, clear-all callback, per-row dismiss. End-to-end registry pipeline proven.
- [ ] Flip the in-place ChatWindow JSX from `<QueueStrip>` to the registered `QueuePanel`. **Deferred** to `08-003` so all 6 strips migrate atomically — mixing `ComposerStrip` and `ComposerPanel` chrome in the same dock would cause inconsistent typography, and config-rendered-after-children would reshuffle the visible position from #2 to bottom-of-stack.
- [ ] Migrate `FilesStrip`, `BlockedCommandStrip`, `ChatDocActionsStrip`, `ModeSuggestStrip`, `AfxCommandSuggestStrip`. **Deferred** to `08-003`.

### 8.4 Lock in render-count budgets

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-window.performance.test.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF] -->

- [x] Add render-count assertions for `ChatTopBar`, `ComposerFooter`, `ComposerActions`. (`ConversationTimeline` was already covered in Phase 4.)

### 8.5 Doc honesty pass

<!-- files: afx-vscode/docs/specs/216-app-chat-window-componentization/design.md, afx-vscode/docs/specs/216-app-chat-window-componentization/tasks.md, afx-vscode/docs/specs/216-app-chat-window-componentization/journal.md, docs/specs/900-fleet/08-001-refactor-chat-window-components/refactor-chat-window-components.md -->

- [x] Replace the aspirational slice-hook surface in `[DES-STATE]` with the **current** controller surface; tag the slice-hook shape as deferred target.
- [x] This Phase 8 added; Phase 7's `[x]` markers reconciled with reality.
- [x] `08-001` fleet sprint marks acceptance criteria honestly and adds Phase 5.

---

## 9. Full Lift — Finish What Phase 8 Partially Did

> Mirrors fleet `08-001` Phase 6. Closes the deferred items from Phase 8 by lifting all remaining state, all bridge handlers, all actions, materializing region slices, and migrating every strip to the panel registry. After this phase `ChatWindow` is a true ~300-line composition root and the spec/code drift is closed.

### 9.1 Lift remaining state into the controller

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat-window.tsx -->
<!-- @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE] [DES-DATA] -->

- [x] Lift `internalAgentStatus`, `thinking`, `models`, `commands`, `files`, `activeFileContext`, `activeDocContext`, `customProviderLabels`, `onboardingFlags`, `blockedAction`, `includeActiveFileContext`, `dismissedDocActionsStrip`, `afxCommandSuggestVisible`, `afxCommandSuggestDismissed`, `dismissedAtAssistantMessageId`. Surfaced on `controller.state`.
- [x] Move lifecycle refs: `activeCommandRef`, `pendingDangerousRef`, `pendingAfxCommandSuggestRef`, `afxCommandSuggestDismissedRef`, `latestWorkspaceModeRef`.
- [x] Expose `controller.derived.*` with `agentStatus` (external override + internal fallback), `isStreaming`, `isCompacting`, `runtimeUnavailable`, `runtimeUnconfigured`, `rpcEnabled`, `isExploreMode`.
- [x] Composer-local state stays in `ChatWindow`: `slashOpen`, `mentionOpen`, `activeTrigger`, `userScrolledUp`, `historyCursorRef`, `draftBeforeHistoryRef`, scroll/composer DOM refs, `insertedCommandRef`.

### 9.2 Move all bridge handlers into the controller

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat-window.tsx -->

- [x] All ~23 `bridge.on(...)` calls live inside the controller's `useChatBridgeSubscriptions`. `ChatWindow` makes zero direct bridge subscriptions.
- [x] Mount-time handshake (`chat/getState`, `chat/getModels`, `chat/getCommands`, `chat/getSettingsSnapshot`) lives in the controller.
- [x] Toast notifications fired from handlers move with the handler.

### 9.3 Lift action surface

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat-window.tsx -->

- [x] Trivial actions: `startCompact`, `handleOpenModifiedFile`, `dismissModifiedFiles`, `dismissQueued`, `clearAllQueued`, `restoreBlockedCommand`, `copyBlockedCommand`, `selectModel`, `setOnboardingFlag`, `setAfxCommandSuggestVisible`, `setAfxCommandSuggestDismissed`, `toggleIncludeActiveFileContext`.
- [x] Composer-coupled actions accept a `ComposerLocalCallbacks` parameter so they live on the controller without lifting composer-local state: `submit`, `saveAsNote`, `startNewSession`, `handleMemorySelect`.
- [x] All actions returned from `controller.actions.*` with stable `useCallback` identity.

### 9.4 Migrate all 6 strips to `ComposerPanelDefinition`

<!-- files: afx-vscode/apps/chat/src/components/chat/composer-panel.tsx, afx-vscode/apps/chat/src/components/chat/composer-panels.tsx, afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat-window.tsx -->

- [x] Extend `ComposerPanel` chrome with `count?: number` and `tone?: 'neutral' | 'brand' | 'warning'` (parity with `ComposerStrip`).
- [x] Build `Files`, `Queue`, `BlockedCommand`, `DocActions`, `ModeSuggest`, `AfxCommandSuggest` panel components from existing strip bodies.
- [x] Controller exposes `composerPanelStackConfig: ComposerPanelStackConfig` built from current state + lifted strip actions; ordering matches the visible order shipped through Phase 5.
- [x] `ChatWindow` passes `controller.composerPanelStackConfig` to `ComposerPanelStack`. JSX-children rendering for strips retired.

### 9.5 Materialize region slices

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-controller.tsx, afx-vscode/apps/chat/src/components/chat/chat.types.ts, afx-vscode/apps/chat/src/components/chat/chat-window.tsx -->

- [x] `controller.slices.topBar`, `conversation`, `composer`, `composerActivity`, `footer`, and `history` return region-shaped data plus slice-scoped actions where needed.
- [x] `chat.types.ts` slice interfaces tightened to real types (no `unknown[]` placeholders).
- [x] Region components consume narrow props derived from `controller.slices.*` — no whole-controller passing.

### 9.6 Render-count budgets enforced for every memo region

<!-- files: afx-vscode/apps/chat/src/components/chat/chat-window.performance.test.tsx -->

- [x] Render-count assertions for ConversationTimeline, ChatTopBar, ComposerActivityBar, ComposerFooter, ComposerActions, ComposerToolbar, ConversationScrollButton, ConversationEmptyStates, ComposerPanel.

### 9.7 Spec drift closed

<!-- files: afx-vscode/docs/specs/216-app-chat-window-componentization/{design,tasks,journal}.md, docs/specs/900-fleet/08-001-refactor-chat-window-components/refactor-chat-window-components.md -->

- [x] `[DES-STATE]` documents the current `controller.slices.*` surface.
- [x] `[DES-DATA]` Panel Registry Implementation Status flips to "all 6 strips registered, JSX-children retired".
- [x] Phase 8 deferred items marked closed with cross-reference to 9.x tasks.
- [x] `08-001` fleet acceptance has zero open `[ ]` items modulo screen-reader QA.

---

## Coverage Matrix

| Requirement | Covered By Tasks                         |
| ----------- | ---------------------------------------- |
| FR-1        | 2.2, 6.2, 7.6                            |
| FR-2        | 2.1, 6.1, 8.1, 9.1                       |
| FR-3        | 1.1, 1.2, 1.3                            |
| FR-4        | 1.1, 2.1, 3.x, 4.x, 5.x, 8.1, 9.1        |
| FR-5        | 0.1, 1.1, 2.1, 3.x, 4.x, 5.x, 9.5        |
| FR-6        | 1.3, 3.x, 4.x, 5.x, 7.1, 7.4             |
| FR-7        | 1.1, 2.1, 5.1, 6.1                       |
| FR-8        | 0.2, 3.x, 4.x, 5.x                       |
| FR-9        | 1.1, 5.2                                 |
| FR-10       | 1.1, 5.1, 8.3, 9.4                       |
| FR-11       | 1.1, 5.1, 6.3                            |
| FR-12       | 0.1, 0.2, 6.2                            |
| NFR-1       | 1.x through 6.x, 8.1, 8.2, 9.1, 9.2, 9.5 |
| NFR-2       | 3.x through 7.x, 8.1, 8.2, 8.3, 9.x      |
| NFR-3       | 0.3, 4.1, 5.6, 7.2, 8.4, 9.6             |
| NFR-4       | 0.1, 0.2, 6.2, 9.5, 9.6                  |
| NFR-5       | 1.x through 6.x, 9.5                     |
| NFR-6       | 1.1, 5.1, 5.2, 8.3, 9.4                  |
| NFR-7       | 7.2, 7.7                                 |

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task                                                                 | Action    | Files Modified                                                                                                                                                                                                                                                                                                        | Agent | Human |
| ------------------------ | -------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-15T10:49:47.000Z | 216#1.1, 216#2.1                                                     | Completed | apps/chat/src/views/chat.tsx, apps/chat/src/components/chat/chat-window.tsx, apps/chat/src/components/chat/chat.types.ts, docs/specs/216-app-chat-window-componentization/tasks.md, docs/specs/216-app-chat-window-componentization/journal.md                                                                        | [x]   | [x]   |
| 2026-05-15T11:13:18.000Z | 216#3.x, 216#4.x, 216#5.x                                            | Completed | apps/chat/src/components/chat/chat-top-bar.tsx, apps/chat/src/components/chat/conversation-_.tsx, apps/chat/src/components/chat/composer-_.tsx, apps/chat/src/components/chat/composer-panel-stack.test.tsx, docs/specs/216-app-chat-window-componentization/tasks.md                                                 | [x]   | [x]   |
| 2026-05-15T12:12:05.000Z | 216#1.2, 216#1.3                                                     | Completed | apps/chat/src/components/chat/chat-controller.ts, apps/chat/src/components/chat/chat-controller.test.tsx, apps/chat/src/components/chat/chat-window.tsx, docs/specs/216-app-chat-window-componentization/tasks.md, docs/specs/216-app-chat-window-componentization/journal.md                                         | [x]   | [x]   |
| 2026-05-15T12:26:52.000Z | 216#6.1, 216#6.2, 216#7.4                                            | Completed | apps/chat/src/components/chat/_.tsx, apps/chat/src/components/chat/_.test.tsx, apps/chat/src/views/chat.tsx, docs/specs/210-app-chat/_.md, docs/specs/211-app-chat-composer/_.md, docs/specs/212-app-chat-messages/_.md, docs/specs/213-app-chat-history/_.md, docs/specs/216-app-chat-window-componentization/\*.md  | [x]   | [x]   |
| 2026-05-15T12:30:41.000Z | Work Sessions recovery                                               | Completed | docs/specs/216-app-chat-window-componentization/tasks.md, docs/specs/216-app-chat-window-componentization/journal.md                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-15T13:12:09.000Z | 216#0.2-0.3, 216#1.2-1.3, 216#3.2, 216#4.3, 216#5.3-5.6, 216#7.2-7.6 | Completed | apps/chat/src/components/chat/chat-controller.ts, apps/chat/src/components/chat/chat-controller.test.tsx, apps/chat/src/components/chat/chat-window.tsx, apps/chat/src/components/chat/chat-window.performance.test.tsx, apps/chat/src/components/chat/composer-panels.tsx, apps/chat/src/components/chat/\*.test.tsx | [x]   | [x]   |
| 2026-05-15T13:52:59.000Z | 216#5.1, 216#5.3, 216#6.3, 216#7.2, 216#7.7                          | Completed | apps/chat/e2e/chat-window-benchmark.spec.ts, packages/transport/src/mock.ts, packages/transport/src/mock.test.ts, apps/chat/src/components/chat/chat-window.tsx, apps/chat/src/components/chat/composer-\*.tsx, docs/specs/216-app-chat-window-componentization/\*.md                                                 | [x]   | [x]   |
| 2026-05-15T23:01:53.000Z | 216#8.1, 216#8.2, 216#8.3, 216#8.4, 216#8.5                          | Completed | apps/chat/src/components/chat/{chat-controller,chat-window,composer-panels,composer-panel-stack.test,chat-window.performance.test,chat-controller.test}.{ts,tsx}, docs/specs/216-app-chat-window-componentization/\*.md, fleet 08-001 sprint                                                                          | [x]   | [x]   |
| 2026-05-16T01:28:11.000Z | 216#9.x (full lift)                                                  | Completed | chat-controller.tsx (renamed from chat-controller.ts), chat-window.tsx, composer-panel.tsx, composer-panels.tsx, files-panel.tsx, chat-doc-actions-panel.tsx + their .test.tsx counterparts; composer-strip.tsx removed; render-isolation stabilized via useStableCallback (no behavior change). Journal close-out .  | [x]   | [x]   |
