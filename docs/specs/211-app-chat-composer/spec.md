---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.7"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T09:28:04.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: ["app", "chat", "composer", "webview", "mode", "workspace-mode", "host-guard"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "130-package-ui",
    "131-package-ui-design-system",
    "210-app-chat",
  ]
---

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

The chat composer has become a dense interaction surface: input, queued content, footer hints, activity state, slash commands, mentions, model/thinking selection, workspace mode control, blocked Explore feedback, and send/abort/steer behavior all converge in one area. Small changes such as updating footer instructions should start from a precise spec instead of requiring a full chat source read.

---

## User Stories

### Primary Users

Chat users, developers maintaining the chat webview, and AI agents making targeted composer updates.

### Stories

**As a** user
**I want** composer controls and footer instructions to match the current runtime state
**So that** I know whether to send, steer, queue, clear, or configure the agent

**As an** AI agent
**I want** a composer entry map
**So that** footer, input, queue, helper, and keyboard updates can be made surgically

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Priority    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Own the composer root layout, input group, textarea placeholder, send/abort/steer buttons, and keyboard submission policy                                                                                                                                                                                                                                                                                                                                                                                       | Must Have   |
| FR-2  | Own composer footer hints, runtime readiness copy, Pi pill copy, usage tooltip copy, queue copy, and disabled-state copy                                                                                                                                                                                                                                                                                                                                                                                        | Must Have   |
| FR-3  | Own slash command and mention helper behavior that appears from composer input, including trigger detection, file listing, command formatting, and trigger replacement                                                                                                                                                                                                                                                                                                                                          | Must Have   |
| FR-4  | Own queued content strip behavior, including local mirror rows, steer/follow-up grouping, collapse, dismiss, and clear-all affordances                                                                                                                                                                                                                                                                                                                                                                          | Must Have   |
| FR-5  | Own the combined model/thinking composer control, including a collapsed trigger label that shows the selected model plus thinking level, always-visible thinking options, nested model submenu with API/external grouping, and settings fallback                                                                                                                                                                                                                                                                | Should Have |
| FR-6  | Own prompt-history recall from the composer textarea, including ArrowUp/ArrowDown cursor policy and draft restoration                                                                                                                                                                                                                                                                                                                                                                                           | Should Have |
| FR-7  | Own composer-adjacent activity strip behavior that previews live thinking without becoming the message timeline                                                                                                                                                                                                                                                                                                                                                                                                 | Should Have |
| FR-8  | Preserve host/webview boundaries; composer UI sends bridge messages but does not call VSCode APIs directly                                                                                                                                                                                                                                                                                                                                                                                                      | Must Have   |
| FR-9  | Intercept system-command prefixes (`!`) in the composer and dispatch `chat/runCommand` instead of sending to the LLM; strip the `!` prefix before routing                                                                                                                                                                                                                                                                                                                                                       | Must Have   |
| FR-10 | Render a "Modified files" strip above the composer that lists files touched by agent edit/write tool calls in the current transcript; pills open the file in the editor on click and, when the tool result reports a first-changed line, jump the editor cursor there; dismissible per assistant turn; expanded by default (user can collapse via the chevron)                                                                                                                                                  | Should Have |
| FR-11 | Render a compact active-file context toggle after the workspace mode control in the composer toolbar, default it on, and mirror the same preference with Settings                                                                                                                                                                                                                                                                                                                                               | Must Have   |
| FR-12 | Own the workspace mode control in the composer toolbar, including the leading icon, `Mode` label, tooltip, dropdown menu, Code default, and Explore experimental/read-only copy for inspection, tracing, and planning; the control sits after the context divider and before the file-context control                                                                                                                                                                                                           | Must Have   |
| FR-13 | Render the host-blocked Explore command strip when `agent/actionBlocked` arrives, including Switch to Code, Copy command, and Dismiss affordances                                                                                                                                                                                                                                                                                                                                                               | Must Have   |
| FR-14 | Extend the workspace mode control with a third Spec entry (planning-only posture) in the dropdown, surface a per-mode CSS border accent on the InputGroup wrapper via a `data-workspace-mode` attribute, and add a Spec-tailored footer hint                                                                                                                                                                                                                                                                    | Must Have   |
| FR-15 | When an AFX document is the active editor, render a subtle doc-actions strip above the composer that surfaces catalog-verified SDD intent buttons routed by detected format; in Spec mode keep the strip primary, outside Spec mode keep it compact and non-blocking; render a separate mode-suggest strip when an AFX/sprint file is active and the user is not yet in Spec mode                                                                                                                               | Must Have   |
| FR-16 | Surface low-noise AFX workflow affordances from existing composer anchors: shared Memory dropdown, More menu with command-context presets/focus targets, and parsed `Next:` result actions under completed assistant messages; mutating/open-argument commands must be draft-first, deterministic read/verify commands may auto-send                                                                                                                                                                            | Should Have |
| FR-17 | The doc-actions strip header renders a workflow-position breadcrumb (`Spec ✓ → Design ⏳ → Tasks 3/8 → Code`) in Spec mode for standard 4-file features and for sprint files; clicking the breadcrumb auto-sends `/afx-next` (deterministic read). Compact mode hides the breadcrumb to keep the strip narrow                                                                                                                                                                                                   | Should Have |
| FR-18 | The doc-actions strip header renders an icon-only Memory ▾ anchor sharing the same `MEMORY_CATALOG` as the composer-toolbar and top-right anchors; the catalog is single-sourced and identical across every anchor (NFR-12). Compact mode tucks the strip-header anchor under `···` More                                                                                                                                                                                                                        | Must Have   |
| FR-19 | When `tasks.md` is the active editor AND every body checkbox is `[x]` AND every Work Sessions Agent cell is `[x]` AND at least one Human cell is `[ ]`, the strip surfaces a brass `[Sign Off ▾]` button. Click opens a confirm popover previewing the atomic edit (rows to tick · status promotion · `updated_at` bump). Confirm dispatches `chat/hostAction { action: "tasks.signOff", uri }`; the host applies a single `WorkspaceEdit` (one undo entry) and posts `agent/signOffComplete` back for toast UX | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                   | Target                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Composer remains keyboard-friendly                            | Enter/modified-enter behavior is explicit and tested where possible                                                                                                                                                 |
| NFR-2 | Footer copy stays concise                                     | Footer state can be understood without reading settings docs                                                                                                                                                        |
| NFR-3 | Runtime state changes do not cause layout jumps               | Queue/footer/control surfaces remain stable                                                                                                                                                                         |
| NFR-4 | Composer helpers stay cheap                                   | Trigger detection is string-local and avoids bridge calls unless a picker opens                                                                                                                                     |
| NFR-5 | Source/spec traceability is bidirectional                     | Major composer zones have local source anchors and design node references                                                                                                                                           |
| NFR-6 | System command UX is persistent but unobtrusive               | An amber "Shell" badge appears in the composer input group when `!` is active; footer shows `"⚠ Shell · output is local only"`; these cues are always visible while the prefix is active and do not block execution |
| NFR-7 | Toolbar controls stay compact on the smallest supported width | The active-file context toggle collapses to switch-first form like the combined model/thinking control                                                                                                              |

