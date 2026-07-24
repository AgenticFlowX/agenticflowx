## 2. refactor

Refactor code while preserving spec alignment.

### Usage

```bash
/afx-dev refactor [scope]
```

### Process

1. **Baseline**: Ensure current code matches `design.md`.

2. **Plan**: Propose structure changes.

3. **Check Spec Impact**:
   - Does this change the Design?
   - IF YES: stop and route to `/afx-design refine` to update `design.md` first. `/afx-dev` does not edit `design.md` directly (see the ownership boundary above). Resume the refactor only once the design reflects the intended architecture.

4. **Execute**: Refactor code.

5. **Update Links**: Ensure `@see` links point to new/correct sections.

### Refactor Rules

1. **Spec-First**: If refactoring changes architecture, route to `/afx-design refine` to update `design.md` before code — `/afx-dev` does not edit `design.md` itself. `/afx-design` overwrites current-state design rather than appending history.
2. **Journal History**: Document _why_ the refactor was needed and what alternatives were considered in `journal.md`.
3. **Link Preservation**: All `@see` links must remain valid after refactoring.
4. **No Behavior Change**: Unless explicitly requested, refactoring should not change behavior.

### Output

```markdown
## Refactor Report: {scope}

### Changes Made

- {Change 1}
- {Change 2}

### Spec Impact

- design.md refined via `/afx-design refine` (routed): Yes/No
- New sections added: {list}

### Links Updated

- {old-link} → {new-link}

### Verification

- [ ] All @see links valid
- [ ] Tests pass
- [ ] Build succeeds
- [ ] **Traceability**: Session Log updated (See [Bidirectional Traceability](#bidirectional-traceability-mandatory))

Next: /afx-check path {feature-path} # Verify refactored code
```
