---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "chat", "notes"]
spec: spec.md
---

# App Chat Notes - Technical Design

---

## [DES-OVR] Overview

The notes zone owns lightweight capture from chat and editor surfaces into the shared notes flow. It bridges chat webview actions and VSCode editor actions without taking over the workbench notes surface.

---

## [DES-ARCH] Architecture

```text
Chat composer save ─┐
                    ├─ shared note payload / dispatch → VSCode host notes utility → .afx/notes.md
Editor action    ───┘
Workbench append ───┘
```

## [DES-NOTES-FLOW] Cross-Surface Note Capture Flow

```text
[Notes.Chat]
Cmd/Ctrl+Shift+Enter in composer
  -> saveAsNote()
  -> bridgeSend({ type: "chat/saveNote", content })
  -> SidebarPanel dispatch
  -> appendNoteToWorkspace(content)
  -> .afx/notes.md
  -> local note event in chat timeline

[Notes.Editor]
editor selection
  -> AFX code action "Save to Notes"
  -> formatSelection(EditorContext)
  -> dispatch.saveNote(prompt)
  -> appendNoteToWorkspace(prompt)
  -> .afx/notes.md
  -> VSCode information message

[Notes.Workbench]
workbench postMessage afxAppendNote
  -> appendNoteToWorkspace(content)
  -> .afx/notes.md
```

| Flow                 | Source anchor                                     | Boundary                                        | Result                                        |
| -------------------- | ------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| Chat composer note   | `chat.tsx` `saveAsNote`, `onKeyDown`              | Webview sends `chat/saveNote`; host writes file | Local note row plus `.afx/notes.md` append    |
| Editor save-to-notes | `afx-code-actions.ts` `ACTIONS`, dispatch branch  | VSCode extension command dispatch               | `.afx/notes.md` append and info notification  |
| Shared storage       | `notes-utils.ts` `appendNoteToWorkspace`          | VSCode workspace fs                             | First workspace `.afx/notes.md`, newest first |
| Shared protocol      | `packages/shared/src/messages.ts` `chat/saveNote` | Typed webview/host payload                      | Stable chat note bridge contract              |

---

## [DES-UI] User Interface & UX

Note capture should be quick and clearly confirm what was captured. Rich browsing/editing belongs to workbench notes.

## [DES-NOTES-MOCKUPS] ASCII UI Mockups

### [DES-NOTES-MOCKUP-CHAT] Chat Composer Save

```text
+------------------------------------------------------------------+
| [Composer.Input] remember this migration rule                     |
|                                                                  |
| Cmd/Ctrl+Shift+Enter                                             |
|   -> clears draft                                                |
|   -> sends chat/saveNote                                         |
|   -> appends local timeline note row                             |
+------------------------------------------------------------------+
|       / Note                                      14:05           |
|         remember this migration rule                             |
+------------------------------------------------------------------+
```

### [DES-NOTES-MOCKUP-EDITOR] Editor Selection Save

````text
VS Code editor/context menu
+------------------------------------------------------------------+
| AgenticFlowX                                                     |
|   Save to Notes                                                  |
|   Insert into Composer                                           |
|   Send Selection                                                 |
+------------------------------------------------------------------+

Selection payload
relative/path.ts:12-24
```ts
selected text...
```

Host result
.afx/notes.md
  ## 2026-05-03
  ### 14:05:22.123
  relative/path.ts:12-24
  ```ts
  selected text...
  ```
````

### [DES-NOTES-MOCKUP-STORAGE] Notes File Layout

```text
---
afx: true
type: NOTES
---

  ## 2026-05-03

  ### 14:05:22.123
  Newest note text

  ### 13:44:01.004
  Earlier note text

  ## 2026-05-02

  ### 19:21:09.500
  Older note text
```

## [DES-NOTES-CROSS-ZONE-FLOW] Cross-Zone Note Trace

The notes feature has two entry points (chat composer + editor selection), one shared write path
(host notes-utils), and one consumer (workbench notes view). This is the canonical multi-spec
flow; both 211 and 202 own _their_ entry; the _shared_ end lives here.

```text
[211 composer Cmd+Shift+Enter] saveAsNote()    ---+
[202 editor "Save to Notes"] action            ---+--- both -> bridgeSend("chat/saveNote", payload)
                                                                            |
                                                                            v
                                            [201 SidebarPanel dispatchInbound case "chat/saveNote"]
                                                                            |
                                                                            v
                                            [215 + utils notes-utils.appendNoteToWorkspace(payload)]
                                                                            |
                                                                            v
                                              writes .afx/notes.md  -------+
                                                                           |
                                                                           v
                                              file watcher -> 224 NotesView refresh
```

