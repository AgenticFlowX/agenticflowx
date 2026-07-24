# Lifecycle, Rules & Agent Instructions

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADRs live (default: `docs/adr`)
- `library.research` - Global research library path (default: `docs/research`)

If neither file exists, use defaults.

## Display Rule

> **Display Rule:** Don't dump full spec lists, status tables, phase breakdowns, or discussion logs into chat unless the user explicitly asks. The user can browse the files directly, or use a UI host such as the AgenticFlowX VS Code extension (Specs Tree, Pipeline Tab, Tasks Tab, Journal Tab) if installed. Focus skill output on agent reasoning, not raw display.

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve the living artifact content. In `/afx-spec`, this maps to `refine` (preferred alias), `discuss` (legacy-compatible), and targeted edits to `spec.md`.
- **Validate**: check structural, parser, template, frontmatter, and cross-reference correctness.
- **Review**: apply LLM judgment for quality, readiness, ambiguity, risk, and missing requirements.
- **Verify**: check implementation evidence against approved intent. This belongs to `/afx-task verify` and `/afx-check`, not `/afx-spec`.
- **Approve**: advance a lifecycle gate after validation and review.
- **Evolve**: handle post-ship feature, bug, or change work by refining living docs and capturing history in `journal.md` / `tasks.md`.

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
Out of scope for /afx-spec (specification-management mode). Use /afx-task code after spec approval.
```

## Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/references/proactive-capture.md).

**Triggers for `/afx-spec`**: Requirement deferred during review, spec gap identified, approval with conditions.

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): new FR/NFR added, FR/NFR moved to Non-Goals, Open Question resolved, missed requirement surfaced. After applying the edit, run the [Significance Check](../afx-session/references/proactive-capture.md) first — if the edit is cosmetic (typo, rewording, formatting) **skip silently**. Only call `/afx-session capture --trigger <new-fr|new-nfr|scope-cut|question-resolved|missed-req> --links <anchors>` when the change encodes a new decision, preserves institutional knowledge, or emerged from discussion. See [Prompt Capture Triggers](../afx-session/references/proactive-capture.md).

## Lifecycle Preconditions (BLOCKING)

**CRITICAL**: The spec lifecycle enforces a strict authoring sequence. Content authoring into downstream documents is **blocked** until upstream documents are approved.

### Document Authoring Gates

| Target Document | Precondition | Check                        |
| --------------- | ------------ | ---------------------------- |
| `spec.md`       | None         | Always allowed (entry point) |
| `journal.md`    | None         | Always allowed (session log) |

### Scaffold vs Content

- **Scaffold** (template placeholders created by `/afx-scaffold spec`): Always allowed. Empty template files are not content.
- **Content** (full technical design, task breakdowns, requirements): Gated behind approval.
- **journal.md**: Always writable — session capture is never gated.

### Approval Chain

```
spec.md (Draft → Approved)
  → /afx-design author unlocked
    → design.md (Draft → Approved)
      → /afx-task plan unlocked
```

## Documentation Principles

**CRITICAL RULE**: Maintain strict separation between State and Event/Log.

- **Living Documents (State)**: `spec.md` and `design.md` represent the _current factual state_ of the system. They must NOT contain historical backstory, abandoned ideas, or chronological narratives. Always overwrite them to reflect reality.
- **Historical Logs (Event)**: `journal.md` and `tasks.md` represent the _history_ of how the system evolved. All architectural decisions, failed experiments, and brainstorming belong in the append-only `journal.md`.
- **Post-Ship Evolution**: shipped specs remain living truth. New features, bug corrections, and behavior changes refine `spec.md` / `design.md` when current behavior changes, append rationale and production notes to `journal.md`, and track execution in `tasks.md`. Do NOT create amendment directories or new artifact types for ordinary evolution.

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

**Host Rendering:** Emit the plain `Next (ranked)` prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert the ranked prose into clickable actions.

### Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use the host's structured-choice capability when available (otherwise numbered text options) to present the options.

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
