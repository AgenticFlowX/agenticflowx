---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["infra", "scripts", "commitlint", "scope-enum", "traceability"]
spec: spec.md
---

# Infra Scripts — Technical Design

---

## [DES-OVR] Overview

`generate-scope-enum.mjs` reads `pnpm-workspace.yaml`, maps each workspace package to a short scope slug, appends hand-maintained extras for subsystems and cross-cutting concerns, and exports the combined sorted array. `commitlint.config.mjs` imports this array directly. Running the script is idempotent — same input always produces same output.

The hand-maintained list is derived from a code-area and dependency lookup: each scope maps to a concrete view, package surface, or cross-cutting concern so that commit logs are targeted to the exact subsystem changed.

---

## [DES-ARCH] Architecture

<!-- @see spec.md [FR-1] [FR-2] -->

```text
scripts/generate-scope-enum.mjs
  → reads pnpm-workspace.yaml (glob: apps/*, packages/*, packages/agent/*)
  → resolves each package dir, extracts trailing folder name
  → appends hand-maintained scopes (subsystems + cross-cutting)
  → exports sorted SCOPES array

commitlint.config.mjs
  → imports SCOPES from scripts/generate-scope-enum.mjs
  → passes to @commitlint/config-conventional scope-enum rule
```

### [DES-INFRA-SCRIPTS-SCOPE-FLOW] Scope Registry

Scopes are partitioned by category. Auto-generated scopes derive from workspace directory names; hand-maintained scopes fill gaps for subviews, conceptual aggregates, and process concerns.

#### Auto-Generated (workspace directories)

| Directory               | Scope        | Package / App       |
| ----------------------- | ------------ | ------------------- |
| `apps/vscode`           | `vscode`     | `agenticflowx`      |
| `apps/chat`             | `chat`       | `@afx/chat`         |
| `apps/workbench`        | `workbench`  | `@afx/workbench`    |
| `apps/vscode-e2e`       | `vscode-e2e` | e2e test suite      |
| `packages/shared`       | `shared`     | `@afx/shared`       |
| `packages/transport`    | `transport`  | `@afx/transport`    |
| `packages/parsers`      | `parsers`    | `@afx/parsers`      |
| `packages/ui`           | `ui`         | `@afx/ui`           |
| `packages/agent/pi`     | `pi`         | `@afx/agent-pi`     |
| `packages/agent/pi-sdk` | `pi-sdk`     | `@afx/agent-pi-sdk` |

#### Hand-Maintained — Chat Subsystems

Derived from `apps/chat/src/views/`.

| Scope           | View File      | Spec           |
| --------------- | -------------- | -------------- |
| `chat/history`  | `history.tsx`  | `210-app-chat` |
| `chat/settings` | `settings.tsx` | `210-app-chat` |

#### Hand-Maintained — Workbench Subsystems

Derived from `apps/workbench/src/views/` and spec map.

| Scope                   | View File       | Spec                            |
| ----------------------- | --------------- | ------------------------------- |
| `workbench/analytics`   | `analytics.tsx` | `226-app-workbench-analytics`   |
| `workbench/board`       | `board.tsx`     | `221-app-workbench-board`       |
| `workbench/documents`   | `documents.tsx` | `222-app-workbench-documents`   |
| `workbench/journal`     | `journal.tsx`   | `223-app-workbench-journal`     |
| `workbench/notes`       | `notes.tsx`     | `224-app-workbench-notes`       |
| `workbench/pipeline`    | `pipeline.tsx`  | `225-app-workbench-pipeline`    |
| `workbench/shell`       | `workbench.tsx` | `227-app-workbench-shell`       |
| `workbench/impact-lens` | _(planned)_     | `228-app-workbench-impact-lens` |
| `bottom-panel`          | shell container | `227-app-workbench-shell`       |

#### Hand-Maintained — Conceptual Aggregates

Scopes that span multiple packages or represent a logical subsystem.

