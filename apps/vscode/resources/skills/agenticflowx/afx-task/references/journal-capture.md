# Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../../afx-session/references/proactive-capture.md).

**Triggers for `/afx-task`**:

- Spec-implementation mismatch that requires decision
- Task blocked by external dependency
- Scope change discovered during coding
- Discussion about task sequencing, implementation approach, or design direction
- Verify/review request without explicit coding (discussion context)

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): task scope cut, re-plan of `tasks.md` phases, missed task discovered mid-implementation. After applying the change, run the [Significance Check](../../afx-session/references/proactive-capture.md) first — skip silently for cosmetic edits (reordering, rewording, typo fixes). Only call `/afx-session capture --trigger scope-cut|missed-req --links <task-id>` when the change encodes a real scope shift or discovery. See [Prompt Capture Triggers](../../afx-session/references/proactive-capture.md).

**Discussion Context Triggers (automated journal capture):**

```
User: "should task 3.2 be done before 3.1?"
→ Journal: Task dependency question: 3.2 vs 3.1 sequencing

User: "let's discuss the EC3 API approach"
→ Journal: EC3 API approach discussed — see [DES-API]

User: "verify bottom up"
→ Journal: Bottom-up verify requested — task→spec trace

User: "what about FR-4?"
→ Journal: Question about FR-4 coverage — referenced in 9.1
```

**Output format:**

```
## Session: Discussion (2026-04-09T14:30:00.000Z)

### Context
Triggered by: verify bottom up question
Spec: 39-package-ec3

### Discussion Points
- Task 3.2 vs 3.1 dependency discussed
- Next: verify all tasks before coding

---
```

Timestamps use ISO-8601 millisecond precision — see `../../afx-help/references/timestamp-rule.md`.
