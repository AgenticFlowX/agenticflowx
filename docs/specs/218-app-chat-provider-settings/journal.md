---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "chat", "settings", "providers", "journal"]
---

# Journal - App Chat Provider Settings

<!-- prefix: CPS -->

## Captures

---

## Discussions

### CPS-D001 - Canonical provider Settings split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,settings,providers]`

**Context**: Settings provider cards gained subscription accounts, sign-in states, and setup fields that made the broad Settings spec too dense.

**Summary**: Created `218-app-chat-provider-settings` to own built-in provider cards, subscription account grouping, sign-in state rendering, setup fields, redacted snapshots, and Playwright Settings screenshots.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget provider Settings `@see` links

**Decisions**:

- Keep generic Settings shell and custom-model editor in `214-app-chat-settings`; move built-in provider card detail here.

**Related Files**: apps/chat/src/components/provider-card.tsx, apps/chat/src/views/settings.tsx
**Participants**: @rixrix

---

## Prompt Captures
