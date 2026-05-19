---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-15T09:13:06.000Z"
updated_at: "2026-05-19T13:46:29.000Z"
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
spec: spec.md
---

# App Chat Window Componentization - Technical Design

---

## [DES-OVR] Overview

The Chat tab refactor introduces a shallow `components/chat/` group and separates route shell, state ownership, conversation rendering, composer composition, and durable traceability anchors. `views/chat.tsx` remains the stable route default export. `chat-window.tsx` becomes the visual composition root. `chat-controller.tsx` becomes the binding state owner for bridge subscriptions, persisted view state, shared derived state, stable actions, and reserved history storage slots.

This document is the durable implementation reference for chat-window componentization. Fleet/sprint planning documents may track execution, but source-code `@see` comments should point here or to the relevant child behavior spec.

---

## [DES-ARCH] Architecture

### Current Boundary

```text
apps/chat/src/views/chat.tsx
  ├─ bridge subscriptions and persisted state
  ├─ top status/action row
  ├─ conversation scroll viewport, timeline rows, and empty states
  ├─ composer activity and helper panel surfaces
  ├─ composer textarea, popovers, toolbar, actions, and footer
  └─ toast/debug overlay integration
```

### Target Boundary

```text
apps/chat/src/views/chat.tsx
  └─ route shell; default-exports Chat(props) and renders <ChatWindow ... />

apps/chat/src/components/chat/
  ├── chat-window.tsx                 # ChatWindow composition root
  ├── chat-controller.tsx             # binding state owner and bridge adapter
  ├── chat.types.ts                   # shared flags, slices, panel/attachment types
  ├── chat-top-bar.tsx                # ChatTopBar
  ├── conversation-pane.tsx           # ConversationPane
  ├── conversation-timeline.tsx       # ConversationTimeline
  ├── conversation-empty-states.tsx   # ConversationEmptyStates
  ├── conversation-scroll-button.tsx  # ConversationScrollButton
  ├── composer-dock.tsx               # ComposerDock
  ├── composer-activity-bar.tsx       # ComposerActivityBar
  ├── composer-panel-stack.tsx        # ComposerPanelStack
  ├── composer-panel.tsx              # ComposerPanel
  ├── composer-attachment-tray.tsx    # ComposerAttachmentTray
  ├── composer-input.tsx              # ComposerInput
  ├── composer-toolbar.tsx            # ComposerToolbar
  ├── composer-actions.tsx            # ComposerActions
  ├── composer-footer.tsx             # ComposerFooter
  └── chat-history-slots.tsx          # reserved history load/export component names
```

### Composition Rule

- `views/chat.tsx` owns route compatibility only.
- `chat-window.tsx` composes visual regions in screen order.
- `chat-controller.tsx` owns shared state and bridge side effects.
- Regions consume narrow slices or explicit props; no region receives the whole controller unless specifically justified by this design.
- Existing reusable components outside `components/chat/` remain in place and are imported by region components.

---

## [DES-STATE] State Ownership And Data Flow

`chat-controller.tsx` is binding. A state concern belongs in the controller when any of these are true:

1. It is read by two or more visual regions.
2. It comes from a bridge subscription.
3. It is persisted outside React component memory.
4. It is derived from any of the above.

Otherwise the state stays local to the leaf region.

### Controller Surface — Current

This is what `useChatController()` returns. Region slices are exposed as
`controller.slices.*`; the controller does not expose `use*Slice()` methods.

```typescript
export interface ChatController {
  flags: ChatWindowFlags;
  initialPersistedChatView: PersistedChatViewState | null;
  historyStore: ChatHistoryStore | null; // reserved slot, null until persistence lands
  bridge: ChatControllerBridge; // {getState, setState, send, on}
  state: ChatControllerState;
  derived: ChatControllerDerived;
  actions: ChatControllerActions;
  slices: ChatControllerRegionSlices;
  composerPanelStackConfig: ComposerPanelStackConfig;
}

export function useChatController(props?: UseChatControllerProps): ChatController;
```

### Anti-Patterns

- Do not put raw bridge subscriptions in visual components.
- Do not pass the full controller to every region.
- Do not add Redux/Zustand or app-wide chat state context for this refactor.
- Do not move local-only popover, IME, collapse, or prompt-history details into the controller unless they become shared.

### Implementation Status

Current implementation:

- `chat-controller.tsx` owns all bridge subscriptions, persisted chat view state, cross-region state, derived flags, stable action callbacks, lifecycle refs, and `composerPanelStackConfig`.
- `ChatWindow` owns composer-local state only: draft routing, slash/mention popovers, prompt-history cursor, scroll refs, composer DOM refs, and keyboard handling.
- Region components consume narrow props derived from `controller.slices.*`; no raw writer surface is exposed.
- All six composer helper surfaces render through `ComposerPanelDefinition` entries.

---

