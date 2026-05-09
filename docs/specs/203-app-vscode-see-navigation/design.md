---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "vscode", "see-navigation", "traceability"]
spec: spec.md
---

# App VSCode See Navigation - Technical Design

---

## [DES-OVR] Overview

This zone implements VSCode editor intelligence around AFX `@see` annotations.

---

## [DES-ARCH] Architecture

```text
Source JSDoc @see
      │
      ├─ completion provider
      ├─ document link provider
      ├─ definition/hover providers
      ├─ CodeLens provider
      └─ resolver/cache services
```

### Flow Map

```text
[SeeNavigation.Flow]
source line containing @see docs/specs/... [FR-X] [DES-X]
  -> [SeeNavigation.Context] getSeeContextAt
  -> [SeeNavigation.Resolver] resolveNode/listNodeIds/readPathPreview
  -> provider surface:
       [SeeNavigation.Completion]
       [SeeNavigation.DocumentLink]
       [SeeNavigation.Definition]
       [SeeNavigation.Hover]
       [SeeNavigation.CodeLens]
  -> markdown spec/design/task target line
```

---

## [DES-UI] User Interface & UX

Navigation should feel native to VSCode: completions in comments, clickable links, hovers, definitions, and CodeLens should all lead to the same resolved spec/design target.

### Surface Map

```text
[SeeNavigation.Editor]
+--------------------------------------------------------------+
| Source editor JSDoc/comment line                              |
|   @see docs/specs/203-app-vscode-see-navigation/design.md [...] |
+--------------------------------------------------------------+
| [SeeNavigation.Completion] path + node suggestions while typing |
| [SeeNavigation.DocumentLink] clickable path/bracket links       |
| [SeeNavigation.Definition] Cmd-click/go-to-definition target    |
| [SeeNavigation.Hover] preview of spec path or node excerpt      |
| [SeeNavigation.CodeLens] "Open spec/design" lenses above lines |
+--------------------------------------------------------------+
```

---

## [DES-DEC] Key Decisions

| Decision                  | Options Considered                               | Choice                   | Rationale                                                          |
| ------------------------- | ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------ |
| Split from editor actions | Combined provider spec, separate navigation spec | Separate navigation spec | Traceability intelligence changes independently from command menus |

---

## [DES-DATA] Data Model

The resolver works with spec folder names, markdown file paths, node IDs, and source annotation ranges.

---

## [DES-API] API Contracts

VSCode provider registrations are the API surface: completion, document link, definition, hover, and CodeLens providers.

### [DES-SEE-CONTEXT-EXTRACTION] `getSeeContextAt`

Given a document + position, return the `@see` reference under the cursor (path + node ids +
ranges). Used by hover and definition providers. Implementation: regex-scan the line for
`@see docs/specs/...` plus optional `[FR-X]` / `[NFR-X]` / `[DES-XXX]` / `[X.Y]` brackets.

### [DES-SEE-NODE-ENUMERATION] `listNodeIds`

Given a markdown file, return every addressable node id discovered:

- `FR-X` / `NFR-X` from leading-cell rows of `| FR-1 | … |` requirement tables.
- `DES-XXX` from any heading at any level that contains `DES-` followed by uppercase letters or
  hyphens. **Sub-section headings (`### [DES-SUB]` under `## [DES-PARENT]`) resolve identically
  to top-level headings — heading depth is not significant.**
- `X.Y` from any heading that starts with a phase.task number.

Returns `{ id, kind, detail, line }[]` for completion + CodeLens.

### [DES-SEE-NODE-RESOLUTION] `resolveNode`

Given a markdown file + node id, return `{ line, excerpt, tableHeaders?, tableCells? }` or
`undefined`. Resolution rules:

| Node id pattern  | Resolver behavior                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `FR-X` / `NFR-X` | Match a markdown table row whose first cell equals the id (case-insensitive); return row + headers  |
| `DES-XXX`        | Slug-match against any heading 1..6 (case-insensitive contains); return heading line + body excerpt |
| `X.Y`            | Match any heading that starts with the literal token; return heading line + body excerpt            |

Heading depth (1..6) is intentionally not significant. This makes nested DES nodes work naturally:
`### [DES-APPEARANCE-BRIDGE]` under `## [DES-API]` resolves the same as a top-level heading.

### [DES-SEE-PATH-PREVIEW] `readPathPreview`

For path-only `@see` refs (`@see docs/specs/X/spec.md` with no `[…]` ids), return the first ~40
lines of body text (front matter skipped) to render in hover popups.

### [DES-SEE-TABLE-PARSING] Table Parsing Helpers

`findTableHeaders`, `splitTableRow`, `extractHeadingBlock`, `escapeRegExp` are internal helpers
that keep the resolver's two regex sites consistent.

### [DES-SEE-COMMAND-OPEN-AT-LINE] `OPEN_SPEC_AT_LINE_COMMAND`

The `afx.openSpecAtLine` command (registered in `extension.ts`) accepts `{ path, line }` and opens
the file with the cursor positioned at the target line. Document-link entries dispatch through
this command rather than crafting URI fragments because VSCode doesn't honor a `#L42` fragment in
markdown viewers.

