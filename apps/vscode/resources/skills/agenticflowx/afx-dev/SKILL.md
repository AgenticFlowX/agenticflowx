---
name: afx-dev
description: Advanced diagnostics — debug issues, refactor code, review against specs, run tests, and optimize performance
license: MIT
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,development,debug,refactor,review,test,optimize"
  afx-argument-hint: "debug | refactor | review | test | optimize"
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

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/references/proactive-capture.md).

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

Timestamps use ISO 8601 millisecond precision — see `../afx-help/references/timestamp-rule.md`.

---

## Bidirectional Traceability (MANDATORY)

**CRITICAL**: Every `/afx-dev` action MUST maintain AFX bidirectional traceability. Code changes without corresponding documentation updates violate the AFX standard.

### Required Updates

| Artifact             | When to Update                              |
| -------------------- | ------------------------------------------- |
| GitHub Session Log   | Always (date, task, action, files modified) |
| Completion Criteria  | Always for task-based work                  |
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

## Subcommand Routing

Each subcommand's full procedure, process steps, output templates, and examples live in its reference file. Load the matching reference only when running that subcommand.

| Subcommand         | Purpose                                                                    | Reference              |
| ------------------ | -------------------------------------------------------------------------- | ---------------------- |
| `debug [error]`    | Debug issues while maintaining traceability to requirements                | `references/debug.md`    |
| `refactor [scope]` | Refactor code while preserving spec alignment                              | `references/refactor.md` |
| `review [scope]`   | Review code for AFX compliance (traceability, patterns) and functionality  | `references/review.md`   |
| `test [scope]`     | Generate or run tests based on spec requirements                           | `references/test.md`     |
| `optimize [target]`| Optimize performance based on constraints                                  | `references/optimize.md` |

---

## Related Commands

| Command        | Relationship                                                   |
| -------------- | -------------------------------------------------------------- |
| `/afx-task`    | Owns task lifecycle and coding; `/afx-dev` handles diagnostics |
| `/afx-check`   | Quality gates to run after dev work                            |
| `/afx-session` | Capture discussions about implementation                       |
