# Workflow & Integration

Per-subcommand examples live in their own reference files (`references/note.md`, `references/log.md`, `references/recap.md`, `references/promote.md`, `references/capture.md`). This file covers cross-subcommand workflow.

## Multi-Window Workflow

This command supports working across multiple agent windows:

```
Window 1: Discussing feature A
  > /afx-session note feature-a "important point"
  > Continue discussing...
  > /afx-session log feature-a

Window 2: Discussing feature B
  > /afx-session note feature-b "different topic"
  > Continue discussing...
  > /afx-session log feature-b

Later (any window):
  > /afx-session recap all
  > See summary across both features
```

## Integration with Other Commands

| Command      | Relationship                                     |
| ------------ | ------------------------------------------------ |
| `/afx-task`  | Shows task state; `/afx-session` for discussions |
| `/afx-task`  | Reads session logs for task verification         |
| `/afx-check` | Cross-references journal.md                      |
| `/afx-dev`   | Captures discussions about implementation        |
</content>
