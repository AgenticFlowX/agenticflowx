---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-03T02:14:15.000Z"
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
spec: spec.md
---

# AgenticFlowX — Technical Design

---

## [DES-OVR] Overview

AgenticFlowX is organized as a pnpm + Turbo monorepo with shared packages, VSCode/webview apps, and agent runtime packages. All substantive work is governed by living spec documents in `docs/specs/` and linked to source code via `@see` annotations.

The overview design owns the routing system: broad parent specs describe app/package boundaries, while child zone specs own surgical surfaces such as chat composer controls, VSCode editor actions, UI design-system/Storybook work, agent manager behavior, Pi adapter behavior, and cross-cutting telemetry.

---

## [DES-ARCH] Architecture

### System Context

```text
docs/specs/XXX-name/
├── spec.md       ← requirements
├── design.md     ← technical decisions
└── tasks.md      ← implementation log

Source files
└── @see docs/specs/XXX-name/spec.md [FR-X]
    @see docs/specs/XXX-name/design.md [DES-SECTION]
```

### Living-Document Workflow

```text
New or changed behavior request
        │
        ▼
Route to parent or child zone spec
        │
        ▼
Read spec.md + design.md as current truth
        │
        ▼
If behavior/design changes, set status: Draft and bump version
        │
        ▼
Plan in tasks.md, then implement and retarget @see links
```

`spec.md` and `design.md` are state documents. They should describe the current accepted or proposed shape of the system, not the chronology of how the repo got there. Migration history belongs in temporary migration docs, `tasks.md`, or session capture.

### Code/Spec Alignment Workflow

Code/spec alignment work starts from code that already exists and updates the living docs so future work can start from docs again.

```text
As-built source surface
        │
        ▼
Read top-level @see, local @see, Surface:, Flow:, commands, messages, tests
        │
        ▼
Classify owned behavior vs managed update surfaces
        │
        ├─ AFX-owned behavior
        │     ▼
        │   Backfill spec.md/design.md requirements, DES sections, maps, locators
        │
        └─ Managed update surface
              ▼
            Document ignore/wrapper policy; do not annotate internals
```

Code/spec alignment edits belong in `spec.md` or `design.md`. `tasks.md` remains historical and may record when the pass happened, but current behavior must not require reading `tasks.md`.

### Spec Numbering Convention

| Range   | Category             | Child Routing                                      | Example                                                  |
| ------- | -------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| 001     | Overview (singleton) | Canonical taxonomy and routing rules               | `001-overview`                                           |
| 100–199 | Packages             | Shared contracts, package surfaces, design system  | `100-package-shared`, `131-package-ui-design-system`     |
| 200–299 | Apps                 | App parent specs plus app surface child zones      | `202-app-vscode-editor-actions`, `211-app-chat-composer` |
| 300–399 | Infra/runtime        | Platform infra, build scripts, agent runtime zones | `310-infra-build`, `350-agent-manager`, `351-agent-pi`   |
| 400–499 | DX                   | Developer conventions, quality gates, enforcement  | `400-dx-conventions`, `430-dx-enforcement`               |
| 500–599 | CI                   | CI, release, publish                               | `500-ci-code-qa`, `520-ci-publish`                       |
| 900–999 | Cross-cutting        | Living behavior that truly spans multiple surfaces | `901-cross-telemetry`                                    |

Parent specs use step-10 numbering where possible. Child zone specs may use adjacent numbers inside the parent range when that makes routing clearer, such as `211` under `210-app-chat` or `131` under `130-package-ui`.

### Child Range Map

| Parent Surface       | Child Range | Routing Rule                                                                         |
| -------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `100-package-shared` | `101–109`   | Shared protocols, logger, agent contracts split by contract owner                    |
| `130-package-ui`     | `131–139`   | Design-system, token, theme, component contract, and Storybook surfaces              |
| `200-app-vscode`     | `201–209`   | VSCode host panels, editor actions, `@see` services, and spec services               |
| `210-app-chat`       | `211–219`   | Composer, message timeline, history, settings, and notes affordances                 |
| `220-app-workbench`  | `221–229`   | Board, documents, journal, notes, pipeline, analytics, shell/layout, and Impact Lens |
| `300-infra-pi`       | `350–369`   | Agent manager and runtime adapters after Pi migration                                |
| Cross-cutting        | `900–999`   | Telemetry and future behavior that cannot belong to exactly one parent zone          |

