## 3. review

Review code for AFX compliance (traceability, patterns) and functionality.

### Usage

```bash
/afx-dev review [scope]
```

### Context

- **Scope**: $ARGUMENTS (file, path, or PR)

### Process

1. **Traceability Check**:
   - Do exported functions have `@see` links?
   - Do annotations (TODO/FIXME) have `@see` links?

2. **Alignment Check**:
   - Does implementation match `design.md` patterns?

3. **Safety Check**:
   - Any `setTimeout` or mocks?
   - Any swallowed errors?

4. **Verification**:
   - Run `/afx-check path` on the scope.

### Output

```markdown
## Code Review: {scope}

### Traceability

| Item                | Status    | Issue     |
| ------------------- | --------- | --------- |
| @see on exports     | Pass/Fail | {details} |
| @see on annotations | Pass/Fail | {details} |

### Spec Alignment

| Pattern   | Expected         | Actual    | Status         |
| --------- | ---------------- | --------- | -------------- |
| {pattern} | {from design.md} | {in code} | Match/Mismatch |

### Safety

| Check               | Status    | Location    |
| ------------------- | --------- | ----------- |
| No setTimeout mocks | Pass/Fail | {file:line} |
| No swallowed errors | Pass/Fail | {file:line} |

### Recommendations

1. {Recommendation 1}
2. {Recommendation 2}

### Verdict

- **Compliance Score**: {X}/10
- **Ready for merge**: Yes/No
- **Traceability**: Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-task code # Address the recommendations (if any)
```

Or if ready:

```
Next: /afx-task pick docs/specs/{feature}   # Proceed to next task
```
