---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [package, ui, design-system, shadcn, tailwind]
---

# @afx/ui — Product Specification

## References

- **Architecture**: [AGENTS.md — packages/ui](../../../AGENTS.md)

---

## Problem Statement

`apps/chat` and `apps/workbench` need a shared component and design token library. Without it, each app duplicates primitives and diverges on visual style.

---

## User Stories

### Primary Users

`apps/chat` and `apps/workbench` developers.

### Stories

**As a** chat view
**I want** pre-built Button, Input, Dialog, and Tabs components
**So that** I don't rebuild primitives per app

**As a** designer
**I want** CSS design tokens (Meridian and Lyra themes)
**So that** the visual system is configurable without component changes

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                      | Priority    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Shadcn/Radix component registry: Button, Input, Dialog, Tabs, Card, Alert, Sidebar, Table, Badge, Avatar, Pagination, and others | Must Have   |
| FR-2 | Meridian design tokens via CSS custom properties (`src/tokens/meridian.css`)                                                     | Must Have   |
| FR-3 | Lyra theme as Shadcn-default monochrome variant (`src/styles/theme-lyra.css`)                                                    | Must Have   |
| FR-4 | `cn()` Tailwind classname merge utility                                                                                          | Must Have   |
| FR-5 | `useMobile()` hook for responsive breakpoint detection                                                                           | Should Have |

### Non-Functional Requirements

| ID    | Requirement                                                              | Target                                      |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------- |
| NFR-1 | Zero VSCode API dependencies                                             | Enforced by package tsconfig                |
| NFR-2 | Shadcn-generated component files excluded from ESLint (auto-regenerated) | Maintained in eslint.config.mjs ignore list |

---

## Acceptance Criteria

### Components

- [ ] All components exported from `src/index.ts` barrel via sub-path exports
- [ ] Shadcn components regenerated via `shadcn` CLI without manual editing

### Tokens

- [ ] Meridian tokens importable as `@afx/ui/tokens`
- [ ] Both Meridian and Lyra themes apply via CSS class switching

### Utilities

- [ ] `cn()` imported from `@afx/ui/lib/utils`
- [ ] `useMobile()` imported from `@afx/ui/hooks/use-mobile`

---

## Non-Goals

- No VSCode webview-specific components (those belong in the app)
- No app-specific state machines
- No icon library (lucide-react is a direct dep of each app)

---

## Dependencies

- `@base-ui/react`, `@radix-ui/*` (component primitives)
- `tailwind-merge`, `clsx`, `class-variance-authority` (classname utilities)
- `shadcn` (component codegen CLI)
