---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: [package, ui, design-system, shadcn, tailwind]
spec: spec.md
---

# @afx/ui — Technical Design

---

## [DES-OVR] Overview

`@afx/ui` is a Shadcn/Radix component registry with two design token themes (Meridian and Lyra). Components are consumed via sub-path imports. The `cn()` utility and `useMobile()` hook are the only non-Shadcn exports.

---

## [DES-ARCH] Architecture

### System Context

```text
packages/ui/
└── src/
    ├── index.ts                  ← barrel (cn utility)
    ├── components/               ← Shadcn-generated components (57+)
    ├── lib/
    │   ├── utils.ts              ← cn() — Tailwind classname merge
    │   └── use-mobile.ts         ← responsive breakpoint hook
    ├── hooks/
    │   └── use-mobile.ts         ← re-export of lib/use-mobile
    ├── tokens/
    │   └── meridian.css          ← Meridian design tokens
    └── styles/
        ├── globals.css           ← global styles
        ├── meridian.tokens.css   ← token definitions
        ├── theme-meridian.css    ← editorial theme
        └── theme-lyra.css        ← Shadcn monochrome utilitarian theme
```

### Package Exports

```text
"."              → src/index.ts          (cn utility)
"./tokens"       → src/tokens/meridian.css
"./styles/*"     → src/styles/*.css
"./lib/*"        → src/lib/*.ts
"./components/*" → src/components/*.tsx
"./hooks/*"      → src/hooks/*.ts
```

---

## [DES-UI] User Interface & UX

Meridian theme: editorial, warm, opinionated typographic hierarchy.
Lyra theme: Shadcn default monochrome — utilitarian, dense, suitable for dev tools.

Theme switching via CSS class on `<html>` — no JavaScript required.

---

## [DES-DEC] Key Decisions

| Decision         | Options Considered                      | Choice                      | Rationale                                                                           |
| ---------------- | --------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Component source | Build from scratch, Radix + CVA, Shadcn | Shadcn                      | Auto-generated, ejectable, standard Radix primitives, community-maintained patterns |
| Theme mechanism  | JS theme objects, CSS variables         | CSS custom properties       | Works without JS; supports OS dark mode via media queries                           |
| Build step       | Full build to dist, source-only         | Source-only (no build step) | Consumed via Vite aliases; eliminates double compilation                            |

---

## [DES-DATA] Data Model

No data model — purely presentational package.

---

## [DES-API] API Contracts

```typescript
// From "@afx/ui"
export function cn(...inputs: ClassValue[]): string;

// From "@afx/ui/lib/use-mobile"
export function useMobile(): boolean;

// From "@afx/ui/hooks/use-mobile"
export { useMobile } from "../lib/use-mobile";

// From "@afx/ui/components/button"
export { Button, buttonVariants };
// ... (each component exported from its own sub-path)
```

---

## [DES-FILES] File Structure

| File                                  | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `packages/ui/src/index.ts`            | Barrel — `cn()` export                     |
| `packages/ui/src/lib/utils.ts`        | `cn()` using `tailwind-merge` + `clsx`     |
| `packages/ui/src/lib/use-mobile.ts`   | `useMobile()` responsive hook              |
| `packages/ui/src/hooks/use-mobile.ts` | Re-export of `lib/use-mobile`              |
| `packages/ui/src/tokens/meridian.css` | Meridian CSS custom properties             |
| `packages/ui/src/components/*.tsx`    | Shadcn component registry (auto-generated) |

---

## [DES-DEPS] Dependencies

| Package                                              | Purpose                        |
| ---------------------------------------------------- | ------------------------------ |
| `@base-ui/react`, `@radix-ui/*`                      | Headless UI primitives         |
| `tailwind-merge`, `clsx`, `class-variance-authority` | Classname utilities            |
| `shadcn`                                             | Component codegen CLI          |
| `lucide-react`                                       | Icons (consumed by components) |

---

## [DES-SEC] Security Considerations

- No user data processed in UI package
- Shadcn-generated components may include `dangerouslySetInnerHTML` — audit on update

---

## [DES-ERR] Error Handling

UI components render their error/empty states via `variant` props — no runtime error handling.

---

## [DES-TEST] Testing Strategy

### Unit Tests

- `lib/utils.test.ts` — `cn()` classname merging
- `lib/use-mobile.test.ts` — responsive hook behaviour

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Adding Components

1. Run `pnpm shadcn add <component>` from `packages/ui/`
2. Generated file lands in `src/components/` (excluded from ESLint enforcement)
3. Export sub-path added to `package.json` if needed

---

## File Reference Map

| Task | File                                  | Required @see                            |
| ---- | ------------------------------------- | ---------------------------------------- |
| —    | `packages/ui/src/index.ts`            | `spec.md [FR-1]` + `design.md [DES-API]` |
| —    | `packages/ui/src/lib/utils.ts`        | `spec.md [FR-4]` + `design.md [DES-API]` |
| —    | `packages/ui/src/lib/use-mobile.ts`   | `spec.md [FR-5]` + `design.md [DES-API]` |
| —    | `packages/ui/src/hooks/use-mobile.ts` | `spec.md [FR-5]` + `design.md [DES-API]` |
