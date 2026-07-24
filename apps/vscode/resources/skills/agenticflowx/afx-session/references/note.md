# /afx-session note (Smart Note)

**Usage**:

```bash
/afx-session note "content"                    # Auto-tags based on context
/afx-session note "content" #idea #auth        # Explicit tags (Obsidian style)
/afx-session note --ref UA-D001 "content"      # Append to existing discussion
```

### When to use

- **note**: Capture thoughts during discussion or write directly — "Forgot to handle null case" or "look into Pulumi for IaC"

### Purpose

Unifies all "input" actions. Whether you are capturing a fleeting thought, adding a formal manual note, or appending to an existing discussion, just use `note`.

### Process

1. **Parse Arguments**:
   - Check for `#tags` in content OR `--tags` flag.
   - Check for `--ref <id>` to determine if this is an append action.
   - Detect feature context (argument or inferred).

2. **Smart Tagging (Active Inference)**:
   - **If tags present**: Use them.
   - **If no tags**: Analyze content + recent context.
     - "We need to fix the auth0 callback" -> `[auth, bug, high-priority]`
     - "Maybe we use Redis here" -> `[architecture, idea, database]`
   - **Obsidian Compatibility**: Convert output tags to `#hash-tags` in the markdown file for interoperability.

3. **Routing**:
   - **If `--ref`**: Append to `**Notes**` section of that discussion ID.
   - **Default**: Append to `## Captures` section of `journal.md`.

### Output Example

```
Captured: "Fix auth callback" [#auth #bug]
to: docs/specs/user-auth/journal.md
```

### Examples

#### Human note (direct entry)

```
/afx-session note "look into Pulumi for IaC" --tags iac,future
```

→ Saves to `docs/specs/journal.md` with explicit tags
→ No agent context needed - just writes directly

#### Human note (feature-specific)

```
/afx-session note infrastructure "evaluate CloudWatch vs Datadog" --tags monitoring,decision
```

→ Saves to `docs/specs/infrastructure/journal.md`

#### Quick note (agent context)

```
/afx-session note "interesting approach for multi-tenant auth"
```

→ Saves to `docs/specs/journal.md`
→ Agent infers tags from conversation

#### Quick note (feature-specific)

```
/afx-session note user-auth "supplier email should include claim number in subject"
```

→ Saves to `docs/specs/user-auth/journal.md`

#### Append to existing discussion

```
/afx-session note --ref UA-D001 "edge case: supplier with no email should fail gracefully"
```

→ Parses `UA` prefix → user-auth feature
→ Auto-assigns Note ID `UA-D001.N1` (or next available)
→ Adds to UA-D001's **Notes** section: `- **[UA-D001.N1]** **[timestamp]** edge case...`
→ Output: `Appended to UA-D001: "edge case: supplier..."`
</content>
