# afx-sprint refine

Dispatcher alias for section refinement.

### Usage

```bash
/afx-sprint refine [feature] [spec|design|task] [...context]
```

### Routing

1. Locate the sprint doc using normal Context Resolution.
2. If the command includes an explicit section token (`spec`, `design`, or `task`), execute the matching section subcommand with the remaining trailing context.
3. If no section token is provided, infer from the active editor section (`afx.sprintSection`) when available.
4. If still unknown, route to the first Draft section in approval order:
   - `approval.spec == Draft` → `/afx-sprint spec`
   - else `approval.design == Draft` → `/afx-sprint design`
   - else `approval.tasks == Draft` → `/afx-sprint task`
   - else all sections are approved → ask for the section to refine, because refining an approved section may demote downstream approvals.
5. Use the routed subcommand's normal gate, checkpoint, demotion, journal, and next-command rules.

### Compatibility

`/afx-sprint spec`, `/afx-sprint design`, and `/afx-sprint task` remain canonical section commands. `/afx-sprint refine` is a user-facing alias for chat buttons and VS Code intent actions.
