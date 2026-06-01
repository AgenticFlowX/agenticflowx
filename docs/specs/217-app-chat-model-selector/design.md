---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "chat", "model-selector", "composer", "search"]
spec: spec.md
---

# App Chat Model Selector - Technical Design

## [DES-OVR] Overview

The composer selector is a presentation component over host-classified models. It renders a searchable popover, groups rows by method/source, and sends existing `chat/setModel` messages with full row identity.

---

## [DES-ARCH] Architecture

```
agent/models + agent/status
        |
        v
Chat controller state
        |
        v
ModelCombobox
  - build groups
  - filter rows
  - render trigger chip
  - send chat/setModel
```

The webview never reads credentials. It trusts `AgentModel.authMethod` and `source` from the host.

---

## [DES-SEG] Segmentation

| Row classifier                        | Group           |
| ------------------------------------- | --------------- |
| `authMethod === "subscription"`       | Subscription    |
| `authMethod === "api-key"`            | API key         |
| `authMethod === "local"`              | Local           |
| no `authMethod` and external instance | External Agents |

The row key includes `instanceId`, `provider`, `modelId`, and `authMethod ?? "external"`.

---

## [DES-SEARCH] Search

Search includes:

- model display name
- model id
- provider display name and provider id
- method label
- external instance label

Empty groups are hidden during search. A no-results state appears only when all groups are empty after filtering.

---

## [DES-UI] ASCII Surface Maps

### SM-SEL-TRIGGER

```
+----------------------------------------------------+
| [Model icon] gpt-5.5                         [Sub] |
+----------------------------------------------------+
```

### SM-SEL-EXPANDED

```
+----------------------------------------------------+
| Search models...                                   |
|                                                    |
| Subscription                                       |
|   ChatGPT (Codex) / gpt-5.5                 [Sub] |
|   Anthropic / claude-opus-4-7              [Sub]  |
| API key                                            |
|   OpenAI / gpt-5.4                           [Key] |
| Local                                              |
|   Ollama / llama3                           [Local]|
| External Agents                                    |
|   pi-rpc / current external model           [Ext]  |
|                                                    |
|                                  [Settings button] |
+----------------------------------------------------+
```

### SM-SEL-EMPTY

```
+----------------------------------------------------+
| No models configured                               |
|                                  [Open Settings]   |
+----------------------------------------------------+
```

### SM-SEL-RECONNECT

```
+----------------------------------------------------+
| Reconnecting selected provider...                  |
| Current model remains visible while host restarts. |
+----------------------------------------------------+
```

---

## [DES-TEST] Testing Strategy

- Component tests cover grouping, search, no-results, trigger text, row keys, and selection payload.
- E2E screenshot tests cover trigger, expanded menu, subscription/API/local/external groups, and empty states.
- Mock transport must mirror host `authMethod` and Settings provider metadata.

---

## File Reference Map

| Task | File                                                | Required @see                                                                      |
| ---- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1.1  | `apps/chat/src/components/model-combobox.tsx`       | `docs/specs/217-app-chat-model-selector/design.md [DES-UI] [DES-SEG] [DES-SEARCH]` |
| 1.2  | `apps/chat/src/components/model-combobox*.test.tsx` | `docs/specs/217-app-chat-model-selector/design.md [DES-TEST]`                      |
| 1.3  | `apps/chat/e2e/model-selector.spec.ts`              | `docs/specs/217-app-chat-model-selector/design.md [DES-UI]`                        |

---

## Open Technical Questions

| #   | Question                                                          | Status   |
| --- | ----------------------------------------------------------------- | -------- |
| 1   | Should future external runtimes provide safe auth/source markers? | Deferred |
