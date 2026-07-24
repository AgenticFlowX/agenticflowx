# /afx-check trace

Audit @see annotations for PRD compliance.

### Usage

```bash
/afx-check trace              # Scan entire codebase
/afx-check trace packages/db  # Scan specific directory
/afx-check trace file.ts:22   # Check specific line
```

### Modes

#### Scan Mode (No args or directory path)

1. **Search for annotations**:

   ```bash
   grep -rn "// TODO\|// FIXME\|// XXX\|// HACK\|// NOTE\|// BUG\|// OPTIMIZE\|// REVIEW" --include="*.ts" --include="*.tsx" [path]
   ```

2. **Check PRD compliance**: For each match, read the next line. If it does NOT contain `@see docs/specs/`, it's orphaned.

3. **Output report**:

   ```markdown
   ## Annotation Audit Report

   Found {N} orphaned annotations (missing PRD links):

   | File               | Line | Type  | Content                 | Suggested PRD                         |
   | ------------------ | ---- | ----- | ----------------------- | ------------------------------------- |
   | claim.action.ts    | 397  | TODO  | Send email notification | docs/specs/user-auth/tasks.md#phase-2 |
   | booking.service.ts | 45   | FIXME | Race condition          | docs/specs/bookings/design.md#locking |

   Run `/afx-check trace <file>:<line>` for detailed fix suggestions.

   Next: /afx-check trace claim.action.ts:397 # Fix first orphan
   ```

4. **PRD inference**: Suggest PRD based on file path (see mapping below).

#### Point Mode (file:line or natural language)

1. **Locate file**: Find the file (search if not full path)
2. **Read context**: Read ±15 lines around the specified line
3. **Identify**:
   - Function/method containing the annotation
   - Feature from file path or user context
   - Annotation type (TODO, FIXME, etc.)
4. **Find relevant PRD**:
   - Match feature to `docs/specs/{feature}/`
   - Search tasks.md and design.md for related sections
5. **Output suggestion**:

   ````markdown
   ## Annotation Fix Suggestion

   **File**: `feature-claim.action.ts:397`
   **Function**: `assignSupplier()`

   **Current**:

   ```typescript
   // TODO: Send email notification to supplier
   ```
   ````

   **Suggested**:

   ```typescript
   // TODO: Send email notification to supplier
   // @see docs/specs/user-auth/spec.md [FR-3]
   // @see docs/specs/user-auth/design.md [DES-NOTIFY]
   ```

   **Context**: This TODO is in the `assignSupplier` function. Supplier notifications are planned for Phase 2 per the feature claims spec.

   Apply fix? [y/n]

   Next: /afx-check trace {next-file}:{line} # Fix next orphan

   ```

   ```

6. **Apply if confirmed**: Use Edit tool to add the `@see` line.

### PRD Link Inference

Map file paths to likely PRDs:

| File Pattern             | Likely PRD                  |
| ------------------------ | --------------------------- |
| `**/feature-claim*`      | `docs/specs/user-auth`      |
| `**/booking*`            | `docs/specs/bookings`       |
| `**/listing*`            | `docs/specs/listings`       |
| `**/auth*`               | `docs/specs/auth`           |
| `**/user*`               | `docs/specs/users`          |
| `packages/db/**`         | Infer from function context |
| `packages/mailer/**`     | Check which feature uses it |
| `packages/rental-engine` | `docs/specs/bookings`       |

When uncertain, list available specs from `docs/specs/` and ask user.

### Annotation Rules Reference

Per AFX, annotations MUST have a PRD link:

```typescript
// TODO: Description of work
// @see docs/specs/{feature}/tasks.md#{task-anchor}

// FIXME: Bug description
// @see docs/specs/{feature}/design.md#{section}
// @see https://github.com/org/repo/issues/123  (optional external link)

// NOTE: Important context
// @see docs/specs/{feature}/research/{topic}.md
```

**Required**: At least one `@see docs/specs/...` link
**Optional**: Additional external links (GitHub issues, docs)

### Standard Annotations

| Annotation | Purpose                     | Typical PRD Link        |
| ---------- | --------------------------- | ----------------------- |
| `TODO`     | Task to complete            | tasks.md#{task}         |
| `FIXME`    | Definitely broken           | design.md#{section}     |
| `XXX`      | Needs thought/decision      | research/{topic}.md     |
| `HACK`     | Brittle code, needs cleanup | design.md#{section}     |
| `NOTE`     | Important context           | spec.md or design.md    |
| `BUG`      | Known bug                   | GitHub issue + tasks.md |
| `OPTIMIZE` | Performance improvement     | design.md#{section}     |
| `REVIEW`   | Needs code review           | tasks.md or GitHub PR   |
