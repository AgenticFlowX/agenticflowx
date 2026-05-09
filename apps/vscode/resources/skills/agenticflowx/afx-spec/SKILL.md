---
name: afx-spec
description: "Spec management — validate structure, review quality, manage approval lifecycle for spec.md"
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,spec,requirements,validation,lifecycle"
  afx-argument-hint: "create | refine | discuss | validate | review | approve"
  modeSlugs:
    - focus-review-spec
    - focus-review-design
    - architect
---

# /afx-spec

Specification management, review, authoring, and approval for spec-centric workflows.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADRs live (default: `docs/adr`)
- `library.research` - Global research library path (default: `docs/research`)

If neither file exists, use defaults.

## Usage

```bash
# Scaffolding
/afx-spec create <name>                     # Initialize new spec directory with all artifacts

# Analysis (agent reasoning required)
/afx-spec validate <name>                   # Check spec structure integrity

# Collaboration (LLM-driven)
/afx-spec refine <name>                    # Alias: refine requirements (same flow as discuss)
/afx-spec discuss <name>                    # Interactive gap analysis + journal capture
/afx-spec review <name>                     # Automated quality scoring

# Approval Workflow
/afx-spec approve <name> [--reviewer "@handle"]  # Lifecycle gate + optional human sign-off
```

> **Display Rule:** Don't dump full spec lists, status tables, phase breakdowns, or discussion logs into chat unless the user explicitly asks. The user can browse the files directly, or use a UI host such as the AgenticFlowX VS Code extension (Specs Tree, Pipeline Tab, Tasks Tab, Journal Tab) if installed. Focus skill output on agent reasoning, not raw display.

## Purpose

Provides a spec-centric interface for managing specifications throughout their lifecycle. Focuses on operations that require agent reasoning — validation, gap analysis, quality review, content authoring, and approval workflows.

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve the living artifact content. In `/afx-spec`, this maps to `refine` (preferred alias), `discuss` (legacy-compatible), and targeted edits to `spec.md`.
- **Validate**: check structural, parser, template, frontmatter, and cross-reference correctness.
- **Review**: apply LLM judgment for quality, readiness, ambiguity, risk, and missing requirements.
- **Verify**: check implementation evidence against approved intent. This belongs to `/afx-task verify` and `/afx-check`, not `/afx-spec`.
- **Approve**: advance a lifecycle gate after validation and review.
- **Evolve**: handle post-ship feature, bug, or change work by refining living docs and capturing history in `journal.md` / `tasks.md`.

---

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/update markdown artifacts only in:
  - `docs/specs/**` (spec files)
  - `docs/adr/**` (linked ADRs)
- Update `.afx.yaml` (feature registration, prefix assignment)

### Forbidden

- Create/modify/delete source code in application directories
- Delete spec folders (only `create` subcommand scaffolds new ones)
- Delete any spec files
- Run build/test/deploy/migration commands
- Modify runtime config used by application execution
- **Destructive File Rewrites**: Never replace the entire contents of an existing `spec.md`, `design.md`, or `journal.md` file using a full-file rewrite. Always use targeted line-level replacements or append actions to preserve manually written human content.

If implementation is requested, return:

```text
Out of scope for /afx-spec (specification-management mode). Use /afx-dev code after spec approval.
```

---

### Timestamp Format (MANDATORY)

When creating or updating frontmatter (`updated_at`, `approved_at`, `signed_at`, `created_at`), all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Frontmatter (MANDATORY)

When creating or modifying spec documents, read `assets/spec-template.md` for the canonical structure and frontmatter schema:

```yaml
---
afx: true
type: SPEC
status: Draft
owner: "@handle"
version: "1.0"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["{feature}"]
---
```

**During approval**, add these fields (do NOT remove existing fields):

- `approved_at: YYYY-MM-DDTHH:MM:SS.mmmZ`
- `signed_at: YYYY-MM-DDTHH:MM:SS.mmmZ`
- `reviewer: "@handle"`
- Update `status: Approved` and `updated_at` to current timestamp

