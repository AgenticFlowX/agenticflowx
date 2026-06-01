---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "managed-sdk", "journal"]
---

# Journal - Agent Managed OAuth

<!-- prefix: AMO -->

## Captures

---

## Discussions

### AMO-D001 - Canonical managed OAuth policy split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,oauth,policy]`

**Context**: OAuth sprint scope needed a permanent policy home without absorbing storage, provider flows, UI, and SDK injection details.

**Summary**: Created `352-agent-managed-oauth` as the route/policy spec for AFX-managed SDK OAuth vs external user-configured runtimes. Concrete child zones own credentials, flows, and injection.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget policy-level `@see` links

**Decisions**:

- Keep `352` small and policy-oriented; use `353`, `354`, and `355` for implementation surfaces.

**Related Files**: apps/vscode/src/agent-factory.ts, apps/chat/src/components/provider-card.tsx
**Participants**: @rixrix

---

## Prompt Captures
