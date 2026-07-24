# /afx-check path

Trace complete execution from UI to database and identify gaps. This is **Gate 1 (BLOCKING)** in AgenticFlowX quality gates.

### Usage

```bash
/afx-check path <feature-path>
```

Example: `/afx-check path src/features/user-auth`

### Context

- Feature path: $ARGUMENTS (required)
- Traces: UI → Server Action → Service → Repository → Database
- Detects mock/placeholder code patterns

### When to Use

**MANDATORY**: Run this command before:

- Marking any submission/form feature as complete
- Checking off subtask boxes for UI work
- Closing a GitHub ticket with user-facing features
- Running other quality gates (TypeScript, tests, build)

This is **Gate 1 (BLOCKING)** - if it fails, do NOT proceed with other gates.

### Verification Process

#### 1. Find Entry Points

Locate forms, buttons, and handlers in the feature path:

```bash
# Search for form handlers
grep -r "onSubmit" --include="*.tsx" $ARGUMENTS
grep -r "handleSubmit" --include="*.tsx" $ARGUMENTS
grep -r "onClick" --include="*.tsx" $ARGUMENTS
```

#### 2. Check for Mock Code (Red Flags)

**CRITICAL**: Search for these patterns that indicate incomplete implementations:

```bash
# Critical - Mock patterns
grep -r "setTimeout" --include="*.tsx" $ARGUMENTS
grep -r "// Simulate" --include="*.ts" $ARGUMENTS
grep -r "// Mock" --include="*.ts" $ARGUMENTS

# Warning - Potential issues
grep -r "// TODO" --include="*.ts" $ARGUMENTS | grep -i "implement"
grep -r "console.log" --include="*.ts" $ARGUMENTS
```

#### 3. Trace Each Handler

For each handler found, trace the call chain:

```
Handler: handleSubmit()
├── Calls: submitClaim() or setTimeout()
├── File: ./claim.action.ts
└── Status: REAL / MOCK
```

#### 4. Check Server Actions

For each action file:

```
Action: submitClaim()
├── 'use server': Yes/No
├── Calls: service.create() Yes/No
├── Error handling: Yes/No
└── Status: COMPLETE / INCOMPLETE
```

#### 5. Check Services

For each service:

```
Service: createClaim()
├── Calls: repository.insert() Yes/No
├── Exported: Yes/No
└── Status: COMPLETE / INCOMPLETE
```

#### 6. Check Repository

For each repository method:

```
Repository: insert()
├── DB Client: Kysely/Prisma/etc or mock
├── Query: INSERT INTO... Yes/No
└── Status: REAL / MOCK
```

### Output Format

#### Summary Table

```markdown
## Execution Path Verification: {feature}

| Layer      | Component              | Status | Issue |
| ---------- | ---------------------- | ------ | ----- |
| UI         | ClaimForm.handleSubmit | Pass   | -     |
| Action     | submitClaim            | Pass   | -     |
| Service    | createClaim            | Pass   | -     |
| Repository | insert                 | Pass   | -     |
| Database   | feature_claim          | Pass   | -     |

**Result:** ALL PATHS VERIFIED

Next: /afx-task pick docs/specs/{feature} # Proceed to next task
```

#### If Gaps Found

```markdown
## VERIFICATION FAILED

### Gaps Found

1. **UI Layer**: `handleSubmit` uses `setTimeout` mock
   - File: `claim-form.tsx:25`
   - Pattern: `setTimeout(() => router.push(...), 1000)`
   - Fix: Replace with `await submitClaim(formData)`

2. **Action Layer**: Missing error handling
   - File: `claim.action.ts:15`
   - Fix: Add try/catch with proper error response

Next: /afx-task code # Fix the identified gaps
```

### Red Flags Reference

| Pattern                  | Location | Severity | Meaning                       |
| ------------------------ | -------- | -------- | ----------------------------- |
| `setTimeout` in handlers | UI       | Critical | Mock submission, no real call |
| `// Simulate`            | Any      | Critical | Placeholder code              |
| `// Mock`                | Any      | Critical | Placeholder code              |
| `// TODO.*implement`     | Any      | Warning  | Incomplete implementation     |
| `console.log` only       | Actions  | Warning  | Missing actual call           |
| Empty `catch {}`         | Any      | Warning  | Swallowed errors              |
| Missing `await`          | Async    | Warning  | Unhandled promise             |
| Hardcoded return         | Actions  | Warning  | No real DB call               |

### Layer Verification Checklist

```
1. UI LAYER
   └── Form/button calls real handler (not setTimeout)?
   └── Handler wired to server action?
   └── All required fields present?

2. SERVER ACTION LAYER
   └── 'use server' directive at top?
   └── Imports and calls service?
   └── Handles errors with try/catch?
   └── Returns proper response type?

3. SERVICE LAYER
   └── Calls repository method?
   └── Properly exported?
   └── Business logic complete?

4. REPOSITORY LAYER
   └── Uses real DB client?
   └── Executes actual query?
   └── Not returning hardcoded values?

5. DATABASE LAYER
   └── Connection configured?
   └── Table/collection exists?
   └── Schema matches types?
```

### Error Handling

**Missing parameter:**

```
Error: Feature path required
Usage: /afx-check path src/features/user-auth
```

**Path not found:**

```
Error: Path does not exist: {path}
Check the path and try again.
```