## [DES-UI] Canonical Region Names And Layout

### Naming Standard

| Term           | Use For                                         | Examples                                           | Avoid                                  |
| -------------- | ----------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `ChatWindow`   | Whole Chat tab surface                          | `ChatWindow`, `ChatWindowFlags`                    | `Main`, `Root`, `ChatMain`             |
| `Conversation` | Transcript, timeline, empty/loading states      | `ConversationPane`, `ConversationTimeline`         | `Chatbox`, `MessagesArea`              |
| `Composer`     | Bottom prompt/input system                      | `ComposerDock`, `ComposerInput`, `ComposerToolbar` | `InputArea`, `PromptBox`               |
| `Panel`        | Optional mini-app/helper surface above composer | `ComposerPanelStack`, `ComposerPanel`              | `Addon`, `Extension`, `Helper`         |
| `Tray`         | Compact selected item/chip collection           | `ComposerAttachmentTray`                           | Legacy strip names for new attachments |
| `Bar`          | Horizontal status/control strip                 | `ChatTopBar`, `ComposerActivityBar`                | `Header` unless semantic header exists |
| `Action`       | Button/action clusters                          | `ComposerActions`                                  | `Buttons`, `Controls`                  |
| `Popover`      | Floating anchored transient UI                  | `SlashCommandPopover`, `FileMentionPopover`        | `Popup` for new work                   |

### Whole Chat Window Layout

```text
+====================================================================================================+
| APP TAB STRIP [AppTabs]                                                                            |
| [ Chat ]                                   [ History ]                                 [ Settings ]|
+====================================================================================================+
| CHAT WINDOW [ChatWindow]                                                                           |
|  +------------------------------------------------------------------------------------------------+|
|  | TOP BAR [ChatTopBar]                                                  [Memory] [New] [Restart] ||
|  +------------------------------------------------------------------------------------------------+|
|  | CONVERSATION PANE [ConversationPane]                                                           ||
|  |  [ConversationTimeline] OR [ConversationEmptyStates]                                            ||
|  |                                                            [ConversationScrollButton ↓]         ||
|  +------------------------------------------------------------------------------------------------+|
|  | COMPOSER DOCK [ComposerDock]                                                                   ||
|  |  [ComposerActivityBar]                                                                         ||
|  |  [ComposerPanelStack]                                                                          ||
|  |    [ComposerAttachmentTray] [WorkflowPanel] [QueuePanel] [ModifiedFilesPanel] [ContextPanel]    ||
|  |  [ComposerInput] with [SlashCommandPopover] and [FileMentionPopover]                             ||
|  |  [ComposerToolbar]                                      [ComposerActions]                        ||
|  |  [ComposerFooter]                                                                               ||
|  +------------------------------------------------------------------------------------------------+|
+====================================================================================================+
| GLOBAL OVERLAYS [ToastStack] [DevDebugPanel]                                                       |
+====================================================================================================+
```

### Visual Locator Map

Use this map as the first stop when locating a visible chat feature. This
parent design owns placement and component boundaries; child specs own detailed
behavior.

```text
+====================================================================================================+
| AppTabs (outside ChatWindow)                                                                       |
| [ Chat ]                               [ History ]                              [ Settings ]       |
+====================================================================================================+
| ChatWindow                                                                                         |
|                                                                                                    |
|  ChatTopBar                                                                                        |
|  [memory/runtime] [compact] [new chat] [restart]                                                   |
|                                                                                                    |
|  ConversationPane                                                                                  |
|  +----------------------------------------------------------------------------------------------+  |
|  | ConversationTimeline OR ConversationEmptyStates                                               |  |
|  |   SpecModeWelcome may show: Suggested Prompt -> prompt card                                  |  |
|  |                                                               ConversationScrollButton        |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  ComposerActivityBar                                                                               |
|  . IDLE / THINKING / shell-local activity                                                          |
|                                                                                                    |
|  ComposerDock                                                                                      |
|  +----------------------------------------------------------------------------------------------+  |
|  | ComposerPanelStack                                                                            |  |
|  |   ComposerPanel(id="doc-actions")                                                            |  |
|  |     header: SPEC.MD . DRAFT                                  [collapse] [dismiss]             |  |
|  |     body:   [1 Spec] -------- [2 Design] -------- [3 Tasks]                                   |  |
|  |             RELATED . Work Sessions                                                           |  |
|  |             [Refine] [Author] | [Verify] [Approve]                                            |  |
|  |   ComposerPanel(id="modified-files" | "queue" | "blocked-command" | "notice:*" | ...)       |  |
|  |                                                                                              |  |
|  | ComposerAttachmentTray                                                                        |  |
|  |   [selected-file] [selected-image]                                                            |  |
|  |                                                                                              |  |
|  | ComposerInput                                                                                 |  |
|  |   textarea: Spec mode -- refine specs, evolve designs, or slice tasks...                      |  |
|  |   helpers: SlashPopup "/" and MentionPopup "@"                                                |  |
|  |                                                                                              |  |
|  | ComposerToolbar                                                ComposerActions                 |  |
|  |   [@] [model/thinking] | [mode] [active-file-context]       [memory] [send/stop]          |  |
|  |                                                                                              |  |
|  | ComposerFooter                                                                                |  |
|  |   [PI] [usage tokens/context/cost]                                  Planning / Docs only ...  |  |
|  +----------------------------------------------------------------------------------------------+  |
+====================================================================================================+
```