### Surface + Capability Rule

Child zones are created for navigability, not for folder mirroring. A child zone is warranted when a small request would otherwise require reading unrelated code, when the behavior owns distinct commands/messages/settings/tests, or when existing `@see` links point at retired docs.

Examples:

- “Change the chat box footer hint” routes to `211-app-chat-composer`, not all of `210-app-chat`.
- “Add a right-click editor action” routes to `202-app-vscode-editor-actions`, not all of `200-app-vscode`.
- “Add Storybook coverage for a shared component” routes to `131-package-ui-design-system`, with `310-infra-build` only if Vite/Turbo/toolchain config changes.
- “Change Pi SDK bootstrap behavior” routes to `351-agent-pi`; runtime selection and status routing routes to `350-agent-manager`.

### ASCII Surface And Flow Maps

Zone design docs use ASCII maps to make the living document navigable before source reading. The goal is about 95% implementation accuracy: enough to route work to the right visible region or runtime boundary, without pretending to be a pixel-perfect screenshot.

Use these standard custom `##` sections when a zone owns maps:

- `## [DES-MOCKUP] ASCII UI Mockups` for screen-like UI wireframes and states
- `## [DES-COMP] ASCII Component Representation` for component overlays and ownership trees
- `## [DES-SURFACE] ASCII Surface Map` for React/webview UI surfaces
- `## [DES-FLOW] ASCII Flow Map` for bridge/runtime/agent flows
- `## [DES-LOC] Code Locator Map` for the table connecting map IDs to code
- `## [DES-TRACE] 1:1 Code/Spec Matrix` for behavior-to-source/test coverage

Source refs can target those sections directly:

```typescript
/**
 * @see docs/specs/213-app-chat-history/design.md [DES-MOCKUP]
 */
```

UI-owning specs include ASCII UI Mockups for visible states:

```text
[Composer.Mockup.Ready]
+------------------------------------------------+
| Thinking: auto      Model: Pi Local             |
+------------------------------------------------+
| Ask AFX anything...                             |
|                                                |
| [Attach] [Mention] [Slash]       [Send]        |
+------------------------------------------------+
| Pi ready  |  Cmd+Shift+Enter note  | Enter send |
+------------------------------------------------+
```

UI-owning specs also include a Surface Map for stable region IDs:

```text
[Composer.Root]
+------------------------------------------------+
| [Composer.Activity] runtime/thinking strip     |
+------------------------------------------------+
| [Composer.Queue] queued steer/follow-up items  |
+------------------------------------------------+
| [Composer.Input] textarea + helper popups      |
| [Composer.Toolbar] model/thinking controls     |
| [Composer.Actions] send/queue/steer/stop       |
+------------------------------------------------+
| [Composer.Footer] Pi pill + usage + hint copy  |
+------------------------------------------------+
```

UI-owning specs may include a Component Representation when a visible surface is
implemented by several React components or inline JSX regions:

```text
[Composer.ComponentOverlay]
+------------------------------------------------+
| Chat composer inline root                       |
+------------------------------------------------+
| ComposerStrip                                  |
|   +-- ActivityBar                              |
|   +-- textarea + MentionPopup + SlashPopup     |
|   +-- FooterStrip                              |
+------------------------------------------------+
```

Bridge/runtime specs include a Flow Map:

```text
[Bridge.ChatToAgent]
chat webview
  -> postMessage / @afx/transport
  -> VSCode SidebarPanel.dispatchInbound
  -> AgentRuntimeMonitor + AgentManager
  -> active runtime adapter
  -> Pi RPC client or SDK runtime
```

Each map ID must be listed in a Code Locator Map that names the owned files, local code anchors, messages/settings/commands, and tests. Source files should add sparse local comments for dense map seams:

```typescript
// Surface: [Composer.Footer]
// Flow: [Bridge.ChatToAgent]
```

---

## [DES-ROUTING-DECISION-TREE] Agent Routing Decision Tree

