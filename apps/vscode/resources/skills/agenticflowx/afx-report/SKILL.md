---
name: afx-report
description: Traceability reporting — orphaned code detection, spec-to-code coverage mapping, and stale spec detection
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,report,metrics,health,coverage"
  afx-argument-hint: "orphans | coverage | stale"
  modeSlugs:
    - focus-review-spec
    - focus-review-tasks
    - architect
---

# /afx-report

Traceability metrics and project health reporting for AgenticFlowX.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `features` - List of active features

If neither file exists, use defaults.

## Usage

```bash
/afx-report orphans [path]          # Code without @see links
/afx-report coverage <spec>         # Spec → Code coverage map
/afx-report stale [days]            # Specs not updated recently
```

> **Note:** Overall health metrics and spec completeness scores are available in the VSCode AFX extension (Pipeline Tab). These subcommands focus on discovery operations that require codebase scanning.

## Vocabulary Boundary

`/afx-report` is read-only metrics and discovery. It reports stale specs, orphaned code, and coverage gaps; it does not validate artifact structure, verify behavior, refine living docs, or fix code. Use `/afx-check` for pass/fail quality gates, `/afx-spec refine` or `/afx-design refine` for living-doc updates, and `/afx-task code` for implementation gaps.

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Generate traceability reports, coverage maps, orphan lists

### Forbidden

- Create/modify/delete any files
- Run build/test/deploy/migration commands

If fixes are requested, respond with:

```text
Out of scope for /afx-report (read-only reporting mode). Use /afx-dev code to fix orphans or /afx-check trace to audit.
```

### Timestamp Format (MANDATORY)

When writing execution reports or creating journal entries, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

## Post-Action Checklist (MANDATORY)

Since this is a read-only reporting skill, no files are modified. However, after executing, you MUST:

1. Ensure the output strictly follows the markdown schema provided in the examples.

### Proactive Journal Capture

When this skill detects a high-impact health decline, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-report`**: Substantial drop in test coverage or highly out-of-date core specs discovered.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature or scan path from the active file (e.g., `src/features/user-auth/auth.service.ts` → scan `src/features/user-auth/`).
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Report across all features if no scope can be inferred.
3. **Trailing parameters (`[...context]`):** Treat extra words as filters for the report output (e.g., `/afx-report orphans src/components high priority` → filter orphans to `src/components`, prioritize high-severity).

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-report` action, suggest the most appropriate next command:

| Context                         | Suggested Next Command           |
| ------------------------------- | -------------------------------- |
| After `orphans` (orphans found) | `/afx-check trace <file>:<line>` |
| After `coverage` (gaps found)   | `/afx-task code <id>` or `/afx-task refine <feature>` |
| After `stale` (stale specs)     | `/afx-spec refine <feature>` then `/afx-check links <spec>` |

---

## Subcommands

---

## 1. orphans

Find code files missing required @see references.

### Usage

```bash
/afx-report orphans                 # Scan entire codebase
/afx-report orphans packages/db     # Scan specific path
```

### Process

Run this inline script to find orphans:

```bash
# Finds .ts files missing @see links
grep -rL "@see docs/specs" src/ apps/ packages/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" \
  | grep -v ".test.ts" \
  | grep -v "config"
```

### Output

````markdown
## Orphaned Code Report

**Scanned**: packages/db, apps/admin, apps/portal
**Files checked**: 127
**Orphans found**: 5

### Orphaned Files

| File                                                    | Type       | Suggested PRD             |
| ------------------------------------------------------- | ---------- | ------------------------- |
| `packages/db/src/core/services/notification.service.ts` | Service    | docs/specs/notifications/ |
| `apps/admin/src/user-auth/_actions/export.action.ts`    | Action     | docs/specs/user-auth/     |
| `packages/db/src/core/repositories/audit.repository.ts` | Repository | docs/specs/audit-log/     |

### Fix Command

For each orphan, add @see reference:

```typescript
/**
 * @see docs/specs/{feature}/design.md#{section}
 * @see docs/specs/{feature}/tasks.md#{task}
 */
```

Next (ranked):

1. /afx-check trace notification.service.ts:1 # Context-driven: Fix first orphan
2. /afx-dev code # Context-driven: Add @see links
3. /afx-report health # Context-driven: Re-check after fixes
   ──
4. /afx-next # Re-orient after report
5. /afx-session note "<note>" # Capture findings
````

---

## 2. coverage

Show requirements coverage - which spec items have implementations.