---

## Acceptance Criteria

### Composer Routing

- [ ] Composer source files point at this spec and design
- [ ] Footer hint changes can start from this spec without reading history/settings/message specs
- [ ] Slash, mention, combined model/thinking, queue, send, steer, abort, and prompt-history behavior has a named owner, including a collapsed trigger label that shows the selected model plus thinking level
- [ ] Composer design includes ASCII UI, component/control, code locator, and trace matrix sections that map to source anchors

### System Commands

- [ ] Typing `!ls` and pressing Enter dispatches `chat/runCommand` instead of `chat/send`
- [ ] The `!` prefix is stripped before the command string is sent
- [ ] System commands execute concurrently with LLM streaming (separate execution context)
- [ ] Commands run in the VSCode workspace root directory
- [ ] Output and errors render as a distinct message type in the timeline
- [ ] Amber "Shell" badge visible in composer input group when `!` is active
- [ ] Footer persistent warning: `"⚠ Shell · output is local only"`
- [ ] Dangerous-pattern guard: commands containing `rm -rf`, `del /f /s`, `format`, `mkfs`, `dd` prompt a confirm dialog before execution (Cancel / Run anyway)
- [ ] Output card: monospace block; stdout in muted text, stderr in red, exit code as badge

### ASCII UI Mockup

