---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.4"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-24T03:51:51.000Z"
tags: ["app", "vscode", "editor-actions", "commands"]
spec: spec.md
---

# App VSCode Editor Actions - Technical Design

---

## [DES-OVR] Overview

The editor actions zone connects VSCode manifest contribution points to runtime command handlers and code action providers.

---

## [DES-ARCH] Architecture

```text
apps/vscode/package.json menus
        │
        ▼
command registration in extension host
        │
        ▼
editor/code-action provider dispatch
        │
        ├─ chat send/context
        ├─ notes append
        └─ spec helper commands
```

### Flow Map

```text
[EditorActions.Flow]
VSCode editor selection
  -> apps/vscode/package.json command + menu contribution
  -> createAfxCodeActionProvider ACTIONS registry
  -> getEditorContext()
  -> dispatch: note | draft | send
  -> notes workspace file | chat composer | AgentManager.send
```

---

## [DES-UI] User Interface & UX

Actions should appear only when relevant, use concise titles, and avoid overwhelming the editor menu. Related actions should be grouped consistently across context menu and editor title surfaces.

### Surface Map

```text
[EditorActions.Menu]
+------------------------------------------------------------------+
| VSCode editor/context                                             |
|   -> [EditorActions.Submenu] AgenticFlowX                         |
+------------------------------------------------------------------+
| VSCode editor/title                                               |
|   -> [EditorActions.Submenu] when spec/design/tasks/sprint active |
+------------------------------------------------------------------+
| [EditorActions.Groups]                                            |
|   0_notes: save to notes                                          |
|   1_chat: insert/send/explain/review/improve/tests                |
|   2_trace: add @see link / verify traceability                    |
|   3_spec: validate/review/approve spec                            |
|   4_design: validate/review/approve design                        |
|   5_tasks: code/verify/pick task                                  |
+------------------------------------------------------------------+
```

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                             | Choice              | Rationale                                     |
| --------------- | ---------------------------------------------- | ------------------- | --------------------------------------------- |
| Provider split  | One VSCode host spec, editor action child      | Editor action child | Menu/action changes are frequent and surgical |
| Notes ownership | Editor action spec only, notes spec dependency | Dependency          | Payload/storage behavior belongs to notes     |

---

## [DES-DATA] Data Model

Editor actions operate on VSCode document URI, range/selection, selected text, language id, active sprint/spec context, and command arguments.

---

## [DES-API] API Contracts

VSCode command IDs and code action metadata are the primary API. Commands must remain stable once referenced by `package.json` contribution points.

### [DES-ACTION-REGISTRY] Action Registry

The `ACTIONS` array in `apps/vscode/src/providers/afx-code-actions.ts` is the single source of
truth for AFX editor actions. Each entry declares: command id, title, optional `when` predicate
(language, file kind, sprint section), and a handler that builds a chat prompt or invokes a host
service.

Adding an action requires three coordinated edits:

1. New row in this `ACTIONS` array.
2. Matching `command` and submenu entry in `apps/vscode/package.json` (`contributes.commands` + `contributes.menus.afx.editorContext`).
3. Matching row in `200-app-vscode/design.md [DES-COMMAND-CATALOG]` and a new `[DES-ACTION-X]` section here.

### [DES-ACTIONS-MOCKUP-CONTEXT-MENU] Editor Right-Click Menu

