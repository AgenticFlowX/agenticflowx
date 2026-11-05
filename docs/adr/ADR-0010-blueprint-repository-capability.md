---
afx: true
type: ADR
status: Proposed
owner: "@richard-sentino"
version: "1.0"
created_at: "2026-11-05T10:12:39.000Z"
updated_at: "2026-11-05T10:12:39.000Z"
tags: ["adr", "blueprint", "repository-model", "external-traceability", "progressive-disclosure"]
---

# ADR 0010: Blueprint as a portable repository capability

## Context

AFX users may need to understand, plan and trace work for a repository without adding private research, specifications, generated instructions or trace annotations to that repository. The code checkout, the durable repository understanding and the user's planning documents may be owned by different people, live in unrelated locations and move independently across branches, worktrees and machines.

A one-off research export does not solve this problem. The useful capability is an evolving, user-owned description of a repository that can be reopened, reviewed and reconciled with source changes over time. It must remain understandable outside VS Code, usable by the CLI and compatible agents, and optional for users who only want ordinary coding or AFX workflows.

Blueprint is still being evaluated through real project use. This ADR therefore remains Proposed while experience clarifies conversion, reconciliation and interaction details. Acceptance should record stable architectural boundaries; later incompatible decisions should supersede this ADR rather than silently rewriting those boundaries.

## Decision

1. Treat Blueprint as a long-lived, opt-in repository capability, not a one-time report and not a second AFX workspace.
2. Use a compact portable contract. A new Blueprint contains `blueprint.md` for human orientation and authoritative `blueprint.json` for the current model, external links, reviews, reconciliation state and retained evidence. Rebuildable projections are optional and non-authoritative.
3. Keep repository checkouts, the Blueprint root and AFX document roots separate. Portable files contain stable identities and relative references; machine-specific paths remain local bindings. A missing binding blocks only the affected operation and never falls back to the source checkout or Blueprint root.
4. Keep AFX specifications, Sprints, journals and ADRs as ordinary documents. Blueprint may link to them but does not create or own them unless the user explicitly invokes the corresponding workflow and chooses a document root.
5. Keep source traceability external by default. CodeLens and navigation may project Blueprint links without inserting `@see` annotations or generated configuration into the code repository. Existing inline references remain supported and retain their provenance.
6. Combine deterministic host logic with optional model-assisted investigation. Inventory, path containment, hashes, Git state, language symbols, identity validation and change reconciliation are local algorithms. A model may synthesize evidence-backed repository understanding only after an explicit inspection action, within visible limits, and without native tools or autonomous writes.
7. Use progressive disclosure. No Blueprint means no prompts or background model work. A healthy attachment is quiet. Relevant stale, ambiguous or missing state appears at the point of use. Inspection, conversion, relinking and durable writes remain deliberate actions with visible scope and cancellation.
8. Version the portable contract and convert side by side. Consumers may read supported older versions, but conversion must preserve the source, validate the candidate and provide recovery before publishing a new version. Unsupported future versions open read-only or fail explicitly.
9. Keep the canonical schemas, standalone validator and format policy in the AFX workflow distribution. Other consumers vendor byte-identical, digest-pinned copies and validate offline; they do not download schemas at runtime.
10. Separate navigation freshness, inferred understanding and verification evidence. A link that still resolves is not proof that behavior is correct, and model output is not Human acceptance.

## Rationale

The compact contract gives users something they can inspect, version and move without depending on editor storage or a hosted service. Explicit roots allow private planning against public or externally owned code. External links keep source contributions focused, while hybrid local and model-assisted analysis provides useful understanding without turning every edit into an AI operation.

Progressive disclosure matches the product goal: Blueprint should disappear when irrelevant and become precise when the user asks for help. Versioned, side-by-side evolution allows the feature to improve from real usage without risking authored data or binding every consumer to an editor-specific implementation.

## Consequences

- Blueprint consumers must preserve stable identities and implement explicit version handling, size limits, containment checks and recoverable writes.
- The extension must maintain local bindings and reconcile source movement without guessing ambiguous matches.
- Model-assisted inspection needs privacy disclosure, cancellation, evidence provenance and bounded cost; it cannot run on folder open or attach.
- CLI and agent workflows must carry explicit Blueprint, checkout and document-root context instead of assuming the first workspace folder.
- Some actions require an extra root or privacy choice. Those choices are intentional because guessing could write private material into a public repository.
- The portable schema cannot encode every editor-specific observation. Derived caches and symbol projections may be rebuilt and cleared independently.
- Real-project feedback may refine thresholds, copy and reconciliation heuristics while this ADR is Proposed. Changes to the architectural boundaries require review and, after acceptance, a superseding ADR.

## Alternatives Considered

- **One-off generated research report**: simpler to build, but it cannot retain accepted intent, external links, evidence or source evolution across sessions.
- **Store everything in VS Code workspace state**: quiet and convenient locally, but not portable, reviewable or usable by CLI and compatible agents.
- **Create a complete AFX workspace inside every source repository**: reuses existing layout conventions, but leaks private planning into externally owned repositories and creates adoption friction.
- **Require inline source annotations**: provides direct traceability, but changes code the user may not own and couples private planning to public commits.
- **Continuously maintain the model with background AI calls**: could appear automatic, but creates hidden cost, privacy and nondeterminism. Explicit bounded inspection is safer and easier to trust.
- **Use only deterministic parsing**: useful for inventory and change detection, but insufficient for explaining architectural intent and cross-file flows in unfamiliar repositories. The selected hybrid keeps deterministic evidence and makes synthesis optional.
