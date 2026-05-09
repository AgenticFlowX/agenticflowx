---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags:
  [
    "overview",
    "afx",
    "spec-driven",
    "architecture",
    "routing",
    "taxonomy",
    "traceability",
    "code-spec-alignment",
    "impact-lens",
  ]
---

# AgenticFlowX — Project Overview

## References

- **ADR**: [ADR-0001 Pi Engine Integration](../../adr/ADR-0001-pi-engine-integration.md)
- **Research**: [Pi Integration Strategy](../../research/pi/res-pi-integration-strategy.md)

---

## Problem Statement

AgenticFlowX is a spec-driven VSCode coding agent. This overview spec defines the governing conventions — spec naming, traceability rules, routing rules, and the change gate — so all contributors and AI agents operate from the same shared model.

The spec tree must be useful as a living entry map, not just an archive. When a future agent needs to change a small surface such as the chat composer footer, editor gutter, right-click menu, or `@see` navigation, the correct spec should identify the owned files, messages, settings, tests, and neighboring dependencies before the agent reads implementation code.

The spec tree must stay aligned with the implementation. When code already exists or has moved ahead, contributors update `spec.md` and `design.md` so the living docs remain a 1:1 map of current behavior, including stable section IDs, locator maps, owned-file rows, and explicit ignore policy before future Impact Lens indexing relies on those documents.

---

## User Stories

### Primary Users

Developers and AI coding agents working in the AFX repo.

### Stories

**As a** developer
**I want** to understand the spec-naming convention at a glance
**So that** I can create new specs without renumbering existing ones

**As an** AI agent
**I want** clear traceability rules
**So that** I can find the spec for any source file by following `@see` annotations

**As an** AI agent
**I want** each active surface to expose an Agent Entry Map
**So that** I can start surgical work from the right living document instead of grepping the whole repo

**As a** maintainer
**I want** broad app/package specs to split into child zone specs when surfaces become dense
**So that** small feature requests can be routed without reading unrelated code

**As a** contributor
**I want** a documented change gate
**So that** architectural decisions are never made implicitly in code

**As a** maintainer preparing Impact Lens
**I want** specs and designs to expose stable traceability nodes
**So that** source files, tests, UI map regions, and runtime flows can be traced back to living requirements without using transient task history

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                         | Priority  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1  | All feature work starts with a spec in `docs/specs/` before code is written                                                                                                         | Must Have |
| FR-2  | Spec folders use 3-digit ranged numbering by category, with child ranges reserved for app/package/infra sub-surfaces                                                                | Must Have |
| FR-3  | Numbers within each range are spaced to allow insertion without renumbering                                                                                                         | Must Have |
| FR-4  | Every AFX-owned `.ts` and `.tsx` source file carries a top-level JSDoc `@see` linking to its governing spec and design                                                              | Must Have |
| FR-5  | Cross-cutting architectural decisions use ADRs in `docs/adr/`; cross-cutting living behavior uses numbered `900–999` cross specs                                                    | Must Have |
| FR-6  | `tasks.md` Work Sessions table is always the last section and is append-only                                                                                                        | Must Have |
| FR-7  | A spec may be split into child zone specs when a small feature request would otherwise require reading unrelated source surfaces                                                    | Must Have |
| FR-8  | Each active zone spec must include an Agent Entry Map covering owned surface, owned files, bridge messages, settings keys, commands, tests, dependencies, out-of-scope, and prompts | Must Have |
| FR-9  | Broad parent specs remain as package/app summaries and route maps; child specs own surgical implementation detail                                                                   | Must Have |
| FR-10 | When updating existing behavior, contributors first read the governing living spec, set it to `Draft` if requirements/design change, then plan and implement from that route        | Must Have |
| FR-11 | Temporary migration documents may propose moves, but accepted taxonomy and routing rules live in `001-overview`                                                                     | Must Have |
| FR-12 | Dense or mixed-surface files must add local `@see` annotations on exported APIs, UI subcomponents, command/provider registries, bridge handlers, and major helper blocks            | Must Have |
| FR-13 | Specs must reflect the as-built code surface deeply enough that traceability works top-down from spec to code and bottom-up from code to governing spec                             | Must Have |
| FR-14 | UI-owning design docs must include ASCII Surface Maps with stable map IDs that locate visible regions, states, and control groups                                                   | Must Have |
| FR-15 | Bridge/runtime-owning design docs must include ASCII Flow Maps with stable map IDs that locate message, provider, manager, adapter, and subprocess boundaries                       | Must Have |
| FR-16 | Code locator notation must connect each map ID to owned files, local anchors, bridge messages, commands/settings, and tests                                                         | Must Have |
| FR-17 | Code/spec alignment passes must update living `spec.md` and `design.md` from the as-built code surface before relying on future surgical work or Impact Lens indexing               | Must Have |
| FR-18 | Stable traceability nodes must live in `spec.md` and `design.md`; `tasks.md` may be linked as optional history but must not be the required source of current behavior              | Must Have |
| FR-19 | Orphan candidates must be classified before adding annotations, with managed update surfaces explicitly ignored instead of edited                                                   | Must Have |
| FR-20 | Shadcn UI primitives and Pi SDK/bootstrap internals are managed update surfaces and must remain untouched unless AFX takes ownership of wrapper behavior                            | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                                                         | Target                         |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------ |
| NFR-1 | Spec documents are parseable by `@afx/parsers`                                      | Required for workbench         |
| NFR-2 | `/afx-check trace` reports zero unclassified orphaned source files                  | Enforced in CI                 |
| NFR-3 | Agent Entry Maps are concise enough to be scanned before source reading             | Required for agent DX          |
| NFR-4 | Local traceability remains high-signal and avoids comment noise                     | Required for code DX           |
| NFR-5 | ASCII maps stay implementation-accurate without requiring pixel-perfect UI diagrams | Required for planning          |
| NFR-6 | Traceability node IDs are stable across small refactors                             | Required for Impact Lens       |
| NFR-7 | Managed upstream code remains update-safe                                           | No direct doc-annotation churn |

