---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [dx, testing, vitest, playwright, vscode-test, e2e]
---

# DX Testing — Product Specification

## References

- **Architecture**: [AGENTS.md — Verification requirements](../../../AGENTS.md)

---

## Problem Statement

Three test surfaces exist: package unit tests, webview UI E2E tests, and VSCode extension host E2E tests. Each requires a different runner with different environment requirements.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                    | Priority    |
| ---- | ---------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Vitest workspace runs unit tests across all packages with V8 coverage                          | Must Have   |
| FR-2 | Playwright tests `apps/chat` webview in Chromium (headless)                                    | Must Have   |
| FR-3 | vscode-test-electron runs compiled `apps/vscode-e2e` extension host tests on linux and windows | Must Have   |
| FR-4 | Coverage reports generated to `coverage/` directory                                            | Should Have |

### Non-Functional Requirements

| ID    | Requirement                                                     | Target        |
| ----- | --------------------------------------------------------------- | ------------- |
| NFR-1 | Unit tests complete in < 60s                                    | CI timing     |
| NFR-2 | Playwright tests install Chromium only (not full browser suite) | CI disk usage |

---

## Non-Goals

- No snapshot testing
- No visual regression testing

---

## Dependencies

- `vitest`, `@vitest/coverage-v8`
- `playwright`, `@playwright/test`
- `@vscode/test-cli`, `@vscode/test-electron`
