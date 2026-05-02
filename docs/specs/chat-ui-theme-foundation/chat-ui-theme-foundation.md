---
afx: true
type: SPRINT
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-28T06:22:47.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags:
  ["chat-ui-theme-foundation", "sprint", "chat", "theme", "design-system", "history", "settings"]
approval:
  spec: Approved
  design: Approved
  tasks: Approved
---

# Chat UI Theme Foundation — Sprint Brief

> **Format**: Single-document SDD. Carries spec + design + tasks in one file for fast, surgical feature work.
> **Approval gates**: Sections must be approved in order — Spec → Design → Tasks → Code. Track via the `approval` block in frontmatter.
> **Graduation**: Run `/afx-sprint graduate chat-ui-theme-foundation` to split into `spec.md` / `design.md` / `tasks.md` when scope grows beyond sprint format.

---

<!-- SPRINT-SECTION-START: SPEC (maps to spec.md on graduation — includes References + Section 1 body; drop `## 1. Spec` wrapper, promote ### → ##) -->

## References

> **Upstream Context**: Research, ADR, mockups, and existing app specs driving this sprint.

- **ADR**: [docs/adr/ADR-0007-runtime-theme-families.md](../../adr/ADR-0007-runtime-theme-families.md)
- **Research**: [docs/research/res-meridian-shadcn-theme-taxonomy.md](../../research/res-meridian-shadcn-theme-taxonomy.md)
- **Design workspace**: [docs/design-system/README.md](../../design-system/README.md)
- **Design tokens**: [docs/design-system/tokens/meridian.tokens.css](../../design-system/tokens/meridian.tokens.css)
- **Direction**: [docs/design-system/docs/rev-02-direction.md](../../design-system/docs/rev-02-direction.md)
- **Token visibility**: [docs/design-system/docs/token-visibility-ui.md](../../design-system/docs/token-visibility-ui.md)
- **History events**: [docs/design-system/docs/chat-history-events.md](../../design-system/docs/chat-history-events.md)
- **Static mockup**: [docs/design-system/ui_kits/chat-main.html](../../design-system/ui_kits/chat-main.html)
- **Existing spec**: [docs/specs/130-package-ui/spec.md](../130-package-ui/spec.md), [docs/specs/130-package-ui/design.md](../130-package-ui/design.md)
- **Existing spec**: [docs/specs/200-app-vscode/spec.md](../200-app-vscode/spec.md), [docs/specs/200-app-vscode/design.md](../200-app-vscode/design.md)
- **Existing spec**: [docs/specs/210-app-chat/spec.md](../210-app-chat/spec.md), [docs/specs/210-app-chat/design.md](../210-app-chat/design.md)
- **Existing sprint**: [docs/specs/chat-foundation/chat-foundation.md](../chat-foundation/chat-foundation.md)

---

## 1. Spec

> The WHAT — requirements, acceptance, scope. Use `[FR-X]` / `[NFR-X]` anchors so code `@see` links can be retargeted cleanly after graduation.

### Problem Statement

AFX has a working chat shell and a strong design direction, but the live app still lacks the polished theme and workflow layer that makes it feel like a first-class VS Code companion.

The current implementation has four practical gaps:

1. **Appearance taxonomy is underspecified in code** — `@afx/ui` has Meridian and Lyra theme files, but token sources drift, `@afx/ui/tokens` does not point at the same source of truth as the app, and shadcn's separate style vs theme/accent axes are currently collapsed into one runtime concept.
2. **Host adaptation must be protected** — the app must not render fixed white or dark boxes when the user has installed a dark, light, high-contrast, or custom VS Code theme. Ordinary surfaces need to follow `--vscode-*` variables first.
3. **Chat, History, and Settings need the next polish pass** — token visibility, actual-vs-estimated usage, event history, settings grouping, and theme/style selection exist in mockups but are not fully implemented in the app.
4. **The design workspace is not implementation code** — `docs/design-system` contains valuable static mockups and prototype behavior, but those need to be extracted into shadcn primitives, semantic tokens, app-owned state, and runtime-safe transport messages.

This sprint implements the practical foundation in one focused pass: runtime appearance infrastructure, host-adaptive surfaces, design-system extraction, and the missing/polished Chat, History, and Settings UI needed to make the sidebar feel coherent. AFX may use shadcn for most of the visual system, but it keeps a small product identity layer for brand accents, token receipts, workflow markers, and signal colors.

### User Stories

#### Primary Users

VS Code users running the AFX sidebar; developers iterating on AFX UI in browser dev mode; maintainers extending `@afx/ui` and the chat app.

#### Stories

**As a** VS Code user
**I want** AFX panels to adapt to my current VS Code theme
**So that** the chat, history, and settings surfaces feel native instead of fighting my editor.

**As a** VS Code user
**I want** clear token and context visibility in chat
**So that** I understand cost, context pressure, and whether a response used actual or estimated data.

**As a** VS Code user
**I want** History to show a traceable work log
**So that** I can review what the agent read, edited, ran, failed, and decided without scanning the whole transcript.

**As a** VS Code user
**I want** Settings to be organized into focused categories
**So that** runtime controls, providers, skills, diagnostics, and appearance choices are easy to find.

**As a** developer
**I want** to run and test the UI through `pnpm dev:chat` with mock data
**So that** I can iterate quickly without launching the VS Code extension host.

**As a** maintainer
**I want** `@afx/ui` appearance tokens to be stable semantics
**So that** shadcn identity/style axes can evolve without rewriting app components.

### Requirements

#### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                      | Priority    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Establish a canonical AFX semantic theme contract in `packages/ui/src/styles/**` for surfaces, foregrounds, borders, inputs, rings, brand accents, signal colors, typography, radius, density, and app-specific UI roles.        | Must Have   |
| FR-2  | Resolve token source drift so `@afx/ui/tokens`, `globals.css`, Meridian token definitions, and runtime theme files all align to the same source-of-truth model.                                                                  | Must Have   |
| FR-3  | Preserve host-adaptive variables as authoritative for ordinary VS Code webview surfaces: background, foreground, card, popover, muted, border, input, ring, selection, and focus.                                                | Must Have   |
| FR-4  | Implement runtime CSS appearance plumbing with separate identity/accent and style/treatment axes: AFX/Meridian identity for product accents, and shadcn styles such as Lyra/Luma for radius, borders, density, and control feel. | Must Have   |
| FR-5  | Extend VS Code host appearance configuration and webview body-class injection so supported runtime identity/style choices can be selected without mutating `components.json` or regenerating shadcn components.                  | Must Have   |
| FR-6  | Add a browser-dev appearance preview path for `pnpm dev:chat`, using mock transport and local UI controls or dev-only controls so identity/style work can be evaluated without launching VS Code.                                | Should Have |
| FR-7  | Inventory and extract the relevant `docs/design-system` mockup surfaces into implementation notes, token changes, reusable UI patterns, app compositions, behavior requirements, and deferred protocol gaps.                     | Must Have   |
| FR-8  | Replace hardcoded app colors in Chat and History, including Tailwind palette colors such as `sky`, with semantic tokens or existing shadcn theme classes.                                                                        | Must Have   |
| FR-9  | Improve Chat token visibility: keep actual usage receipts, clarify actual vs estimated data, add composer preflight where supported by available data, and avoid noisy duplicate counters.                                       | Must Have   |
| FR-10 | Fix tool/timeline event classification so edit/write/patch actions are not classified as read/file events solely because a command contains the word `file`.                                                                     | Must Have   |
| FR-11 | Evolve History from turn cards toward an active-session work log using a UI-local event adapter over current messages, tool events, usage, and runtime state.                                                                    | Must Have   |
| FR-12 | History MUST NOT fake durable Pi session listing, branch history, or saved session trees until the shared/runtime protocol exposes that data.                                                                                    | Must Have   |
| FR-13 | Rework Settings into a compact destination layout with category navigation or equivalent focused sections for Runtime, Identity, Style, Providers, Skills, Diagnostics, and About.                                               | Must Have   |
| FR-14 | Settings MUST expose runtime identity/accent and style/treatment selection only through runtime app settings / VS Code configuration, not through shadcn codegen settings.                                                       | Must Have   |
| FR-15 | Add or extend mock scenarios/data required to preview token pressure, tool events, runtime settings, appearance states, and history/event states in browser dev mode.                                                            | Should Have |
| FR-16 | Maintain Workbench theme compatibility through shared tokens, but defer full Workbench mockup implementation and data flows to a later sprint/spec.                                                                              | Should Have |
| FR-17 | All new UI controls MUST compose existing `@afx/ui` shadcn/Radix primitives where possible; owned composites are allowed only for reusable product patterns that cannot be expressed cleanly through primitives alone.           | Must Have   |
| FR-18 | Any host/runtime protocol gap discovered during extraction MUST be documented as a deferred question or promoted to a follow-up spec/ADR before implementation.                                                                  | Must Have   |

#### Non-Functional Requirements

| ID    | Requirement                       | Target                                                                                                                                       |
| ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Host-theme compatibility          | Dark, light, high-contrast, and custom VS Code themes do not produce mismatched fixed white/dark webview boxes.                              |
| NFR-2 | Architecture boundaries           | `apps/chat` and `apps/workbench` do not import VS Code APIs, Node filesystem/process APIs, or `@afx/agent-*`; `packages/ui` remains UI-only. |
| NFR-3 | Shadcn registry stability         | Runtime style switching does not mutate `components.json` and does not require regenerating `packages/ui/src/components/**`.                 |
| NFR-4 | Browser-dev velocity              | Chat UI theme/history/settings work remains testable through `pnpm dev:chat` using mock data.                                                |
| NFR-5 | Responsive sidebar fit            | Chat, History, and Settings remain usable at normal VS Code sidebar widths, including narrow widths around 170-400px.                        |
| NFR-6 | Accessibility and keyboard basics | Existing shadcn/Radix keyboard behavior is preserved; custom composites include visible focus, labels, and sensible tab order.               |
| NFR-7 | Traceability                      | New or meaningfully changed source files include sprint-mode `@see` links to this document's FR/DES anchors.                                 |

### Acceptance Criteria

- [ ] `@afx/ui` exposes one coherent semantic theme contract for app surfaces and AFX-specific roles.
- [ ] `@afx/ui/tokens` no longer points at an older or conflicting token source.
- [ ] AFX/Meridian identity keeps product accents while ordinary surfaces continue to read VS Code host variables where available.
- [ ] Lyra remains a selectable boxy/compact style treatment without requiring component regeneration.
- [ ] Runtime shadcn-derived style switching is documented as a treatment axis, while shadcn theme/accent colors are documented as the axis where AFX identity belongs.
- [ ] Appearance selection can be represented as runtime classes such as `theme-meridian style-lyra` and not as a `components.json` edit.
- [ ] Chat in browser dev can preview at least AFX/Meridian identity with Lyra treatment using mock data.
- [ ] Chat/History no longer rely on hardcoded `sky` Tailwind colors for user/event accents.
- [ ] Chat displays token usage and context pressure clearly, distinguishing actual values from estimates where both appear.
- [ ] Tool event descriptors classify edit/write/patch commands before read/file fallback.
- [ ] History renders an active-session work-log style view sourced from current transcript/tool/usage data.
- [ ] History clearly distinguishes active session history from durable AFX context or deferred session listing.
- [ ] Settings presents focused categories instead of one undifferentiated long vertical stack.
- [ ] Settings contains Identity and Style controls or clear placeholders wired to the runtime setting path chosen in the design.
- [ ] New controls use `@afx/ui` primitives such as Button, Tabs, Select/NativeSelect, Switch, Tooltip, ScrollArea, Badge, Card, Popover, Command, and Combobox where appropriate.
- [ ] `pnpm --filter apps/chat test` covers any new parser/adapter/helper logic introduced in Chat.
- [ ] `pnpm --filter apps/chat build`, `pnpm --filter apps/workbench build`, and `pnpm --filter ./apps/vscode build` pass before completion.
- [ ] Final completion runs `pnpm verify` and reports any pre-existing failures separately from sprint failures.

### Non-Goals (Out of Scope)

- Full Workbench view implementation beyond shared theme compatibility.
- Durable session tree, branch explorer, saved Pi session listing, or transcript reopening.
- SecretStorage auth bridge, provider-key management, or AFX API-key fallback.
- Security permission model, auto-approve policy, or Free Flow UI.
- Regenerating shadcn component source to switch runtime styles.
- Full exact upstream parity for every shadcn preset axis in Settings.
- Marketplace/theme-pack registry UI.
- Replacing shadcn/Radix primitives with app-local primitive frameworks.

### Open Questions

| #   | Question                                                                                                     | Status   | Blocking | Resolution                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Do we expose every shadcn preset axis (`style`, `baseColor`, `theme`, font, radius) in Settings immediately? | Resolved | No       | No. This sprint exposes the product axes first: AFX identity/accent and shadcn style/treatment. Additional axes can be added later if product value is proven.                 |
| 2   | Should History include saved sessions or branch trees?                                                       | Resolved | No       | No. Use active-session transcript and UI-local events only until shared/runtime protocol exposes durable session data.                                                         |
| 3   | Should Workbench mockups be implemented in this sprint?                                                      | Resolved | No       | No. Shared theme compatibility applies to Workbench, but full Workbench surfaces are deferred.                                                                                 |
| 4   | Should prototype JavaScript from `docs/design-system` be copied into React?                                  | Resolved | No       | No. Prototype behavior is translated into React state, transport messages, helpers, and tests.                                                                                 |
| 5   | Should runtime Maia/Sera/etc. exactly match upstream shadcn generated component shapes?                      | Resolved | No       | No. This sprint implements style/treatment tokens over the current Lyra-generated primitive baseline. Exact shape parity is a future component-regeneration/refactor decision. |

### Dependencies

- `130-package-ui` — shared shadcn primitives, tokens, and runtime CSS themes.
- `200-app-vscode` — webview HTML, `afx.theme` configuration, body class injection.
- `210-app-chat` — Chat, History, Settings, browser dev, and mock transport usage.
- `220-app-workbench` — shared token compatibility only.
- `110-package-transport` — mock transport scenarios used by browser-dev UI.
- `100-package-shared` — message types and runtime setting/usage contracts.
- `chat-foundation` sprint — existing model/slash/mention/runtime settings foundation.

<!-- SPRINT-SECTION-END: SPEC -->

---

<!-- SPRINT-SECTION-START: DESIGN (maps to design.md on graduation; promote ### → ##) -->

## 2. Plan

> The HOW — architecture, decisions, data model. Use `[DES-X]` anchors on section headings so code `@see` links can be retargeted cleanly after graduation.

### [DES-OVR] Overview

Implement a host-adaptive runtime appearance foundation in `@afx/ui`, wire the selected identity/accent and style/treatment through the VS Code host and browser dev shell, then extract the accepted Chat/History/Settings mockup ideas into app-owned React compositions using existing shadcn primitives. The sprint prioritizes concrete sidebar polish while leaving protocol-heavy features deferred.

Source-backed constraints from the local reference repos:

- VS Code webviews receive host theme mode classes such as `vscode-light`, `vscode-dark`, `vscode-high-contrast`, and `vscode-high-contrast-light` from the webview preloader/themeing path in `the VS Code source tree`.
- VS Code exposes workbench colors to CSS as `--vscode-*` variables and removes/re-adds those variables on theme changes (see `src/vs/workbench/contrib/webview/browser/themeing.ts` and `pre/index.html` `applyStyles`). Its own chat surfaces (verified in `src/vs/workbench/contrib/chat/browser/widget/media/chat.css`) use `--vscode-input-border`, `--vscode-focusBorder`, `--vscode-chat-list-background`, `--vscode-chat-requestBorder`, `--vscode-chat-font-family`, `--vscode-editorWarning-foreground`, and `--vscode-editorError-foreground`. `--vscode-input-background` is registered as a VS Code color but is NOT directly referenced in chat CSS — AFX should still adopt it as the correct fill semantic for input controls without implying VS Code's own chat reads it.
- Shadcn v4 keeps preset axes for `style`, `baseColor`, `theme`, `font`, `radius`, menu treatment, and icon library. Styles include `vega`, `nova`, `maia`, `lyra`, `mira`, `luma`, and `sera`; themes include color/accent names such as `amber`, `blue`, `fuchsia`, `indigo`, and `rose`.
- Shadcn preset application supports `--only theme,font`, but full preset application re-installs detected components. The generated component sources differ structurally by style, so AFX runtime switching must distinguish theme/accent identity from style/treatment unless a separate component refactor/regeneration decision is made.
- The live AFX repo already has a concrete token drift: `apps/chat/src/index.css` imports `@afx/ui/styles/globals.css` only; `apps/workbench/src/index.css` imports `@afx/ui/styles/globals.css` AND `apps/workbench/src/main.tsx` imports `@afx/ui/tokens`. `@afx/ui/tokens` exports `packages/ui/src/tokens/meridian.css` (197 lines) — a substantially smaller and divergent subset of the live runtime source `packages/ui/src/styles/meridian.tokens.css` (543 lines). Workbench therefore loads both a stale token file and the live globals.

### [DES-FEAS] Source-Backed Feasibility Gates

The design is feasible, but only if implementation treats the following as gates before UI polish:

| Claim / Plan Item                         | Source Fact                                                                                                                                                                                                                                                                                                                                                                                                                                               | Feasibility        | Required Constraint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `afx.theme` persists identity             | `apps/vscode/package.json` already defines only `afx.theme` with `meridian` and `lyra`.                                                                                                                                                                                                                                                                                                                                                                   | Easy               | Keep `meridian` default; migrate existing `lyra` meaning carefully if `afx.style` is added.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `afx.style` persists treatment            | No `afx.style` setting exists today.                                                                                                                                                                                                                                                                                                                                                                                                                      | Easy               | Add a new VS Code configuration key and explicit allowlist; do not overload `components.json`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Body class injection supports style       | `webview-html.ts` currently maps only `theme === "lyra"` to `theme-lyra`.                                                                                                                                                                                                                                                                                                                                                                                 | Easy               | Replace single-class mapping with additive identity/style classes and tests.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Settings can save appearance              | `settingsSnapshot` has no appearance values, and shared messages have no appearance update message.                                                                                                                                                                                                                                                                                                                                                       | Medium             | Add a minimal validated host write path and return current `theme`/`style` in the Settings snapshot.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Browser dev preview is possible           | `apps/chat/src/main.tsx` already falls back to `createMockTransport()` without VS Code.                                                                                                                                                                                                                                                                                                                                                                   | Easy               | Keep preview local/mock-backed outside VS Code; avoid production leakage.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Shadcn axes support the split             | Shadcn has separate `PRESET_STYLES` and `PRESET_THEMES`; style CSS uses `.style-*` and `.cn-*` classes.                                                                                                                                                                                                                                                                                                                                                   | Medium             | Use shadcn as source material; do not expect upstream `.style-*` CSS to affect current primitives directly.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.cn-*` hooks support treatment           | AFX primitives currently use generated Tailwind classes and `data-slot`, but not upstream `.cn-*` hooks.                                                                                                                                                                                                                                                                                                                                                  | Medium             | Apply hooks to ALL 50 hooked AFX primitives (full coverage map in `[DES-CN]`); 5 primitives are exempt for documented reasons. Use shadcn `style-lyra.css` as the source-of-truth for required suffixes.                                                                                                                                                                                                                                                                                                         |
| Full upstream shape is runtime-switchable | AFX primitives contain generated Lyra-like classes; shadcn registry styles differ structurally per style (radius, height, casing, focus ring).                                                                                                                                                                                                                                                                                                            | Medium             | With full hook coverage in place, runtime switching works against any shadcn style whose CSS AFX extracts. Visual fidelity per style is tiered (T1 renders / T2 visually correct / T3 polished) — see `[DES-SHADCN]`.                                                                                                                                                                                                                                                                                            |
| All 7 shadcn styles ship at T1 minimum    | Each shadcn `style-{name}.css` in `apps/v4/registry/styles/` is ~1k–1.5k lines of nested `.cn-*` rules using `@apply` over Tailwind utilities and shadcn theme variables. AFX must extract each into an AFX-owned file under `packages/ui/src/styles/style-{name}.css`, reconcile `@apply` calls against AFX-owned tokens (host-adaptive `--vscode-*` first, AFX identity tokens second, treatment variables third), and import all 7 from `globals.css`. | Medium/High volume | Treat extraction as mechanical-then-curate: copy each style's `.cn-*` rule block, substitute shadcn tokens for AFX equivalents, run the integration test for that style + light/dark/HC matrix, then move on. Don't tune visuals during extraction — that is T2/T3 work. Sprint exit floor remains T1 for all 7; if any single style cannot reach T1 within the sprint, defer the whole sprint or drop that style from the enum (with explicit ADR), do NOT ship a partial style set claiming "all 7 available". |
| Host adaptation is source-backed          | VS Code webviews add host classes and `--vscode-*` variables; VS Code chat uses input/focus/status vars.                                                                                                                                                                                                                                                                                                                                                  | Easy               | Use `--vscode-input-background` for fills, `--vscode-input-border` for borders, and explicit HC checks.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Token visibility is honest                | `chat/usage` has actual usage fields but no shared estimate flag.                                                                                                                                                                                                                                                                                                                                                                                         | Easy/Medium        | Actual receipts can ship now; estimated preflight must be UI-local or hidden until data exists.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@afx/ui/tokens` aligns with live source  | `tokens/meridian.css` is 197 lines; `styles/meridian.tokens.css` is 543 lines — the export is a stale subset.                                                                                                                                                                                                                                                                                                                                             | Easy               | Resolve in task 1.1 before any UI polish; either re-export the live file or convert tokens entry into a compatibility import.                                                                                                                                                                                                                                                                                                                                                                                    |
| History work-log is honest                | Current data supports transcript/tool/usage-derived active-session rows, not durable session listing.                                                                                                                                                                                                                                                                                                                                                     | Easy/Medium        | Implement active-session adapter only; avoid saved session/branch UI.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

No implementation task should proceed if it depends on an unsupported claim not listed here. Add the missing source fact first, then update this table or defer the feature.

### [DES-CN] Component Style Hook Refactor

Runtime style treatment requires a small, deliberate `@afx/ui` primitive refactor. The current AFX primitives are generated shadcn/Radix components with hardcoded Tailwind classes plus `data-slot`, `data-variant`, and `data-size`. Upstream shadcn style CSS uses `.style-*` wrappers and `.cn-*` hook classes such as `.cn-button`, `.cn-button-size-default`, `.cn-card`, `.cn-tabs-trigger`, `.cn-input`, and `.cn-textarea`. Therefore `.style-luma` or `.style-lyra` will not meaningfully affect current AFX primitives until selected components expose compatible hooks.

Implementation boundary:

- Do not reinstall shadcn components, run shadcn codegen, or change `components.json` as part of runtime style switching.
- Modify the committed `packages/ui/src/components/**` primitives in place by adding stable `.cn-*` hook classes alongside their existing Tailwind classes and `data-*` attributes.
- Use the local shadcn repo as reference material for hook names and treatment CSS only; extracted CSS must live in AFX-owned files under `packages/ui/src/styles/**`.
- Keep the current Lyra-generated primitive baseline. Runtime `style-lyra`, `style-luma`, and future treatments are CSS/token layers over that baseline until a separate regeneration/refactor decision is approved.

Refactor rules:

- **Reference pattern (verified)**: shadcn's own primitives bake hook classes into the `cva` base string and variant maps, not as runtime additions. See `apps/v4/registry/bases/radix/ui/button.tsx` lines 7–34: `cva("cn-button group/button inline-flex …", { variants: { variant: { default: "cn-button-variant-default" }, size: { default: "cn-button-size-default" } } })`. AFX should follow the same shape so the resulting `className` string contains every hook the CSS layer expects, regardless of variant/size combination.
- Add `.cn-*` classes in addition to existing generated classes; do not remove `data-slot`, `data-variant`, `data-size`, current exports, or variant props.
- Keep `className` as the final override path so app code can still make local adjustments.
- **Coverage rule (mandatory)**: every AFX primitive in `packages/ui/src/components/*.tsx` that has a shadcn `.cn-*` counterpart in `apps/v4/registry/styles/style-lyra.css` MUST receive ALL of the hooks shadcn defines for it. Partial coverage breaks runtime style switching for primitives left out — there is no "priority subset" for the final state, only for the implementation order. Exempt primitives (no shadcn hook counterpart) are explicit and documented in the coverage table below.
- **Implementation order (phasing)**: land the priority primitives used by Chat/History/Settings first (`1.5a`) so the sprint's UI polish has stable hooks to layer treatment CSS over; then land the mechanical batch for the remainder (`1.5b`). Both phases are required for sprint completion. See the hook coverage table below for the priority/batch split.
- For variant/size components, add deterministic hook classes such as `cn-button`, `cn-button-variant-default`, `cn-button-size-sm`, `cn-badge-variant-outline`, and `cn-tabs-list`.
- Do not import upstream shadcn style files wholesale until audited. Extract or adapt the relevant `.cn-*` declarations into AFX-owned style files so host variables, AFX identity tokens, and accessibility constraints stay intact.
- Prefer treatment variables for repeated shape decisions: `--afx-control-radius`, `--afx-panel-radius`, `--afx-control-height-sm`, `--afx-control-height-default`, `--afx-focus-ring-width`, `--afx-border-width`, `--afx-density-gap`, and similar tokens.
- Full parity for every upstream shadcn style remains deferred. This sprint needs enough hook coverage for the sidebar's visible controls to distinguish Lyra boxy treatment from a future Luma rounded treatment.

Comprehensive hook coverage map (50 of 55 AFX primitives; verified against `apps/v4/registry/styles/style-lyra.css`):

The "Hooks" column lists the shadcn `.cn-*` root prefixes for each component. Implementers must include ALL variant/size suffixes shadcn defines for that root in `style-lyra.css` — e.g., for `cn-button` that means `cn-button` + `cn-button-variant-{default, destructive, outline, secondary, ghost, link}` + `cn-button-size-{xs, sm, default, lg, icon-xs, icon-sm, icon, icon-lg}`. Use the shadcn registry as the source of suffix truth; never hand-pick a subset.

The "Phase" column gates implementation order: `1.5a` lands first (used directly by Chat/History/Settings views); `1.5b` is the mechanical remainder, parallelizable, may land after Phase 3–5 view polish.

| AFX file              | Hooks (apply all suffixes from `style-lyra.css`)                                                                                                                                                                                                                                                            | Phase                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `accordion.tsx`       | `cn-accordion-item`, `cn-accordion-trigger`, `cn-accordion-content`, `cn-accordion-content-inner`                                                                                                                                                                                                           | 1.5b                           |
| `alert.tsx`           | `cn-alert`, `cn-alert-{title, description, action}`, `cn-alert-variant-*`                                                                                                                                                                                                                                   | 1.5b                           |
| `alert-dialog.tsx`    | `cn-alert-dialog-{overlay, content, header, title, description, media}`                                                                                                                                                                                                                                     | 1.5b                           |
| `avatar.tsx`          | `cn-avatar`, `cn-avatar-{image, fallback, badge, group-count}`                                                                                                                                                                                                                                              | 1.5a                           |
| `badge.tsx`           | `cn-badge`, `cn-badge-variant-*`                                                                                                                                                                                                                                                                            | 1.5a                           |
| `breadcrumb.tsx`      | `cn-breadcrumb-{list, item, link, page, separator, ellipsis}`                                                                                                                                                                                                                                               | 1.5b                           |
| `button.tsx`          | `cn-button`, `cn-button-variant-*`, `cn-button-size-*`                                                                                                                                                                                                                                                      | 1.5a                           |
| `button-group.tsx`    | `cn-button-group`, `cn-button-group-{separator, text}`                                                                                                                                                                                                                                                      | 1.5a                           |
| `calendar.tsx`        | `cn-calendar`, `cn-calendar-{caption-label, dropdown-root}`                                                                                                                                                                                                                                                 | 1.5b                           |
| `card.tsx`            | `cn-card`, `cn-card-{header, title, description, content, footer}`                                                                                                                                                                                                                                          | 1.5a                           |
| `chart.tsx`           | `cn-chart-tooltip`                                                                                                                                                                                                                                                                                          | 1.5b                           |
| `checkbox.tsx`        | `cn-checkbox`, `cn-checkbox-indicator`                                                                                                                                                                                                                                                                      | 1.5b                           |
| `combobox.tsx`        | `cn-combobox-{trigger, trigger-icon, content, content-logical, list, item, item-indicator, item-text, label, separator, empty, chips, chip, chip-remove}`                                                                                                                                                   | 1.5b                           |
| `command.tsx`         | `cn-command`, `cn-command-{dialog, input-wrapper, input-group, input-icon, input, list, group, item, separator, empty, shortcut}`                                                                                                                                                                           | 1.5a                           |
| `context-menu.tsx`    | `cn-context-menu-{content, content-logical, sub-content, subcontent, sub-trigger, item, item-indicator, label, separator, shortcut, checkbox-item, radio-item}`                                                                                                                                             | 1.5b                           |
| `dialog.tsx`          | `cn-dialog-{overlay, content, close, header, title, description}`                                                                                                                                                                                                                                           | 1.5b                           |
| `drawer.tsx`          | `cn-drawer-{overlay, content, handle, header, title, description, footer}`                                                                                                                                                                                                                                  | 1.5b                           |
| `dropdown-menu.tsx`   | `cn-dropdown-menu-{content, content-logical, sub-content, subcontent, sub-trigger, item, item-indicator, label, separator, shortcut, checkbox-item, radio-item}`                                                                                                                                            | 1.5b                           |
| `empty.tsx`           | `cn-empty`, `cn-empty-{header, media, media-default, media-icon, title, description, content}`                                                                                                                                                                                                              | 1.5b                           |
| `field.tsx`           | `cn-field`, `cn-field-{set, group, content, label, title, description, error, legend, separator, separator-content}`                                                                                                                                                                                        | 1.5b                           |
| `hover-card.tsx`      | `cn-hover-card-content`, `cn-hover-card-content-logical`                                                                                                                                                                                                                                                    | 1.5b                           |
| `input.tsx`           | `cn-input`                                                                                                                                                                                                                                                                                                  | 1.5a                           |
| `input-group.tsx`     | `cn-input-group`, `cn-input-group-{addon, addon-align-block-start, addon-align-block-end, addon-align-inline-start, addon-align-inline-end, button, button-size-{xs, sm, icon-xs, icon-sm}, input, text, textarea}`                                                                                         | 1.5a                           |
| `input-otp.tsx`       | `cn-input-otp`, `cn-input-otp-{group, slot, separator, caret-line}`                                                                                                                                                                                                                                         | 1.5b                           |
| `item.tsx`            | `cn-item`, `cn-item-{group, header, content, footer, title, description, media, media-variant-*, separator, actions}`, `cn-item-size-*`, `cn-item-variant-*`                                                                                                                                                | 1.5b                           |
| `kbd.tsx`             | `cn-kbd`, `cn-kbd-group`                                                                                                                                                                                                                                                                                    | 1.5b                           |
| `label.tsx`           | `cn-label`                                                                                                                                                                                                                                                                                                  | 1.5a                           |
| `menubar.tsx`         | `cn-menubar`, `cn-menubar-{trigger, content, content-logical, sub-content, sub-trigger, item, label, separator, shortcut, checkbox-item, checkbox-item-indicator, radio-item, radio-item-indicator}`                                                                                                        | 1.5b                           |
| `native-select.tsx`   | `cn-native-select`, `cn-native-select-icon`                                                                                                                                                                                                                                                                 | 1.5a                           |
| `navigation-menu.tsx` | `cn-navigation-menu`, `cn-navigation-menu-{list, trigger, trigger-icon, content, popup, link, indicator, indicator-arrow, viewport, positioner}`                                                                                                                                                            | 1.5b                           |
| `pagination.tsx`      | `cn-pagination-{content, ellipsis, next, previous}`                                                                                                                                                                                                                                                         | 1.5b                           |
| `popover.tsx`         | `cn-popover-{content, content-logical, header, title, description}`                                                                                                                                                                                                                                         | 1.5a                           |
| `progress.tsx`        | `cn-progress`, `cn-progress-{track, indicator, label, value}`                                                                                                                                                                                                                                               | 1.5b                           |
| `radio-group.tsx`     | `cn-radio-group`, `cn-radio-group-{item, indicator, indicator-icon}`                                                                                                                                                                                                                                        | 1.5b                           |
| `resizable.tsx`       | `cn-resizable-handle-icon`                                                                                                                                                                                                                                                                                  | 1.5b                           |
| `scroll-area.tsx`     | `cn-scroll-area-scrollbar`, `cn-scroll-area-thumb`                                                                                                                                                                                                                                                          | 1.5a                           |
| `select.tsx`          | `cn-select-{trigger, trigger-icon, value, content, content-logical, group, label, item, item-indicator, item-text, separator, scroll-up-button, scroll-down-button}`                                                                                                                                        | 1.5a                           |
| `separator.tsx`       | `cn-separator`, `cn-separator-{horizontal, vertical}`                                                                                                                                                                                                                                                       | 1.5a                           |
| `sheet.tsx`           | `cn-sheet-{overlay, content, close, header, title, description, footer}`                                                                                                                                                                                                                                    | 1.5b                           |
| `sidebar.tsx`         | `cn-sidebar-{inner, content, header, footer, gap, group, group-action, group-content, group-label, input, inset, menu, menu-action, menu-badge, menu-button, menu-button-size-*, menu-button-variant-*, menu-skeleton, menu-skeleton-icon, menu-skeleton-text, menu-sub, menu-sub-button, rail, separator}` | 1.5b                           |
| `skeleton.tsx`        | `cn-skeleton`                                                                                                                                                                                                                                                                                               | 1.5b                           |
| `slider.tsx`          | `cn-slider`, `cn-slider-{track, range, thumb}`                                                                                                                                                                                                                                                              | 1.5a (DebugPanel speed slider) |
| `sonner.tsx`          | `cn-toast` (sonner renders its own DOM; apply via `toastOptions.classNames` config rather than `cva`)                                                                                                                                                                                                       | 1.5b                           |
| `switch.tsx`          | `cn-switch`, `cn-switch-thumb`                                                                                                                                                                                                                                                                              | 1.5a                           |
| `table.tsx`           | `cn-table`, `cn-table-{container, caption, header, body, footer, row, head, cell}`                                                                                                                                                                                                                          | 1.5b                           |
| `tabs.tsx`            | `cn-tabs`, `cn-tabs-{list, trigger, content}`                                                                                                                                                                                                                                                               | 1.5a                           |
| `textarea.tsx`        | `cn-textarea`                                                                                                                                                                                                                                                                                               | 1.5a                           |
| `toggle.tsx`          | `cn-toggle`, `cn-toggle-variant-*`, `cn-toggle-size-*`                                                                                                                                                                                                                                                      | 1.5b                           |
| `toggle-group.tsx`    | `cn-toggle-group`, `cn-toggle-group-item`                                                                                                                                                                                                                                                                   | 1.5b                           |
| `tooltip.tsx`         | `cn-tooltip-{content, content-logical, arrow, arrow-logical}`                                                                                                                                                                                                                                               | 1.5a                           |

Exempt — no shadcn `.cn-*` counterpart in `style-lyra.css`:

| AFX file           | Reason                                                |
| ------------------ | ----------------------------------------------------- |
| `aspect-ratio.tsx` | Pure layout primitive; no styled surface upstream     |
| `carousel.tsx`     | Not present in `style-lyra.css`                       |
| `collapsible.tsx`  | Transparent open/close primitive; no styled surface   |
| `direction.tsx`    | LTR/RTL provider; renders no DOM surface              |
| `spinner.tsx`      | Not present in `style-lyra.css` (AFX-local primitive) |

Exemption rule: if upstream shadcn later adds hooks for any of these primitives, they move from exempt to required. Implementation must re-grep `style-lyra.css` at the start of task 1.5 to catch new shadcn hook additions since the table was generated.

Implementation must make the hook layer boring and mechanical first, then layer treatment CSS second. This avoids mixing API changes, style extraction, and visual tuning in one risky edit. The 1.5a/1.5b split lets the sprint's view polish proceed against priority hooks while the batch pass lands in parallel.

### [DES-ARCH] Architecture

#### System Context

```text
VS Code settings / browser dev controls
        │
        ▼
apps/vscode webview HTML ───── injects body class / VS Code host variables
        │
        ▼
apps/chat + apps/workbench ─── import @afx/ui/styles/globals.css
        │
        ▼
packages/ui styles ─────────── semantic variables + runtime identity/style layers
        │
        ▼
@afx/ui shadcn primitives ──── Button, Tabs, Badge, Tooltip, ScrollArea, etc.
        │
        ▼
app-owned compositions ─────── Chat, History work-log, Settings destination
```

#### Ownership Boundaries

| Layer                | Owns                                                                                           | Does Not Own                                      |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/ui`        | semantic CSS variables, runtime identity/style files, shadcn primitives, reusable UI utilities | VS Code APIs, app state machines, transport calls |
| `apps/vscode`        | appearance config, webview body classes, CSP/dev-server HTML                                   | React UI, token definitions, agent UI logic       |
| `apps/chat`          | Chat/History/Settings composition, UI-local event adapters, browser mock experience            | filesystem/process access, Pi-specific imports    |
| `apps/workbench`     | consuming shared styles and keeping panel compatible                                           | full redesign in this sprint                      |
| `docs/design-system` | source mockups, tokens, rationale, extraction notes                                            | shipped runtime code                              |

### [DES-TOKENS] Appearance Token Contract

**Source-of-truth boundary (mandatory)**: every runtime token, theme file, and style treatment MUST live under `packages/ui/src/styles/**` and `packages/ui/src/tokens/**`, exported through `@afx/ui/styles/...` and `@afx/ui/tokens`. `docs/design-system/css/**`, `docs/design-system/tokens/**`, and `docs/design-system/ui_kits/**` are reference/extraction sources only. Apps and packages MUST NOT import from `docs/design-system/**` at runtime. The migration direction this sprint takes is one-way: read from `docs/design-system/**`, refactor/update/replace the corresponding files under `@afx/ui`, and reconcile any divergence by changing `@afx/ui` (not by adding parallel imports). After this sprint, a follow-up may compress `docs/design-system/**` into a thinner reference set; this sprint does not delete it.

`packages/ui/src/styles/globals.css` remains the single global stylesheet imported by browser apps. It imports:

```text
shadcn/tailwind.css
meridian.tokens.css
theme-meridian.css
theme-lyra.css   # current file name; migrate or reinterpret as style treatment
future theme-*.css / style-*.css files
```

The contract is divided into four layers:

1. **Host surface tokens** — ordinary backgrounds, foregrounds, borders, input fill, focus, and selection from VS Code variables.
2. **Identity/accent tokens** — AFX/Meridian brand accents, token receipts, workflow markers, and signal colors. This is closest to shadcn's theme/accent axis, where upstream offers names such as `amber`, `blue`, `fuchsia`, and `rose`.
3. **Style/treatment tokens** — radius, border strength, focus ring weight, density, control height, and shape feel inspired by shadcn styles such as Lyra and Luma.
4. **Component/app tokens** — optional roles such as `--afx-thread`, `--afx-receipt`, `--afx-history-event-read`, and `--afx-history-event-edit`.

Implementation should align `packages/ui/src/tokens/meridian.css` with the live style source or convert it into a compatibility import so `@afx/ui/tokens` does not expose a conflicting palette.

Current repo facts that must be corrected before visual polish:

- `packages/ui/src/styles/globals.css` imports `meridian.tokens.css`, `theme-meridian.css`, and `theme-lyra.css`; this is the live runtime path for Chat, but `theme-lyra.css` currently conflates identity/accent and style/treatment naming.
- `packages/ui/package.json` exports `@afx/ui/tokens` from `packages/ui/src/tokens/meridian.css`; Workbench currently imports that path in addition to globals.
- `packages/ui/src/styles/theme-meridian.css` and `packages/ui/src/styles/theme-lyra.css` currently map `--input` to `--vscode-input-border`; that makes a border token act as an input fill token. The implementation must switch input fill semantics to `--vscode-input-background` and keep `--vscode-input-border` for borders/focus rules.
- `packages/ui/src/components/**` already contain Lyra-like generated primitive classes such as `rounded-none`, compact `text-xs`, and fixed component sizes. Runtime style treatments can only change those structural classes where selected primitives are regenerated or refactored to read treatment variables.

### [DES-HOST] Host-Adaptive Surface Rules

Ordinary webview surfaces must prefer VS Code variables:

| Semantic Role  | Preferred Source                                     | Fallback                     |
| -------------- | ---------------------------------------------------- | ---------------------------- |
| `--background` | `--vscode-sideBar-background` / panel background     | AFX/shadcn identity fallback |
| `--foreground` | `--vscode-editor-foreground`                         | AFX/shadcn identity fallback |
| `--card`       | `--vscode-editorWidget-background`                   | AFX/shadcn identity fallback |
| `--popover`    | `--vscode-dropdown-background` / editor widget       | selected style popover       |
| `--border`     | `--vscode-panel-border`                              | selected style border        |
| `--input`      | `--vscode-input-background`                          | selected style input         |
| `--ring`       | `--vscode-focusBorder`                               | selected style ring          |
| selection      | `--vscode-list-activeSelectionBackground` or similar | AFX selection fallback       |

AFX-specific accents are allowed to stay opinionated: brand, threadline, status signals, token receipts, and subtle workflow markers.

Host theme classes supplied by VS Code should be treated as environmental hints, not as the AFX appearance switch. AFX may add `theme-*` classes for identity/accent and `style-*` classes for treatment, but it must not replace or depend on re-creating VS Code's own `vscode-dark` / `vscode-light` / high-contrast classes. This keeps installed user themes, custom themes, and accessibility themes in control of ordinary surfaces.

For typography, chat-facing and history-facing surfaces should prefer host/editor font variables where available. Shadcn-derived family fonts can remain useful for headings, empty states, previews, and non-editor chrome, but composer text and dense activity logs should feel native to the current VS Code environment.

High-contrast support is not optional. VS Code adds `vscode-high-contrast` for high-contrast dark and also adds it as a backwards-compatible class when the active class is `vscode-high-contrast-light`. AFX CSS should rely on semantic variables first, then add explicit high-contrast selectors only when a component needs stronger borders, focus outlines, or disabled/selection contrast.

### [DES-SHADCN] Shadcn Axis Extraction Model

Shadcn preset axes are treated as token inputs, not as runtime component sources:

```text
base implementation: radix | base
style: nova | vega | maia | lyra | mira | luma | sera
base color: neutral | stone | zinc | mauve | olive | mist | taupe
theme/accent: amber | blue | fuchsia | indigo | rose | ...
font / heading font / radius / menu treatment
```

AFX should follow that split rather than inventing a competing taxonomy:

- **Identity/accent**: AFX/Meridian is the product identity pack, closest to shadcn's `theme/accent` axis. It can coexist with shadcn-derived neutral/base colors and does not need to own every surface.
- **Style/treatment**: Lyra, Luma, Maia, Nova, Vega, Mira, and Sera describe shape, radius, density, border treatment, casing, and control feel.
- **Host adaptation**: VS Code still owns ordinary workbench surfaces through `--vscode-*` variables.

This means AFX can use almost everything from shadcn while still enforcing a bit of product identity. For example, `theme-meridian style-luma` means host-adaptive surfaces, AFX accent colors, and a larger rounded Luma-style treatment.

Local shadcn source confirms that the style names are registry/source styles, not runtime switches by themselves. Source-verified facts:

- Each style is one CSS file (e.g., `apps/v4/registry/styles/style-lyra.css`) wrapped in a single `.style-lyra { … }` selector that nests every `.cn-*` rule for that style.
- The shadcn CLI uses `--only theme,font` to skip component reinstallation; the default preset application path reinstalls all components (`packages/shadcn/src/commands/apply.ts:150`).
- Shadcn does NOT publish a "load all styles, switch by body class at runtime" stylesheet. It assumes one style per project, chosen at codegen time.

AFX is therefore building a runtime switching layer that shadcn does not natively provide: import multiple AFX-owned `style-*.css` files at once, toggle a body class to switch which `.style-*` selector is active, and keep AFX primitives' `cn-*` hook coverage stable across the styles AFX implements. Changing `components.json` from `radix-lyra` to another style remains a codegen/config operation that this sprint does not perform. Extraction can compare shadcn registry `style.json`, preset config, font JSON, generated CSS, and theme CSS vars as source material.

**Style coverage commitment (this sprint)**: all 7 shadcn styles MUST be available in `@afx/ui` so the team and end users can A/B their preferred treatment. Specifically: `lyra`, `luma`, `maia`, `nova`, `vega`, `mira`, `sera`. Each lands as its own AFX-owned file at `packages/ui/src/styles/style-{name}.css`, all imported by `globals.css`, and all selectable through `afx.style` config and the DebugPanel switcher. There are no "implemented vs disabled" rows for style this sprint — implementation is all-or-nothing for the 7.

**Visual fidelity tiers** (definition of "done" per style):

- **T1 — Renders** (mandatory baseline for all 7 this sprint): style CSS imports without breaking; all 50 hooked primitives render with their `.cn-*` hooks resolving to extracted treatment values; no z-index, overflow, or layout regressions in light, dark, high-contrast, and high-contrast-light host modes; all four Chat / History / Settings / DebugPanel surfaces remain usable at narrow (170 px) and normal sidebar widths.
- **T2 — Visually correct** (target where extraction effort allows; required for `lyra` since it is the current baseline): the style's signature traits — radius, control height, font weight/casing, focus ring, density — match the shadcn intent (e.g., `maia` reads as rounded; `sera` reads as uppercase tracking-widest; `nova` / `vega` retain their distinct chrome). Deviations are documented in the per-style file header.
- **T3 — Polished** (NOT a sprint goal — iterative future work): treatment variables tuned for AFX brand layered with `theme-meridian` identity; per-style screenshots committed to `docs/design-system/` for regression reference.

This sprint commits to T1 on all 7 and T2 on `lyra` (already the baseline). T2 on the other 6 is a stretch — extract first, polish over follow-up sprints. T3 is explicitly out of scope.

Important boundary: upstream shadcn styles are not only color/font tokens. For example, generated `radix-lyra`, `radix-maia`, and `radix-sera` button sources differ in radius, height, text size, casing, letter spacing, and focus ring widths. Because `packages/ui/src/components/button.tsx`, `tabs.tsx`, `card.tsx`, `textarea.tsx`, `badge.tsx`, and related primitives already contain generated Lyra-like classes, this sprint will not promise exact Maia/Sera/Nova primitive shape parity at runtime.

The supported extraction stance is:

- use shadcn preset/style files as reference inputs;
- optionally compare CLI outputs using theme/font-only or no-reinstall paths;
- keep AFX identity/accent values as a small theme pack rather than a whole competing design system;
- commit style/treatment values into committed CSS variables such as `style-lyra.css` or equivalent;
- leave existing component source and `components.json` stable unless a separate component-regeneration decision is made.
- expose only implemented identity/style combinations in production Settings; planned options can appear in docs/dev notes but not as working user choices.

### [DES-VSCODE] VS Code Appearance Integration

`apps/vscode/package.json` owns persisted appearance defaults. Keep this simple and VS Code-native:

- `afx.theme` selects the identity/accent pack. Default: `meridian` for the current AFX identity. Enum (this sprint): `["meridian"]`.
- `afx.style` selects the style/treatment pack. Default: `lyra` for the current boxy/compact primitive baseline. Enum (this sprint): `["lyra", "luma", "maia", "nova", "vega", "mira", "sera"]` — all 7 are available per `[DES-SHADCN]` coverage commitment.

`apps/vscode/src/panels/webview-html.ts` maps setting values to body classes:

```text
afx.theme=meridian -> theme-meridian (or no extra theme class while meridian is the only option)
afx.style=lyra     -> style-lyra
afx.style=luma     -> style-luma
afx.style=maia     -> style-maia
afx.style=nova     -> style-nova
afx.style=vega     -> style-vega
afx.style=mira     -> style-mira
afx.style=sera     -> style-sera
```

The mapping should use explicit allowlists so unknown config values fall back to Meridian + Lyra. Tests in `apps/vscode/src/panels/webview-html.test.ts` should cover known and unknown values.

AFX classes should be additive to VS Code's webview body state. The host continues to own `vscode-*` classes and `--vscode-*` variables; AFX owns only its `theme-*` / `style-*` classes and product-specific semantic variables. This avoids coupling AFX to any single installed VS Code theme while still allowing AFX identity, Lyra, Luma, and future extracted styles to alter accents, density, radius, border treatment, and non-host-owned roles.

Current implementation check: `apps/vscode/package.json` only exposes `afx.theme` with `meridian` and `lyra`; `webview-html.ts` currently maps only `lyra` to `theme-lyra` and returns an empty class for everything else. The implementation should migrate this model toward `afx.theme=meridian` plus `afx.style=lyra`, preserving backwards compatibility for any existing `afx.theme=lyra` value as Meridian identity with Lyra treatment until the old combined value can be retired.

### [DES-DEV] Browser Dev Theme Preview

**Goal**: both `pnpm dev:chat` and `pnpm dev:workbench` must run as fast, pure-web dev shells with no VS Code host required. The DebugPanel inside these dev shells is the appearance preview surface, so designers and developers can iterate on identity/style/host-mode without launching the extension host. Verified scripts: `dev:chat` → `pnpm --filter apps/chat dev`, `dev:workbench` → `pnpm --filter apps/workbench dev` (`package.json:18-19`).

**Pure-web parity requirement**:

- `apps/chat/src/main.tsx` already selects `createMockTransport()` when `acquireVsCodeApi` is unavailable — this stays the chat fallback path.
- `apps/workbench/src/main.tsx` now initializes `initWorkbenchBridge()` and listens for host appearance/telemetry updates. Browser dev uses the workbench-owned bridge fallback instead of `@afx/transport`, and must still avoid VS Code API imports.
- Both apps MUST boot with `pnpm dev:chat` / `pnpm dev:workbench` against Vite alone, render without console errors, and remain interactive against mock data. This is a sprint completion gate, not a "should".

**DebugPanel requirements (DEV-only, gated by `import.meta.env.DEV`)**:

DebugPanel must add a third tab `appearance` alongside the existing `scenarios` and `log` tabs. It must also add two new groups inside the existing `scenarios` tab body, both verified in `docs/design-system/ui_kits/chat-main.html` (lines ~4895–4955):

- **Pi runtime status** group — three inline trace badges sourced from `agent/runtimeSettings`: `steeringMode` (rendered as `steer one-at-a-time` / `steer all`), `followUpMode` (`follow-up one-at-a-time` / `follow-up all`), and `pendingMessageCount` (`pending N`). Updates live as runtime state changes. No new message — all three fields are already in the verified runtime payload.
- **Recent traffic** mini-log — a compact 3-row preview of the most recent `MockTransport` log entries, with `out` / `in` direction, message `type`, and a short summary or timestamp. Sourced from the SAME log stream as the existing full `Log` tab (no separate buffer, no separate persistence). Acts as a glanceable header when working in the Scenarios tab; the full Log tab remains the deep-dive surface.

The new `appearance` tab exposes three independent switchers:

| Switcher               | Body class prefix                                                                   | This sprint's implemented set                                                                      | Disabled (placeholder) set                                                                                                                   | Source                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Identity (`theme-*`)   | `theme-meridian`                                                                    | `meridian`                                                                                         | none yet — list reserved for future identity packs                                                                                           | `[DES-DATA].RuntimeThemeOption.implemented`                                          |
| Style (`style-*`)      | `style-{lyra, luma, maia, nova, vega, mira, sera}`                                  | all 7 (T1 render mandatory; T2 target where extraction allows — see `[DES-SHADCN]` fidelity tiers) | none — disabled rows are no longer used for style; if a style cannot land at T1, defer the whole sprint rather than ship a partial style set | `[DES-DATA].RuntimeStyleOption.implemented`                                          |
| Host mode (`vscode-*`) | `vscode-light`, `vscode-dark`, `vscode-high-contrast`, `vscode-high-contrast-light` | all four                                                                                           | none — these are simulator outputs, not extracted styles                                                                                     | verified at `vscode/src/vs/workbench/contrib/webview/browser/pre/index.html:482-495` |

Switcher behavior:

- Each switcher writes its chosen class to `document.body.className` additively (preserves any pre-existing AFX or app classes; only the prefix it owns is mutated).
- Disabled rows are listed as visible affordances with explanatory muted copy (e.g., "luma — extraction in progress, see task 1.6"). They MUST NEVER be selectable until the matching `implemented: true` flag flips in `[DES-DATA]`. Single source of truth: the option list — not duplicated in DebugPanel JSX.
- State persists to `localStorage` under a single JSON-serialized key `afx-debug-appearance` so hot reloads and re-opens retain choice. Reset button clears the key and reverts to defaults (`theme-meridian`, `style-lyra`, no host class).
- The host-mode simulator MUST be a no-op when `acquireVsCodeApi` is defined (real extension host runs). Inside the extension host, `vscode-*` classes belong to VS Code's preloader and AFX must not touch them. The simulator only runs in pure-web mode.

**Production safety**:

- The whole `appearance` tab — and DebugPanel itself — must be tree-shaken or guarded out of production webview bundles via `import.meta.env.DEV`. The existing DebugPanel pattern in `apps/chat/src/components/debug-panel.tsx` is the reference.
- No DebugPanel state, including the `localStorage` key, may influence how Settings reads or writes `afx.theme` / `afx.style`. The two are independent: Settings always reflects VS Code configuration; DebugPanel always reflects local dev state. They never read each other.

**Workbench DebugPanel scope**:

- Adding a workbench-side DebugPanel is OUT OF SCOPE for this sprint. Verifying shared `@afx/ui` theme compatibility is done by reusing the chat dev shell to validate token wiring.
- If `pnpm dev:workbench` reveals a Workbench-specific dev workflow that needs a switcher, file it as a follow-up rather than expanding scope here.

This makes appearance work testable end-to-end against mock data: a developer runs `pnpm dev:chat`, opens DebugPanel → Appearance, picks identity/style/host-mode, and validates visual outcomes against the same `--vscode-*` variables and `.cn-*` hooks the production extension will see.

### [DES-EXTRACT] Design-System Extraction Workflow

`docs/design-system/ui_kits/chat-main.html` is the canonical current chat mockup. It is not implementation code, but it does contain real field/section intent that must be mapped before any UI work starts.

Extraction sequence:

1. Record an inventory of all mockup sections: chat, focus/artifact preview, token visibility, theme matrix, chat history, session continuity, settings, debug/dev scenarios, workbench, document viewer, and site.
2. Classify each item as token, primitive composition, reusable composite, app-specific behavior, copy, or deferred protocol gap.
3. Map UI controls to existing `@afx/ui` primitives first.
4. Define any owned composite under app code unless it is clearly reusable across apps.
5. Translate prototype JavaScript into React state, mock transport scenarios, or host protocol only after a spec-backed decision.

### [DES-MOCKUPS] Full Mockup Audit and Data Contract

**Important**: mockup values such as token counts, runtime labels, history event names, settings field shapes, model names, skill lists, stderr lines, and provider summaries were **sampled from the live Pi repo and AFX runtime contracts** when the mockups were drafted. They are not invented. When implementation matches them to current `messages.ts` shapes (rows below), it is faithful reconstruction, not approximation — and any field that does not map back to a real path here is a deferred protocol gap, not a missing UI requirement.

The static mockups are not all equal. Implementation must treat each mockup as one of: current sprint contract, future Workbench contract, visual lineage, or brand/site reference.

| Mockup / Source                                                                                                          | Use In This Sprint                                                                               | Data Status                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design-system/ui_kits/chat-main.html`                                                                              | Primary Chat/History/Settings extraction source                                                  | Contains real Pi/AFX-facing fields; map each field to current messages or explicit deferrals before coding.                       |
| `docs/design-system/ui_kits/extension-v2/index.html` and `ui_kits/extension/extension-v2/index.html`                     | Same lineage as `chat-main.html`; use for cross-checking only                                    | Treat duplicate/variant content as reference, not separate requirements.                                                          |
| `docs/design-system/ui_kits/extension/index.html`                                                                        | Visual lineage for Meridian chrome, token cleanup, threadline, old sidebar/workbench treatment   | Uses older paths such as `apps/sidebar`; do not use as current data contract.                                                     |
| `docs/design-system/ui_kits/extension-bottom-panel/index.html`                                                           | Workbench/markdown-viewer visual reference only; this sprint verifies shared theme compatibility | Current workbench views and host protocol exist; use as reference unless promoted through `220-app-workbench`.                    |
| `docs/design-system/ui_kits/viewer-generic.html` and `ui_kits/spec-viewer/index.html`                                    | Future AFX markdown previewer direction only                                                     | Can map to `@afx/parsers` outputs later; not a Chat/History/Settings implementation target in this sprint.                        |
| `docs/design-system/ui_kits/site.html` and `ui_kits/site/index.html`                                                     | Brand/copy/positioning reference only                                                            | No runtime app data contract.                                                                                                     |
| `docs/design-system/docs/*.md`, especially `rev-02-direction.md`, `token-visibility-ui.md`, and `chat-history-events.md` | Source-backed rationale for fields, copy stance, and event language                              | Use these notes to decide what is real now, estimated, or deferred.                                                               |

Mockup fields that are real today through current AFX/Pi paths:

- Active runtime/session: `sessionId`, `sessionName`, `messageCount`, `pendingMessageCount`, `thinkingLevel`, `steeringMode`, `followUpMode`, `autoCompactionEnabled`, `autoRetryEnabled`, and `isCompacting` from `agent/runtimeSettings`.
- Active transcript: `ChatMessageView[]` from `chat/state` plus `chat/messageStart`, `chat/messageDelta`, `chat/messageEnd`, `chat/thinkingDelta`, `chat/toolStart`, and `chat/toolEnd`.
- Tool/event evidence: `ChatToolView.toolName`, `status`, `summary`, and `args`; enough for read/edit/run/failed classification but not enough for guaranteed duration, diff stats, screenshots, or raw command output.
- Usage receipts: `chat/usage` / `ChatUsageView` with input/output/cache/total tokens, cost, and optional context usage.
- Runtime controls: thinking, steering, follow-up, auto-compaction, auto-retry, compact, new session, abort, steer, and follow-up messages.
- Model and skill metadata: `agent/models`, `agent/modelChanged`, `agent/commands`, and the existing slash/action surfaces.
- Settings snapshot: engine binary, bundled skills path/count, ephemeral mode, provider model counts, log level, extension version, and spec path from `agent/settingsSnapshot`.
- Diagnostics/files: `agent/stderr` and `agent/files` where the existing UI asks for them.

Mockup fields that need a small host/protocol addition in this sprint:

- Appearance state in Settings: current `afx.theme`, new `afx.style`, implemented option lists, and validated update messages.
- Browser-dev appearance state: mock/local equivalent of identity/style selection.

Mockup fields that must stay deferred unless a separate spec/protocol is added:

- Pi auth source detail such as "resolved from Pi auth.json" versus environment/auth.
- AFX SecretStorage provider-key fallback, provider-key injection into Pi, and "AFX key" model prioritization.
- Host-owned model routing by skill/behavior, model locks, and persisted "remember last pick" policy.
- Durable `.afx/context.md` metadata such as saved date, branch, feature count, bundle contents, consume/clear state, and journal links.
- Saved session trees, branch history, transcript reopening, or Pi session listing.
- Workbench portfolio features beyond the current `220-app-workbench` protocol.

Implementation rule: a mockup value can ship as live UI only if it maps to one of the real paths above or to an explicit new message/config path in this sprint. Otherwise it must be rendered as disabled/deferred copy, a command suggestion, a dev-only mock scenario, or not rendered.

#### Sprint Extraction Map (Mockup → View → Task)

The screenshot and source review of `docs/design-system/ui_kits/chat-main.html` enumerate the chunks this sprint extracts into `apps/chat`. (`packages/chat` does not exist — the workspace has `apps/chat`. References below use the verified path.) "In" rows are sprint scope and tied to existing tasks. "Out" rows are deferred per user direction or per existing `[DES-MOCKUPS]` deferrals; they MUST NOT be implemented in this sprint.

| Mockup chunk (chat-main.html)                                                                                    | Current state in `apps/chat`                     | Target file                                                     | Tasks                         | In/Out                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab nav (Chat / History / Settings)                                                                              | Exists                                           | `apps/chat/src/app.tsx`                                         | —                             | In — no API change; semantic color cleanup only                                                                                                                                                                      |
| Compact + New session icons (top-right)                                                                          | Exists (`chat/newSession` at `chat.tsx:451-467`) | `apps/chat/src/views/chat.tsx`                                  | 3.1                           | In — color/semantic cleanup                                                                                                                                                                                          |
| Per-response token receipt (`UsagePill`, `AssistantMeta`)                                                        | Exists                                           | `apps/chat/src/views/chat.tsx`                                  | 3.2                           | In — actual-vs-estimated label clarity                                                                                                                                                                               |
| Token preflight composer strip (`24% NOW +0.9K EST AFTER 27%`)                                                   | Not present                                      | `apps/chat/src/views/chat.tsx`                                  | 3.2                           | In — gated by FR-9; show only when honest estimate data is available, label as `est`                                                                                                                                 |
| Composer toolbar (`@`, `/`, model picker, thinking picker)                                                       | Exists                                           | `apps/chat/src/views/chat.tsx`                                  | 3.1, 3.2                      | In — copy/label alignment with mockup                                                                                                                                                                                |
| Model dropdown (selected model + sources)                                                                        | Exists                                           | `apps/chat/src/views/chat.tsx`                                  | 3.2                           | In — label alignment, semantic color cleanup                                                                                                                                                                         |
| **Smart switch policy (Auto / Manual rows in model dropdown)**                                                   | Not present                                      | —                                                               | —                             | **Out — user-confirmed skip; promote to follow-up spec if needed**                                                                                                                                                   |
| **AFX-INJECTED ON CALL / PI-REPORTED model groupings**                                                           | Not present                                      | —                                                               | —                             | **Out — depends on Pi auth-source detail and AFX-key prioritization; per existing `[DES-MOCKUPS]` deferrals**                                                                                                        |
| NEXT command suggestion chips (e.g. `/afx-task verify 3.1`, `/afx-check path apps/chat`, `/afx-session capture`) | Not present                                      | `apps/chat/src/views/chat.tsx`                                  | 3.1 (composition), 3.2 (data) | In — derive from `agent/commands` (verified shape: `{ name, description?, source: "extension"\|"prompt"\|"skill" }`); show as a compact chip strip near the composer; degrade gracefully when commands list is empty |
| History: Pi-derived rows (transcript / tool / usage)                                                             | Partial in `history.tsx`                         | `apps/chat/src/views/history.tsx` + new `lib/history-events.ts` | 4.1, 4.2                      | In                                                                                                                                                                                                                   |
| History: `/afx-context save` & `/afx-context load` action chips                                                  | Not present                                      | `apps/chat/src/views/history.tsx`                               | 4.2                           | In — render as command affordances only; live `.afx/context.md` bundle metadata stays deferred per `[DES-HISTORY]`                                                                                                   |
| **History: durable session list / branch tree / saved transcripts**                                              | Not present                                      | —                                                               | —                             | **Out — protocol gap; existing `[DES-MOCKUPS]` deferral**                                                                                                                                                            |
| Settings: Runtime category                                                                                       | Long stack today; reorganize                     | `apps/chat/src/views/settings.tsx`                              | 5.1, 5.3                      | In                                                                                                                                                                                                                   |
| Settings: Identity & Style sections                                                                              | Not present                                      | `apps/chat/src/views/settings.tsx`                              | 5.2                           | In — wired through new `appearance/update` host message                                                                                                                                                              |
| **Settings: provider auth / SecretStorage / model routing**                                                      | Not present                                      | —                                                               | —                             | **Out — needs separate spec; existing `[DES-MOCKUPS]` deferral**                                                                                                                                                     |
| DebugPanel: Scenarios tab + Log tab                                                                              | Exists                                           | `apps/chat/src/components/debug-panel.tsx`                      | —                             | In — no API change; semantic color cleanup                                                                                                                                                                           |
| DebugPanel: Appearance tab (identity / style / host-mode switchers)                                              | Not present                                      | `apps/chat/src/components/debug-panel.tsx`                      | 6.2                           | In — per `[DES-DEV]`. Style switcher exposes all 7 (lyra, luma, maia, nova, vega, mira, sera) at T1 fidelity minimum                                                                                                 |
| DebugPanel: Pi runtime status group (`steer one-at-a-time`, `follow-up one-at-a-time`, `pending N`)              | Not present                                      | `apps/chat/src/components/debug-panel.tsx`                      | 6.2                           | In — derive from `agent/runtimeSettings` (`steeringMode`, `followUpMode`, `pendingMessageCount` — all verified)                                                                                                      |
| DebugPanel: Recent traffic mini-log (last ~3 transport messages)                                                 | Partial — full `Log` tab exists                  | `apps/chat/src/components/debug-panel.tsx`                      | 6.2                           | In — compact view inside Scenarios tab, sourced from the same `MockTransport` log stream as the full Log tab                                                                                                         |

Tasks 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.2 will be expanded in the next `/afx-sprint task` pass to enumerate the new chunks (token preflight, NEXT chips, AFX-context actions, DebugPanel runtime/traffic groups). The map above is the canonical scope contract; if a chunk is not in the table, it is not in this sprint.

### [DES-CHAT] Chat UI Composition

Existing chat implementation already includes status usage, per-message receipts, thinking controls, model/slash/mention popups, compact/new-session controls, queue strip, and timeline event rendering. This sprint refines those pieces rather than replacing the chat shell.

Implementation focus:

- preserve `UsagePill` and `AssistantMeta` actual usage receipts;
- use the design-system token labels where they fit: `Used`, `Context`, `Estimated add`, `Likely after`, `Cost`, and `Compaction risk`;
- make actual vs estimated usage explicit in labels/tooltips; actual values from `chat/usage` must read stronger than estimates;
- add composer preflight only when current transcript/runtime data supports an honest estimate, and mark estimates as `est`/`Estimated`;
- replace hardcoded colors with semantic classes/tokens;
- fix tool descriptor ordering;
- keep chat controls composed from existing `@afx/ui` primitives.

Current implementation check: `UsagePill`, `AssistantMeta`, and `chat/usage` already exist; there is no shared estimate flag in `ChatUsageView`, and composer preflight should therefore be UI-local or hidden until honest estimate data exists. `toolDescriptor` currently risks classifying `edit_file` as read-like because generic `file` matching can happen before edit/write/patch matching.

### [DES-HISTORY] History Work-Log Adapter

History remains active-session scoped. It should derive UI events from current available data:

```typescript
type HistoryEventKind =
  | "prompt"
  | "assistant"
  | "read"
  | "edit"
  | "run"
  | "failed"
  | "decision"
  | "usage"
  | "compaction";

interface ChatHistoryEvent {
  id: string;
  kind: HistoryEventKind;
  title: string;
  detail?: string;
  status?: "pending" | "running" | "done" | "error";
  timestamp?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimated?: boolean;
  };
  sourceMessageId?: string;
}
```

This adapter should live in `apps/chat/src/lib/history-events.ts` or near the History view if it is not reusable yet. It must not imply durable session storage.

The design-system target is a work-log with density modes:

```text
Narrative  user/assistant text with grouped tool summaries
Trace      default; tool rows, trace chips, status, compact previews
Audit      raw tool names, arguments, timestamps, durations, ids where available
```

The first implementation can ship Trace plus a compact Narrative toggle if that is all current data supports. Audit must not invent raw fields that are not present in the transcript/tool events.

Data-backed history fields from the mockups:

- Session header: use `sessionName`, `sessionId`, `messageCount`, `pendingMessageCount`, `steeringMode`, `followUpMode`, `autoCompactionEnabled`, `autoRetryEnabled`, and `isCompacting` from runtime settings.
- Turn rows: use current `ChatMessageView` pairs, `createdAt`, streaming state, `usage`, `tools`, and `stopReason`.
- Work-log rows: derive read/edit/run/failed/search/activity labels from `ChatToolView.toolName`, `status`, `summary`, and `args`; classify edit/write/patch before generic file/read.
- Usage chips: use actual `ChatUsageView` values only. Estimates must be marked `estimated` and should be absent until a UI-local estimate is honest.
- AFX context actions: show `/afx-context save` and `/afx-context load` as command/action affordances only unless the host exposes the current `.afx/context.md` bundle. Do not show saved date, branch, feature count, or bundle contents as live data without that bridge.

### [DES-SETTINGS] Settings Destination

Settings should become a focused destination rather than one long diagnostic stack.

Suggested sections:

```text
Runtime      thinking, steering, follow-up, compaction, retry, new session
Identity     AFX/Meridian accent identity, host-adaptive note, preview if available
Style        Lyra boxy, Luma rounded, and other implemented treatments
Providers    provider summary and selected model/default disclosure
Skills       available skills/commands from current runtime snapshot
Diagnostics  log level, stderr, mock scenario/debug affordances where dev-only
About        version, paths, extension/build metadata
```

At narrow sidebar widths, use stacked sections or segmented navigation that does not require horizontal overflow. Controls must preserve small-width fit.

Current implementation check: `apps/chat/src/views/settings.tsx` already renders runtime controls, providers, skills, diagnostics, stderr/log affordances, and about data from `agent/settingsSnapshot`, but it is a long vertical stack and has no Identity/Style section. Appearance selection should write VS Code settings through the host path: `afx.theme` for AFX/Meridian identity and `afx.style` for Lyra/Luma-style treatment. Browser dev can use local mock state when VS Code configuration is unavailable.

Data-backed settings fields from the mockups:

| Section     | Can Ship From Current Data                                                                                     | Needs This Sprint Addition                                       | Deferred / Do Not Fake                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Runtime     | agent binary, ephemeral mode, session runtime controls, compact/new-session/abort, pending count, stderr       | optional confirm affordance for runtime mutations if UX needs it | none                                                                                               |
| Identity    | host-adaptive note and AFX/Meridian default                                                                    | current `afx.theme`, implemented options, update message         | arbitrary shadcn color/theme families not extracted yet                                            |
| Style       | Lyra as current primitive treatment baseline                                                                   | new `afx.style`, implemented options, update message             | exact Luma/Maia/Sera component parity until component regeneration/refactor is separately approved |
| Providers   | provider model counts from `getAvailableModels()` / `agent/settingsSnapshot.providers`; selected model in Chat | selected/default model disclosure if added to snapshot           | Pi auth source detail, AFX key fallback, "AFX key" prioritization, SecretStorage management        |
| Skills      | `agent/commands` grouped by `source`, plus extension actions                                                   | none                                                             | skill-specific model routing / locks                                                               |
| Diagnostics | log level, buffered stderr, mock scenario/debug affordances in dev                                             | appearance/mock scenario additions as needed                     | production-only debug controls                                                                     |
| About       | extension version, spec path, bundled skills path/count                                                        | update spec path to this sprint/foundation where appropriate     | build metadata not exposed by host                                                                 |

The Settings mockup's provider-auth and model-routing cards are product direction, not current implementation scope. If they become required, promote them to a follow-up spec that extends `SettingsSnapshot`, VS Code SecretStorage handling, Pi launch/env injection, and model-selection policy.

### [DES-MOCKS] Mock Transport and Data

Mock support lives in `packages/transport/src/mock.ts` for transport events and in app-local fixture helpers only when view-specific.

Existing mock support already covers many chat/runtime cases, including usage, context-near-full, tool read/edit/bash/multi/error, provider errors, abort, runtime settings, settings snapshots, models, commands, files, stderr, and compaction states. Additions should fill gaps instead of duplicating scenarios.

Mock additions may include:

- high context pressure;
- token estimate before send;
- mixed tool read/edit/run events;
- failed command/tool event;
- runtime identity/style state;
- settings snapshot with enough data for destination layout.

Mock scenarios must stay browser-dev/test aids, not production assumptions.

### [DES-FILES] File Structure

| File / Directory                                                                                   | Expected Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/design-system/docs/split-map.md`                                                             | Required inventory updates for extracted mockup sections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/ui/src/styles/globals.css`                                                               | Import runtime appearance files and expose semantic variables to Tailwind                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/ui/src/styles/meridian.tokens.css`                                                       | Align with reviewed host-first font/token direction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/ui/src/styles/theme-meridian.css`                                                        | Preserve host-adaptive surface mapping and AFX accents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `packages/ui/src/styles/theme-lyra.css`                                                            | Rename, reinterpret, or replace as style/treatment tokens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/ui/src/styles/style-lyra.css`                                                            | Extract from `apps/v4/registry/styles/style-lyra.css`; T2 fidelity (current baseline)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/ui/src/styles/style-luma.css`                                                            | Extract from upstream `style-luma.css`; T1 mandatory, T2 stretch                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/ui/src/styles/style-maia.css`                                                            | Extract from upstream `style-maia.css`; T1 mandatory, T2 stretch                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/ui/src/styles/style-nova.css`                                                            | Extract from upstream `style-nova.css`; T1 mandatory, T2 stretch                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/ui/src/styles/style-vega.css`                                                            | Extract from upstream `style-vega.css`; T1 mandatory, T2 stretch                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/ui/src/styles/style-mira.css`                                                            | Extract from upstream `style-mira.css`; T1 mandatory, T2 stretch                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/ui/src/styles/style-sera.css`                                                            | Extract from upstream `style-sera.css`; T1 mandatory, T2 stretch                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `packages/ui/src/components/*.tsx` (all 50 hooked primitives, 5 exempt — full table in `[DES-CN]`) | Add full `.cn-*` hook coverage. Phase 1.5a (priority): `button.tsx`, `badge.tsx`, `card.tsx`, `tabs.tsx`, `input.tsx`, `textarea.tsx`, `input-group.tsx`, `native-select.tsx`, `select.tsx`, `popover.tsx`, `command.tsx`, `tooltip.tsx`, `switch.tsx`, `scroll-area.tsx`, `button-group.tsx`, `avatar.tsx`, `separator.tsx`, `label.tsx`, `slider.tsx`. Phase 1.5b (mechanical batch): every other `.tsx` in the directory except the 5 exempt files (`aspect-ratio.tsx`, `carousel.tsx`, `collapsible.tsx`, `direction.tsx`, `spinner.tsx`). |
| `packages/ui/src/tokens/meridian.css`                                                              | Align or convert to compatibility wrapper for `@afx/ui/tokens`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/ui/src/index.ts`                                                                         | No app-specific exports; only shared UI utilities if needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `apps/vscode/package.json`                                                                         | Keep `afx.theme` default and add `afx.style` for implemented treatments                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/vscode/src/panels/webview-html.ts`                                                           | Identity/style allowlist and body-class mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/vscode/src/panels/webview-html.test.ts`                                                      | Tests for identity/style mapping and fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/chat/src/views/chat.tsx`                                                                     | Usage polish, semantic color cleanup, tool descriptor fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/chat/src/views/chat.test.tsx`                                                                | Tool descriptor and visible usage behavior tests where applicable                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `apps/chat/src/views/history.tsx`                                                                  | Active-session work-log UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/chat/src/views/settings.tsx`                                                                 | Destination layout, theme/style controls, focused sections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/chat/src/lib/history-events.ts`                                                              | New UI-local event adapter if needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/chat/src/lib/history-events.test.ts`                                                         | Event adapter classification/usage tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `apps/chat/src/lib/theme-preview.ts`                                                               | Optional browser-dev theme helper if not handled in component state                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/chat/src/components/debug-panel.tsx`                                                         | Optional dev-only theme/mock controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `packages/transport/src/mock.ts`                                                                   | Additional mock scenarios/data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/workbench/src/index.css` / `apps/workbench/src/app.tsx`                                      | Verify shared theme compatibility only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### [DES-API] API Contracts

Preferred first pass uses existing messages where possible:

- `agent/runtimeSettings`
- `agent/settingsSnapshot`
- `chat/usage`
- message/tool events already rendered by Chat

Settings needs a minimal validated host write path if users can change appearance inside the webview:

- add or reuse a webview-to-host message to update `afx.theme` and `afx.style`;
- validate both values against the same allowlists used for body classes;
- write with `vscode.workspace.getConfiguration("afx").update(...)`;
- include current identity/style values in `agent/settingsSnapshot` so Settings can render persisted state.

Browser dev can keep this app-local or mock-backed when VS Code configuration is unavailable.

### [DES-DATA] Data Model

The only new durable-ish data shape expected in this sprint is UI-local:

```typescript
interface RuntimeThemeOption {
  id: "meridian";
  label: string;
  implemented: boolean;
  description: string;
  scope: "identity-accent";
}

interface RuntimeStyleOption {
  id: "lyra" | "luma" | "maia" | "nova" | "vega" | "mira" | "sera";
  label: string;
  implemented: boolean; // all 7 ship `true` this sprint per [DES-SHADCN] coverage commitment
  description: string;
  scope: "style-treatment";
  primitiveBaseline: "radix-lyra"; // all 7 styles run over the same Lyra-generated component baseline; treatment differs per style
  fidelityTier: "T1" | "T2" | "T3"; // see [DES-SHADCN] tier definitions; sprint exit floor: T1 for all, T2 for lyra
}
```

History events are derived view models, not persisted records. Identity and style selection are stored by VS Code configuration in the extension host; browser dev can use local transient state.

### [DES-DEPS] Dependencies

No new runtime dependencies are expected. Use existing:

- `@afx/ui` shadcn primitives;
- `lucide-react` icons already available in apps;
- `@afx/transport` mock transport;
- Tailwind v4 CSS variables.

If shadcn token extraction requires one-off scripts or CLI inspection, treat that as follow-up tooling unless the implementation can do it without adding package dependencies.

### [DES-SEC] Security Considerations

- Do not copy prototype JavaScript from `docs/design-system` into production.
- Do not add dynamic CSS or unsafe inline script paths beyond the existing webview CSP model.
- Do not expose dev-only mock controls in production VS Code webviews.
- Do not read filesystem data from Chat or Workbench browser code.

### [DES-ERR] Error Handling

| Scenario                                        | Handling                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Unknown `afx.theme` value                       | Fall back to AFX/Meridian identity and avoid injecting unknown body classes            |
| Unknown `afx.style` value                       | Fall back to Lyra treatment and avoid injecting unknown body classes                   |
| Identity/style file missing for selected option | Do not expose the option as implemented; fall back to AFX/Meridian + Lyra              |
| Token estimate unavailable                      | Hide composer preflight or label it unavailable instead of inventing numbers           |
| History event cannot be classified              | Render a neutral "activity" row with source message details if available               |
| Settings snapshot incomplete                    | Render disabled controls and explanatory muted copy, matching existing runtime pattern |
| Browser dev mock state differs from host        | Label dev-only preview controls clearly in DebugPanel or dev-only surface              |

### [DES-TEST] Testing Strategy

Existing test infrastructure (verified):

- Workspace Vitest config at `vitest.workspace.ts` covers `packages/{shared,parsers,transport,ui,agent/pi}`, `apps/{vscode,chat,workbench}` (unit), and `scripts/conventions`.
- `apps/vscode-e2e` exists for vscode-test-electron end-to-end runs.
- Existing test files this sprint extends: `apps/vscode/src/panels/webview-html.test.ts`, `apps/vscode/src/panels/sidebar-panel.test.ts`, `apps/chat/src/app.test.tsx`, `apps/chat/src/components/debug-panel.test.tsx`, `apps/chat/src/lib/composer-detect.test.ts`, `apps/chat/src/lib/settings-snapshot.test.ts`, `packages/transport/src/mock.test.ts`.
- Missing test files this sprint creates: `apps/chat/src/lib/history-events.test.ts`, `apps/chat/src/lib/tool-descriptor.test.ts` (helper extracted from `chat.tsx`), and either `apps/chat/src/views/settings.test.tsx` or a Settings-option helper test where wiring lives outside view JSX.

Unit tests:

- `packages/ui`: render-to-string checks for required `.cn-*` hooks on priority primitives (Button, Badge, Card, Tabs, Input, Textarea, InputGroup, Select, Popover, Command). Render each variant×size and grep `className` for the required hook string; failing this catches regressions where hook classes get dropped from `cva` base/variant strings.
- `apps/vscode`: extend `webview-html.test.ts` to cover identity × style matrix (`afx.theme=meridian/unknown`, `afx.style=lyra/luma/unknown`), fallback to `theme-meridian style-lyra`, and additive class behavior (host `vscode-*` body classes preserved).
- `apps/chat`: pure-helper tests for `tool-descriptor.ts` (read, edit, write, patch, run, multi, error classification with the `edit_file` regression case as a named fixture), `history-events.ts` (transcript → `ChatHistoryEvent[]` mapping with read/edit/run/failed/usage/compaction kinds), and any extracted Settings option helper.
- `packages/transport`: extend `mock.test.ts` with assertions for the few new scenarios actually added (do not duplicate the existing 28 named scenarios).

Integration tests (mandated by review — not surface-level):

- **Webview HTML render → body class → CSS variable resolution** (extends `apps/vscode/src/panels/webview-html.test.ts` or sibling `webview-html.integration.test.ts`): mount the rendered HTML in jsdom, set `afx.theme`/`afx.style` mocked configuration, assert body class string AND that a sample `.cn-button` element's computed style resolves treatment variables (`--afx-control-radius`, `--afx-control-height-default`) under the active style class. Catches the case where class injection works but CSS imports are wrong.
- **Webview → host configuration round-trip** (extends `apps/vscode/src/panels/sidebar-panel.test.ts`): post a typed `appearance/update` message from a fake webview; assert the host invokes the mocked `vscode.workspace.getConfiguration("afx").update("theme", value)` and `update("style", value)` with allowlist validation. Reject unknown values with a typed error response. This is the contract surface that Settings will use.
- **Chat view × mock scenario** (extends `apps/chat/src/app.test.tsx`): render `<App>` with `createMockTransport({ scenario: "context-near-full" })` and the new appearance-preview scenario if added; drive `agent/runtimeSettings` and `chat/usage` events; assert `UsagePill` text, `AssistantMeta` actual/estimated labels, and the tool-descriptor row classification (regression on `edit_file`).
- **History work-log adapter against transcript fixtures**: feed `ChatMessageView[]` + `ChatToolView[]` fixtures into `history-events.ts` and snapshot the produced rows for read/edit/run/failed/compaction. Failing snapshots catch silent regressions in event classification.
- **Architecture boundary tests** (already exist, must keep green): `apps/chat/src/no-pi-imports.test.ts`, `apps/vscode/src/panels/no-pi-imports.test.ts`. These are the structural invariants this sprint must not break.
- **End-to-end smoke (optional, scope-permitting)**: under `apps/vscode-e2e`, a small test that launches the extension, opens the chat sidebar, and asserts the body element contains `theme-meridian style-lyra` plus a `--vscode-*` variable resolves. Skip if e2e setup is brittle; defer rather than fake.

Manual/browser checks:

- `pnpm dev:chat` at 170 px, 280 px, 400 px, and 600 px widths.
- AFX/Meridian identity with Lyra treatment preview through DebugPanel.
- Dark, light, high-contrast, and high-contrast-light simulation by toggling the body class manually in the dev shell.
- History work-log against mock scenarios `multi-tool`, `tool-error`, `context-near-full`.
- Settings at 170–400 px width with all sections rendered.

Completion gates (must run, must read output):

- `pnpm --filter apps/chat test`
- `pnpm --filter packages/ui test` (when hook coverage tests land)
- `pnpm --filter packages/transport test`
- `pnpm --filter ./apps/vscode test`
- `pnpm --filter apps/chat build`
- `pnpm --filter apps/workbench build`
- `pnpm --filter ./apps/vscode build`
- `pnpm verify` (canonical lifecycle: types/lint/format/md/knip/test in parallel via `turbo --continue`)
- Per CLAUDE.md/AGENTS.md, do not report a task complete without running `pnpm verify` and reading its output.

### [DES-ROLLOUT] Migration / Rollout Plan

1. Land docs/sprint approval.
2. Implement token/appearance plumbing first so UI polish has stable semantics.
3. Land VS Code identity/style class mapping and tests.
4. Polish Chat, History, and Settings against mock scenarios.
5. Run browser dev checks.
6. Run targeted builds/tests.
7. Run `pnpm verify` and document any unrelated pre-existing failures.

Rollback is straightforward: runtime identity/style enums can be reduced to implemented options, and app UI polish can fall back to existing views because shared message contracts are expected to change only minimally.

### [DES-DEC] Key Decisions

| Decision                       | Options Considered                                   | Choice                                               | Rationale                                                               |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Appearance switching mechanism | shadcn regeneration, CSS runtime classes             | CSS runtime classes                                  | User-facing style switching must not rewrite registry-owned components. |
| Host surface authority         | fixed product palette, VS Code variables             | VS Code variables for ordinary surfaces              | Prevents white/dark box mismatch with user-installed themes.            |
| AFX identity scope             | full custom design system, shadcn plus identity pack | shadcn plus small AFX identity/accent pack           | Keeps AFX recognizable without fighting shadcn or host themes.          |
| Shadcn style parity            | treatment tokens, full primitive parity              | treatment tokens over Lyra primitive baseline        | Upstream generated components differ structurally by style.             |
| Shadcn preset usage            | expose all axes, opinionated axes                    | identity/accent plus style/treatment axes            | Avoids Settings complexity while preserving future expansion.           |
| History data source            | fake sessions, active transcript adapter             | active transcript adapter                            | Honest with current protocol surface.                                   |
| Mockup implementation path     | copy prototype code, extract into app code           | extract into tokens/primitives/compositions/behavior | Keeps architecture boundaries and shadcn primitive rule intact.         |
| Workbench scope                | full implementation, theme compatibility             | theme compatibility only                             | Keeps sprint centered on sidebar polish.                                |

### Open Technical Questions

| #   | Question                                                                                                | Status   |
| --- | ------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Which exact additional shadcn-derived family should be implemented after Lyra?                          | Deferred |
| 2   | Should appearance preview persist in browser dev localStorage or remain ephemeral?                      | Deferred |
| 3   | Should History event kinds eventually move to `@afx/shared`?                                            | Deferred |
| 4   | Do we later want a component-regeneration/refactor path for true Maia/Sera/etc. primitive shape parity? | Deferred |

<!-- SPRINT-SECTION-END: DESIGN -->

---

<!-- SPRINT-SECTION-START: TASKS (maps to tasks.md on graduation; promote ### → ##, #### → ###) -->

## 3. Tasks

> The WHEN — hierarchical implementation checklist. Every task group references the FR/DES it implements via an `@see` comment using the full project-relative sprint brief path while sprint mode is active.

### Task Numbering Convention

- **0.x** — Pre-implementation inventory and extraction planning
- **1.x** — Shared UI tokens and runtime appearance axes
- **2.x** — VS Code host appearance integration
- **3.x** — Chat token visibility and semantic cleanup
- **4.x** — History work-log
- **5.x** — Settings destination polish
- **6.x** — Mock scenarios and browser-dev checks
- **7.x** — Verification and rollout

References use Node IDs: `[FR-X]`, `[NFR-X]`, `[DES-X]`, and task IDs `[X.Y]`.

### Phase 0: Design-System Extraction Inventory

> Ref: [DES-EXTRACT], [FR-7], [FR-18]

#### 0.1 Inventory accepted mockup sections

<!-- files: docs/design-system/docs/split-map.md, docs/design-system/ui_kits/chat-main.html, docs/design-system/ui_kits/extension/index.html, docs/design-system/ui_kits/extension-v2/index.html, docs/design-system/ui_kits/extension/extension-v2/index.html, docs/design-system/ui_kits/extension-bottom-panel/index.html, docs/design-system/ui_kits/viewer-generic.html, docs/design-system/ui_kits/spec-viewer/index.html, docs/design-system/ui_kits/site.html, docs/design-system/ui_kits/site/index.html -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-7] [FR-18] [DES-OVR] [DES-ARCH] [DES-EXTRACT] [DES-MOCKUPS] -->

- [x] Inventory every `docs/design-system/ui_kits/**` mockup and classify it as sprint contract, future Workbench contract, visual lineage, or brand/site reference.
- [x] Identify the `chat-main.html` sections that map to token visibility, theme matrix, history, session continuity, settings, and debug/mock scenarios.
- [x] Include the supporting docs: `token-visibility-ui.md`, `chat-history-events.md`, `rev-02-direction.md`, and `split-map.md`.
- [x] Classify each extracted item as token, primitive composition, reusable composite, app-specific behavior, copy, live data, host/protocol addition, or deferred protocol gap.
- [x] Record deferred protocol gaps instead of silently implementing fake state.

#### 0.2 Map prototype UI to shadcn primitives

<!-- files: docs/design-system/docs/split-map.md, docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-7] [FR-17] [DES-EXTRACT] [DES-MOCKUPS] [DES-CHAT] [DES-HISTORY] [DES-SETTINGS] [DES-DEC] -->

- [x] Map buttons, tabs, switches, selects, popovers, command lists, tooltips, badges, cards, and scroll containers to existing `@afx/ui` primitives.
- [x] Identify any owned composite candidates and justify why primitives alone are insufficient.
- [x] Keep app-specific composites in `apps/chat` unless they are clearly reusable across apps.

#### 0.3 Validate feasibility before coding

<!-- files: docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md, apps/vscode/package.json, apps/vscode/src/panels/webview-html.ts, packages/ui/src/styles/globals.css, packages/shared/src/messages.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-4] [FR-5] [FR-14] [FR-18] [DES-FEAS] [DES-SHADCN] [DES-VSCODE] [DES-API] -->

- [x] Confirm every implementation task maps to a source-backed row in [DES-FEAS].
- [x] If implementation discovers a missing source fact, update [DES-FEAS] before coding around it.
- [x] Defer any UI promise that requires unsupported protocol, shadcn component shape parity, or durable session data.

### Phase 1: Shared Theme Contract

> Ref: [DES-TOKENS], [DES-HOST], [DES-SHADCN]

#### 1.1 Align token source of truth

<!-- files: packages/ui/src/styles/globals.css, packages/ui/src/styles/meridian.tokens.css, packages/ui/src/tokens/meridian.css, packages/ui/package.json -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-1] [FR-2] [NFR-3] [DES-TOKENS] [DES-FILES] -->

- [x] Decide whether `packages/ui/src/tokens/meridian.css` becomes a compatibility import or is updated to match the live Meridian source.
- [x] Ensure `@afx/ui/tokens` no longer exposes a conflicting older palette.
- [x] Remove or justify Workbench's double import of `@afx/ui/styles/globals.css` and `@afx/ui/tokens`.
- [x] Preserve public package exports while aligning implementation.

#### 1.2 Preserve host-adaptive semantic surfaces

<!-- files: packages/ui/src/styles/theme-meridian.css, packages/ui/src/styles/theme-lyra.css, packages/ui/src/styles/globals.css -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-1] [FR-3] [NFR-1] [DES-HOST] [DES-TOKENS] -->

- [x] Audit `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--input`, `--ring`, selection, and focus variables.
- [x] Fix `--input` to use `--vscode-input-background` for input fill; use `--vscode-input-border` for border/focus roles instead of fill.
- [x] Ensure AFX/Meridian identity and the current Lyra treatment file prefer `--vscode-*` variables for ordinary surfaces.
- [x] Keep AFX accent roles for brand/thread/status/token receipt semantics.
- [x] Check explicit `vscode-high-contrast` and `vscode-high-contrast-light` behavior for borders, focus rings, selection, and disabled states.

#### 1.3 Define runtime style-treatment extension shape

<!-- files: packages/ui/src/styles/globals.css, packages/ui/src/styles/theme-meridian.css, packages/ui/src/styles/theme-lyra.css, packages/ui/src/styles/style-*.css -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-4] [NFR-3] [DES-SHADCN] [DES-TOKENS] -->

- [x] Document or encode the shape expected by future `style-maia.css`, `style-nova.css`, `style-vega.css`, `style-mira.css`, `style-luma.css`, and `style-sera.css`.
- [x] Encode the shared runtime treatment shape for `style-lyra.css`, `style-luma.css`, `style-maia.css`, `style-nova.css`, `style-vega.css`, `style-mira.css`, and `style-sera.css`.
- [x] Keep AFX/Meridian as the identity/accent pack and Lyra as the primitive baseline while all seven treatment files land at T1 minimum.
- [x] Avoid changing shadcn component source or `components.json`.
- [x] Audit current primitives for baked Lyra structural choices and record any treatment limits that prevent T2 parity for non-Lyra styles.

#### 1.4 Update font defaults for host-aware app surfaces

<!-- files: packages/ui/src/styles/meridian.tokens.css, packages/ui/src/styles/globals.css, packages/ui/src/styles/theme-meridian.css -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-1] [FR-3] [NFR-1] [DES-HOST] [DES-TOKENS] -->

- [x] Prefer `--vscode-font-family` / editor font hints for body text and chat-facing surfaces.
- [x] Keep selected-family fonts available for headings, empty states, previews, and non-chat surfaces.
- [x] Remove or neutralize assumptions that runtime webviews must fetch external fonts.

#### 1.5 Add `.cn-*` hooks to priority primitives

<!-- files: packages/ui/src/components/button.tsx, packages/ui/src/components/badge.tsx, packages/ui/src/components/card.tsx, packages/ui/src/components/tabs.tsx, packages/ui/src/components/input.tsx, packages/ui/src/components/textarea.tsx, packages/ui/src/components/input-group.tsx, packages/ui/src/components/native-select.tsx, packages/ui/src/components/select.tsx, packages/ui/src/components/popover.tsx, packages/ui/src/components/command.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-4] [FR-17] [NFR-3] [DES-CN] [DES-SHADCN] [DES-FEAS] -->

- [x] Add stable `.cn-*` hook classes alongside existing generated classes.
- [x] Add variant and size hooks for components with CVA variants, such as `cn-button-variant-*` and `cn-button-size-*`.
- [x] Preserve public component APIs, `data-slot`, `data-variant`, `data-size`, exports, and `className` override behavior.
- [x] Land the `1.5a` priority primitive batch first: Button, Badge, Card, Tabs, Input, Textarea, InputGroup, NativeSelect, Select, Popover, Command, Tooltip, Switch, ScrollArea, ButtonGroup, Avatar, Separator, Label, and Slider.
- [x] Keep the hook pass mechanical; do not tune visuals in the same edit.

#### 1.6 Extract AFX-owned style treatment CSS

<!-- files: packages/ui/src/styles/globals.css, packages/ui/src/styles/theme-lyra.css, packages/ui/src/styles/style-lyra.css, packages/ui/src/styles/style-luma.css, packages/ui/src/styles/style-maia.css, packages/ui/src/styles/style-nova.css, packages/ui/src/styles/style-vega.css, packages/ui/src/styles/style-mira.css, packages/ui/src/styles/style-sera.css -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-4] [FR-17] [NFR-1] [NFR-3] [DES-CN] [DES-SHADCN] [DES-HOST] -->

- [x] Extract all seven shadcn style treatment CSS files into AFX-owned `style-{name}.css` files: `lyra`, `luma`, `maia`, `nova`, `vega`, `mira`, and `sera`.
- [x] Ensure all seven style files import through `packages/ui/src/styles/globals.css`.
- [x] Reach T1 render fidelity for all seven styles across Chat, History, Settings, and DebugPanel surfaces.
- [x] Reach T2 visual fidelity for Lyra as the current baseline; document non-Lyra deviations in the per-style file headers.
- [x] Prefer treatment variables for repeated radius, border, focus ring, control height, and density choices.
- [x] Keep host-adaptive colors and AFX identity tokens authoritative; do not import upstream style CSS wholesale.
- [x] If any style cannot reach T1, do not expose a partial seven-style set; defer the sprint or remove the style via explicit ADR/spec update.

#### 1.7 Complete `.cn-*` hooks for remaining primitives

<!-- files: packages/ui/src/components/*.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-4] [FR-17] [NFR-3] [DES-CN] [DES-SHADCN] [DES-FEAS] -->

- [x] Add the `1.5b` mechanical hook batch for every remaining hooked primitive listed in [DES-CN].
- [x] Preserve the five documented exemptions: `aspect-ratio.tsx`, `carousel.tsx`, `collapsible.tsx`, `direction.tsx`, and `spinner.tsx`.
- [x] Re-grep upstream `style-lyra.css` at the start of this task and update the exemption list if shadcn adds hooks for any exempt primitive.
- [x] Add or update static/render tests so every required hook root and variant/size suffix is present for all 50 hooked primitives.

### Phase 2: VS Code Host Appearance Integration

> Ref: [DES-VSCODE], [FR-5]

#### 2.1 Extend appearance allowlist and body-class mapping

<!-- files: apps/vscode/package.json, apps/vscode/src/panels/webview-html.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-5] [FR-14] [NFR-1] [DES-VSCODE] [DES-HOST] -->

- [x] Keep `meridian` as default.
- [x] Add `afx.style` with the full all-or-nothing treatment enum: `lyra`, `luma`, `maia`, `nova`, `vega`, `mira`, and `sera`.
- [x] Map known identity/style values to safe body classes.
- [x] Fall back to AFX/Meridian + Lyra for unknown or unsupported values.
- [x] Preserve backwards compatibility for any existing `afx.theme=lyra` value while migrating Lyra to the style/treatment axis.
- [x] Do not expose a partial production style enum; all seven styles must meet T1 or the enum must stay limited by an explicit follow-up decision.

#### 2.2 Test host appearance injection

<!-- files: apps/vscode/src/panels/webview-html.test.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-5] [NFR-1] [DES-VSCODE] [DES-TEST] -->

- [x] Add/adjust tests for identity and style body class injection.
- [x] Add fallback coverage for unknown identity/style config values.
- [x] Keep VS Code host classes and `--vscode-*` variables additive; do not replace them with AFX theme classes.
- [x] Add tests for all seven implemented style treatment classes and unknown-style fallback.

### Phase 3: Chat Token Visibility and Semantic Cleanup

> Ref: [DES-CHAT], [FR-8], [FR-9], [FR-10]

#### 3.1 Replace hardcoded chat colors with semantics

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/views/history.tsx, packages/ui/src/styles/globals.css -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-8] [FR-17] [NFR-1] [NFR-5] [DES-CHAT] [DES-HOST] -->

- [x] Replace hardcoded Tailwind palette colors such as `sky` with semantic theme classes or AFX token roles.
- [x] Ensure user/event markers remain visible in dark, light, and high-contrast host themes.
- [x] Avoid adding app-local raw palette variables when shared semantics are appropriate.

#### 3.2 Polish usage receipts and token visibility

<!-- files: apps/chat/src/views/chat.tsx, packages/shared/src/messages.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-9] [NFR-5] [DES-CHAT] [DES-DATA] -->

- [x] Review `UsagePill` and `AssistantMeta` for clarity, density, and actual-vs-estimated labels.
- [x] Use design-system labels consistently where surfaced: `Used`, `Context`, `Estimated add`, `Likely after`, `Cost`, and `Compaction risk`.
- [x] Add composer preflight only when honest estimate data is available.
- [x] Keep token information near the chat rhythm, not as a separate noisy panel.
- [x] Avoid duplicating the same usage number in multiple adjacent locations.

#### 3.3 Fix tool/timeline descriptor classification

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/views/chat.test.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-10] [DES-CHAT] [DES-ERR] [DES-TEST] -->

- [x] Classify edit/write/patch commands before read/file fallback.
- [x] Add a focused unit test or helper test for representative names such as `edit_file`, `write_file`, `read_file`, and `shell`.
- [x] Ensure existing timeline rendering still handles unknown events.

### Phase 4: History Work-Log

> Ref: [DES-HISTORY], [FR-11], [FR-12]

#### 4.1 Add UI-local history event adapter

<!-- files: apps/chat/src/lib/history-events.ts, apps/chat/src/views/history.tsx, apps/chat/src/lib/history-events.test.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-11] [FR-12] [NFR-2] [DES-HISTORY] [DES-DATA] [DES-TEST] -->

- [x] Create a UI-local adapter that derives `ChatHistoryEvent` rows from current messages, tool events, usage, and runtime state.
- [x] Include read/edit/run/failed/decision/usage/compaction-style event kinds when supported by current data.
- [x] Include density semantics from the design docs: Narrative, Trace, and Audit, even if Audit is deferred until raw fields exist.
- [x] Add tests for read/edit/run classification and usage receipt mapping.

#### 4.2 Rework History view around active-session work log

<!-- files: apps/chat/src/views/history.tsx, apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-11] [FR-12] [FR-17] [NFR-5] [DES-HISTORY] [DES-CHAT] -->

- [x] Replace or evolve turn cards into compact work-log rows.
- [x] Keep active-session scope explicit.
- [x] Add empty/loading states that do not imply durable session listing.
- [x] Preserve search/filter only if it remains useful with the work-log shape.

#### 4.3 Prevent fake durable session UI

<!-- files: apps/chat/src/views/history.tsx, packages/shared/src/messages.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-12] [FR-18] [NFR-2] [DES-HISTORY] [DES-ERR] -->

- [x] Remove or avoid labels that imply saved Pi sessions, branches, or session reopening.
- [x] Document any protocol gaps discovered while shaping History.
- [x] Keep AFX context/handoff concepts visually distinct from Pi session history if shown.

### Phase 5: Settings Destination Polish

> Ref: [DES-SETTINGS], [FR-13], [FR-14]

#### 5.1 Restructure Settings into focused categories

<!-- files: apps/chat/src/views/settings.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-13] [FR-17] [NFR-5] [NFR-6] [DES-SETTINGS] -->

- [x] Add compact navigation or section grouping for Runtime, Identity, Style, Providers, Skills, Diagnostics, and About.
- [x] Keep controls usable at normal VS Code sidebar widths.
- [x] Preserve existing runtime controls and disabled/pending state behavior.
- [x] Keep auth, SecretStorage, provider-key management, and model-routing policy out of this sprint unless a separate spec/ADR promotes them.

#### 5.2 Add runtime identity/style selection surface

<!-- files: apps/chat/src/views/settings.tsx, apps/vscode/src/panels/sidebar-panel.ts, packages/shared/src/messages.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-5] [FR-13] [FR-14] [DES-SETTINGS] [DES-VSCODE] [DES-API] -->

- [x] Show implemented identity/accent and style/treatment options in Settings.
- [x] Explain host-adaptive behavior in concise product copy.
- [x] Wire selection through VS Code configuration: `afx.theme` for identity/accent and `afx.style` for style/treatment.
- [x] In browser dev, use mock/local state if VS Code configuration is unavailable.
- [x] Do not expose unimplemented shadcn treatment styles as selectable production choices.

#### 5.3 Preserve Settings diagnostics and skill visibility

<!-- files: apps/chat/src/views/settings.tsx, packages/shared/src/messages.ts, packages/transport/src/mock.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-13] [FR-15] [FR-17] [DES-SETTINGS] [DES-MOCKS] -->

- [x] Ensure provider summary, skill list, diagnostics, stderr/log affordances, and about data still render.
- [x] Add mock settings data where needed for browser dev.
- [x] Avoid introducing auth/SecretStorage UI in this sprint.

### Phase 6: Mock Scenarios and Browser-Dev Verification

> Ref: [DES-MOCKS], [DES-DEV], [FR-6], [FR-15]

#### 6.1 Extend mock transport scenarios

<!-- files: packages/transport/src/mock.ts, packages/transport/src/mock.test.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-6] [FR-15] [NFR-4] [DES-MOCKS] [DES-TEST] -->

- [x] Add or adjust only the missing scenarios for appearance preview, token preflight, work-log density, and any event shape not already covered by existing mock scenarios.
- [x] Keep mock scenario names stable and visible in DebugPanel.
- [x] Update mock transport tests for any new emitted message shapes.

#### 6.2 Add dev-only theme preview affordance

<!-- files: apps/chat/src/components/debug-panel.tsx, apps/chat/src/lib/theme-preview.ts, apps/chat/src/app.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-6] [FR-15] [NFR-4] [DES-DEV] [DES-MOCKS] -->

- [x] Add a dev-only way to switch body theme classes in browser dev.
- [x] Add the DebugPanel Appearance tab with identity, style, and host-mode switchers sourced from a single option list.
- [x] Expose all seven style treatments as selectable only after their `implemented: true` option state is valid.
- [x] Persist DebugPanel appearance state to `localStorage` under `afx-debug-appearance` and provide reset-to-default behavior.
- [x] Ensure the host-mode simulator is active only in pure-web/mock dev mode and is a no-op when `acquireVsCodeApi` is defined.
- [x] Confirm it does not alter production VS Code behavior.

#### 6.3 Check Workbench shared theme compatibility

<!-- files: apps/workbench/src/index.css, apps/workbench/src/app.tsx, apps/workbench/src/main.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-16] [NFR-1] [DES-HOST] [DES-FILES] -->

- [x] Verify Workbench consumes shared styles without fixed incompatible surfaces.
- [x] Avoid implementing full Workbench mockup views.
- [x] Fix only theme compatibility issues surfaced by shared token changes.

### Phase 7: Verification and Rollout

> Ref: [DES-TEST], [DES-ROLLOUT]

#### 7.1 Unit and component tests

<!-- files: packages/ui/src/**/*.test.tsx, apps/chat/src/**/*.test.ts, apps/chat/src/**/*.test.tsx, apps/vscode/src/panels/webview-html.test.ts, apps/vscode/src/panels/sidebar-panel.test.ts, packages/transport/src/mock.test.ts -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-5] [FR-9] [FR-10] [FR-11] [FR-15] [NFR-7] [DES-TEST] -->

- [x] Add focused tests for theme mapping, history adapter, tool descriptor classification, and mock scenarios.
- [x] Add render/static checks for required `.cn-*` hooks across all 50 hooked primitives, including variant and size suffixes.
- [x] Add webview configuration round-trip tests for `appearance/update` allowlist validation.
- [x] Add CSS/body-class integration checks proving active style classes resolve treatment variables.
- [x] Keep tests close to pure helpers when possible.
- [x] Preserve no-Pi-import and architecture-boundary tests.

#### 7.2 Browser visual checks

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/views/history.tsx, apps/chat/src/views/settings.tsx -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-6] [FR-8] [FR-9] [FR-11] [FR-13] [NFR-1] [NFR-5] [NFR-6] [DES-DEV] [DES-TEST] -->

