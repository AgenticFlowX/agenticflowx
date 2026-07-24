# afx-dash graduate

Losslessly expand a Dash when it has outgrown its shape. Run as a guarded operation: dry-run diff → atomic write → reparse → invariant checks. Undo is git in the pure-skill path.

## Dash → Sprint (`--to sprint`)

Expand the same `<feature>.md` from `type: DASH` to `type: SPRINT`:

- Purpose seeds the Sprint Spec problem/scope content.
- Existing task groups, IDs, file scopes, dependencies, checkboxes, and Work Sessions remain byte-for-byte unchanged.
- Missing requirements/design content becomes explicit `Draft` material or placeholders — never retroactively invent approval.
- Add Sprint frontmatter fields: `status: Draft`, `version: "0.1"`, and the `approval` block (spec/design/tasks all Pending).
- Record the graduation reason; retain source-code task links.

## Dash → Full (`--to full`)

Create `spec.md`, `design.md`, `tasks.md`, and `journal.md`:

- Purpose seeds current `spec.md` content; spec/design start `Draft` and follow normal review/approval gates.
- Tasks + Work Sessions move to `tasks.md` with IDs and evidence preserved.
- Deterministically retarget source `@see` paths from the Dash to `tasks.md`, preserving node IDs.
- Record the graduation in `journal.md`.
- The original Dash must not remain as a competing current source of truth.

## Invariants

- Preserve Purpose, task IDs, dependencies, file scopes, checkboxes, evidence, and Work Sessions.
- On failure, leave the original Dash and its source links unchanged.
- Never emit `status: Living`.
