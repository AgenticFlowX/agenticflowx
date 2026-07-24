# /afx-session promote (Promote Mode)

**Usage**:

- `/afx-session promote <discussion-id>` - Promote to ADR (e.g., `UA-D001` promotes within user-auth)
- `/afx-session promote <discussion-id> --to <new-feature>` - Promote from `_sessions` to new feature spec (e.g., `GEN-D001 --to multi-tenant`)

### When to use

- **promote**: "This discussion is now an ADR or a new Feature"

## Frontmatter (MANDATORY)

All ADRs created via `promote` MUST include AFX frontmatter:

```yaml
---
afx: true
type: ADR
status: Proposed
owner: "@handle"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: [<dynamic-feature>, <dynamic-topic>]
source: journal.md#<discussion-id>
---
```

**Tag rules:** Tags are **dynamic** — derived from the feature name and discussion topic (e.g., `[auth, token-storage]`). Do not use generic placeholders.

## 4a. Promote to ADR (within feature)

1. **Parse prefix** from discussion ID to determine feature (e.g., `UA-D001` → user-auth)
2. **Find** discussion by ID in `docs/specs/{feature}/journal.md`
3. **Create** ADR in `docs/specs/{feature}/research/{topic-slug}.md`

## 4b. Promote to New Feature (from \_sessions)

1. **Find** discussion by ID in `docs/specs/journal.md`
2. **Create** new feature spec structure:
   ```text
   docs/specs/{new-feature}/
   ├── spec.md         # Stub with discussion summary as starting point
   ├── design.md       # Empty template
   ├── tasks.md        # Empty template
   └── journal.md  # Move discussion here
   ```
3. **Move** the discussion from `journal.md` to new feature's journal.md
4. **Update** `journal.md` with link: `**Promoted**: [new-feature](../new-feature/journal.md)`

## ADR Template (for promote to ADR):

```markdown
---
afx: true
type: ADR
status: Accepted
owner: "@handle"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: [<dynamic-feature>, <dynamic-topic>]
source: journal.md#{discussion-id}
---

# ADR: {Topic Title}

**Promoted From**: [journal.md#UA-D001](journal.md#wc-d001---topic-title)

## Context

{Context from discussion}

## Decision

{Decisions from discussion}

## Consequences

{Derived from tips/ideas}

## Related

- {Related files}
```

3. **Update** discussion entry with link: `**Promoted**: [ADR](research/{slug}.md)`
4. **Confirm** promotion

5. **Suggest next command**:

```
Next: /afx-task code   # Implement the decision from the ADR
```

Or for new feature promotion:

```
Next: /afx-task pick docs/specs/{new-feature}/tasks.md   # Start implementing new feature
```

### Examples

#### Promote discussion to ADR (within feature)

```
/afx-session promote UA-D001
```

→ Parses `UA` prefix → user-auth feature
→ Creates `docs/specs/user-auth/research/0002-topic.md`
→ Links back to `journal.md#UA-D001`

#### Promote idea to new feature spec

```
/afx-session promote GEN-D003 --to multi-tenant-auth
```

→ Creates `docs/specs/multi-tenant-auth/` with full spec structure
→ Moves discussion GEN-D003 from `_sessions` to new feature
→ New feature gets its own prefix (e.g., `MTA`)
</content>
