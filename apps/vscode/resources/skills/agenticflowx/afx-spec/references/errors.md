# Errors, Related Commands & Notes

## Error Handling

### Common Errors

1. **Spec Not Found**

   ```
   Error: Spec "payment-flow" not found

   Searched in: docs/specs/payment-flow/
   Available specs: user-auth, api-gateway

   Did you mean:
     /afx-spec create payment-flow
   ```

2. **Missing Files**

   ```
   Error: Incomplete spec structure

   Missing files:
     - docs/specs/user-auth/tasks.md
     - docs/specs/user-auth/journal.md

   Run this to reinitialize:
     /afx-scaffold spec user-auth
   ```

3. **Approval Blocked**

   ```
   Error: Cannot approve spec with Critical issues

   Fix these first:
     [COMPLETENESS] spec.md missing "Success Criteria"
     [QUALITY] FR-1 lacks acceptance criteria

   Then run:
     /afx-spec review user-auth
     /afx-spec approve user-auth
   ```

4. **Already Approved**

   ```
   Error: Spec already approved

   To modify an approved spec:
     1. Increment version in spec.md
     2. Remove "<!-- APPROVED -->" comment from spec.md
     3. Make changes
     4. Run /afx-spec approve user-auth again
   ```

5. **Invalid Subcommand**

   ```
   Error: Unknown subcommand "list"

   Available subcommands: create, refine, discuss, validate, review, approve

   Tip: For spec listing and status, browse `docs/specs/` directly, or use a UI host such as the AgenticFlowX VS Code extension (Specs Tree sidebar) if installed.
   ```

## Related Commands

### From Other Commands → `/afx-spec`

- `/afx-scaffold spec` → Suggest `/afx-spec refine <name>` after creation
- `/afx-task verify` → Suggest `/afx-spec validate` if spec issues detected
- `/afx-check links` → Suggest `/afx-spec validate` for full validation

### From `/afx-spec` → Other Commands

- `/afx-spec create` → Suggest editing spec.md to define requirements
- `/afx-spec approve` (spec) → Suggest `/afx-design refine <name>`
- `/afx-spec approve` (design) → Suggest `/afx-task refine <name>`
- `/afx-spec approve --reviewer` → Suggest `/afx-task pick` to start implementation

## Notes

- Focuses on operations requiring agent reasoning — display-only operations are best handled by file browsing or a UI host such as the AgenticFlowX VS Code extension
- Follows AFX patterns: YAML frontmatter, subcommand structure, agent instructions
- Delegates scaffolding to `/afx-scaffold` (create)
- Interactive `refine` / `discuss` and automated `review` ensure spec quality before approval
- Unified `approve` command handles automated approval, design approval, and human sign-off via flags
