---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["cross-cutting", "telemetry", "clarity"]
spec: spec.md
---

# Cross Telemetry - Technical Design

---

## [DES-OVR] Overview

The telemetry zone owns shared Clarity/event helper behavior used across webviews.

---

## [DES-ARCH] Architecture

```text
App surface event → app telemetry helper → external telemetry provider
```

Telemetry helpers must fail closed/non-blocking.

---

## [DES-UI] User Interface & UX

No direct UI is owned here. If a telemetry setting or notice is added, the owning app settings spec controls presentation.

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                                        | Choice                | Rationale                            |
| --------------- | --------------------------------------------------------- | --------------------- | ------------------------------------ |
| Telemetry range | App-specific specs, unnumbered telemetry spec, cross spec | `901-cross-telemetry` | Behavior spans multiple app surfaces |

---

## [DES-DATA] Data Model

Telemetry payloads are minimal event names and approved metadata. Raw prompts, secrets, file contents, and API keys are forbidden.

---

## [DES-API] API Contracts

Telemetry helpers expose initialization and event-recording functions for app surfaces.

```typescript
// Each app webview exposes a single toggle:
export function setClarityEnabled(enabled: boolean): void;
```

Internally the helper bootstraps the Clarity script lazily, applies session dimensions, manages
`consentv2`, and respects DNT. There is no public custom-event API today; tracking is
session-level only.

---

## [DES-TELEMETRY-CATALOG] Telemetry Surface Catalog

The full telemetry surface today. Two axes: **session dimensions** (set on session start to filter
recordings inside Clarity), and **consent transitions** (driven by VS Code telemetry preference
plus `afx.telemetry.enabled`). There are **no custom event payloads**; if custom events are added
in the future, each must arrive with a privacy review and a row in `[DES-TELEMETRY-EVENTS]`
below.

### Session dimensions (always set when enabled)

| Dimension     | Values                | Source                                                  | Owning spec           |
| ------------- | --------------------- | ------------------------------------------------------- | --------------------- |
| `afx_app`     | `chat` \| `workbench` | `apps/{chat,workbench}/src/lib/clarity.ts` `tagSession` | `901-cross-telemetry` |
| `afx_surface` | `sidebar` \| `panel`  | `apps/{chat,workbench}/src/lib/clarity.ts` `tagSession` | `901-cross-telemetry` |

These dimensions identify the AFX surface within a Clarity session and are the **only** AFX-shaped
data sent. No prompts, message content, file paths, secrets, or model identifiers leave the
device.

### Consent / lifecycle transitions

| Trigger                                    | Effect                                                                                                 | Owning spec                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `afx.telemetry.enabled = true` and DNT off | Bootstrap Clarity tag, `consentv2: { ad_Storage: denied, analytics_Storage: granted }`, set dimensions | `901-cross-telemetry`               |
| `afx.telemetry.enabled = false` or DNT on  | `consentv2: { ad_Storage: denied, analytics_Storage: denied }`, `consent(false)`                       | `901-cross-telemetry`               |
| VS Code `telemetry.telemetryLevel = off`   | Treat as opt-out (driven from host into webview via settings snapshot)                                 | `214-app-chat-settings`             |
| Webview boot                               | Read snapshot, call `setClarityEnabled` once                                                           | `210-app-chat`, `220-app-workbench` |

### [DES-TELEMETRY-EVENTS] Custom event allowlist (none today; future-only)

If custom events are introduced, each MUST appear in this table with payload, privacy notes, and
the event-emitting zone. Until then this list is intentionally empty.

| Event  | Payload | Trigger | Privacy notes |
| ------ | ------- | ------- | ------------- |
| (none) |         |         |               |

Privacy column is mandatory: an event with no privacy entry should fail review.

---

## [DES-FILES] File Structure

| File                                | Purpose                    |
| ----------------------------------- | -------------------------- |
| `apps/chat/src/lib/clarity.ts`      | Chat telemetry helper      |
| `apps/workbench/src/lib/clarity.ts` | Workbench telemetry helper |

---

## [DES-DEPS] Dependencies

`210-app-chat`, `220-app-workbench`, and surface child specs that introduce events.

---

## [DES-SEC] Security Considerations

- Do not send secrets, prompts, raw file contents, or credentials.
- Treat telemetry as optional and non-blocking.

---

## [DES-ERR] Error Handling

| Scenario             | Handling                            |
| -------------------- | ----------------------------------- |
| Provider unavailable | No-op and keep app functioning      |
| Invalid payload      | Drop sensitive/unsupported metadata |

---

## [DES-TEST] Testing Strategy

Test helper no-op behavior and privacy guards when telemetry behavior changes.

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget Clarity refs from the unnumbered telemetry spec to `901-cross-telemetry`.

### Rollback Plan

If telemetry becomes single-surface only, retarget to that app child spec and retire this cross spec.

---

## File Reference Map

| Task | File                                | Required @see         |
| ---- | ----------------------------------- | --------------------- |
| 1.x  | `apps/chat/src/lib/clarity.ts`      | `design.md [DES-API]` |
| 1.x  | `apps/workbench/src/lib/clarity.ts` | `design.md [DES-API]` |

---

## Open Technical Questions

None.
