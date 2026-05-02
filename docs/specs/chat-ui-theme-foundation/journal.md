---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-04-28T06:22:47.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: ["chat-ui-theme-foundation", "journal"]
---

# Journal - Chat UI Theme Foundation

<!-- prefix: CUTF -->

> Quick captures and discussion history for AI-assisted development sessions.
> See [agenticflowx.md](../../agenticflowx/agenticflowx.md) for workflow.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

---

## Discussions

<!-- Recorded discussions with IDs: CUTF-D001, CUTF-D002, etc. -->
<!-- Chronological order: oldest first -->

### CUTF-D001 - Sprint scaffolded from ADR and research

`status:active` `2026-04-28T06:22:47.000Z` `[sprint, ui, theme, chat, research-promotion]`

**Context**: User wanted one sprint to carry the large implementation pass for runtime theme foundation, Chat UI polish, token visibility, History, and Settings after research and ADR-0007 clarified the boundary between shadcn presets, host-adaptive surfaces, and app polish.

**Summary**: Created `chat-ui-theme-foundation` as a single-document sprint. The sprint keeps approvals Draft while fully populating Spec, Plan, and Tasks so the team can review/approve section by section before code. Scope centers on sidebar Chat/History/Settings and shared theme infrastructure; full Workbench implementation, auth, and durable session trees are deferred.

**Progress**:

- [x] Sprint file created at `docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md`
- [x] Journal created
- [x] Spec, Plan, and Tasks populated in one pass
- [x] Spec section approved
- [ ] Plan section approved
- [ ] Tasks section approved
- [ ] Implementation begun

**Decisions**:

- Sprint slug: `chat-ui-theme-foundation`.
- Runtime style switching stays CSS-variable/class based; no shadcn component regeneration.
- Host-adaptive surfaces are authoritative for ordinary webview backgrounds, cards, inputs, borders, focus, and text.
- Chat/History/Settings polish is in scope; full Workbench implementation is out of scope except shared theme compatibility.
- History stays active-session scoped and does not fake durable session trees.

**Tips/Ideas**:

- Approve ADR-0007 before code if the team wants the architectural decision locked.
- Start implementation with `packages/ui` token alignment and VS Code class mapping before app polish.
- Keep browser dev fast through `pnpm dev:chat` and mock scenarios.

**Notes**:

- **[CUTF-D001.N1]** **[2026-04-28T06:22:47.000Z]** Initial scaffold from ADR-0007 and `res-meridian-shadcn-theme-taxonomy.md`. Approval gates intentionally left Draft. `[seed]`

**Related Files**: docs/adr/ADR-0007-runtime-theme-families.md, docs/research/res-meridian-shadcn-theme-taxonomy.md, docs/design-system/README.md, docs/design-system/ui_kits/chat-main.html, packages/ui/src/styles/globals.css, packages/ui/src/styles/meridian.tokens.css, packages/ui/src/styles/theme-meridian.css, packages/ui/src/styles/theme-lyra.css, packages/ui/src/tokens/meridian.css, apps/vscode/src/panels/webview-html.ts, apps/chat/src/views/chat.tsx, apps/chat/src/views/history.tsx, apps/chat/src/views/settings.tsx, packages/transport/src/mock.ts
**Participants**: @richard-sentino

---

### CUTF-D002 - Spec section approved

`status:active` `2026-04-28T07:31:15.000Z` `[approval, spec, sprint]`

**Context**: User approved the Spec section for `chat-ui-theme-foundation` after the sprint requirements were updated with source-backed findings from the AFX repo, local shadcn repo, and local VS Code repo.

**Summary**: Marked `approval.spec` as `Approved`. The sprint remains in Draft overall because the Plan and Tasks gates are still Draft.

**Progress**:

- [x] Spec section approved
- [ ] Plan section approved
- [ ] Tasks section approved
- [ ] Implementation begun

**Decisions**:

- Requirements and scope in Section 1 are approved as the basis for design review.
- Plan and Tasks still need explicit approval before code.

**Tips/Ideas**:

- Next command: `/afx-sprint design chat-ui-theme-foundation`

**Notes**:

- **[CUTF-D002.N1]** **[2026-04-28T07:31:15.000Z]** Spec approval recorded after mini-audit passed: FRs present, acceptance criteria populated, and no unresolved blocking open questions. `[approval]`

**Related Files**: docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md
**Participants**: @richard-sentino

---

### CUTF-D003 - DES-CN implementation boundary clarified

`status:active` `2026-04-28T07:45:35.000Z` `[design, components, shadcn, cn-hooks]`

**Context**: User flagged that `[DES-CN] Component Style Hook Refactor` did not clearly say whether the sprint should reinstall shadcn, modify `packages/ui` components, or do something else.

**Summary**: Clarified that this sprint does not reinstall shadcn components, run codegen, or mutate `components.json` for runtime style switching. The work happens by modifying committed `packages/ui/src/components/**` primitives in place with `.cn-*` hook classes, then adding AFX-owned CSS under `packages/ui/src/styles/**`.

**Progress**:

- [x] Clarified DES-CN implementation boundary
- [ ] Plan section approved

**Decisions**:

- Current Lyra-generated primitive sources remain the implementation baseline.
- Local shadcn sources are reference material for hook names and treatment CSS, not files to import wholesale.

**Related Files**: docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md, packages/ui/src/components, packages/ui/src/styles
**Participants**: @richard-sentino

---

### CUTF-D004 - Full mockup audit added to Plan

`status:active` `2026-04-28T07:57:50.000Z` `[design, mockups, data-contract, history, settings]`

**Context**: User clarified that the design-system mockups are not only visual showpieces. Some History and Settings fields represent true Pi/AFX data already available through the current runtime and transport contracts, and all mockups needed to be checked before implementation planning.

**Summary**: Added `[DES-MOCKUPS]` to classify every design-system mockup source and separate live data, small sprint additions, and deferred protocol gaps. Tightened History and Settings to list which mockup fields can ship from current `agent/runtimeSettings`, `chat/state`, `chat/usage`, `agent/settingsSnapshot`, models, commands, stderr, and tool events.

**Progress**:

- [x] Audited all current `docs/design-system/ui_kits/**` mockup files at the plan level
- [x] Clarified `chat-main.html` as the primary Chat/History/Settings extraction source
- [x] Marked Workbench/viewer/site mockups as future or reference surfaces for this sprint
- [ ] Plan section approved

**Decisions**:

- Mockup values may ship only when mapped to current messages/config, explicit sprint additions, or dev-only mock state.
- Pi auth-source details, AFX SecretStorage fallback, model routing, durable context bundle metadata, session trees, and full Workbench data flows stay deferred.

**Related Files**: docs/design-system/ui_kits, docs/design-system/docs, packages/shared/src/messages.ts, packages/shared/src/agent.ts, packages/agent/pi/src/rpc-manager.ts, packages/transport/src/mock.ts, apps/chat/src/views/history.tsx, apps/chat/src/views/settings.tsx
**Participants**: @richard-sentino

---

### CUTF-D005 - Design section approved

`status:active` `2026-04-28T09:01:36.000Z` `[approval, design, sprint]`

**Context**: User approved the Plan section for `chat-ui-theme-foundation` after the major design expansion and review.

**Summary**: Marked `approval.design` as `Approved` after the design mini-audit passed: Spec is approved, `[DES-X]` sections are present, and the Key Decisions table is populated. The sprint remains in Draft overall because Tasks are still Draft.

**Progress**:

- [x] Spec section approved
- [x] Plan section approved
- [ ] Tasks section approved
- [ ] Implementation begun

**Decisions**:

- Section 2 Plan is approved as the implementation design baseline.
- Task refinement remains the next gate before code.

**Tips/Ideas**:

- Next command: `/afx-sprint task chat-ui-theme-foundation`

**Notes**:

- **[CUTF-D005.N1]** **[2026-04-28T09:01:36.000Z]** Design approval recorded by user instruction. `[approval]`