---

## Acceptance Criteria

### Spec Naming

- [ ] New insertion between 100 and 110 uses 105, never renumbers existing specs
- [ ] Category prefix is encoded in the number (100s = packages, 200s = apps, etc.)
- [ ] `001-overview` is a singleton outside all ranges
- [ ] `900–999` is reserved for living cross-cutting behavior specs, not ADRs or sprint plans

### Traceability

- [ ] Every AFX-owned `.ts` and `.tsx` file in `packages/` and `apps/` has dual `@see` links
- [ ] Scripts (`.mjs`) carry inline `// @see` comments
- [ ] Workflow YAML files carry inline `# @see` comments at the top
- [ ] Source annotations point at numbered living specs, not sprint plans, missing folders, or retired unnumbered docs
- [ ] Source annotations resolve to existing document paths and existing node IDs
- [ ] Exported components/functions and command/provider/bridge registries in dense files carry local `@see` links to the owning zone spec
- [ ] Mixed-surface files use local `@see` links so each function/block points at the correct child zone
- [ ] UI and architecture map IDs in design docs are referenced by local source comments where they identify dense code seams
- [ ] Orphan candidates are classified before annotation; shadcn UI primitives and Pi SDK/bootstrap internals stay unedited
- [ ] Required source anchors point at living `spec.md` and `design.md`; `tasks.md` remains optional historical context only

### Agent Routing

- [ ] Zone specs include an Agent Entry Map before code owners rely on them for surgical work
- [ ] Parent specs route readers to child zones rather than duplicating all child requirements
- [ ] Composer footer, editor menu/action, gutter/code action, notes, design-system/Storybook, runtime manager, and Pi work each have a clear starting spec
- [ ] UI-owning zones include ASCII Surface Maps and Code Locator Maps before major UI work starts
- [ ] Bridge/runtime zones include ASCII Flow Maps and Code Locator Maps before major protocol or orchestration work starts
- [ ] Code/spec alignment passes add or update design subsections when code already points at a missing but valid `DES-*` anchor
- [ ] Impact Lens can use the living docs as the starting index without first inferring ownership from raw source

### Change Gate

- [ ] No new package, app, or architecture pattern ships without a spec or ADR in this repo
- [ ] Approved specs are set back to `Draft` and version-bumped when requirements or design scope changes

---

## Non-Goals

- Feature-specific requirements (each feature has its own spec folder)
- Build or CI configuration (see `310-infra-build`, `400-dx-conventions`)
- Historical migration logs or abandoned options in living `spec.md`/`design.md` documents
- Manual annotation churn inside managed upstream code such as shadcn primitives or Pi SDK/bootstrap internals

---

## Open Questions

| #   | Question                                                             | Status | Resolution |
| --- | -------------------------------------------------------------------- | ------ | ---------- |
| 1   | Which broad specs should graduate next after the highest-pain zones? | Open   | -          |

---

## Dependencies

- `/afx-check trace` for source-to-spec verification
- `@afx/parsers` for spec/front matter parsing in the workbench

---

## Appendix

### Spec Numbering Ranges

```text
001        — overview singleton and canonical routing rules
100–199    — packages
  100–139  — shared package contracts, parsers, transport, UI
  140–199  — reserved package child zones
200–299    — apps
  200–209  — VSCode extension host zones
  210–219  — chat webview zones
  220–229  — workbench webview zones
  230–299  — reserved app child zones
300–399    — infra and runtime
  300–349  — build/scripts/platform infrastructure
  350–369  — agent manager and runtime adapters
  370–399  — reserved infra child zones
400–499    — dx
500–599    — ci and release
900–999    — cross-cutting living behavior specs
```

