---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "vscode", "model-selection", "journal"]
---

# Journal - App VSCode Model Selection State

<!-- prefix: VMS -->

## Captures

---

## Discussions

### VMS-D001 - Canonical host model state split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,model-selection]`

**Context**: Model selector work included host persistence and restore behavior that should not live in the selector UI spec.

**Summary**: Created `205-app-vscode-model-selection-state` to own `afx.model.defaultSelection`, legacy SDK default compatibility, bridge payload identity, restore, fallback, and method-switch coordination.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget host state `@see` links

**Decisions**:

- Keep visual selector behavior in `217-app-chat-model-selector`; host persistence/state lives here.

**Related Files**: apps/vscode/src/model-default-selection.ts, apps/vscode/src/panels/sidebar-panel.ts, packages/shared/src/messages.ts
**Participants**: @rixrix

---

## Prompt Captures
