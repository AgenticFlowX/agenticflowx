---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "vscode", "spec-services", "sprint", "parsers", "host"]
spec: spec.md
---

# App VSCode Spec Services - Technical Design

---

## [DES-OVR] Overview

`apps/vscode/src/services/` contains pure host-side data services. They orchestrate file discovery,
parser invocations from `@afx/parsers`, caching, and VSCode `setContext` keys. They never own UI
and never bind to a webview directly — they emit typed payloads that the workbench panel sends to
the workbench webview.

---

## [DES-ARCH] Architecture

```text
extension.ts activate()
  ├─ const specs = createSpecsDataProvider(rootUri, parsers, logger)
  ├─ const sprintCtx = createSprintContextSync(setContext, isSprintFile, findSectionAt)
  ├─ register file watchers
  ├─ inject specs into workbench panel
  └─ register editor selection listener for sprintCtx.evaluate

createSpecsDataProvider
  ├─ scan workspace + child project roots
  ├─ readMarkdownRecursive
  ├─ parseFrontmatter / parseSpec / parseTasks / parseJournal
  ├─ cache by path + mtime
  └─ expose getSpecsData()

createSprintContextSync
  ├─ setSprint(uri, isSprint)
  ├─ setSection("SPEC" | "DESIGN" | "TASKS" | undefined)
  └─ evaluate(activeEditor) -> reads cursor position, slices sprint, calls setContext
```

---

## [DES-DEC] Key Decisions

| Decision            | Options Considered                                            | Choice                                        | Rationale                                                            |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| Service layer split | Inline in panel, dedicated services                           | Dedicated services                            | Keeps panels focused on dispatch; services testable in isolation     |
| Cache strategy      | In-memory map, on-disk persistence, parser cache              | In-memory map with mtime/version tag          | Workspace size is bounded; persistence adds invalidation hazards     |
| Sprint detection    | Regex on file content per cursor move, sliced sections cached | Sliced sections cached + cursor binary search | Sprint files are large; rescan-per-tick would jank the editor        |
| Spec validate UX    | Side-panel form, status bar, toast                            | Toast (read-only validate)                    | Validate is informational; mutation goes through `*Approve` commands |

---

## [DES-DATA] Data Model

```typescript
export interface SpecsDataPayload {
  features: SpecFeatureRow[];
  documents: DocumentRow[]; // workbench-types.ts
  pipeline: PipelineRow[]; // workbench-types.ts
  journals: JournalEntry[]; // workbench-types.ts
  ghostTasks: GhostTaskResult; // workbench-types.ts
  generatedAt: string;
}

export interface SprintSectionInfo {
  isSprint: boolean;
  section?: "SPEC" | "DESIGN" | "TASKS";
  range?: { startLine: number; endLine: number };
}
```

---

## [DES-API] API Contracts

```typescript
export function createSpecsDataProvider(
  rootUri: vscode.Uri,
  logger: Logger,
): {
  getSpecsData(): SpecsDataPayload;
  refresh(): Promise<void>;
  dispose(): void;
};

export function createSprintContextSync(opts: {
  setContext(key: string, value: unknown): void;
  isSprintFile(uri: vscode.Uri): boolean;
  findSectionAt(uri: vscode.Uri, line: number): SprintSectionInfo;
}): {
  setSprint(uri: vscode.Uri | undefined): void;
  setSection(section: "SPEC" | "DESIGN" | "TASKS" | undefined): void;
  evaluate(editor: vscode.TextEditor | undefined): void;
};
```

### [DES-SPEC-COMMAND-VALIDATE] / [DES-SPEC-COMMAND-REVIEW] / [DES-SPEC-COMMAND-APPROVE]

Spec lifecycle commands read the front matter `status` field, validate the structure of the
spec.md document, and either emit a toast (`Validate`/`Review`) or perform an explicit status bump
to `Approved` (`Approve`). Each command receives the active document URI and goes through the host
service to keep parsing in one place.

### [DES-DESIGN-COMMAND-VALIDATE] / [DES-DESIGN-COMMAND-REVIEW] / [DES-DESIGN-COMMAND-APPROVE]

Design counterparts: same structure, target `design.md` and the `approval.design` field on
single-document sprint files.

### [DES-TASK-COMMAND-CODE] / [DES-TASK-COMMAND-VERIFY] / [DES-TASK-COMMAND-PICK]

Task command stubs route to the AFX skill backing them. The host service exposes the active
spec/feature path so the chat composer can prefill an `/afx-task` invocation.

---

## [DES-FILES] File Structure

| File                                         | Purpose                                                        |
| -------------------------------------------- | -------------------------------------------------------------- |
| `apps/vscode/src/services/specs-data.ts`     | Spec discovery, parsing, caching, workbench payload generation |
| `apps/vscode/src/services/sprint.ts`         | Sprint file detection, section slicing helpers                 |
| `apps/vscode/src/services/sprint-context.ts` | VSCode setContext orchestration based on sprint section info   |

---

## [DES-DEPS] Dependencies

| Dependency          | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `@afx/parsers`      | Pure parser utilities for spec/tasks/journal   |
| `200-app-vscode`    | Extension activation lifecycle                 |
| `220-app-workbench` | Workbench panel consumes the workbench payload |

---

## [DES-SEC] Security Considerations

- Services read workspace files; never write outside the workspace.
- No external network calls.

---

## [DES-ERR] Error Handling

| Scenario                        | Handling                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- |
| File scan path unreachable      | Skip and log; continue with available files                                       |
| Parser throws on malformed file | Capture as a parse-failure entry in payload; UI marks document with warning badge |
| Cache mtime mismatch            | Drop stale entry, re-parse on next access                                         |

---

## [DES-TEST] Testing Strategy

- `apps/vscode/src/services/sprint.test.ts` covers `isSprintFile`, `sliceSprintSection`, `findSectionAt`
- Future `specs-data.test.ts` to cover discovery + parser delegation against fixtures

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Move spec-services FRs/DES content from `220-app-workbench` and `202-app-vscode-editor-actions` into this spec.
2. Retarget service-file `@see` headers to `204-app-vscode-spec-services`.
3. Run `pnpm verify` and `/afx-check trace apps/vscode/src/services`.

---

## [DES-SPECSVC-LOC] Code Locator Map

| Map ID                     | Code anchor                                                                                   | Tests                       |
| -------------------------- | --------------------------------------------------------------------------------------------- | --------------------------- |
| `[SpecServices.SpecsData]` | `services/specs-data.ts` `createSpecsDataProvider`                                            | future specs-data tests     |
| `[SpecServices.Sprint]`    | `services/sprint.ts` `isSprintFile`, `sliceSprintSection`, `findSectionAt`                    | `services/sprint.test.ts`   |
| `[SpecServices.SprintCtx]` | `services/sprint-context.ts` `createSprintContextSync`, `setSprint`, `setSection`, `evaluate` | future sprint-context tests |

---

## [DES-SPECSVC-REFS] File Reference Map

| File                                         | Required @see                                                      |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `apps/vscode/src/services/specs-data.ts`     | `spec.md [FR-1] [FR-2] [FR-5]` + `design.md [DES-ARCH] [DES-DATA]` |
| `apps/vscode/src/services/sprint.ts`         | `spec.md [FR-3]` + `design.md [DES-ARCH]`                          |
| `apps/vscode/src/services/sprint-context.ts` | `spec.md [FR-3]` + `design.md [DES-ARCH]`                          |