### Surface + Capability Split Rule

Create or promote a child zone spec when at least one of these is true:

- A small feature request would require reading unrelated implementation surfaces.
- The surface owns distinct files, commands, bridge messages, settings, or tests.
- Multiple parent specs currently claim the same behavior.
- Existing source `@see` links point at sprint plans, unnumbered specs, or missing paths.

Do not create a child spec only because a folder exists. The split must improve routing for future surgical work.

### Initial Child Zone Examples

| Parent spec         | Child route examples                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `130-package-ui`    | `131-package-ui-design-system` for tokens, themes, component contracts, Storybook                                                                                                                                                         |
| `200-app-vscode`    | `202-app-vscode-editor-actions`, `203-app-vscode-see-navigation`                                                                                                                                                                          |
| `210-app-chat`      | `211-app-chat-composer`, `212-app-chat-messages`, `213-app-chat-history`                                                                                                                                                                  |
| `220-app-workbench` | `221-app-workbench-board`, `222-app-workbench-documents`, `223-app-workbench-journal`, `224-app-workbench-notes`, `225-app-workbench-pipeline`, `226-app-workbench-analytics`, `227-app-workbench-shell`, `228-app-workbench-impact-lens` |
| `300-infra-pi`      | `350-agent-manager`, `351-agent-pi` after migration                                                                                                                                                                                       |

### Agent Entry Map Contract

Every active zone spec must include an Agent Entry Map in the appendix with these fields:

| Field           | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| Owned surface   | The product or runtime surface this spec owns             |
| Owned files     | Source files an agent should read first                   |
| Local anchors   | Functions/components/registries that require local `@see` |
| Bridge messages | Webview/host/shared message types in scope                |
| Settings keys   | VSCode or app settings in scope                           |
| Commands        | VSCode commands or UI actions in scope                    |
| Tests           | Unit/e2e/trace tests that should move with the surface    |
| Dependencies    | Neighboring specs to read only when needed                |
| Out of scope    | Nearby behavior owned elsewhere                           |
| Example prompts | Natural-language requests this spec should route          |

### ASCII Surface And Flow Map Contract

Design docs use plain ASCII maps when the feature owns visible UI or runtime/bridge flow. These maps are working locator diagrams, not pixel-perfect mockups.

| Map Type      | Required When                                             | Purpose                                                      |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Surface Map   | The spec owns user-visible UI regions or controls         | Shows visible regions, stable map IDs, and stateful controls |
| Flow Map      | The spec owns bridge, host, manager, adapter, or RPC flow | Shows boundaries, message direction, and runtime ownership   |
| Locator Table | A Surface Map or Flow Map is present                      | Connects map IDs to files, code anchors, commands, and tests |

Map IDs use bracketed dotted names:

```text
[Surface.Region]
[Flow.Boundary]
```

Examples:

```text
[Composer.Footer]
[ChatSettings.Providers.Api]
[Bridge.ChatToAgent]
[AgentPi.RpcJsonl]
```

### Code Locator Notation

Use local code comments when a dense file implements multiple map regions. The comments should be high-signal and sparse.

```typescript
// Surface: [Composer.Footer]
// Flow: [Bridge.ChatToAgent]
```

If the anchor is an exported API or registry, prefer a JSDoc block with the same map ID plus `@see` links:

```typescript
/**
 * Flow: [AgentManager.Multiplexer]
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-ARCH]
 */
export class MultiplexedAgentManager {}
```

Do not annotate every private helper. Annotate the code node an agent should jump to when a map ID is named in a prompt.

### Glossary

| Term            | Definition                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| Spec            | A `docs/specs/XXX-name/` folder with spec.md, design.md, tasks.md            |
| Zone spec       | A child spec that owns a specific surface plus capability                    |
| Agent Entry Map | Appendix section that routes future agents to files, messages, and tests     |
| ADR             | Architecture Decision Record in `docs/adr/`                                  |
| Change Gate     | Rule: spec or ADR precedes code                                              |
| Living document | `spec.md` or `design.md`, representing current system truth rather than logs |
| `@see`          | JSDoc annotation linking source file to its governing spec                   |
| Local `@see`    | Function, component, type, or block-level annotation used inside dense files |
| Surface Map     | ASCII UI locator diagram with stable region IDs                              |
| Flow Map        | ASCII architecture/runtime diagram with stable boundary IDs                  |
| Map ID          | Bracketed dotted locator such as `[Composer.Footer]`                         |
