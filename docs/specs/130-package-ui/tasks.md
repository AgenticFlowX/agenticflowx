---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [package, ui, design-system, shadcn]
spec: spec.md
design: design.md
---

# @afx/ui — Implementation Tasks

> Phases below were backfilled on 2026-04-27 to give a traceable record of the implementation that already shipped. Each task references the FR/DES anchor it implements.

---

## Phase 1 — Design system foundation

### 1.1 Shadcn/Radix component registry

<!-- files: packages/ui/src/components/**/*.tsx, packages/ui/components.json -->
<!-- @see docs/specs/130-package-ui/spec.md [FR-1] [DES-OVR] [DES-UI] -->

- [x] Install Shadcn registry with subpath exports (`@afx/ui/components/<name>`) so apps tree-shake to the components they actually use.
- [x] Ship the canonical primitives required by `apps/chat` and `apps/workbench`: Button, Input, Dialog, Tabs, Card, Alert, Sidebar, Table, Badge, Avatar, Pagination — plus the additional shadcn primitives needed by chat-foundation (Combobox, Popover, Command, ScrollArea, Tooltip, etc.). 54 component files present in `packages/ui/src/components/`.

### 1.2 Meridian design tokens

<!-- files: packages/ui/src/tokens/meridian.css -->
<!-- @see docs/specs/130-package-ui/spec.md [FR-2] [DES-DATA] -->

- [x] Author the Meridian token set as CSS custom properties at the path FR-2 mandates (`src/tokens/meridian.css`).
- [x] Surface the tokens via the `@afx/ui/tokens` Vite alias so apps can import them once at the entry point.

### 1.3 Lyra theme

<!-- files: packages/ui/src/styles/theme-lyra.css, packages/ui/src/styles/theme-meridian.css, packages/ui/src/styles/globals.css -->
<!-- @see docs/specs/130-package-ui/spec.md [FR-3] [DES-UI] -->

- [x] Author the Shadcn-default monochrome Lyra theme at the path FR-3 mandates (`src/styles/theme-lyra.css`).
- [x] Author the matching `theme-meridian.css` for parity and `globals.css` to wire token resets.

### 1.4 Class-merge utility

<!-- files: packages/ui/src/lib/utils.ts, packages/ui/src/lib/utils.test.ts -->
<!-- @see docs/specs/130-package-ui/spec.md [FR-4] [DES-API] -->

- [x] Implement `cn()` Tailwind classname-merge utility (clsx + tailwind-merge).
- [x] Add `utils.test.ts` covering the merge precedence rules.

### 1.5 Responsive hook

<!-- files: packages/ui/src/hooks/use-mobile.ts, packages/ui/src/hooks/use-mobile.test.ts -->
<!-- @see docs/specs/130-package-ui/spec.md [FR-5] [DES-API] -->

- [x] Implement `useMobile()` for breakpoint detection.
- [x] Add `use-mobile.test.ts` covering matchMedia subscribe/unsubscribe and SSR-safe initial state.

### 1.6 Barrel + Vite path aliases

<!-- files: packages/ui/src/index.ts -->
<!-- @see docs/specs/130-package-ui/spec.md [FR-4] [DES-OVR] -->

- [x] Export `cn` from `./lib/utils` at the package barrel.
- [x] Document subpath-export convention (components imported as `@afx/ui/components/<name>`, tokens as `@afx/ui/tokens`); apps wire matching Vite aliases.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task    | Action    | Files Modified                                                                                                                                                                                                                    | Agent | Human |
| ---------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26 | Phase 1 | Completed | packages/ui/src/components/\*\*, packages/ui/src/tokens/meridian.css, packages/ui/src/styles/{theme-lyra,theme-meridian,globals}.css, packages/ui/src/lib/utils.ts, packages/ui/src/hooks/use-mobile.ts, packages/ui/src/index.ts | [x]   | []    |
| 2026-04-27 | audit   | Reviewed  | Backfilled phase breakdown from `> Package is implemented` placeholder; all FRs cross-referenced to actual files.                                                                                                                 | [x]   | []    |
