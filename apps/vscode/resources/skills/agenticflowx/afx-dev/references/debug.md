## 1. debug

Debug issues while maintaining traceability to requirements.

### Usage

```bash
/afx-dev debug [error-description]
```

### Context

- **Error**: $ARGUMENTS
- **Role**: Debug Coordinator

### Process

1. **Trace Error**:
   - UI → Action → Service → DB.
   - Identify where the break is.

2. **Check Spec**:
   - Is the code doing what `design.md` says?
   - Is `design.md` wrong? or Code wrong?

3. **Fix**:
   - IF code wrong: Fix code to match spec.
   - IF spec wrong: Update spec (via `/afx-check links` or manual), then fix code.

4. **Verify**:
   - Run `/afx-check path`.

### Output

- **Root Cause**: Explanation of what went wrong.
- **Fix**: Code changes made.
- **Spec Update**: If required.

### Debug Checklist

```markdown
## Debug Report: {error}

### Error Location

- Layer: {UI/Action/Service/Repository/DB}
- File: {path}
- Line: {number}

### Root Cause

{Explanation}

### Spec Alignment

- Design says: {what design.md specifies}
- Code does: {what code actually does}
- Verdict: {Code wrong / Spec wrong / Both}

### Fix Applied

- {Description of fix}
- Files modified: {list}

### Verification

- [ ] `/afx-check path` passes
- [ ] Tests pass
- [ ] Build succeeds
- [ ] **Traceability**: Session Log updated, Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify the fix
```