```text
+--------------------------------------------------------------------------------+
| Chat | History | Settings                                                      |
|--------------------------------------------------------------------------------|
| transcript ...                                                                  |
|                                                                                |
| +---------------- Blocked command ------------------------------+               |
| | Shell command blocked in Explore mode.                      |               |
| | [Switch to Code] [Copy command] [Dismiss]                   |               |
| +--------------------------------------------------------------+               |
|                                                                                |
| [ Brain ] [ GPT-5.4 mini - Minimal ▾ ] | [ Mode ▾ ] [ File ctx on ] [ Send ]  |
|           \___________________________/   \_____________/                      |
|              Combined model/thinking     Mode control + context toggle          |
|                                                                                |
| Model                                                                          |
|   Thinking Level                                                               |
|   - Minimal                                                                    |
|   - Low                                                                        |
|   - Medium                                                                     |
|   - High                                                                       |
|   - Extra High                                                                 |
|   Model >                                                                      |
|     Provider                                                                   |
|       - xxx                                                                    |
|     External Agents                                                            |
|       - xxx                                                                    |
+--------------------------------------------------------------------------------+
```

### Modified Files Strip (FR-10)

- [ ] Strip is hidden when the transcript contains no edit/write tool calls
- [ ] Strip is **expanded by default** when present (pills visible immediately; chevron down). User can click the chevron to collapse.
- [ ] Header shows `MODIFIED · <count>` and a `✕` dismiss control
- [ ] Pills show the file basename and a status dot (running / ok / error)
- [ ] Pill click sends `chat/openFile { path, line? }`; the host opens the file and, when `line` is provided, scrolls/selects that line (1-indexed; host converts to VSCode 0-indexed `Range`)
- [ ] After dismiss, the strip stays hidden until the **next assistant message** produces an edit/write tool call
- [ ] Mid-turn edits do not cause a dismissed strip to re-open
- [ ] Files are deduped by path with most-recent-win ordering
- [ ] Composer source files anchor to FR-10 / DES-COMPOSER-FILES-STRIP

### Composer Active File Context Toggle (FR-11)

- [ ] Toggle appears immediately after the workspace mode control in the toolbar, with a literal `|` divider between them
- [ ] Toggle shows a compact switch to the left of the active file basename and reveals the full path on hover while remaining compact on the smallest supported width
- [ ] Toggle defaults to on when the persisted Settings preference has not yet arrived
- [ ] Toggle mirrors the persisted Settings preference so changing it in either surface updates the other
- [ ] Combined model/thinking and file-context controls expose shadcn tooltips with concise guidance
- [ ] Composer source files anchor to FR-11 / DES-COMPOSER-CONTEXT

### Workspace Mode Control (FR-12)

- [ ] Mode control appears after the `|` divider and before the active-file context toggle in the composer toolbar
- [ ] Mode control includes a leading icon, compact `Mode` label, hover tooltip, dropdown menu, and a visible default Code posture
- [ ] Explore mode copy labels the mode as experimental/read-only and makes the host boundary clear to the user
- [ ] Composer source files anchor to FR-12 / DES-COMPOSER-MODE

### Spec Composer Workflow Affordances (FR-15, FR-16)

- [ ] Doc-action buttons and menus use only verified entries from the bundled AFX command catalog, with explicit draft-first vs auto-send policy
- [ ] tasks.md groups compose/draft actions before a literal `|` divider and deterministic run-now actions after it; `Code` is always a dropdown with `Code all` (`/afx-task code all <feature>` for standard tasks, `/afx-sprint code <feature>` for sprint tasks), adding WBS-specific draft commands when task rows exist, while auto-send scoped choices such as `Pick` run immediately
- [ ] Standard task menus use task-group WBS IDs (`### N.N`) as user-facing targets and never pass a feature slug where public `/afx-task` expects a task id; whole-document verification uses `/afx-task verify all <feature>`
- [ ] Active-doc context includes the real editor `filePath` as an additive field so command-context presets can target ADR/research/context files without substituting the feature slug
- [ ] Every doc-action button has an intent icon from `lucide-react`: `PenLine` for compose/draft controls and `Zap` for run-now controls
- [ ] Memory actions render from one shared catalog opened by a single compact top-right/composer-toolbar trigger
- [ ] More menu exposes overflow doc actions, focus targets parsed from the active AFX doc, and command-context presets when enough context exists
- [ ] Completed assistant messages parse supported `/afx-*` follow-up commands from `Next:` output and surface them as draft/send action chips
- [ ] Icons come from `lucide-react` and match the command intent; no bespoke icon set is introduced for these controls
- [ ] Unit tests cover command catalog, doc actions, memory dropdown, context presets, result-action parsing/rendering, and host active-doc context parsing
- [ ] E2E coverage is required before broad rollout for: switching into/out of Spec without lock-in, using doc-action More/focus controls, and selecting result-action follow-ups from a completed assistant turn
- [ ] Relevant specs/design docs stay updated when adding or changing command surfaces