**Immutable fields** (must NOT be changed during approval): `afx`, `type`, `owner`, `created_at`.

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-spec`**: Requirement deferred during review, spec gap identified, approval with conditions.

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): new FR/NFR added, FR/NFR moved to Non-Goals, Open Question resolved, missed requirement surfaced. After applying the edit, run the [Significance Check](../afx-session/SKILL.md#significance-check-context-aware-gate) first — if the edit is cosmetic (typo, rewording, formatting) **skip silently**. Only call `/afx-session capture --trigger <new-fr|new-nfr|scope-cut|question-resolved|missed-req> --links <anchors>` when the change encodes a new decision, preserves institutional knowledge, or emerged from discussion. See [Prompt Capture Triggers](../afx-session/SKILL.md#prompt-capture-triggers-propose--confirm).

## Post-Action Checklist (MANDATORY)

After completing any action that modifies `spec.md`, you MUST:

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in `spec.md` frontmatter.
2. **Contextual Tagging**: If changes introduce new domains or concepts, append to `tags` array.
3. **Dependency Tracking**: If changes introduce a reliance on another feature, add that feature's folder name to the `depends_on` array in frontmatter.
4. **Version & State Management**: If modifying a `spec.md` that is currently `status: Approved`, evaluate the change. If it alters scope or requirements, bump `version` (e.g., "1.0" → "1.1") and revert `status: Draft` to force re-approval.
5. **Format Preservation**: Frontmatter fields must remain in canonical order (see **Frontmatter (MANDATORY)** section). Use double quotes for all string values.
6. **Template Section Check**: Verify all 8 required sections from the canonical template are present as `##` headings. Requirement tables use sequential `FR-N` / `NFR-N` IDs with no gaps. Custom sections allowed but required ones must not be omitted. See **Template Format Rules (CRITICAL)** section.

---

## Lifecycle Preconditions (BLOCKING)

**CRITICAL**: The spec lifecycle enforces a strict authoring sequence. Content authoring into downstream documents is **blocked** until upstream documents are approved.

### Document Authoring Gates

| Target Document | Precondition | Check                        |
| --------------- | ------------ | ---------------------------- |
| `spec.md`       | None         | Always allowed (entry point) |
| `journal.md`    | None         | Always allowed (session log) |

### Scaffold vs Content

- **Scaffold** (template placeholders created by `/afx-scaffold feature`): Always allowed. Empty template files are not content.
- **Content** (full technical design, task breakdowns, requirements): Gated behind approval.
- **journal.md**: Always writable — session capture is never gated.

### Approval Chain

```
spec.md (Draft → Approved)
  → /afx-design author unlocked
    → design.md (Draft → Approved)
      → /afx-task plan unlocked
```

---

## Documentation Principles

**CRITICAL RULE**: Maintain strict separation between State and Event/Log.

- **Living Documents (State)**: `spec.md` and `design.md` represent the _current factual state_ of the system. They must NOT contain historical backstory, abandoned ideas, or chronological narratives. Always overwrite them to reflect reality.
- **Historical Logs (Event)**: `journal.md` and `tasks.md` represent the _history_ of how the system evolved. All architectural decisions, failed experiments, and brainstorming belong in the append-only `journal.md`.
- **Post-Ship Evolution**: shipped specs remain living truth. New features, bug corrections, and behavior changes refine `spec.md` / `design.md` when current behavior changes, append rationale and production notes to `journal.md`, and track execution in `tasks.md`. Do NOT create amendment directories or new artifact types for ordinary evolution.

---

## Agent Instructions

### Trailing Parameters (`[...context]`)

When trailing arguments are passed, treat them as constraints for the command's behaviour (e.g., `/afx-spec refine user-auth api pagination` or `/afx-spec discuss user-auth api pagination` → focus refinement on API pagination). Do not treat trailing words as invalid scopes; incorporate them into the intent routing and analysis phase.

### Persistence Checkpoint (MANDATORY)

Do not auto-write spec files. Before persisting any changes to `spec.md`, `design.md`, or `tasks.md`:

1. Present the proposed content to the user
2. Wait for explicit confirmation before writing
3. `journal.md` append-only entries may be written without checkpoint (session log)

### Context Resolution (MANDATORY)

When `<name>` is omitted or ambiguous, resolve in this order:

