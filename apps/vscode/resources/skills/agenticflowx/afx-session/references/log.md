# /afx-session log

**Usage**: `/afx-session log [feature]`

Summarize the current session's captures into a permanent discussion entry.

### When to use

- **log**: Summarize a conversation into a permanent record

### Process

1. **Read Conversation**: Analyze recent chat history or provided summary.
2. **Generate Discussion ID**:
   - Read `<!-- prefix: XX -->` from `journal.md`
   - Find last ID (e.g. `UA-D005`) -> New ID `UA-D006`
3. **Format Entry**: Create structured markdown entry with metadata.
4. **Append to Journal**: Write to `## Discussions` section **at the end** (chronological order - oldest first, newest last).
5. **Clear Scratchpad**: Remove items from `## Captures` if they are covered.

### Active Inference Protocol (CRITICAL)

**When to suggest saving**:
The Agent MUST actively monitor the conversation depth. Suggest `/afx-session log` when:

1.  **key decisions** are made ("Let's use Postgres").
2.  **complex logic** is explained ("The flow requires step A then B").
3.  **session is ending** or context switching.

**Do NOT wait for the user.** If the user says "Okay, that makes sense, let's move on", you SHOULD interject:

> "Before we move on, should I save this decision about Postgres to the session log?

> `> /afx-session log`"

### Proactive Capture

Silent auto-capture of high-impact context changes to `## Captures` is governed by `references/proactive-capture.md` (skill-specific mechanics) plus the shared cross-cutting rule in `../afx-help/references/proactive-capture.md`. Consolidation via `/afx-session log` at natural breakpoints turns those captures into full discussion entries.

### Examples

```
/afx-session log                       # Log to _sessions
/afx-session log user-auth             # Log to specific feature
```
</content>
