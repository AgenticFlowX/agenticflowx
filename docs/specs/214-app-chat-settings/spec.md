---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.4"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: ["app", "chat", "settings", "providers", "mode", "workspace-mode", "custom-models"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "131-package-ui-design-system",
    "210-app-chat",
    "350-agent-manager",
    "351-agent-pi",
  ]
---

# App Chat Settings - Product Specification

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

Provider selection, API key UX, runtime readiness, settings snapshots, workspace mode selection, and theme preview behavior need a targeted home separate from composer and message rendering.

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

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Priority    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Own chat settings panel layout, per-runtime instance cards, provider cards, API key form states, and runtime readiness copy across all registered runtimes (Pi RPC, Pi SDK)                                                                                                                                                                                                                                                                                                                           | Must Have   |
| FR-2  | Own settings snapshot consumption and presentation inside the chat webview                                                                                                                                                                                                                                                                                                                                                                                                                            | Must Have   |
| FR-3  | Own theme preview UX inside settings while shared theme contracts remain in `131-package-ui-design-system`                                                                                                                                                                                                                                                                                                                                                                                            | Should Have |
| FR-4  | Keep runtime selection contracts aligned with `350-agent-manager`                                                                                                                                                                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-5  | Own the persistent active-file context preference and mirror it into the composer default                                                                                                                                                                                                                                                                                                                                                                                                             | Must Have   |
| FR-6  | Own the workspace mode card and its shared snapshot copy, including Code default full access and Explore read-only/experimental posture for inspection, tracing, and planning                                                                                                                                                                                                                                                                                                                         | Must Have   |
| FR-7  | Extend the workspace mode card with a third Spec entry (planning-only posture with violet accent), and surface a one-time onboarding flag store (`afx.specModeOfferDismissed`, `afx.specModeTooltipSeen`, `afx.docActionsTooltipSeen`) in the settings snapshot so the chat composer can drive its onboarding strips and tooltips                                                                                                                                                                     | Must Have   |
| FR-8  | Surface a Custom Models sub-tab inside Models with a `Track: [Pi SDK] [Pi RPC]` selector. The Pi SDK track lists AFX-managed providers from VSCode SecretStorage; the Pi RPC track lists hand-edited entries from `~/.pi/agent/models.json` (read-only, with an "Open in editor" button per row that re-uses the existing `chat/openModelsJson` deep-link).                                                                                                                                           | Should Have |
| FR-9  | Provide structured Add/Edit forms inside the Pi SDK track for custom providers (id, displayName, baseUrl, api kind, apiKeySource, authHeader, per-api compat flags from `COMPAT_FLAGS_BY_API`) and per-model entries (id, name, api override, capabilities, contextWindow, maxTokens, cost). Forms use only `@afx/ui/components/*` shadcn primitives and Lucide React icons — no custom widgets or one-off styles. Provider Remove uses an inline two-click confirm (Webviews block `window.confirm`) | Should Have |
| FR-10 | Store all custom-provider data — apiKey value, baseUrl, models, headers, opaque compat — in VSCode SecretStorage. The host→webview bridge carries only `CustomProviderSummary` and `CustomProviderModelSummary`: id, displayName, baseUrl, api kind, modelCount, redacted models[] (id/name/contextWindow/maxTokens/capabilities), apiKeySource, apiKeyLabel, hasApiKey, authHeader, UI-known compatFlags (booleans only). AFX never writes to `~/.pi/agent/models.json` from either track            | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                        | Target                                                                                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | The apiKey value, full opaque `compat` blob, and `headers` map never cross the host→webview bridge. Only `CustomProviderSummary` (id, displayName, baseUrl, api kind, modelCount, redacted models[], apiKeySource, apiKeyLabel, hasApiKey, authHeader, UI-known compatFlags) reaches the webview. Sensitive data never appears in UI logs/examples | No apiKey value, opaque compat, or header secrets in logs/docs/bridge payloads. `assertNoSecretLeak` passes for every snapshot; e2e asserts `~/.pi/agent/models.json` mtime is unchanged after AFX writes |
| NFR-2 | Settings UX remains recoverable                                                                                                                                                                                                                                                                                                                    | Failed snapshots/provider updates show clear retry/configuration states                                                                                                                                   |
| NFR-3 | Every visible control surfaces label, description, and tooltip in-place; no behaviour requires external documentation to understand                                                                                                                                                                                                                | Reviewer test: a first-time user with no docs can identify what each control does, what it changes, and the default value, by reading on-screen text alone                                                |

---

## Acceptance Criteria

### Settings Ownership

- [ ] Settings view and provider card files route to this spec
- [ ] Runtime/provider UX depends on `350-agent-manager` instead of duplicating runtime contracts
- [ ] Theme preview UI uses `131-package-ui-design-system` for shared appearance contract
- [ ] Active-file context preference is surfaced in Settings and mirrored into the composer default
- [ ] Workspace mode card is surfaced in Settings and mirrors the host snapshot
- [ ] Each registered `AgentInstance` (Pi RPC, Pi SDK) renders its own card under the Runtimes group; Behaviour controls show an explicit "Active: …" scope label per `350-agent-manager [DES-AGENT-BEHAVIOUR-ROUTING]`
- [ ] Models tab is sub-tabbed (`Built-in` / `Custom Models`); Custom Models carries a `Track: [Pi SDK] [Pi RPC]` selector per `351-agent-pi [DES-PI-CUSTOM-PROVIDERS]`
- [ ] Pi SDK track surfaces AFX-managed providers from VSCode SecretStorage with full Add/Edit/Delete CRUD via structured forms (preset picker, custom-provider-form, custom-model-form, api-key-source-input) using only `@afx/ui/components/*` and Lucide React icons
- [ ] Pi RPC track surfaces hand-edited entries from `~/.pi/agent/models.json` as read-only cards with an "Open in editor" button per row (re-uses existing `chat/openModelsJson` deep-link); AFX never writes to this file
- [ ] Webview snapshot for both tracks contains only `CustomProviderSummary` (id, baseUrl, api kind, model count, key-resolution label) — never apiKey, models[], compat, or headers
- [ ] Pi SDK track adds a Custom Models entry to the chat model picker so AFX-managed providers are selectable for chat sessions, mirroring built-in provider behaviour

---

## Non-Goals (Out of Scope)

- Composer footer/input behavior
- Pi RPC implementation
- Shared token definitions
- VSCode secret storage implementation
- Composer toolbar quick-toggle rendering
- AFX writing to `~/.pi/agent/models.json` (Pi RPC track is read-only display only)
- AFX editing `~/.pi/agent/models.json` in-place from the UI — power users edit in the text editor via `chat/openModelsJson`
- `↪ OVERRIDE` and `⊜ TWEAKS` provider variants in the structured forms (deferred; available via `Open in editor`)
- oh-my-pi and opencode adapter implementations (architecture is harness-agnostic per `[ADR-0008]`; concrete adapters land in separate iterations)

---

## ASCII UI Mockup

```text
+--------------------------------------------------------------+
| Settings                                                     |
|--------------------------------------------------------------|
| Modes                                                        |
|                                                              |
|  ( ) Code     Default. Full access. Pi can act and edit.    |
|  (*) Explore  Experimental. Read-only for inspection,      |
|              tracing, and planning. Host blocks shell       |
|              commands before they spawn.                    |
|                                                              |
|  The model stays shared across both modes.                  |
+--------------------------------------------------------------+
```

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