- [x] Run `pnpm dev:chat` and inspect Chat, History, and Settings at narrow and normal widths.
- [x] Preview AFX/Meridian identity with all seven style treatments: Lyra, Luma, Maia, Nova, Vega, Mira, and Sera.
- [x] Simulate light, dark, high-contrast, and high-contrast-light host modes for each style at the T1 render smoke level.
- [x] Verify token visibility, history events, and settings sections with mock scenarios.
- [x] Capture screenshots or notes if visual issues remain.

#### 7.3 Targeted builds and final verify

<!-- files: package.json, turbo.json, apps/chat/package.json, apps/workbench/package.json, apps/vscode/package.json -->
<!-- @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [NFR-2] [NFR-3] [NFR-4] [NFR-7] [DES-DEPS] [DES-SEC] [DES-TEST] [DES-ROLLOUT] [DES-DEC] -->

- [x] Run `pnpm --filter apps/chat test`.
- [x] Run `pnpm --filter packages/ui test`.
- [x] Run `pnpm --filter packages/transport test`.
- [x] Run `pnpm --filter ./apps/vscode test`.
- [x] Run `pnpm --filter apps/chat build`.
- [x] Run `pnpm --filter apps/workbench build`.
- [x] Run `pnpm --filter ./apps/vscode build`.
- [x] Run `pnpm verify` before marking the sprint implementation complete.
- [x] If verify fails on pre-existing unrelated failures, document them separately from sprint regressions.