### Focused Visual Groups

These smaller maps are intentionally redundant with the full map above. Use
them when a screenshot shows only one part of the chat window.

```text
Group: ChatTopBar
Spec owner: 210-app-chat for app shell; 216 for placement; 211 for composer/runtime actions.

+----------------------------------------------------------------------------------------------------+
| ChatTopBar                                                                                         |
| [Memory] [Compact] [New Chat] [Restart]                                                            |
+----------------------------------------------------------------------------------------------------+
```

```text
Group: ConversationPane
Spec owner: 212-app-chat-messages for timeline, empty states, and message behavior.

+----------------------------------------------------------------------------------------------------+
| ConversationPane                                                                                   |
|                                                                                                    |
|   ConversationTimeline                                                                             |
|     User row / assistant row / tool row / command output / note / compaction                       |
|                                                                                                    |
|   OR                                                                                               |
|                                                                                                    |
|   ConversationEmptyStates                                                                          |
|     AgentSetupState / WelcomeShell / EmptyState / SpecModeWelcome                                  |
|       Suggested Prompt -> prompt card                                                              |
|                                                                                                    |
|                                                                   ConversationScrollButton         |
+----------------------------------------------------------------------------------------------------+
```

```text
Group: ComposerDock
Spec owner: 216 for placement and panel registry; 211 for composer behavior.

+----------------------------------------------------------------------------------------------------+
| ComposerActivityBar                                                                                |
| . IDLE / THINKING / shell command state                                                            |
+----------------------------------------------------------------------------------------------------+
| ComposerDock                                                                                       |
|                                                                                                    |
|   ComposerPanelStack                                                                               |
|     modified-files -> queue -> blocked-command -> doc-actions -> afx-command notice                |
|                                                                                                    |
|   ComposerAttachmentTray                                                                           |
|     selected files/images                                                                          |
|                                                                                                    |
|   ComposerInput                                                                                    |
|     textarea + SlashPopup + MentionPopup                                                           |
|                                                                                                    |
|   ComposerToolbar                                      ComposerActions                             |
|     @ model/thinking | mode file-context                 memory send/follow-up/steer/stop          |
|                                                                                                    |
|   ComposerFooter                                                                                    |
|     PI + usage stats                                             mode/runtime/keyboard hint        |
+----------------------------------------------------------------------------------------------------+
```

```text
Group: doc-actions panel inside ComposerPanelStack
Spec owner: 211-app-chat-composer for document workflow behavior.

+----------------------------------------------------------------------------------------------------+
| ComposerPanel(id="doc-actions")                                                                    |
|                                                                                                    |
| Header                                                                                             |
|   [doc icon] SPEC.MD . DRAFT                                                [collapse] [dismiss]   |
|                                                                                                    |
| Body                                                                                               |
|   [1 Spec] ================= [2 Design] ================= [3 Tasks]                                |
|                                                                                                    |
|                         RELATED . Work Sessions                                                    |
|                                                                                                    |
|   [Refine v] [Author] | [Verify] [Approve] [More] [Sign Off v]                                     |
+----------------------------------------------------------------------------------------------------+
```

```text
Group: ComposerInput, toolbar, actions, footer
Spec owner: 211-app-chat-composer for input, shortcuts, mode, model, memory, send, and footer copy.

+----------------------------------------------------------------------------------------------------+
| ComposerInput                                                                                      |
|   Spec mode -- refine specs, evolve designs, or slice tasks...                                     |
|                                                                                                    |
|   helpers: SlashPopup "/" and MentionPopup "@"                                                     |
|                                                                                                    |
| ComposerToolbar                                                  ComposerActions                    |
|   [@] [model/thinking] | [Spec v] [post active file]                [Memory v] [Send/Stop]  |
|                                                                                                    |
| ComposerFooter                                                                                     |
|   . PI  [tokens / ctx / cost]                                  Planning / Docs only . Cmd+Shift+M  |
+----------------------------------------------------------------------------------------------------+
```

### Child Spec Drill-Down

