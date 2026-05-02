---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["overview", "afx", "spec-driven", "architecture"]
spec: spec.md
---

# AgenticFlowX — Technical Design

---

## [DES-OVR] Overview

AgenticFlowX is organized as a pnpm + Turbo monorepo with 4 packages and 3 apps. All substantive work is governed by spec documents in `docs/specs/` and linked to source code via `@see` JSDoc annotations.

---

## [DES-ARCH] Architecture

### System Context

```text
docs/specs/XXX-name/
├── spec.md       ← requirements
├── design.md     ← technical decisions
└── tasks.md      ← implementation log

Source files
└── @see docs/specs/XXX-name/spec.md [FR-X]
    @see docs/specs/XXX-name/design.md [DES-SECTION]
```

### Spec Numbering Convention

| Range   | Category             | Step | Example                                       |
| ------- | -------------------- | ---- | --------------------------------------------- |
| 001     | Overview (singleton) | —    | `001-overview`                                |
| 100–199 | Packages             | 10   | `100-package-shared`, `110-package-transport` |
| 200–299 | Apps                 | 10   | `200-app-vscode`, `210-app-chat`              |
| 300–399 | Infra                | 10   | `300-infra-pi`, `310-infra-build`             |
| 400–499 | DX                   | 10   | `400-dx-conventions`, `410-dx-quality`        |
| 500–599 | CI                   | 10   | `500-ci-code-qa`, `510-ci-release`            |

New specs insert at midpoints (e.g. `105-package-foo`) without renumbering.

### `depends_on` Field

When a spec depends on another spec's decisions, `depends_on: [spec-folder-name]` is added to frontmatter after `tags`. Validated by `/afx-check deps`.

---

## [DES-DEC] Key Decisions

| Decision               | Options Considered                   | Choice                           | Rationale                                                        |
| ---------------------- | ------------------------------------ | -------------------------------- | ---------------------------------------------------------------- |
| Spec ID encoding       | Sequential (1, 2, 3…), ranged        | Ranged 3-digit                   | Allows insertion without renumbering; category encoded in prefix |
| Traceability mechanism | Comments, separate index file, JSDoc | JSDoc `@see`                     | Tooling-parseable, co-located with code, standard format         |
| ADR vs spec            | Everything in specs                  | ADRs for cross-cutting decisions | ADRs are point-in-time; specs are living                         |

---

## [DES-API] `@see` Annotation Format

### TypeScript/TSX files

```typescript
/**
 * Brief description of what this file does.
 *
 * @see docs/specs/XXX-category-name/spec.md [FR-X]
 * @see docs/specs/XXX-category-name/design.md [DES-SECTION]
 */
```

### Scripts (`.mjs`)

```javascript
// @see docs/specs/XXX-category-name/spec.md [FR-X]
// @see docs/specs/XXX-category-name/design.md [DES-SECTION]
```

### Workflow YAML

```yaml
# @see docs/specs/XXX-category-name/spec.md [FR-X]
# @see docs/specs/XXX-category-name/design.md [DES-SECTION]
```

---

## [DES-FILES] File Structure

| Location                        | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `docs/specs/XXX-name/spec.md`   | Requirements                             |
| `docs/specs/XXX-name/design.md` | Architecture and decisions               |
| `docs/specs/XXX-name/tasks.md`  | Implementation log (Work Sessions table) |
| `docs/adr/ADR-XXXX-*.md`        | Cross-cutting architecture decisions     |
| `docs/research/<domain>/*.md`   | Investigation and analysis documents     |

---

## [DES-DEPS] Dependencies

None — this is the root governing document.

---

## [DES-SEC] Security Considerations

- No sensitive data in spec documents
- ADRs referencing secrets or auth design must redact actual key values

---

## [DES-ERR] Error Handling

| Scenario                | Handling                                 |
| ----------------------- | ---------------------------------------- |
| Missing @see annotation | `/afx-check trace` reports orphaned file |
| Circular `depends_on`   | `/afx-check deps` reports cycle          |

---

## [DES-TEST] Testing Strategy

### Validation

- `/afx-check trace <path>` — confirms all source files have `@see` annotations
- `/afx-check links <spec-path>` — confirms cross-references resolve
- `/afx-check deps` — confirms `depends_on` graph is acyclic

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Establish Structure

1. Create `docs/adr/` and `docs/research/` folders
2. Seed `ADR-0001-pi-engine-integration.md`
3. Expand `AGENTS.md` with AFX conventions and spec map

### Phase 2: Scaffold All Specs

1. Create spec/design/tasks for each of the 17 spec folders in dependency order
2. Fill spec.md and design.md with as-built content

### Phase 3: `@see` Annotation Pass

1. Annotate every source file in `packages/` and `apps/`
2. Validate with `/afx-check trace`

---

## File Reference Map

| Task | File                      | Required @see                          |
| ---- | ------------------------- | -------------------------------------- |
| —    | All `packages/*/src/*.ts` | `spec.md [FR-X]` + `design.md [DES-*]` |
| —    | All `apps/*/src/*.ts(x)`  | `spec.md [FR-X]` + `design.md [DES-*]` |

---

## Open Technical Questions

| #   | Question                                    | Status |
| --- | ------------------------------------------- | ------ |
| 1   | Should `/afx-check trace` run as a CI gate? | Open   |