**Related Files**: docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md
**Participants**: @richard-sentino

---

### CUTF-D006 - Tasks aligned with all-seven-style design

`status:active` `2026-04-28T09:04:45.000Z` `[tasks, style-treatment, cn-hooks, verification]`

**Context**: After design approval, task review found older Lyra/Luma-era wording that no longer matched the approved Plan's all-seven-style treatment commitment.

**Summary**: Refined Section 3 Tasks to make the all-seven shadcn style commitment executable: all seven `style-{name}.css` files, all 50 hooked primitives, full hook verification, DebugPanel appearance matrix, and expanded targeted test gates.

**Progress**:

- [x] Task coverage scan passed for FR/NFR/DES anchors
- [x] Task refinements applied for all-seven-style implementation
- [ ] Tasks section approved
- [ ] Implementation begun

**Decisions**:

- Style support remains all-or-nothing for `lyra`, `luma`, `maia`, `nova`, `vega`, `mira`, and `sera`.
- The priority hook batch lands first, but the remaining hooked primitives are now explicit sprint work.
- Verification now includes package UI, transport, and VS Code tests in addition to Chat and build gates.

**Related Files**: docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md
**Participants**: @richard-sentino

---

### CUTF-D007 - Tasks section approved

`status:active` `2026-04-28T09:09:33.000Z` `[approval, tasks, sprint]`

**Context**: User approved the Tasks section for `chat-ui-theme-foundation` after task refinements aligned the implementation checklist with the approved design.

**Summary**: Marked `approval.tasks` as `Approved` and promoted the sprint top-level `status` to `Approved`. The task approval mini-audit passed: every task group has canonical sprint `@see` traceability, every FR/NFR/DES anchor is covered, task IDs are unique, and all task items are valid checkboxes.

**Progress**:

- [x] Spec section approved
- [x] Plan section approved
- [x] Tasks section approved
- [ ] Implementation begun

**Decisions**:

- The sprint is approved for implementation.
- Code remains gated through `/afx-sprint code`, which delegates to `/afx-task code`.

**Tips/Ideas**:

- Next command: `/afx-sprint verify chat-ui-theme-foundation`

**Notes**:

- **[CUTF-D007.N1]** **[2026-04-28T09:09:33.000Z]** Task approval recorded after mini-audit passed. `[approval]`

**Related Files**: docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md
**Participants**: @richard-sentino

---

## Prompt Captures

<!-- Verbatim user prompts + agent reply excerpts at pivotal moments. Append-only. -->
<!-- IDs: CUTF-P001, CUTF-P002, ... (P for "prompt", distinct from D for discussion) -->

### CUTF-P001 — Source-backed plan correction after repo investigation

- `type:prompt-capture` `2026-04-28T06:41:22.000Z` `[design-pivot, source-backed, shadcn, vscode, theme]`
- trigger: design-pivot
- triggered-change: DES-OVR, DES-TOKENS, DES-HOST, DES-SHADCN, DES-CHAT, DES-HISTORY, DES-SETTINGS, tasks 0.1, 1.1, 1.2, 1.3, 3.2, 4.1, 5.2, 6.1
- agent: codex
- model: gpt-5-codex

**User prompt** (verbatim):

> in the past session, we've made assumptions and it cost us time and effort - have you done deep research and investigation ? our repo, shadcn repo, vscode repo - this is critical otherwise our plan is useless if we missed important details.
>
> do not look at the surface level, we analyse, synthesize and update the plan

**Agent reply** (excerpt):

> Deep investigation found several plan-changing facts: `@afx/ui/tokens` does not point at the same token source as the app, `--input` is mapped to a VS Code border variable instead of an input background variable, upstream shadcn styles differ structurally in generated components, and VS Code webviews provide first-class light/dark/high-contrast classes plus `--vscode-*` variables. The sprint plan was updated to make runtime shadcn-derived switching token-family scoped over the current Lyra primitive baseline, with full Maia/Sera shape parity deferred.

**Outcome**:

