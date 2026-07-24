---
name: afx-spec
description: "Spec management — validate structure, review quality, manage approval lifecycle for spec.md"
license: MIT
metadata:
  afx-owner: "@rix"
  afx-tags: "workflow,spec,requirements,validation,lifecycle"
  afx-argument-hint: "create | refine | discuss | validate | review | approve"
---

# /afx-spec

## Trigger & Purpose

Specification management, review, authoring, and approval for spec-centric workflows. Provides a spec-centric interface for managing specifications throughout their lifecycle. Focuses on operations that require agent reasoning — validation, gap analysis, quality review, content authoring, and approval workflows.

Route on the `afx-argument-hint` subcommands: `create | refine | discuss | validate | review | approve`. Read the matching reference (below) only when running that subcommand.

**SDD vocabulary, the display rule, execution contract, and config resolution** live in [references/lifecycle.md](references/lifecycle.md). `Refine` improves the living artifact; `validate` checks structure; `review` applies LLM quality judgment; `approve` advances a lifecycle gate. `Verify` belongs to `/afx-task verify` and `/afx-check`, not here.

## Ownership & Mutation Boundary

- **Owns:** `spec.md` (and its scaffolded siblings) under `docs/specs/<name>/`, plus linked ADRs in `docs/adr/**` and `.afx.yaml` feature registration.
- **Delegates:** implementation to `/afx-task code` (after approval); cross-reference link validation to `/afx-check links`; scaffolding of new dirs is done here via `create`.
- **Mutation class:** `docs-write` only. Never create/modify/delete source code, never delete spec folders/files, never run build/test/deploy/migration commands.
- **Never destructive-rewrite:** never replace the entire contents of an existing `spec.md`, `design.md`, or `journal.md`. Use targeted line-level replacements or appends to preserve human content.
- **Persistence checkpoint:** do not auto-write spec files. Present proposed content and wait for explicit confirmation before writing `spec.md`/`design.md`/`tasks.md`; `journal.md` append-only entries need no checkpoint.

If implementation is requested, return:

```text
Out of scope for /afx-spec (specification-management mode). Use /afx-task code after spec approval.
```

Full Execution Contract (Allowed/Forbidden), Persistence Checkpoint, and Trailing-Parameter handling: [references/lifecycle.md](references/lifecycle.md).

For targeted frontmatter/section reads, follow `../afx-help/references/query-helper.md`; broaden the read when fallback search cannot establish structural confidence.

## Context Resolution Order

When `<name>` is omitted or ambiguous, resolve in this order (full detail + per-subcommand inference table in [references/lifecycle.md](references/lifecycle.md)):

1. **Environment detection** — IDE context (`ide_opened_file` / `ide_selection` tags).
2. **IDE: Active file** — infer `[feature]` from the active file path; selected code is added context.
3. **CLI: Explicit args** — use a passed feature name directly.
4. **Conversation context** — recently discussed feature or prior `/afx-spec` commands.
5. **Branch name** — extract from `feat/{feature-name}`.
6. **Open GitHub issues** — if only one feature is active.
7. **`.afx.yaml` features list** — if only one feature is registered.
8. **Fallback** — prompt: "Which feature? Available: user-auth, shopping-cart, ..."

Trailing arguments (`/afx-spec refine user-auth api pagination`) are constraints for the command, folded into intent routing — never treated as invalid scopes.

## Non-Negotiable Invariants

- **Living-doc purity (present tense):** `spec.md` and `design.md` represent the _current factual state_ of the system. They must NOT contain historical backstory, abandoned ideas, or chronological narrative — that belongs in the append-only `journal.md`. Always overwrite living docs to reflect reality.
- **Approval binds to a revision:** approval runs automated validation + review; approval is BLOCKED while Critical issues remain. On approval, `status: Draft → Approved`, the spec is frozen, and `/afx-design author` unlocks. Human sign-off (`--reviewer`) requires the spec already `Approved`.
- **Edits to an approved spec return it to Draft and demote downstream:** modifying a `status: Approved` spec in a way that alters scope or requirements bumps `version` and reverts `status: Draft` to force re-approval; downstream documents (design → tasks) that were unlocked by the prior approval must be treated as demoted pending re-approval.
- **Lifecycle gating is blocking:** content authoring into downstream docs is blocked until upstream docs are approved (`spec.md → design.md → tasks.md`). Scaffold placeholders and `journal.md` session capture are never gated.
- **Structural strictness:** all 8 required `##` sections must be present; requirement tables use sequential, unique `FR-N`/`NFR-N` IDs with no gaps. See [references/template-format.md](references/template-format.md).
- **Timestamps:** ISO 8601 millisecond precision per `../afx-help/references/timestamp-rule.md`.

Full lifecycle preconditions, approval chain, documentation principles, Post-Action Checklist, Next-Command suggestions, and Interactive Lifecycle Actions: [references/lifecycle.md](references/lifecycle.md) and [references/template-format.md](references/template-format.md).

## Subcommand Routing

| Command | Purpose | Reference |
| ------- | ------- | --------- |
| `create <name>` | Initialize new spec directory with all artifacts (entry point) | [references/create.md](references/create.md) |
| `refine <name> [...context]` | Preferred alias for `discuss` — refine requirements via gap analysis | [references/discuss.md](references/discuss.md) |
| `discuss <name> [...context]` | Interactive gap analysis + journal capture | [references/discuss.md](references/discuss.md) |
| `validate <name>` | Deterministic structural compliance check (blocking for approval) | [references/validate.md](references/validate.md) |
| `review <name>` | Automated quality scoring (completeness, consistency, gaps, risk) | [references/review.md](references/review.md) |
| `approve <name> [--reviewer "@handle"]` | Lifecycle gate + optional human sign-off | [references/approve.md](references/approve.md) |

Read the matching reference **only** when running that subcommand. For requirement-table / FR-NFR grammar, the `spec.md` template rules, frontmatter schema, and the Post-Action Checklist, load [references/template-format.md](references/template-format.md). For error messages, related-command routing, and notes, load [references/errors.md](references/errors.md).

Unknown subcommand → see the Invalid Subcommand error in [references/errors.md](references/errors.md). For spec listing and status, browse `docs/specs/` directly or use a UI host such as the AgenticFlowX VS Code extension — do not dump full lists into chat.

## Result & Next-Action Contract

After EVERY `/afx-spec` action, suggest the most appropriate next command based on context, and — when a lifecycle gate is actionable — present structured choices (host buttons or numbered text) per [references/lifecycle.md](references/lifecycle.md).

```
Next (ranked):

1. /afx-spec refine docs/specs/{feature} # Context-driven: Iterate on spec
2. /afx-spec review {feature} # Context-driven: Review quality
3. /afx-spec approve {feature} # Context-driven: Approve if ready
   ──
4. /afx-task pick {feature} # Start implementation
5. /afx-session note "<note>" # Capture findings
```

**Host Rendering:** Emit the plain `Next (ranked)` prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert the ranked prose into clickable actions.

## Proactive Journal Capture

When this skill detects a high-impact context change (requirement deferred during review, spec gap identified, approval with conditions; new FR/NFR added, FR/NFR moved to Non-Goals, Open Question resolved, missed requirement surfaced), propose a capture per the [Proactive Capture Protocol](../afx-session/references/proactive-capture.md) after running the [Significance Check](../afx-session/references/proactive-capture.md). Cosmetic edits skip silently. Full trigger detail: [references/lifecycle.md](references/lifecycle.md).
