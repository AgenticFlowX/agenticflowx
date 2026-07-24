---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:42:33.000Z"
tags:
  [
    "app",
    "workbench",
    "notes",
    "capture",
    "markdown",
    "realtime",
    "revisions",
    "acknowledged-mutations",
    "multi-root",
    "responsive",
  ]
spec: spec.md
---

# App Workbench Notes - Technical Design

---

## [DES-OVR] Overview

The Notes tab is a quick-capture and timeline surface over one explicitly
identified `.afx/notes.md` source. It owns capture/edit drafts, filtering,
responsive presentation, deterministic time labels, and request/result UI. The
VS Code host owns source discovery, open-buffer overlays, canonical note
identity, lossless Markdown range mutations, revision checks, per-file
serialization, and durable writes.

Capture text and edit state are recoverable data. They clear only when the host
acknowledges the matching request; sending a message is never shown as save
success.

<!-- @see spec.md [FR-1] [FR-6] [FR-10] [FR-11] [FR-12] [FR-13] [NFR-5] -->

---

## [DES-ARCH] Architecture

```text
VS Code host
  WorkbenchFileState
    ├─ discovers each workspace/nested .afx/notes.md
    ├─ prefers open TextDocument content over disk
    └─ emits source identity + revision + editorDirty
  NotesMarkdownDocument
    ├─ canonical + legacy note block spans
    └─ lossless append/edit/delete/checkbox patch
  WorkbenchMutationCoordinator (FIFO per notes URI)
      │ afxUpdate / afxMutationResult
      v
WorkbenchProvider notesSources[] + active source
      v
Notes
  ├─ source selector + responsive Capture/Timeline shell
  ├─ capture draft -> revisioned notes mutation
  ├─ filters -> DateSection[] -> NoteItem[]
  └─ pending/error/conflict reconciliation
```

Notes, Chat save-note, Canvas promotion, and note checkbox actions all enter the
same host mutation coordinator. The displayed source identity is passed through
every operation; no handler falls back to the first workspace root.

<!-- @see spec.md [FR-6] [FR-10] [FR-11] [FR-12] [FR-13] [NFR-1] [NFR-5] -->

---

## [DES-UI] User Interface & UX

### [DES-NOTES-MOCKUP] Notes ASCII

```text
┌──────────────────────── Capture ───────────────────────┬──────────────────────── notes.md timeline ───────────────────────┐
│ .afx/notes.md                                           │ [timeline] 12/18  [search notes........] [All][Today][Week][Month] │
│                                                         │ [Open in editor] [Open in preview]                                  │
│ ┌─────────────────────────────────────────────────────┐ │                                                                    │
│ │ Quick note…                                         │ │ Today                                      May 3, 2026        3   │
│ │ Enter to save, Shift+Enter for newline              │ │  ├─ 1:14:15 PM · today                                           │
│ │ Markdown supported                                  │ │  │  Markdown rendered note body                                   │
│ └─────────────────────────────────────────────────────┘ │  │  [hover/focus: edit] [delete]                                  │
│ [Save]                                                  │  └─ 11:02:08 AM · today                                          │
│                                                         │ Yesterday                                  May 2, 2026        4   │
│ 18 notes · 5 days                                      │  └─ timestamped notes grouped newest-first                       │
└─────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘
```

### [DES-NOTES-CAPTURE] Capture Pane

<!-- @see spec.md [FR-1] [FR-2] [NFR-2] -->

`Notes` owns the left `ResizablePanel`, textarea focus affordance, Enter vs
Shift+Enter policy, disabled save button, footer counts, and outbound
revisioned append mutation. The draft remains in place with a visible pending
state until the matching success. Error/conflict retains the text and exposes
Retry; a second Enter cannot duplicate an in-flight request.

### [DES-NOTES-FILTERS] Timeline Filters

The timeline toolbar owns search, date filter buttons, visible count, and
`OpenActions`. Filtering combines text match with date windows from
`getDateRange`.

### [DES-NOTES-TIMELINE] Grouped Timeline