- Updated the sprint plan with source-backed constraints from AFX, shadcn, and VS Code.
- Added explicit token drift, input semantic mapping, high-contrast, shadcn primitive-baseline, token visibility, history density, settings destination, and mock-scenario constraints.
- Kept approvals Draft so the corrected plan can be reviewed before implementation.

### CUTF-P002 — Split AFX identity from shadcn style treatment

- `type:prompt-capture` `2026-04-28T07:11:37.000Z` `[design-pivot, shadcn, identity, appearance]`
- trigger: design-pivot
- triggered-change: FR-4, FR-5, FR-6, FR-13, FR-14, FR-15, DES-TOKENS, DES-SHADCN, DES-VSCODE, DES-API, DES-DATA, DES-DEC, tasks 1.3, 2.1, 2.2, 5.2, 6.1
- agent: codex
- model: gpt-5-codex

**User prompt** (verbatim):

> if you dig deeper into shadcn, they have amber, blue, fuchsia, etc - i think this is where we're at for meridian ?
>
> if you ask, we could even remove medirian out of the context and just use whatever from shadcn, however, I want to enforce a bit of identity to afx

**Agent reply** (excerpt):

> The shadcn source backs this: `amber`, `blue`, `fuchsia`, `rose`, and related names belong to the theme/accent axis, while `lyra`, `luma`, `maia`, and similar names belong to the style axis. The sprint was updated so AFX/Meridian is a small identity/accent pack layered over shadcn and VS Code host variables, not a competing style family.

**Outcome**:

- Reframed appearance around identity/accent and style/treatment axes.
- Kept AFX identity intentionally small: brand accents, token receipts, workflow markers, and signal colors.
- Added `afx.style` as the planned persisted treatment setting while preserving `afx.theme` for AFX/Meridian identity.

### CUTF-P003 — Add source-backed feasibility gates

- `type:prompt-capture` `2026-04-28T07:15:02.000Z` `[feasibility, fact-check, no-assumptions]`
- trigger: missed-req
- triggered-change: DES-FEAS, task 0.3
- agent: codex
- model: gpt-5-codex

**User prompt** (verbatim):

> we'll just make sure what's in our design is doable, fact-check agains our repo, shadcn and vscode - no assumptions and or surface level decisions

**Agent reply** (excerpt):

> The design is feasible, but only with explicit gates: `afx.style` does not exist yet, Settings has no appearance write path, the Settings snapshot has no appearance values, shadcn style CSS does not directly affect current AFX primitives, and VS Code host variables/classes are the authoritative source for ordinary surfaces. The sprint now requires source-backed feasibility validation before coding.

**Outcome**:

- Added [DES-FEAS] with a feasibility matrix tied to AFX repo, shadcn, and VS Code facts.
- Added task 0.3 so implementation must validate source-backed facts before code.
- Marked unsupported assumptions as deferrals rather than design promises.

### CUTF-P004 — Add primitive hook refactor plan

- `type:prompt-capture` `2026-04-28T07:23:44.000Z` `[component-refactor, shadcn, cn-hooks, style-treatment]`
- trigger: missed-req
- triggered-change: DES-CN, tasks 1.5, 1.6, 7.1
- agent: codex
- model: gpt-5-codex

**User prompt** (verbatim):

> ok, great. let's add what refacorting to our components, and use of .cn-* we need to do this
>
> after all, that's why we're doing this right, chat-ui-theme-foundation

**Agent reply** (excerpt):

> The current AFX primitives expose generated Tailwind classes plus `data-slot`, while upstream shadcn style treatment targets `.style-* .cn-*` hooks. The sprint now includes a mechanical `.cn-*` hook refactor for priority Chat/History/Settings primitives before any Lyra/Luma treatment CSS relies on those hooks.

**Outcome**:

- Added [DES-CN] with the component style hook refactor rules and initial hook map.
- Added tasks 1.5 and 1.6 for primitive hooks and AFX-owned treatment CSS extraction.
- Updated verification tasks to cover required `.cn-*` hook presence.
