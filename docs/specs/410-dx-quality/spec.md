---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [dx, quality, eslint, prettier, knip, size-limit]
depends_on: [400-dx-conventions]
---

# DX Quality — Product Specification

## References

- **Architecture**: [AGENTS.md — Coding rules](../../../AGENTS.md)

---

## Problem Statement

Type errors, unused exports, format drift, and bundle bloat accumulate silently without automated enforcement. A single quality config surface prevents all four.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                            | Priority    |
| ---- | -------------------------------------------------------------------------------------- | ----------- |
| FR-1 | ESLint v9 flat config: TypeScript strict, React, React Hooks, Prettier compat, unicorn | Must Have   |
| FR-2 | Shadcn-generated components and hooks excluded from ESLint enforcement                 | Must Have   |
| FR-3 | Prettier enforces single quotes, 2-space indent, trailing comma                        | Must Have   |
| FR-4 | markdownlint enforces markdown formatting across all `.md` files                       | Must Have   |
| FR-5 | knip detects unused exports and dependencies across all workspace packages             | Must Have   |
| FR-6 | size-limit tracks `apps/chat` bundle size and reports in CI                            | Should Have |
| FR-7 | Quality gates exclude generated VSCode e2e test-host files                             | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                      | Target       |
| ----- | ------------------------------------------------ | ------------ |
| NFR-1 | `pnpm lint` runs in < 30s across whole workspace | CI gate time |

---

## Non-Goals

- No custom ESLint rules (extend existing plugins only)
- No style enforcement beyond Prettier config

---

## Dependencies

- `eslint`, `@eslint/js`, `typescript-eslint`
- `eslint-plugin-react`, `eslint-plugin-react-hooks`
- `eslint-plugin-unicorn`, `eslint-config-prettier`
- `prettier`, `markdownlint-cli2`
- `knip`, `@size-limit/preset-app`
