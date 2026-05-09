---
name: afx-dev
description: Advanced diagnostics — debug issues, refactor code, review against specs, run tests, and optimize performance
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,development,debug,refactor,review,test,optimize"
  afx-argument-hint: "debug | refactor | review | test | optimize"
  modeSlugs:
    - focus-code
    - focus-debug
    - focus-refactor
    - code
    - debug
---

# /afx-dev

Advanced diagnostic toolkit for debugging, refactoring, review, testing, and optimization. For spec-driven coding, use `/afx-task code {id}`.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)

If neither file exists, use defaults.

## Usage

```bash
/afx-dev debug [error]          # Debug with spec trace
/afx-dev refactor [scope]       # Refactor maintaining spec alignment
/afx-dev review [scope]         # Code review against specs
/afx-dev test [scope]           # Run/generate tests
/afx-dev optimize [target]      # Performance optimization
```

> **Note:** Daily coding with task traceability has moved to `/afx-task code {id}`. Use `/afx-dev` for diagnostic operations that don't map to a specific task.

## Vocabulary Boundary

`/afx-dev` is for implementation diagnostics and code changes. It may verify fixes with tests/checks, but it does not validate AFX artifact structure and does not refine `spec.md`, `design.md`, or `tasks.md`. If implementation reveals a requirement/design/task gap, stop and route to `/afx-spec refine`, `/afx-design refine`, or `/afx-task refine`.

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/modify source code and test files in the project's application directories
- Run build, test, and lint commands
- All code changes MUST include `@see` traceability annotations linking back to specs
- Append to `docs/specs/**/journal.md` (Captures only, via Proactive Capture Protocol)

### Forbidden

- Create/modify/delete spec files (`spec.md`, `design.md`, `tasks.md`)
- Modify `.afx.yaml` or `.afx/` configuration
- Run deploy/migration commands without explicit user confirmation
- Delete spec or research files
- **Destructive File Rewrites**: Never replace the entire contents of an existing source code file using a full-file rewrite. Always use targeted line-level replacements to preserve existing functionality.

If spec changes are requested, respond with:

```text
Out of scope for /afx-dev (development mode). Use /afx-spec refine, /afx-design refine, or /afx-task refine to modify living SDD documents.
```

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-dev`**: Architecture change during refactor, scope cut during implementation, tech debt discovery, spec deviation found during coding.

## Post-Action Checklist (MANDATORY)

After completing any action that modifies source code, you MUST:

1. **`@see` Annotations (STRICT)**: Ensure modified exported classes, interfaces, and functions have `@see` links via JSDoc. Use Node ID syntax (e.g., `@see docs/specs/{feature}/design.md [DES-API]`). Line-level annotations ONLY for non-obvious requirements. **CRITICAL ANTI-PATTERN**: Do NOT dump blanket `@see` links at the top of the file. Do NOT annotate every line.
2. **No Orphaned Code**: Every new top-level export MUST have at least one `@see` link to a spec.
3. **No Mock Code**: Do not leave `setTimeout` or `// mock` without a `FIXME` and spec link.
4. **Work Session Handoff**: Do not edit `tasks.md` directly from `/afx-dev`. If the work is task-scoped, route through `/afx-task code` or tell the user to record the Work Session with `/afx-task complete`.
5. **Journal Capture**: If high-impact findings (architecture change, scope cut, tech debt), append to `journal.md`.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature and scope from the active file path (e.g., `src/features/user-auth/auth.service.ts` → `user-auth`). If code is selected (`ide_selection`), use it as the target scope for debug/refactor/review.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Prompt user for scope if ambiguous.
3. **Trailing parameters (`[...context]`):** Treat extra words as constraints (e.g., `/afx-dev refactor auth using newest library` → constraint: `using newest library`). Do not treat trailing words as invalid scopes.

### Persistence Checkpoint (MANDATORY)

Do not auto-write massive multi-file refactors or implementations without a checkpoint. Before persisting significant architectural changes:

1. Present the proposed approach to the user
2. Wait for explicit confirmation before writing
3. **Atomic Multi-Turn Rule**: Break large implementations into atomic, reviewable chunks. Do not attempt to implement an entire feature in a single turn. Wait for the user to review before proceeding to the next chunk.

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-dev` action, suggest the most appropriate next command based on context:

| Context                              | Suggested Next Command                       |
| ------------------------------------ | -------------------------------------------- |
| After `debug` (bug fixed)            | `/afx-check path <path>` to verify fix       |
| After `refactor` (refactor complete) | `/afx-check path <path>` to verify           |
| After `review` (issues found)        | `/afx-task code <id>` if task-scoped, else `/afx-dev refactor` or `/afx-dev debug` |
| After `review` (all pass)            | `/afx-task pick <spec>` for next task        |
| After `test` (tests pass)            | `/afx-check path <path>` or `/afx-task pick` |
| After `test` (tests fail)            | `/afx-dev debug` to investigate failures     |
| After `optimize` (optimization done) | `/afx-check path <path>` to verify           |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. /afx-check path <path> # Context-driven: Verify implementation works
2. /afx-task verify <task-id> # Context-driven: Confirm task matches spec
3. /afx-dev test <scope> # Context-driven: Run tests to validate
   ──
4. /afx-next # Re-orient after implementation
5. /afx-session note "<note>" # Capture learnings before switching
```