`DateSection` renders sticky headers and note lists. `groupByDate` sorts groups
newest-first and sorts notes inside each date by parsed timestamp descending.
React keys use canonical note IDs rather than timestamp strings.

### [DES-NOTES-ITEM] Note Item Editing

`NoteItem` renders markdown content, hover/focus edit/delete actions, edit mode,
Cmd/Ctrl+Enter save, and Escape cancel. Saved notes use a quiet paper-like card
edge and a narrow brand accent so the timeline feels like a stack of readable
captures rather than flat log output. Edit and delete send the exact item
identity plus its source revision. Markdown checkbox interactions use the same
note identity and a checkbox fingerprint; they do not use a global line-only
toggle.

### [DES-NOTES-TIME] Note Time Formatting

<!-- @see spec.md [FR-7] [NFR-3] -->

`humanizeTimestamp`, `relativeTimestamp`, `formatClock`, `parseDate`, and
`startOfDay` produce deterministic display labels and safe fallbacks.

### [DES-NOTES-EMPTY] Fleeting Notes Empty Guide

<!-- @see spec.md [FR-8] [FR-9] -->

`NotesEmptyGuide` replaces the generic empty state in the timeline pane. It uses
a compact right-pane layout so the capture pane and empty guide can coexist in a
constrained bottom panel: source chips plus a short mock note stream teach the
final shape without pushing the main controls out of view.

### [DES-NOTES-IDENTITY] Canonical Source And Note Identity

<!-- @see spec.md [FR-10] [FR-12] [NFR-5] -->

The provider exposes `notesSources[]` plus one `activeSource`. A source identity
is `workspaceFolderId + relativePath`; a nested or second-root source never
collapses to `.afx/notes.md` in the first root. When multiple sources exist, the
toolbar shows a compact root/path selector and every capture/edit/delete/
checkbox request targets exactly the displayed source.

If no Notes file exists, the provider returns one creatable `.afx/notes.md`
descriptor per workspace folder. The user chooses the target root before first
capture when more than one is available; single-root workspaces preselect their
only descriptor without inventing an absolute path in the webview.

Within one snapshot, each parsed note receives `date`, full millisecond time,
ordinal among duplicate headings, source span, and a content fingerprint. The
browser receives an opaque `noteId`; the host retains the locator. Since every
mutation also requires the snapshot revision, range drift or duplicate
ambiguity becomes a conflict rather than a wrong-note edit.

### [DES-NOTES-LIVE-SYNC] Manual Edit Realtime Updates

<!-- @see spec.md [FR-11] [NFR-5] [NFR-6] -->

`WorkbenchFileState` prefers `TextDocument.getText()` for open Notes files and
observes change, save, close, filesystem, and workspace-folder events. Clean
Notes UI replaces its snapshot after the shell debounce. Unsaved editor content
is visible immediately with an `Unsaved in editor` indicator; Notes mutations
are disabled until it is saved so visual edits cannot overwrite the buffer.

If a newer source snapshot arrives while capture/edit/delete is pending, the UI
keeps its draft and shows conflict recovery. Scan generations and `requestId`
prevent a late scan or result from rolling back newer content.

### [DES-NOTES-MUTATION] Acknowledged Conflict-Safe Mutations

<!-- @see spec.md [FR-10] [FR-12] [FR-13] [NFR-5] -->

All Notes entry points share a per-canonical-path FIFO coordinator. Existing
source mutations carry `requestId`, canonical target, and `expectedRevision`;
initial file creation targets an explicit workspace folder. Exactly one typed
success/error/conflict result settles each request. Success clears only its own
draft after a confirmed snapshot; error or conflict keeps user text and offers
Retry/Open source/Reload as appropriate.

### [DES-NOTES-RESPONSIVE] Constrained-Width Layout

<!-- @see spec.md [FR-1] [FR-3] [FR-6] [NFR-7] -->