### Cross-Reference Index

| Task | Spec Requirement                                                    | Design Section                                                                     |
| ---- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0.1  | [FR-7], [FR-18]                                                     | [DES-OVR], [DES-ARCH], [DES-EXTRACT], [DES-MOCKUPS]                                |
| 0.2  | [FR-7], [FR-17]                                                     | [DES-EXTRACT], [DES-MOCKUPS], [DES-CHAT], [DES-HISTORY], [DES-SETTINGS], [DES-DEC] |
| 0.3  | [FR-4], [FR-5], [FR-14], [FR-18]                                    | [DES-FEAS], [DES-SHADCN], [DES-VSCODE], [DES-API]                                  |
| 1.1  | [FR-1], [FR-2], [NFR-3]                                             | [DES-TOKENS], [DES-FILES]                                                          |
| 1.2  | [FR-1], [FR-3], [NFR-1]                                             | [DES-HOST], [DES-TOKENS]                                                           |
| 1.3  | [FR-4], [NFR-3]                                                     | [DES-SHADCN], [DES-TOKENS]                                                         |
| 1.4  | [FR-1], [FR-3], [NFR-1]                                             | [DES-HOST], [DES-TOKENS]                                                           |
| 1.5  | [FR-4], [FR-17], [NFR-3]                                            | [DES-CN], [DES-SHADCN], [DES-FEAS]                                                 |
| 1.6  | [FR-4], [FR-17], [NFR-1], [NFR-3]                                   | [DES-CN], [DES-SHADCN], [DES-HOST]                                                 |
| 1.7  | [FR-4], [FR-17], [NFR-3]                                            | [DES-CN], [DES-SHADCN], [DES-FEAS]                                                 |
| 2.1  | [FR-5], [FR-14], [NFR-1]                                            | [DES-VSCODE], [DES-HOST]                                                           |
| 2.2  | [FR-5], [NFR-1]                                                     | [DES-VSCODE], [DES-TEST]                                                           |
| 3.1  | [FR-8], [FR-17], [NFR-1], [NFR-5]                                   | [DES-CHAT], [DES-HOST]                                                             |
| 3.2  | [FR-9], [NFR-5]                                                     | [DES-CHAT], [DES-DATA]                                                             |
| 3.3  | [FR-10]                                                             | [DES-CHAT], [DES-ERR], [DES-TEST]                                                  |
| 4.1  | [FR-11], [FR-12], [NFR-2]                                           | [DES-HISTORY], [DES-DATA], [DES-TEST]                                              |
| 4.2  | [FR-11], [FR-12], [FR-17], [NFR-5]                                  | [DES-HISTORY], [DES-CHAT]                                                          |
| 4.3  | [FR-12], [FR-18], [NFR-2]                                           | [DES-HISTORY], [DES-ERR]                                                           |
| 5.1  | [FR-13], [FR-17], [NFR-5], [NFR-6]                                  | [DES-SETTINGS]                                                                     |
| 5.2  | [FR-5], [FR-13], [FR-14]                                            | [DES-SETTINGS], [DES-VSCODE], [DES-API]                                            |
| 5.3  | [FR-13], [FR-15], [FR-17]                                           | [DES-SETTINGS], [DES-MOCKS]                                                        |
| 6.1  | [FR-6], [FR-15], [NFR-4]                                            | [DES-MOCKS], [DES-TEST]                                                            |
| 6.2  | [FR-6], [FR-15], [NFR-4]                                            | [DES-DEV], [DES-MOCKS]                                                             |
| 6.3  | [FR-16], [NFR-1]                                                    | [DES-HOST], [DES-FILES]                                                            |
| 7.1  | [FR-5], [FR-9], [FR-10], [FR-11], [FR-15], [NFR-7]                  | [DES-TEST]                                                                         |
| 7.2  | [FR-6], [FR-8], [FR-9], [FR-11], [FR-13], [NFR-1], [NFR-5], [NFR-6] | [DES-DEV], [DES-TEST]                                                              |
| 7.3  | [NFR-2], [NFR-3], [NFR-4], [NFR-7]                                  | [DES-DEPS], [DES-SEC], [DES-TEST], [DES-ROLLOUT], [DES-DEC]                        |