| Start Here In `216`                             | Child Spec For Detail                                                                                                                   | What The Child Owns                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ChatTopBar` placement                          | `docs/specs/210-app-chat/design.md [DES-UI]`; `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]`                       | App shell placement, memory/runtime actions, compact/new/restart behavior references.                     |
| `ConversationPane`, timeline, empty states      | `docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MOCKUPS] [DES-MESSAGES-WELCOME-SPEC]`                                         | Message rows, tool rows, command output, note rows, compaction rows, welcome and suggested-prompt states. |
| `ComposerDock` and bottom composer composition  | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-MOCKUPS] [DES-COMPOSER-COMPONENTS]`                                           | Input states, streaming states, unavailable states, shell command state, toolbar/actions/footer behavior. |
| `ComposerPanelStack` registry                   | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]`; this doc [DES-DATA]                                        | Panel content behavior, panel IDs, queue, modified files, blocked command, doc-actions, suggestions.      |
| `doc-actions` panel and `[1 Spec] -> [3 Tasks]` | `docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-17]`; `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]` | Spec stepper, Related / Work Sessions chips, Refine/Author/Verify/Approve command routing.                |
| Future history load/export slots                | `docs/specs/213-app-chat-history/design.md [DES-HISTORY-MOCKUPS] [DES-HISTORY-SURFACE-MAP]`; this doc [DES-HISTORY]                     | History tab behavior, future `ChatHistoryPanel`, `ChatHistoryLoadAction`, and `ChatHistoryExportAction`.  |
| App-level overlays and debug surfaces           | `docs/specs/210-app-chat/design.md [DES-ARCH] [DES-UI]`                                                                                 | Toast host, debug overlay, app tab shell, broad chat app routing.                                         |

### Region Breakdown

```text
ChatTopBar
  Purpose: top-level chat/session actions.
  Owns visible placement for: memory menu, compact, new chat, restart.
  File: apps/chat/src/components/chat/chat-top-bar.tsx

ConversationPane
  Purpose: scroll viewport and state routing.
  Contains:
    ConversationTimeline
    ConversationEmptyStates / SpecModeWelcome
    ConversationScrollButton
  Files:
    apps/chat/src/components/chat/conversation-pane.tsx
    apps/chat/src/components/chat/conversation-timeline.tsx
    apps/chat/src/components/chat/conversation-empty-states.tsx
    apps/chat/src/components/chat/conversation-scroll-button.tsx

ComposerActivityBar
  Purpose: small activity row above the dock.
  Owns visible placement for: IDLE, THINKING, shell-local activity.
  File: apps/chat/src/components/chat/composer-activity-bar.tsx

ComposerDock
  Purpose: fixed bottom composer system.
  Contains, in order:
    ComposerPanelStack
    ComposerAttachmentTray
    ComposerInput
      ComposerToolbar
      ComposerActions
    ComposerFooter
  File: apps/chat/src/components/chat/composer-dock.tsx
```

### Composer Panel Stack Breakdown

```text
ComposerPanelStack
  ComposerPanel(id="doc-actions")
    Header
      ChatDocActionsPanelTitle
        "SPEC.MD . DRAFT" / "DESIGN.MD . DRAFT" / "TASKS.MD . LIVING"
      ChatDocActionsPanelHeaderExtras
        reserved slot; current controller keeps Memory in ChatTopBar and ComposerActions
      ComposerPanel chrome
        collapse and dismiss controls
    Body
      ChatDocActionsPanelBody
        SpecStepper
          [1 Spec] -> [2 Design] -> [3 Tasks] -> [Journal]
        Related / Work Sessions row
        Refine / Author / Verify / Approve / More / Sign Off actions

  ComposerPanel(id="modified-files")
    Modified files changed by edit/write tools.

  ComposerPanel(id="queue")
    Follow-up and steer queue while an assistant turn is streaming.

  ComposerPanel(id="blocked-command")
    Explore-mode blocked shell command with copy / switch-to-code affordance.

  ComposerPanel(id="notice:*")
    Generic tips, information, alerts, news, or success notices owned by the feature that registers them.

  ComposerPanel(id="afx-command-suggest")
    Composer notice that suggests Spec mode after an AFX slash command succeeds in chat.
