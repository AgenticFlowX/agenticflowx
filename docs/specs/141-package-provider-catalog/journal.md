---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["package", "shared", "provider-catalog", "journal"]
---

# Journal - Package Provider Catalog

<!-- prefix: PPC -->

## Captures

---

## Discussions

### PPC-D001 - Canonical provider catalog split

`status:active` `2026-06-01T10:08:49.000Z` `[graduation,provider-catalog]`

**Context**: Fleet sprint docs were temporary and provider-catalog changes needed a permanent small zone.

**Summary**: Created `141-package-provider-catalog` to own built-in provider metadata, env aliases, defaults, OAuth capability flags, and setup fields. OAuth storage, Settings UI, and SDK injection remain separate specs.

**Progress**:

- [x] Created canonical spec/design/tasks/journal files
- [ ] Retarget source `@see` links

**Decisions**:

- Keep provider metadata in a shared package spec, not in OAuth or Settings specs.

**Related Files**: packages/shared/src/provider-catalog.ts
**Participants**: @rixrix

---

## Prompt Captures
