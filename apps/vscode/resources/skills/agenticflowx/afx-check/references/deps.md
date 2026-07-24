# /afx-check deps

Build and validate the cross-spec dependency graph from `depends_on` frontmatter.

### Usage

```bash
/afx-check deps                  # All specs
/afx-check deps <feature>        # Single feature and its dependents
```

### Process

1. **Scan all specs**: Read `depends_on` from every `spec.md` frontmatter under `docs/specs/`
2. **Build graph**: Map feature → dependencies
3. **Validate**:
   - Every target in `depends_on` exists as a real feature folder
   - No circular dependencies (A → B → A)
   - No self-references
4. **Report**:

```markdown
## Dependency Graph

marketplace-bookings → [marketplace-auth, marketplace-listings]
marketplace-listings → [marketplace-auth]
marketplace-auth → [] (root)

### Validation

✓ All dependency targets exist
✓ No circular dependencies
✗ marketplace-payments depends_on "billing-service" — folder not found

### Orphaned Specs (no dependents)

ℹ marketplace-reports (informational — not blocking)
```