1. **Environment detection** — Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **IDE: Active file** — Infer `[feature]` from the active file path (e.g., `docs/specs/user-auth/spec.md` → `user-auth`). If code is selected, use it as additional context for the spec discussion or review.
3. **CLI: Explicit args** — If a feature name is passed explicitly, use it directly.
4. **Conversation context** — Recently discussed feature, spec file reads, or prior `/afx-spec` commands.
5. **Branch name** — Extract from `feat/{feature-name}` pattern.
6. **Open GitHub issues** — If only one feature has open/active issues.
7. **`.afx.yaml` features list** — If only one feature is registered.
8. **Fallback** — Prompt the user: "Which feature? Available: user-auth, shopping-cart, ..."

**Subcommand-specific rules:**

| Subcommand | Arg required? | Inference allowed?                      |
| ---------- | ------------- | --------------------------------------- |
| `create`   | Yes           | Can infer from conversation topic       |
| `refine`   | Yes           | Can infer from branch or recent context |
| `validate` | Yes           | Can infer from branch or recent context |
| `discuss`  | Yes           | Can infer from branch or recent context |
| `review`   | Yes           | Can infer from branch or recent context |
| `approve`  | Yes           | Can infer from branch or recent context |

---

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-spec` action, suggest the most appropriate next command based on context:

| Context                             | Suggested Next Command                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| After `create`                      | `/afx-spec refine <name>` to iterate on spec requirements  |
| After `validate` (passed)           | `/afx-spec review <name>` for quality check                |
| After `validate` (failed)           | Fix missing files or broken links                          |
| After `refine`                      | `/afx-spec review <name>` to validate changes              |
| After `discuss`                     | `/afx-spec review <name>` to validate changes              |
| After `review` (critical issues)    | `/afx-spec refine <name>` to fix issues                    |
| After `review` (no critical issues) | `/afx-spec approve <name>` to approve spec                 |
| After `approve` (spec.md)           | `/afx-design refine <name>` to author/refine design.md     |
| After `approve` (design.md)         | `/afx-task refine <name>` to author/refine tasks.md        |
| After `approve --reviewer`          | `/afx-task refine <name>` to generate implementation tasks |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. /afx-spec refine docs/specs/{feature} # Context-driven: Iterate on spec
2. /afx-spec review {feature} # Context-driven: Review quality
3. /afx-spec approve {feature} # Context-driven: Approve if ready
   ──
4. /afx-task pick {feature} # Start implementation
5. /afx-session note "<note>" # Capture findings
```

### Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use `ask_followup_question` to present options as clickable buttons instead of text-only suggestions.

**Trigger conditions:**

| Condition                                                                         | Question                                                                     | Options                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| After `create` completes                                                          | "Spec scaffolded. Discuss requirements to fill in gaps?"                     | "Discuss spec" / "Edit manually" / "Not now"      |
| After `validate` passes (all checks ✓)                                            | "Validation passed. Want a quality review?"                                  | "Review spec" / "Approve spec" / "Not now"        |
| After `validate` fails (structural issues)                                        | "Validation found structural issues. Fix them now?"                          | "Show issues" / "Not now"                         |
| After `discuss` with all action items resolved                                    | "All discussion items addressed. Review the spec?"                           | "Review spec" / "Continue discussing" / "Not now" |
| After `discuss` with new requirements identified                                  | "New requirements identified during discussion. Update the spec?"            | "Update spec" / "Review first" / "Not now"        |
| After `review` with 0 Critical issues                                             | "Spec has no critical issues. Ready to approve?"                             | "Approve spec" / "Discuss issues" / "Not now"     |
| After `review` with Critical issues found                                         | "Critical issues found that must be fixed before approval."                  | "Fix issues" / "Discuss spec" / "Not now"         |
| After `approve` (spec approved)                                                   | "Spec approved. Author the technical design?"                                | "Author design" / "Not now"                       |
| After `approve --reviewer` (human sign-off recorded)                              | "Human sign-off recorded. Ready to start implementation?"                    | "Author design" / "Plan tasks" / "Not now"        |
| spec.md is Approved + has been modified (version bump triggered status → Draft)   | "Approved spec was modified. Status reverted to Draft — re-approval needed." | "Re-approve spec" / "Review first" / "Not now"    |
| spec.md exists but is missing required sections (detected during any action)      | "Spec is incomplete — missing required sections."                            | "Validate spec" / "Discuss gaps" / "Not now"      |
| design.md or tasks.md has `@see` links to non-existent FR/NFR IDs (during review) | "Downstream docs reference requirements that don't exist in this spec."      | "Review references" / "Validate spec" / "Not now" |

