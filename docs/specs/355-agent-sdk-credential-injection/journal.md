---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "pi-sdk", "credentials", "journal"]
---

# Journal - Agent SDK Credential Injection

<!-- prefix: SCI -->

## Captures

---

## Discussions

### SCI-D001 - Canonical SDK credential injection split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,pi-sdk,credentials]`

**Context**: Pi SDK credential env injection, provider overrides, and external RPC env scrub needed a focused runtime spec.

**Summary**: Created `355-agent-sdk-credential-injection` to own selected credential resolution, env-only subscription injection, built-in provider overrides, Copilot base URL override, Cloudflare setup env, and external runtime env scrub.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget injection/bootstrap `@see` links

**Decisions**:

- Keep this spec specific to managed Pi SDK until another managed SDK proves common injection requirements.

**Related Files**: apps/vscode/src/agent-factory.ts, packages/agent/pi-sdk/src/sdk-rpc-manager.ts, packages/agent/pi-sdk/bootstrap/bootstrap.ts
**Participants**: @rixrix

---

## Prompt Captures