At 720 px and wider Notes remains a resizable split pane. Below 720 px it uses a
compact `Capture | Timeline` segmented control and renders one pane at a time,
preserving the draft, filters, scroll position, and focus intent while switching.
The source selector and primary Save remain visible; date filters and open
actions collapse into bounded menus. At 360 px controls do not depend on hover,
focus rings are not clipped, and dialogs/popovers scroll internally.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                              | Choice                                    | Rationale                                                                         |
| ----------------- | ----------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Save shortcut     | Enter, Cmd/Ctrl+Enter                           | Enter for capture                         | Quick notes remain one-keystroke capture; Shift+Enter preserves multiline input.  |
| Edit shortcut     | Enter, Cmd/Ctrl+Enter                           | Cmd/Ctrl+Enter                            | Avoids accidental multiline edit saves.                                           |
| Rendering         | Plain text, Markdown                            | Markdown                                  | Notes commonly carry lists, code, headings, and checkboxes.                       |
| Record identity   | Timestamp only, full snapshot locator           | Opaque note ID + source + revision        | Duplicate times and multi-root files cannot target the wrong record.              |
| Persistence       | Fire-and-forget messages, acknowledged mutation | Acknowledged revisioned mutation          | Drafts survive failure and stale/dirty sources cannot be overwritten.             |
| Markdown handling | Rebuild sections, source-range patching         | Lossless source-range patching            | Preserves multiline bodies, arbitrary headings, legacy notes, and unrelated text. |
| Narrow layout     | Fixed split, stacked panes, mode switch         | Capture/Timeline mode switch below 720 px | Keeps one usable surface at sidebar width without destroying local state.         |

---

## [DES-DATA] Data Model

<!-- @see spec.md [FR-4] [FR-7] [FR-10] [FR-11] [FR-12] [FR-13] [NFR-5] -->

```typescript
interface WorkbenchSourceIdentity {
  workspaceFolderId: string;
  relativePath: string;
}

interface NotesSourceSnapshot {
  source: WorkbenchSourceIdentity;
  revision: string;
  scanGeneration: number;
  editorDirty: boolean;
  notes: QuickNote[];
}

interface QuickNote {
  id: string; // opaque snapshot-local canonical locator
  timestamp: string;
  date: string;
  time: string;
  displayTime: string;
  text: string;
  checkboxes: Array<{
    fingerprint: string;
    text: string;
    completed: boolean;
  }>;
}
```

The host-only `NotesMarkdownDocument` retains exact source ranges for canonical
`## YYYY-MM-DD` / `### HH:MM:SS.mmm` blocks, legacy inline records, and opaque
unrelated content. `DateGroup` is derived UI state only.

### [DES-NOTES-MARKDOWN] Lossless Notes Markdown Patching

Canonical note blocks are parsed through the next note/day heading while
preserving internal blank lines, headings, fenced code, lists, and comments.
Legacy `- **timestamp** text` records remain readable and individually mutable.
Append inserts into the selected source's current date section without
normalizing other content. Edit replaces only the selected body. Delete removes
only the selected block and removes a date heading only when its proven managed
range contains no remaining notes or unrelated content. No-op round trips are
byte-identical; ambiguous spans fail closed.

---

## [DES-API] API Contracts

<!-- @see spec.md [FR-6] [FR-10] [FR-12] [FR-13] [NFR-5] -->

```typescript
type NotesMutation =
  | { kind: "append"; text: string }
  | { kind: "edit"; noteId: string; text: string }
  | { kind: "delete"; noteId: string }
  | { kind: "toggleCheckbox"; noteId: string; itemFingerprint: string; completed: boolean };

type NotesToHost =
  | {
      type: "afxMutateNotes";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision?: string; // omitted only when creating the source
      mutation: NotesMutation;
    }
  | { type: "afxOpenFile"; path: string; mode: "editor" | "preview" | "afxPreview" };
```

Chat and Canvas promotion may keep surface-specific command names at their UI
boundary, but the host adapts them into this same canonical target + mutation
coordinator before writing. `afxMutationResult` returns exactly one matching
success/error/conflict outcome; success includes confirmed revision and the
authoritative content arrives only through the next `afxUpdate`.

---

## [DES-FILES] File Structure

