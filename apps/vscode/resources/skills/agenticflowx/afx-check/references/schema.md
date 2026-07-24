# /afx-check schema

Verify internal consistency of design.md database artifacts.

### Usage

```bash
/afx-check schema <spec-path>
```

Example: `/afx-check schema docs/specs/my-feature`

### Context

- Spec path: $ARGUMENTS (required)
- Verifies consistency across all database-related artifacts in design.md
- Detects: Column mismatches, missing tables, invalid constraints, naming inconsistencies

### When to Use

**MANDATORY**: Run this command after:

- Any PRD review that touches database schema
- Adding or modifying migrations in design.md
- Adding or modifying seed SQL in design.md
- Updating ERD/Mermaid diagrams
- Before implementation of database-related tasks

This catches issues that would only surface during actual migration execution.

### Verification Process

#### 1. Identify Artifacts in design.md

Scan for all database-related sections. Common patterns:

```bash
# Migrations
grep -n "CREATE TABLE\|ALTER TABLE" design.md

# Type definitions (varies by ORM/language)
grep -n "interface\|type\|model\|schema" design.md

# ERD diagrams
grep -n "erDiagram\|classDiagram" design.md

# Seed data
grep -n "INSERT INTO" design.md

# Repository/query code
grep -n "\.select\|\.insert\|\.update\|\.delete\|\.where" design.md
```

#### 2. Build Cross-Reference Map

For each table found in migrations, track:

- Table name and columns (from CREATE TABLE)
- Type definition (from ORM types)
- ERD entity (from Mermaid)
- Seed statements (from INSERT INTO)
- Repository queries (from code examples)

#### 3. Cross-Reference Checks

| Check                      | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| **Migration → Types**      | Every CREATE TABLE has matching type definition                      |
| **Types → Migration**      | Every type definition has matching CREATE TABLE                      |
| **Migration → ERD**        | Every table in migrations appears in ERD                             |
| **ERD → Migration**        | Every entity in ERD has matching migration                           |
| **Seed → Migration**       | INSERT columns exist in CREATE TABLE                                 |
| **Seed → Constraints**     | ON CONFLICT/UPSERT clauses match actual constraints (PK, UNIQUE)     |
| **Repository → Migration** | Column/table names in queries match schema                           |
| **Documentation → Code**   | Any documented lists (enums, constants, etc.) match code/seed values |

#### 4. Common Issues to Detect

**Constraint Mismatch:**

```sql
-- Migration defines: PRIMARY KEY (id)
-- Seed uses: ON CONFLICT (id, other_col) ← INVALID
```

**Column Name Inconsistency:**

```sql
-- Migration: created_at TIMESTAMPTZ
-- Repository: .where('createdAt', ...) ← MISMATCH
```

**Missing Column in Types:**

```sql
-- Migration adds: new_column VARCHAR(100)
-- Type definition: missing new_column ← ERROR
```

**Seed Order Violation:**

```sql
-- INSERT into child_table references parent_id
-- But parent_table seed comes AFTER child_table ← FK VIOLATION
```

### Output Format

#### Summary Table

```markdown
## Schema Consistency Check: {spec}

| Artifact    | Status  | Issues |
| ----------- | ------- | ------ |
| Migrations  | OK      | -      |
| Type Defs   | WARNING | 1      |
| ERD Diagram | OK      | -      |
| Repository  | WARNING | 1      |
| Seed SQL    | FAIL    | 2      |

**Result:** 4 issues found
```

#### If Issues Found

```markdown
## SCHEMA VERIFICATION FAILED

### Issues Found

1. **Type Definition**: Missing column
   - Migration has: `new_column VARCHAR(100)`
   - Type missing: `new_column`
   - Fix: Add column to type definition

2. **Seed SQL**: Invalid ON CONFLICT
   - Table constraint: `PRIMARY KEY (id)`
   - Seed uses: `ON CONFLICT (id, other)`
   - Fix: Match ON CONFLICT to actual constraint

3. **Repository**: Column name mismatch
   - Migration: `created_at`
   - Query uses: `createdAt`
   - Fix: Use consistent naming convention

Next: Fix issues in design.md, then re-run /afx-check schema
```

### Artifact Checklist

When verifying schema consistency:

```
□ MIGRATIONS (CREATE TABLE/ALTER TABLE)
  └── Primary keys defined
  └── Foreign keys reference existing tables
  └── Indexes for frequently queried columns
  └── Constraint names are unique
  └── Migration order respects dependencies

□ TYPE DEFINITIONS (ORM-specific)
  └── Every migration table has matching type
  └── Column names match exactly
  └── Types are compatible (SQL type → language type)
  └── Nullable columns marked appropriately
  └── Default values indicated where applicable

□ ERD/DIAGRAMS
  └── Every migration table appears as entity
  └── Relationships match foreign keys
  └── Cardinality annotations correct (1:1, 1:N, N:M)

□ REPOSITORY/QUERY CODE
  └── Column names match migration schema
  └── Table names match migration schema
  └── Join conditions use correct foreign keys

□ SEED DATA
  └── Table names exist in migrations
  └── Column names exist in target tables
  └── ON CONFLICT/UPSERT matches actual constraints
  └── Seed order respects foreign key dependencies
  └── Subqueries reference correct columns

□ DOCUMENTATION TABLES
  └── Documented values match seed/code values
  └── Naming conventions consistent throughout
```

### Error Handling

**Missing parameter:**

```
Error: Spec path required
Usage: /afx-check schema docs/specs/my-feature
```

**No design.md found:**

```
Error: No design.md found at {spec-path}/design.md
Check the spec path and try again.
```

**No schema artifacts found:**

```
Warning: No CREATE TABLE statements found in design.md
This spec may not have database schema. Skipping schema check.
```
