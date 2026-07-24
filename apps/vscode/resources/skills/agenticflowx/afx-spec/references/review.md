# /afx-spec review

### review <name>

**Purpose:** Comprehensive automated spec review with issue detection

**Implementation:**

1. **Completeness Check**
   - spec.md has all required sections (Overview, Requirements, Success Criteria)
   - design.md has architecture description (data models, API endpoints, algorithms)
   - tasks.md maps to all design sections
   - journal.md has initial rationale

2. **Quality Check**
   - Requirements are testable (acceptance criteria defined)
   - Design decisions have documented rationale
   - Tasks have clear completion criteria
   - No orphaned requirements (not referenced in design)
   - No orphaned design sections (not referenced in tasks)
   - **Living document purity**: spec.md and design.md are free of historical narrative

3. **Consistency Check**
   - Terminology consistent across spec/design/tasks
   - Requirements numbering sequential (no gaps)
   - Cross-references valid (all `@see` links exist)
   - Phase definitions align across documents

4. **Gap Analysis**
   - Missing NFRs (performance, security, scalability, UX, accessibility)
   - Edge cases not addressed (errors, timeouts, race conditions)
   - Error handling not specified
   - Data validation rules missing
   - Integration points not defined

5. **Risk Analysis**
   - High-risk requirements (complex, uncertain, external dependencies)
   - Dependencies on external systems
   - Assumptions that need validation

6. **Output Report**

   ```
   Review: user-authentication

   Score: 72% compliant

   Critical Issues (2):
     [COMPLETENESS] spec.md missing "Success Criteria" section
     [QUALITY] FR-1 not testable - lacks acceptance criteria

   Major Issues (4):
     [GAP] Missing NFR for security (session timeout)
     [GAP] Missing NFR for performance (login response time SLA)
     [CONSISTENCY] Terminology mismatch: spec.md uses "login", design.md uses "auth"
     [QUALITY] design.md contains historical backstory about choosing the auth provider (move to journal.md)

   Minor Issues (5):
     [QUALITY] Task 2.1 could have clearer acceptance criteria
     [CONSISTENCY] Phase numbering skips from 2 to 4 (missing 3)
     [GAP] Edge case: email service downtime not addressed
     [GAP] Missing accessibility NFR (WCAG compliance)
     [RISK] External dependency: email service (SendGrid) - SLA unknown

   Recommendations:
     1. Fix 2 Critical issues before approval
     2. Add missing NFRs for security and performance
     3. Standardize terminology to "authentication"
     4. Address email service downtime scenario
     5. Document SendGrid SLA or add fallback plan
   ```

**Next Command:**

- If Critical issues exist: `/afx-spec refine <name>` to fix issues
- If no Critical issues: `/afx-spec approve <name>` to approve spec
