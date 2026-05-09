---
name: afx-check
description: Quality gates and compliance — trace execution paths, audit annotations, verify cross-references, and run all checks against spec requirements
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,check,quality,compliance,traceability"
  afx-argument-hint: "path | trace | links | schema | deps | coverage | all"
  modeSlugs:
    - focus-review-spec
    - focus-review-design
    - focus-review-tasks
    - focus-code
    - architect
    - code
---

# /afx-check

Quality verification and compliance checking for AgenticFlowX.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)

If neither file exists, use defaults.

## Usage

```bash
/afx-check path <feature-path>   # Trace execution path UI → DB
/afx-check trace [path]          # Audit @see annotations for PRD compliance
/afx-check links <spec-path>     # Verify cross-references between spec artifacts
/afx-check schema <spec-path>    # Verify database schema consistency in design.md
/afx-check deps [feature]        # Build and validate dependency graph from depends_on
/afx-check coverage <spec-path>  # Bidirectional spec-to-code coverage map
/afx-check all <feature-path>    # Run all checks
```

## Vocabulary Boundary

`/afx-check` is a read-only verification and compliance gate. It can verify implementation paths, traceability, links, schemas, dependencies, and coverage, but it does not refine living docs or fix code. Use `/afx-spec refine`, `/afx-design refine`, or `/afx-task refine` for document changes; use `/afx-task code` or `/afx-dev` for implementation fixes.

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Trace execution paths, audit annotations, verify cross-references
- Append to `docs/specs/**/journal.md` (Captures only, via Proactive Capture Protocol)

### Forbidden

- Create/modify/delete any files (except journal captures above)
- Run build/test/deploy/migration commands

If fixes are requested, respond with:

```text
Out of scope for /afx-check (read-only audit mode). Use /afx-task code to fix issues found.
```

### Timestamp Format (MANDATORY)

When writing execution reports or creating journal entries, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

## Post-Action Checklist (MANDATORY)

Since this is a read-only quality gate, no files are modified. However, after executing any check, you MUST:

1. Clearly state the **Pass/Fail** result of the verification.
2. If failures are found, provide exactly the file names and line numbers of the failure sites.
3. Suggest the remediation command to fix the issue.

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-check`**: Critical path failure, missing traceability that reveals design gap.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature and check path from the active file (e.g., `src/features/user-auth/auth.service.ts` → check `user-auth` path). If code is selected, use it to narrow the verification scope.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Require explicit path — checks need a concrete target.
3. **Trailing parameters (`[...context]`):** Treat extra words as focus constraints (e.g., `/afx-check path user-auth api only` → trace just the API boundaries). Extract the base path/target, then apply context as a constraint on the analysis.

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-check` action, suggest the most appropriate next command based on context:

| Context                        | Suggested Next Command                           |
| ------------------------------ | ------------------------------------------------ |
| After `path` (ALL VERIFIED)    | `/afx-task pick <spec>` for next task            |
| After `path` (FAILED)          | `/afx-task code` to fix the gaps                 |
| After `trace` (no orphans)     | `/afx-check path` or `/afx-task pick`            |
| After `trace` (orphans found)  | `/afx-check trace <file>:<line>` to fix each     |
| After `links` (all valid)      | `/afx-task pick <spec>` or `/afx-task code`      |
| After `links` (broken found)   | Fix broken links, then re-run `/afx-check links` |
| After `all` (READY FOR REVIEW) | `/afx-task pick <spec>` or create PR             |
| After `all` (issues found)     | `/afx-task code` to address issues               |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. /afx-task code # Context-driven: Fix gaps if verification failed
2. /afx-task pick docs/specs/{feature} # Context-driven: Move to next task (if verified)
3. /afx-task verify <task-id> # Context-driven: Confirm task matches spec
   ──