The literal Impact Lens UX expressed as a routing tree. Given a developer prompt, this answers
"which spec opens first?". Used by AFX agents and humans before reading source.

```text
Developer says X
  |
  +-- "footer", "composer", "queue", "slash", "@-mention", "send/abort/steer"   -> 211-app-chat-composer
  +-- "message stream", "tool call", "thinking block", "markdown render"         -> 212-app-chat-messages
  +-- "history", "conversation list", "timeline"                                 -> 213-app-chat-history
  +-- "settings", "provider", "API key", "model picker"                          -> 214-app-chat-settings
  +-- "save to notes", "composer note strip"                                     -> 215-app-chat-notes
  +-- "editor right-click", "code action", "selection action"                    -> 202-app-vscode-editor-actions
  +-- "@see", "CodeLens", "hover", "completion", "go-to-def"                     -> 203-app-vscode-see-navigation
  +-- "panel", "webview shell", "sidebar/workbench registration"                 -> 201-app-vscode-panels
  +-- "spec data", "sprint context", "specs cache"                               -> 204-app-vscode-spec-services
  +-- "AgentManager", "multiplex", "agent restart", "runtime phase"              -> 350-agent-manager
  +-- "Pi binary", "Pi SDK", "RPC", "JSONL", "subprocess"                        -> 351-agent-pi
  +-- "board", "kanban", "task card"                                             -> 221-app-workbench-board
  +-- "documents explorer", "spec viewer"                                        -> 222-app-workbench-documents
  +-- "journal entries", "session log render"                                    -> 223-app-workbench-journal
  +-- "notes view", "workbench notes"                                            -> 224-app-workbench-notes
  +-- "pipeline", "phase", "progress"                                            -> 225-app-workbench-pipeline
  +-- "analytics widget", "ghost task count"                                     -> 226-app-workbench-analytics
  +-- "tabs", "shell", "panel layout"                                            -> 227-app-workbench-shell
  +-- "Impact Lens", "reverse trace", "ghost-node", "orphan", "verification"     -> 228-app-workbench-impact-lens
  +-- "tokens", "theme", "appearance", "style switch"                            -> 131-package-ui-design-system
  +-- "message protocol", "shared type", "AgentManager interface"                -> 100-package-shared
  +-- "transport", "webview bridge", "mock scenario"                             -> 110-package-transport
  +-- "spec parser", "task parser", "front matter parser"                        -> 120-package-parsers
  +-- "telemetry", "Clarity event"                                               -> 901-cross-telemetry
  +-- "build pipeline", "esbuild", "Vite", "size-limit"                          -> 310-infra-build
  +-- "lint", "ESLint", "Prettier", "knip"                                       -> 410-dx-quality
  +-- "vitest", "Playwright", "vscode-test-electron"                             -> 420-dx-testing
  +-- "release-please", "VSIX", "GitHub Release"                                 -> 510-ci-release / 520-ci-publish
```

When two zones could fit, prefer the surface closest to where the user interacts. Cross-cutting
concerns (telemetry, notes, future fleet) live in `9XX` and depend on the zones they touch.

---

## [DES-SYSTEM-SURFACE-MAP] System Surface Map

ASCII rendering of the entire VSCode window with zone numbers labeled where they physically appear.

```text
+--------------------------------------------------------------------+
| VS Code Title Bar                                                  |
+----------+---------------------------------+----------+------------+
|          |                                 |          |            |
|          |                                 |          | [201]      |
| Activity |  Editor                         | Editor   | Sidebar    |
| Bar      |  -------                        | Tab      | Webview    |
|          |  [202] right-click context      | Bar      | hosts      |
| [201]    |  [203] CodeLens above @see      |          | [210-215]  |
| afx icon |  [203] hover on @see            |          | chat zones |
|          |  [202] gutter actions           |          |            |
|          |                                 |          |            |
|          |                                 |          |            |
+----------+---------------------------------+----------+------------+
| [201] Workbench bottom panel hosts [220-228] workbench tabs        |
| Workbench | Pipeline | Documents | Analytics | Journal | Board |...|
+--------------------------------------------------------------------+
| Status bar [200] AFX runtime indicator                             |
+--------------------------------------------------------------------+

Behind the scenes:
  [110] transport bridges [200] host <-> [201] webviews
  [100] shared types travel both ways
  [350] AgentManager + [351] agent-pi handle agent lifecycle
  [120] parsers feed [204] specs cache
  [131] design tokens reach all webviews via [DES-APPEARANCE-BRIDGE]
```

