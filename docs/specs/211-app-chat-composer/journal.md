---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-05-03T11:23:57.000Z"
updated_at: "2026-05-05T10:28:33.000Z"
tags: ["app", "chat", "composer", "webview", "journal"]
---

# Journal - App Chat Composer

<!-- prefix: CC -->

> Quick captures and discussion history for AI-assisted development sessions.
> See [agenticflowx.md](../agenticflowx.md) for workflow.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

- `2026-05-04T08:02:36.000Z` `/afx-dev debug`: production queue bug found in composer/host queue paths. Rapid steer/follow-up submissions were dispatched concurrently to the runtime instead of serialized, local queue rows did not reconcile when `pendingMessageCount` drained to zero, and queue rows lacked visible `Steer` / `Follow-up` labels. Fixed in `apps/vscode/src/panels/sidebar-panel.ts` and `apps/chat/src/views/chat.tsx`; added regression coverage in app/sidebar tests. `[FR-4] [FR-8] [DES-COMPOSER-QUEUE] [DES-COMPOSER-FLOW]`
- `2026-05-05T07:29:30.000Z` `/afx-dev debug`: composer streaming actions lacked visible shortcut affordances for follow-up and steer. Updated streaming action buttons to show compact visible labels and shortcut chips: `Follow-up ⏎` and `Steer ⌘⏎`, moved follow-up/steer footer hints before idle send/note copy for narrow sidebars, and preserved accessible button names. Added regression coverage in `apps/chat/src/app.test.tsx`. `[FR-1] [FR-2] [FR-4] [NFR-1] [DES-COMPOSER-KEYS] [DES-COMPOSER-QUEUE] [DES-COMPOSER-FOOTER]`
- `2026-05-05T07:49:21.000Z` `/afx-dev debug`: P0 manual compaction UX/state bug. Compacting did not lock the composer, so overlapping sends could race with Pi compaction and leave chat stuck in a stale streaming state. Locked the composer and compact button while compaction is active, guarded host sends during manual compaction, and reset runtime busy state when compaction completes. Added chat/host regression coverage. `[FR-1] [FR-2] [NFR-3] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-FOOTER]`
- `2026-05-05T08:18:33.000Z` `/afx-dev refactor`: follow-up code smell cleanup after the manual compaction P0 fix. Extracted state-aware composer placeholder and compact-tooltip helpers, centralized composer disabled checks, and moved host compaction lock/reset logic behind named helpers so future compaction changes do not add more nested conditionals or partial state resets. `[FR-1] [FR-2] [NFR-3] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-FOOTER]`
- `2026-05-05T08:37:39.000Z` `/afx-dev docs`: synchronized composer ASCII mockups with the implemented streaming follow-up/steer labels and manual compaction lock state. Added `[DES-COMPOSER-MOCKUP-COMPACTING]` so the disabled placeholder, compact lock, and footer reference are traceable for future UI work. `[FR-1] [FR-2] [NFR-3] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-MOCKUP-COMPACTING]`
- `2026-05-05T09:27:33.000Z` `/afx-task code`: added a "Modified files" strip above the composer that lists files touched by edit/write tool calls in the current transcript. Pills are clickable and dispatch a new `chat/openFile` bridge message; the host opens the file via `vscode.window.showTextDocument`. Strip is collapsed-by-default, dismissable per-assistant-turn (re-shows on the next turn that produces an edit), and stacks above the queue strip. New files: `apps/chat/src/components/files-strip.tsx`, `apps/chat/src/lib/derive-modified-files.ts`. Wired into `apps/chat/src/views/chat.tsx`. Protocol variant added in `packages/shared/src/messages.ts`; host case added in `apps/vscode/src/panels/sidebar-panel.ts`. Spec bumped to `1.1` with FR-10; design bumped to `1.3` with new section `[DES-COMPOSER-FILES-STRIP]` and four ASCII mockups (empty / collapsed / expanded / with-queue / dismiss-flow). Tests: 12 unit tests for `deriveModifiedFiles` (dedupe, ordering, path-key fallthrough, case-insensitive matching, ignored non-edit tools), 8 component tests for `FilesStrip` (collapsed-by-default, expand on chevron, basename rendering, click dispatch, ✕ dismiss), 4 Playwright e2e tests using the `tool-edit-file` mock scenario (hidden empty, appears collapsed, expand-to-pill, dismiss-and-reappear-next-turn). Generic across coding harnesses: matches tool names by lowercase substring (edit/write/patch/create/notebookedit) and probes path keys in order (path/filePath/file_path/notebook_path) — confirmed compatible with pi-mono `edit`/`write` tool naming and dual `path`/`file_path` arg convention. `[FR-10] [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-FILES-COLLAPSED] [DES-COMPOSER-MOCKUP-FILES-EXPANDED] [DES-COMPOSER-MOCKUP-FILES-WITH-QUEUE] [DES-COMPOSER-MOCKUP-FILES-DISMISS-FLOW]`
- `2026-05-05T10:04:49.000Z` `/afx-task code`: extended the modified-files strip to jump the editor to the first changed line. Threaded `firstChangedLine` (1-indexed) end-to-end: pi-mono's `edit` tool already exposes `result.details.firstChangedLine`, so the adapter (`sidebar-panel.ts`) extracts it via a new `extractFirstChangedLine` helper and forwards it on `chat/toolEnd`. Added `firstChangedLine?: number` to `ChatToolView` and `chat/toolEnd`, `line?: number` to `chat/openFile`, and `line?: number` to `ModifiedFile`. The `FilesStrip` pill now renders a muted `:N` suffix and announces "Open ...:N at line N" via aria-label; click ships `chat/openFile { path, line }`; the host converts to VSCode 0-indexed `Range` and passes `{ selection, preview: false }` to `showTextDocument`. Mock `tool-edit-file` scenario now emits `firstChangedLine: 142` so DevOverlay and e2e can exercise the path. Spec bumped to `1.2`; design `1.4`; shared `1.5`; vscode `1.3`. Tests: +3 unit tests for `deriveModifiedFiles` line behavior (thread, undefined when absent, dedupe takes latest line) and +2 component tests for the pill (passes line on click, renders `:N` suffix + line-aware aria-label) and +1 e2e (verifies pill aria-label contains "at line 142" after `tool-edit-file` toolEnd lands). Fully optional and harness-agnostic — adapters that don't report `firstChangedLine` get the original behavior (open at top). `[FR-10] [DES-COMPOSER-FILES-STRIP]`
- `2026-05-05T10:28:33.000Z` `/afx-dev review`: pre-prod review pass. (1) Flipped FilesStrip to **expanded by default** so the pill list is immediately visible (`defaultExpanded` defaults to `true` in `ComposerStrip`, so we just dropped the explicit `false`). (2) Fixed a real bug: when a user aborts a turn mid-tool, pi-mono does not synthesize a `tool_execution_end`, so the FilesStrip pulse animation ticked forever. Added a sweep in the `chat/aborted` handler that flips any `running` tool views to `error` so the dot stops pulsing and the pill shows the aborted state. (3) Added path normalization (`./foo.ts` / `foo.ts` / `foo//ts` / `foo\\ts` all dedupe to `foo.ts`) so tool calls emitting different path forms collapse correctly. (4) Added `data-status` attribute to `FilePill` for testability. Spec bumped to `1.3`; design `1.5`. Tests: +1 component test (default-expanded shows pills immediately + aria-expanded=true), +1 component test (chevron collapses pill list), +2 unit tests for path normalization (dedupe across forms, output strips leading `./`), +1 app integration test (running tool flips to error on `chat/aborted`). 434 unit tests pass; 13 chat e2e pass; 11 vscode-e2e pass; `pnpm verify:full` exit 0. `[FR-10] [DES-COMPOSER-FILES-STRIP]`

