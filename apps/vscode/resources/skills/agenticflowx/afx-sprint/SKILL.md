---
name: afx-sprint
description: Single-document SDD for fast, surgical feature work — carries spec + design + tasks in one file, graduates to 4-file when scope grows
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,sprint,fast,prototype,single-doc,spec,design,task"
  afx-argument-hint: "new | refine | spec | design | task | code | verify | graduate"
  modeSlugs:
    - focus-research
    - focus-code
    - architect
    - code
---

# /afx-sprint

Single-document spec-driven development for fast, surgical feature work.

One file. Three sections. Full AFX traceability.

Instead of the standard 4-file flow (`spec.md` → `design.md` → `tasks.md` → `journal.md`), `/afx-sprint` produces **one unified `{feature}.md`** carrying Spec + Design + Tasks — plus a companion `journal.md` so session continuity still works. When scope outgrows the single doc, `/afx-sprint graduate` splits it into the standard 4-file structure with FR/DES/task IDs preserved and `@see` paths retargeted to the canonical split-doc files.

**When to use**: small projects, surgical changes, fast prototyping, solo features with tight scope.
**When NOT to use**: large cross-cutting features, multi-team work, anything that needs formal approval gates at each artifact boundary — use the full `/afx-spec → /afx-design → /afx-task` flow instead.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` — where feature directories live (default: `docs/specs`)

If neither file exists, use defaults.

## Usage

Every subcommand accepts optional trailing **`[...context]`** — natural-language intent that supplements the command. Use it to pass refinement asks, focus hints, clarifications, or decisions directly on the command line rather than going through a prompt-reply loop.

```bash
/afx-sprint new <feature> [...context]                  # Scaffold; context seeds initial Spec content
/afx-sprint refine [feature] [spec|design|task] [...context] # Alias: refine inferred or explicit section
/afx-sprint spec [feature] [...context]                 # Refine Spec section with context as the ask
/afx-sprint spec [feature] --approve [...context]       # Approve Spec; context captured as approval note
/afx-sprint design [feature] [...context]               # Refine Design section (gated on spec Approved)
/afx-sprint design [feature] --approve [...context]     # Approve Design
/afx-sprint task [feature] [...context]                 # Refine Tasks section (gated on design Approved)
/afx-sprint task [feature] --approve [...context]       # Approve Tasks (unlocks code)
/afx-sprint code [feature] [task-id] [...context]       # Implement — gated on all three Approved; delegates to /afx-task code
/afx-sprint verify [feature] [...context]               # Sanity-check; context narrows focus (e.g., "only anchors")
/afx-sprint graduate [feature] [...context]             # Split to 4-file; context captured in graduation journal entry
```

`<feature>` is a kebab-case slug. When omitted, feature is inferred from IDE active file, branch, or cwd.

**Trailing context examples:**

```bash
/afx-sprint spec dark-mode tighten FR-2 to specify keyboard shortcut
/afx-sprint refine dark-mode spec tighten FR-2 to specify keyboard shortcut
/afx-sprint design dark-mode "use CSS variables, not data attributes — faster paint"
/afx-sprint task dark-mode cover [DES-TOKENS] with a dedicated phase
/afx-sprint code dark-mode 3.1 start with the theme provider, skip persistence for now
/afx-sprint verify dark-mode --focus anchors
```

## Approval Gates

Sprint preserves AFX's staged-approval discipline in a single file via the `approval` block in frontmatter:

```yaml
approval:
  spec: Draft # or Approved
  design: Draft # gated on spec: Approved
  tasks: Draft # gated on design: Approved
