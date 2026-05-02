# Contributing to AgenticFlowX

## Onboarding

```bash
git clone <repo-url>
cd agenticflowx
pnpm install
```

When the workspace opens, VS Code automatically starts the `watch` compound task (via `runOn: folderOpen`):

- `watch:bundle` — esbuild rebuild on change
- `watch:webview-chat` — Vite HMR for the chat panel
- `watch:webview-workbench` — Vite HMR for the workbench panel
- `watch:tsc` — type errors in the Problems panel

Once the watchers are running, press **F5** to launch the Extension Development Host.

### First run smoke check

After F5:

1. The Extension Development Host opens with the AFX activity-bar icon visible
2. Click the icon → chat panel loads without console errors
3. Open the AFX Workbench panel → loads without console errors
4. Edit `apps/chat/src/App.tsx` → chat panel reloads automatically (HMR, no manual F5)

### Git commit template setup (one-time)

```bash
git config commit.template .gitmessage
```

## Commit convention

Commits must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) with project overrides:

- **C-1**: `scope` is **required** and restricted to the enum in `scripts/generate-scope-enum.mjs`
- **C-2**: Nested scopes are allowed (`workbench/notes`, `workbench/journal`)
- **C-3**: Import order is enforced by Prettier plugin — save auto-sorts

Format: `type(scope): description`

```text
feat(chat): add provider selector dropdown
fix(workbench/notes): preserve scroll position on reload
chore(deps): bump vite to 5.4.10
ci: enforce coverage threshold in code-qa workflow
docs(spec): approve 01-agenticflowx-overview
feat(workbench)!: rename "Tasks" surface to "Activity"
chore(release): bump vscode extension to 1.0.0
```

The `commit-msg` hook rejects non-conforming messages. Run `git commit` (no `-m`) to open the template.

## Pull request flow

1. Branch from `main` (feature/fix/chore prefix)
2. Keep PRs focused — one logical change
3. PR title must be a Conventional Commit (`amannn/action-semantic-pull-request` validates on open)
4. All CI checks must pass before merge
5. Squash-merge only (merge-commit and rebase disabled in repo settings)

## Available scripts

```bash
# Build
pnpm build              # Turbo build (all packages)
pnpm build:chat         # Build chat webview only
pnpm build:workbench    # Build workbench webview only
pnpm build:vscode       # Build extension host only

# Quality checks
pnpm check:types        # tsc --noEmit (all packages)
pnpm check:lint         # ESLint (--max-warnings 0)
pnpm check:lint:fix     # ESLint auto-fix
pnpm check:format       # Prettier check (used in CI)
pnpm check:format:fix   # Prettier write
pnpm check:md           # Markdownlint
pnpm check:knip         # Dead-code detection

# Test
pnpm test               # Vitest run (all packages)

# Aggregate
pnpm ci                 # All checks + test (mirrors CI job order)

# Util
pnpm clean              # Remove all build outputs + node_modules
```

## Maintainer: publishing

Publishing is automated via CI on every release tag (`v*`). Manual steps:

1. Merge the release PR created by release-please
2. CI builds VSIX → publishes to VS Code Marketplace + OpenVSX + GitHub Release

Required repo secrets: `VSCE_PAT`, `OVSX_PAT`
