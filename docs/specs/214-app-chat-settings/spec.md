---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-05T11:38:55.000Z"
approved_at: "2026-05-05T11:45:45.000Z"
tags: ["app", "chat", "settings", "providers"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "131-package-ui-design-system",
    "210-app-chat",
    "350-agent-manager",
  ]
---

# App Chat Settings - Product Specification

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

Provider selection, API key UX, runtime readiness, settings snapshots, and theme preview behavior need a targeted home separate from composer and message rendering.

---

## User Stories

### Primary Users

Users configuring chat providers and developers maintaining settings UX.

### Stories

**As a** user
**I want** provider/runtime settings to explain what is ready and what needs configuration
**So that** I can make the agent usable without reading implementation details

**As an** AI agent
**I want** settings source files to route to one spec
**So that** provider card or API key updates avoid composer/message regressions

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                | Priority    |
| ---- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Own chat settings panel layout, provider cards, API key form states, and runtime readiness copy            | Must Have   |
| FR-2 | Own settings snapshot consumption and presentation inside the chat webview                                 | Must Have   |
| FR-3 | Own theme preview UX inside settings while shared theme contracts remain in `131-package-ui-design-system` | Should Have |
| FR-4 | Keep runtime selection contracts aligned with `350-agent-manager`                                          | Must Have   |
| FR-5 | Own the persistent active-file context preference and mirror it into the composer default                  | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                     | Target                                                                  |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| NFR-1 | Sensitive provider data is never exposed in UI logs or examples | No API keys in logs/docs                                                |
| NFR-2 | Settings UX remains recoverable                                 | Failed snapshots/provider updates show clear retry/configuration states |

---

## Acceptance Criteria

### Settings Ownership

- [ ] Settings view and provider card files route to this spec
- [ ] Runtime/provider UX depends on `350-agent-manager` instead of duplicating runtime contracts
- [ ] Theme preview UI uses `131-package-ui-design-system` for shared appearance contract
- [ ] Active-file context preference is surfaced in Settings and mirrored into the composer default

---

## Non-Goals (Out of Scope)

- Composer footer/input behavior
- Pi RPC implementation
- Shared token definitions
- VSCode secret storage implementation
- Composer toolbar quick-toggle rendering

---

## Open Questions

None.

---

## Dependencies

- `100-package-shared`
- `110-package-transport`
- `131-package-ui-design-system`
- `350-agent-manager`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Chat settings panel, provider cards, API key/runtime readiness UX, settings snapshot UI                                                                                                                              |
| Owned files     | `apps/chat/src/views/settings.tsx`, `apps/chat/src/components/provider-card.tsx`, `apps/chat/src/components/external-agent-card.tsx`, `apps/chat/src/lib/settings-snapshot.ts`, `apps/chat/src/lib/theme-preview.ts` |
| Local anchors   | Settings component sections, provider card components, runtime recovery card, snapshot normalization, appearance preview helpers, settings bridge handlers                                                           |
| Bridge messages | Settings snapshot, provider update, runtime status/configuration payloads, active-file context preference                                                                                                            |
| Settings keys   | Provider, model, API key status, appearance selections shown in chat settings, `afx.context.includeActiveFileContext`                                                                                                |
| Commands        | Settings panel actions inside the chat webview                                                                                                                                                                       |
| Tests           | Settings view tests, provider card tests, snapshot helper tests                                                                                                                                                      |
| Dependencies    | `350-agent-manager`, `351-agent-pi`, `131-package-ui-design-system`                                                                                                                                                  |
| Out of scope    | Secret persistence internals, Pi RPC, composer send behavior                                                                                                                                                         |
| Example prompts | "Update provider card copy", "Change API key empty state", "Adjust settings theme preview"                                                                                                                           |

### Glossary

| Term              | Definition                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Settings snapshot | Shared payload describing current host/runtime/provider configuration for webview display |