4. /afx-session note "<note>" # Note issues before switching
5. /afx-next # Re-orient after check
```

---

## Subcommands

---

## 1. path

Trace complete execution from UI to database and identify gaps. This is **Gate 1 (BLOCKING)** in AgenticFlowX quality gates.

### Usage

```bash
/afx-check path <feature-path>
```

Example: `/afx-check path src/features/user-auth`

### Context

- Feature path: $ARGUMENTS (required)
- Traces: UI → Server Action → Service → Repository → Database
- Detects mock/placeholder code patterns

### When to Use

**MANDATORY**: Run this command before:

- Marking any submission/form feature as complete
- Checking off subtask boxes for UI work
- Closing a GitHub ticket with user-facing features
- Running other quality gates (TypeScript, tests, build)

This is **Gate 1 (BLOCKING)** - if it fails, do NOT proceed with other gates.

### Verification Process

#### 1. Find Entry Points

Locate forms, buttons, and handlers in the feature path:

```bash
# Search for form handlers
grep -r "onSubmit" --include="*.tsx" $ARGUMENTS
grep -r "handleSubmit" --include="*.tsx" $ARGUMENTS
grep -r "onClick" --include="*.tsx" $ARGUMENTS
```

#### 2. Check for Mock Code (Red Flags)

**CRITICAL**: Search for these patterns that indicate incomplete implementations:

```bash
# Critical - Mock patterns
grep -r "setTimeout" --include="*.tsx" $ARGUMENTS
grep -r "// Simulate" --include="*.ts" $ARGUMENTS
grep -r "// Mock" --include="*.ts" $ARGUMENTS

# Warning - Potential issues
grep -r "// TODO" --include="*.ts" $ARGUMENTS | grep -i "implement"
grep -r "console.log" --include="*.ts" $ARGUMENTS
```

#### 3. Trace Each Handler

For each handler found, trace the call chain:

```
Handler: handleSubmit()
├── Calls: submitClaim() or setTimeout()
├── File: ./claim.action.ts
└── Status: REAL / MOCK
```

#### 4. Check Server Actions

For each action file:

```
Action: submitClaim()
├── 'use server': Yes/No
├── Calls: service.create() Yes/No
├── Error handling: Yes/No
└── Status: COMPLETE / INCOMPLETE
```

#### 5. Check Services

For each service:

```
Service: createClaim()
├── Calls: repository.insert() Yes/No
├── Exported: Yes/No
└── Status: COMPLETE / INCOMPLETE
```

#### 6. Check Repository

For each repository method:

```
Repository: insert()
├── DB Client: Kysely/Prisma/etc or mock
├── Query: INSERT INTO... Yes/No
└── Status: REAL / MOCK
```

### Output Format

#### Summary Table

```markdown
## Execution Path Verification: {feature}

| Layer      | Component              | Status | Issue |
| ---------- | ---------------------- | ------ | ----- |
| UI         | ClaimForm.handleSubmit | Pass   | -     |
| Action     | submitClaim            | Pass   | -     |
| Service    | createClaim            | Pass   | -     |
| Repository | insert                 | Pass   | -     |
| Database   | feature_claim          | Pass   | -     |

**Result:** ALL PATHS VERIFIED

Next: /afx-task pick docs/specs/{feature} # Proceed to next task
```

#### If Gaps Found

```markdown
## VERIFICATION FAILED

### Gaps Found

1. **UI Layer**: `handleSubmit` uses `setTimeout` mock
   - File: `claim-form.tsx:25`
   - Pattern: `setTimeout(() => router.push(...), 1000)`
   - Fix: Replace with `await submitClaim(formData)`

2. **Action Layer**: Missing error handling
   - File: `claim.action.ts:15`
   - Fix: Add try/catch with proper error response

Next: /afx-task code # Fix the identified gaps
```

### Red Flags Reference

| Pattern                  | Location | Severity | Meaning                       |
| ------------------------ | -------- | -------- | ----------------------------- |
| `setTimeout` in handlers | UI       | Critical | Mock submission, no real call |
| `// Simulate`            | Any      | Critical | Placeholder code              |
| `// Mock`                | Any      | Critical | Placeholder code              |
| `// TODO.*implement`     | Any      | Warning  | Incomplete implementation     |
| `console.log` only       | Actions  | Warning  | Missing actual call           |
| Empty `catch {}`         | Any      | Warning  | Swallowed errors              |
| Missing `await`          | Async    | Warning  | Unhandled promise             |
| Hardcoded return         | Actions  | Warning  | No real DB call               |

### Layer Verification Checklist

