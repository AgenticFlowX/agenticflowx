---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["cross-cutting", "telemetry", "clarity"]
depends_on: ["210-app-chat", "220-app-workbench"]
---

# Cross Telemetry - Product Specification

## References

- **Routing Spec**: [Project Overview](../001-overview/spec.md)

---

## Problem Statement

Clarity/telemetry code exists in multiple webviews. Because this behavior spans chat and workbench, it needs a numbered cross-cutting living spec instead of an unnumbered VSCode telemetry folder.

---

## User Stories

### Primary Users

Developers instrumenting product behavior and users whose privacy must be respected.

### Stories

**As a** developer
**I want** one telemetry spec across webviews
**So that** event behavior stays consistent and traceable

**As a** user
**I want** telemetry to avoid sensitive data
**So that** product instrumentation does not leak private content

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                              | Priority    |
| ---- | ---------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Own Clarity/telemetry initialization and event behavior shared across chat and workbench | Must Have   |
| FR-2 | Define privacy boundaries for telemetry payloads and disabled/fallback states            | Must Have   |
| FR-3 | Coordinate with app child specs for surface-specific event naming                        | Should Have |

### Non-Functional Requirements

| ID    | Requirement                                                               | Target                                                      |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| NFR-1 | Telemetry never includes secrets, prompts, raw file contents, or API keys | Required                                                    |
| NFR-2 | Telemetry failure is non-blocking                                         | App surfaces continue working when telemetry is unavailable |

---

## Acceptance Criteria

### Telemetry Ownership

- [ ] Chat and workbench telemetry files route to this spec
- [ ] App-specific specs document event intent when introducing new surface behavior
- [ ] Unnumbered telemetry refs are removed from source

---

## Non-Goals (Out of Scope)

- Full analytics dashboard UI
- CI reporting
- User auth/cloud telemetry services unless explicitly specified later

---

## Open Questions

None.

---

## Dependencies

- `210-app-chat`
- `220-app-workbench`
- App child specs that emit surface-specific events

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------- |
| Owned surface   | Cross-webview telemetry and Clarity helpers                                                  |
| Owned files     | `apps/chat/src/lib/clarity.ts`, `apps/workbench/src/lib/clarity.ts`                          |
| Local anchors   | Telemetry init helpers, event recorders, no-op/privacy guards                                |
| Bridge messages | Telemetry opt/config payloads if introduced                                                  |
| Settings keys   | Telemetry enable/disable setting if introduced                                               |
| Commands        | None directly                                                                                |
| Tests           | Telemetry helper tests and app smoke tests when instrumentation changes                      |
| Dependencies    | `210-app-chat`, `220-app-workbench`, surface child specs                                     |
| Out of scope    | Analytics dashboard UI, auth/cloud integrations                                              |
| Example prompts | "Disable telemetry in dev", "Rename Clarity event", "Add privacy guard to telemetry payload" |

### Glossary

| Term      | Definition                                        |
| --------- | ------------------------------------------------- |
| Telemetry | Product instrumentation emitted from AFX surfaces |
