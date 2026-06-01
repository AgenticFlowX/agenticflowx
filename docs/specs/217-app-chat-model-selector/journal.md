---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "chat", "model-selector", "journal"]
---

# Journal - App Chat Model Selector

<!-- prefix: CMS -->

## Captures

---

## Discussions

### CMS-D001 - Canonical selector UI split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,selector-ui]`

**Context**: The fleet model-selector sprint needed a permanent, smaller home for only the composer selector UI.

**Summary**: Created `217-app-chat-model-selector` for searchable grouped selector UI, trigger chips, empty/no-result/reconnecting states, and selector screenshots. Host persistence and Settings provider UX were split into sibling specs.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget selector source `@see` links

**Decisions**:

- Keep `217` limited to selector rendering and row selection events.

**Related Files**: apps/chat/src/components/model-combobox.tsx
**Participants**: @rixrix

---

## Prompt Captures