```text
[user right-clicks selection]
+----------------------------------+
| Cut                              |
| Copy                             |
| Paste                            |
+----------------------------------+
| AFX                          >   |
+----------------------------------+
   |
   v
   +-----------------------------------+
   | Save to Notes        Cmd+Shift+N  |   <- 0_notes group
   +-----------------------------------+
   | Insert into Composer              |   <- 1_chat group
   | Send Selection                    |
   | Explain                           |
   | Review                            |
   | Improve            (non-markdown) |
   | Generate Tests     (non-markdown) |
   +-----------------------------------+
   | Add @see Link      (non-markdown) |   <- 2_trace group
   | Verify Traceability               |
   +-----------------------------------+
   | Spec - Refine             (spec)  |   <- 3_spec group (sprint+SPEC or spec.md)
   | Spec - Validate           (spec)  |
   | Spec - Review             (spec)  |
   | Spec - Approve            (spec)  |
   +-----------------------------------+
   | Design - Refine          (design) |   <- 4_design group
   | Design - Validate        (design) |
   | Design - Review          (design) |
   | Design - Approve         (design) |
   +-----------------------------------+
   | Task - Code              (tasks)  |   <- 5_tasks group
   | Task - Verify            (tasks)  |
   | Task - Pick Next         (tasks)  |
   | Task - Status            (tasks)  |
   | Task - Brief             (tasks)  |
   +-----------------------------------+
   | Journal - Recap         (journal) |   <- 6_journal group
   | Journal - Promote       (journal) |
   +-----------------------------------+
   | ADR - Review                (adr) |   <- 7_adr group
   | ADR - List                  (adr) |
   | ADR - Supersede             (adr) |
   | ADR - Accept                (adr) |
   +-----------------------------------+
   | Research - Finalize    (research)|
   +-----------------------------------+
```

Group separators are visible because each group prefix changes (`0_notes`, `1_chat`, `2_trace`,
`3_spec`, `4_design`, `5_tasks`, `6_journal`, `7_adr`, `8_research`).

### Per-action contracts

| DES anchor                     | Command                                                                         | Behavior summary                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `[DES-ACTION-SAVE-TO-NOTES]`   | `afx.action.saveToNotes`                                                        | Format selection + file context, append to `.afx/notes.md` via notes-utils            |
| `[DES-ACTION-ADD-TO-CONTEXT]`  | `afx.action.addToContext`                                                       | Send `chat/draftAppend` with formatted selection                                      |
| `[DES-ACTION-SEND-SELECTION]`  | `afx.action.sendSelection`                                                      | Send `chat/send` with formatted selection                                             |
| `[DES-ACTION-EXPLAIN]`         | `afx.action.explain`                                                            | Build "/explain" prompt from selection                                                |
| `[DES-ACTION-REVIEW]`          | `afx.action.review`                                                             | Build "/review" prompt from selection                                                 |
| `[DES-ACTION-IMPROVE-CODE]`    | `afx.action.improveCode`                                                        | Build "/improve" prompt; non-markdown only                                            |
| `[DES-ACTION-GENERATE-TESTS]`  | `afx.action.generateTests`                                                      | Build "/test" prompt; non-markdown only                                               |
| `[DES-ACTION-ADD-SEE-LINK]`    | `afx.action.addSeeLink`                                                         | Insert `@see docs/specs/...` JSDoc above active symbol; routes to 203 resolver        |
| `[DES-ACTION-VERIFY-TRACE]`    | `afx.action.verifyTrace`                                                        | Run `/afx-check trace` against active file                                            |
| `[DES-ACTION-SPEC-VALIDATE]`   | `afx.action.specRefine` / `specValidate` / `specReview` / `specApprove`         | Spec lifecycle commands; refine is draft-first, deterministic checks send immediately |
| `[DES-ACTION-DESIGN-VALIDATE]` | `afx.action.designRefine` / `designValidate` / `designReview` / `designApprove` | Design counterparts                                                                   |
| `[DES-ACTION-TASK-CODE]`       | `afx.action.taskCode` / `taskVerify` / `taskPick` / `taskStatus` / `taskBrief`  | Task lifecycle commands; brief is draft-first                                         |
| `[DES-ACTION-JOURNAL]`         | `afx.action.journalRecap` / `journalPromote`                                    | Session memory commands for `journal.md`                                              |
| `[DES-ACTION-ADR]`             | `afx.action.adrReview` / `adrList` / `adrSupersede` / `adrAccept`               | ADR lifecycle commands; mutating commands remain draft-first                          |
| `[DES-ACTION-RESEARCH]`        | `afx.action.researchFinalize`                                                   | Draft a research finalization command                                                 |