```
1. UI LAYER
   └── Form/button calls real handler (not setTimeout)?
   └── Handler wired to server action?
   └── All required fields present?

2. SERVER ACTION LAYER
   └── 'use server' directive at top?
   └── Imports and calls service?
   └── Handles errors with try/catch?
   └── Returns proper response type?

3. SERVICE LAYER
   └── Calls repository method?
   └── Properly exported?
   └── Business logic complete?

4. REPOSITORY LAYER
   └── Uses real DB client?
   └── Executes actual query?
   └── Not returning hardcoded values?

5. DATABASE LAYER
   └── Connection configured?
   └── Table/collection exists?
   └── Schema matches types?
```

### Error Handling

**Missing parameter:**

```
Error: Feature path required
Usage: /afx-check path src/features/user-auth
```

**Path not found:**

```
Error: Path does not exist: {path}
Check the path and try again.
```

---

## 2. trace

Audit @see annotations for PRD compliance.

### Usage

```bash
/afx-check trace              # Scan entire codebase
/afx-check trace packages/db  # Scan specific directory
/afx-check trace file.ts:22   # Check specific line
```

### Modes

#### Scan Mode (No args or directory path)

1. **Search for annotations**:

   ```bash
   grep -rn "// TODO\|// FIXME\|// XXX\|// HACK\|// NOTE\|// BUG\|// OPTIMIZE\|// REVIEW" --include="*.ts" --include="*.tsx" [path]
   ```

2. **Check PRD compliance**: For each match, read the next line. If it does NOT contain `@see docs/specs/`, it's orphaned.

3. **Output report**:

   ```markdown
   ## Annotation Audit Report

   Found {N} orphaned annotations (missing PRD links):

   | File               | Line | Type  | Content                 | Suggested PRD                         |
   | ------------------ | ---- | ----- | ----------------------- | ------------------------------------- |
   | claim.action.ts    | 397  | TODO  | Send email notification | docs/specs/user-auth/tasks.md#phase-2 |
   | booking.service.ts | 45   | FIXME | Race condition          | docs/specs/bookings/design.md#locking |

   Run `/afx-check trace <file>:<line>` for detailed fix suggestions.

   Next: /afx-check trace claim.action.ts:397 # Fix first orphan
   ```

4. **PRD inference**: Suggest PRD based on file path (see mapping below).

#### Point Mode (file:line or natural language)

1. **Locate file**: Find the file (search if not full path)
2. **Read context**: Read ±15 lines around the specified line
3. **Identify**:
   - Function/method containing the annotation
   - Feature from file path or user context
   - Annotation type (TODO, FIXME, etc.)
4. **Find relevant PRD**:
   - Match feature to `docs/specs/{feature}/`
   - Search tasks.md and design.md for related sections
5. **Output suggestion**:

   ````markdown
   ## Annotation Fix Suggestion

   **File**: `feature-claim.action.ts:397`
   **Function**: `assignSupplier()`

   **Current**:

   ```typescript
   // TODO: Send email notification to supplier
   ```
   ````

   **Suggested**:

   ```typescript
   // TODO: Send email notification to supplier
   // @see docs/specs/user-auth/spec.md [FR-3]
   // @see docs/specs/user-auth/design.md [DES-NOTIFY]
   ```

   **Context**: This TODO is in the `assignSupplier` function. Supplier notifications are planned for Phase 2 per the feature claims spec.

   Apply fix? [y/n]

   Next: /afx-check trace {next-file}:{line} # Fix next orphan

   ```

   ```

6. **Apply if confirmed**: Use Edit tool to add the `@see` line.

### PRD Link Inference

Map file paths to likely PRDs:

| File Pattern             | Likely PRD                  |
| ------------------------ | --------------------------- |
| `**/feature-claim*`      | `docs/specs/user-auth`      |
| `**/booking*`            | `docs/specs/bookings`       |
| `**/listing*`            | `docs/specs/listings`       |
| `**/auth*`               | `docs/specs/auth`           |
| `**/user*`               | `docs/specs/users`          |
| `packages/db/**`         | Infer from function context |
| `packages/mailer/**`     | Check which feature uses it |
| `packages/rental-engine` | `docs/specs/bookings`       |

When uncertain, list available specs from `docs/specs/` and ask user.

### Annotation Rules Reference

Per AFX, annotations MUST have a PRD link:

```typescript
// TODO: Description of work
// @see docs/specs/{feature}/tasks.md#{task-anchor}

// FIXME: Bug description
// @see docs/specs/{feature}/design.md#{section}
// @see https://github.com/org/repo/issues/123  (optional external link)

// NOTE: Important context
// @see docs/specs/{feature}/research/{topic}.md
```