### Blocked Command Strip (FR-13)

- [ ] Blocked-command strip renders when the host emits `agent/actionBlocked`
- [ ] Strip includes `Switch to Code`, `Copy command`, and `Dismiss` affordances
- [ ] Switching to Code keeps the blocked command recoverable for a follow-up send
- [ ] Composer source files anchor to FR-13 / DES-COMPOSER-BLOCKED-ACTION

### Boundaries

- [ ] Message rendering stays in `212-app-chat-messages`
- [ ] Provider/API key configuration stays in `214-app-chat-settings`
- [ ] Shared tokens/components stay in `131-package-ui-design-system`

---

## Non-Goals (Out of Scope)

- Message timeline rendering
- Conversation history navigation
- Provider setup forms outside composer readiness copy
- Extension host command registration

---

## Open Questions

None.

---

## Dependencies

- `210-app-chat`
- `100-package-shared`
- `110-package-transport`
- `131-package-ui-design-system`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Chat composer input, footer, queue strip, activity bar, composer toolbar, combined model/thinking control                                                                                                                                                                                                                                                                                 |
| Owned files     | `apps/chat/src/views/chat.tsx`, `apps/chat/src/components/model-combobox.tsx`, `apps/chat/src/components/slash-popup.tsx`, `apps/chat/src/components/mention-popup.tsx`, `apps/chat/src/components/composer-strip.tsx`, `apps/chat/src/components/files-strip.tsx`, `apps/chat/src/lib/composer-detect.ts`, `apps/chat/src/lib/derive-modified-files.ts`, `apps/chat/src/lib/mentions.ts` |
| Local anchors   | Composer component blocks in `chat.tsx`, `FooterStrip`, queue handlers, submit/steer/abort/command handlers, helper popup components, combined model/thinking control, mode control, context control                                                                                                                                                                                      |
| Bridge messages | Chat send/steer/abort/queue/runCommand requests, active-file context preference requests, and runtime readiness payloads consumed by composer                                                                                                                                                                                                                                             |
| Settings keys   | Composer-visible runtime/provider/model settings plus `afx.context.includeActiveFileContext` as mirrored state                                                                                                                                                                                                                                                                            |
| Commands        | Slash commands and composer actions, not VSCode extension commands                                                                                                                                                                                                                                                                                                                        |
| Tests           | Chat view/composer tests, combined model/thinking menu tests, future e2e keyboard tests, active-file context toggle tests                                                                                                                                                                                                                                                                 |
| Dependencies    | `212-app-chat-messages`, `214-app-chat-settings`, `215-app-chat-notes`, `131-package-ui-design-system`                                                                                                                                                                                                                                                                                    |
| Out of scope    | Message timeline, history panel, full settings forms, host menu registration                                                                                                                                                                                                                                                                                                              |
| Example prompts | "Update chat footer hint", "Minimize queued composer content", "Change slash popup behavior", "Adjust send keyboard policy"                                                                                                                                                                                                                                                               |

### Glossary

| Term                    | Definition                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composer                | The chat input surface and controls used to prepare or send a user request                                                                                                       |
| Queue strip             | Composer-visible representation of queued or staged content                                                                                                                      |
| System command          | Any shell command prefixed with `!` in the composer; executed locally in the extension host, never sent to the LLM                                                               |
| Dangerous-pattern guard | Confirm dialog triggered when a system command matches known destructive patterns (`rm -rf`, `del /f /s`, `format`, `mkfs`, `dd`); requires user acknowledgment before execution |
