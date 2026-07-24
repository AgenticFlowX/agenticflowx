---
name: afx-check
description: Quality gates and compliance — trace execution paths, audit annotations, verify cross-references, and run all checks against spec requirements
license: MIT
allowed-tools: Read Grep Glob Bash
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,check,quality,compliance,traceability"
  afx-argument-hint: "path | trace | links | schema | deps | coverage | all"
---

# /afx-check

Quality verification and compliance checking for AgenticFlowX. `/afx-check` is a read-only verification and compliance gate: it verifies implementation paths, traceability, links, schemas, dependencies, and coverage. It does not refine living docs or fix code.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)

If neither file exists, use defaults.

For targeted artifact reads, follow `../afx-help/references/query-helper.md`; the helper is optional and its absence never blocks verification.

## Ownership & Mutation Boundary

`/afx-check` is strictly **read-only**. Use `/afx-spec refine`, `/afx-design refine`, or `/afx-task refine` for document changes; use `/afx-task code` or `/afx-dev` for implementation fixes.

### Allowed

- Read/list/search files anywhere in workspace
- Trace execution paths, audit annotations, verify cross-references

### Forbidden

- Create/modify/delete any files (this skill is strictly read-only)
- Run build/test/deploy/migration commands

If fixes are requested, respond with:

```text
Out of scope for /afx-check (read-only audit mode). Use /afx-task code to fix issues found.
```

## Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature and check path from the active file (e.g., `src/features/user-auth/auth.service.ts` → check `user-auth` path). If code is selected, use it to narrow the verification scope.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Require explicit path — checks need a concrete target.
3. **Trailing parameters (`[...context]`):** Treat extra words as focus constraints (e.g., `/afx-check path user-auth api only` → trace just the API boundaries). Extract the base path/target, then apply context as a constraint on the analysis.

## Non-Negotiable Invariants

- **Gate 1 (`path`) is BLOCKING.** Run `/afx-check path` before marking any submission/form feature complete, checking off UI subtasks, closing a user-facing ticket, or running other gates (TypeScript, tests, build). If it fails, do NOT proceed with other gates.
- **Read-only always.** No file is created, modified, or deleted; no build/test/deploy/migration commands run.
- Timestamps in any report follow `../afx-help/references/timestamp-rule.md`.

## Subcommand Routing

Read the matching reference only when running that subcommand.

| Command | Purpose | Reference |
| ------- | ------- | --------- |
| `path <feature-path>` | Trace execution path UI → DB — **Gate 1 (BLOCKING)** | `references/path.md` |
| `trace [path]` | Audit `@see` annotations for PRD compliance | `references/trace.md` |
| `links <spec-path>` | Verify cross-references between spec artifacts | `references/links.md` |
| `schema <spec-path>` | Verify database schema consistency in design.md | `references/schema.md` |
| `deps [feature]` | Build and validate dependency graph from `depends_on` | `references/deps.md` |
| `coverage <spec-path>` | Bidirectional spec-to-code coverage map | `references/coverage.md` |
| `all <feature-path>` | Run all checks in sequence | `references/all.md` |

## Result & Next-Action Contract

Since this is a read-only quality gate, no files are modified. After executing any check, you MUST:

1. Clearly state the **Pass/Fail** result of the verification.
2. If failures are found, provide exactly the file names and line numbers of the failure sites.
3. Suggest the remediation command to fix the issue.

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

### Surfacing Notable Findings

`/afx-check` is strictly read-only and never writes `journal.md` or any file. When it detects a high-impact context change — critical path failure, or missing traceability that reveals a design gap — surface it in the result and recommend `/afx-session note` so the user can capture it. Do not write the journal directly. See `../afx-help/references/proactive-capture.md`.

## Related Commands

| Command        | Relationship                                           |
| -------------- | ------------------------------------------------------ |
| `/afx-task`    | Task lifecycle; check verifies code and spec alignment |
| `/afx-design`  | Refine design after check reveals design gaps          |
| `/afx-spec`    | Refine spec after check reveals requirement gaps       |
| `/afx-session` | No direct integration                                  |
