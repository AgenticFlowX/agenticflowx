---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-06T05:15:02.000Z"
tags: ["app", "vscode", "panels", "webview", "host"]
spec: spec.md
design: design.md
---

# Implementation Tasks

## Phase 1: Spec Migration

| Priority | Phase     | Description                                                                                                           | Status |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.1      | Phase 1.1 | Move panel FRs/DES content from `200-app-vscode/{spec,design}.md` into this spec.                                     | [ ]    |
| 1.2      | Phase 1.2 | Retarget `apps/vscode/src/panels/*.ts` `@see` headers from `200-app-vscode` to `201-app-vscode-panels`.               | [ ]    |
| 1.3      | Phase 1.3 | Add per-case `@see` to `dispatchInbound` (already done in Wave 1; keep dispatcher comments aligned with messages.ts). | [x]    |

## Phase 2: Webview HTML Hardening

| Priority | Phase     | Description                                                               | Status |
| -------- | --------- | ------------------------------------------------------------------------- | ------ |
| 2.1      | Phase 2.1 | Add automated test that nonces differ across two `loadWebviewHtml` calls. | [ ]    |
| 2.2      | Phase 2.2 | Add visual smoke check that confirms no FOUC on theme/style switch.       | [ ]    |

## Phase 3: Appearance Bridge

| Priority | Phase     | Description                                                                                                  | Status |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 3.1      | Phase 3.1 | Validate `appearance/update` payloads against `AFX_THEME_IDS` / `AFX_STYLE_IDS` before applying.             | [ ]    |
| 3.2      | Phase 3.2 | Document the appearance bridge contract in `131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]`. | [x]    |

## Work Sessions

| Date       | Task | Action                                                                                                                       | Files modified                                                                                                                         | Agent | Human |
| ---------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-06 | -    | Tightened Explore-to-Code reset UX so Code does not add noisy prompts and real mode changes get a compact timeline info row. | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`     | yes   | yes   |
| 2026-05-06 | -    | Added a one-shot Code mode reset prompt so agent history stops carrying Explore restrictions.                                | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`     | yes   | yes   |
| 2026-05-06 | -    | Kept mode override alive until the persisted snapshot catches up after Code/Explore switches.                                | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/tasks.md` | yes   | yes   |
| 2026-05-05 | -    | Fixed mode-switch race so Code applies immediately and added a regression test.                                              | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/tasks.md` | yes   | yes   |
| 2026-05-03 | -    | Scaffold spec/design/tasks per audit Wave 2 recommendation.                                                                  | `docs/specs/201-app-vscode-panels/{spec,design,tasks}.md`                                                                              | yes   | yes   |
