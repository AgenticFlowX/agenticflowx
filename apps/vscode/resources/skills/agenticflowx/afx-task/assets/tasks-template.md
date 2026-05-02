---
afx: true
type: TASKS
status: Draft
owner: "@owner"
version: "1.0"
created_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
updated_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
tags: ["{feature}"]
spec: spec.md
design: design.md
---

# {Feature Name} - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering for cross-referencing:

- **0.x** - Pre-implementation cleanup (if needed)
- **1.x** - {Phase 1 name}
- **2.x** - {Phase 2 name}
- **3.x** - {Phase 3 name}
- **n.x** - {Continue as needed}

References use **Node IDs** for traceability:

- `[FR-1]` = Functional Requirement 1 from spec.md
- `[NFR-2]` = Non-Functional Requirement 2 from spec.md
- `[DES-API]` = Design section from design.md
- `[1.1]` = Task 1.1 (this file)

---

## Phase 0: Pre-Implementation Cleanup

> Optional. Include only if cleanup is needed before implementation.

### 0.1 {Cleanup Task Name}

- [ ] {Task item}
- [ ] {Task item}

---

## Phase 1: {Phase Name}

> GitHub Issue #XX | Ref: [DESIGN-X.X], [REQ-FR-X]

### 1.1 {Task Group Name}
<!-- files: path/to/file.ts, path/to/other.ts -->
<!-- @see docs/specs/{feature}/design.md [DES-SECTION] | docs/specs/{feature}/spec.md [FR-X] -->

- [ ] {Task item}
- [ ] {Task item}
- [ ] {Task item}

### 1.2 {Task Group Name}
<!-- files: path/to/another.ts -->
<!-- @see docs/specs/{feature}/design.md [DES-SECTION] | docs/specs/{feature}/spec.md [FR-X] -->

- [ ] {Task item}
- [ ] {Task item}

---

## Phase 2: {Phase Name}

> GitHub Issue #XX | Ref: [DESIGN-X.X], [REQ-FR-X]

### 2.1 {Task Group Name}

- [ ] {Task item}
- [ ] {Task item}

### 2.2 {Task Group Name}

- [ ] {Task item}
- [ ] {Task item}

---

## Phase N: {Additional Phases}

> Add more phases as needed following the same pattern.

---

## Implementation Flow

```
Phase 0: Pre-Implementation (if needed)
    ↓
Phase 1: {Phase 1 name}
    ↓
Phase 2: {Phase 2 name}
    ↓
Phase N: {Continue as needed}
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section      |
| ---- | ---------------- | ------------------- |
| 1.x  | [FR-1], [FR-2]   | [DES-DATA]          |
| 2.x  | [FR-3], [FR-4]   | [DES-API], [DES-UI] |
| n.x  | {Requirements}   | {Design Node IDs}   |

---

## Notes

- Tasks are marked complete (`[x]`) as implementation progresses
- GitHub issue numbers are added when issues are created
- Cross-references help trace requirements → design → implementation

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action (Picked/Coded/Completed/Verified/Reviewed) | Files Modified (comma-separated or -) | Agent ([x] or []) | Human ([x] or []) -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
