---
name: afx-dash
description: AFX Dash — low-ceremony structured work between ad-hoc chat and a full Sprint. Use for surgical coding, known-scope bug fixes, focused refactors, small UI/API adjustments, bounded config/dependency work, test improvements, and local performance fixes. Triggers on "keep it simple", "give this a little structure before coding", "create purpose and tasks then implement", "something above a plan but not a full spec", or "make an AFX dash for this".
license: MIT
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,dash,surgical,bugfix,refactor,lightweight"
  afx-argument-hint: "new | refine | code | verify | graduate"
---

# afx-dash — Low-Ceremony Structured Work

## Trigger & Purpose

AFX Dash is the lightest durable rung on the workflow ladder:

```text
Chat → Dash → Sprint → Full SDD
```

Apply only as much structure as the change earns. A Dash is a durable **Purpose + Tasks** record for work that does not yet justify explicit requirements/design artifacts. It is not a partial spec and not lower quality — it is the right shape for bounded, well-understood work.

## Ownership & Mutation Boundary

- **Owns:** the Dash document at `docs/specs/<feature>/<feature>.md` (`type: DASH`) and its graduation.
- **Delegates:** `code` and `verify` call shared `/afx-task` execution/verification mechanics — this skill does not implement a second execution engine.
- **Mutation class:** `docs-write` for `new`/`refine`/`graduate`; delegated `code-write` for `code`.
- Never silently graduates; never invents spec/design approval.

## Context Resolution Order

1. The named Dash under `docs/specs/<name>/<name>.md`, if it exists.
2. Otherwise the active feature in context.
3. The free-form `[context]` argument (see below).

## Non-Negotiable Invariants

- A Dash frontmatter carries no `status` and no `version`; progress is derived from task/evidence state.
- Task groups use stable `### N.N` WBS IDs compatible with Sprint/full tasks.
- Work Sessions are append-only, always the final section, and use the exact shared six-column schema: `Date | Task | Action | Files Modified | Agent | Human`.
- Re-evaluate complexity after every action (see Escalation).

## Subcommand Routing

| Command | Purpose | Reference |
| ------- | ------- | --------- |
| `new <name> [context]` | Create a Dash (Purpose + Tasks) from the template | `references/new.md` |
| `refine [name] [context]` | Adjust Purpose/Tasks | `references/refine.md` |
| `code [name] [task-id] [context]` | Implement a task via shared `/afx-task code` | `references/code.md` |
| `verify [name\|task-id]` | Verify a task via shared `/afx-task verify` | `references/verify.md` |
| `graduate [name] --to sprint\|full` | Losslessly expand to Sprint or Full SDD | `references/graduate.md` |

Read the matching reference only when running that subcommand.

## Context Argument

Every command accepts a free-form `[context]` — the user's description, a pasted error, a file path, a link, or constraints. `new`/`refine` fold it into Purpose and initial Tasks; `code`/`verify` pass it to the shared `/afx-task` operation. Context is always captured into the artifact (Purpose/Tasks/Work Sessions), never discarded.

After a Dash is active, accept short contextual replies instead of re-typed commands: `start the first task`, `verify it`, `add an accessibility task`, `show evidence`, `move this to sprint`.

## Canonical Dash Template

A Dash is deliberately light — two authored sections plus one generated section. Copy `assets/dash-template.md`:

```markdown
---
afx: true
type: DASH
owner: "@handle"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["feature"]
---

# Feature or Fix Name

## Purpose

State the observed/current situation, intended outcome, and bounded scope.
Bugs may use Observed / Expected / Scope / Evidence labels.

## Tasks

### 1.1 First Task Group

<!-- files: path/to/file.ts -->

- [ ] Reproduce or establish the baseline
- [ ] Implement the bounded change
- [ ] Verify the expected result and regression boundary

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in the Dash. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
```

Frontmatter timestamps use ISO-8601 millisecond precision; Work Sessions use `YYYY-MM-DD` date-only values — see `../afx-help/references/timestamp-rule.md`.
Use `../afx-help/references/query-helper.md` for targeted Purpose/task/status reads when available; absence falls back without blocking the Dash.

## Suitability

A Dash fits when all or nearly all are true: Purpose fits one concise section; expected outcome is understood; one coherent result; no unresolved product decision; no new architecture; bounded impact/rollback; verification expressible as task criteria.

- Unknown root cause → route to **Explore** first, then Dash once understood.
- Explicit requirements/design implications → **Sprint**.
- High-impact, collaborative, or long-running → **Full SDD**.

## Mandatory Complexity Escalation

After every `new`, `refine`, `code`, `verify` — and whenever implementation discovers new scope — re-evaluate. Do not wait for the user to notice the Dash has outgrown its shape. Detail in `references/escalation.md`.

Recommend **Sprint** when: product behavior is ambiguous/contested; more than one architectural choice; multiple components/packages couple; task groups split into independent workstreams; new requirements/non-goals/rollout concerns need durable treatment; the task list no longer explains one Purpose.

Recommend **Full SDD** when: auth/security-boundary changes; destructive/high-risk data migration; public API/protocol/schema changes with multiple consumers; cross-team/repo coordination; multiple staged approvals; long-running independently-reviewed work.

Escalation is advisory and explicit:

```text
This Dash now affects authentication, persistence, and 11 files.
Recommended: Graduate to AFX Sprint.
Why: the work crossed two architecture boundaries and needs durable design choices.

Reply: "graduate" · "keep as dash" · "explain"
```

Rules: explain concrete signals + destination; never silently graduate; do not re-ask after `keep as dash` unless a new signal appears; **block** continued Dash coding only when a declared hard safety boundary (auth/security, unauthorized architecture, destructive migration) would otherwise be crossed — if blocked, preserve the Dash unchanged and offer the exact graduation action.

## Graduation

Detail in `references/graduate.md`. Graduation runs as a guarded operation: dry-run diff → atomic write → reparse → invariant checks. Undo is git in the pure-skill path.

- **Dash → Sprint:** expand the same `<feature>.md` from `type: DASH` to `type: SPRINT`. Purpose seeds Sprint problem/scope; task IDs, file scopes, dependencies, checkboxes, and Work Sessions unchanged; missing requirements/design become explicit Draft placeholders; record the reason.
- **Dash → Full:** create `spec.md`/`design.md`/`tasks.md`/`journal.md`; Purpose seeds spec; Tasks + Work Sessions move to `tasks.md` with IDs/evidence preserved; spec/design start Draft; retarget `@see` paths to `tasks.md` preserving node IDs; record graduation in `journal.md`. The original Dash must not remain a competing source of truth.

## Result & Next-Action Contract

```text
Outcome: PASS | BLOCKED | CHANGED | NO-CHANGE
Evidence: <short concrete evidence>
Warnings: <only when present>

Next step: <one primary action>
Why: <one line>
Run: <resolved command>
```

Emit one primary action; add a remediation action only when blocked.