---

## Discussions

<!-- Recorded discussions with IDs: XX-D001, XX-D002, etc. -->
<!-- Chronological order: oldest first, newest last -->

### CC-D001 - System Command Support (`!ls`)

`status:closed` `2026-05-03T11:23:57.000Z` `[system-command, UX, shell]`

**Context**: User requested support for sending system commands via `!` prefix (e.g., `!ls`) to execute locally without sending to LLM.

**Summary**: Implemented system command prefix detection in the chat composer. Commands prefixed with `!` dispatch `chat/runCommand` to the extension host and execute locally via `child_process.spawn`, with output streamed back as a distinct message type. UX uses persistent amber badge + footer warning (not blocking), with dangerous-pattern guard for destructive commands.

**Progress**:

- [x] Add `chat/runCommand` message type to `@afx/shared` `[FR-9]`
- [x] Add `chat/runCommand` handler to `sidebar-panel.ts`
- [x] Update spec.md with system command requirements `[FR-9, NFR-6]`
- [x] Discuss UX approach (Option A + C recommended)
- [x] Update spec with UX decisions (badge, footer, dangerous guard)
- [x] Approve spec.md `[FR-9]`

**Decisions**:

- Detection happens in the webview composer (client-side, before routing)
- Shell: any command (`bash` on Unix, `cmd`/`powershell` on Windows) via `child_process.spawn`
- CWD: VSCode workspace root
- Timeout: 30s default; spinner after 5s
- Concurrent: allowed while LLM is streaming
- Output format: monospace block, stdout muted, stderr red, exit code badge
- UX: amber "Shell" badge + persistent footer warning (no blocking)
- Dangerous-pattern guard: confirm dialog for `rm -rf`, `del /f /s`, `format`, `mkfs`, `dd`

