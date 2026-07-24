# /afx-check links

Verify spec integrity - check cross-references.

### Usage

```bash
/afx-check links <spec-path>
/afx-check links all
```

Examples:

- `/afx-check links docs/specs/user-auth`
- `/afx-check links all`

### Purpose

**Spec Integrity Sync**. Verify links across core phase files.

### Process

#### 0. Scope Definition

1. **Analyze Argument**: Check if the user provided a specific path or `all`.
   - If `path`: Focus only on that directory.
   - If `all`: Iterate through all directories in `docs/specs/`.
   - If missing: Prompt user to specify a path.

#### 1. Link Verification

1. **Scan** `spec.md`, `design.md`, and `tasks.md` for broken links.
2. **Verify** that every Requirement (e.g., `FR-1`) in `spec.md` is referenced in `design.md` and `tasks.md`.
3. **Fix** any broken anchors or file paths immediately.

#### 2. Report

Output a summary of what was fixed.

### Reference: Anchor Generation

1. Convert heading to **lowercase**
2. **Remove** periods, colons, special characters (keep hyphens)
3. **Replace** spaces with hyphens

| Heading                | Anchor             |
| ---------------------- | ------------------ |
| `## DESIGN-3.1`        | `#design-31`       |
| `## FR-1: User Auth`   | `#fr-1-user-auth`  |
| `### Phase 1: Setup`   | `#phase-1-setup`   |
| `### 2.1 Create Model` | `#21-create-model` |

### Reference: Link Formats

#### Same Directory (spec ↔ design ↔ tasks)

```markdown
[DESIGN-3.1](design.md#data-model)
[FR-1](spec.md#functional-requirements)
[Task 2.1](tasks.md#21-task-name)
```

#### From GitHub Issues (use repo-relative paths)

```markdown
[tasks.md - Phase 1](docs/specs/{feature}/tasks.md#phase-1-database-setup)
[design.md - Data Model](docs/specs/{feature}/design.md#data-model)
```

### Reference: Required References

#### In tasks.md (every task group)

```markdown
### 1.1 Create Database Schema

> Ref: [DESIGN-3.1](design.md#data-model) | [FR-1](spec.md#functional-requirements)
> GitHub Issue: #123

- [ ] Task item
```

#### In design.md (link to requirements)

```markdown
## Data Model

> Implements: [FR-1](spec.md#functional-requirements)
```