### [DES-ACTION-PREVIEW-PANEL] Open in AFX Preview Panel

| Concern        | Contract                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Owner          | `apps/vscode/src/panels/afx-preview-panel.ts` `openAfxPreview(deps, targetUri?)`                 |
| View type      | `afxPreview` editor-area webview                                                                 |
| Placement      | `ViewColumn.Beside`, `preserveFocus: true`                                                       |
| Bundle         | Workbench webview bundle, booted with `data-afx-view="preview"`                                  |
| Scope          | Markdown files; AFX frontmatter renders full `DocumentStudio`, generic markdown uses fallback UI |
| State model    | One panel per `uri.toString()`; same URI reveals/reuses, different URI opens another panel       |
| Content source | `TextDocument.getText()` from the in-memory editor buffer                                        |
| Refresh        | Debounced live-on-type push per URI                                                              |

#### Panel lifecycle

1. Resolve target URI from command argument, or active editor.
2. If no URI exists, show a non-blocking warning.
3. If a panel exists for `uri.toString()`, reveal it beside the source and push fresh content.
4. Otherwise create `AFX Preview — <basename>` with:
   - `enableScripts: true`
   - `retainContextWhenHidden: true`
   - `localResourceRoots: [workbench dist]`
5. Store `{ panel, uri, post, disposables }` in a module-level registry.
6. On dispose, remove the entry, cancel its debounce timer, and dispose panel-local subscriptions.

#### Host-to-preview messages

| Message                | Trigger                   | Payload / rule                                                               |
| ---------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| `afxAppearanceUpdated` | `afxReady`, config change | Reposts current appearance class for theme parity                            |
| `afxPreviewShow`       | `afxReady`, text change   | `{ filePath, content, isAfxHint }`; `filePath` is workspace-relative         |
| `afxOpenChatCommand`   | Preview toolbar command   | Routes through `openChatCommand(command, mode)` into chat sidebar draft/send |
| Checkbox mutations     | Preview checkbox click    | Toggle helpers apply `WorkspaceEdit` against the same source document        |

#### Shared subscriptions

| Subscription                         | Count | Rule                                                                 |
| ------------------------------------ | ----- | -------------------------------------------------------------------- |
| `workspace.onDidChangeTextDocument`  | 1     | Lookup by URI key; debounce and push only the matching preview panel |
| `workspace.onDidChangeConfiguration` | 1     | Broadcast `afxAppearanceUpdated` to all open preview panels          |

Register shared subscriptions lazily on first preview open. Dispose them when the panel registry is
empty.

#### Cross-surface callers

| Caller                  | Message / command                                      | Host behavior                                               |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Editor title            | `afx.openAfxPreview(uri?)`                             | Opens/reveals target markdown preview                       |
| AFX editor submenu      | `afx.openAfxPreview(uri?)`                             | Same helper                                                 |
| Workbench document UI   | `afxOpenFile { path, mode: "afxPreview" }`             | `workbench-panel.ts` resolves path, calls `openAfxPreview`  |
| Chat composer panel UI  | `chat/openFile { path, mode: "afxPreview" }`           | `sidebar-panel.ts` resolves path, calls injected preview fn |
| Native markdown preview | `afxOpenFile { path, mode: "preview" }` workbench only | Unchanged: opens VS Code's native markdown preview          |

### [DES-ACTION-PREVIEW-ENTRYPOINTS] Open in AFX Preview Entry Points

| Entry point                  | Owner / route                                                                 | UX rule                                              |
| ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Markdown editor title action | `apps/vscode/package.json` `menus.editor/title` → `afx.openAfxPreview`        | Small native icon; visible only for markdown editors |
| AFX editor submenu           | `menus.afx.editorContext` first item → `afx.openAfxPreview`                   | First item above Workbench and chat/editor actions   |
| Chat composer header action  | `chat/openFile { path, mode: "afxPreview" }` → `sidebar-panel.openAfxPreview` | Flat Preview action owned by `211-app-chat-composer` |

