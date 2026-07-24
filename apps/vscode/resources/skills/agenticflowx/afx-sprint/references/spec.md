# afx-sprint spec

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
