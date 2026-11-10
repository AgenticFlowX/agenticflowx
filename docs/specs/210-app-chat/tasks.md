---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-11-09T10:51:17.000Z"
tags: [app, chat, webview, streaming, hydration, tabs, visual-regression]
spec: spec.md
design: design.md
---

# apps/chat — Implementation Tasks

> App is implemented. Use this file to track future changes to chat views, transport integration, or DevOverlay.

---

## Phase 1: Shell Visual Regressions

### 1.1 Fix inconsistent Chat, History, and Settings tab indicators

<!-- @see docs/specs/210-app-chat/spec.md [FR-6] -->
<!-- @see docs/specs/210-app-chat/design.md [DES-ARCH] -->
<!-- Files: apps/chat/src/app.tsx, apps/chat/src/app.test.tsx, apps/chat/e2e/chat.spec.ts; app-owned styles if needed. -->

**Issue**: User reports this has persisted for approximately seven months. The supplied VSCode
screenshots show a long black horizontal line below the active Chat and History tabs. Selecting
Settings instead leaves a tiny black dash at the far right below the tab row. The three tabs have
inconsistent indicator size and placement.

**Investigation**: Inspect the root `TabsList` / `TabsTrigger` styling in `app.tsx`, including
`::after` geometry, active-state selectors, and horizontal-orientation selectors. Shared tab
primitives under `packages/ui/src/` are read-only; keep the correction in the app-owned surface.

- [ ] Reproduce the long Chat/History lines and right-edge Settings dash in the VSCode webview using the supplied screenshots as visual references.
- [ ] Give all three tabs one consistent, intentional active indicator aligned with the tab row; remove detached black lines and the stray right-edge dash.
- [ ] Verify switching tabs, keyboard navigation, and focus visibility without changing the selected tab's content or layout.
- [ ] Visually verify all three tabs in Meridian and Lyra, light and dark appearances, and narrow through wide sidebar widths; add browser regression coverage and capture before/after evidence.
- [ ] Run `pnpm verify` and the relevant chat tab browser tests before marking this fix implemented.

## Cross-Reference Index

| Task | Requirement | Design   |
| ---- | ----------- | -------- |
| 1.1  | FR-6        | DES-ARCH |

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task                           | Action    | Files Modified                                                                                                                                                                                                        | Agent | Human |
| ------------------------ | ------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26               | Phase 2                        | Completed | docs/specs/210-app-chat/ (scaffolded)                                                                                                                                                                                 | [x]   | [x]   |
| 2026-04-27T07:22:14.000Z | Preserve tool activity display | Completed | apps/chat/src/views/chat.tsx, apps/chat/src/views/history.tsx, apps/chat/src/app.test.tsx                                                                                                                             | [x]   | [x]   |
| 2026-05-02T04:00:12.000Z | Settings runtime UX review     | Completed | apps/chat/src/views/settings.tsx, apps/chat/src/components/provider-card.tsx, apps/chat/src/components/provider-card.test.tsx, apps/chat/src/app.test.tsx, apps/chat/e2e/chat.spec.ts, apps/chat/playwright.config.ts | [x]   | [x]   |
| 2026-05-03T15:24:30.000Z | Remount hydration cache        | Completed | apps/chat/src/views/chat.tsx, apps/chat/src/lib/bridge.ts, apps/chat/src/app.test.tsx, docs/specs/210-app-chat/spec.md, docs/specs/210-app-chat/design.md                                                             | [x]   | [x]   |
