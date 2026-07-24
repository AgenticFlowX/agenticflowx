## 5. optimize

Optimize performance based on constraints.

### Usage

```bash
/afx-dev optimize [target]
```

### Process

1. **Identify Constraint**: Read `spec.md` (Requirements) or `research/*.md` (Decisions).

2. **Measure**: Profile current state.

3. **Optimize**: Improve code.

4. **Document**: If new patterns emerge, record in `research/`; for design changes, route to `/afx-design refine` (`/afx-dev` does not edit `design.md`).

5. **Link**: Add `@see` to optimization research or relevant design section.

### Optimization Rules

1. **Measure First**: Always profile before optimizing.
2. **Document Decisions**: Record optimization decisions in `research/` if significant.
3. **Avoid Premature**: Only optimize what's measurably slow.

### Output

````markdown
## Optimization Report: {target}

### Baseline Measurement

- Metric: {what was measured}
- Before: {value}

### Changes Made

- {Change 1}: {expected impact}
- {Change 2}: {expected impact}

### Results

- After: {value}
- Improvement: {X}%

### Documentation

- [ ] Design change routed to `/afx-design refine`: {section}
- [ ] Created research doc: {path}

### @see Links Added

```typescript
// OPTIMIZE: Query batching for claim list
// @see docs/specs/user-auth/research/performance-tuning.md
```

### Traceability

- [ ] Session Log updated
- [ ] Proven completion criteria marked (if task-based)
- [ ] Discovered Issues documented (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify optimization
````