```

**Gate rules** (enforced by subcommands):

| Subcommand | Prerequisite                                                  | Effect of `--approve` flag         |
| ---------- | ------------------------------------------------------------- | ---------------------------------- |
| `spec`     | none                                                          | `approval.spec` → `Approved`       |
| `design`   | `approval.spec == Approved`                                   | `approval.design` → `Approved`     |
| `task`     | `approval.spec == Approved` AND `approval.design == Approved` | `approval.tasks` → `Approved`      |
| `code`     | all three `Approved`                                          | n/a (implementation, not approval) |
| `graduate` | all three `Approved` AND `/afx-sprint verify` passes          | n/a (splits to 4-file)             |

Top-level `status` in frontmatter reflects the overall sprint state:

- `Draft` — any section still Draft
- `Approved` — all three sections Approved (set automatically when the `task --approve` transition completes the trio)
- `Living` — post-implementation, maintained as living documentation

Re-approval after edits: if a section is edited _after_ being Approved, the subcommand demotes it back to `Draft` and demotes any downstream sections (e.g., editing an approved Spec demotes Design and Tasks to Draft). The user must re-approve in order. This enforces the same discipline as the 4-file flow where changing `spec.md` invalidates downstream artifacts.

## Purpose

Compress the full SDD discipline into a single document without losing traceability. The same FR/DES anchors, the same `@see` linking rules, the same two-stage Agent + Human verification — just in one file instead of three. When the work is surgical, one file is faster to write, read, and keep coherent.

The skill treats the single doc as a **tactical unit** that can graduate into the strategic 4-file structure once scope is proven. Until then, ceremony is minimal.

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve living artifact content. In `/afx-sprint`, this maps to `refine` (dispatcher alias) plus `spec`, `design`, and `task` section edits.
- **Validate**: check structural, parser, template, frontmatter, anchor, and approval-state correctness.
- **Review**: apply LLM judgment for quality, readiness, ambiguity, risk, and missing coverage.
- **Verify**: check implementation or sprint readiness evidence against approved intent. `/afx-sprint verify` is the pre-code sanity check; `/afx-task verify` handles task implementation evidence.
- **Approve**: advance a section gate in order: Spec -> Design -> Tasks.
- **Evolve**: handle post-ship feature, bug, or change work by refining the living sprint doc or graduating when scope grows, while capturing history in `journal.md` and Work Sessions.

## Documentation Principles

- Sprint format is living state while active: the Spec, Design, and Tasks sections represent current truth for small work.
- `journal.md` captures decisions, amendments, production notes, and change rationale.
- Work Sessions capture execution history.
- Do not introduce amendment directories or new artifact types for ordinary feature evolution; refine the sprint doc or graduate to the 4-file flow when the work outgrows single-doc SDD.

---

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/modify markdown files in `docs/specs/<feature>/`:
  - `<feature>.md` (the sprint brief — this skill owns it)
  - `journal.md` (append-only; scaffold only if missing)
- Delegate code implementation to `/afx-task code` — that skill owns source edits
- During `graduate`, rewrite existing source-code `@see` paths that still point at `docs/specs/<feature>/<feature>.md`
- Delegate graduation file writes (spec.md/design.md/tasks.md) only during `graduate`

### Forbidden

- Create/modify source code directly (always route through `/afx-task code`, except `@see` path retargeting during `graduate`)
- Overwrite existing `<feature>.md` without user confirmation
- Delete any files
- Modify `<feature>.md` outside `docs/specs/<feature>/` (single-doc always lives inside its feature folder)
- Run build/test/deploy/migration commands

If implementation is requested directly, respond with:

```text
/afx-sprint delegates implementation to /afx-task code.
Run: /afx-sprint code <feature> [...context]
```

### Timestamp Format (MANDATORY)

Frontmatter fields (`created_at`, `updated_at`) and journal captures MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2026-04-18T11:36:11.000Z`). Work Sessions rows stay `YYYY-MM-DD` to match `tasks.md` and `/afx-task`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-sprint`**: scope decision during `spec`, architecture choice during `design`, graduation decision.

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): new FR/NFR added (Section 1), new `[DES-X]` section added (Section 2), missed requirement surfaced mid-conversation, approval demotion after a meaningful edit. After applying the sprint edit, run the [Significance Check](../afx-session/SKILL.md#significance-check-context-aware-gate) first — skip silently for cosmetic edits (the demotion-to-Draft logic is orthogonal; Draft demotion can happen without a capture). Only call `/afx-session capture --trigger <kind> --links <anchors>` when the change encodes a real decision or discovery. See [Prompt Capture Triggers](../afx-session/SKILL.md#prompt-capture-triggers-propose--confirm).

## Post-Action Checklist (MANDATORY)

After any `/afx-sprint` action that writes to `<feature>.md`, you MUST:

1. **Update `updated_at`** in frontmatter to the current ISO 8601 timestamp.
2. **Preserve frontmatter field order**: `afx → type → status → owner → version → created_at → updated_at → tags → approval`.
3. **Preserve section anchors**: `[FR-X]`, `[NFR-X]`, `[DES-X]`, and task numbers `[X.Y]` are stable IDs used by code `@see` links — never renumber casually.
4. **Append, don't rewrite**: during `spec`/`design`/`task` refinement, edit targeted sections only. Never regenerate the whole file unless the user explicitly asks.
5. **Verify structural integrity**: after edits, confirm all three sections (Spec, Plan, Tasks) still exist and the Work Sessions table is intact.
6. **Keep `@see` paths canonical**: while sprint format is active, task-group comments and generated source-code annotations should use `docs/specs/<feature>/<feature>.md`, not `./<feature>.md`.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection**: check for `ide_opened_file` / `ide_selection` tags in conversation.
2. **Feature inference**:
   - **IDE**: infer from active file path (e.g., `docs/specs/user-auth/user-auth.md` → `user-auth`).
   - **CLI**: explicit argument → branch name (`feat/user-auth` → `user-auth`) → conversation history.
   - **Fallback**: prompt for feature slug. Never guess.
3. **Trailing context (`[...context]`)**: every subcommand accepts natural-language intent after the positional arguments. Parse it as:
   - **Refinement instruction** for `spec`/`design`/`task` — treat as the change the user wants (e.g., `tighten FR-2`, `add a rate-limit risk`, `cover [DES-TOKENS]`).
   - **Refine dispatcher** for `refine` — if the trailing text names `spec`, `design`, or `task`, route to that section subcommand. If no section is named, infer from the active sprint section; if still unknown, route to the first Draft section in approval order (Spec → Design → Tasks).
   - **Implementation hint** for `code` — forward verbatim to `/afx-task code` as its instruction (e.g., `start with the provider, skip persistence`).
   - **Focus constraint** for `verify` — narrow the audit (e.g., `--focus anchors`, `only approval gates`).
   - **Approval note** for `--approve` variants — capture the phrase as the journal entry's rationale (e.g., `after PM review`, `rev 2 post-security audit`).
   - **Initial seed** for `new` — use as hints when pre-filling the Spec section's Problem Statement / FR rows.
   - **Graduation note** for `graduate` — capture in the journal entry explaining why the split happened (e.g., `scope grew — mobile added`).

   If trailing context is absent, fall back to the subcommand's default interactive flow.

4. **Format detection**: before operating, check whether the feature uses sprint format (`<feature>.md` present) or standard 4-file format (`spec.md` present). If both are present, prefer sprint format for `/afx-sprint` commands. If only 4-file exists and user runs `/afx-sprint refine|spec|design|task`, respond:

   ```text
   This feature uses the standard 4-file format (spec.md/design.md/tasks.md).
   Use /afx-spec, /afx-design, /afx-task instead. Or run `/afx-sprint new <new-feature>` for a new sprint.
   ```

### Next Command Suggestion (MANDATORY)

After EVERY `/afx-sprint` action, suggest the most appropriate next command based on the current approval state:

| Context                             | Suggested Next Command                                   |
| ----------------------------------- | -------------------------------------------------------- |
| After `new`                         | `/afx-sprint spec <feature>` — fill the Spec section     |
| After `refine`                      | Next command follows the routed section state            |
| After `spec` refine (still Draft)   | `/afx-sprint spec <feature> --approve` (when ready)      |
| After `spec --approve`              | `/afx-sprint design <feature>` — start the Plan          |
| After `design` refine (still Draft) | `/afx-sprint design <feature> --approve` (when ready)    |
| After `design --approve`            | `/afx-sprint task <feature>` — break into tasks          |
| After `task` refine (still Draft)   | `/afx-sprint task <feature> --approve` (when ready)      |
| After `task --approve`              | `/afx-sprint verify <feature>` — final sanity-check      |
| After `verify` (pass)               | `/afx-sprint code <feature>` — start implementing        |
| After `verify` (fail)               | Fix reported gaps, then re-run `verify`                  |
| After `code`                        | `/afx-check path <feature-path>` — verify implementation |
| After `graduate`                    | `/afx-spec validate <feature>` — check split output      |

**UI Action Block (ADDITIVE):** Preserve the `Next (ranked)` or equivalent prose suggestion. When the next moves include concrete `/afx-*` commands with resolved sprint feature names or paths, also emit a marker-wrapped fenced JSON array immediately after the prose. Include at most three actions and omit non-command advice such as "Fix reported gaps" unless paired with a concrete command.

````markdown
<!-- AFX-UI-ACTIONS:START -->

```json
[
  {
    "rank": 1,
    "label": "Approve sprint spec",
    "command": "/afx-sprint spec onboarding --approve",
    "mode": "run",
    "reason": "The sprint Spec section is ready for its lifecycle gate.",
    "vocabulary": "Approve = advance a lifecycle gate."
  },
  {
    "rank": 2,
    "label": "Refine sprint design",
    "command": "/afx-sprint design onboarding",
    "mode": "insert",
    "reason": "Use after spec approval to shape the implementation plan.",
    "vocabulary": "Refine = improve living artifact content."
  }
]
```

<!-- AFX-UI-ACTIONS:END -->
````

---

## Subcommands

---

## 0. refine

Dispatcher alias for section refinement.

### Usage

```bash
/afx-sprint refine [feature] [spec|design|task] [...context]
```

### Routing

1. Locate the sprint doc using normal Context Resolution.
2. If the command includes an explicit section token (`spec`, `design`, or `task`), execute the matching section subcommand with the remaining trailing context.
3. If no section token is provided, infer from the active editor section (`afx.sprintSection`) when available.
4. If still unknown, route to the first Draft section in approval order:
   - `approval.spec == Draft` → `/afx-sprint spec`
   - else `approval.design == Draft` → `/afx-sprint design`
   - else `approval.tasks == Draft` → `/afx-sprint task`
   - else all sections are approved → ask for the section to refine, because refining an approved section may demote downstream approvals.
5. Use the routed subcommand's normal gate, checkpoint, demotion, journal, and next-command rules.

### Compatibility

`/afx-sprint spec`, `/afx-sprint design`, and `/afx-sprint task` remain canonical section commands. `/afx-sprint refine` is a user-facing alias for chat buttons and VS Code intent actions.

---

## 1. new

Scaffold a new sprint-format feature directory.

### Usage

```bash
/afx-sprint new <feature> [...context]
```

`<feature>` is kebab-case (e.g., `dark-mode-toggle`, `api-rate-limit`). Becomes the directory name **and** the filename: `docs/specs/<feature>/<feature>.md`. Optional trailing context seeds initial Problem Statement and early FR rows.

### Process

1. **Validate name**: must be kebab-case. Error if not.
2. **Check existence**: if `docs/specs/<feature>/` already exists, stop and prompt:

   ```text
   'docs/specs/<feature>/' already exists. Add a new sprint to it? [y/n]
   ```

   If yes and no conflicting `<feature>.md` inside, proceed. Otherwise stop.

3. **Get current timestamp**: run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"`.
4. **Read template** from `./assets/sprint-template.md` (this skill's own asset).
5. **Read journal template** from `../afx-session/assets/journal-template.md`.
6. **Substitute placeholders** in both:
   - `{Feature Name}` → Title-cased feature slug (`dark-mode-toggle` → `Dark Mode Toggle`)
   - `{feature}` → kebab-case slug
   - `{YYYY-MM-DDTHH:MM:SS.mmmZ}` → current timestamp
   - `@owner` → `@<git-user>` (from `git config user.name`, kebab-cased) or `@handle` fallback
7. **Apply trailing context** (if provided): use it to seed the Problem Statement (Section 1.1) and draft 1–3 candidate FRs in Section 1.3. Keep these as clearly-marked drafts (`{draft — refine with /afx-sprint spec}`) so the user knows to tighten them. If no context, leave placeholder text.
8. **Write files** using the Write tool:
   - `docs/specs/<feature>/<feature>.md`
   - `docs/specs/<feature>/journal.md` (only if not already present)
9. **Register feature** in `.afx.yaml` `features` list if that list exists.

### Output

```text
Sprint scaffolded:
  docs/specs/<feature>/<feature>.md   (Spec + Design + Tasks in one file)
  docs/specs/<feature>/journal.md      (session continuity)

Next: /afx-sprint spec <feature>   # Fill out the Spec section
```

### Error Handling

**Missing name:**

```text
Error: Feature name required.
Usage: /afx-sprint new <feature>
Example: /afx-sprint new dark-mode-toggle
```

**Invalid name format:**

```text
Error: Feature name must be kebab-case (lowercase with hyphens).
Example: /afx-sprint new my-feature
```

**Directory already has a sprint:**

```text
Error: 'docs/specs/<feature>/<feature>.md' already exists.
Use /afx-sprint spec <feature> to edit, or pick a different name.
```

---

## 2. spec

Refine the **Spec** section of `<feature>.md` (Problem, User Stories, FR/NFR, Acceptance, Non-Goals, Open Questions, Dependencies), or approve it.

### Usage

```bash
/afx-sprint spec [feature] [...context]   # Refine
/afx-sprint spec [feature] --approve          # Mark Spec section Approved
```

### Refinement Loop (when called without `--approve`)

1. **Locate file**: `docs/specs/<feature>/<feature>.md`. Error if missing.
2. **Read current Spec section** (`## 1. Spec` through the line before `## 2. Design`) using the Read tool.
3. **Understand the ask**:
   - If `[...context]` provided → treat as the refinement request.
   - If not → display the current section content and ask: _"What do you want to change? (add/remove/tighten a requirement, clarify acceptance, update a user story, …)"_
4. **Propose diff**: output a concrete diff preview showing exact `old_string` → `new_string` for each change. Format:

   ```diff
   Section 1.3 Functional Requirements:
   + | FR-3 | Rate-limit login attempts to 5/min  | Must Have   |
   ~ | FR-1 | {before}  →  {after}
   - | FR-4 | (removed, moved to Non-Goals)

   Section 1.5 Acceptance Criteria:
   + - [ ] Lockout after 5 failed attempts triggers 15-min cooldown
   ```

5. **Confirm with user**: _"Apply these changes? [y/n]"_. If no, iterate with follow-up instruction.
6. **Apply edits** using the **Edit tool** — one Edit call per targeted change, never Write. Preserve frontmatter field order and indentation.
7. **Maintain anchors**: existing `[FR-X]` / `[NFR-X]` IDs stay. New requirements get the next available ID. Removed requirements leave their ID retired (don't renumber — code `@see` links may still reference the ID during transition).
8. **Demote downstream approvals**: if `approval.spec` was `Approved` and the edit changes a requirement meaningfully, demote `approval.design` and `approval.tasks` back to `Draft` and report this in the output. Trivial edits (typo fixes, formatting) may skip the demotion — ask the user if unsure.
9. **Update `updated_at`** frontmatter to current ISO 8601 timestamp.
10. **Capture decision** to `journal.md` when the refinement changes scope (FR moved to Non-Goals, new NFR added, Open Question resolved). Use the Proactive Capture Protocol.

### Approval Path (when called with `--approve`)

1. **Locate file** and read current Spec section.
2. **Run mini-audit**: confirm at least one FR is present, Acceptance Criteria is non-empty, and no Open Question row is both unresolved (`Status != Resolved`) and marked `Blocking = Yes`.
3. **If audit fails**: stop and report gaps — don't approve a broken section.
4. **If audit passes**: Edit frontmatter `approval.spec` from `Draft` to `Approved`. Update `updated_at`.
5. **Capture** approval event to `journal.md`.

### Output (refinement)

```text
Spec section updated for <feature>.
Changes:
  + FR-3: rate-limit login attempts
  ~ FR-1: tightened acceptance criteria
  - FR-4: moved to Non-Goals

Approval demoted: design Draft, tasks Draft (spec changed meaningfully)

Next: /afx-sprint spec <feature> --approve   # When Spec is ready for design
```

### Output (approval)

```text
Spec section approved for <feature>.
Approval state: spec=Approved, design=Draft, tasks=Draft

Next: /afx-sprint design <feature>   # Start the Design section
```

---

## 3. design

Refine the **Design** section (`[DES-OVR]` Overview, `[DES-ARCH]` Architecture, `[DES-UI]` UI & UX, `[DES-DEC]` Key Decisions, `[DES-DATA]` Data Model, `[DES-API]` API Contracts, `[DES-FILES]` File Structure, `[DES-DEPS]` Dependencies, `[DES-SEC]` Security, `[DES-ERR]` Error Handling, `[DES-TEST]` Testing Strategy, `[DES-ROLLOUT]` Migration / Rollout), or approve it.

### Usage

```bash
/afx-sprint design [feature] [...context]   # Refine
/afx-sprint design [feature] --approve          # Mark Design section Approved
```

### Gate

- **Prerequisite**: `approval.spec == Approved`.
- If Spec is not Approved, stop and respond:

  ```text
  Design is gated on Spec approval.
  Current: approval.spec = Draft

  Run: /afx-sprint spec <feature> --approve   (after reviewing the Spec section)
  ```

### Refinement Loop (when called without `--approve`)

Same pattern as `/afx-sprint spec` but scoped to `## 2. Design`:

1. **Read Design section** (`## 2. Design` through the line before `## 3. Tasks`).
2. **Understand the ask** — accept `[...context]` or prompt for focus (architecture sketch, add a key decision, flesh out data model, add a security consideration, add error handling, update rollout plan, …).
3. **Propose diff** with specific Edit operations.
4. **Confirm** with user.
5. **Apply edits** using Edit tool, one change per call.
6. **Maintain anchors**: existing `[DES-X]` IDs stay. New sections get descriptive uppercase kebab-case IDs (e.g., `[DES-CACHE]`, `[DES-AUTH]`).
7. **Demote `approval.tasks`** to Draft if the design change meaningfully affects implementation (new component, changed data model, different API shape). Skip demotion for cosmetic edits — ask the user if unsure.
8. **Update `updated_at`**.
9. **Capture decision** to `journal.md` when a Key Decision resolves an Open Question from the Spec section.

### Approval Path (when called with `--approve`)

1. **Check gate**: `approval.spec == Approved` (else stop as above).
2. **Read Design section**.
3. **Run mini-audit**: at least one `[DES-X]` section present, Key Decisions table filled (or explicit `N/A` note).
4. **If audit fails**: report gaps.
5. **If audit passes**: Edit `approval.design` → `Approved`. Update `updated_at`. Capture to journal.

### Output (refinement)

```text
Design section updated for <feature>.
Changes:
  + [DES-CACHE]: Redis layer for hot reads
  ~ [DES-ARCH]: updated diagram to show new cache tier

Approval demoted: tasks Draft (design changed)

Next: /afx-sprint design <feature> --approve   # When Plan is ready for tasks
```

### Output (approval)

```text
Design section approved for <feature>.
Approval state: spec=Approved, design=Approved, tasks=Draft

Next: /afx-sprint task <feature>   # Break into tasks
```

---

## 4. task

Refine the **Tasks** section (phased hierarchical checklist with `@see` anchors back to FR/DES), or approve it.

### Usage

```bash
/afx-sprint task [feature] [...context]   # Refine
/afx-sprint task [feature] --approve          # Mark Tasks section Approved (unlocks code)
```

### Gate

- **Prerequisite**: `approval.spec == Approved` AND `approval.design == Approved`.
- If either is Draft, stop and direct the user to the missing approval.

### Refinement Loop (when called without `--approve`)

1. **Read Tasks section** (`## 3. Tasks` through the line before `## 4. Work Sessions`).
2. **Run coverage scan**: cross-reference every `[FR-X]` / `[NFR-X]` from Section 1 and every `[DES-X]` from Section 2. List anchors that don't appear in any task group's `@see` comment.
3. **Understand the ask** — accept `[...context]` or prompt with the coverage report: _"These anchors aren't covered yet: [FR-3, DES-CACHE]. Want to add task groups for them, or refine existing ones?"_
4. **Propose diff** — new task groups written with the mandatory `@see` comment format:

   ```markdown
   #### 3.4 Redis setup and connection pool

   <!-- files: src/cache/redis.ts, src/cache/pool.ts -->
   <!-- @see docs/specs/<feature>/<feature>.md [FR-3] [DES-CACHE] -->

   - [ ] Add `ioredis` dependency
   - [ ] Write connection factory with retry/backoff
   - [ ] Unit-test connection failure paths
   ```

5. **Confirm** with user.
6. **Apply edits** using Edit tool. Never renumber existing task groups.
7. **Task numbering**: new group within existing phase = next `[X.Y]`; new phase = next `[X]`.
8. **Update `updated_at`**.

### Approval Path (when called with `--approve`)

1. **Check gate**.
2. **Read Tasks section**.
3. **Run mini-audit**: every task group has `@see` comment; every `[FR-X]`/`[NFR-X]`/`[DES-X]` from earlier sections appears in at least one `@see`; all task items are valid `- [ ]` checkboxes.
4. **If audit fails**: report the exact gaps (missing `@see`, uncovered anchors, malformed checkboxes).
5. **If audit passes**: Edit `approval.tasks` → `Approved`. Also set top-level `status` → `Approved`. Update `updated_at`. Capture to journal.

### Output (refinement)

```text
Tasks section updated for <feature>.
Coverage: 4/4 FRs covered, 2/2 NFRs covered, 5/5 DES sections covered.
Changes:
  + 3.4: Redis setup and connection pool
  + 3.5: Cache invalidation hooks

Next: /afx-sprint task <feature> --approve   # When tasks are ready
```

### Output (approval)

```text
Tasks section approved for <feature>.
Approval state: spec=Approved, design=Approved, tasks=Approved
Overall status: Approved

Next: /afx-sprint code <feature>   # Start implementing
```

---

## 5. code

Dispatch implementation. **Delegates to `/afx-task code`** with the sprint file as the source of truth.

### Usage

```bash
/afx-sprint code [feature] [task-id] [...context]
```

### Gate

- **Prerequisite**: `approval.spec`, `approval.design`, and `approval.tasks` all equal `Approved`.
- If any section is still `Draft`, stop and respond:

  ```text
  Code is gated on all three sections being Approved.
  Current: spec=<s>, design=<d>, tasks=<t>

  Fix: run the matching /afx-sprint <section> --approve after reviewing.
  ```

### Process

1. **Locate file**: `docs/specs/<feature>/<feature>.md`. Error if missing.
2. **Check approval gate** (see above). Stop if any section is Draft.
3. **Resolve target task**: if `[task-id]` given, find it. Otherwise list unchecked tasks and ask the user to pick.
4. **Verify target task has `@see` comment**: if not, error and direct to `/afx-sprint task` to add traceability.
5. **Compose delegation** to `/afx-task code` with:
   - `feature`: `<feature>`
   - `sprint_brief`: `docs/specs/<feature>/<feature>.md`
   - `task_id`: the `[X.Y]` anchor
   - `spec_context`: extracted from Section 1 of `<feature>.md`
   - `design_context`: extracted from Section 2 of `<feature>.md`
   - `task_context`: the target task group plus any sibling notes that affect execution
   - `instruction`: the trailing `[...context]` forwarded verbatim
6. **Instruct `/afx-task code`** that sprint-mode source-code `@see` annotations MUST use full sprint paths while the single-doc format is active:
   - `@see docs/specs/<feature>/<feature>.md [FR-X]`
   - `@see docs/specs/<feature>/<feature>.md [NFR-X]`
   - `@see docs/specs/<feature>/<feature>.md [DES-X]`
   - `@see docs/specs/<feature>/<feature>.md [X.Y]`
7. **On completion**, append a row to the Work Sessions table in `<feature>.md` Section 4 using the same `YYYY-MM-DD` date-only format as `tasks.md`. If this is the first implementation session, promote top-level `status` from `Approved` to `Living` while leaving `approval.*` unchanged.

### Output

Delegates to `/afx-task code`; that skill produces its own output. After completion:

```text
Work session logged in <feature>.md Section 4.
Next: /afx-check path <feature-path>   # Verify implementation against the sprint brief
```

### Error Handling

**Approval gate failed:**

```text
Error: Cannot run code — sections not all Approved.
Current: spec=Approved, design=Draft, tasks=Draft

Run: /afx-sprint design <feature> --approve   (and then task)
```

**Task missing `@see`:**

```text
Error: Task <X.Y> has no `@see` comment pointing to FR/DES anchors.
Run: /afx-sprint task <feature>   # Add traceability before coding
```

**No matching task:**

```text
Error: Task <task-id> not found in <feature>.md Section 3.
Available unchecked tasks: 3.1, 3.2, 3.4
```

---

## 6. verify

Sanity-check the sprint brief before coding. Read-only audit.

### Usage

```bash
/afx-sprint verify [feature] [...context]
```

Trailing context narrows focus. Examples:

- `/afx-sprint verify dark-mode anchors only` — run only anchor-integrity + coverage checks.
- `/afx-sprint verify dark-mode focus approvals` — report approval state without running content audits.
- `/afx-sprint verify dark-mode why is spec still Draft` — run full verify and highlight what's blocking the Spec approval.

### Checks

1. **Frontmatter**: required fields present, timestamps ISO 8601 with milliseconds, `type: SPRINT`, `approval` block present.
2. **Approval state**: report each section's approval status; flag any Draft section blocking forward progress.
3. **Spec section**: at least one FR, non-empty Acceptance Criteria, no Open Question row with `Blocking = Yes` unless it is already `Resolved`.
4. **Design section**: at least one `[DES-X]` section, Key Decisions table is filled (or explicitly marked N/A).
5. **Tasks section**: every task group has an `@see` comment using `docs/specs/<feature>/<feature>.md`, and every `[FR-X]` / `[NFR-X]` / `[DES-X]` anchor from sections 1–2 appears in at least one `@see`.
6. **Anchor integrity**: `[FR-X]` IDs are unique, `[DES-X]` IDs are unique, task numbers `[X.Y]` are unique.
7. **Task parseability**: every task item is a valid `- [ ]` or `- [x]` checkbox.

### Output (pass)

```markdown
## Sprint Verify: <feature>

| Check             | Result                                                      |
| ----------------- | ----------------------------------------------------------- |
| Frontmatter       | Pass                                                        |
| Approvals         | spec=Approved, design=Approved, tasks=Approved              |
| Spec coverage     | 4 FRs, 2 NFRs                                               |
| Plan coverage     | 5 [DES-X] sections                                          |
| Task coverage     | 4/4 FRs referenced, 2/2 NFRs referenced, 5/5 DES referenced |
| Anchor integrity  | Pass                                                        |
| Task parseability | Pass                                                        |

Result: READY FOR CODING
Next: /afx-sprint code <feature>
```

### Output (fail)

```markdown
## Sprint Verify: <feature> — FAILED

### Gaps

1. **FR-3** has no matching task `@see` — add a task that references it
2. **Task 3.2** missing `@see` comment — add traceability
3. **Open Question #1** is unresolved and `Blocking = Yes` — resolve before coding

Next: /afx-sprint task <feature> # Fix gaps
```

---

## 7. graduate

Split the sprint file into the standard 4-file structure when scope has grown.

### Usage

```bash
/afx-sprint graduate [feature] [...context]
```

Trailing context is captured as the rationale in the graduation journal entry (e.g., `scope grew — mobile added`, `PM requires formal review gate`, `splitting for cross-team coordination`).

### Gate

- **Prerequisite**: all three sections `Approved` AND `/afx-sprint verify` passes.

### Process

1. **Locate file**: `docs/specs/<feature>/<feature>.md`. Error if missing.
2. **Check approval gate**: if any section is Draft, stop with:

   ```text
   Cannot graduate — not all sections Approved.
   Current: spec=<s>, design=<d>, tasks=<t>
   ```

3. **Run `/afx-sprint verify`** inline. If it fails, stop and report gaps — don't graduate a broken brief.
4. **Confirm with user**:

   ```text
   Ready to graduate <feature> into 4-file format?

   This will CREATE:
     docs/specs/<feature>/spec.md      (from Spec section)
     docs/specs/<feature>/design.md    (from Design section)
     docs/specs/<feature>/tasks.md     (from Tasks section)

   And RENAME:
     docs/specs/<feature>/<feature>.md → docs/specs/<feature>/<feature>.md.archived

   journal.md stays. Any `@see` annotations that still point at `<feature>.md` will be retargeted to canonical `spec.md` / `design.md` / `tasks.md` paths.

   Proceed? [y/n]
   ```

5. **Split content by section markers**: the sprint template uses `<!-- SPRINT-SECTION-START: <NAME> ... -->` / `<!-- SPRINT-SECTION-END: <NAME> -->` boundary comments. Extract content between them:
   - **SPEC** block → `spec.md` body. Drop the `## 1. Spec` wrapper heading and its blockquote. Keep `## References` as-is (it was already at h2). Promote inner headings: `###` → `##`, `####` → `###`. Use `afx-spec/assets/spec-template.md` frontmatter with `approval.spec`'s state mapped to top-level `status`.
   - **DESIGN** block → `design.md` body. Drop the `## 2. Design` wrapper. Promote `###` → `##`, `####` → `###`. `[DES-X]` anchors become `## [DES-X]` section headings. Use `afx-design/assets/design-template.md` frontmatter; set `spec: spec.md`, `status` ← `approval.design`.
   - **TASKS** block → `tasks.md` body. Drop the `## 3. Tasks` wrapper. Promote `###` → `##`, `####` → `###`. Phase headings become `## Phase N:`, task groups become `### N.Y`. Use `afx-task/assets/tasks-template.md` frontmatter; set `spec: spec.md`, `design: design.md`, `status` ← `approval.tasks`.
   - **SESSIONS** block → appended to the bottom of `tasks.md` as the `## Work Sessions` section (matches tasks-template.md's mandatory last-section rule).
6. **Rewrite `@see` comments** inside tasks.md: change `docs/specs/<feature>/<feature>.md` references to canonical split-doc paths based on anchor type:
   - `FR-X` / `NFR-X` → `docs/specs/<feature>/spec.md`
   - `DES-X` → `docs/specs/<feature>/design.md`
   - `X.Y` task IDs → `docs/specs/<feature>/tasks.md`
     Mixed anchors on one comment split into multiple `@see` lines so each line targets exactly one destination file.
7. **Rewrite source-code `@see` annotations** across the workspace that still reference `docs/specs/<feature>/<feature>.md`, preserving Node IDs while retargeting them to `spec.md`, `design.md`, or `tasks.md` by the same rule as above. This is a path migration only — do not alter implementation logic.
8. **Rename original** to `<feature>.md.archived` — do not delete. Preserves history and lets the user recover if split was wrong.
9. **Update journal.md** with a graduation entry (via proactive capture). Include the trailing-context phrase as the rationale.

### Output

```text
Graduated <feature> to 4-file format.

Created:
  docs/specs/<feature>/spec.md
  docs/specs/<feature>/design.md
  docs/specs/<feature>/tasks.md

Archived:
  docs/specs/<feature>/<feature>.md → docs/specs/<feature>/<feature>.md.archived

Sprint-path @see annotations retargeted to canonical spec/design/tasks paths; FR/DES/task IDs preserved.

Next: /afx-spec validate <feature>   # Confirm the split output
```

### Error Handling

**Verify failed:**

```text
Error: /afx-sprint verify failed. Fix gaps before graduating.
Run: /afx-sprint verify <feature>
```

**Conflicting files exist:**

```text
Error: spec.md / design.md / tasks.md already exist in docs/specs/<feature>/.
Cannot graduate — would overwrite. Move or remove them first.
```

---

## Related Commands

| Command         | Relationship                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `/afx-task`     | `code` subcommand delegates here; `validate` / `verify` become fully compatible after graduation |
| `/afx-spec`     | Graduation target for spec.md; `validate` is recommended after graduation                        |
| `/afx-design`   | Graduation target for design.md                                                                  |
| `/afx-session`  | `journal.md` is shared — sprint feeds the same capture stream                                    |
| `/afx-context`  | Handoff bundles should include `<feature>.md` + `journal.md` while sprint format is active       |
| `/afx-check`    | `trace` works during sprint mode; `links` / `coverage` become fully compatible after graduation  |
| `/afx-scaffold` | Complementary: `afx-scaffold spec <name>` for full 4-file; this for single                       |
