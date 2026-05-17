---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: [package, ui, design-system, shadcn, tailwind, storybook, routing]
---

# @afx/ui — Product Specification

## References

- **Architecture**: [AGENTS.md — packages/ui](../../../AGENTS.md)

---

## Problem Statement

`apps/chat` and `apps/workbench` need a shared component and design token library. Without it, each app duplicates primitives and diverges on visual style.

This parent spec owns the package boundary. Surgical design-system, token, theme, component-contract, and Storybook work routes to `131-package-ui-design-system`.

---

## Child Zone Route Map

| Spec                               | Start Here For                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `131-package-ui-design-system`     | Tokens, theme/style contracts, shared component contracts, Storybook stories/docs |
| Future `132-package-ui-primitives` | Only if primitive component APIs grow beyond the design-system route map          |

When a design-system change needs app-specific behavior, update the app child spec as well rather than moving app state into `packages/ui`.

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
- [ ] Shared component/story work starts in `131-package-ui-design-system`

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
- No app-specific composer, settings, history, or workbench layout behavior

---

## Dependencies

- `@base-ui/react`, `@radix-ui/*` (component primitives)
- `tailwind-merge`, `clsx`, `class-variance-authority` (classname utilities)
- `shadcn` (component codegen CLI)

---

## Appendix

### Agent Entry Map (routing-only parent)

This is a parent spec. It owns the package boundary. Surgical design-system, token, theme,
component-contract, and Storybook work routes to `131-package-ui-design-system`.

| Field           | Values                                                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Package layout, barrel exports (`@afx/ui` barrel + subpath exports), helper exports (`cn`, `useMobile`); **routing only** for tokens/theme/Storybook/component-contract          |
| Owned files     | `packages/ui/src/index.ts`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/hooks/use-mobile.ts`, `packages/ui/src/components/**` (managed update surface — no spec churn here) |
| Children        | `131-package-ui-design-system`                                                                                                                                                   |
| Routing rules   | "tokens/theme/style/appearance" -> 131; "Storybook/component contract" -> 131; "shadcn primitive update" -> registry sync, not spec work; helper additions in `lib/` -> 131      |
| Out of scope    | Specific token values, individual component implementations, theme/style enums (declared in `100-package-shared`, governed by 131)                                               |
| Example prompts | "Add a token" -> 131; "New style id" -> 131; "Storybook story for Button" -> 131; "Update shadcn Button to latest" -> registry sync (no spec change)                             |
