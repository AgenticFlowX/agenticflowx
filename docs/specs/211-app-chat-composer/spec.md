---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.3"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-05T10:28:33.000Z"
approved_at: "2026-05-03T11:23:57.000Z"
tags: ["app", "chat", "composer", "webview"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "130-package-ui",
    "131-package-ui-design-system",
    "210-app-chat",
  ]
---

<!-- APPROVED: 2026-05-03 - Do not edit without version bump -->

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

The chat composer has become a dense interaction surface: input, queued content, footer hints, activity state, slash commands, mentions, model selection, thinking controls, and send/abort/steer behavior all converge in one area. Small changes such as updating footer instructions should start from a precise spec instead of requiring a full chat source read.

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

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                    | Priority    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Own the composer root layout, input group, textarea placeholder, send/abort/steer buttons, and keyboard submission policy                                                                                                                                                                                                                                      | Must Have   |
| FR-2  | Own composer footer hints, runtime readiness copy, Pi pill copy, usage tooltip copy, queue copy, and disabled-state copy                                                                                                                                                                                                                                       | Must Have   |
| FR-3  | Own slash command and mention helper behavior that appears from composer input, including trigger detection, file listing, command formatting, and trigger replacement                                                                                                                                                                                         | Must Have   |
| FR-4  | Own queued content strip behavior, including local mirror rows, steer/follow-up grouping, collapse, dismiss, and clear-all affordances                                                                                                                                                                                                                         | Must Have   |
| FR-5  | Own model picker and thinking-level controls when rendered as composer controls, including API/external grouping and settings fallback                                                                                                                                                                                                                         | Should Have |
| FR-6  | Own prompt-history recall from the composer textarea, including ArrowUp/ArrowDown cursor policy and draft restoration                                                                                                                                                                                                                                          | Should Have |
| FR-7  | Own composer-adjacent activity strip behavior that previews live thinking without becoming the message timeline                                                                                                                                                                                                                                                | Should Have |
| FR-8  | Preserve host/webview boundaries; composer UI sends bridge messages but does not call VSCode APIs directly                                                                                                                                                                                                                                                     | Must Have   |
| FR-9  | Intercept system-command prefixes (`!`) in the composer and dispatch `chat/runCommand` instead of sending to the LLM; strip the `!` prefix before routing                                                                                                                                                                                                      | Must Have   |
| FR-10 | Render a "Modified files" strip above the composer that lists files touched by agent edit/write tool calls in the current transcript; pills open the file in the editor on click and, when the tool result reports a first-changed line, jump the editor cursor there; dismissible per assistant turn; expanded by default (user can collapse via the chevron) | Should Have |

### Non-Functional Requirements

| ID    | Requirement                                     | Target                                                                                                                                                                                                              |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Composer remains keyboard-friendly              | Enter/modified-enter behavior is explicit and tested where possible                                                                                                                                                 |
| NFR-2 | Footer copy stays concise                       | Footer state can be understood without reading settings docs                                                                                                                                                        |
| NFR-3 | Runtime state changes do not cause layout jumps | Queue/footer/control surfaces remain stable                                                                                                                                                                         |
| NFR-4 | Composer helpers stay cheap                     | Trigger detection is string-local and avoids bridge calls unless a picker opens                                                                                                                                     |
| NFR-5 | Source/spec traceability is bidirectional       | Major composer zones have local source anchors and design node references                                                                                                                                           |
| NFR-6 | System command UX is persistent but unobtrusive | An amber "Shell" badge appears in the composer input group when `!` is active; footer shows `"⚠ Shell · output is local only"`; these cues are always visible while the prefix is active and do not block execution |

---

## Acceptance Criteria

### Composer Routing

- [ ] Composer source files point at this spec and design
- [ ] Footer hint changes can start from this spec without reading history/settings/message specs
- [ ] Slash, mention, model, thinking, queue, send, steer, abort, and prompt-history behavior has a named owner
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
| Owned surface   | Chat composer input, footer, queue strip, activity bar, composer toolbar                                                                                                                                                                                                                                                                                                                  |
| Owned files     | `apps/chat/src/views/chat.tsx`, `apps/chat/src/components/model-combobox.tsx`, `apps/chat/src/components/slash-popup.tsx`, `apps/chat/src/components/mention-popup.tsx`, `apps/chat/src/components/composer-strip.tsx`, `apps/chat/src/components/files-strip.tsx`, `apps/chat/src/lib/composer-detect.ts`, `apps/chat/src/lib/derive-modified-files.ts`, `apps/chat/src/lib/mentions.ts` |
| Local anchors   | Composer component blocks in `chat.tsx`, `FooterStrip`, queue handlers, submit/steer/abort/command handlers, helper popup components, model/thinking controls                                                                                                                                                                                                                             |
| Bridge messages | Chat send/steer/abort/queue/runCommand requests and runtime readiness payloads consumed by composer                                                                                                                                                                                                                                                                                       |
| Settings keys   | Composer-visible runtime/provider/model settings only as displayed state                                                                                                                                                                                                                                                                                                                  |
| Commands        | Slash commands and composer actions, not VSCode extension commands                                                                                                                                                                                                                                                                                                                        |
| Tests           | Chat view/composer tests, helper tests, future e2e keyboard tests                                                                                                                                                                                                                                                                                                                         |
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