<!-- SPRINT-SECTION-END: TASKS -->

---

<!-- SPRINT-SECTION-START: SESSIONS (appended to tasks.md on graduation — tasks-template.md requires Work Sessions as the last section) -->

## 4. Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in chat-ui-theme-foundation.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-sprint code, /afx-task pick, /afx-task code, /afx-task complete -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action (Picked/Coded/Completed/Verified/Reviewed) | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |

| 2026-04-28 | 0.1 | Completed | docs/design-system/docs/split-map.md | [x] | [] |
| 2026-04-28 | 0.2 | Completed | docs/design-system/docs/split-map.md | [x] | [] |
| 2026-04-28 | 0.3 | Completed | docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md | [x] | [] |
| 2026-04-28 | 1.1 | Completed | packages/ui/src/tokens/meridian.css; apps/workbench/src/main.tsx | [x] | [] |
| 2026-04-28 | 1.2 | Completed | packages/ui/src/styles/theme-meridian.css; packages/ui/src/styles/theme-lyra.css; packages/ui/src/styles/globals.css | [x] | [] |
| 2026-04-28 | 1.3 | Completed | packages/ui/src/styles/style-*.css | [x] | [] |
| 2026-04-28 | 1.4 | Completed | packages/ui/src/styles/globals.css; packages/ui/src/styles/meridian.tokens.css | [x] | [] |
| 2026-04-28 | 1.5 | Completed | packages/ui/src/components/*.tsx | [x] | [] |
| 2026-04-28 | 1.6 | Completed | packages/ui/src/styles/style-*.css; packages/ui/src/styles/globals.css | [x] | [] |
| 2026-04-28 | 1.7 | Completed | packages/ui/src/components/*.tsx; packages/ui/src/lib/cn-hooks.test.ts | [x] | [] |
| 2026-04-28 | 2.1 | Completed | apps/vscode/package.json; apps/vscode/src/panels/webview-html.ts | [x] | [] |
| 2026-04-28 | 2.2 | Completed | apps/vscode/src/panels/webview-html.test.ts | [x] | [] |
| 2026-04-28 | 3.1 | Completed | apps/chat/src/views/chat.tsx; apps/chat/src/components/debug-panel.tsx | [x] | [] |
| 2026-04-28 | 3.2 | Completed | apps/chat/src/views/chat.tsx; packages/shared/src/messages.ts | [x] | [] |
| 2026-04-28 | 3.3 | Completed | apps/chat/src/lib/tool-descriptor.ts; apps/chat/src/lib/tool-descriptor.test.ts | [x] | [] |
| 2026-04-28 | 4.1 | Completed | apps/chat/src/lib/history-events.ts; apps/chat/src/lib/history-events.test.ts | [x] | [] |
| 2026-04-28 | 4.2 | Completed | apps/chat/src/views/history.tsx | [x] | [] |
| 2026-04-28 | 4.3 | Completed | apps/chat/src/views/history.tsx | [x] | [] |
| 2026-04-28 | 5.1 | Completed | apps/chat/src/views/settings.tsx | [x] | [] |
| 2026-04-28 | 5.2 | Completed | apps/chat/src/views/settings.tsx; apps/vscode/src/panels/sidebar-panel.ts; packages/shared/src/messages.ts | [x] | [] |
| 2026-04-28 | 5.3 | Completed | apps/chat/src/views/settings.tsx; packages/transport/src/mock.ts | [x] | [] |
| 2026-04-28 | 6.1 | Completed | packages/transport/src/mock.ts; packages/transport/src/mock.test.ts | [x] | [] |
| 2026-04-28 | 6.2 | Completed | apps/chat/src/components/debug-panel.tsx; apps/chat/src/lib/theme-preview.ts | [x] | [] |
| 2026-04-28 | 6.3 | Completed | apps/workbench/src/main.tsx | [x] | [] |
| 2026-04-28 | 7.1 | Completed | packages/ui/src/lib/cn-hooks.test.ts; apps/chat/src/**/*.test.*; apps/vscode/src/panels/*.test.ts; packages/transport/src/mock.test.ts | [x] | [] |
| 2026-04-28 | 7.2 | Completed | apps/chat/e2e/chat.spec.ts; Playwright browser smoke | [x] | [] |
| 2026-04-28 | 7.3 | Completed | package.json; turbo.json; targeted builds; pnpm verify | [x] | [] |
| 2026-04-28 | 7.2 | Reviewed | apps/chat/src/index.css; apps/chat/src/views/chat.tsx; apps/chat/src/views/history.tsx; apps/chat/src/views/settings.tsx | [x] | [] |
| 2026-04-28 | 7.3 | Verified | apps/chat/src/index.css; apps/chat/src/views/chat.tsx; apps/chat/src/views/history.tsx; apps/chat/src/views/settings.tsx | [x] | [] |

<!-- SPRINT-SECTION-END: SESSIONS -->
