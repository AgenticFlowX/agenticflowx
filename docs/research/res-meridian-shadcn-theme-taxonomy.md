---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "0.1.0"
created_at: "2026-04-28T05:42:03.000Z"
updated_at: "2026-04-28T06:00:20.000Z"
tags: ["research", "afx", "design-system", "meridian", "shadcn", "runtime-theme"]
---

# Meridian, Shadcn, and Runtime Theme Taxonomy

## Context

This research captures the design-system review for the AFX chat, history, and
settings surfaces. The source prompt compared the polished review material now
rooted at `docs/design-system` with the live repo implementation. The material
was previously staged under `docs/design-system/codex`; that folder name was
incidental, not a Codex-specific design system.

The implementation goal is not to replace `@afx/ui` or fork shadcn components.
The goal is to keep the shared shadcn/Radix primitive layer stable, preserve
VS Code host adaptation, and add subtle AFX-specific UI polish through runtime
tokens and semantic app-level composition.

---

## Findings

### Existing Theme Architecture

The repo already has the right broad architecture.

- `@afx/ui` is the shared shadcn/Radix primitive package.
- `packages/ui/components.json`, `apps/chat/components.json`, and
  `apps/workbench/components.json` currently use `style: "radix-lyra"`.
- The VS Code extension exposes `afx.theme` with `meridian` and `lyra`.
- `apps/vscode/src/panels/webview-html.ts` injects `theme-lyra` only when
  `afx.theme === "lyra"`; otherwise the default Meridian variables apply.
- `packages/ui/src/styles/globals.css` imports the active token system:
  Meridian tokens, Meridian theme, and Lyra theme.

This means the product already separates, at least partially:

- build-time shadcn component generation style;
- runtime CSS theme class;
- app-level AFX composition.

### Meridian Is Already Host-Adaptive

The live `theme-meridian.css` is closer to the desired adaptive behavior than a
surface read suggests. It maps core surfaces, foregrounds, borders, inputs,
focus, selection, and popovers to `--vscode-*` variables first, while preserving
AFX identity in brand, signal, and selection accents.

This is the right default for VS Code webviews:

- host UI owns ordinary surfaces and text;
- AFX owns subtle identity signals;
- exact Meridian palette should be optional or reserved for strict/editorial
  contexts, not forced over the user's editor theme.

### Token Source Drift

There is drift between token sources:

- `packages/ui/src/styles/meridian.tokens.css` drives the live app through
  `globals.css`.
- `packages/ui/src/tokens/meridian.css` is exported as `@afx/ui/tokens`, but it
  appears older and more light-palette oriented.
- `docs/design-system/tokens/meridian.tokens.css` contains the more
  polished reviewed direction, including better host-first font stacks and a
  light-theme override block.

This should be resolved before visual polish. There should be one canonical
semantic token contract consumed by chat, history, settings, and workbench.

### Font Direction

The reviewed Meridian tokens prioritize host/editor/system font hints and avoid
external font-fetch assumptions. That aligns with the product direction:

- app chrome should use `--vscode-font-family` / system defaults;
- monospace counters and technical receipts may use editor/mono hints;
- Meridian serif/display type should be rare, for artifact titles, spec preview,
  empty states, or editorial emphasis.

The live app already sets body text through `var(--vscode-font-family, ...)`.
The remaining cleanup is to make token files match that policy and avoid making
Google-font loading a runtime requirement.

### Runtime Style Families

The shadcn CLI package knows these style names:

- `nova`
- `vega`
- `maia`
- `lyra`
- `mira`
- `luma`
- `sera`

The product preference is to use these as runtime style families, not as normal
component-regeneration workflows.

In other words:

```text
components.json style:
  Build-time shadcn primitive baseline.

afx.theme / Settings style:
  Runtime visual family switch.
```

Changing `components.json` from `radix-lyra` to `radix-maia` would not make the
current app visually switch to Maia at runtime. That field informs shadcn
codegen/transforms. Runtime switching requires CSS variables and body classes,
for example `theme-maia`, `theme-nova`, and `theme-lyra`.