### Timestamp Format (MANDATORY)

When creating or updating Session Log entries, frontmatter (`updated_at`, `created_at`), and Work Sessions rows, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

---

## Bidirectional Traceability (MANDATORY)

**CRITICAL**: Every `/afx-dev` action MUST maintain AFX bidirectional traceability. Code changes without corresponding documentation updates violate the AFX standard.

### Required Updates

| Artifact             | When to Update                              |
| -------------------- | ------------------------------------------- |
| GitHub Session Log   | Always (date, task, action, files modified) |
| Task Checkboxes      | Always for task-based work                  |
| Discovered Issues    | If edge cases or issues found               |
| `@see` links in code | Always for new code                         |

### When to Update by Action

| Action     | Session Log | Task Checkbox | Discovered Issues |
| ---------- | ----------- | ------------- | ----------------- |
| `code`     | Always      | Always        | If found          |
| `debug`    | Always      | N/A           | Always            |
| `refactor` | Always      | If task-based | If found          |
| `review`   | N/A         | N/A           | Always            |
| `test`     | Always      | If task-based | If found          |
| `optimize` | Always      | If task-based | If found          |

### Context Resumption

These artifacts serve as your "save game" - enabling any agent to resume exactly where you left off after disconnect.

**CRITICAL**: If you don't update these artifacts, the next agent will waste time re-discovering context.

### References

