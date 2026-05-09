---
afx: true
type: SPRINT
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-01T17:09:27.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["vscode-clarity-telemetry", "sprint"]
approval:
  spec: Draft # Draft | Approved
  design: Draft # gated on spec: Approved
  tasks: Draft # gated on design: Approved
---

# VSCode Clarity Telemetry — Sprint Brief

> **Format**: Single-document SDD. Carries spec + design + tasks in one file for fast, surgical feature work.
> **Approval gates**: Sections must be approved in order — Spec → Design → Tasks → Code. Track via the `approval` block in frontmatter.
> **Graduation**: Run `/afx-sprint graduate` to split into `spec.md` / `design.md` / `tasks.md` when scope grows. Section structure below mirrors the parent templates (demoted one heading level) so graduation is a clean extract + heading-level promote + `@see` path retarget.

---

<!-- SPRINT-SECTION-START: SPEC (maps to spec.md on graduation — includes References + Section 1 body; drop `## 1. Spec` wrapper, promote ### → ##) -->

## References

- **Implementation target**: Chat + Workbench webviews with Clarity + opt-out controls

---

## 1. Spec

### Problem Statement

AgenticFlowX needs a lightweight, privacy-respecting way to understand how developers use the Chat + Workbench webviews so we can reduce UI friction and improve workflows.

### User Stories

#### Primary Users

- Software developers using AgenticFlowX in VS Code.

#### Stories

**As a** developer using AgenticFlowX
**I want** the product to improve based on real UI usage patterns
**So that** core workflows get faster and less error-prone over time.

**As a** privacy-conscious developer
**I want** to opt out of analytics
**So that** no session replay / behavior analytics is collected from the AgenticFlowX UI.

### Requirements

#### Functional Requirements

| ID   | Requirement                                                                                                       | Priority  |
| ---- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Load Microsoft Clarity in Chat + Workbench webviews when telemetry is allowed (project id `w6orgkccwz`).          | Must Have |
| FR-2 | Provide `afx.telemetry.enabled` as an **opt-out** setting (default `true`).                                       | Must Have |
| FR-3 | Respect VS Code telemetry enablement (`vscode.env.isTelemetryEnabled`) and Do Not Track (`navigator.doNotTrack`). | Must Have |
| FR-4 | Leave broad content masking to the Clarity dashboard, while hard-masking credential entry/status UI locally.      | Should    |

#### Non-Functional Requirements

| ID    | Requirement | Target                                                                                              |
| ----- | ----------- | --------------------------------------------------------------------------------------------------- |
| NFR-1 | Security    | CSP stays minimal; only Clarity domains required for tag + collection.                              |
| NFR-2 | Privacy     | No intentional collection of PII; keep opt-out, DNT/VS Code gates, and dashboard masking available. |

### Acceptance Criteria

- [ ] With defaults (and VS Code telemetry enabled), Clarity initializes in the Chat + Workbench webviews.
- [ ] Setting `afx.telemetry.enabled=false` prevents Clarity from being initialized and stops tracking in-session (best-effort).
- [ ] If VS Code telemetry is disabled (`vscode.env.isTelemetryEnabled === false`), Clarity never initializes even if `afx.telemetry.enabled=true`.
- [ ] If `navigator.doNotTrack` indicates DNT is enabled, Clarity never initializes.
- [ ] No broad local `data-clarity-mask` attributes are applied in AFX markup; credential fields remain hard-masked locally.

### Non-Goals (Out of Scope)

- Sending custom telemetry events from extension host logic.
- Adding any additional third-party analytics providers.
- Implementing user-consent UI flows beyond the opt-out setting and DNT/VS Code respect.

### Open Questions

| #   | Question | Status | Blocking | Resolution |
| --- | -------- | ------ | -------- | ---------- |
| 1   | None     | Closed | No       | -          |

### Dependencies

- None (involves existing webviews + extension settings).

<!-- SPRINT-SECTION-END: SPEC -->

---

<!-- SPRINT-SECTION-START: DESIGN (maps to design.md on graduation; promote ### → ##) -->

## 2. Design

### [DES-OVR] Overview

Add Microsoft Clarity initialization for AFX webviews, gated by `afx.telemetry.enabled` (default on) and hard-disabled when VS Code telemetry is disabled or DNT is enabled. Keep broad content markup unmasked by default, hard-mask credential surfaces locally, and manage other masking from the Clarity dashboard.

### [DES-ARCH] Architecture

#### System Context

- `apps/vscode` computes whether telemetry is allowed (VS Code telemetry + AFX setting).
- `apps/chat` + `apps/workbench` load/stop Clarity at runtime based on the host-sent telemetry state.

### [DES-UI] User Interface & UX

- Expose `afx.telemetry.enabled` in VS Code Settings (tagged `telemetry` + `usesOnlineServices`).
- Settings view may surface a simple toggle or shortcut to open the VS Code setting.

### [DES-DEC] Key Decisions

| Decision                     | Options Considered                                                  | Choice                                                          | Rationale                                            |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Opt-in vs opt-out            | opt-in default off, opt-out default on                              | opt-out default on                                              | Explicit user direction (opt out, default on).       |
| Source of implementation     | bespoke integration, shared webview telemetry conventions           | use the product Clarity project + opt-out wiring                | Keep behavior consistent across AFX webviews.        |
| Masking strategy             | broad local masks, dashboard-managed masking, credential-only masks | credential-only local masks + dashboard-managed content masking | Protect secrets while keeping recordings useful.     |
| Respect global telemetry/DNT | ignore, respect VS Code only, respect both                          | respect both                                                    | Meet VS Code guidance + user request.                |
| State updates                | require reload, dynamic start/stop without reload                   | dynamic best-effort start/stop                                  | Avoid losing chat state by resetting `webview.html`. |

### [DES-API] API Contracts

- `apps/vscode` posts a webview message when telemetry state changes:
  - `agent/telemetryState` (chat webview)
  - `afxTelemetryUpdated` (workbench webview)

### [DES-FILES] File Structure

| File                                        | Purpose                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| `apps/vscode/package.json`                  | Adds `afx.telemetry.enabled` setting + telemetry manifest. |
| `apps/vscode/src/panels/webview-html.ts`    | CSP allowlist for Clarity domains.                         |
| `apps/vscode/src/panels/sidebar-panel.ts`   | Broadcast telemetry state + respond to setting changes.    |
| `apps/vscode/src/panels/workbench-panel.ts` | Broadcast telemetry state into workbench webview.          |
| `apps/chat/src/lib/clarity.ts`              | Load/stop Clarity in chat webview.                         |
| `apps/chat/src/app.tsx`                     | Hook telemetry state updates to Clarity lifecycle.         |
| `apps/workbench/src/lib/clarity.ts`         | Load/stop Clarity in workbench webview.                    |
| `apps/workbench/src/main.tsx`               | Initialize Clarity + listen for telemetry updates.         |

### [DES-SEC] Security Considerations

- Only enable network access to Clarity endpoints required for the tracking tag.
- No unsafe inline scripts required; initialization performed by bundled webview JS.
- Do not apply broad local `data-clarity-mask` attributes; keep API key fields hard-masked and configure broader masking in Clarity dashboard.

### [DES-ROLLOUT] Rollout Plan

- Default is enabled (opt-out). Users can disable via `afx.telemetry.enabled=false`.
- If VS Code telemetry is disabled, AFX telemetry is always disabled.

<!-- SPRINT-SECTION-END: DESIGN -->

---

<!-- SPRINT-SECTION-START: TASKS (maps to tasks.md on graduation; promote ### → ##, #### → ###) -->

## 3. Tasks

### Phase 1: Extension settings + host wiring

#### 1.1 Add config + manifest metadata

<!-- files: apps/vscode/package.json -->
<!-- @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [FR-2] [NFR-1] -->

- [ ] Add `afx.telemetry.enabled` boolean setting (`default: true`) with tags `telemetry`, `usesOnlineServices`.
- [ ] Add extension manifest `telemetry.url` pointing at Clarity.

#### 1.2 Broadcast telemetry state to webviews

<!-- files: apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [FR-1] [FR-3] [DES-ARCH] -->

- [ ] Compute `telemetryAllowed = afxSetting && vscode.env.isTelemetryEnabled` in host.
- [ ] Subscribe to config changes + `vscode.env.onDidChangeTelemetryEnabled` and broadcast updates.

#### 1.3 CSP allowlist for Clarity domains

<!-- files: apps/vscode/src/panels/webview-html.ts -->
<!-- @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [NFR-1] [DES-SEC] -->

- [ ] Allow `https://www.clarity.ms` + `https://*.clarity.ms` in `script-src`, `connect-src`, and `img-src` for chat/workbench webviews.

### Phase 2: Webview loader + targeted masking

#### 2.1 Implement Clarity lifecycle in chat webview

<!-- files: apps/chat/src/lib/clarity.ts, apps/chat/src/app.tsx, apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/components/provider-card.tsx -->
<!-- @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [FR-1] [FR-3] [FR-4] [DES-API] -->

- [ ] Implement `loadClarity()` with tag `w6orgkccwz`; hard-mask provider API key fields locally and leave prompt/transcript masking to dashboard rules.
- [ ] Respect `navigator.doNotTrack`.
- [ ] On disable, call `window.clarity('consent', false)` best-effort.

#### 2.2 Implement Clarity lifecycle in workbench webview

<!-- files: apps/workbench/src/lib/clarity.ts, apps/workbench/src/main.tsx, apps/workbench/src/app.tsx -->
<!-- @see docs/specs/vscode-clarity-telemetry/vscode-clarity-telemetry.md [FR-1] [FR-3] [FR-4] [DES-API] -->

- [ ] Implement the same loader + stop behavior in workbench.
- [ ] Hook into `window.message` listener to react to host updates.

### Cross-Reference Index

| Task | Spec Requirement       | Design Section |
| ---- | ---------------------- | -------------- |
| 1.1  | [FR-2], [NFR-1]        | [DES-FILES]    |
| 1.2  | [FR-1], [FR-3]         | [DES-ARCH]     |
| 1.3  | [NFR-1]                | [DES-SEC]      |
| 2.1  | [FR-1], [FR-3], [FR-4] | [DES-API]      |
| 2.2  | [FR-1], [FR-3], [FR-4] | [DES-API]      |

<!-- SPRINT-SECTION-END: TASKS -->

---

<!-- SPRINT-SECTION-START: SESSIONS (appended to tasks.md on graduation — tasks-template.md requires Work Sessions as the last section) -->

## 4. Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in vscode-clarity-telemetry.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-sprint code, /afx-task pick, /afx-task code, /afx-task complete -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action (Picked/Coded/Completed/Verified/Reviewed) | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |

<!-- SPRINT-SECTION-END: SESSIONS -->