| Hop | Zone                                | Code anchor                                               |
| --- | ----------------------------------- | --------------------------------------------------------- |
| 1a  | `211-app-chat-composer`             | `chat.tsx` `saveAsNote()`                                 |
| 1b  | `202-app-vscode-editor-actions`     | `afx-code-actions.ts` `afx.action.saveToNotes` action     |
| 2   | `110-package-transport` + `100`     | `bridgeSend("chat/saveNote", ...)` (shared payload)       |
| 3   | `201-app-vscode-panels`             | `sidebar-panel.ts` `dispatchInbound case "chat/saveNote"` |
| 4   | `215-app-chat-notes` (here) + utils | `notes-utils.appendNoteToWorkspace`                       |
| 5   | `224-app-workbench-notes`           | `notes.tsx` re-render via file watcher / `afxUpdate`      |

---

## [DES-NOTES-STORAGE] `.afx/notes.md` Storage Semantics

| Behavior             | Source anchor                            | Rule                                                                   |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| First workspace only | `appendNoteToWorkspace`                  | Uses `vscode.workspace.workspaceFolders?.[0]`; no workspace is a no-op |
| Missing file         | `appendNoteToWorkspace` catch branch     | Starts with AFX frontmatter `afx: true`, `type: NOTES`                 |
| Existing frontmatter | `insertNoteAtTop`                        | Preserves frontmatter and inserts notes after it                       |
| Same day             | `insertNoteAtTop`                        | Prepends `### HH:MM:SS.mmm` under existing `## YYYY-MM-DD`             |
| New day              | `insertNoteAtTop`                        | Prepends new day section above older day sections                      |
| Directory creation   | `appendNoteToWorkspace`                  | Creates `.afx/` before writing `notes.md`                              |
| Timestamp            | `formatLocalDate`, `formatLocalNoteTime` | Local date and millisecond timestamp, not UTC frontmatter timestamp    |

---

## [DES-DEC] Key Decisions

| Decision            | Options Considered                           | Choice                   | Rationale                                           |
| ------------------- | -------------------------------------------- | ------------------------ | --------------------------------------------------- |
| Notes route         | Missing fleet plan, chat parent, notes child | Notes child              | Existing source refs need a real owner              |
| Workbench ownership | Same spec, separate workbench child          | Separate workbench child | Capture and browsing/editing are different surfaces |

---

## [DES-DATA] Data Model

Notes payloads include text/content plus optional source metadata such as file, selection, conversation, or event source.

| Data shape                          | Owner                                       | Purpose                                                 |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| `chat/saveNote` payload             | `packages/shared/src/messages.ts`           | Chat webview note content                               |
| `noteEvents` local state            | `apps/chat/src/views/chat.tsx`              | Ephemeral chat timeline confirmation rows               |
| `EditorContext` formatted selection | `afx-code-actions.ts` via `formatSelection` | Path, line range, fenced selected text for editor notes |
| `.afx/notes.md` frontmatter         | `notes-utils.ts`                            | Identifies the notes file as AFX-owned                  |
| Day heading                         | `formatLocalDate`                           | `## YYYY-MM-DD` grouping                                |
| Note timestamp                      | `formatLocalNoteTime`                       | `### HH:MM:SS.mmm` entry heading                        |

---

## [DES-API] API Contracts

The shared bridge message for appending notes must be stable across chat and editor-triggered flows.

| Direction              | Message/action                            | Notes owner                                                     |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| Chat webview to host   | `chat/saveNote`                           | Shared typed payload for composer note capture                  |
| Editor action dispatch | `AfxCodeActionDispatch.saveNote(content)` | Extension-host save function injected into code action provider |
| Workbench to host      | `afxAppendNote`                           | Workbench bridge append path reusing the same storage utility   |
| Host workspace fs      | `appendNoteToWorkspace(text)`             | Canonical write operation for `.afx/notes.md`                   |

---

## [DES-FILES] File Structure

| File                                            | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `apps/chat/src/views/chat.tsx`                  | Chat note event/capture handling |
| `apps/vscode/src/utils/notes-utils.ts`          | Host note append utility         |
| `apps/vscode/src/providers/afx-code-actions.ts` | Editor save-to-notes code action |
| `packages/shared/src/messages.ts`               | Shared note payload contract     |

---

## [DES-DEPS] Dependencies

| Dependency                      | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `100-package-shared`            | Shared note bridge payload                                     |
| `110-package-transport`         | Chat webview bridge                                            |
| `202-app-vscode-editor-actions` | Editor selection save-to-notes action                          |
| `211-app-chat-composer`         | Composer keyboard/save gesture                                 |
| Future workbench notes spec     | Rich browsing/editing surface remains out of this capture spec |

