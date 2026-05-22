---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-22T05:56:29.000Z"
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

| Date                     | Task | Action                                                                                                                                                                                      | Files modified                                                                                                                                                                       | Agent | Human |
| ------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 2026-05-21               | -    | Clarified that all four Explore intent slots inherit the same read-only inspection surface and added coverage for each slot.                                                                | `packages/shared/src/intent-prompts.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`                                                     | yes   | [ ]   |
| 2026-05-21               | -    | Tightened Explore shell classification: single `&`, shell grouping, and mutating curl request forms are blocked before spawn.                                                               | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`                                                   | yes   | [ ]   |
| 2026-05-21               | -    | Allowed composer `!` commands in Explore when they are simple read-only inspection commands, while still blocking mutating composer shell commands before spawn.                            | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `apps/chat/src/app.test.tsx`, `docs/specs/201-app-vscode-panels/*.md`                     | yes   | [ ]   |
| 2026-05-21               | -    | Allowed runtime `bash` in Explore only for simple read-only inspection commands, while keeping mutating shell/build/test/install commands blocked.                                          | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `packages/shared/src/intent-prompts.ts`, `docs/specs/201-app-vscode-panels/*.md`          | yes   | [ ]   |
| 2026-05-21               | -    | Relaxed Explore from no-tools analysis to read-only investigation: file reads, folder listing, source search, and web-page reads are allowed while shell/write/mutation tools stay blocked. | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `packages/shared/src/intent-prompts.ts`, `docs/specs/201-app-vscode-panels/*.md`          | yes   | [ ]   |
| 2026-05-06               | -    | Made Explore mode stricter by banning tool/file browsing in the prompt and aborting runtime tool attempts host-side.                                                                        | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`                                                   | yes   | [x]   |
| 2026-05-06               | -    | Tightened Explore-to-Code reset UX so Code does not add noisy prompts and real mode changes get a compact timeline info row.                                                                | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`                                                   | yes   | [x]   |
| 2026-05-06               | -    | Added a one-shot Code mode reset prompt so agent history stops carrying Explore restrictions.                                                                                               | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/*.md`                                                   | yes   | [x]   |
| 2026-05-06               | -    | Kept mode override alive until the persisted snapshot catches up after Code/Explore switches.                                                                                               | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/tasks.md`                                               | yes   | [x]   |
| 2026-05-05               | -    | Fixed mode-switch race so Code applies immediately and added a regression test.                                                                                                             | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/tasks.md`                                               | yes   | [x]   |
| 2026-05-03               | -    | Scaffold spec/design/tasks per audit Wave 2 recommendation.                                                                                                                                 | `docs/specs/201-app-vscode-panels/{spec,design,tasks}.md`                                                                                                                            | yes   | [x]   |
| 2026-05-22T05:56:29.000Z | -    | Cleared sidebar-local streaming and queued mirrors before runtime restart so recovered runtimes accept the next chat turn.                                                                  | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `docs/specs/201-app-vscode-panels/design.md`, `docs/specs/201-app-vscode-panels/tasks.md` | yes   | [ ]   |