---

## [DES-DEPENDENCY-GRAPH] Dependency Graph

Visualization of `depends_on` edges declared in front matter. Edges go from the dependency
target to the dependent (what depends on what).

```text
                     +------------------+
                     | 001-overview     |
                     +------------------+

  Packages (foundation)
  +------------------+    +-------------------+    +------------------+
  | 100-shared       |    | 110-transport     |    | 120-parsers      |
  +--------+---------+    +---------+---------+    +---------+--------+
           |                        |                        |
           +----+   +---------------+    +-------------------+
                |   |                                        |
                v   v                                        v
  +-----------------------+                      +---------------------+
  | 130-ui                |                      | 131-design-system   |
  +-----------+-----------+                      +----------+----------+
              |                                             |
              +---------------+-----------------------------+
                              |
  Apps                        v
  +-------------+    +-------------+    +-----------------+
  | 200-vscode  |<-->| 210-chat    |    | 220-workbench   |
  +------+------+    +------+------+    +--------+--------+
         |                  |                    |
   201,202,203,204    211,212,213,214,215   221,222,223,224,225,226,227,228

  Agent Layer
  +--------------------+      +-------------------+
  | 350-agent-manager  |<---->| 351-agent-pi      |
  +---------+----------+      +---------+---------+
            |                           |
            v                           v
                            (300-infra-pi: transport only, retiring)

  Cross-cutting
  +----------------------+
  | 901-cross-telemetry  |  (depends_on 200, 210, 220)
  +----------------------+

  Infra / DX / CI
  310-infra-build  ──►  410-dx-quality  ──┐
                        420-dx-testing ──┼─►  500-ci-code-qa  ──►  510-ci-release  ──►  520-ci-publish
                        310-infra-build ─┘
```

---

## [DES-SPRINT-LIFECYCLE] Sprint Lifecycle

How AFX docs flow in this repo. RES and ADR feed SPRINT or SPEC; sprints graduate; journals run
alongside; code carries `@see` back to spec/design and is read by Impact Lens.

```text
RES (research)         ADR (architecture decision)
  |                       |
  v                       v
SPRINT (single-doc)  --graduates-->  SPEC + DESIGN + TASKS (4-doc)
  |                                       |
  v                                       v
JOURNAL (append-only session log)         JOURNAL
                                              |
                                              v
                              [code with top-of-file + local @see]
                                              |
                                              v
                              Impact Lens reverse index reads this
```

Status semantics on each artifact:

- `Draft`: in flight; either authoring or actively diverging from accepted state.
- `Approved`: accepted shape; new code should match.
- `Living`: a doc that updates continuously (TASKS, JOURNAL, this file's CATALOG sections).

When `spec.md` or `design.md` changes substantively, status drops to `Draft` and version bumps;
once review accepts, status returns to `Approved`. The transition is the spec-driven "gate" that
keeps code from drifting silently.

---

## [DES-EMPTY-STATE-CONTRACT] Empty / Loading State Contract

Every "no data" surface across the app must follow these rules. Today each zone implements its
own empty state ad hoc; this contract prevents drift across the eight workbench tabs and five chat
zones.

Contract:

- Use `@afx/ui` `Empty` primitive (icon + title + description + optional action).
- Title is task-shaped ("No notes yet"), not status-shaped ("Empty").
- Description tells the user what to do, not what is missing.
- Action button is the most useful next step, not "Reload".

Catalog of empty-state DES nodes per zone:

| Zone                            | Empty-state DES node                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `211-app-chat-composer`         | `[DES-COMPOSER-MOCKUP-UNAVAILABLE]`                             |
| `212-app-chat-messages`         | `[DES-MESSAGES-EMPTY-STATE]` (to be added)                      |
| `213-app-chat-history`          | `[DES-HISTORY-MOCKUP-EMPTY]`                                    |
| `214-app-chat-settings`         | `[DES-SETTINGS-MOCKUP-RECOVERY]` (also covers readiness)        |
| `215-app-chat-notes`            | `[DES-NOTES-EMPTY-STATE]` (to be added)                         |
| `221-app-workbench-board`       | `[DES-BOARD-EMPTY-STATE]` (to be added)                         |
| `222-app-workbench-documents`   | `[DES-DOCS-EMPTY-STATE]` (to be added)                          |
| `223-app-workbench-journal`     | `[DES-JOURNAL-EMPTY-STATE]` (to be added)                       |
| `224-app-workbench-notes`       | `[DES-NOTES-VIEW-EMPTY-STATE]` (to be added)                    |
| `225-app-workbench-pipeline`    | `[DES-PIPELINE-EMPTY-STATE]` (to be added)                      |
| `228-app-workbench-impact-lens` | `[DES-IMPACT-EMPTY-STATE]` (to be added once Impact Lens ships) |

Newly-added zones must register their empty-state DES here on creation.

---

## [DES-ERROR-STATE-CONTRACT] Error State Contract

Same shape as empty states but for failures: agent crash, RPC timeout, invalid API key, file not
found, network error, parser failure.

Contract:

- Failures stay non-blocking; the surface keeps last-good content where possible.
- Prefer inline `Alert` with retry + copy-error-details actions over modal blocking.
- Toasts are for non-fatal feedback; fatal errors render in-place.

Catalog of error-state DES nodes per zone:

| Zone                            | Error-state DES node                                                |
| ------------------------------- | ------------------------------------------------------------------- |
| `211-app-chat-composer`         | placeholder copy when runtime unavailable; toasts for send failure  |
| `212-app-chat-messages`         | `[DES-MESSAGES-MOCKUP-SYSTEM]` (error / info / compaction rows)     |
| `214-app-chat-settings`         | `[DES-SETTINGS-MOCKUP-RECOVERY]` (recovery + diagnostics buttons)   |
| `350-agent-manager`             | runtime status -> unhealthy/unsupported drives recovery affordances |
| `228-app-workbench-impact-lens` | `[DES-IMPACT-STATES]` covers fatal-error + partial states           |
| `901-cross-telemetry`           | telemetry never blocks; failures log only                           |

Each zone whose surface owns a non-trivial error state must register the DES node here.

---

## [DES-UI] Documentation UI And Locator Experience

The documentation UI is the rendered markdown surface used by humans, agents, the Workbench spec reader, and future Impact Lens views. Specs and designs should be readable without source context first, then precise enough to jump into source.

### Reading Order

```text
spec.md
  -> Problem / FR / NFR / Acceptance
  -> Agent Entry Map
design.md
  -> ASCII Surface or Flow Map
  -> Code Locator Map
  -> File Reference Map
source
  -> top-level @see
  -> local @see or sparse Surface:/Flow: comments
```

### Visual Locator Rules

- Use ASCII maps for routeable UI or runtime seams.
- Use stable bracketed IDs such as `[Composer.Footer]`, `[AgentManager.Multiplexer]`, or `[Bridge.ChatToAgent]`.
- Add custom `## [DES-*]` sections when the code surface has a stable concept that does not fit a generic design template section.
- Keep maps approximately implementation-accurate; they are planning and navigation aids, not screenshots.
- Avoid pointing required implementation truth at `tasks.md`; task links are optional historical breadcrumbs.

### `depends_on` Field

When a spec depends on another spec's decisions, `depends_on: [spec-folder-name]` is added to frontmatter after `tags`. Validated by `/afx-check deps`.

---

## [DES-DEC] Key Decisions

| Decision                    | Options Considered                                | Choice                                 | Rationale                                                                                |
| --------------------------- | ------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Spec ID encoding            | Sequential, ranged, folder-only names             | Ranged 3-digit                         | Allows insertion without renumbering; category encoded in prefix                         |
| Child zone granularity      | Mirror folders, one app spec, surface+capability  | Surface+capability                     | Routes small work to the correct living doc without unrelated source reads               |
| Traceability mechanism      | File-only JSDoc, local JSDoc, separate index file | File + local JSDoc `@see`              | Tooling-parseable, co-located with code, supports top-down and bottom-up navigation      |
| ADR vs spec                 | Everything in specs, ADRs for all cross-cutting   | ADRs for decisions, specs for behavior | ADRs are point-in-time; specs are living                                                 |
| Temporary migration records | Keep in parent specs, keep separate blueprint     | Separate blueprint                     | Living docs stay current; migration history can expire                                   |
| Storybook ownership         | Infra-only, UI-only, separate app                 | UI design-system first                 | Component stories document UI contracts; build/tooling changes can depend on infra specs |
| Visual locator notation     | Screenshots, prose only, ASCII maps + code IDs    | ASCII maps + code IDs                  | Stable, diffable, and precise enough for agent planning                                  |
| Code/spec alignment         | Code inferred ad hoc, living docs updated         | Living docs updated                    | Restores docs as the next starting point after code has moved ahead                      |
| Managed update surfaces     | Annotate everything, ignore everything, classify  | Classify and skip internals            | Keeps shadcn and Pi SDK update-safe while documenting AFX-owned wrappers                 |
| Impact Lens readiness       | Infer from raw source, require stable doc nodes   | Stable doc nodes                       | Reverse index can report ghost-node/orphan status deterministically                      |

---

## [DES-DATA] Traceability Node Model

The traceability model has two stable sides: document nodes and source refs. Impact Lens and `/afx-check` should not need to infer ownership from prose when a stable node can be authored once in the living docs.

### Document Nodes

| Node Kind         | Source                     | Stable ID Example      | Use                                 |
| ----------------- | -------------------------- | ---------------------- | ----------------------------------- |
| Requirement       | `spec.md` FR table         | `[FR-12]`              | Functional behavior                 |
| Quality attribute | `spec.md` NFR table        | `[NFR-4]`              | Non-functional constraint           |
| Design section    | `design.md` `## [DES-*]`   | `[DES-COMP]`           | Architecture, UI, flow, data, tests |
| Surface/flow map  | `design.md` ASCII map      | `[Composer.Footer]`    | Visible UI or runtime seam          |
| Code locator row  | `design.md` locator table  | `[Bridge.ChatToAgent]` | File/test/message jump target       |
| Historical task   | `tasks.md` work/task entry | `[1.2]`                | Optional history only               |

### Source Refs

| Source Ref       | Required For                                | Example                                                |
| ---------------- | ------------------------------------------- | ------------------------------------------------------ |
| Top-level `@see` | Every spec-driven source file               | `@see docs/specs/211-app-chat-composer/spec.md [FR-1]` |
| Local `@see`     | Exported or routeable node in dense files   | Function/component JSDoc                               |
| `Surface:`       | UI map seam implemented inside a dense file | `// Surface: [Composer.Footer]`                        |
| `Flow:`          | Runtime/bridge map seam in host/shared code | `// Flow: [AgentManager.Multiplexer]`                  |

### Managed Update Surfaces

Some files are intentionally classified instead of annotated:

| Surface                           | Policy                                                                                    | Reason                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/ui/src/components/**`   | Do not add traceability annotations to shadcn primitives                                  | Registry-owned code should stay update-safe       |
| `packages/ui/src/hooks/**`        | Do not add traceability annotations to shadcn hooks                                       | Same update-safety rule as primitives             |
| `packages/agent/pi-sdk/**`        | Do not annotate Pi SDK/bootstrap internals unless AFX takes ownership of wrapper behavior | SDK/bootstrap content must remain easy to refresh |
| `apps/vscode/resources/pi-sdk/**` | Do not edit manually                                                                      | Generated/bundled runtime payload                 |

AFX-owned wrappers that consume these surfaces still need traceability. For example, app theme usage routes through `131-package-ui-design-system`, while runtime selection and adapter wiring routes through `350-agent-manager` and `351-agent-pi`.

---

## [DES-API] `@see` Annotation Format

`@see` links point source files to numbered living specs. They must not point at sprint plans, retired unnumbered specs, generated output, or missing folders.

### TypeScript/TSX files

```typescript
/**
 * Brief description of what this file does.
 *
 * @see docs/specs/XXX-category-name/spec.md [FR-X]
 * @see docs/specs/XXX-category-name/design.md [DES-SECTION]
 */
```

### Local `@see` Anchors

File-level `@see` links declare the owning spec for the file. Dense or mixed-surface files also add local `@see` links on high-signal code nodes:

- Exported React components, hooks, functions, interfaces, and types.
- Command/action/provider registries.
- Webview bridge handlers and host message dispatch blocks.
- Runtime manager/adaptor entry points.
- Local helper blocks when one file contains multiple child surfaces.

Do not add local `@see` to every tiny private helper. The goal is routeable breadcrumbs, not comment wallpaper.

Example:

```typescript
/**
 * Runtime monitor interface shared by the VSCode command path and webview panel.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export interface AgentRuntimeMonitor {
  start(): void;
}
```

### Map ID Comments

When a design map calls out a stable region or flow boundary, dense source files may mirror that ID with a sparse comment. This is a locator, not a replacement for `@see`.

```typescript
// Surface: [ChatSettings.Providers.Api]
// Flow: [AgentPi.RpcJsonl]
```

Use map ID comments for:

- UI blocks that are large enough to be targeted independently.
- Bridge dispatch switches and message fan-out blocks.
- Command/provider registries.
- Runtime manager or adapter seams.

Avoid map ID comments on tiny helpers unless the helper is the named target of the map.

### Scripts (`.mjs`)

```javascript
// @see docs/specs/XXX-category-name/spec.md [FR-X]
// @see docs/specs/XXX-category-name/design.md [DES-SECTION]
```

### Workflow YAML

```yaml
# @see docs/specs/XXX-category-name/spec.md [FR-X]
# @see docs/specs/XXX-category-name/design.md [DES-SECTION]
```

### Agent Entry Map Format

Every active child zone spec includes an `Agent Entry Map` appendix. Parent specs may include a shorter route map to child zones.

```markdown
### Agent Entry Map

| Field           | Values |
| --------------- | ------ |
| Owned surface   | ...    |
| Owned files     | ...    |
| Local anchors   | ...    |
| Bridge messages | ...    |
| Settings keys   | ...    |
| Commands        | ...    |
| Tests           | ...    |
| Dependencies    | ...    |
| Out of scope    | ...    |
| Example prompts | ...    |
```

The map is intentionally practical. It should answer “where do I start?” before an agent reads source files, especially for small UI/command updates.

### Code Locator Map Format

When a Surface Map or Flow Map appears in `design.md`, add a Code Locator Map near the File Reference Map.

```markdown
## [DES-LOC] Code Locator Map

| Map ID              | Code anchor                        | Messages/settings/commands | Tests |
| ------------------- | ---------------------------------- | -------------------------- | ----- |
| `[Composer.Footer]` | `apps/chat/src/views/chat.tsx` ... | `agent/runtimeStatus`      | ...   |
```

Map IDs should remain stable across small refactors. If code moves, update the locator table and local comments in the same change.

### 1:1 Code/Spec Matrix Format

When a zone has existing code or multiple behavior branches, add a `DES-TRACE`
matrix that maps the living requirement to the design node, source anchor, and
test anchor.

```markdown
## [DES-TRACE] 1:1 Code/Spec Matrix

| Behavior | Requirement | Design node  | Source anchor | Tests |
| -------- | ----------- | ------------ | ------------- | ----- |
| ...      | `[FR-1]`    | `[DES-COMP]` | `path.tsx`    | ...   |
```

Use `Future test` in the Tests column only when the current implementation is
real but not yet directly covered. That makes gaps visible without hiding the
current code owner.

### Retargeting Rules

When migrating old annotations:

- Retarget only source files and tracked scripts/configs.
- Do not edit generated output such as `dist/`, `out/`, `.vscode-test/`, maps, coverage, or test result artifacts.
- Do not edit shadcn primitives or Pi SDK/bootstrap internals just to satisfy trace scans; classify them as managed update surfaces.
- Preserve the nearest meaningful requirement/design anchor instead of mechanically preserving an old anchor that no longer exists.
- Retarget broad parent refs to child zone specs when the file clearly belongs to a surgical surface.

---

## [DES-FILES] File Structure

| Location                        | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `docs/specs/XXX-name/spec.md`   | Requirements                                              |
| `docs/specs/XXX-name/design.md` | Architecture and decisions                                |
| `docs/specs/XXX-name/tasks.md`  | Implementation log (Work Sessions table)                  |
| `docs/adr/ADR-XXXX-*.md`        | Cross-cutting architecture decisions                      |
| `docs/research/<domain>/*.md`   | Investigation and analysis documents                      |
| `packages/ui/src/components/**` | Managed shadcn primitives; no manual trace churn          |
| `packages/agent/pi-sdk/**`      | Managed Pi SDK/bootstrap internals; no manual trace churn |

---

## [DES-DEPS] Dependencies

| Dependency         | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `@afx/parsers`     | Front matter and spec parser compatibility         |
| `/afx-check trace` | Source-to-spec traceability validation             |
| `docs/adr/`        | Point-in-time decisions that affect spec structure |

---

## [DES-SEC] Security Considerations

- No sensitive data in spec documents
- ADRs referencing secrets or auth design must redact actual key values

---

## [DES-ERR] Error Handling

| Scenario                | Handling                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Missing @see annotation | `/afx-check trace` reports unclassified orphaned file                                       |
| Circular `depends_on`   | `/afx-check deps` reports cycle                                                             |
| Retired spec reference  | Migration verification reports old path                                                     |
| Missing child route     | Parent spec route map names owner zone                                                      |
| Ghost node              | Add the missing living `DES-*`/FR/NFR node or retarget the source ref                       |
| Orphan candidate        | Classify as AFX-owned, generated, test fixture, shadcn, Pi SDK, or config before annotating |

---

## [DES-TEST] Testing Strategy

### Validation

- `/afx-check trace <path>` — confirms all source files have `@see` annotations
- `/afx-check links <spec-path>` — confirms cross-references resolve
- `/afx-check deps` — confirms `depends_on` graph is acyclic
- `pnpm check:md` — confirms Markdown/frontmatter formatting
- Impact Lens readiness scans should report zero ghost files, zero ghost nodes, and a classified orphan list before source retargeting begins

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Canonical Routing Update

1. Keep numbering and routing rules in `001-overview`
2. Update parent specs to route to child zones as those zones become active

### Phase 2: Highest-Pain Child Zones

1. Scaffold chat composer, editor actions, `@see` navigation, agent manager, agent Pi, chat notes, UI design-system, and telemetry zones
2. Populate each zone with an Agent Entry Map
3. Retarget source `@see` links from retired docs to numbered living specs

### Phase 3: Remaining App/Package Surfaces

1. Split chat messages/history/settings after composer lands
2. Split workbench board/documents/journal/notes/pipeline/analytics/shell when each surface needs surgical ownership
3. Split shared protocol/logger/agent contract specs when source ownership needs to move out of `100-package-shared`

### Phase 4: Code/Spec Alignment Normalization

1. Run a code-to-spec trace scan for ghost files, ghost nodes, stale retired paths, and orphan candidates
2. Add missing living `DES-*` sections when code already points at valid missing concepts
3. Classify managed update surfaces before adding annotations
4. Update Agent Entry Maps and Code Locator Maps so future Impact Lens work starts from docs

---

## [DES-ROLLBACK] Rollback Plan

If a child zone proves too small to carry its own routing value, merge its current requirements back into the parent spec and retarget source `@see` links back to the parent. Do not delete the old folder until source traceability and workbench parsing are confirmed.

If a code/spec alignment subsection proves too granular, merge it into the nearest canonical section and retarget source refs or Code Locator Map rows in the same change. Do not leave source pointing at removed node IDs.

---

## File Reference Map

| Task | File                       | Required @see                                                       |
| ---- | -------------------------- | ------------------------------------------------------------------- |
| —    | All `packages/*/src/*.ts`  | Child zone when one owns the surface; otherwise parent package spec |
| —    | All `apps/*/src/*.ts(x)`   | Child zone when one owns the surface; otherwise parent app spec     |
| —    | Storybook files            | `131-package-ui-design-system` unless changing build/test infra     |
| —    | Generated artifacts        | No manual edits; regenerate from tracked source                     |
| —    | Shadcn primitives/hooks    | Managed update surface; classify, do not annotate internals         |
| —    | Pi SDK/bootstrap internals | Managed update surface; classify, do not annotate internals         |

---

## Open Technical Questions

None.
