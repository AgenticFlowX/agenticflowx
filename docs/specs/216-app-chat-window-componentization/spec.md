---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-15T09:13:06.000Z"
updated_at: "2026-05-16T03:31:12.000Z"
tags:
  [
    "app",
    "chat",
    "componentization",
    "state-ownership",
    "performance",
    "composer-panels",
    "attachments",
    "traceability",
  ]
depends_on:
  ["210-app-chat", "211-app-chat-composer", "212-app-chat-messages", "213-app-chat-history"]
---

# App Chat Window Componentization - Product Specification

## References

- Parent chat app: `../210-app-chat/spec.md`
- Composer behavior: `../211-app-chat-composer/spec.md`
- Message timeline behavior: `../212-app-chat-messages/spec.md`
- Chat history behavior: `../213-app-chat-history/spec.md`
- Durable technical design: `design.md`

---

## Problem Statement

`apps/chat/src/views/chat.tsx` has become a large chat-window implementation surface that mixes bridge subscriptions, persisted view state, timeline rendering, welcome states, composer controls, strip-style helper surfaces, footer/runtime hints, and global overlays. That shape makes small UI changes risky and makes source-code `@see` annotations too broad for surgical future edits.

This spec creates the durable source of truth for refactoring the Chat tab into named, shallow React component boundaries while preserving current behavior. Fleet/sprint documents may plan execution, but source-code `@see` annotations for this refactor must point to this spec folder, not to fleet planning documents.

## User Stories

### Primary Users

- AFX maintainers changing one chat-window region at a time.
- AFX developers profiling render performance and isolating expensive regions.
- Spec-driven agents that need durable `@see` anchors for targeted edits.

### Stories

**As a** maintainer  
**I want** stable component names for each chat-window region  
**So that** I can update one surface without re-reading the full Chat view.

**As a** developer  
**I want** a single state owner for bridge and shared state  
**So that** extracted components do not recreate a new monolith through prop sprawl.

**As a** spec-driven agent  
**I want** source-code `@see` annotations to point at durable repo specs  
**So that** implementation traceability does not depend on temporary fleet documents.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                      | Priority    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Keep `apps/chat/src/views/chat.tsx` as the stable Chat route shell and default export.                                           | Must Have   |
| FR-2  | Create `apps/chat/src/components/chat/chat-window.tsx` as the `ChatWindow` visual composition root.                              | Must Have   |
| FR-3  | Create `apps/chat/src/components/chat/chat-controller.tsx` as the binding state owner for bridge subscriptions and shared state. | Must Have   |
| FR-4  | Use one shallow directory, `apps/chat/src/components/chat/`, for new chat-window region components.                              | Must Have   |
| FR-5  | Use canonical domain-role names from `design.md [DES-UI]`.                                                                       | Must Have   |
| FR-6  | Preserve behavior for hydration, timeline rendering, empty states, composer interactions, popovers, footer, and overlays.        | Must Have   |
| FR-7  | Compose optional regions through typed internal flags or ordered region/panel configs at clear boundaries.                       | Must Have   |
| FR-8  | Keep existing reusable root-level components in place unless a future behavior spec explicitly moves them.                       | Must Have   |
| FR-9  | Reserve stable component boundaries for multi-file and image attachment UI.                                                      | Should Have |
| FR-10 | Reserve stable panel slots for future composer mini-app surfaces.                                                                | Must Have   |
| FR-11 | Reserve history load/export slots without implementing history persistence in this refactor.                                     | Should Have |
| FR-12 | Update affected durable specs so source-code `@see` annotations never point to fleet/sprint planning docs for this refactor.     | Must Have   |

### Non-Functional Requirements