### Recommended Shadcn Strategy

Use shadcn styles as token sources, not component sources.

Keep one shared `@afx/ui` component registry, currently generated from
`radix-lyra`, and extract upstream shadcn style values into AFX runtime CSS
theme files. Each style should map into the same semantic contract:

```css
--background
--foreground
--card
--popover
--primary
--secondary
--muted
--accent
--border
--input
--ring
--radius
--afx-brand
--afx-brand-soft
--afx-signal-success
--afx-signal-warning
--afx-signal-info
```

This keeps all apps on the same components while allowing runtime visual changes
through Settings UI or VS Code configuration.

### Lyra Positioning

Lyra is useful, but it should be positioned clearly:

- as the current shadcn primitive baseline;
- as a neutral, boxier runtime fallback;
- not as the only possible product style.

Lyra's boxiness is acceptable if it remains one selectable family rather than
the permanent AFX personality.

### Chat Surface

Chat already contains several reviewed design ideas:

- token/cost/context usage in the status area;
- per-assistant-message usage receipts;
- model, slash, mention, thinking-level, compact, new-session, and queue
  controls;
- timeline-like tool event rendering.

The next chat polish should be incremental:

- replace hardcoded Tailwind colors such as `sky` with semantic theme tokens;
- clarify actual vs estimated token values;
- add composer preflight and smart-switch affordances;
- add evidence chips where they are grounded in existing runtime data;
- fix tool-event classification so `edit_file` is not classified as a read just
  because it contains the word `file`.

### History Surface

History is the largest mismatch with the reviewed direction. The current view is
turn-card based. The reviewed direction wants a compact traceable work log:

- read;
- edited;
- ran;
- failed;
- decided;
- summarized;
- linked evidence.

This should start as a UI-local adapter over current messages and tool parts.
The app should not fake saved sessions, branches, or durable history trees until
the runtime/shared protocol exposes them.

### Settings Surface

Settings has the right functional ingredients: runtime controls, provider
summary, skills, diagnostics, and about information. The visual structure is
still a long vertical card stack.

The next polish should make Settings a destination:

- compact section navigation;
- clearer grouping for runtime, model routing, skills, diagnostics, and about;
- confirmation affordances for runtime-changing actions;
- later separation of Pi auth and AFX API keys if/when SecretStorage and host
  policy are specified.

Auth/model-routing policy likely needs spec or ADR treatment because it crosses
chat UI, VS Code host configuration, SecretStorage, and Pi runtime behavior.

### Design Workspace Disposition

`docs/design-system` should remain the design workspace and source
material for accepted mockups. It should not be deleted, treated as generated
app code, or copied wholesale into `apps/chat`, `apps/workbench`, or
`packages/ui`.

The folder's own README already gives the right boundary:

- keep tokens in `tokens/`;
- keep shared prototype CSS in `css/`;
- keep static surface mockups in `ui_kits/`;
- keep rationale in `docs/`;
- avoid mixing app implementation work into the design-system folder.

The large static HTML prototypes are valuable, but they are extraction sources,
not implementation units. They include custom JavaScript, custom components,
and non-shadcn UI structures that need to be translated before entering the
app.

The extraction workflow should be:

1. split large prototypes into focused static surfaces first, especially chat,
   history, settings, workbench, and viewer surfaces;
2. inventory each prototype surface into tokens, reusable UI patterns,
   app-specific compositions, copy/content, behavior, and unsupported runtime
   assumptions;
3. map visual controls to existing `@afx/ui` shadcn primitives where possible;
4. create owned composites only where a pattern is genuinely reusable and cannot
   be expressed cleanly by existing primitives;
5. keep app-specific state machines and transport integration in the app, not
   in `packages/ui`;
6. preserve prototype-only JavaScript as behavioral notes, then reimplement the
   behavior through React state, shared protocol, and existing transport
   messages;
7. promote protocol gaps to spec/ADR before implementing host/runtime behavior.

