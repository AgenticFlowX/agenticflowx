# /afx-check all

Run all verification checks in sequence.

### Usage

```bash
/afx-check all <feature-path>
```

### Process

1. **Run path check**: `/afx-check path <feature-path>`
2. **Run trace check**: `/afx-check trace <feature-path>`
3. **Run links check**: Infer spec from feature path
4. **Run schema check**: `/afx-check schema <spec-path>` (if design.md has CREATE TABLE)
5. **Run deps check**: `/afx-check deps <feature>`
6. **Run coverage check**: `/afx-check coverage <spec-path>`

### Output

```markdown
## Full Verification Report: {feature}

### 1. Execution Path

{path check results}

### 2. Annotation Audit

{trace check results}

### 3. Spec Integrity

{links check results}

### 4. Schema Consistency

{schema check results - or "N/A: No database schema in this spec"}

## Summary

| Check    | Status     |
| -------- | ---------- |
| Path     | Pass       |
| Trace    | 3 warnings |
| Links    | Pass       |
| Schema   | Pass       |
| Deps     | Pass       |
| Coverage | 75%        |

**Overall**: READY FOR REVIEW (with warnings)

Next: /afx-task pick docs/specs/{feature} # Continue to next task
```

Or if issues found:

```
Next: /afx-task code {id}   # Address the issues first
```
