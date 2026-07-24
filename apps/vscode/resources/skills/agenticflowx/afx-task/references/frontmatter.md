# Timestamp & Frontmatter Rules (MANDATORY)

## Timestamp Format (MANDATORY)

All timestamps MUST use ISO 8601 with millisecond precision. Single source of truth: `../../afx-help/references/timestamp-rule.md`. To get the current timestamp, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

## Frontmatter (MANDATORY)

When creating or modifying `tasks.md`, enforce the canonical AFX frontmatter schema:

```yaml
---
afx: true
type: TASKS
owner: "@handle"
version: "1.0"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["{feature}"]
spec: spec.md
design: design.md
---
```

**Canonical field order**: `afx → type → owner → version → created_at → updated_at → tags → spec → design`. Use double quotes for all string values. Task progress is derived from criteria and Work Sessions; `tasks.md` has no lifecycle `status`.

**Immutable fields** (must NOT be changed during plan/pick/complete): `afx`, `type`, `owner`, `created_at`.