**Rules:**

- Only trigger when the lifecycle gate is actually actionable (preconditions met)
- Include "Not now" as the last option — never force the user
- If user selects an action, execute it immediately (run the approval/review/author flow)
- If user selects "Not now", continue normally — do not re-ask in the same conversation
- Keep existing text-only "Next Command Suggestion" for non-lifecycle contexts
- These buttons complement, not replace, the text suggestions

---

## Template Format Rules (CRITICAL)

The AFX `spec.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it to extract sections, requirements, and status. Deviations cause **silent failures** in tools that render specs (e.g., the VS Code extension fails to display sections). These rules define the canonical format — custom sections are allowed but required ones must not be omitted.

**Template reference:** `assets/spec-template.md`

### Section Headings

Heading levels determine what AFX parsers can see:

- `#` (h1): Document title only — `# {Feature Name}`
- `##` (h2): Major sections — **captured by AFX parsers**
- `###` (h3): Sub-sections — **captured by AFX parsers**
- `####` and deeper: **NOT captured** — do not use for requirements or sections that need to be visible to AFX tools

### Required Sections

All `spec.md` files MUST contain these `##` sections (in order):

1. `## References`
2. `## Problem Statement`
3. `## User Stories` (with `### Primary Users` and `### Stories`)
4. `## Requirements` (with `### Functional Requirements` and `### Non-Functional Requirements`)
5. `## Acceptance Criteria`
6. `## Non-Goals (Out of Scope)`
7. `## Open Questions`
8. `## Dependencies`

Optional: `## Appendix` (with sub-sections for wireframes, data examples, glossary)

### Requirement ID Format

Requirements use table format with sequential IDs — no gaps allowed:

**Functional Requirements table:**

```markdown
| ID   | Requirement      | Priority  |
| ---- | ---------------- | --------- |
| FR-1 | Description here | Must Have |
| FR-2 | Description here | Should    |
```

**Non-Functional Requirements table:**

```markdown
| ID    | Requirement      | Target  |
| ----- | ---------------- | ------- |
| NFR-1 | Description here | < 200ms |
| NFR-2 | Description here | 99.9%   |
```

- IDs MUST be sequential: `FR-1, FR-2, FR-3` — not `FR-1, FR-3`
- IDs MUST be unique within the file
- These IDs are referenced by `@see` annotations in code and tasks.md

### Frontmatter

See **Frontmatter (MANDATORY)** section above for canonical field order and full schema. `type` MUST be `SPEC`.

---

## Subcommands

### create <name>

**Purpose:** Initialize new spec directory with all artifacts.

**Lifecycle Gate:** None — `create` is the entry point.

**Implementation:**

1. **Validate name**: Must be kebab-case. Error if not.
2. **Check existence**: If `docs/specs/<name>/` already exists, stop with error.
3. **Confirm with user**: Show file list and wait for confirmation.
4. **Read templates** from sibling skill `assets/` directories:
   - `assets/spec-template.md` (this skill)
   - `../afx-design/assets/design-template.md`
   - `../afx-task/assets/tasks-template.md`
   - `../afx-session/assets/journal-template.md`
5. **Create files** using the **Write tool** — substitute placeholders:
   - `{Feature Name}` → Title-cased name (e.g., `user-auth` → `User Auth`)
   - `{feature}` → the kebab-case name
   - `{YYYY-MM-DDTHH:MM:SS.mmmZ}` → current ISO 8601 timestamp
   - `@owner` → `@handle`
   - `<!-- prefix: XX -->` in journal.md → auto-derived prefix (first letter of each word, uppercase)
6. **Create `research/`** subdirectory (empty).
7. After scaffold, author **`spec.md` content only** (requirements, scope, acceptance criteria)
8. `design.md` and `tasks.md` remain as template scaffolds — content authoring is **blocked** until upstream documents are approved
9. `journal.md` gets initial discussion entry (always allowed)

