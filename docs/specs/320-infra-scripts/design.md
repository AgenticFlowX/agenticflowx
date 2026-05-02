---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [infra, scripts, commitlint, scope-enum]
spec: spec.md
---

# Infra Scripts — Technical Design

---

## [DES-OVR] Overview

`generate-scope-enum.mjs` reads `pnpm-workspace.yaml`, maps each workspace package to a short scope slug, appends any hand-maintained extras, and writes a `commitlint-scopes.mjs` file consumed by `commitlint.config.mjs`. Running the script is idempotent — same input always produces same output.

---

## [DES-ARCH] Architecture

```text
scripts/generate-scope-enum.mjs
  → reads pnpm-workspace.yaml (glob: apps/*, packages/*)
  → resolves each package dir, extracts trailing folder name
  → appends EXTRA_SCOPES (hand-maintained list in the script)
  → writes scripts/commitlint-scopes.mjs  (exports SCOPES array)

commitlint.config.mjs
  → imports SCOPES from scripts/commitlint-scopes.mjs
  → passes to @commitlint/config-conventional scope-enum rule
```

### Data Flow

```text
pnpm-workspace.yaml
  ├── apps/vscode   → "vscode"
  ├── apps/chat     → "chat"
  ├── apps/workbench → "workbench"
  ├── packages/shared → "shared"
  ├── packages/transport → "transport"
  ├── packages/parsers   → "parsers"
  └── packages/ui        → "ui"
+ EXTRA_SCOPES: ["ci", "dx", "docs", "scripts", "deps", "release"]
→ commitlint-scopes.mjs: export const SCOPES = [...]
```

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                    | Choice                           | Rationale                                                                         |
| --------------- | ------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| Scope source    | Hard-coded array, glob from workspace | Generate from workspace + extras | Workspace is the authoritative package list; extras cover non-package scopes      |
| Output format   | JSON file, `.mjs` module              | `.mjs` module                    | commitlint config is ESM; direct import avoids JSON.parse step                    |
| Script language | TypeScript, shell                     | `.mjs` (vanilla JS)              | No build step required; runs directly with `node scripts/generate-scope-enum.mjs` |

---

## [DES-API] API Contracts

```javascript
// scripts/generate-scope-enum.mjs — no exported API; run as script
// node scripts/generate-scope-enum.mjs
// Writes: scripts/commitlint-scopes.mjs

// Output format:
// export const SCOPES = ['vscode', 'chat', 'workbench', 'shared', 'transport', 'parsers', 'ui', 'ci', ...];
```

---

## [DES-FILES] File Structure

| File                              | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `scripts/generate-scope-enum.mjs` | Generator script — reads workspace, writes enum  |
| `scripts/commitlint-scopes.mjs`   | Generated output — imported by commitlint config |

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

### Unit Tests

Not unit-tested. Correctness verified by running the script and inspecting `commitlint-scopes.mjs` output.

### Manual Testing

Run `node scripts/generate-scope-enum.mjs` after adding a new workspace package; confirm new scope appears in generated file.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Add new workspace package

1. Add package to `apps/` or `packages/` with a `package.json`
2. Run `node scripts/generate-scope-enum.mjs`
3. Commit updated `scripts/commitlint-scopes.mjs`

### Rollback Plan

Revert `commitlint-scopes.mjs` to prior version.

---

## File Reference Map

| Task | File                              | Required @see                             |
| ---- | --------------------------------- | ----------------------------------------- |
| —    | `scripts/generate-scope-enum.mjs` | `spec.md [FR-1]` + `design.md [DES-ARCH]` |
