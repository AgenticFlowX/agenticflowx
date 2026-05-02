---
afx: true
type: SPRINT
status: Draft
owner: "@owner"
version: "1.0"
created_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
updated_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
tags: ["{feature}", "sprint"]
approval:
  spec: Draft # Draft | Approved
  design: Draft # gated on spec: Approved
  tasks: Draft # gated on design: Approved
---

# {Feature Name} — Sprint Brief

> **Format**: Single-document SDD. Carries spec + design + tasks in one file for fast, surgical feature work.
> **Approval gates**: Sections must be approved in order — Spec → Design → Tasks → Code. Track via the `approval` block in frontmatter.
> **Graduation**: Run `/afx-sprint graduate` to split into `spec.md` / `design.md` / `tasks.md` when scope grows. Section structure below mirrors the parent templates (demoted one heading level) so graduation is a clean extract + heading-level promote + `@see` path retarget.

---

<!-- SPRINT-SECTION-START: SPEC (maps to spec.md on graduation — includes References + Section 1 body; drop `## 1. Spec` wrapper, promote ### → ##) -->

## References

> **Upstream Context**: Link to relevant proposals, research, or architecture docs that drove this sprint.

- **Proposal**: {link if any}
- **Research**: {link if any}
- **Architecture**: {link if any}

---

## 1. Spec

> The WHAT — requirements, acceptance, scope. Mirrors `afx-spec/assets/spec-template.md`. Use `[FR-X]` / `[NFR-X]` anchors so code `@see` links can be retargeted cleanly after graduation.

### Problem Statement

{Describe the problem this feature solves. Why are we building this? What user pain point or business need does it address?}

### User Stories

#### Primary Users

{Who are the main users of this feature?}

#### Stories

**As a** {role}
**I want** {feature/capability}
**So that** {benefit/value}

### Requirements

#### Functional Requirements

| ID   | Requirement               | Priority    |
| ---- | ------------------------- | ----------- |
| FR-1 | {Requirement description} | Must Have   |
| FR-2 | {Requirement description} | Must Have   |
| FR-3 | {Requirement description} | Should Have |

#### Non-Functional Requirements

| ID    | Requirement | Target                                |
| ----- | ----------- | ------------------------------------- |
| NFR-1 | Performance | {e.g., Page load < 2s}                |
| NFR-2 | Security    | {e.g., Auth required for all actions} |

### Acceptance Criteria

- [ ] {Criterion tied to FR-1}
- [ ] {Criterion tied to FR-2}
- [ ] {Edge case / error path}

### Non-Goals (Out of Scope)

- {Feature/capability that is out of scope}
- {Feature/capability deferred to future phase}

### Open Questions

| #   | Question        | Status | Blocking | Resolution |
| --- | --------------- | ------ | -------- | ---------- |
| 1   | {Question text} | Open   | No       | -          |

### Dependencies

- {Dependency 1 — e.g., requires completed feature X}
- {Dependency 2 — e.g., requires third-party service Y}

<!-- SPRINT-SECTION-END: SPEC -->

---

<!-- SPRINT-SECTION-START: DESIGN (maps to design.md on graduation; promote ### → ##) -->

## 2. Plan

> The HOW — architecture, decisions, data model. Mirrors `afx-design/assets/design-template.md`. Use `[DES-X]` anchors on section headings so code `@see` links can be retargeted cleanly after graduation.

### [DES-OVR] Overview

{Brief summary of the technical approach. 2–3 sentences max.}

### [DES-ARCH] Architecture

#### System Context

{How does this feature fit into the overall system? What services/components does it interact with?}

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
```

#### Component Diagram

{Show the main components and their relationships}

### [DES-UI] User Interface & UX

{Describe the general visual layout, specific component usage, and responsive behavior. Global design tokens belong in the project's `CLAUDE.md`, not here.}

### [DES-DEC] Key Decisions

| Decision     | Options Considered | Choice | Rationale          |
| ------------ | ------------------ | ------ | ------------------ |
| {Decision 1} | A, B, C            | B      | {Why B was chosen} |

### [DES-DATA] Data Model

#### Database Schema

```sql
-- Example table definition
CREATE TABLE {table_name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### TypeScript Interfaces

```typescript
export interface {EntityName} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### [DES-API] API Contracts

```typescript
// Server action / function signatures
```

### [DES-FILES] File Structure

| File     | Purpose           |
| -------- | ----------------- |
| `{path}` | {What lives here} |

### [DES-DEPS] Dependencies

- {External or internal packages this sprint pulls in}

### [DES-SEC] Security Considerations

- {Security consideration 1}

### [DES-ERR] Error Handling

| Scenario     | Handling           |
| ------------ | ------------------ |
| {Error case} | {How it's handled} |

### [DES-TEST] Testing Strategy

- {What will be unit / integration tested}

### [DES-ROLLOUT] Migration / Rollout Plan

- {Rollout steps, if any}
- {Rollback plan}

### Open Technical Questions

| #   | Question             | Status |
| --- | -------------------- | ------ |
| 1   | {Technical question} | Open   |

<!-- SPRINT-SECTION-END: DESIGN -->

---

<!-- SPRINT-SECTION-START: TASKS (maps to tasks.md on graduation; promote ### → ##, #### → ###) -->

## 3. Tasks

> The WHEN — hierarchical implementation checklist. Mirrors `afx-task/assets/tasks-template.md`. Every task group references the FR/DES it implements via an `@see` comment using the full project-relative sprint brief path while sprint mode is active.

### Task Numbering Convention

- **0.x** — Pre-implementation cleanup (if needed)
- **1.x** — Phase 1
- **2.x** — Phase 2
- **n.x** — Continue as needed

References use Node IDs: `[FR-X]`, `[NFR-X]` (Spec section), `[DES-X]` (Plan section), `[X.Y]` (this Tasks section).

### Phase 1: {Phase Name}

> GitHub Issue #XX | Ref: [DES-X], [FR-X]

#### 1.1 {Task Group Name}

<!-- files: path/to/file.ts, path/to/other.ts -->
<!-- @see docs/specs/{feature}/{feature}.md [FR-1] [DES-ARCH] -->

- [ ] {Task item}
- [ ] {Task item}

#### 1.2 {Task Group Name}

<!-- files: path/to/another.ts -->
<!-- @see docs/specs/{feature}/{feature}.md [FR-2] [DES-DATA] -->

- [ ] {Task item}
- [ ] {Task item}

### Phase 2: {Phase Name}

> GitHub Issue #XX | Ref: [DES-X], [FR-X]

#### 2.1 {Task Group Name}

<!-- files: path/to/third-file.ts -->
<!-- @see docs/specs/{feature}/{feature}.md [FR-3] [DES-API] -->

- [ ] {Task item}
- [ ] {Task item}

### Cross-Reference Index

| Task | Spec Requirement | Design Section |
| ---- | ---------------- | -------------- |
| 1.x  | [FR-1], [FR-2]   | [DES-DATA]     |
| 2.x  | [FR-3]           | [DES-API]      |

<!-- SPRINT-SECTION-END: TASKS -->

---

<!-- SPRINT-SECTION-START: SESSIONS (appended to tasks.md on graduation — tasks-template.md requires Work Sessions as the last section) -->

## 4. Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in {feature}.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-sprint code, /afx-task pick, /afx-task code, /afx-task complete -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action (Picked/Coded/Completed/Verified/Reviewed) | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |

<!-- SPRINT-SECTION-END: SESSIONS -->