- [Traceability & Annotation Standard](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md#traceability--annotation-standard) - `@see` format and rules
- [AFX Manual](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md) - Full AFX documentation
- [Agent Resumption Workflow](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md#agent-resumption-workflow) - How to resume after disconnect
- [GitHub Ticket Template](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md#github-ticket-template) - Session Log format
- [Session Log Format](https://github.com/AgenticFlowX/afx/blob/main/docs/agenticflowx/agenticflowx.md#session-log-format) - Entry format

---

## Subcommands

---

## 1. debug

Debug issues while maintaining traceability to requirements.

### Usage

```bash
/afx-dev debug [error-description]
```

### Context

- **Error**: $ARGUMENTS
- **Role**: Debug Coordinator

### Process

1. **Trace Error**:
   - UI → Action → Service → DB.
   - Identify where the break is.

2. **Check Spec**:
   - Is the code doing what `design.md` says?
   - Is `design.md` wrong? or Code wrong?

3. **Fix**:
   - IF code wrong: Fix code to match spec.
   - IF spec wrong: Update spec (via `/afx-check links` or manual), then fix code.

4. **Verify**:
   - Run `/afx-check path`.

### Output

- **Root Cause**: Explanation of what went wrong.
- **Fix**: Code changes made.
- **Spec Update**: If required.

### Debug Checklist

```markdown
## Debug Report: {error}

### Error Location

- Layer: {UI/Action/Service/Repository/DB}
- File: {path}
- Line: {number}

### Root Cause

{Explanation}

### Spec Alignment

- Design says: {what design.md specifies}
- Code does: {what code actually does}
- Verdict: {Code wrong / Spec wrong / Both}

### Fix Applied

- {Description of fix}
- Files modified: {list}

### Verification

- [ ] `/afx-check path` passes
- [ ] Tests pass
- [ ] Build succeeds
- [ ] **Traceability**: Session Log updated, Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify the fix
```

---

## 2. refactor

Refactor code while preserving spec alignment.

### Usage

```bash
/afx-dev refactor [scope]
```

### Process

1. **Baseline**: Ensure current code matches `design.md`.

2. **Plan**: Propose structure changes.

3. **Check Spec Impact**:
   - Does this change the Design?
   - IF YES: Update `design.md` FIRST. **(OVERWRITE the old state. DO NOT append history. Log the _reason_ for the change in `journal.md`.)**

4. **Execute**: Refactor code.

5. **Update Links**: Ensure `@see` links point to new/correct sections.

### Refactor Rules

1. **Spec-First**: If refactoring changes architecture, update design.md before code. Always overwrite rather than appending history.
2. **Journal History**: Document _why_ the refactor was needed and what alternatives were considered in `journal.md`.
3. **Link Preservation**: All `@see` links must remain valid after refactoring.
4. **No Behavior Change**: Unless explicitly requested, refactoring should not change behavior.

### Output

```markdown
## Refactor Report: {scope}

### Changes Made

- {Change 1}
- {Change 2}

### Spec Impact

- design.md updated: Yes/No
- New sections added: {list}

### Links Updated

- {old-link} → {new-link}

### Verification

- [ ] All @see links valid
- [ ] Tests pass
- [ ] Build succeeds
- [ ] **Traceability**: Session Log updated (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify refactored code
```

---

## 3. review

Review code for AFX compliance (traceability, patterns) and functionality.

### Usage

```bash
/afx-dev review [scope]
```

### Context

- **Scope**: $ARGUMENTS (file, path, or PR)

### Process

1. **Traceability Check**:
   - Do exported functions have `@see` links?
   - Do annotations (TODO/FIXME) have `@see` links?

2. **Alignment Check**:
   - Does implementation match `design.md` patterns?

3. **Safety Check**:
   - Any `setTimeout` or mocks?
   - Any swallowed errors?

4. **Verification**:
   - Run `/afx-check path` on the scope.

### Output

```markdown
## Code Review: {scope}

### Traceability

| Item                | Status    | Issue     |
| ------------------- | --------- | --------- |
| @see on exports     | Pass/Fail | {details} |
| @see on annotations | Pass/Fail | {details} |

### Spec Alignment

| Pattern   | Expected         | Actual    | Status         |
| --------- | ---------------- | --------- | -------------- |
| {pattern} | {from design.md} | {in code} | Match/Mismatch |

### Safety

| Check               | Status    | Location    |
| ------------------- | --------- | ----------- |
| No setTimeout mocks | Pass/Fail | {file:line} |
| No swallowed errors | Pass/Fail | {file:line} |

### Recommendations

1. {Recommendation 1}
2. {Recommendation 2}

### Verdict

- **Compliance Score**: {X}/10
- **Ready for merge**: Yes/No
- **Traceability**: Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-dev code # Address the recommendations (if any)
```

Or if ready:

```
Next: /afx-task pick docs/specs/{feature}   # Proceed to next task
```

---

## 4. test

Generate or run tests based on spec requirements.

### Usage

```bash
/afx-dev test [scope]
```

### Context

- **Scope**: $ARGUMENTS

### Process

1. **Identify Requirements**: Read `spec.md` and `design.md` for the scope.

2. **Check Coverage**: Compare existing tests vs requirements.

3. **Generate/Run**:
   - `npx nx test [scope]`
   - Create new tests for missing scenarios.

4. **Link**: Ensure test descriptions reference spec scenarios if possible.

### Test Generation Rules

1. **Spec-Driven**: Tests should cover scenarios from `spec.md` acceptance criteria.
2. **Layer Coverage**: Unit tests for repository/service, integration for actions.
3. **Mock Boundaries**: Mock at repository layer for service tests, mock at service for action tests.

### Output

````markdown
## Test Report: {scope}

### Coverage Analysis

| Requirement        | Test Exists | Status  |
| ------------------ | ----------- | ------- |
| FR-1: Create claim | Yes         | Passing |
| FR-2: Upload photo | No          | Missing |

### Tests Run

```bash
npx nx test {package}
```

Results: {X} passed, {Y} failed, {Z} skipped

### Tests Generated

- `{test-file}.test.ts` - {description}

### Recommendations

1. Add test for {missing scenario}
2. Fix failing test: {test name}

### Traceability

- [ ] Session Log updated
- [ ] Task checkbox marked (if task-based)
- [ ] Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify after tests pass

```

Or if tests fail:

```

Next: /afx-dev debug # Investigate test failures
````

---

## 5. optimize

Optimize performance based on constraints.

### Usage

```bash
/afx-dev optimize [target]
```

### Process

1. **Identify Constraint**: Read `spec.md` (Requirements) or `research/*.md` (Decisions).

2. **Measure**: Profile current state.

3. **Optimize**: Improve code.

4. **Document**: If new patterns emerge, record in `research/` or `design.md`.

5. **Link**: Add `@see` to optimization research or relevant design section.

### Optimization Rules

1. **Measure First**: Always profile before optimizing.
2. **Document Decisions**: Record optimization decisions in `research/` if significant.
3. **Avoid Premature**: Only optimize what's measurably slow.

### Output

````markdown
## Optimization Report: {target}

### Baseline Measurement

- Metric: {what was measured}
- Before: {value}

### Changes Made

- {Change 1}: {expected impact}
- {Change 2}: {expected impact}

### Results

- After: {value}
- Improvement: {X}%

### Documentation

- [ ] Added to design.md: {section}
- [ ] Created research doc: {path}

### @see Links Added

```typescript
// OPTIMIZE: Query batching for claim list
// @see docs/specs/user-auth/research/performance-tuning.md
```

### Traceability

- [ ] Session Log updated
- [ ] Task checkbox marked (if task-based)
- [ ] Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify optimization
````

---

## Related Commands

| Command        | Relationship                                                   |
| -------------- | -------------------------------------------------------------- |
| `/afx-task`    | Owns task lifecycle and coding; `/afx-dev` handles diagnostics |
| `/afx-check`   | Quality gates to run after dev work                            |
| `/afx-session` | Capture discussions about implementation                       |

```

```
