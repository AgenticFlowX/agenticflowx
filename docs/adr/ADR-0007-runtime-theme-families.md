---
afx: true
type: ADR
status: Proposed
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-28T06:04:18.000Z"
updated_at: "2026-04-28T06:11:26.000Z"
tags: ["adr", "ui", "design-system", "shadcn", "themes"]
---

# ADR-0007: Runtime Theme Families

## Context

AFX has three UI surfaces that need to converge visually without slowing down
implementation:

- `packages/ui` provides the shared shadcn/Radix primitive layer.
- `apps/chat` renders Chat, History, and Settings in the VS Code sidebar and in
  browser dev mode through mock transport.
- `apps/workbench` renders the bottom-panel workbench shell and will later grow
  richer spec-driven views.

The current repository already has a partial theme split:

- `components.json` uses `style: "radix-lyra"` for shadcn code generation.
- `@afx/ui` ships Meridian and Lyra CSS variables.
- the VS Code host exposes `afx.theme` with `meridian` and `lyra`.
- `theme-meridian.css` already adapts core surfaces, text, borders, inputs,
  selections, and focus rings to VS Code host variables.

The design-system workspace at `docs/design-system` now holds accepted static
mockups, reviewed Meridian tokens, prototype CSS, rationale, and VS Code theme
material. Those mockups include custom JavaScript and non-shadcn prototype
components, so they cannot be copied directly into the app without bypassing the
repo's shared primitive model.

The supporting research is captured in
[`res-meridian-shadcn-theme-taxonomy.md`](../research/res-meridian-shadcn-theme-taxonomy.md).
The key finding is that AFX needs runtime style switching across the app while
keeping a stable component registry.

Shadcn's preset model is more granular than a single theme name. In the local
`shadcn@4.4.0` package, presets include axes such as:

- base implementation: `radix` or `base`;
- style: `nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`;
- base color: `neutral`, `stone`, `zinc`, `gray`, `mauve`, `olive`, `mist`,
  `taupe`;
- accent/theme color: `rose`, `indigo`, `blue`, `emerald`, and others;
- font, heading font, radius, icon library, menu color, and menu accent.

AFX is not trying to import every upstream axis directly as a user-facing
configuration surface. The immediate product need is narrower: preserve host
adaptation for ordinary webview surfaces, then draw colors, fonts, radius, and
accent character from shadcn-style presets where they do not conflict with the
host theme.

## Decision

Adopt **runtime theme families over component regeneration**.

AFX will keep one stable `@afx/ui` shadcn/Radix component registry. The shadcn
style configured in `components.json` remains a build-time code-generation
baseline, currently `radix-lyra`. It is not the user-facing runtime theme
switch.

AFX runtime style families will be implemented as CSS variable files and body
classes, for example:

```text
theme-meridian
theme-lyra
theme-maia
theme-nova
theme-vega
theme-mira
theme-luma
theme-sera
```

The first runtime families to preserve are:

- `meridian` as the AFX default, host-adaptive and editorial.
- `lyra` as the neutral, boxier shadcn-style fallback.

Additional shadcn styles (`maia`, `nova`, `vega`, `mira`, `luma`, `sera`) may
contribute token values after extraction and normalization into the same AFX
semantic CSS contract. A runtime family may initially choose one opinionated
combination of style, base color, accent/theme, fonts, and radius instead of
exposing every shadcn preset axis in Settings.

All product UI should consume semantic variables such as:

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

Host-adaptive semantic variables are authoritative for ordinary VS Code webview
surfaces:

- `--background`
- `--foreground`
- `--card`
- `--popover`
- `--muted`
- `--border`
- `--input`
- `--ring`
- selection and focus variables

These values must follow VS Code host variables where available so a dark editor
does not render a white chat box, and a light or custom installed editor theme
does not get forced into an unrelated dark palette.

Shadcn-derived style tokens should primarily influence:

- accent and brand color choices;
- non-host typography defaults;
- radius and density;
- control treatment;
- charts and non-editorial supporting surfaces;
- optional strict previews or non-webview product surfaces.

Typography should be host-aware by surface. Chat input, message text, code-like
metadata, and history/work-log rows should strongly prefer host/editor font
hints. Other product surfaces may use the selected shadcn-derived family fonts
when that does not reduce VS Code readability.