**CRITICAL**: Do NOT author full `design.md` or `tasks.md` content during create. The spec must be reviewed, iterated, and approved first. Use `/afx-design author <name>` and `/afx-task plan <name>` after approval.

**Next Command:**

- `/afx-spec refine <name>` to iterate on spec requirements
- `/afx-spec review <name>` when ready for approval

---

### validate <name>

**Purpose:** Structural compliance check for spec.md and its sibling files — deterministic, blocking for approval.

**Implementation:**

1. **File Existence**: Check all 4 required files exist:
   - `docs/specs/<name>/spec.md`
   - `docs/specs/<name>/design.md`
   - `docs/specs/<name>/tasks.md`
   - `docs/specs/<name>/journal.md`
2. **Frontmatter Validation** (spec.md):
   - Has `afx: true`, `type: SPEC`, `status` field
   - Has `version` (quoted string)
   - Has `created_at` and `updated_at` (non-midnight timestamps)
   - Has `tags` array
   - Field order is canonical: `afx → type → status → owner → version → created_at → updated_at → tags → [depends_on]`
3. **Frontmatter Validation** (sibling files):
   - Each has `afx: true` and correct `type` (DESIGN, TASKS, JOURNAL)
   - Each has `status` field
4. **Requirement ID Check** (spec.md):
   - Every row in the Functional Requirements table has a `FR-N` ID
   - Every row in the Non-Functional Requirements table has a `NFR-N` ID
   - All IDs are unique within the file (no duplicate `FR-1`)
   - IDs are sequential (no gaps — `FR-1, FR-2, FR-3`, not `FR-1, FR-3`)
5. **Template Section Compliance** (spec.md): Check all 8 required sections exist (see **Template Format Rules** → Required Sections for the canonical list)
6. **Cross-Reference Check**: Delegate to `/afx-check links` for internal link validation

**Output:**

```
Validation: user-authentication (spec.md)

File Structure: ✓ All 4 files present
Frontmatter: ✓ Valid (SPEC, canonical field order, timestamps present)
Requirement IDs: ✓ 5 FR + 3 NFR, all unique and sequential
Template Sections: ✓ All 8 required sections present
Cross-references: ✓ All links valid

Status: PASSED
```

If validation fails:

```
Validation: user-authentication (spec.md)

File Structure: ✗ Missing files
  - tasks.md not found
Frontmatter: ✗ Invalid
  - spec.md: missing 'version' field
  - spec.md: 'updated_at' uses midnight timestamp (must be precise)
Requirement IDs: ✗ Issues found
  - Duplicate: FR-2 appears twice
  - Gap: FR-1, FR-3 (missing FR-2 after dedup)
  - NFR table: missing ID column
Template Sections: ✗ Missing sections
  - No "Non-Goals" section
  - No "Open Questions" section

Status: FAILED (6 issues)
```

**Next Command:**

- If passed: `/afx-spec review <name>` for quality check
- If failed: Fix listed issues, then re-validate

---

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

---

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

---

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

---

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
     /afx-scaffold feature user-auth
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

---

## Related Commands

### From Other Commands → `/afx-spec`

- `/afx-scaffold feature` → Suggest `/afx-spec refine <name>` after creation
- `/afx-task verify` → Suggest `/afx-spec validate` if spec issues detected
- `/afx-check links` → Suggest `/afx-spec validate` for full validation

### From `/afx-spec` → Other Commands

- `/afx-spec create` → Suggest editing spec.md to define requirements
- `/afx-spec approve` (spec) → Suggest `/afx-design refine <name>`
- `/afx-spec approve` (design) → Suggest `/afx-task refine <name>`
- `/afx-spec approve --reviewer` → Suggest `/afx-task pick` to start implementation

---

## Notes

- Focuses on operations requiring agent reasoning — display-only operations are best handled by file browsing or a UI host such as the AgenticFlowX VS Code extension
- Follows AFX patterns: YAML frontmatter, subcommand structure, agent instructions
- Delegates scaffolding to `/afx-scaffold` (create)
- Interactive `refine` / `discuss` and automated `review` ensure spec quality before approval
- Unified `approve` command handles automated approval, design approval, and human sign-off via flags
