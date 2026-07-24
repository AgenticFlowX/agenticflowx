# Error Handling

## Common Errors

1. **Design Not Approved (plan)**

   ```text
   BLOCKED: Cannot author tasks.md content.

   Precondition not met:
     design.md status is "Draft" (required: "Approved")

   Approve the design first:
     /afx-design review {name}
     /afx-design approve {name}
   ```

2. **Task Not Found**

   ```text
   Error: Task 7.5 not found in docs/specs/user-auth/tasks.md
   Available tasks in Phase 7: 7.1, 7.2, 7.3, 7.4
   ```

3. **Ambiguous Spec**

   ```text
   Error: Cannot determine spec context.
   Recent activity spans multiple specs: user-auth, users-permissions

   Specify explicitly:
     /afx-task verify user-auth#7.1
   ```

4. **Task Already Complete**

   ```text
   Task 2.1 is already marked complete.

   To re-open: uncheck the task in tasks.md and run /afx-task pick 2.1
   ```

5. **Drift Detected**

   ```text
   BLOCKED: Logic drift detected in Task 2.1.

   The required implementation deviates from design.md [DES-API] regarding token rotation.

   Action Taken:
     - Analysis logged to docs/specs/auth/journal.md
     - Coding paused to prevent technical debt

   Next Step:
     - Review analysis in journal.md
     - Update design: /afx-design modify auth
   ```