```

### Visible Feature Locator

| Visible UI / Label                       | Region / Slot                             | Owning Component(s)                                  | Source File(s)                                                                                                 | Behavior Reference                                                                         |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Chat`, `History`, `Settings` tabs       | App shell outside `ChatWindow`            | `AppTabs` / app-level tab shell                      | `apps/chat/src/app.tsx`                                                                                        | `docs/specs/210-app-chat/design.md`                                                        |
| Top memory / compact / new / restart row | `ChatTopBar`                              | `ChatTopBar`                                         | `apps/chat/src/components/chat/chat-top-bar.tsx`                                                               | This doc [DES-UI]; `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]`     |
| Suggested Prompt card                    | `ConversationPane` empty-state branch     | `SpecModeWelcome`, `ConversationEmptyStates`         | `apps/chat/src/components/chat/conversation-empty-states.tsx`                                                  | `docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]`                   |
| `IDLE`, thinking, shell activity row     | `ComposerActivityBar`                     | `ComposerActivityBar`                                | `apps/chat/src/components/chat/composer-activity-bar.tsx`                                                      | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]`                         |
| `SPEC.MD . DRAFT` panel header           | `ComposerPanelStack` -> `doc-actions`     | `ComposerPanel`, `ChatDocActionsPanelTitle`          | `apps/chat/src/components/chat/composer-panel.tsx`; `apps/chat/src/components/chat-doc-actions-panel.tsx`      | This doc [DES-DATA]; `docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]`            |
| `[1 Spec] -> [2 Design] -> [3 Tasks]`    | `doc-actions` panel body                  | `ChatDocActionsPanelBody`, `SpecStepper`             | `apps/chat/src/components/chat-doc-actions-panel.tsx`; `apps/chat/src/components/spec-stepper.tsx`             | `docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-17]`                                 |
| `Related . Work Sessions`                | `doc-actions` panel body                  | `ChatDocActionsPanelBody`, `SpecStepper`             | `apps/chat/src/components/chat-doc-actions-panel.tsx`; `apps/chat/src/components/spec-stepper.tsx`             | `docs/specs/211-app-chat-composer/spec.md [FR-17]`                                         |
| `Refine`, `Author`, `Verify`, `Approve`  | `doc-actions` panel action row            | `ChatDocActionsPanelBody`                            | `apps/chat/src/components/chat-doc-actions-panel.tsx`                                                          | `docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]`                                 |
| `Clear all` queue action                 | `ComposerPanelStack` -> `queue`           | `QueuePanel`, `QueueClearAllAction`, `ComposerPanel` | `apps/chat/src/components/chat/composer-panels.tsx`; `apps/chat/src/components/chat/composer-panel.tsx`        | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE]`                          |
| Blocked command warning                  | `ComposerPanelStack` -> `blocked-command` | `BlockedCommandPanelBody`, `ComposerPanel`           | `apps/chat/src/components/chat/composer-panels.tsx`; `apps/chat/src/components/chat/composer-panel.tsx`        | `docs/specs/211-app-chat-composer/spec.md [FR-13]`                                         |
| Textarea and `/` / `@` popovers          | `ComposerInput`                           | `ComposerInput`, `SlashPopup`, `MentionPopup`        | `apps/chat/src/components/chat/composer-input.tsx`; `apps/chat/src/components/{slash-popup,mention-popup}.tsx` | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS] [DES-COMPOSER-HELPERS]`    |
| `@`, model, mode, active-file controls   | `ComposerToolbar`                         | `ComposerToolbar`, `ModelCombobox`                   | `apps/chat/src/components/chat/composer-toolbar.tsx`; `apps/chat/src/components/model-combobox.tsx`            | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-CONTEXT]` |
| Memory dropdown and send / stop button   | `ComposerActions`                         | `ComposerActions`, `ChatMemoryMenuButton`            | `apps/chat/src/components/chat/composer-actions.tsx`; `apps/chat/src/components/chat-memory-menu-button.tsx`   | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]`                           |
| `PI`, token usage, mode hint footer      | `ComposerFooter`                          | `ComposerFooter`                                     | `apps/chat/src/components/chat/composer-footer.tsx`                                                            | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]`                         |
| Toasts and debug overlay                 | Global overlays outside region flow       | `ToastStack`, `DebugPanel`                           | `apps/chat/src/components/debug-panel.tsx` and app-level toast host                                            | `docs/specs/210-app-chat/design.md`                                                        |

### Canonical Component Table

| Region                    | Component                   | Durable Behavior Owner                                             |
| ------------------------- | --------------------------- | ------------------------------------------------------------------ |
| Route shell               | `views/chat.tsx`            | This spec [DES-ARCH]; parent app shell in `210-app-chat`.          |
| Chat root                 | `ChatWindow`                | This spec.                                                         |
| Top bar                   | `ChatTopBar`                | This spec for placement; app/composer specs for behavior details.  |
| Conversation pane         | `ConversationPane`          | This spec for boundary; `212-app-chat-messages` for behavior.      |
| Conversation timeline     | `ConversationTimeline`      | `212-app-chat-messages`.                                           |
| Conversation empty states | `ConversationEmptyStates`   | `212-app-chat-messages`.                                           |
| Scroll affordance         | `ConversationScrollButton`  | This spec + `212-app-chat-messages`.                               |
| Composer dock             | `ComposerDock`              | This spec for layout; `211-app-chat-composer` for behavior.        |
| Composer activity bar     | `ComposerActivityBar`       | `211-app-chat-composer`.                                           |
| Composer panel stack      | `ComposerPanelStack`        | This spec for registry; `211-app-chat-composer` for panel content. |
| Composer panel chrome     | `ComposerPanel`             | This spec.                                                         |
| Attachment tray           | `ComposerAttachmentTray`    | This spec for reserved boundary; behavior follow-on.               |
| Composer input            | `ComposerInput`             | `211-app-chat-composer`.                                           |
| Composer toolbar          | `ComposerToolbar`           | `211-app-chat-composer`.                                           |
| Composer actions          | `ComposerActions`           | `211-app-chat-composer`.                                           |
| Composer footer           | `ComposerFooter`            | `211-app-chat-composer`.                                           |
| History reserved slots    | `ChatHistory*` placeholders | This spec reserves names; `213-app-chat-history` owns behavior.    |

