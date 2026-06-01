---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "chat", "model-selector", "composer", "search"]
depends_on:
  [
    "100-package-shared",
    "205-app-vscode-model-selection-state",
    "210-app-chat",
    "353-agent-oauth-credential-store",
  ]
---

# App Chat Model Selector - Product Specification

## References

- **Parent App**: [App Chat](../210-app-chat/spec.md)
- **Host Selection State**: [App VSCode Model Selection State](../205-app-vscode-model-selection-state/spec.md)
- **OAuth Store**: [Agent OAuth Credential Store](../353-agent-oauth-credential-store/spec.md)

---

## Problem Statement

The composer model selector must show the active model, billing/source method, and searchable model list without mixing subscription, API-key, local, and external choices. This UI deserves its own zone so selector changes do not overload the broader chat composer spec.

---

## User Stories

### Primary Users

Users choosing a runtime model in the chat composer, and developers maintaining the selector UI.

### Stories

**As a** user
**I want** models grouped by Subscription, API key, Local, and External Agents
**So that** I can see what billing/source path I am choosing.

**As a** user
**I want** search across model names, provider names, and method labels
**So that** I can quickly find the model I need.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                    | Priority  |
| ---- | ---------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Render model rows grouped by `authMethod`/source: Subscription, API key, Local, External.      | Must Have |
| FR-2 | Render duplicate rows when one managed SDK provider has both subscription and API-key methods. | Must Have |
| FR-3 | Render subscription-only providers as subscription rows, not as API-key duplicates.            | Must Have |
| FR-4 | Search by model name/id, provider display/id, method label, and instance label.                | Must Have |
| FR-5 | Show active model name and compact method chip in the trigger.                                 | Must Have |
| FR-6 | Preserve empty, no-results, pre-OAuth, and reconnecting states.                                | Must Have |
| FR-7 | Use existing bridge messages for selection; do not introduce a selector-specific protocol.     | Must Have |

### Non-Functional Requirements

| ID    | Requirement       | Target                                                                        |
| ----- | ----------------- | ----------------------------------------------------------------------------- |
| NFR-1 | Narrow layout     | Trigger remains readable at compact composer widths.                          |
| NFR-2 | Presentation-only | Webview does not inspect secrets to classify auth method.                     |
| NFR-3 | Accessibility     | Searchable popover remains keyboard navigable through existing UI primitives. |
| NFR-4 | Traceability      | Selector component and tests point to this spec/design after migration.       |

---

## Acceptance Criteria

### Selector Behavior

- [ ] Search filters across all visible groups and hides empty groups.
- [ ] Trigger shows active model plus method/source chip.
- [ ] No-match and no-model states are distinct.
- [ ] Subscription-only provider model rows appear when OAuth credentials configure that provider.

### Segmentation

- [ ] Anthropic with both credentials shows distinct subscription and API-key rows.
- [ ] External runtime models remain under External Agents without subscription/API-key labels.

---

## Non-Goals (Out of Scope)

- Persisting selection state in VS Code settings.
- OAuth provider sign-in or provider-card UX.
- Runtime credential injection.

---

## Open Questions

| #   | Question                                        | Status   | Resolution                                            |
| --- | ----------------------------------------------- | -------- | ----------------------------------------------------- |
| 1   | Should plan badges appear on subscription rows? | Deferred | Only if OAuth store later exposes safe plan metadata. |

---

## Dependencies

- Host-provided `AgentModel.authMethod` classification.
- Full selection identity persistence.
- Shared UI popover/command primitives.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Owned surface   | Composer model selector UI                                                                         |
| Owned files     | `apps/chat/src/components/model-combobox.tsx`, `apps/chat/src/components/model-combobox*.test.tsx` |
| Bridge messages | Consumes `agent/models`, sends `chat/setModel`, reflects `agent/status` and `agent/modelChanged`   |
| Settings keys   | Reads no settings directly; host owns persistence                                                  |
| Tests           | Model combobox unit/component tests, Playwright selector screenshots                               |
| Out of scope    | Host restore, provider-card sign-in, OAuth flows                                                   |
