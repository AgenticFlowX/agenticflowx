---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: [infra, scripts, commitlint, scope-enum]
depends_on: [400-dx-conventions]
---

# Build Scripts — Product Specification

## References

- **Architecture**: [AGENTS.md — commands](../../../AGENTS.md)

---

## Problem Statement

Commitlint's scope-enum must stay in sync with pnpm workspace packages. Manual maintenance drifts; automation reads workspace globs directly.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                      | Priority  |
| ---- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | `generate-scope-enum.mjs` reads `pnpm-workspace.yaml` globs to derive valid package scope names                  | Must Have |
| FR-2 | Hand-maintained supplementary scopes (ci, docs, dx, infra, repo, spec, deps, release) merged with auto-generated | Must Have |
| FR-3 | Output consumed by `commitlint.config.mjs` at lint time                                                          | Must Have |

### Non-Functional Requirements

| ID    | Requirement                               | Target          |
| ----- | ----------------------------------------- | --------------- |
| NFR-1 | Script runs in < 100ms (no network calls) | File reads only |

---

## Non-Goals

- No runtime scope validation (commitlint handles that)
- No scope documentation generation

---

## Dependencies

- `js-yaml` or Node built-ins for YAML parsing
- `400-dx-conventions` (commitlint config that imports this)