The retired top-of-file CodeLens is intentionally not registered. Preview access should be native
or header-adjacent, not a line-1 marker inside the document. A bottom status-bar CTA is also out of
scope because it competes with the composer/workbench chrome.

---

## [DES-FILES] File Structure

| File                                            | Purpose                                     |
| ----------------------------------------------- | ------------------------------------------- |
| `apps/vscode/package.json`                      | VSCode menu/command contribution manifest   |
| `apps/vscode/src/providers/afx-code-actions.ts` | Code action provider and action definitions |
| `apps/vscode/src/panels/afx-preview-panel.ts`   | Editor-area AFX Preview panel lifecycle     |
| `apps/vscode/src/extension.ts`                  | Provider/command registration               |
| `apps/vscode/src/services/sprint-context.ts`    | Context keys that affect editor actions     |

---

## [DES-DEPS] Dependencies

`200-app-vscode`, `100-package-shared`, `203-app-vscode-see-navigation`, and `215-app-chat-notes`.

---

## [DES-SEC] Security Considerations

Editor actions must not silently send unrelated file content. Selection/context payloads should be intentional and bounded.

---

## [DES-ERR] Error Handling

| Scenario                   | Handling                                                        |
| -------------------------- | --------------------------------------------------------------- |
| No active editor/selection | Command exits with a clear notification or no-op                |
| Missing runtime/context    | Command routes to configuration/readiness flow where applicable |

---

## [DES-TEST] Testing Strategy

Test code-action creation, command argument mapping, and manifest/action consistency when editor actions change.

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget editor-action source refs after this spec exists. Future menu/action work starts here before touching manifest or providers.

### Rollback Plan

Route files back to `200-app-vscode` only if this child spec is too narrow.

---

## File Reference Map

| Task | File                                            | Required @see                                |
| ---- | ----------------------------------------------- | -------------------------------------------- |
| 1.x  | `apps/vscode/package.json`                      | inline or manifest trace to `spec.md [FR-1]` |
| 1.x  | `apps/vscode/src/providers/afx-code-actions.ts` | `design.md [DES-API]`                        |
| 1.x  | `apps/vscode/src/services/sprint-context.ts`    | `design.md [DES-DATA]`                       |

## Code Locator Map

| Map ID                        | Code anchor                                                                    | Messages/settings/commands                                   | Tests                                                |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| `[EditorActions.Menu]`        | `apps/vscode/package.json` `contributes.commands`, `menus`                     | `afx.action.*`, `editor/context`, `editor/title`             | `apps/vscode-e2e/src/extension.test.ts`              |
| `[EditorActions.Submenu]`     | `package.json` `afx.editorContext` submenu                                     | `afx.editorContext`                                          | manifest/e2e registration tests                      |
| `[EditorActions.Groups]`      | `package.json` `0_notes`, `1_chat`, `2_trace`, `3_spec`, `4_design`, `5_tasks` | group order and `when` clauses                               | manifest/e2e registration tests                      |
| `[EditorActions.Registry]`    | `apps/vscode/src/providers/afx-code-actions.ts` `ACTIONS`                      | command ids, menu titles, action scopes                      | `apps/vscode/src/providers/afx-code-actions.test.ts` |
| `[EditorActions.Dispatch]`    | `createAfxCodeActionProvider`, `AfxCodeActionDispatch`                         | `saveNote`, `appendDraft`, `sendPrompt`, `AgentManager.send` | `afx-code-actions.test.ts`                           |
| `[EditorActions.ContextKeys]` | `apps/vscode/src/services/sprint-context.ts`                                   | `afx.isSprint`, `afx.sprintSection`                          | `sprint-context.test.ts`                             |

---

## Open Technical Questions

None.