**Tips/Ideas**:

- Output rendered as distinct `ChatSystemCommand` view type in timeline
- Consider workspace setting `afx.systemCommands.enabled` in future for per-workspace disable

**Notes**:

- **[CC-D001.N1]** `2026-05-03T11:23:57.000Z` Spec status changed to Approved; `/afx-design author` now unlocked `[FR-9]`

**Related Files**: `packages/shared/src/messages.ts`, `apps/vscode/src/panels/sidebar-panel.ts`, `docs/specs/211-app-chat-composer/spec.md`
**Participants**: @rixrix

---

### CC-D002 - Design-to-Implementation Gap Analysis (Task 5.5 Fixes)

`status:closed` `2026-05-03T13:41:33.000Z` `[system-command, bug-fix, design-compliance, traceability]`

**Context**: During `/afx-task verify 5.5` and subsequent `/afx-task code 5.5`, discovered multiple gaps between the approved design (`design.md`) and the actual implementation in `chat.tsx` and `sidebar-panel.ts`. User also reported that `!` commands were failing with a provider error — indicating the LLM bypass was not working.

**Summary**: A systematic gap analysis revealed 8 issues ranging from critical functional bugs (runtime-unavailable guard blocking `!` commands) to visual misalignment (Shell badge in wrong location) to missing error handling (timeout signal). All issues were fixed with targeted edits. The root cause of most issues was that the `isSystemCommand` guard was checked **after** the `runtimeUnavailable` guard, causing `!` commands to be dropped when the agent runtime was down — even though system commands never touch the LLM.

**Decisions**:

- System commands must bypass ALL runtime checks (`runtimeUnavailable`, `runtimeUnconfigured`) because they execute in the extension host, not the agent runtime
- `canSend` and all `disabled` props must use `(!isSystemCommand && runtimeUnavailable)` pattern
- Shell badge belongs in the InputGroup toolbar (replacing the @ mention button), not the ActivityBar
- Inline warning `"⚠ Shell · output is local only"` should appear between the textarea and toolbar for visibility
- `agent/commandOutput` must carry `kind?: "stdout" | "stderr"` so the webview can render stderr in red
- Timeout should emit explicit `error: "Command timed out after 30s"` rather than just `exitCode: -1`

**Progress**:

- [x] Fix `submit()` guard to allow `!` when runtime unavailable
- [x] Fix `canSend` to allow `!` when runtime unavailable
- [x] Fix textarea `disabled` prop for `!` mode
- [x] Fix @ button / ModelCombobox `disabled` prop for `!` mode
- [x] Move Shell badge from ActivityBar to InputGroup toolbar (replaces @ button)
- [x] Add inline warning below textarea during `!` mode
- [x] Add `kind?: "stdout" | "stderr"` to `agent/commandOutput` message type
- [x] Update extension host to emit `kind` on stdout/stderr streams
- [x] Update `OutputCard` to accept separate `stdout`/`stderr` props and render stderr in red
- [x] Update `OutputCard` tests for new props
- [x] Fix timeout handling to emit explicit error on SIGTERM
- [x] Verify: `pnpm check:types` — 8/8 passed
- [x] Verify: full workspace tests — 344 passed

**Tips/Ideas**:

- Consider extracting `isComposerDisabled(isSystemCommand, isCheckingAgent, runtimeUnavailable)` helper to avoid repeating the guard pattern across 4+ locations
- Future: when adding new composer controls, always test with `!` prefix to ensure they don't accidentally block system commands

**Notes**:

- **[CC-D002.N1]** `2026-05-03T13:41:33.000Z` The design mockup `[DES-COMPOSER-MOCKUP-SYSTEM-COMMAND]` shows the Shell badge replacing the `@` button — implementation had it in ActivityBar instead. This was a visual/structural mismatch that didn't affect functionality but violated NFR-6 (persistent cues in input group).
- **[CC-D002.N2]** `2026-05-03T13:41:33.000Z` The stderr red-coloring issue was a data-model gap: the design assumed per-line `kind` discrimination (`l.kind === "stderr"`), but the message protocol had no `kind` field. Adding `kind` to `agent/commandOutput` was the minimal fix that preserved backward compatibility (optional field).
- **[CC-D002.N3]** `2026-05-03T13:48:47.000Z` **Bug**: On first load / new session (`messages.length === 0`), the `OutputCard` was not rendered because it was inside the `messages.length > 0` branch. The `<EmptyState>` component masked all command output. Fix: changed condition to `messages.length === 0 && !commandOutput` so command output skips EmptyState and shows the timeline card instead.
- **[CC-D002.N4]** `2026-05-03T13:55:41.000Z` **Bug**: After running `!ls`, subsequent `!touch` or `!rm` commands showed EmptyState again. Two root causes: (1) `setCommandOutput(null)` cleared previous output when a new command started, and (2) silent commands (no stdout/stderr before `done`) never created a `commandOutput` entry because the `done` handler skipped when `prev` was null. Fix: changed `commandOutput` from a single ephemeral slot to `commandOutputs[]` — a persisted array. Each command appends a new entry; previous outputs stay visible; silent commands get an entry via the `done`-only path; EmptyState only shows when both `messages.length === 0 && commandOutputs.length === 0`.

**Related Files**: `apps/chat/src/views/chat.tsx`, `apps/chat/src/components/output-card.tsx`, `apps/chat/src/components/output-card.test.tsx`, `apps/vscode/src/panels/sidebar-panel.ts`, `packages/shared/src/messages.ts`
**Participants**: @rixrix

---

## Prompt Captures

<!-- Verbatim user prompts + agent reply excerpts at pivotal moments. Append-only. -->
<!-- IDs: {PREFIX}-P001, {PREFIX}-P002, ... (P for "prompt", distinct from D for "discussion") -->
<!-- Trigger kinds: new-fr | new-nfr | removed-fr | design-pivot | missed-req | scope-cut | ambiguity-resolved | question-resolved | other -->

---

## Approval

### Spec Approval (2026-05-03)

Spec approved and frozen. Further changes require version bump.
/afx-design author now unlocked.

Approved by: @rixrix
Review score: 0 Critical, 0 Major, 0 Minor issues

Next step: `/afx-design author 211-app-chat-composer`

### Design Approval (2026-05-03)

Design approved and frozen. Further changes require version bump.
`/afx-task plan` now unlocked.

Approved by: @rixrix
Validation: PASSED (all 12 required sections present, all FR/NFR covered, traceability verified)
Review: 0 Critical, 0 Major, 0 Minor issues

Key additions during authoring:

- `DES-COMPOSER-SYSTEM-COMMAND` section with end-to-end flow diagram
- Client-side prefix detection TypeScript snippet
- Extension host shell execution TypeScript snippet (child_process.spawn)
- Output card rendering TypeScript snippet
- Bypass LLM guarantee explicit statement
- Dangerous-pattern guard (`rm -rf`, etc.) confirm dialog mockup

Next step: `/afx-task plan 211-app-chat-composer`

### Tasks Planned (2026-05-03)

Tasks updated to version 1.1 with Phases 4-7 for system command implementation.

Phases added:

- Phase 4: System Command Protocol (4.1 message types)
- Phase 5: System Command Implementation (5.1-5.5 prefix detection, UX, guard, host, output)
- Phase 6: System Command Testing (6.1 unit, 6.2 integration)
- Phase 7: Verification (7.1 traceability)

All FR-9 and NFR-6 requirements now covered in tasks.

Next step: `/afx-task pick 4.1`
