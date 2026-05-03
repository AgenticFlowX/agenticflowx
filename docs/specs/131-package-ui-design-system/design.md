---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:25:11.000Z"
tags: ["package", "ui", "design-system", "storybook", "theme"]
spec: spec.md
---

# Package UI Design System - Technical Design

---

## [DES-OVR] Overview

`131-package-ui-design-system` owns shared visual contracts below app surfaces. It gives tokens, theme primitives, Storybook docs, and component contracts a stable home separate from chat/workbench behavior.

---

## [DES-ARCH] Architecture

```text
packages/ui
  ├─ tokens and styles
  ├─ shared primitives/composites
  └─ Storybook stories/docs
        ▲
        │ consumed by
apps/chat and apps/workbench
```

The package stays browser-compatible React/UI code. App child specs own stateful app composition; this spec owns reusable UI contracts and documentation.

---

## [DES-UI] User Interface & UX

Design-system UX is expressed as component states, token semantics, theme examples, and Storybook stories. App-specific layout decisions remain in app specs, but shared components must document required states such as default, hover, disabled, loading, empty, error, and dense/compact variants when those states exist.

---

## [DES-DEC] Key Decisions

| Decision            | Options Considered                                   | Choice              | Rationale                                                                               |
| ------------------- | ---------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| Storybook ownership | Infra spec, app spec, design-system spec             | Design-system spec  | Stories document component contracts first; build/toolchain changes can depend on infra |
| Theme ownership     | Chat theme spec, UI parent spec, design-system child | Design-system child | Theme tokens are shared beyond chat                                                     |
| App-specific layout | Shared UI package, app child specs                   | App child specs     | Prevents `packages/ui` from absorbing product state machines                            |

---

## [DES-DATA] Data Model

### [DES-TOKENS] Token Pack Structure

Design tokens live as CSS custom properties under `packages/ui/src/tokens/`. The current pack is
`meridian.css`, identified by `afx.theme === "meridian"`. Tokens are grouped by semantic role:
color, spacing, radius, typography. Adding a token means adding a CSS custom property in the
active pack; renaming or removing requires a deprecation cycle (NFR-1).

### [DES-THEME-CONTRACT] Theme And Style Identity

| Identifier set  | Source declaration                | Currently in catalog                                   |
| --------------- | --------------------------------- | ------------------------------------------------------ |
| `AFX_THEME_IDS` | `packages/shared/src/messages.ts` | `meridian`                                             |
| `AFX_STYLE_IDS` | `packages/shared/src/messages.ts` | `lyra`, `luma`, `maia`, `nova`, `vega`, `mira`, `sera` |

Adding an id requires:

1. Add to the relevant `as const` array in `messages.ts`.
2. Add the matching token pack/style file in `packages/ui/src/tokens/` or `packages/ui/src/styles/`.
3. Update the catalog above and the `afx.theme`/`afx.style` enums in `apps/vscode/package.json`.

```typescript
export interface AppearanceContract {
  theme: "light" | "dark" | string;
  density?: "comfortable" | "compact";
}
```

---

## [DES-API] API Contracts

Shared components expose React props, CSS variables, and exported helpers. Storybook stories should exercise the same public component API consumed by apps.

### [DES-APPEARANCE-BRIDGE] Appearance Bridge (host -> webview)

The appearance bridge is the host-to-webview pipeline that delivers theme + style as a runtime
snapshot. It is the destination for the per-variant `@see` anchors on `appearance/update` and
`agent/appearanceUpdated` in `messages.ts`.

```text
[VS Code settings]                 [packages/shared]
  afx.theme         ----+
  afx.style         ----+--> Host computes RuntimeAppearanceSnapshot
                                          |
                                          | broadcast: agent/appearanceUpdated
                                          v
                              [apps/chat + apps/workbench webviews]
                                  apply DOM class on <body> / root
                                  re-render token-driven CSS variables
```

Boot sequence guarantees:

1. The webview HTML shell applies the appearance class **before** scripts execute (NFR-2).
2. After hydration, the chat settings appearance preview can issue `appearance/update` to flip the
   active theme/style; the host echoes back via `agent/appearanceUpdated` so all webviews stay in
   sync (NFR-4).

| Direction       | Message                   | Trigger                        | Owner of UI surface            |
| --------------- | ------------------------- | ------------------------------ | ------------------------------ |
| Webview -> host | `appearance/update`       | Settings appearance preview    | `214-app-chat-settings`        |
| Host -> webview | `agent/appearanceUpdated` | Echo back to all open webviews | `131-package-ui-design-system` |

### [DES-COMPONENT-CONTRACT] Component Contract (read-only primitives)

Shadcn primitives in `packages/ui/src/components/**` are treated as a managed update surface
(NFR-3). Direct edits are forbidden because they break upstream sync. AFX behavior is added by:

- Wrapping a primitive in app-side composition (e.g., `apps/chat/src/components/model-combobox.tsx` wraps `Combobox`).
- Adding helpers in `packages/ui/src/lib/` (e.g., `cn`).
- Adding stories under future `packages/ui/**/*.stories.*` to document a primitive's API and states.

---

## [DES-FILES] File Structure

| File                                            | Purpose                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| `packages/ui/src/tokens/`                       | Shared design tokens                           |
| `packages/ui/src/styles/`                       | Shared style contracts                         |
| `packages/ui/src/lib/`                          | UI-only helpers and tests                      |
| `packages/ui/**/*.stories.*`                    | Future Storybook component documentation       |
| `.storybook/` or package-local Storybook config | Future Storybook configuration when introduced |

---

## [DES-DEPS] Dependencies

| Dependency        | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `130-package-ui`  | Parent package boundary                  |
| `310-infra-build` | Vite/Turbo/tooling changes for Storybook |
| App child specs   | Surface-specific UI consumption          |

---

## [DES-SEC] Security Considerations

- Storybook examples must not include real secrets, tokens, or user data.
- Shared UI must not import VSCode APIs, Node filesystem APIs, or process APIs.

---

## [DES-ERR] Error Handling

| Scenario                               | Handling                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| Missing token or CSS variable          | Component should fall back to existing app-safe defaults     |
| Story missing required component state | Design-system review flags the missing state before approval |

---

## [DES-TEST] Testing Strategy

- Run package UI tests for helpers and shared behavior.
- Add Storybook smoke or visual checks once Storybook is introduced.
- Run app checks when token changes intentionally affect app surfaces.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget shared theme/style `@see` refs from `chat-ui-theme-foundation`.
2. Route future design-system and Storybook work here.
3. Update `130-package-ui` as a parent route map after this child spec is accepted.

### Rollback Plan

If Storybook grows into a separate operational surface, create a later child spec and route only Storybook-specific toolchain/docs there.

---

## File Reference Map

| Task | File                         | Required @see        |
| ---- | ---------------------------- | -------------------- |
| 1.x  | `packages/ui/src/tokens/*`   | `design.md [DES-UI]` |
| 1.x  | `packages/ui/src/styles/*`   | `design.md [DES-UI]` |
| 2.x  | `packages/ui/**/*.stories.*` | `design.md [DES-UI]` |

---

## Open Technical Questions

None.
