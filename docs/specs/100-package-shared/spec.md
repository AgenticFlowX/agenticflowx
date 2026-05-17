---
afx: true
type: SPEC
status: Living
 owner: "@rixrix"
 version: "1.4"
 created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: [package, shared, protocol, types, agent, logging, mode, workspace-mode]
---

# @afx/shared — Product Specification

## References

- **Architecture**: [AGENTS.md — packages/shared](../../../AGENTS.md)

---

## Problem Statement

Apps and packages need a shared, typed message protocol and domain type library that is free of framework dependencies. Without it, message shapes drift between the extension host, webview apps, and parsers.

---

## User Stories

### Primary Users

Extension host (`apps/vscode`), webview apps (`apps/chat`, `apps/workbench`), and parsers (`packages/parsers`).

### Stories

**As a** webview app
**I want** typed message discriminators
**So that** I can pattern-match on incoming messages without runtime guessing

**As a** developer
**I want** domain types for Task, Spec, Phase, Discussion
**So that** all packages share a single source of truth for data shapes

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                       | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Typed discriminated-union protocol: `ChatToAgent` and `AgentToChat` message families                                                                                                                                                                                                                                                              | Must Have   |
| FR-2  | View types: `ChatMessageView`, `ChatToolView`, `ChatUsageView` for rendering streaming output                                                                                                                                                                                                                                                     | Must Have   |
| FR-3  | Domain types: `Task`, `Spec`, `Phase`, `Feature`, `Discussion`, `Mode`, `WorkspaceMode`, `Provider`                                                                                                                                                                                                                                               | Must Have   |
| FR-4  | Workbench protocol: `WorkbenchToHost`, `HostToWorkbench` message families                                                                                                                                                                                                                                                                         | Should Have |
| FR-5  | Runtime-agnostic agent contract: `AgentManager`, `AgentEvent`, `AgentStatus`, `AgentUsageStats`, `AgentUiRequest`, `AgentUiResponse`, `Disposable` — implemented by every agent adapter, starting with Pi                                                                                                                                         | Must Have   |
| FR-6  | Structured `Logger` contract: leveled (silent/error/warn/info/debug/trace), scoped child loggers, lazy-callback messages (`() => string`), pluggable sinks (`outputChannelSink`, `consoleSink`, `onErrorAutoShowSink`, `memorySink`); see ADR-0003                                                                                                | Must Have   |
| FR-7  | Shared settings snapshot includes the durable active-file context preference so chat composer and settings surfaces can stay in sync                                                                                                                                                                                                              | Must Have   |
| FR-8  | Chat-to-host protocol includes a toggle mutation for the active-file context preference so the composer quick toggle and settings switch can write the same setting                                                                                                                                                                               | Must Have   |
| FR-9  | Shared settings snapshot includes the workspace mode preference so chat composer and settings surfaces can stay in sync                                                                                                                                                                                                                           | Must Have   |
| FR-10 | Chat-to-host protocol includes a toggle mutation for the workspace mode preference so the composer `Mode` control and Settings switch can write the same setting                                                                                                                                                                                  | Must Have   |
| FR-11 | `WorkspaceMode` union admits a third `"spec"` variant — planning-only posture distinct from `"code"` (full access) and `"explore"` (read-only)                                                                                                                                                                                                    | Must Have   |
| FR-12 | Host-to-webview protocol includes `chat/activeDocContext` carrying `{ format, section, docKind, feature, approvalStatus }` plus optional focus/sign-off/status summary fields so the chat composer can render contextual doc-action, focus, sign-off, and onboarding strips                                                                       | Must Have   |
| FR-13 | `chat/activeDocContext` carries optional `taskPhases`, `parsedFocuses`, `tasksCompleted`/`tasksTotal`, sibling `specStatus` / `designStatus` / `tasksStatus`, and `signOff: SignOffSummary` so the composer can render the FR-15 doc-actions strip, FR-16 workflow-position breadcrumb, and FR-19 brass Sign Off button without extra round-trips | Must Have   |
| FR-14 | Chat-to-host protocol includes a `chat/hostAction` envelope for deterministic document mutations triggered from the composer; the host posts a separate inbound event (`agent/signOffComplete`) for toast/error UX rather than returning via callback envelope                                                                                    | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                     | Target                       |
| ----- | --------------------------------------------------------------- | ---------------------------- |
| NFR-1 | Zero dependencies on VSCode API, React, or Node filesystem APIs | Enforced by package tsconfig |
| NFR-2 | Pure TypeScript — no runtime library dependencies               | Enforced by package.json     |

---

## Acceptance Criteria

### Message Protocol

- [ ] `ChatToAgent` and `AgentToChat` are discriminated unions with `type` string literal fields
- [ ] All message types are namespaced (e.g. `chat/send`, `agent/message`)
- [ ] Protocol types are exported from `index.ts` barrel
- [x] `SettingsSnapshot` includes a `context.includeActiveFileContext` boolean
- [x] `ChatToAgent` includes a toggle mutation for the active-file context preference
- [x] `SettingsSnapshot` includes a `mode.active` workspace posture
- [x] `ChatToAgent` includes a toggle mutation for the workspace mode preference

### Domain Types

- [ ] `Task` has `id`, `title`, `status`, `phase` fields at minimum
- [ ] Streaming output is modeled by the `AgentEvent` union from `agent.ts` (consumed by adapters and the extension host)

---

## Non-Goals

- No serialization/deserialization logic (types only)
- No validation schemas (no Zod)
- No React or VSCode-specific types

---

## Dependencies

- None (zero external dependencies)

---

## Appendix

### Agent Entry Map (routing-only parent)

This is a parent spec. It owns the shared types/protocol/contracts package as a unit. Per-message
and per-type ownership routes to the consuming zone via `@see` anchors in the source.

| Field           | Values                                                                                                                                                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | `@afx/shared` package: type declarations, message protocol unions, `AgentManager` interface, structured logger contract                                                                                                                                                                                                            |
| Owned files     | `packages/shared/src/index.ts`, `packages/shared/src/messages.ts` (declarations), `packages/shared/src/agent.ts`, `packages/shared/src/logger.ts`, `packages/shared/src/workbench-types.ts`, `packages/shared/src/workbench-protocol.ts`, `packages/shared/src/agent-runtime-status.ts`, `packages/shared/src/provider-catalog.ts` |
| Routing rules   | Each `ChatToAgent`/`AgentToChat` variant carries a per-variant `@see` to its owning chat/composer/messages/history/settings/notes/agent zone. Each workbench type carries a per-type `@see` to its workbench zone. The package itself does not own message _semantics_; see the destination zone.                                  |
| Children        | None (this package routes outward via `@see` anchors instead of child specs)                                                                                                                                                                                                                                                       |
| Out of scope    | Message payload semantics (those belong to the message-owning zone), serialization/validation logic, React, VSCode API                                                                                                                                                                                                             |
| Example prompts | "Add a new message type" -> add declaration here, then route per-variant `@see` to the owning zone; "Add a new shared workbench type" -> declare here + anchor to the consuming workbench zone                                                                                                                                     |