Theme files may use shadcn preset values as token sources, but components and
app surfaces must not depend on shadcn generator internals.

`docs/design-system` remains the design workspace and mockup source. Static
HTML, prototype CSS, and prototype JavaScript from that folder must be extracted
intentionally into:

- shared semantic tokens in `packages/ui`;
- existing shadcn primitives from `@afx/ui/components`;
- owned reusable composites only when a pattern is reusable and cannot be
  expressed cleanly through existing primitives;
- app-specific state, transport integration, and runtime behavior inside the
  owning app.

## Rationale

This preserves the parts of the current architecture that are already working:

- shadcn/Radix owns low-level accessible primitives.
- `@afx/ui` owns shared components and CSS semantics.
- VS Code host variables own ordinary surfaces and user-theme adaptation.
- AFX owns subtle identity: brass/thread accents, token ledgers, receipts,
  workflow language, status signals, and mode affordances.

Runtime CSS switching is the right mechanism because it is cheap to preview in
browser dev, compatible with VS Code webviews, and does not churn generated
component source. It also lets users switch style families through VS Code
settings or Settings UI without invoking the shadcn CLI.

Keeping shadcn style extraction as a token-source workflow gives AFX the visual
variety of Lyra/Maia/Nova/Vega/Mira/Luma/Sera while avoiding a fragile model
where each style choice rewrites `packages/ui/src/components/**`.

Host adaptation is the higher-order rule. In the VS Code extension, selected
style families should behave like an accent/typography/radius layer over the
current editor theme, not like a complete replacement for the user's installed
theme.

The design workspace remains useful but bounded. It can continue to hold richer
mockups and custom prototype behavior, while implementation remains aligned with
the repo's architecture boundaries and spec-driven workflow.

## Consequences

### Positive

- Runtime theme switching becomes predictable and user-facing.
- The shadcn component registry stays stable and regeneration remains a
  developer/tooling action.
- Chat, History, Settings, and Workbench can share one semantic theme contract.
- New style families can be added by token extraction instead of component
  rewrites.
- Webview backgrounds, cards, inputs, and borders remain compatible with dark,
  light, high-contrast, and custom installed VS Code themes.
- Browser dev with mock data remains fast because theme families are CSS-driven.
- The design-system mockups can guide implementation without becoming app code.

### Negative / Trade-offs

- AFX must maintain normalized theme files for each supported runtime family.
- Extracted shadcn style values need review before they become product themes.
- AFX will not exactly mirror every upstream shadcn preset because host-adaptive
  webview surfaces override some color and typography choices.
- Some prototype interactions from `docs/design-system` will need rethinking
  when mapped to real app state and transport messages.
- The Settings UI and VS Code configuration must stay in sync as theme families
  expand.

### Implementation Constraints

- Do not copy prototype JavaScript or custom prototype components directly from
  `docs/design-system` into app source.
- Do not make theme selection mutate `components.json`.
- Do not force fixed light or dark backgrounds into webview surfaces that should
  adapt to VS Code host variables.
- Do not make app code consume raw palette variables when a semantic variable is
  available.
- Do not make `packages/ui` depend on VS Code APIs or app-specific state.
- Host/runtime gaps discovered during extraction must be promoted to a spec or
  ADR before implementation.

## Alternatives Considered

- **Regenerate shadcn components per style**: Change `components.json` from
  `radix-lyra` to `radix-maia`, `radix-nova`, or another style and regenerate
  the component registry. Rejected for normal product theming because it makes a
  visual preference a source-code rewrite and increases churn in
  registry-owned files.
- **Keep only Meridian and Lyra**: Preserve the current two-theme setup and
  ignore the broader shadcn style set. Rejected because the product direction is
  to support runtime style families such as Maia without changing components.
- **Copy static mockups directly into React**: Treat `docs/design-system` HTML,
  CSS, and JavaScript as implementation source. Rejected because the prototypes
  include custom controls and behavior that should be translated into shadcn
  primitives, React state, shared protocol, and app-owned compositions.
- **Build an app-local component framework**: Implement custom UI primitives in
  `apps/chat` or `apps/workbench` for the mockup polish. Rejected because the
  repo standard is to compose existing `@afx/ui` shadcn primitives and keep
  shared UI concerns in `packages/ui`.