| File                                              | Purpose                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `apps/workbench/src/views/notes.tsx`              | Source selector, responsive capture/timeline, request UX       |
| `apps/workbench/src/views/notes.test.tsx`         | Realtime, mutation, identity, keyboard, and responsive tests   |
| `apps/vscode/src/services/notes-markdown.ts`      | Host-only lossless parser, stable locators, and range patching |
| `apps/vscode/src/services/notes-markdown.test.ts` | Canonical/legacy/adversarial Markdown fixtures                 |
| `apps/vscode/src/utils/notes-utils.ts`            | Shared host entry point adapted to mutation coordinator        |
| `apps/workbench/src/lib/markdown-render.tsx`      | Shared safe Markdown preview, owned by Documents spec          |
| `packages/shared/src/workbench-types.ts`          | Notes source snapshots, note IDs, checkbox descriptors         |
| `packages/shared/src/workbench-protocol.ts`       | Revisioned Notes mutation/result contracts                     |
| `apps/workbench/src/index.css`                    | Responsive Notes shell and capture/card surface styling        |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for `QuickNote`.
- `@afx/ui` for panes, textarea, input, buttons, empty state, scroll area.
- `222-app-workbench-documents` for `MinimalMarkdown`.
- `227-app-workbench-shell` for live document overlays, latest-wins refreshes,
  multi-root identity, and acknowledged per-path mutations.

No new runtime Markdown parser is required initially. The host range parser is
fixture-driven and refuses an ambiguous destructive patch.

---

## [DES-SEC] Security Considerations

The Notes tab sends structured text mutations against canonical workspace-owned
source identity and never imports VS Code or filesystem APIs. The host rejects
outside-workspace/traversal targets, stale revisions, dirty documents, invalid
note IDs, and ambiguous checkbox fingerprints. Markdown continues through the
existing safe renderer; note content never becomes executable HTML or a host
command.

---

## [DES-ERR] Error Handling

- Empty capture text does not send.
- Empty notes render onboarding empty state.
- Search/date no-match renders a simple no-match message.
- Invalid timestamps display fallback strings.
- A pending request keeps capture/edit text and disables duplicate submission.
- Error retains draft text and exposes Retry plus Open source.
- Conflict retains draft text and exposes Reload confirmed source plus Copy/Open
  draft recovery; there is no force-overwrite shortcut.
- Missing/moved/ambiguous note IDs and checkbox fingerprints fail visibly and do
  not mutate a nearest timestamp match.
- Invalid unsaved Markdown retains the last valid timeline with a source-warning
  state rather than clearing all notes.

---

## [DES-TEST] Testing Strategy

- Parser/unit: byte-identical no-op round trips; canonical and legacy records;
  duplicate times; multiline Markdown; nested headings, lists, code fences, and
  checkboxes; arbitrary preamble/sections/comments; CRLF; safe empty-date
  cleanup; ambiguous/malformed spans; localized append/edit/delete/toggle.
- Component: Enter/Shift+Enter and edit shortcuts, exact source selection,
  request correlation, no duplicate submit, draft retention, stale result
  suppression, clean realtime replacement, dirty-editor state, conflict/retry,
  search/date preservation, and checkbox request identity.
- Responsive/accessibility: splitter at desktop; Capture/Timeline mode below
  720 px; 360 px toolbar/menu reachability; focus restoration; live pending/
  error status; no hover-only action.
- Host: multi-root and nested source routing, notes-only workspace discovery,
  unsaved/saved/external refresh timing, same-path FIFO, revision/dirty/outside
  rejection, and exactly one terminal result.
- E2E/F5: Workbench, Chat, and Canvas appends converge on one selected file;
  manual editor changes appear live; conflict recovery retains the draft.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Land shared source identity/result contracts and the shell live document and
   mutation coordinators while preserving the existing read-only timeline.
2. Extract and prove `NotesMarkdownDocument` with canonical, legacy, malformed,
   and multiline golden fixtures.
3. Add source selection and revisions to snapshots; verify Notes loads without
   a `docs/` directory and from nested/second workspace roots.