| ID    | Requirement           | Target                                                                                                  |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| NFR-1 | Maintainability       | Each new component has a single visual or orchestration role and narrow props/slices.                   |
| NFR-2 | Behavior preservation | The refactor does not intentionally change bridge protocol, shortcuts, persisted state, or copy.        |
| NFR-3 | Performance readiness | Timeline, composer, panel stack, top bar, and footer have independent render boundaries.                |
| NFR-4 | Traceability          | New source `@see` comments target this spec or the relevant child zone specs, not fleet docs.           |
| NFR-5 | React convention      | Prefer plain React hooks, typed props, memoizable region slices, and no app-wide chat context.          |
| NFR-6 | Extensibility         | Composer panels register through typed definitions rather than scattered conditional JSX.               |
| NFR-7 | Benchmark baseline    | E2E coverage includes a practical long AI coding-chat benchmark with memory and responsiveness budgets. |

---

## Acceptance Criteria

- [ ] `views/chat.tsx` remains the route shell and delegates the Chat tab body to `ChatWindow`.
- [ ] `components/chat/` contains the canonical shallow component files listed in `design.md [DES-FILES]`.
- [ ] `chat-controller.tsx` owns bridge subscriptions, persisted view state, shared derived state, stable actions, and the history store slot.
- [ ] Region components consume narrow slice contracts, not the whole controller.
- [ ] Existing root-level components are reused from their current locations during this refactor.
- [ ] Source-code `@see` annotations for the refactor point to `docs/specs/216-app-chat-window-componentization/*` or the relevant durable child spec.
- [ ] `210-app-chat`, `211-app-chat-composer`, `212-app-chat-messages`, and `213-app-chat-history` remain aligned with the new component map.
- [ ] Playwright covers a long code-heavy chat transcript and records hydrate time, composer typing time, DOM size, and heap delta as a reusable benchmark baseline.
- [ ] No fleet/sprint planning document is required to understand future surgical changes.

---

## Non-Goals

- No visual redesign or copy rewrite.
- No bridge protocol replacement.
- No runtime product setting for internal `ChatWindowFlags`.
- No deep nested component directory tree.
- No implementation of chat-history load/export persistence.
- No implementation of full multi-file/image attachment behavior beyond reserved structural boundaries.
- No migration of every existing root-level reusable component into `components/chat/`.

---

## Open Questions

None blocking for this structural refactor. History format, load UX, export schema, and reload semantics are deferred to `213-app-chat-history` follow-on work.

---

## Decision Table

| #   | Decision                                                    | Status   | Resolution                                                                                             |
| --- | ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 1   | State owner                                                 | Resolved | `chat-controller.tsx` is required and owns shared/bridge/persisted/derived chat state.                 |
| 2   | Root component name                                         | Resolved | Use `ChatWindow`.                                                                                      |
| 3   | Conversation region name                                    | Resolved | Use `ConversationPane`, `ConversationTimeline`, and `ConversationEmptyStates`.                         |
| 4   | Composer root and extension surface names                   | Resolved | Use `ComposerDock`, `ComposerPanelStack`, `ComposerPanel`, and `ComposerAttachmentTray`.               |
| 5   | Feature flags                                               | Resolved | Use internal/test/shadow-rollout `ChatWindowFlags`; do not expose product settings in this refactor.   |
| 6   | Existing reusable components                                | Resolved | Keep them in place and compose/wrap them from new chat-region components.                              |
| 7   | Source-code `@see` target                                   | Resolved | Use this durable repo spec and child specs; do not use fleet/sprint documents for implementation refs. |
| 8   | History load/export persistence format and reload semantics | Deferred | Follow-on history persistence design. This refactor reserves slots only.                               |

---

## Dependencies

- `210-app-chat` owns app shell, route map, transport bootstrap, and DevOverlay routing.
- `211-app-chat-composer` owns composer behavior, controls, keyboard policy, queue, strip-style surfaces, shell command UX, and file context behavior.
- `212-app-chat-messages` owns conversation timeline rendering, row anatomy, markdown, tool events, thinking traces, and empty/welcome message states.
- `213-app-chat-history` owns existing History tab behavior and future persistence semantics beyond reserved slots.

---

## Appendix

### Durable `@see` Rule

Future implementation comments should use durable repo-local anchors such as:

```text
@see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-STATE]
@see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENTS]
@see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
```

Do not point source files at `docs/specs/900-fleet/**` planning documents.
