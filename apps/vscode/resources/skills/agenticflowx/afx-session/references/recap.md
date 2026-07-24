# /afx-session recap (Recap Mode)

**Usage**: `/afx-session recap [feature|all]` or `/afx-session recap [feature|all] --tag <tag>`

### When to use

- **recap**: "What did we discuss last time?"

Generate comprehensive recap for session resumption:

1. **Gather** discussions from specified scope
2. **If `--tag` specified**: Filter to discussions containing that tag
3. **Sort** by date (most recent first)
4. **Generate** recap with tags shown:

```markdown
## Session Recap

### Last 7 Days

#### user-auth (2 discussions)

- **2025-12-15T10:30:00.000Z**: Supplier assignment - Decided on hardcoded Phase 1 approach
- **2025-12-14T16:00:00.000Z**: Email notifications - Deferred to Phase 2

#### agenticflow (1 discussion)

- **2025-12-15T09:15:00.000Z**: PRD-first traceability - Validated uniqueness vs competitors

### Key Decisions Made

1. PRD links required, external links optional (agenticflow)
2. Supplier table deferred to Phase 2 (user-auth)

### Open Items

- [ ] Implement supplier email notifications
- [ ] Create supplier database table

### Resume From

Continue with: {most recent incomplete work}

Next: /afx-next # Then continue with suggested task
```

### Example

```
/afx-session recap all
```
</content>
