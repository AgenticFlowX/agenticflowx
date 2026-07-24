# verify <task-id>

**Purpose:** Verify task implementation against spec requirements (static verification).

Unlike `/afx-check path` which verifies runtime execution paths, this verifies if a specific task matches its spec.

**Implementation:**

1. **Resolve the task artifact** — standard `tasks.md` or a `type: DASH` file; find the selected `### N.N` task definition
2. **Check files exist** — verify files mentioned in task exist
3. **Scan for `@see` backlinks** — check source code for `@see` references to this task
4. **Scan for incomplete markers** — grep for `TODO`, `FIXME` related to this task
5. **Check Work Sessions table** in the resolved artifact — verify a session log entry exists.
6. **Append a `Verified` row** using the canonical schema; verification changes no source files, so use `-` for Files Modified:

   ```markdown
   | YYYY-MM-DD | {id} | Verified | - | [x] | [] |
   ```

7. **Output verification result**:

```markdown
## Task 7.1 Verify

**Spec**: user-auth
**Task**: Create supplier constants
**Status**: [OK] Implemented | [PARTIAL] Partial | [MISSING] Missing

### Implementation Evidence

| Check                 | Status | Details                                |
| --------------------- | ------ | -------------------------------------- |
| Files exist           | [OK]   | feature-claim-supplier.constants.ts    |
| @see backlinks        | [OK]   | 2 files reference this task            |
| Session log entry     | [OK]   | 2025-12-13: Created supplier constants |
| No incomplete markers | [OK]   | No TODO/FIXME for 7.1                  |
| Pattern Consistency   | [OK]   | Error handling/logging matches project |
| Structural Integrity  | [OK]   | No unauthorized Hard Anchor changes    |

### Verdict

[OK] **Task 7.1 is fully implemented**
```

**Verification Status Definitions:**

| Status            | Meaning                     | Criteria                                 |
| ----------------- | --------------------------- | ---------------------------------------- |
| [OK] Implemented  | Task fully complete         | Files exist, backlinks present, no TODOs |
| [PARTIAL] Partial | Task started but incomplete | Some files exist, or TODOs remain        |
| [MISSING] Missing | Task not started            | No files, no session log, no backlinks   |

For a Dash, verify against Purpose + task criteria + file scope. Do not require `spec.md`, `design.md`, FR IDs, DES IDs, or an approval state. Hard Anchor and escalation violations still block verification.

---

## verify all <name>

**Purpose:** Bottom-up verification — verify ALL tasks against spec coverage.

**Implementation:**

1. For each task group with at least one unchecked completion criterion in tasks.md:
   - Run existing `verify <task-id>` logic
2. Aggregate results
3. Output: list of [OK] / [PARTIAL] / [MISSING] across all tasks

**Output:**

```
Verify All: 39-package-ec3 (13 tasks)

OK (9): 1.1, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1
PARTIAL (2): 4.3, 5.2
MISSING (2): 6.1, 7.1

Recommendation: /afx-task code <id> for PARTIAL/MISSING tasks
```
