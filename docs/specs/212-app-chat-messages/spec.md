---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T02:46:10.000Z"
tags: ["app", "chat", "messages", "streaming"]
depends_on: ["100-package-shared", "110-package-transport", "130-package-ui", "210-app-chat"]
---

# App Chat Messages - Product Specification

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

Chat message rendering, streaming markdown, tool cards, thinking blocks, and message metadata are distinct from composer input and settings. This spec gives output rendering a surgical home.

---

## User Stories

### Primary Users

Chat users and developers updating the message timeline.

### Stories

**As a** user
**I want** streamed responses, tool calls, and thinking states to render clearly
**So that** I can understand what the agent is doing

**As an** AI agent
**I want** message rendering separated from composer controls
**So that** timeline changes avoid input/setting regressions

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                              | Priority    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Own chat message timeline rendering, including user, assistant, system/info, error, compaction, and note event rows                      | Must Have   |
| FR-2 | Own streamed assistant rendering, including incremental text deltas, live thinking traces, and assistant metadata                        | Must Have   |
| FR-3 | Own markdown rendering for assistant content, including GFM tables/lists/links, inline code, fenced code, and copy affordance            | Must Have   |
| FR-4 | Own tool-call cards in the live chat surface, including input/output rows, running/error states, detail preview, and multiline expansion | Must Have   |
| FR-5 | Own message metadata presentation for token/cost/context usage and friendly stop reasons                                                 | Should Have |
| FR-6 | Own message-adjacent note/compaction row rendering when those events appear inside the live timeline                                     | Should Have |
| FR-7 | Keep composer input behavior in `211-app-chat-composer`                                                                                  | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                               | Target                                                                        |
| ----- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| NFR-1 | Streaming remains responsive              | Incremental updates do not block input rendering                              |
| NFR-2 | Message rendering remains accessible      | Semantic text and controls are keyboard/screen-reader friendly where possible |
| NFR-3 | Message UI remains scannable              | Tool/thinking/metadata chrome stays compact and avoids burying assistant text |
| NFR-4 | Source/spec traceability is bidirectional | Message timeline helpers and shared render helpers have local design anchors  |

---

## Acceptance Criteria

### Timeline Ownership

- [ ] Message renderer files route to this spec
- [ ] Tool-call/thinking updates start here
- [ ] Markdown/code-fence changes start here
- [ ] Assistant metadata and compaction/note row changes start here
- [ ] Composer and settings behavior remain out of scope

---

## Non-Goals (Out of Scope)

- Composer footer/input behavior
- Conversation history navigation
- Provider settings forms

---

## Open Questions

None.

---

## Dependencies

- `100-package-shared`
- `110-package-transport`
- `131-package-ui-design-system`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Owned surface   | Chat message timeline, markdown, tool calls, thinking blocks                                                                   |
| Owned files     | `apps/chat/src/views/chat.tsx` message sections, `apps/chat/src/components/tool-*.tsx`, `apps/chat/src/lib/tool-descriptor.ts` |
| Local anchors   | Timeline rendering helpers, message/tool/thinking components, tool descriptor mappings, stream event handlers                  |
| Bridge messages | Agent response stream, tool-call/status events, chat error events                                                              |
| Settings keys   | Display settings only when they affect rendered messages                                                                       |
| Commands        | Message-level actions inside chat                                                                                              |
| Tests           | Message renderer, tool card, streaming state tests                                                                             |
| Dependencies    | `211-app-chat-composer`, `213-app-chat-history`, `131-package-ui-design-system`                                                |
| Out of scope    | Input composition, provider setup, extension host commands                                                                     |
| Example prompts | "Change tool call card rendering", "Update thinking block display", "Fix streamed markdown spacing"                            |

### Glossary

| Term     | Definition                                |
| -------- | ----------------------------------------- |
| Timeline | Ordered rendered chat messages and events |
