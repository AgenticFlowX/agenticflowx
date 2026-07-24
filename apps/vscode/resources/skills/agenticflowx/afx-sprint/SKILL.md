---
name: afx-sprint
description: Single-document SDD for fast, surgical feature work — carries spec + design + tasks in one file, graduates to 4-file when scope grows
license: MIT
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,sprint,fast,prototype,single-doc,spec,design,task"
  afx-argument-hint: "new | refine | spec | design | task | code | verify | graduate"
---

# /afx-sprint

## Trigger & Purpose

Single-document spec-driven development for fast, surgical feature work. One file. Three sections. Full AFX traceability.

Instead of the standard 4-file flow (`spec.md` → `design.md` → `tasks.md` → `journal.md`), `/afx-sprint` produces **one unified `{feature}.md`** carrying Spec + Design + Tasks — plus a companion `journal.md` so session continuity still works. When scope outgrows the single doc, `/afx-sprint graduate` splits it into the standard 4-file structure with FR/DES/task IDs preserved and `@see` paths retargeted to the canonical split-doc files.

**When to use**: small projects, surgical changes, fast prototyping, solo features with tight scope.
**When NOT to use**: large cross-cutting features, multi-team work, anything that needs formal approval gates at each artifact boundary — use the full `/afx-spec → /afx-design → /afx-task` flow instead.

Compress the full SDD discipline into a single document without losing traceability: the same FR/DES anchors, the same `@see` linking rules, the same two-stage Agent + Human verification — just in one file. The single doc is a **tactical unit** that graduates into the strategic 4-file structure once scope is proven.

## Ownership & Mutation Boundary

- **Owns:** the sprint brief `docs/specs/<feature>/<feature>.md` (`type: SPRINT`) and the companion append-only `journal.md`.
- **Delegates:** `code` routes source edits to `/afx-task code` — this skill never modifies source directly (except `@see` path retargeting during `graduate`).
- **Graduation writes:** creates `spec.md`/`design.md`/`tasks.md` only during `graduate`, and archives (never deletes) the original.
- Never overwrites an existing `<feature>.md` without confirmation; never runs build/test/deploy/migration commands.

Full Allowed/Forbidden contract, timestamp discipline, proactive journal capture, and the post-action checklist are in `references/execution-contract.md`.

## Context Resolution Order

1. Explicit `<feature>` argument (kebab-case slug).
2. IDE active file path (e.g., `docs/specs/user-auth/user-auth.md` → `user-auth`).
3. Branch name (`feat/user-auth` → `user-auth`), then conversation history.
4. Fallback: prompt for the feature slug — never guess.
5. **Format detection:** prefer sprint format when `<feature>.md` is present; if only 4-file (`spec.md`) exists, redirect to `/afx-spec`/`/afx-design`/`/afx-task`.

Every subcommand also accepts trailing `[...context]` — natural-language intent parsed per subcommand. Detailed parsing and format-detection responses are in `references/execution-contract.md`.

For targeted section/task reads, follow `../afx-help/references/query-helper.md`; helper absence falls back to targeted search and then a broader read when needed.

## Non-Negotiable Invariants

- **Status model:** top-level `status` is `Draft → Approved → Superseded`. All three sections Approved sets `Approved`. Implementation does NOT promote to `Living` — an implemented sprint stays `Approved`. "Living documentation" is a principle, not a stored status.
- **Staged approval:** `approval.spec → approval.design → approval.tasks`, each gated on the previous. `code` requires all three Approved.
- **Re-approval demotes downstream:** editing an Approved section demotes it and every downstream section back to `Draft`; the user re-approves in order.
- **Graduation preserves evidence:** `graduate` keeps FR/DES/task IDs and Work Sessions verbatim, retargets `@see` paths to canonical split-doc files, and archives the original as `<feature>.md.archived`.
- **Stable anchors:** `[FR-X]`, `[NFR-X]`, `[DES-X]`, and task numbers `[X.Y]` are IDs used by code `@see` links — never renumber casually.

Full gate table, `approval` frontmatter block, usage surface, SDD vocabulary, and documentation principles are in `references/sprint-format.md`.

## Subcommand Routing

Derive the subcommand from the first token after `/afx-sprint`. Read the matching reference **only when running that subcommand**.

| Command | Purpose | Reference |
| ------- | ------- | --------- |
| `refine [feature] [spec\|design\|task] [...context]` | Dispatcher alias → routes to a section subcommand | `references/refine.md` |
| `new <feature> [...context]` | Scaffold `<feature>.md` + `journal.md` (single-doc) | `references/new.md` |
| `spec [feature] [--approve] [...context]` | Refine or approve the Spec section | `references/spec.md` |
| `design [feature] [--approve] [...context]` | Refine or approve the Design section (gated on Spec) | `references/design.md` |
| `task [feature] [--approve] [...context]` | Refine or approve the Tasks section (gated on Design) | `references/task.md` |
| `code [feature] [task-id] [...context]` | Implement — gated on all three Approved; delegates to `/afx-task code` | `references/code.md` |
| `verify [feature] [...context]` | Read-only pre-code sanity audit | `references/verify.md` |
| `graduate [feature] [...context]` | Split to 4-file when scope grows | `references/graduate.md` |

Cross-cutting rules — execution contract, timestamp format, proactive journal capture, post-action checklist, full context-resolution parsing, and the next-command table — live in `references/execution-contract.md`. Format, usage, approval gates, vocabulary, and related commands live in `references/sprint-format.md`. Timestamps use ISO-8601 millisecond precision — see `../afx-help/references/timestamp-rule.md`.

## Result & Next-Action Contract

After EVERY `/afx-sprint` action, report what changed and suggest the single most appropriate next command based on the current approval state (full mapping in `references/execution-contract.md` → Next Command Suggestion):

```text
Outcome: <what changed for <feature>>
Approval state: spec=<s>, design=<d>, tasks=<t>

Next: <one resolved /afx-sprint or /afx-check command>
Why: <one line>
```

**Host Rendering:** emit plain prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert the prose into clickable actions when concrete commands are present.
