# Next Actions & Interactive Lifecycle

## Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-session` action, suggest the most appropriate next command based on context:

| Context                         | Suggested Next Command                    |
| ------------------------------- | ----------------------------------------- |
| After `note` (more to discuss)  | Continue discussion or `/afx-session log` |
| After `note` (ready to work)    | `/afx-next` or `/afx-task pick <id>`      |
| After `note` (quick note added) | Continue working or `/afx-session recap`  |
| After `log`                     | `/afx-task pick <id>` or `/afx-task code` |
| After `recap` (resuming work)   | `/afx-next` then `/afx-task code`         |
| After `promote` (ADR created)   | `/afx-adr review <id>` then `/afx-next`   |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. /afx-next # Context-driven: Choose the safest next workflow step
2. /afx-session log {feature} # Context-driven: Summarize before moving on
3. /afx-session promote UA-D001 # Context-driven: Elevate to ADR if significant
   ──
4. /afx-next # Re-orient after capture
5. /afx-help # See all options
```

## Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use the host's structured-choice capability when available (otherwise numbered text options) to present the options.

**Trigger conditions:**

| Condition                                                          | Question                                                              | Options                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------- |
| After `note` with decision or ADR-worthy content                   | "This looks like an architectural decision. Promote to ADR?"          | "Promote to ADR" / "Keep as note" / "Not now"        |
| After `note --ref` appends to a discussion with `status:closed`    | "This discussion is closed. Reopen it or start a new one?"            | "Reopen discussion" / "New discussion" / "Not now"   |
| After `log` with unresolved items                                  | "Session logged. Some items are unresolved. Continue?"                | "Continue discussion" / "Pick next task" / "Not now" |
| After `log` with all items resolved                                | "Session logged. All items resolved — ready to move on?"              | "Pick next task" / "Save context" / "Not now"        |
| After `recap` showing stale context                                | "Context is stale. Save a fresh context bundle?"                      | "Save context" / "Continue working" / "Not now"      |
| After `recap` showing open decisions across multiple features      | "Open decisions span multiple features. Review cross-feature impact?" | "Review impact" / "Continue working" / "Not now"     |
| After `promote` to ADR completes                                   | "ADR created. Ready to implement the decision?"                       | "Implement now" / "Review ADR" / "Not now"           |
| After `promote --to` creates new feature spec                      | "New feature spec created. Author the spec?"                          | "Author spec" / "Pick task" / "Not now"              |
| `## Captures` has 5+ unlogged entries (detected during any action) | "Multiple captures are piling up. Consolidate into a discussion?"     | "Log session" / "Keep capturing" / "Not now"         |
| Discussion has 3+ notes appended (detected during `note --ref`)    | "This discussion has grown. Summarize into a new log entry?"          | "Log summary" / "Keep appending" / "Not now"         |

**Rules:**

- Only trigger when the lifecycle gate is actually actionable (preconditions met)
- Include "Not now" as the last option — never force the user
- If user selects an action, execute it immediately (run the promote/log/save flow)
- If user selects "Not now", continue normally — do not re-ask in the same conversation
- Keep existing text-only "Next Command Suggestion" for non-lifecycle contexts
- These buttons complement, not replace, the text suggestions
</content>
