# afx-sprint new

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