---

## [DES-DATA] Data Model

### Internal Flags

```typescript
interface ChatWindowFlags {
  topBar: boolean;
  conversationPane: boolean;
  composerDock: boolean;
  composerActivityBar: boolean;
  composerAttachmentTray: boolean;
  composerPanelStack: boolean;
  slashCommandPopover: boolean;
  fileMentionPopover: boolean;
  composerFooterUsageStats: boolean;
  chatHistory: boolean;
}
```

Flags are internal/test-only composition gates. The obsolete `useNewShell` shadow-rollout flag was removed after the old inline shell was eliminated; route rollback is now git/release revert. Panel contents are not flags; they are config.

### Composer Panel Registry

```typescript
type ComposerPanelZone = "context" | "workflow" | "feedback" | "debug";

interface ComposerPanelDefinition<P = unknown> {
  id: string;
  zone: ComposerPanelZone;
  title: string;
  before?: string;
  after?: string;
  visible: boolean;
  collapsible?: boolean;
  dismissible?: boolean;
  component: React.ComponentType<P>;
  props?: P;
}

interface ComposerPanelStackConfig {
  panels: ComposerPanelDefinition[];
  defaultZoneOrder?: ComposerPanelZone[];
}
```

Use `component`, not `render`, so React keys, memoization, error boundaries, and panel-local lifecycle work normally.

#### Panel Registry Implementation Status

