---
name: afx-release
description: Release workflow — version bump, changelog, tag, and GitHub release
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,release,versioning,changelog,github"
  afx-argument-hint: "[patch|minor|major]"
---

# /afx-release

Release AFX: bump version, update changelog, commit, tag, and publish a GitHub release.

## Usage

```bash
/afx-release              # Auto-detect bump type from commit log
/afx-release patch        # Force patch bump (x.y.Z)
/afx-release minor        # Force minor bump (x.Y.0)
/afx-release major        # Force major bump (X.0.0)
```

## Configuration

Reads from `.afx/.afx.yaml` / `.afx.yaml`:

- No release-specific config — operates on the repo directly.

Requires:

- `git` CLI
- `gh` CLI (GitHub CLI, authenticated)

---

## Execution Contract (STRICT)

### Allowed

- Read git state (`git status`, `git log`, `git tag`, `git diff`)
- Write `CHANGELOG.md` and `skills.json`
- Run `git commit`, `git tag`, `git push`
- Run `gh release create`

### Forbidden

- Modify any source code, skills, templates, or spec files
- Delete files or branches
- Push to any branch other than `main`
- Skip confirmation before committing or tagging

---

## Pre-flight Checks (MANDATORY — abort if any fail)

Run before any other step:

1. **Staged files exist**

   ```bash
   git diff --cached --name-only
   ```

   If empty → abort:

   ```
   Error: Nothing staged. Stage your changes first, then run /afx-release.
   ```

2. **On main branch**

   ```bash
   git branch --show-current
   ```

   If not `main` → abort:

   ```
   Error: Not on main branch (currently on '<branch>'). Switch to main before releasing.
   ```

3. **gh CLI available**

   ```bash
   gh --version
   ```

   If not found → abort:

   ```
   Error: gh CLI not found. Install with: brew install gh
   Then authenticate: gh auth login
   ```

4. **Working tree clean (excluding staged)**
   ```bash
   git diff --name-only
   ```
   If unstaged changes exist → warn (do not abort):
   ```
   Warning: You have unstaged changes. Only staged files will be included in this release.
   ```

---

## Step 1 — Determine Next Version

1. Get current latest tag:

   ```bash
   git tag --sort=-v:refname | head -1
   ```

   Strip the `v` prefix → current version (e.g. `2.4.0`).
   If no tags exist, start from `0.0.0`.

2. If an explicit `patch|minor|major` arg was given, use that.

3. Otherwise, analyze commit messages since last tag:

   ```bash
   git log <last-tag>..HEAD --pretty=format:"%s"
   ```

   Apply these rules (highest wins):
   | Signal | Bump |
   |--------|------|
   | `BREAKING CHANGE` in body, or `!:` in subject | major |
   | `feat:` or `feat(*):` | minor |
   | `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `style:`, `test:` | patch |

4. Compute new version string: bump the appropriate segment, zero lower segments.
   Examples: `2.4.0` + patch → `2.4.1`, `2.4.0` + minor → `2.5.0`, `2.4.0` + major → `3.0.0`

5. **Show and confirm** before proceeding:

   ```
   Next version: v2.5.0 (minor bump — feat commits detected)
   Staged files: afx-cli, skills/agenticflowx/afx-release/SKILL.md

   Proceed with release? [y/N]
   ```

   If user says N → abort cleanly.

---

## Step 2 — Construct Commit Message

Analyze staged diff (`git diff --cached --stat` and `git diff --cached`) to build a conventional commit message.

Format:

```
chore(release): vX.Y.Z

- <concise bullet per logical change group>
- <...>
```

Rules:

- Use `chore(release):` as the subject prefix always
- Bullets describe _what changed_ (not file names) — group related changes
- Max 5 bullets; merge minor changes into one if needed
- No trailing period on bullets

---

## Step 3 — Update CHANGELOG.md

1. Read `CHANGELOG.md`
2. Extract commit log since last tag for changelog content:
   ```bash
   git log <last-tag>..HEAD --pretty=format:"- %s" -- .
   ```
3. Group into sections based on conventional commit prefix:
   | Prefix | Section |
   |--------|---------|
   | `feat:` | `### Added` |
   | `fix:` | `### Fixed` |
   | `chore:`, `refactor:`, `perf:` | `### Changed` |
   | `docs:` | `### Changed` |
   | `BREAKING CHANGE` | `### Breaking Changes` (place first) |
   | `remove:`, `chore(*remove*)` | `### Removed` |

4. Prepend new section after the `# Changelog` header line:

   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### Added

   - ...

   ### Changed

   - ...

   ### Fixed

   - ...
   ```

   Only include sections that have entries. Omit empty sections.

5. Get today's date: run `date -u +"%Y-%m-%d"` — never hardcode.

6. Write updated `CHANGELOG.md` using the Write tool.

---

## Step 4 — Update skills.json Version

1. Read `skills.json`
2. Replace the `"version"` field value with the new version (no `v` prefix):
   ```json
   "version": "2.5.0"
   ```
3. Write updated `skills.json` using the Edit tool.

---

## Step 5 — Commit

Stage the release artifacts and commit:

```bash
git add CHANGELOG.md skills.json
git commit -m "chore(release): vX.Y.Z

- <bullets from Step 2>

Co-authored-by: claude <noreply@anthropic.com>"
```

This commit includes:

- The originally staged files
- `CHANGELOG.md`
- `skills.json`

---

## Step 6 — Push to main

```bash
git push origin main
```

If push fails (e.g. remote ahead) → abort:

```
Error: Push failed. Pull latest changes and resolve conflicts before releasing.
```

---

## Step 7 — Create and Push Tag

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

If tag already exists locally → abort:

```
Error: Tag vX.Y.Z already exists locally. Delete it first: git tag -d vX.Y.Z
```

---

## Step 8 — Create GitHub Release

1. Extract the new changelog section (from `## [X.Y.Z]` to the next `## [` or EOF).
2. Create the release:
   ```bash
   gh release create vX.Y.Z \
     --title "vX.Y.Z" \
     --notes "<extracted changelog section>"
   ```
3. On success, print the release URL.

---

## Summary Output

After all steps complete:

```
Released vX.Y.Z

  Commit : abc1234 chore(release): vX.Y.Z
  Tag    : vX.Y.Z (pushed)
  Release: https://github.com/AgenticFlowX/afx/releases/tag/vX.Y.Z

Changelog entry added for vX.Y.Z.
```

---

## Error Handling

| Situation                 | Response                                             |
| ------------------------- | ---------------------------------------------------- |
| Nothing staged            | Abort — "Nothing staged. Stage your changes first."  |
| Not on main               | Abort — "Not on main branch."                        |
| `gh` not found            | Abort — "gh CLI not found. Install: brew install gh" |
| Tag already exists        | Abort — "Tag vX.Y.Z already exists."                 |
| Push fails                | Abort — "Push failed. Pull and resolve conflicts."   |
| `gh release create` fails | Warn — show manual command to retry                  |

---

## Related Commands

| Command                          | Relationship                                |
| -------------------------------- | ------------------------------------------- |
| `/afx-hello`                     | Verify environment before releasing         |
| `/afx-next`                      | Check current state before releasing        |
| `git log v2.4.0..HEAD --oneline` | Preview commits that will be in the release |