| Scope   | Covers                                       | Dependency Rationale                                                                                                                            |
| ------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent` | `packages/agent/pi`, `packages/agent/pi-sdk` | `pi-sdk` depends on `pi`; cross-package agent work benefits from a single scope. `pi` / `pi-sdk` remain available for package-specific commits. |
| `e2e`   | Cross-cutting end-to-end tests               | Broader than `vscode-e2e`; used when CI/playwright infrastructure changes.                                                                      |

#### Hand-Maintained — Process / Cross-Cutting

| Scope     | Purpose                                     |
| --------- | ------------------------------------------- |
| `deps`    | Dependabot / dependency bumps               |
| `ci`      | GitHub Actions workflows                    |
| `release` | release-please, versioning, VSIX publishing |
| `scripts` | `scripts/` generators and build utilities   |
| `docs`    | Documentation changes                       |
| `infra`   | Build system, Turbo, esbuild, Vite          |
| `dx`      | Developer experience, linting, formatting   |
| `repo`    | Repository-wide meta changes                |
| `spec`    | Spec-driven documentation updates           |

---

## [DES-UI] User Interface & UX

<!-- @see spec.md [FR-2] -->

This is a build-time script with no user-facing UI. The output is a machine-readable array of scope strings consumed by the commitlint configuration. The human-facing aspect is the commit message itself — scope restrictions guide authors to pick targeted subsystem identifiers.

---

## [DES-DATA] Data Model

<!-- @see spec.md [FR-1] [FR-2] -->

### Scope Array

The script exports a single data structure: a sorted array of unique lowercase scope strings.

```typescript
type Scope = string;
type ScopeArray = Scope[];
```

| Field    | Type         | Description                                          |
| -------- | ------------ | ---------------------------------------------------- |
| `scopes` | `ScopeArray` | Sorted, deduplicated list of all valid commit scopes |

### Scope Categories

| Category        | Source                      | Count  |
| --------------- | --------------------------- | ------ |
| Auto-generated  | `pnpm-workspace.yaml` globs | 11     |
| Hand-maintained | Hard-coded in script        | 21     |
| **Total**       |                             | **32** |

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                    | Choice                           | Rationale                                                                         |
| --------------- | ------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| Scope source    | Hard-coded array, glob from workspace | Generate from workspace + extras | Workspace is the authoritative package list; extras cover non-package scopes      |
| Output format   | JSON file, `.mjs` module              | `.mjs` module                    | commitlint config is ESM; direct import avoids JSON.parse step                    |
| Script language | TypeScript, shell                     | `.mjs` (vanilla JS)              | No build step required; runs directly with `node scripts/generate-scope-enum.mjs` |

---

## [DES-API] API Contracts

<!-- @see spec.md [FR-3] -->

```javascript
// scripts/generate-scope-enum.mjs — ESM module exported for direct import
// Imported by: commitlint.config.mjs
//
// Export format:
// export default ['agent', 'chat', 'chat/history', 'chat/settings', 'ci', ...];
```

---

## [DES-FILES] File Structure

| File                              | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `scripts/generate-scope-enum.mjs` | Scope generator + registry — reads workspace, exports array |
| `commitlint.config.mjs`           | Commitlint config — imports scopes directly from the script |

---

## [DES-DEPS] Dependencies

| Package                | Purpose                     |
| ---------------------- | --------------------------- |
| `js-yaml`              | Parse `pnpm-workspace.yaml` |
| `node:fs`, `node:path` | File I/O (built-in)         |

---

## [DES-SEC] Security Considerations

- Script reads only local files; no network access
- Output is a static `.mjs` module with no dynamic code generation (template literal, not eval)

---

## [DES-ERR] Error Handling

| Scenario                      | Handling                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| `pnpm-workspace.yaml` missing | `fs.readFileSync` throws; script exits with stack trace       |
| Workspace glob returns empty  | Empty SCOPES array written; commitlint will reject all scopes |

---

## [DES-TEST] Testing Strategy

### [DES-INFRA-SCRIPTS-TEST-UNIT] Unit Tests

Not unit-tested. Correctness verified by inspecting the exported array (e.g. `node --input-type=module -e "import s from './scripts/generate-scope-enum.mjs'; console.log(s);"`).

### [DES-INFRA-SCRIPTS-TEST-MANUAL] Manual Testing

After adding a new workspace package, re-run the verification command above; confirm the new scope appears in the exported array.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-INFRA-SCRIPTS-ROLLOUT-SCOPE] Phase 1: Add new workspace package

1. Add package to `apps/` or `packages/` with a `package.json`
2. Verify the new scope appears in the exported array
3. Commit the change (no generated file to update)

### [DES-INFRA-SCRIPTS-ROLLOUT-ROLLBACK] Rollback Plan

Revert `scripts/generate-scope-enum.mjs` to prior version if hand-maintained scopes were incorrectly modified.

---

## [DES-INFRA-SCRIPTS-LOC] Code Locator Map

| Surface             | Source anchor                     | Design node                      | Verification                  |
| ------------------- | --------------------------------- | -------------------------------- | ----------------------------- |
| Scope generator     | `scripts/generate-scope-enum.mjs` | `[DES-INFRA-SCRIPTS-SCOPE-FLOW]` | Inspect exported array        |
| Commitlint consumer | `commitlint.config.mjs`           | `[DES-ARCH]`                     | commit-msg hook / PR title CI |

---

## [DES-INFRA-SCRIPTS-REFS] File Reference Map

| Task | File                              | Required @see                                                 |
| ---- | --------------------------------- | ------------------------------------------------------------- |
| —    | `scripts/generate-scope-enum.mjs` | `spec.md [FR-1]` + `design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW]` |
| —    | `commitlint.config.mjs`           | `spec.md [FR-3]` + `design.md [DES-ARCH]`                     |
