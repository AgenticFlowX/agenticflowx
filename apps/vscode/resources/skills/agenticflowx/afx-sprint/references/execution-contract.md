# afx-sprint — Execution Contract & Agent Instructions

Cross-cutting operating rules for every `/afx-sprint` action: what may be written, timestamp discipline, proactive journal capture, the post-action checklist, context resolution, and next-command suggestions.

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
`/afx-sprint` delegates implementation to `/afx-task code`.
Run: /afx-sprint code <feature> [...context]
```

### Timestamp Format (MANDATORY)

Frontmatter fields (`created_at`, `updated_at`) and journal captures use ISO 8601 with millisecond precision — see `../afx-help/references/timestamp-rule.md`. Work Sessions rows stay `YYYY-MM-DD` to match `tasks.md` and `/afx-task`.

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/references/proactive-capture.md).

**Triggers for `/afx-sprint`**: scope decision during `spec`, architecture choice during `design`, graduation decision.

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): new FR/NFR added (Section 1), new `[DES-X]` section added (Section 2), missed requirement surfaced mid-conversation, approval demotion after a meaningful edit. After applying the sprint edit, run the [Significance Check](../afx-session/references/proactive-capture.md) first — skip silently for cosmetic edits (the demotion-to-Draft logic is orthogonal; Draft demotion can happen without a capture). Only call `/afx-session capture --trigger <kind> --links <anchors>` when the change encodes a real decision or discovery. See [Prompt Capture Triggers](../afx-session/references/proactive-capture.md).

## Post-Action Checklist (MANDATORY)

After any `/afx-sprint` action that writes to `<feature>.md`, you MUST:

1. **Update `updated_at`** in frontmatter to the current ISO 8601 timestamp.
2. **Preserve frontmatter field order**: `afx → type → status → owner → version → created_at → updated_at → tags → approval`.
3. **Preserve section anchors**: `[FR-X]`, `[NFR-X]`, `[DES-X]`, and task numbers `[X.Y]` are stable IDs used by code `@see` links — never renumber casually.
4. **Append, don't rewrite**: during `spec`/`design`/`task` refinement, edit targeted sections only. Never regenerate the whole file unless the user explicitly asks.
5. **Verify structural integrity**: after edits, confirm all three sections (Spec, Plan, Tasks) still exist and the Work Sessions table is intact.
6. **Keep `@see` paths canonical**: while sprint format is active, task-group comments and generated source-code annotations should use `docs/specs/<feature>/<feature>.md`, not `./<feature>.md`.

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

**Host Rendering:** Emit the plain `Next (ranked)` or equivalent prose only. Do not emit host-specific JSON or marker blocks; UI hosts may convert the prose into clickable actions when concrete commands are present.