| Layer                        | Owns                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ComposerPanelStack`         | `config?: ComposerPanelStackConfig`, ordering, collapse state, dismiss state, and per-panel isolation.  |
| `chat-controller.tsx`        | `ComposerPanelDefinition` entries for modified files, queue, blocked command, doc actions, and notices. |
| Panel body components        | Body-only content such as file pills, queue rows, blocked-command details, or notice copy.              |
| `ComposerPanel` chrome       | Title, count, tone, collapse, dismiss, header actions, and error boundary.                              |
| Feature-owned notice entries | Domain-specific ids such as `afx-command-suggest`; generic body comes from the composer spec.           |

#### Composer Panel Affordances

| Panel ID              | Collapse | Dismiss | Header Action    | Contract                                                                  |
| --------------------- | -------- | ------- | ---------------- | ------------------------------------------------------------------------- |
| `modified-files`      | Yes      | Yes     | None             | User can collapse or dismiss modified-file context for the active turn.   |
| `queue`               | Yes      | No      | `Clear all`      | Row-level dismiss removes individual queued items; no panel-level close.  |
| `blocked-command`     | No       | Yes     | `Switch to Code` | Security warning remains expanded until dismissed or restored to draft.   |
| `doc-actions`         | Yes      | Yes     | None             | Non-blocking document workflow actions can be collapsed or dismissed.     |
| `notice:*`            | Varies   | Varies  | Varies           | Reusable shell for tips, information, alerts, news, and success messages. |
| `afx-command-suggest` | No       | Yes     | `Switch to Spec` | Completion prompt uses the generic notice shell.                          |

### Attachment Boundary

| Boundary                 | Current contract                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `ComposerAttachmentTray` | Reserved chip/previews region for selected file/image attachments.                        |
| Toolbar callback         | Optional extension point only; `ChatWindow` omits it until picker/upload behavior exists. |
| Production UI            | No paperclip is rendered while the callback is absent.                                    |

```typescript
interface ComposerAttachmentItem {
  id: string;
  kind: "file" | "image";
  name: string;
  path?: string;
  mimeType?: string;
  previewUrl?: string;
}
```

---

## [DES-HISTORY] Reserved History Slots

This refactor reserves, but does not implement, history load/export surfaces:

| Reserved Name             | Slot                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `ChatHistoryPanel`        | Future `ComposerPanelStack` panel with `id: "history"`, zone `context`.              |
| `ChatHistoryLoadAction`   | Future ordered `ChatTopBar` action.                                                  |
| `ChatHistoryExportAction` | Future ordered `ChatTopBar` action.                                                  |
| `ChatHistoryStore`        | Controller-owned TypeScript interface/adapter slot.                                  |
| `ChatHistorySession`      | Future serialized session type; schema deferred to `213-app-chat-history` follow-on. |

Storage-tier decision reserved here: active session state uses VS Code `globalState`; explicit export writes to a user-selected file via save dialog. Format and reload semantics remain follow-on work owned by the history spec.

---

## [DES-PERF] Performance Strategy

Capture baseline and compare after extraction. In this implementation, the old inline shell was removed before a stored pre-move capture existed, so the fleet artifact records the earliest reliable retrospective baseline plus post-refactor gate results. Required scenarios:

| Scenario              | Trigger                       | Target                                                         |
| --------------------- | ----------------------------- | -------------------------------------------------------------- |
| Timeline render small | 20-event hydrated transcript  | No regression vs baseline.                                     |
| Timeline render large | 500-event hydrated transcript | No regression vs baseline.                                     |
| Timeline streaming    | 100 assistant tokens          | No regression vs baseline.                                     |
| Composer keystroke    | Type 200 chars                | No regression vs baseline.                                     |
| Panel-stack churn     | Mount/dismiss five panels     | Establish new baseline.                                        |
| Footer usage updates  | 30 usage updates over 10s     | Footer updates do not commit the timeline.                     |
| Coding-chat benchmark | DebugPanel `coding-benchmark` | Hydration, composer typing, DOM, and heap stay within budgets. |

Memoization targets: `ChatTopBar`, `ConversationTimeline`, timeline rows, `ConversationEmptyStates`, `ConversationScrollButton`, `ComposerActivityBar`, `ComposerPanel`, `ComposerPanelStack`, `ComposerToolbar`, `ComposerActions`, and `ComposerFooter`. Do not memoize the controlled `ComposerInput` by default.

The practical e2e baseline is implemented in `apps/chat/e2e/chat-window-benchmark.spec.ts` and
recorded in `docs/specs/216-app-chat-window-componentization/performance-baseline.json`.
It uses a deterministic mock `coding-benchmark` transcript with long markdown, code blocks, tool
summaries, compaction context, composer typing, DOM-node sampling, and Chromium CDP heap sampling.

---

## [DES-A11Y] Accessibility

| Region                   | Role / Attribute                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `ChatWindow`             | `<main role="main">` or `<section aria-label="Chat">`                                        |
| `ChatTopBar`             | `role="toolbar" aria-label="Chat actions"`                                                   |
| `ConversationTimeline`   | `role="log" aria-live="polite" aria-relevant="additions"`                                    |
| `ComposerDock`           | `role="region" aria-label="Composer"`; input uses `role="form" aria-label="Compose message"` |
| `ComposerPanel`          | `role="region" aria-labelledby={titleId}`                                                    |
| `ComposerInput` textarea | labelled, multiline, described by footer hint                                                |
| Popovers                 | `role="listbox"` with `aria-activedescendant`                                                |
| Scroll button            | `aria-label="Scroll to latest"`                                                              |

Focus rules: panel mount does not steal focus; panel dismiss returns focus to the composer only when focus was inside the panel; popovers keep focus on the textarea; new/restart returns focus to the composer after state settles.

---

## [DES-API] API Contracts

```typescript
export interface ChatWindowProps extends ChatProps {
  flags?: Partial<ChatWindowFlags>;
}

