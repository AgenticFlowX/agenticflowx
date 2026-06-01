---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "secret-storage", "journal"]
---

# Journal - Agent OAuth Credential Store

<!-- prefix: OCS -->

## Captures

---

## Discussions

### OCS-D001 - Canonical OAuth store split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,oauth,storage]`

**Context**: OAuth storage, active method, redaction, and refresh behavior needed a focused spec separate from provider exchange and SDK injection.

**Summary**: Created `353-agent-oauth-credential-store` to own SecretStorage records, active method, redacted status, refresh locking, backoff, and sign-out behavior.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget credential-store `@see` links

**Decisions**:

- Keep provider-specific exchange mechanics in `354-agent-oauth-provider-flows`.

**Related Files**: apps/vscode/src/secret-store.ts, apps/vscode/src/services/oauth/oauth-service.ts
**Participants**: @rixrix

---

## Prompt Captures