4. Route Workbench, Chat, Canvas promotion, and checkbox actions through the
   per-file coordinator; remove timestamp-only mutation and eager draft clearing.
5. Add responsive Capture/Timeline mode and complete keyboard/a11y coverage.
6. Run targeted suites, repository gates, responsive e2e captures, and F5 smoke
   for unsaved editor, external write, conflict, duplicate time, and second root.

---

## [DES-NOTES-VIEW-LOC] Code Locator Map

| Map ID                 | Code anchor                                        | Messages/data                                 | Tests                    |
| ---------------------- | -------------------------------------------------- | --------------------------------------------- | ------------------------ |
| `[NotesView.View]`     | `apps/workbench/src/views/notes.tsx` `Notes`       | `notesSources[]`, active source, result state | notes.test.tsx           |
| `[NotesView.Capture]`  | `Notes` capture pane                               | `afxMutateNotes.append`                       | notes.test.tsx           |
| `[NotesView.Empty]`    | `NotesEmptyGuide`                                  | empty active-source snapshot                  | notes.test.tsx           |
| `[NotesView.Item]`     | `DateSection`, `NoteItem`                          | opaque note ID, edit/delete/toggle mutations  | notes.test.tsx           |
| `[NotesHost.Markdown]` | `apps/vscode/src/services/notes-markdown.ts`       | spans, fingerprints, lossless patch           | notes-markdown.test.ts   |
| `[NotesHost.Live]`     | shell file state + refresh + mutation coordinators | revision, generation, editor-dirty, result    | host panel/service tests |

## [DES-NOTES-VIEW-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                         | Code anchors                               | Verification             |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| FR-1–FR-5   | `[DES-NOTES-CAPTURE]`, `[DES-NOTES-FILTERS]`, `[DES-NOTES-TIMELINE]` | Notes capture/timeline/renderer            | component + e2e          |
| FR-6        | `[DES-NOTES-ITEM]`, `[DES-NOTES-MUTATION]`                           | NoteItem mutation dispatch                 | component + host         |
| FR-7–FR-9   | `[DES-NOTES-TIME]`, `[DES-NOTES-EMPTY]`, `[DES-NOTES-MOCKUP]`        | time helpers, guide, paper-edge styling    | unit + visual            |
| FR-10       | `[DES-NOTES-IDENTITY]`, `[DES-NOTES-MUTATION]`                       | source selector + canonical note IDs       | multi-root + adversarial |
| FR-11       | `[DES-NOTES-LIVE-SYNC]`                                              | open-buffer overlay + reconciliation       | host + component + F5    |
| FR-12       | `[DES-NOTES-MARKDOWN]`                                               | lossless host parser/patcher               | golden fixtures          |
| FR-13       | `[DES-NOTES-MUTATION]`                                               | request/result draft state + per-path FIFO | component + host         |

---

## [DES-REFS] File Reference Map

<!-- @see spec.md [NFR-4] -->

| File                                              | Required @see                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/notes.tsx`              | `spec.md [FR-1] [FR-6] [FR-10] [FR-11] [FR-13]` + `design.md [DES-NOTES-IDENTITY] [DES-NOTES-LIVE-SYNC] [DES-NOTES-MUTATION] [DES-NOTES-RESPONSIVE]` |
| `apps/vscode/src/services/notes-markdown.ts`      | `spec.md [FR-10] [FR-12] [NFR-5]` + `design.md [DES-NOTES-IDENTITY] [DES-NOTES-MARKDOWN]`                                                            |
| `apps/workbench/src/views/notes.test.tsx`         | `spec.md [FR-2] [FR-3] [FR-10] [FR-11] [FR-13] [NFR-7]` + `design.md [DES-TEST] [DES-NOTES-RESPONSIVE]`                                              |
| `apps/vscode/src/services/notes-markdown.test.ts` | `spec.md [FR-12] [NFR-5]` + `design.md [DES-NOTES-MARKDOWN] [DES-TEST]`                                                                              |
| `apps/workbench/src/index.css`                    | `design.md [DES-NOTES-CAPTURE] [DES-NOTES-RESPONSIVE]`                                                                                               |