This lets the mockups guide implementation without bypassing the repo's
shadcn-primitive rule or importing prototype code directly.

---

## Analysis

The key design boundary is:

```text
shadcn components stay stable;
semantic tokens carry style;
AFX UI polish composes on top.
```

This avoids three risks:

- regenerating component source every time the team wants to try a style;
- binding app behavior to shadcn generator internals;
- making AFX fight the user's VS Code theme.

The runtime style-family model also scales cleanly. Meridian can remain the
default AFX-adaptive identity. Lyra can remain the neutral/boxy fallback. Maia,
Nova, Vega, Mira, Luma, and Sera can become additional selectable CSS variable
families once their tokens are extracted and normalized.

The most important prerequisite is a stable semantic token contract. Once chat,
history, settings, and workbench consume semantic tokens only, style-family
switching becomes low risk.

---

## Recommendations

- Keep `@afx/ui` as the shared shadcn/Radix primitive package.
- Keep `components.json` as build-time shadcn codegen configuration, not runtime
  product-theme configuration.
- Treat `lyra`, `maia`, `nova`, `vega`, `mira`, `luma`, and `sera` as runtime
  AFX style families implemented through CSS variables and body classes.
- Extract upstream shadcn style tokens once and vendor them into
  `packages/ui/src/styles/theme-*.css` files.
- Normalize all extracted styles into the same AFX semantic token contract.
- Preserve VS Code host adaptation as the default behavior for surfaces, text,
  borders, focus, selection, and inputs.
- Reserve AFX identity for subtle accents, mode/status glyphs, token ledgers,
  threadlines, receipts, copy tone, and work-log language.
- Resolve drift between `packages/ui/src/styles/meridian.tokens.css`,
  `packages/ui/src/tokens/meridian.css`, and the reviewed
  `docs/design-system/tokens/meridian.tokens.css`.
- Keep `docs/design-system` as the design workspace for accepted mockups,
  but extract from it intentionally instead of copying custom prototype code
  into the app.
- Prioritize implementation in this order:
  1. token/theme source-of-truth cleanup;
  2. runtime style-family plumbing;
  3. split and inventory the static design-system mockups;
  4. chat polish;
  5. history event-log evolution;
  6. settings destination polish;
  7. auth/model-routing ADR or spec if needed.

---

## References

- `packages/ui/components.json`
- `apps/chat/components.json`
- `apps/workbench/components.json`
- `packages/ui/src/styles/globals.css`
- `packages/ui/src/styles/meridian.tokens.css`
- `packages/ui/src/styles/theme-meridian.css`
- `packages/ui/src/styles/theme-lyra.css`
- `packages/ui/src/tokens/meridian.css`
- `apps/vscode/package.json`
- `apps/vscode/src/panels/webview-html.ts`
- `apps/chat/src/views/chat.tsx`
- `apps/chat/src/views/history.tsx`
- `apps/chat/src/views/settings.tsx`
- `docs/design-system/docs/rev-02-direction.md`
- `docs/design-system/tokens/meridian.tokens.css`
- `docs/design-system/docs/token-visibility-ui.md`
- `docs/design-system/docs/chat-history-events.md`
- `docs/specs/130-package-ui/spec.md`
- `docs/specs/130-package-ui/design.md`
- `docs/specs/chat-foundation/chat-foundation.md`

---

## Next Steps

- [ ] Promote the theme taxonomy to ADR if the runtime-style boundary should be
      made durable.
- [ ] Create or update a spec for `@afx/ui` runtime style families.
- [ ] Extract Lyra/Maia/Nova/Vega/Mira/Luma/Sera token values into normalized
      runtime CSS themes.
- [ ] Align Meridian tokens with the reviewed host-first font and light-mode
      direction.
- [ ] Split and inventory `docs/design-system/ui_kits/chat-main.html`
      into focused implementation sources.
- [ ] Replace hardcoded chat/history colors with semantic theme tokens.
- [ ] Plan history event-log UI as a UI-local adapter before changing shared
      protocol.
