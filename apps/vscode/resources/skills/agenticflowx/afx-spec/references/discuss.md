# /afx-spec refine · discuss

### refine <name>

**Purpose:** Preferred alias for `discuss`; refine requirements and acceptance criteria through interactive gap analysis.

**Behavior:** Execute the same flow as `discuss <name>`. Keep `discuss` supported indefinitely for compatibility, but prefer `refine` in new UI labels, help text, and examples.

### discuss <name>

**Purpose:** Interactive spec discussion and collaborative gap analysis

**Implementation:**

1. **Load Context**
   - Read all 4 spec files (spec.md, design.md, tasks.md, journal.md)
   - Parse requirements, design decisions, tasks, previous discussions

2. **Analyze for Issues**
   - Vague requirements (lacks acceptance criteria)
   - Missing non-functional requirements (performance, security, scalability, UX)
   - Design decisions without rationale
   - Tasks without clear acceptance criteria
   - Inconsistencies between spec.md and design.md
   - Edge cases not addressed (error handling, validation, limits)
   - Ambiguous terminology
   - **Historical context in living documents**: Spec or Design contains chronological history (should be in Journal)

3. **Present Findings**

   ```
   Spec Discussion: user-authentication

   Issues Identified (5):

   1. [QUALITY] Vague Requirement (FR-1)
      "Users can log in with email and password"
      → Missing acceptance criteria
      → What happens on failure? After 3 attempts? 5 attempts?

   2. [GAP] Missing NFR (Security)
      → No requirement for session timeout
      → No requirement for brute-force protection

   3. [CONSISTENCY] Design vs Spec Mismatch
      design.md mentions OAuth, but spec.md only requires email/password

   4. [EDGE CASE] Error Handling Not Specified
      → What if email service is down during password reset?
      → How to handle concurrent login attempts?

   5. [AMBIGUOUS] Terminology Inconsistency
      spec.md uses "login", design.md uses "authentication", tasks.md uses both
   ```

4. **Ask Clarifying Questions** (use AskUserQuestion)
   - "FR-1: Should we implement account lockout after N failed attempts? If so, how many attempts and lockout duration?"
   - "NFR: What's the acceptable session timeout duration? 15 min? 24 hours?"
   - "Design: Should we support OAuth in addition to email/password, or postpone OAuth to v2?"
   - "Edge Case: For password reset, if email delivery fails, should we retry? Queue? Show user error?"

5. **Capture Discussion** in journal.md

   ```markdown
   ## Discussion: Spec Review (2024-01-15 14:30)

   ### Issues Identified

   - FR-1 lacks acceptance criteria (failure scenarios, lockout policy)
   - Missing NFRs: session timeout, brute-force protection
   - Design mentions OAuth but spec doesn't require it
   - Edge case: email service downtime during password reset
   - Terminology inconsistency: login vs authentication

   ### Questions & Answers

   - Q: Account lockout after failed attempts?
   - A: Yes, 5 attempts → 15 min lockout

   - Q: Session timeout duration?
   - A: 24 hours idle timeout

   - Q: OAuth support in v1?
   - A: No, postpone to v2. Remove OAuth from design.md

   - Q: Email delivery failure handling?
   - A: Queue retry (3 attempts), show generic success message to user

   ### Decisions Made

   - Add NFR for session timeout (24h idle)
   - Add NFR for brute-force protection (5 attempts → 15 min lockout)
   - Remove OAuth from design.md (v2 feature)
   - Use "authentication" consistently across all docs

   ### Action Items

   - [ ] Update spec.md: Add acceptance criteria to FR-1
   - [ ] Update spec.md: Add NFR for session timeout
   - [ ] Update spec.md: Add NFR for brute-force protection
   - [ ] Update design.md: Remove OAuth section
   - [ ] Update design.md: Add email retry queue design
   - [ ] Update all docs: Replace "login" with "authentication"
   ```

**Next Command:**

- `/afx-spec review <name>` after edits made
- Edit spec files to address action items
