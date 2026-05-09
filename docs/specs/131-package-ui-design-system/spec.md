---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["package", "ui", "design-system", "storybook", "theme"]
depends_on: ["130-package-ui"]
---

# Package UI Design System - Product Specification

## References

- **Parent Spec**: [Package UI](../130-package-ui/spec.md)

---

## Problem Statement

The shared UI package is becoming a product surface of its own. Tokens, theme contracts, shared component behavior, app appearance bridges, and upcoming Storybook work need a precise spec so design-system changes do not get routed through chat-specific specs or broad app docs.

---

## User Stories

### Primary Users

Developers, design-system maintainers, and AI agents updating shared UI behavior.

### Stories

**As a** developer
**I want** one spec for shared tokens, styles, component contracts, and Storybook
**So that** design-system work has a clear owner before app code is changed

**As an** AI agent
**I want** app-specific UI behavior separated from shared UI contracts
**So that** I do not change chat or workbench code when the design-system layer is the right target

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                              | Priority    |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| FR-1 | Own shared design tokens, theme primitives, style helpers, and UI package contracts used by apps                         | Must Have   |
| FR-2 | Own Storybook stories and documentation when they describe shared UI components or tokens                                | Must Have   |
| FR-3 | Define the boundary between design-system behavior and app-specific layout/interaction behavior                          | Must Have   |
| FR-4 | Route app appearance bridge work here when the behavior is shared across chat/workbench surfaces                         | Should Have |
| FR-5 | Preserve package UI as browser-only shared React/UI code with no VSCode or Node runtime imports                          | Must Have   |
| FR-6 | Ensure Meridian light and high-contrast-light themes keep primitive controls visible across chat and workbench consumers | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                                                  | Target                                                                             |
| ----- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| NFR-1 | Component and token docs remain easy to preview in Storybook                                 | New shared UI components include stories once Storybook exists                     |
| NFR-2 | Design-system changes remain app-agnostic                                                    | No chat/workbench-only state machines in `packages/ui`                             |
| NFR-3 | Styling changes preserve existing app visual contracts unless an app child spec changes them | No accidental app regressions                                                      |
| NFR-4 | Theme contrast overrides preserve component variants                                         | Line tabs remain underline-only; segmented/default controls remain visibly bounded |

---

## Acceptance Criteria

### Design-System Ownership

- [ ] Shared tokens, styles, and component contracts point at this spec
- [ ] App-specific composer, message, settings, and workbench behavior remains in app child specs
- [ ] `130-package-ui` routes readers here instead of duplicating all design-system details
- [ ] Meridian contrast fixes for shared primitives are documented here instead of sprint/fleet docs
- [ ] Chat and workbench consumer CSS reference this spec for cross-app primitive contrast overrides

### Storybook

- [ ] Storybook setup and stories for shared UI components have a clear spec owner
- [ ] Storybook build/toolchain changes depend on infra specs only when Vite/Turbo/config behavior changes

---

## Non-Goals (Out of Scope)

- Chat composer behavior owned by `211-app-chat-composer`
- Chat message/history/settings behavior owned by chat child specs
- Workbench panel shell behavior owned by workbench child specs
- Build-system behavior owned by `310-infra-build`

---

## Open Questions

None.

---

## Dependencies

- `130-package-ui`
- App child specs that consume shared UI primitives
- `310-infra-build` if Storybook build orchestration changes

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Shared UI design system, tokens, styles, theme contract, component stories                                                                                             |
| Owned files     | `packages/ui/src/tokens/`, `packages/ui/src/styles/`, `packages/ui/src/lib/`, future `packages/ui/**/*.stories.*`, future Storybook config when component-doc oriented |
| Local anchors   | Token entrypoints, style family files, shared helper tests, future Storybook stories for exported components                                                           |
| Bridge messages | Shared appearance/theme payloads when the payload represents design-system state                                                                                       |
| Settings keys   | None directly; app settings that select appearance remain in app specs                                                                                                 |
| Commands        | None directly                                                                                                                                                          |
| Tests           | `packages/ui` unit tests, future Storybook smoke/visual checks                                                                                                         |
| Dependencies    | `130-package-ui`, app child specs, `310-infra-build` for toolchain changes                                                                                             |
| Out of scope    | App-specific page layout, VSCode host webview registration, runtime agent behavior                                                                                     |
| Example prompts | "Add Storybook coverage for the button", "Update shared theme tokens", "Change the app appearance contract"                                                            |

### Glossary

| Term          | Definition                                                                      |
| ------------- | ------------------------------------------------------------------------------- |
| Design system | Shared tokens, styles, component contracts, and documentation that apps consume |
| Storybook     | Component documentation and preview surface for shared UI behavior              |
