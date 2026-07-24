## 4. test

Generate or run tests based on spec requirements.

### Usage

```bash
/afx-dev test [scope]
```

### Context

- **Scope**: $ARGUMENTS

### Process

1. **Identify Requirements**: Read `spec.md` and `design.md` for the scope.

2. **Check Coverage**: Compare existing tests vs requirements.

3. **Generate/Run**:
   - `npx nx test [scope]`
   - Create new tests for missing scenarios.

4. **Link**: Ensure test descriptions reference spec scenarios if possible.

### Test Generation Rules

1. **Spec-Driven**: Tests should cover scenarios from `spec.md` acceptance criteria.
2. **Layer Coverage**: Unit tests for repository/service, integration for actions.
3. **Mock Boundaries**: Mock at repository layer for service tests, mock at service for action tests.

### Output

````markdown
## Test Report: {scope}

### Coverage Analysis

| Requirement        | Test Exists | Status  |
| ------------------ | ----------- | ------- |
| FR-1: Create claim | Yes         | Passing |
| FR-2: Upload photo | No          | Missing |

### Tests Run

```bash
npx nx test {package}
```

Results: {X} passed, {Y} failed, {Z} skipped

### Tests Generated

- `{test-file}.test.ts` - {description}

### Recommendations

1. Add test for {missing scenario}
2. Fix failing test: {test name}

### Traceability

- [ ] Session Log updated
- [ ] Proven completion criteria marked (if task-based)
- [ ] Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify after tests pass

```

Or if tests fail:

```

Next: /afx-dev debug # Investigate test failures
````