---

## [DES-SEC] Security Considerations

Do not capture secrets or credentials implicitly. Note payloads should preserve useful context without silently adding unrelated content.

---

## [DES-ERR] Error Handling

| Scenario           | Handling                                               |
| ------------------ | ------------------------------------------------------ |
| Note append fails  | Surface a recoverable error/notification               |
| Empty note payload | Do not append; show clear no-op state where applicable |

---

## [DES-TEST] Testing Strategy

| Coverage target                       | Current/Future test anchor                                  |
| ------------------------------------- | ----------------------------------------------------------- |
| Note insertion/newest-first behavior  | `apps/vscode/src/utils/notes-utils.test.ts` when introduced |
| Local date/time format helpers        | `notes-utils.test.ts` when introduced                       |
| Editor save-to-notes dispatch         | `apps/vscode/src/providers/afx-code-actions.test.ts`        |
| Chat save note gesture/local note row | future chat composer/timeline test                          |
| Shared message payload                | shared message/type tests when changed                      |

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget legacy sprint refs to this spec, then update chat/editor notes behavior through this route.

### [DES-NOTES-ROLLOUT-ROLLBACK] Rollback Plan

If notes capture becomes workbench-first, create a workbench notes child and keep this spec for cross-surface capture protocol.

---

## [DES-NOTES-REFS] File Reference Map

| Task | File                                            | Required @see                                          |
| ---- | ----------------------------------------------- | ------------------------------------------------------ |
| 1.x  | `apps/vscode/src/utils/notes-utils.ts`          | `design.md [DES-NOTES-STORAGE] [DES-NOTES-FLOW]`       |
| 1.x  | `apps/vscode/src/providers/afx-code-actions.ts` | `design.md [DES-NOTES-MOCKUP-EDITOR] [DES-NOTES-FLOW]` |
| 1.x  | `apps/chat/src/views/chat.tsx`                  | `design.md [DES-NOTES-MOCKUP-CHAT] [DES-NOTES-FLOW]`   |
| 1.x  | `packages/shared/src/messages.ts`               | `design.md [DES-API]`                                  |

## [DES-NOTES-LOC] Code Locator Map

| Map ID                      | Code anchor                                                                                           | Messages/settings/commands              | Tests                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------- |
| `[DES-NOTES-MOCKUP-CHAT]`   | `chat.tsx` `saveAsNote`, `onKeyDown`, note branch in `Timeline`                                       | `chat/saveNote`, `Cmd/Ctrl+Shift+Enter` | future chat note test      |
| `[DES-NOTES-MOCKUP-EDITOR]` | `afx-code-actions.ts` `ACTIONS` save-to-notes entry and dispatch branch                               | `afx.action.saveToNotes`                | `afx-code-actions.test.ts` |
| `[DES-NOTES-STORAGE]`       | `notes-utils.ts` `insertNoteAtTop`, `formatLocalDate`, `formatLocalNoteTime`, `appendNoteToWorkspace` | workspace fs `.afx/notes.md`            | future notes-utils tests   |
| `[DES-API]`                 | `packages/shared/src/messages.ts` `chat/saveNote`                                                     | shared chat note payload                | shared message/type tests  |

## [DES-NOTES-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                       | Code anchors                                                  | Verification               |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| FR-1        | `DES-NOTES-MOCKUP-CHAT`, `DES-NOTES-FLOW`          | `saveAsNote`, `noteEvents`, chat timeline note branch         | future chat note test      |
| FR-2        | `DES-API`, `DES-NOTES-STORAGE`                     | `chat/saveNote`, `appendNoteToWorkspace`, `insertNoteAtTop`   | future notes-utils test    |
| FR-3        | `DES-NOTES-MOCKUP-EDITOR`, `DES-NOTES-FLOW`        | `ACTIONS` save-to-notes entry, dispatch note branch           | `afx-code-actions.test.ts` |
| FR-4        | `DES-DEC`, `DES-DEPS`                              | Workbench notes browsing/editing explicitly out of scope      | child spec boundary        |
| NFR-1       | `DES-NOTES-MOCKUP-CHAT`, `DES-NOTES-MOCKUP-EDITOR` | no modal path for simple capture                              | future UX tests            |
| NFR-2       | `DES-SEC`, `DES-NOTES-STORAGE`                     | explicit selection/draft text only; no implicit file scraping | code review/manual trace   |

---

## [DES-NOTES-QUESTIONS] Open Technical Questions

None.