**Required**: At least one `@see docs/specs/...` link
**Optional**: Additional external links (GitHub issues, docs)

### Standard Annotations

| Annotation | Purpose                     | Typical PRD Link        |
| ---------- | --------------------------- | ----------------------- |
| `TODO`     | Task to complete            | tasks.md#{task}         |
| `FIXME`    | Definitely broken           | design.md#{section}     |
| `XXX`      | Needs thought/decision      | research/{topic}.md     |
| `HACK`     | Brittle code, needs cleanup | design.md#{section}     |
| `NOTE`     | Important context           | spec.md or design.md    |
| `BUG`      | Known bug                   | GitHub issue + tasks.md |
| `OPTIMIZE` | Performance improvement     | design.md#{section}     |
| `REVIEW`   | Needs code review           | tasks.md or GitHub PR   |

---

## 3. links

Verify spec integrity - check cross-references.

### Usage

```bash
/afx-check links <spec-path>
/afx-check links all
```

Examples:

- `/afx-check links docs/specs/user-auth`
- `/afx-check links all`

### Purpose

**Spec Integrity Sync**. Verify links across core phase files.

### Process

#### 0. Scope Definition

1. **Analyze Argument**: Check if the user provided a specific path or `all`.
   - If `path`: Focus only on that directory.
   - If `all`: Iterate through all directories in `docs/specs/`.
   - If missing: Prompt user to specify a path.

#### 1. Link Verification

1. **Scan** `spec.md`, `design.md`, and `tasks.md` for broken links.
2. **Verify** that every Requirement (e.g., `FR-1`) in `spec.md` is referenced in `design.md` and `tasks.md`.
3. **Fix** any broken anchors or file paths immediately.

#### 2. Report

Output a summary of what was fixed.

### Reference: Anchor Generation

1. Convert heading to **lowercase**
2. **Remove** periods, colons, special characters (keep hyphens)
3. **Replace** spaces with hyphens

| Heading                | Anchor             |
| ---------------------- | ------------------ |
| `## DESIGN-3.1`        | `#design-31`       |
| `## FR-1: User Auth`   | `#fr-1-user-auth`  |
| `### Phase 1: Setup`   | `#phase-1-setup`   |
| `### 2.1 Create Model` | `#21-create-model` |

### Reference: Link Formats

#### Same Directory (spec ↔ design ↔ tasks)

```markdown
[DESIGN-3.1](design.md#data-model)
[FR-1](spec.md#functional-requirements)
[Task 2.1](tasks.md#21-task-name)
```

#### From GitHub Issues (use repo-relative paths)

```markdown
[tasks.md - Phase 1](docs/specs/{feature}/tasks.md#phase-1-database-setup)
[design.md - Data Model](docs/specs/{feature}/design.md#data-model)
```

### Reference: Required References

#### In tasks.md (every task group)

```markdown
### 1.1 Create Database Schema

> Ref: [DESIGN-3.1](design.md#data-model) | [FR-1](spec.md#functional-requirements)
> GitHub Issue: #123

- [ ] Task item
```

#### In design.md (link to requirements)

```markdown
## Data Model

> Implements: [FR-1](spec.md#functional-requirements)
```

## 4. schema

Verify internal consistency of design.md database artifacts.

### Usage

```bash
/afx-check schema <spec-path>
```

Example: `/afx-check schema docs/specs/my-feature`

### Context

- Spec path: $ARGUMENTS (required)
- Verifies consistency across all database-related artifacts in design.md
- Detects: Column mismatches, missing tables, invalid constraints, naming inconsistencies

### When to Use

**MANDATORY**: Run this command after:

- Any PRD review that touches database schema
- Adding or modifying migrations in design.md
- Adding or modifying seed SQL in design.md
- Updating ERD/Mermaid diagrams
- Before implementation of database-related tasks

This catches issues that would only surface during actual migration execution.

### Verification Process

#### 1. Identify Artifacts in design.md

Scan for all database-related sections. Common patterns:

```bash
# Migrations
grep -n "CREATE TABLE\|ALTER TABLE" design.md

# Type definitions (varies by ORM/language)
grep -n "interface\|type\|model\|schema" design.md

# ERD diagrams
grep -n "erDiagram\|classDiagram" design.md

# Seed data
grep -n "INSERT INTO" design.md

# Repository/query code
grep -n "\.select\|\.insert\|\.update\|\.delete\|\.where" design.md
```

#### 2. Build Cross-Reference Map

For each table found in migrations, track:

- Table name and columns (from CREATE TABLE)
- Type definition (from ORM types)
- ERD entity (from Mermaid)
- Seed statements (from INSERT INTO)
- Repository queries (from code examples)

#### 3. Cross-Reference Checks

| Check                      | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| **Migration → Types**      | Every CREATE TABLE has matching type definition                      |
| **Types → Migration**      | Every type definition has matching CREATE TABLE                      |
| **Migration → ERD**        | Every table in migrations appears in ERD                             |
| **ERD → Migration**        | Every entity in ERD has matching migration                           |
| **Seed → Migration**       | INSERT columns exist in CREATE TABLE                                 |
| **Seed → Constraints**     | ON CONFLICT/UPSERT clauses match actual constraints (PK, UNIQUE)     |
| **Repository → Migration** | Column/table names in queries match schema                           |
| **Documentation → Code**   | Any documented lists (enums, constants, etc.) match code/seed values |

#### 4. Common Issues to Detect

**Constraint Mismatch:**

```sql
-- Migration defines: PRIMARY KEY (id)
-- Seed uses: ON CONFLICT (id, other_col) ← INVALID
```

**Column Name Inconsistency:**

```sql
-- Migration: created_at TIMESTAMPTZ
-- Repository: .where('createdAt', ...) ← MISMATCH
```

**Missing Column in Types:**

```sql
-- Migration adds: new_column VARCHAR(100)
-- Type definition: missing new_column ← ERROR
```

**Seed Order Violation:**

```sql
-- INSERT into child_table references parent_id
-- But parent_table seed comes AFTER child_table ← FK VIOLATION
```

### Output Format

#### Summary Table

```markdown
## Schema Consistency Check: {spec}

| Artifact    | Status  | Issues |
| ----------- | ------- | ------ |
| Migrations  | OK      | -      |
| Type Defs   | WARNING | 1      |
| ERD Diagram | OK      | -      |
| Repository  | WARNING | 1      |
| Seed SQL    | FAIL    | 2      |

**Result:** 4 issues found
```

#### If Issues Found

```markdown
## SCHEMA VERIFICATION FAILED

### Issues Found

1. **Type Definition**: Missing column
   - Migration has: `new_column VARCHAR(100)`
   - Type missing: `new_column`
   - Fix: Add column to type definition

2. **Seed SQL**: Invalid ON CONFLICT
   - Table constraint: `PRIMARY KEY (id)`
   - Seed uses: `ON CONFLICT (id, other)`
   - Fix: Match ON CONFLICT to actual constraint

3. **Repository**: Column name mismatch
   - Migration: `created_at`
   - Query uses: `createdAt`
   - Fix: Use consistent naming convention

Next: Fix issues in design.md, then re-run /afx-check schema
```

### Artifact Checklist

When verifying schema consistency:

```
□ MIGRATIONS (CREATE TABLE/ALTER TABLE)
  └── Primary keys defined
  └── Foreign keys reference existing tables
  └── Indexes for frequently queried columns
  └── Constraint names are unique
  └── Migration order respects dependencies

□ TYPE DEFINITIONS (ORM-specific)
  └── Every migration table has matching type
  └── Column names match exactly
  └── Types are compatible (SQL type → language type)
  └── Nullable columns marked appropriately
  └── Default values indicated where applicable

□ ERD/DIAGRAMS
  └── Every migration table appears as entity
  └── Relationships match foreign keys
  └── Cardinality annotations correct (1:1, 1:N, N:M)

□ REPOSITORY/QUERY CODE
  └── Column names match migration schema
  └── Table names match migration schema
  └── Join conditions use correct foreign keys

□ SEED DATA
  └── Table names exist in migrations
  └── Column names exist in target tables
  └── ON CONFLICT/UPSERT matches actual constraints
  └── Seed order respects foreign key dependencies
  └── Subqueries reference correct columns

□ DOCUMENTATION TABLES
  └── Documented values match seed/code values
  └── Naming conventions consistent throughout
```

### Error Handling

**Missing parameter:**

