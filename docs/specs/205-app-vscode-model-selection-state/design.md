---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "vscode", "model-selection", "persistence", "runtime-state"]
spec: spec.md
---

# App VSCode Model Selection State - Technical Design

## [DES-OVR] Overview

The VS Code host owns durable model identity and safe restore. The webview chooses a row; the host validates it against live models, updates active method when needed, persists full identity, and emits existing model/status events.

---

## [DES-FLOW] Selection Flow

```
ModelCombobox
  -> chat/setModel { instanceId, provider, modelId, authMethod? }
       -> SidebarPanel / Extension host
          -> validate against MultiplexedAgentManager.getAvailableModels()
          -> if SDK authMethod: write afx.authMethod.{provider}
          -> if same provider method flip: schedule Pi SDK restart
          -> persist afx.model.defaultSelection
          -> emit agent/modelChanged + agent/status.model
```

Restore flow:

```
load afx.model.defaultSelection
  -> parse v1 JSON
  -> fallback to legacy afx.sdk.defaultModel if missing/invalid
  -> reconcile authMethod with active method store
  -> validate against available models
  -> persist fallback when stale
```

---

## [DES-DATA] Data Model

```typescript
interface ModelDefaultSelectionV1 {
  version: 1;
  source: "sdk" | "external";
  instanceId?: string;
  provider?: string;
  modelId: string;
  authMethod?: "subscription" | "api-key" | "local";
}
```

Legacy format remains `afx.sdk.defaultModel = "<provider>:<modelId>"` for SDK selections.

---

## [DES-API] Bridge Contracts

No new message family is introduced. Existing messages carry full identity:

| Message              | Ownership                                 |
| -------------------- | ----------------------------------------- |
| `chat/setModel`      | Webview selection request                 |
| `agent/models`       | Host model list with `authMethod`         |
| `agent/status.model` | Active runtime model                      |
| `agent/modelChanged` | Host-originated active-model notification |

---

## [DES-ERR] Error Handling

| Scenario                               | Handling                                                      |
| -------------------------------------- | ------------------------------------------------------------- |
| Saved selection parse fails            | Ignore full selection and try legacy setting                  |
| Saved model unavailable                | Fall back to valid runtime/default model and persist fallback |
| Requested auth method lacks credential | Reject visibly; do not silently route another method          |
| External runtime disabled              | Fall back to SDK/default selection                            |

---

## [DES-TEST] Testing Strategy

- Parser/formatter unit tests cover valid, invalid, and legacy cases.
- Host tests cover SDK/external restore, stale fallback, active-method write, and same-provider restart.
- Shared message tests cover `authMethod` payload compatibility.

---

## File Reference Map

| Task | File                                         | Required @see                                                          |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 1.1  | `apps/vscode/src/model-default-selection.ts` | `docs/specs/205-app-vscode-model-selection-state/design.md [DES-DATA]` |
| 1.2  | `apps/vscode/src/panels/sidebar-panel.ts`    | `docs/specs/205-app-vscode-model-selection-state/design.md [DES-FLOW]` |
| 1.3  | `packages/shared/src/agent.ts`               | `docs/specs/205-app-vscode-model-selection-state/design.md [DES-API]`  |
| 1.4  | `packages/shared/src/messages.ts`            | `docs/specs/205-app-vscode-model-selection-state/design.md [DES-API]`  |

---

## Open Technical Questions

| #   | Question                                                             | Status |
| --- | -------------------------------------------------------------------- | ------ |
| 1   | Should model identity gain a schema version for bridge payloads too? | Open   |