export function ChatWindow(props: ChatWindowProps): JSX.Element;
```

```typescript
// apps/chat/src/views/chat.tsx
export default function Chat(props: ChatProps) {
  return <ChatWindow {...props} />;
}
```

---

## [DES-FILES] File Structure And Durable `@see` Map

| File                                                           | Purpose                             | Durable `@see`                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/chat/src/views/chat.tsx`                                 | Route shell                         | `docs/specs/216-app-chat-window-componentization/design.md [DES-API]`                                              |
| `apps/chat/src/components/chat/chat-window.tsx`                | Visual composition root             | `docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-UI]`                                    |
| `apps/chat/src/components/chat/chat-controller.tsx`            | State owner and bridge adapter      | `docs/specs/216-app-chat-window-componentization/design.md [DES-STATE]`                                            |
| `apps/chat/src/components/chat/chat.types.ts`                  | Shared flags/types/slices           | `docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-STATE]`                                 |
| `apps/chat/src/components/chat/chat-top-bar.tsx`               | Top action row                      | `docs/specs/216-app-chat-window-componentization/design.md [DES-UI]`                                               |
| `apps/chat/src/components/chat/conversation-pane.tsx`          | Conversation viewport/state routing | `docs/specs/216-app-chat-window-componentization/design.md [DES-UI]`; `docs/specs/212-app-chat-messages/design.md` |
| `apps/chat/src/components/chat/conversation-timeline.tsx`      | Timeline adapter and rows           | `docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]`                                             |
| `apps/chat/src/components/chat/conversation-empty-states.tsx`  | Loading/welcome states              | `docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]`                                           |
| `apps/chat/src/components/chat/conversation-scroll-button.tsx` | Jump-to-latest affordance           | `docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-A11Y]`                                    |
| `apps/chat/src/components/chat/composer-dock.tsx`              | Bottom composer region              | `docs/specs/216-app-chat-window-componentization/design.md [DES-UI]`; `docs/specs/211-app-chat-composer/design.md` |
| `apps/chat/src/components/chat/composer-activity-bar.tsx`      | Runtime/thinking/shell activity     | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]`                                                 |
| `apps/chat/src/components/chat/composer-panel-stack.tsx`       | Ordered panels                      | `docs/specs/216-app-chat-window-componentization/design.md [DES-DATA]`                                             |
| `apps/chat/src/components/chat/composer-panel.tsx`             | Panel chrome/error boundary         | `docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-A11Y]`                                  |
| `apps/chat/src/components/chat/composer-panels.tsx`            | Composer panel bodies and actions   | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]`                                        |
| `apps/chat/src/components/chat/composer-attachment-tray.tsx`   | Attachment chips/previews           | `docs/specs/216-app-chat-window-componentization/design.md [DES-DATA]`                                             |
| `apps/chat/src/components/chat/composer-input.tsx`             | Textarea and popover anchors        | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS]`                                                   |
| `apps/chat/src/components/chat/composer-toolbar.tsx`           | Mention/model/mode/file controls    | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]`                                                |
| `apps/chat/src/components/chat/composer-actions.tsx`           | Send/follow-up/steer/stop actions   | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]`                                                   |
| `apps/chat/src/components/chat/composer-footer.tsx`            | Runtime/usage/hint footer           | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]`                                                 |
| `apps/chat/src/components/chat/chat-history-slots.tsx`         | Reserved history load/export slots  | `docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY]`                                          |
| `apps/chat/e2e/chat-window-benchmark.spec.ts`                  | Practical perf/memory e2e baseline  | `docs/specs/216-app-chat-window-componentization/design.md [DES-PERF] [DES-TEST]`                                  |

---

## [DES-TEST] Testing Strategy

Validation commands from `afx-vscode/`:

```bash
pnpm --filter apps/chat check-types
pnpm --filter apps/chat test
pnpm --filter apps/chat exec playwright test
pnpm run build:chat
pnpm run check:lint
pnpm run check:format
pnpm run check:md
```

Required focused tests after implementation:

1. `chat-controller.test.tsx` for ownership rules, action stability, and slice memoization.
2. `chat-window.test.tsx` for composition, internal flag gating, and reserved slots.
3. `conversation-timeline.test.tsx` for timeline rendering and render-count protection.
4. `conversation-empty-states.test.tsx` for each loading/welcome state.
5. `composer-panel-stack.test.tsx` for ordering, collapse/dismiss lifecycle, and panel error isolation.
6. `composer-input.test.tsx` for popover anchoring, prompt history, and IME guards.
7. `chat-window.route-contract.test.tsx` for route shell default export compatibility.
8. `apps/chat/e2e/chat-window-benchmark.spec.ts` for long coding-chat responsiveness and memory budgets.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Update/scan durable specs: `210`, `211`, `212`, `213`, and this `216` spec.
2. Capture or reconstruct the performance baseline and record any missing pre-move data explicitly.
3. Create `chat-controller.tsx` and bridge wrapper first.
4. Create `ChatWindow` as the route-owned componentization root.
5. Extract leaf regions: `ChatTopBar`, `ComposerActivityBar`, `ComposerFooter`, `ConversationScrollButton`.
6. Extract conversation regions: `ConversationPane`, `ConversationTimeline`, `ConversationEmptyStates`.
7. Extract composer regions: `ComposerDock`, `ComposerPanelStack`, `ComposerPanel`, `ComposerAttachmentTray`, `ComposerInput`, `ComposerToolbar`, `ComposerActions`.
8. Capture post-refactor performance snapshot and run render-count tests.
9. Run a11y sweep against [DES-A11Y].
10. Remove obsolete rollout flags once the old inline shell is gone and validation gates pass.
11. Use git/release revert as rollback if post-merge regressions appear.

### [DES-ROLLOUT-ROLLBACK] Rollback Plan

If extraction regresses behavior or performance after the old inline shell has been removed, roll back by reverting the componentization change set. The old `useNewShell` branch is no longer retained in source.

---

## [DES-TRACE] Traceability Rules

- Source-code `@see` comments must not point to `docs/specs/900-fleet/**`.
- Refactor/component boundary code points to this spec.
- Composer behavior points to `211-app-chat-composer`.
- Message/timeline behavior points to `212-app-chat-messages`.
- History behavior points to `213-app-chat-history`.
- App shell/transport/bootstrap behavior points to `210-app-chat`.

---

## [DES-QUESTIONS] Open Technical Questions

None blocking for the structural refactor. History format/reload semantics are deferred to a future history persistence pass.
