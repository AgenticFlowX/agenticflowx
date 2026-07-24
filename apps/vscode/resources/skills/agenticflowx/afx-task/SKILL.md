---
name: afx-task
description: Implementation lifecycle — plan tasks, pick work, implement code, verify, complete, and sync with GitHub
license: MIT
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,task,implementation,coding,verification,lifecycle"
  afx-argument-hint: "plan | refine | pick | code | verify | complete | sync | summary | brief | review | validate | status"
---

# /afx-task

Implementation lifecycle engine for `tasks.md` artifacts and source code. Owns the full journey from task planning through coding to completion.

## Trigger & Purpose

Owns the `tasks.md` artifact AND the implementation engine. Owns coding with traceability, task state management, and GitHub sync. All spec-driven coding is tied to a task ID.

Usage cheat sheet, the Display Rule, SDD Vocabulary (CANONICAL), Documentation Principles, and the Related-Commands map live in `references/conventions.md`.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)

If neither file exists, use defaults.

## Context Resolution

When task ID alone is provided (e.g., `7.1`), resolve its task artifact in this order:

1. **Explicit artifact** — Use a named `tasks.md` or `type: DASH` file from the command/context.
2. **Environment detection** — Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
3. **IDE: Active file** — Infer `[feature]` from the active task artifact. A `type: DASH` `<feature>.md` is a valid task source alongside standard `tasks.md`. If code is selected, use it as additional implementation context.
4. **CLI: Explicit args** — If a feature name is passed alongside the task ID (e.g., `/afx-task code user-auth#7.1`), use it directly.
5. **Conversation context** — Recently discussed Dash/spec (file reads, GitHub issues, prior commands).
6. **Branch name** — Extract from `feat/{feature-name}` pattern.
7. **Open GitHub issues** — If only one feature has open issues.
8. **Fallback** — Require an explicit task artifact or `/afx-task verify user-auth#7.1`.

Trailing `[...context]` arguments are treated as explicit user constraints and can override this chain — see `references/agent-instructions.md`.

For targeted task-artifact reads, follow `../afx-help/references/query-helper.md`; helper absence never blocks Dash or standard task work.

## Ownership & Mutation Boundary

- Creates/updates `tasks.md` **only** in `docs/specs/**/`; creates/modifies source + test files via `code`; runs build/test/lint via `code`; runs `gh` for `sync`; appends captures to `journal.md`.
- **Never** creates/modifies/deletes `spec.md` (owned by `/afx-spec`) or `design.md` (owned by `/afx-design`); never deletes spec files/dirs; never runs deploy/migration without confirmation; never edits `.afx.yaml`/`.afx/`.
- **No destructive rewrites** — never full-file-rewrite an existing `tasks.md`, `journal.md`, or source file; use targeted line-level replacements or appends.
- **Hard Anchors** (auth/security, DB schema & migration, global state, external API contracts) MUST NOT change during `code` without a prior approved design update — STOP and escalate `/afx-design review {name}`.
- Full Allowed/Forbidden lists, the out-of-scope message, and the Hard Anchor rule: `references/execution-contract.md`.

## Non-Negotiable Invariants

- **Gate 1 (`/afx-check path`) is blocking** — a task cannot be closed without path verification tracing execution UI → DB. Static task-vs-spec verification (`verify`) is distinct from runtime path verification — see `references/verify.md`.
- **Two-stage verification** — every task needs Agent `[x]` AND Human `[x]` in the Work Sessions table before it is truly done.
- **Derived task progress, no stored status** — `tasks.md` carries NO stored lifecycle status; progress is **derived** Planned → In Progress → Complete from task groups + Work Sessions. Sign Off records Human verification evidence only and never promotes a `Living`/any status — see `references/signoff.md`.
- **Lifecycle gates** — `plan` requires `design.md` status == `Approved`; `code` requires either standard `tasks.md` or a `type: DASH` artifact containing the task. Dash execution has no spec/design approval prerequisite, but all Hard Anchor and escalation rules still apply. Preconditions + Post-Action Checklist: `references/lifecycle.md`.
- **Timestamps** use ISO-8601 millisecond precision — `../afx-help/references/timestamp-rule.md`. Frontmatter schema, canonical field order, and immutable fields: `references/frontmatter.md`.

## Subcommand Routing

Load the matching reference only when running that subcommand.

| Command | Purpose | Reference |
| ------- | ------- | --------- |
| `plan <name>` | Generate `tasks.md` from approved design (lifecycle-gated) | `references/plan.md` |
| `refine <name>` | Preferred alias for `plan`; draft or targeted-refine `tasks.md` | `references/refine.md` |
| `pick {id}` | Check out a task as active | `references/pick.md` |
| `code {id}` · `code all <name>` | Implementation engine — write code with `@see` traceability | `references/code.md` |
| `verify <task-id>` · `verify all <name>` | Static verification of a task vs spec | `references/verify.md` |
| `complete {id}` | Mark task done | `references/complete.md` |
| `sync [spec] [issue]` | Bidirectional GitHub sync | `references/sync.md` |
| `summary <task-id>` · `brief <task-id>` | Concise summary of what was built (`brief` retained as an alias) | `references/brief.md` |
| `review <name>` | Planning-gap analysis (advisory) | `references/review.md` |
| `validate <name>` | Structural + spec-coverage check of `tasks.md` | `references/validate.md` |
| `status <name>` | Phase completion overview | `references/status.md` |

Command syntax variants (`code all`, `verify <spec>#<task-id>`, `verify all`) are shown in `references/conventions.md`.

## Cross-Cutting Rules (load when acting)

| Topic | When to load | Reference |
| ----- | ------------ | --------- |
| Execution contract, Hard Anchors, out-of-scope message | Before any mutating action | `references/execution-contract.md` |
| Frontmatter schema, immutable fields, timestamps | Creating/modifying `tasks.md` | `references/frontmatter.md` |
| Lifecycle preconditions + Post-Action Checklist | Before `plan`/`code`; after any `tasks.md`/code change | `references/lifecycle.md` |
| Template Format Rules (CRITICAL) / WBS grammar | Generating or validating `tasks.md` structure | `references/task-format.md` |
| Proactive journal capture triggers | High-impact context change during any action | `references/journal-capture.md` |
| Sign Off mechanics (human finalization) | Closing the Work Sessions loop on `tasks.md` | `references/signoff.md` |
| Error messages | On any error condition | `references/errors.md` |

## Result & Next-Action Contract

After EVERY `/afx-task` action you MUST:

1. **Suggest the next command** — the context→next-command table is in `references/agent-instructions.md`.
2. **Present interactive lifecycle options** when a gate is actually actionable (preconditions met) — trigger conditions, questions, and options in `references/agent-instructions.md`. Always include "Not now"; never force the user.
3. **Honor the Persistence Checkpoint** — never auto-write `tasks.md` during `plan`; present proposed content and wait for confirmation (`references/agent-instructions.md`).

**Host Rendering:** Emit the plain next-command prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert concrete commands into clickable actions.
