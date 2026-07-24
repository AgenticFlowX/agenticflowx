# review <name>

**Purpose:** Check for planning gaps — advisory, not blocking.

**Implementation:**

1. Extract all requirements from `spec.md` (FR-xxx, NFR-xxx)
2. Extract all tasks from `tasks.md` with their `@see` references
3. Cross-reference:
   - Find requirements without corresponding tasks (gaps)
   - Find tasks without requirement links (orphans)
   - Calculate coverage percentage
4. Check if design sections have corresponding tasks
5. Output gap analysis:

```
Gap Analysis: user-authentication

Requirements Coverage: 6/8 (75%)

Requirements WITHOUT Tasks (GAPS):
  ✗ [FR-4] Password complexity
  ✗ [NFR-3] Token expiry

Orphaned Tasks (no requirement link):
  ⚠ Task 1.1: Setup database schema

Recommendations:
  1. Add task for [FR-4] (password complexity)
  2. Add task for [NFR-3] (token expiry)
  3. Link task 1.1 to a requirement or remove if unnecessary
```
