# /afx-check coverage

Bidirectional spec-to-code coverage map.

### Usage

```bash
/afx-check coverage <spec-path>
```

Example: `/afx-check coverage docs/specs/user-auth`

### Process

1. **Spec → Code**: For every `[FR-X]` and `[NFR-X]` in `spec.md`, search source code for `@see` links referencing that Node ID. Report uncovered requirements.
2. **Code → Spec**: For every `@see` link in source code pointing to this spec, verify the target Node ID exists in the spec file. Report broken/stale references.
3. **Output**:

```markdown
## Coverage: user-auth

### Spec → Code (Requirements Coverage)

| Requirement | @see in Code                         | Status      |
| ----------- | ------------------------------------ | ----------- |
| [FR-1]      | auth.service.ts:15, auth.action.ts:8 | ✓ Covered   |
| [FR-2]      | auth.service.ts:42                   | ✓ Covered   |
| [FR-3]      | —                                    | ✗ Uncovered |
| [NFR-1]     | auth.middleware.ts:5                 | ✓ Covered   |

Coverage: 3/4 (75%)

### Code → Spec (Orphan Check)

| @see Link                          | Target           | Status  |
| ---------------------------------- | ---------------- | ------- |
| auth.helper.ts:10 → spec.md [FR-5] | [FR-5] not found | ✗ Stale |

Stale references: 1
```
