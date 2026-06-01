---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "pkce", "device-code", "journal"]
---

# Journal - Agent OAuth Provider Flows

<!-- prefix: OPF -->

## Captures

---

## Discussions

### OPF-D001 - Canonical OAuth provider-flow split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,oauth,flows]`

**Context**: PKCE loopback, paste fallback, and device-code behavior needed a focused spec independent from storage and UI.

**Summary**: Created `354-agent-oauth-provider-flows` to own provider-specific OAuth exchange mechanics and redacted progress events.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget flow/provider `@see` links

**Decisions**:

- Normalize provider outputs here, then pass persistence to `353-agent-oauth-credential-store`.

**Related Files**: apps/vscode/src/services/oauth/pkce.ts, apps/vscode/src/services/oauth/device-code.ts, apps/vscode/src/services/oauth/providers/index.ts
**Participants**: @rixrix

---

## Prompt Captures