```
Error: Spec path required
Usage: /afx-check schema docs/specs/my-feature
```

**No design.md found:**

```
Error: No design.md found at {spec-path}/design.md
Check the spec path and try again.
```

**No schema artifacts found:**

```
Warning: No CREATE TABLE statements found in design.md
This spec may not have database schema. Skipping schema check.
```

---

## 5. deps

Build and validate the cross-spec dependency graph from `depends_on` frontmatter.

### Usage

```bash
/afx-check deps                  # All specs
/afx-check deps <feature>        # Single feature and its dependents
```

### Process

1. **Scan all specs**: Read `depends_on` from every `spec.md` frontmatter under `docs/specs/`
2. **Build graph**: Map feature → dependencies
3. **Validate**:
   - Every target in `depends_on` exists as a real feature folder
   - No circular dependencies (A → B → A)
   - No self-references
4. **Report**:

```markdown
## Dependency Graph

marketplace-bookings → [marketplace-auth, marketplace-listings]
marketplace-listings → [marketplace-auth]
marketplace-auth → [] (root)

### Validation

✓ All dependency targets exist
✓ No circular dependencies
✗ marketplace-payments depends_on "billing-service" — folder not found

### Orphaned Specs (no dependents)

ℹ marketplace-reports (informational — not blocking)
```

---

## 6. coverage

Bidirectional spec-to-code coverage map.

### Usage

```bash
/afx-check coverage <spec-path>
```

Example: `/afx-check coverage docs/specs/user-auth`

### Process

1. **Spec → Code**: For every `[FR-X]` and `[NFR-X]` in `spec.md`, search source code for `@see` links referencing that Node ID. Report uncovered requirements.
2. **Code → Spec**: For every `@see` link in source code pointing to this spec, verify the target Node ID exists in the spec file. Report broken/stale references.
3. **Output**:

```markdown
## Coverage: user-auth

### Spec → Code (Requirements Coverage)

| Requirement | @see in Code                         | Status      |
| ----------- | ------------------------------------ | ----------- |
| [FR-1]      | auth.service.ts:15, auth.action.ts:8 | ✓ Covered   |
| [FR-2]      | auth.service.ts:42                   | ✓ Covered   |
| [FR-3]      | —                                    | ✗ Uncovered |
| [NFR-1]     | auth.middleware.ts:5                 | ✓ Covered   |

Coverage: 3/4 (75%)

### Code → Spec (Orphan Check)

| @see Link                          | Target           | Status  |
| ---------------------------------- | ---------------- | ------- |
| auth.helper.ts:10 → spec.md [FR-5] | [FR-5] not found | ✗ Stale |

Stale references: 1
```

---

## 7. all

Run all verification checks in sequence.

### Usage

```bash
/afx-check all <feature-path>
```

### Process

1. **Run path check**: `/afx-check path <feature-path>`
2. **Run trace check**: `/afx-check trace <feature-path>`
3. **Run links check**: Infer spec from feature path
4. **Run schema check**: `/afx-check schema <spec-path>` (if design.md has CREATE TABLE)
5. **Run deps check**: `/afx-check deps <feature>`
6. **Run coverage check**: `/afx-check coverage <spec-path>`

### Output

```markdown
## Full Verification Report: {feature}

### 1. Execution Path

{path check results}

### 2. Annotation Audit

{trace check results}

### 3. Spec Integrity

{links check results}

### 4. Schema Consistency

{schema check results - or "N/A: No database schema in this spec"}

## Summary

| Check    | Status     |
| -------- | ---------- |
| Path     | Pass       |
| Trace    | 3 warnings |
| Links    | Pass       |
| Schema   | Pass       |
| Deps     | Pass       |
| Coverage | 75%        |

**Overall**: READY FOR REVIEW (with warnings)

Next: /afx-task pick docs/specs/{feature} # Continue to next task
```

Or if issues found:

```
Next: /afx-task code {id}   # Address the issues first
```

---

## Related Commands

| Command        | Relationship                                           |
| -------------- | ------------------------------------------------------ |
| `/afx-task`    | Task lifecycle; check verifies code and spec alignment |
| `/afx-design`  | Refine design after check reveals design gaps          |
| `/afx-spec`    | Refine spec after check reveals requirement gaps       |
| `/afx-session` | No direct integration                                  |