### [DES-SEE-COMMAND-ADD-LINK] `afx.action.addSeeLink` / [DES-SEE-COMMAND-VERIFY] `afx.action.verifyTrace`

Editor commands defined under the AFX submenu (see `202-app-vscode-editor-actions [DES-ACTION-REGISTRY]`).
Their behavior is owned by 202; their resolution semantics are owned here.

### [DES-SEE-MOCKUP-CODELENS] CodeLens Lens Stack

```text
| 1  /**
| 2   * Chat composer view
| 3   *
| 4   * @see docs/specs/211-app-chat-composer/spec.md [FR-1]
| 5   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
| 6   */                              <- these lines drive...
| 7  +---- 1 def  1 ref  Show Impact  <- ...this CodeLens stack
| 8  export function Chat() {
```

Lens placement: above the first non-empty line following the JSDoc block. Multiple `@see` lines
collapse into a single lens row.

### [DES-SEE-RESOLVER-FLOW] Resolver Flow

```text
input: "docs/specs/211-app-chat-composer/spec.md [FR-1]"
    |
    v
parsePath -> { docPath, exists?, type: spec/design/tasks/sprint/research }
    |
    +-- file missing -> { confidence: extracted, status: ghost-file }
    |
    v
parseNodeIds("[FR-1]") -> ["FR-1"]
    |
    v
resolveNode(docPath, "FR-1")
    |
    +-- FR/NFR  -> match table row whose first cell equals id
    +-- DES-X   -> match any heading 1..6 whose slug contains des-x
    +-- X.Y     -> match any heading that starts with the literal token
    |
    +-- no match -> { confidence: extracted, status: ghost-node }
    |
    v
{ docPath, nodeId: "FR-1", line: N, label, excerpt, status: covered }
```

---

## [DES-FILES] File Structure

| File                                              | Purpose                  |
| ------------------------------------------------- | ------------------------ |
| `apps/vscode/src/providers/see-completion.ts`     | `@see` completion        |
| `apps/vscode/src/providers/see-document-links.ts` | Clickable document links |
| `apps/vscode/src/providers/see-resolver.ts`       | Target resolution        |
| `apps/vscode/src/providers/spec-codelens.ts`      | CodeLens display         |
| `apps/vscode/src/providers/spec-definition.ts`    | Go-to-definition         |
| `apps/vscode/src/providers/spec-hover.ts`         | Hover details            |

---

## [DES-DEPS] Dependencies

`001-overview`, `120-package-parsers`, and `200-app-vscode`.

---

## [DES-SEC] Security Considerations

Navigation resolves workspace-local documentation paths only. Do not open arbitrary external paths from source comments.

---

## [DES-ERR] Error Handling

| Scenario            | Handling                                                   |
| ------------------- | ---------------------------------------------------------- |
| Missing target file | Provider returns no link or diagnostic-friendly fallback   |
| Missing anchor      | Link to file and surface unresolved anchor where supported |

---

## [DES-TEST] Testing Strategy

Test resolver edge cases and provider outputs for valid, missing, and partial `@see` annotations.

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget `@see` provider files to this spec, then update providers when routing/annotation rules evolve.

### Rollback Plan

Route files back to `200-app-vscode` only if this child spec becomes unnecessary.

---

## File Reference Map

| Task | File                                  | Required @see         |
| ---- | ------------------------------------- | --------------------- |
| 1.x  | `apps/vscode/src/providers/see-*.ts`  | `design.md [DES-API]` |
| 1.x  | `apps/vscode/src/providers/spec-*.ts` | `design.md [DES-API]` |

## Code Locator Map

| Map ID                         | Code anchor                                                       | Messages/settings/commands         | Tests                          |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| `[SeeNavigation.Context]`      | `see-resolver.ts` `getSeeContextAt`                               | source `@see` line parsing         | resolver tests when introduced |
| `[SeeNavigation.Resolver]`     | `see-resolver.ts` `listNodeIds`, `resolveNode`, `readPathPreview` | spec/design/task node lookup       | resolver tests when introduced |
| `[SeeNavigation.Completion]`   | `see-completion.ts` `createSeeCompletionProvider`                 | completion triggers `/`, `#`, `[`  | provider tests when introduced |
| `[SeeNavigation.DocumentLink]` | `see-document-links.ts` `createSeeDocumentLinkProvider`           | `afx.openSpecAtLine` command links | provider tests when introduced |
| `[SeeNavigation.Definition]`   | `spec-definition.ts` `createSpecDefinitionProvider`               | VSCode definition provider         | provider tests when introduced |
| `[SeeNavigation.Hover]`        | `spec-hover.ts` `createSpecHoverProvider`                         | VSCode hover provider              | provider tests when introduced |
| `[SeeNavigation.CodeLens]`     | `spec-codelens.ts` `createSpecCodeLensProvider`                   | VSCode CodeLens provider           | provider tests when introduced |

---

## Open Technical Questions

None.
