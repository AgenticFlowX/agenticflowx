---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "vscode", "model-selection", "persistence", "runtime-state"]
depends_on:
  [
    "100-package-shared",
    "200-app-vscode",
    "217-app-chat-model-selector",
    "353-agent-oauth-credential-store",
  ]
---

# App VSCode Model Selection State - Product Specification

## References

- **Parent App**: [App VSCode](../200-app-vscode/spec.md)
- **Shared Contracts**: [Package Shared](../100-package-shared/spec.md)
- **Selector UI**: [App Chat Model Selector](../217-app-chat-model-selector/spec.md)
- **OAuth Store**: [Agent OAuth Credential Store](../353-agent-oauth-credential-store/spec.md)

---

## Problem Statement

The chat webview renders model choices, but VS Code owns durable selection state, runtime validation, fallback, and bridge payloads. This host-side behavior needs a small spec so future changes to model identity do not require reading composer, Settings, OAuth, and agent manager docs at once.

---

## User Stories

### Primary Users

Developers maintaining model routing, restore behavior, and bridge messages between the chat webview and extension host.

### Stories

**As a** user
**I want** my selected model variant to restore exactly after reload
**So that** billing path, provider, model, and runtime instance stay predictable.

**As a** developer
**I want** host validation to fall back safely when saved state is stale
**So that** model restore never throws or silently routes to the wrong credential.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                   | Priority  |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Persist full selection identity in `afx.model.defaultSelection`.                                              | Must Have |
| FR-2 | Continue reading and writing legacy `afx.sdk.defaultModel` for SDK compatibility.                             | Must Have |
| FR-3 | Extend existing model/status bridge payloads with `authMethod` without adding a new selection message family. | Must Have |
| FR-4 | Validate saved selection against currently available models before applying it.                               | Must Have |
| FR-5 | Persist and restore external runtime selections as full identities when possible.                             | Must Have |
| FR-6 | Coordinate same-provider method flips with active-method storage and Pi SDK restart ownership.                | Must Have |

### Non-Functional Requirements

| ID    | Requirement    | Target                                                        |
| ----- | -------------- | ------------------------------------------------------------- |
| NFR-1 | Fail safe      | Stale or unavailable selections fall back visibly and safely. |
| NFR-2 | Compatibility  | Existing `afx.sdk.defaultModel` users keep working.           |
| NFR-3 | Traceability   | Bridge/state code points to this spec after migration.        |
| NFR-4 | No secret leak | Persisted model identity contains no credential material.     |

---

## Acceptance Criteria

### Restore And Fallback

- [ ] Reload restores `{ instanceId, provider, modelId, authMethod }` when available.
- [ ] Stale SDK model ids fall back to a valid SDK/default selection and persist the fallback.
- [ ] Disabled external runtime with a saved external selection does not throw.

### Method Coordination

- [ ] Selecting a Pi SDK row with subscription/API-key `authMethod` writes the matching active method before runtime respawn.
- [ ] Host status and model-changed events keep the trigger aligned after host-originated changes.

---

## Non-Goals (Out of Scope)

- Rendering the selector menu.
- Provider sign-in UX.
- OAuth token refresh or credential injection.

---

## Open Questions

| #   | Question                                           | Status   | Resolution                                                                  |
| --- | -------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| 1   | Should external runtimes ever supply auth markers? | Deferred | External models remain unclassified until a runtime provides safe metadata. |

---

## Dependencies

- Shared `AgentModel`, `AgentRuntimeModel`, and bridge message contracts.
- OAuth active-method storage for subscription/API-key routing.
- Multiplexed agent manager model discovery.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owned surface   | VS Code host-side model selection persistence and restore                                                                                                                                  |
| Owned files     | `apps/vscode/src/model-default-selection.ts`, `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/extension.ts`, `packages/shared/src/agent.ts`, `packages/shared/src/messages.ts` |
| Bridge messages | `chat/setModel`, `agent/models`, `agent/status`, `agent/modelChanged`                                                                                                                      |
| Settings keys   | `afx.model.defaultSelection`, `afx.sdk.defaultModel`                                                                                                                                       |
| Tests           | `apps/vscode/src/model-default-selection*.test.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, shared message tests                                                                   |
| Out of scope    | Visual selector layout, provider cards, OAuth flows                                                                                                                                        |
