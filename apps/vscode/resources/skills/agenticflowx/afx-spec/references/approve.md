# /afx-spec approve

### approve <name> [--reviewer "@handle"]

**Purpose:** Mark spec as approved (automated validation + status change), with optional human sign-off

**Modes:**

- `/afx-spec approve <name>` — approve `spec.md` (unlocks `/afx-design refine` / `/afx-design author`)
- `/afx-spec approve <name> --reviewer "@handle"` — add human sign-off (requires spec already approved)

**Optional Arguments (with `--reviewer`):**

- `--scope "description"` - What is being approved (default: "Full spec")
- `--notes "context"` - Additional review notes

**Lifecycle Gate:**

- `approve` (spec.md): No precondition — spec is the entry point
- `approve --reviewer`: `spec.md` status must be `Approved`

**Implementation (spec.md — default):**

1. **Check Current Status**
   - Read spec.md frontmatter
   - If already "Approved", exit with error: "Spec already approved. Use version bump to modify."

2. **Pre-Approval Validation**
   - Run `/afx-spec validate <name>` (structure check)
   - Run `/afx-spec review <name>` (quality check)
   - Count Critical issues from review

3. **Approval Decision**
   - If Critical issues > 0: **BLOCK APPROVAL**

     ```text
     Approval BLOCKED: user-authentication

     Cannot approve with Critical issues:
       [COMPLETENESS] spec.md missing "Success Criteria" section
       [QUALITY] FR-1 not testable - lacks acceptance criteria

     Fix these issues first, then run:
       /afx-spec review user-authentication
       /afx-spec approve user-authentication
     ```

   - If Critical issues = 0: **APPROVE**

     ```text
     Approved: user-authentication (spec.md)

     ✓ Validation passed (structure intact)
     ✓ Review passed (0 Critical issues)
     ✓ Status changed: Draft → Approved
     ✓ Spec frozen (further changes require version bump)
     ✓ Journal updated with approval record
     ✓ /afx-design author UNLOCKED

     Note: 3 Major and 5 Minor issues remain. Address in future versions if needed.
     ```

4. **Update spec.md Frontmatter**

   ```yaml
   ---
   afx: true
   type: SPEC
   status: Approved # Changed from Draft
   owner: "@alice"
   version: "1.0"
   created_at: "2024-01-15T10:00:00.000Z"
   updated_at: "2024-01-15T14:30:00.000Z" # Updated on approval
   approved_at: "2024-01-15T14:30:00.000Z" # Added timestamp
   ---
   ```

5. **Freeze spec.md**
   - Add comment at top:

     ```markdown
     <!-- APPROVED: 2024-01-15 - Do not edit without version bump -->
     ```

6. **Add Journal Entry**

   ```markdown
   ## Approval: Spec Approved (2024-01-15 14:30)

   Spec approved and frozen. Further changes require version bump.
   /afx-design author now unlocked.

   Approved by: Claude (automated validation)
   Review score: 72% compliant (0 Critical, 3 Major, 5 Minor issues)

   Next step: `/afx-design author <name>`
   ```

**Implementation (human sign-off — with `--reviewer` flag):**

1. **Validate Preconditions**
   - Spec status must be "Approved" (automated approval first)
   - If not approved, exit with error

2. **Record Sign-Off in journal.md**

   ```markdown
   ## Sign-Off: Human Approval (2024-01-15 15:00)

   Reviewed and approved by: @alice
   Timestamp: 2024-01-15T15:00:00.000Z
   Scope: Full spec (functional requirements, design architecture, task breakdown)

   Approval attestation:
   ✓ Requirements are clear and complete
   ✓ Design approach is sound
   ✓ Tasks cover all requirements
   ✓ Acceptance criteria are testable

   Review notes: Looks good for v1. Address brute-force protection in v1.1.

   Signed: @alice
   ```

3. **Update spec.md Frontmatter**

   ```yaml
   ---
   afx: true
   type: SPEC
   status: Approved
   owner: "@alice"
   reviewer: "@alice" # Added reviewer
   version: "1.0"
   created_at: "2024-01-15T10:00:00.000Z"
   updated_at: "2024-01-15T15:00:00.000Z" # Updated on sign-off
   approved_at: "2024-01-15T14:30:00.000Z"
   signed_at: "2024-01-15T15:00:00.000Z" # Added sign-off timestamp
   ---
   ```

**Next Command:**

- After spec approval: `/afx-design refine <name>` to author/refine design.md
- After human sign-off: `/afx-design refine <name>` to author/refine design.md

## Frontmatter fields during approval

See [template-format.md](template-format.md) → Frontmatter (MANDATORY) for the canonical field order and the full schema. During approval, add these fields (do NOT remove existing fields):

- `approved_at: YYYY-MM-DDTHH:MM:SS.mmmZ`
- `signed_at: YYYY-MM-DDTHH:MM:SS.mmmZ`
- `reviewer: "@handle"`
- Update `status: Approved` and `updated_at` to current timestamp

**Immutable fields** (must NOT be changed during approval): `afx`, `type`, `owner`, `created_at`.
