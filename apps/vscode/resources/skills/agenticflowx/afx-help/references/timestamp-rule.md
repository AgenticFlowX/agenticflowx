# AFX Timestamp Rule

Single source of truth for timestamps across AFX skills. Skills point here instead of copying the rule.

All timestamps in AFX-generated documents — frontmatter (`created_at`, `updated_at`), inline metadata, journal entries, session captures, Work Session rows — MUST use **ISO 8601 with millisecond precision**:

```text
YYYY-MM-DDTHH:MM:SS.mmmZ      e.g. 2026-07-12T14:30:00.000Z
```

To get the current timestamp, run via the host shell:

```bash
date -u +"%Y-%m-%dT%H:%M:%S.000Z"
```

- Never write short formats like `2026-07-12 14:30`.
- Never guess and never use midnight (`T00:00:00.000Z`) as a placeholder.
- Work Session rows in `tasks.md`/`<feature>.md` may use the established date-only `YYYY-MM-DD` form where that is the section's canonical format; all other timestamps use full millisecond precision.