### Usage

```bash
/afx-report coverage <spec>
```

### Process

### Process

Run this inline script (approximate regex):

```bash
SPEC_FILE="docs/specs/$ARGUMENTS/spec.md"
if [ ! -f "$SPEC_FILE" ]; then echo "Spec not found"; exit 1; fi

echo "## Coverage Report: $ARGUMENTS"
echo "| Requirement | Refs |"
echo "| --- | --- |"

grep -oE "FR-[0-9]+" "$SPEC_FILE" | sort | uniq | while read -r REQ; do
  COUNT=$(grep -r "$REQ" src/ apps/ packages/ | wc -l)
  if [ "$COUNT" -gt 0 ]; then
    echo "| $REQ | ✅ $COUNT files |"
  else
    echo "| $REQ | ❌ Not covered |"
  fi
done
```

### Output

```markdown
## Coverage Report: user-auth

### Requirements Coverage

| Requirement | Description           | Code References | Status      |
| ----------- | --------------------- | --------------- | ----------- |
| FR-1        | Submit claim          | 3 files         | Covered     |
| FR-2        | Upload photos         | 2 files         | Covered     |
| FR-3        | View claim status     | 1 file          | Covered     |
| FR-4        | Admin assign supplier | 0 files         | Not covered |
| FR-5        | Supplier notification | 0 files         | Not covered |

### Tasks Coverage

| Phase | Total | Implemented | Coverage |
| ----- | ----- | ----------- | -------- |
| 0     | 5     | 5           | 100%     |
| 1     | 4     | 4           | 100%     |
| 2     | 6     | 6           | 100%     |
| 3     | 5     | 5           | 100%     |
| 7     | 4     | 2           | 50%      |

### Uncovered Items

1. **FR-4**: Admin assign supplier
   - Expected in: apps/admin/src/user-auth/
   - Task: 7.3

2. **FR-5**: Supplier notification
   - Expected in: packages/mailer/
   - Task: Phase 2 (deferred)

Next (ranked):

1. /afx-task pick docs/specs/user-auth # Context-driven: Implement uncovered
2. /afx-task list 7 # Context-driven: See Phase 7 tasks
3. /afx-dev code # Context-driven: Start implementation
   ──
4. /afx-next # Re-orient after report
5. /afx-session note "<note>" # Capture findings
```

---

## 3. stale

Find specs that haven't been updated recently.

### Usage

```bash
/afx-report stale              # Default: 30 days
/afx-report stale 14           # Custom threshold
```

### Process

### Process

Run this inline script:

```bash
DAYS="${1:-30}"
echo "## Stale Specs Report (> $DAYS days)"
echo "| File | Last Update |"
echo "| --- | --- |"

find docs/specs -name "*.md" -mtime +$DAYS -print0 | xargs -0 ls -lt | awk '{print "| " $9 " | " $6 " " $7 " |"}'
```

### Output

```markdown
## Stale Specs Report

**Threshold**: 30 days
**Checked**: 2025-12-16

### Stale Specs

| Spec              | Last Update | Days Stale | Status  |
| ----------------- | ----------- | ---------- | ------- |
| users-permissions | 2025-11-10  | 36         | Stale   |
| bookings          | 2025-11-25  | 21         | Warning |

### Active Specs

| Spec        | Last Update | Days |
| ----------- | ----------- | ---- |
| user-auth   | 2025-12-15  | 1    |
| agenticflow | 2025-12-16  | 0    |

Next (ranked):

1. /afx-check links users-permissions # Context-driven: Verify stale spec
2. /afx-session recap users-permissions # Context-driven: Review discussions
3. /afx-spec refine users-permissions # Context-driven: Update living spec if stale
   ──
4. /afx-next # Re-orient after report
5. /afx-session note "<note>" # Capture findings
```

---

## Metric Definitions

| Metric                | Calculation                                                       |
| --------------------- | ----------------------------------------------------------------- |
| **Spec Completeness** | % of specs with all required files (spec, design, tasks, journal) |
| **Link Validity**     | % of @see links that resolve to valid anchors                     |
| **Code Coverage**     | % of spec requirements with at least one @see backlink            |
| **Session Activity**  | % of specs with session log entries in last 30 days               |

---

## Related Commands

| Command            | Relationship             |
| ------------------ | ------------------------ |
| `/afx-check trace` | Fix orphaned annotations |
| `/afx-check links` | Fix broken links         |
| `/afx-next`        | See active work state    |
