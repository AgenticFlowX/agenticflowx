---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-03T07:46:18.000Z"
tags: ["app", "vscode", "spec-services", "sprint", "host"]
spec: spec.md
design: design.md
---

# Implementation Tasks

## Phase 1: Spec Migration

| Priority | Phase     | Description                                                                                                                                | Status |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1.1      | Phase 1.1 | Move spec-services FR/DES content from `220-app-workbench` (host-side data) and `202-app-vscode-editor-actions` (lifecycle commands) here. | [ ]    |
| 1.2      | Phase 1.2 | Retarget `apps/vscode/src/services/*.ts` `@see` headers to `204-app-vscode-spec-services`.                                                 | [ ]    |
| 1.3      | Phase 1.3 | Add per-function `@see` to `specs-data.ts` and `sprint-context.ts` exported functions.                                                     | [ ]    |

## Phase 2: Coverage

| Priority | Phase     | Description                                                                          | Status |
| -------- | --------- | ------------------------------------------------------------------------------------ | ------ |
| 2.1      | Phase 2.1 | Add `specs-data.test.ts` covering discovery + parser delegation with fixtures.       | [ ]    |
| 2.2      | Phase 2.2 | Add `sprint-context.test.ts` covering `evaluate` with multiple sections in one file. | [ ]    |

## Work Sessions

| Date       | Task | Action                                                      | Files modified                                                   | Agent | Human |
| ---------- | ---- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ----- | ----- |
| 2026-05-03 | -    | Scaffold spec/design/tasks per audit Wave 2 recommendation. | `docs/specs/204-app-vscode-spec-services/{spec,design,tasks}.md` | yes   | [x]   |
