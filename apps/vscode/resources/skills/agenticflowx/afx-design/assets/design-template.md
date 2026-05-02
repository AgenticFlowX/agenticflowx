---
afx: true
type: DESIGN
status: Draft
owner: "@owner"
version: "1.0"
created_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
updated_at: "{YYYY-MM-DDTHH:MM:SS.mmmZ}"
tags: ["{feature}"]
spec: spec.md
---

# {Feature Name} - Technical Design

---

## [DES-OVR] Overview

{Brief summary of the technical approach. 2-3 sentences max.}

---

## [DES-ARCH] Architecture

### System Context

{How does this feature fit into the overall system? What services/components does it interact with?}

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│  Database   │
│   (Next.js) │     │   Actions   │     │  (DynamoDB/ │
│             │     │             │     │  PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
```

### Component Diagram

{Show the main components and their relationships}

---

## [DES-UI] User Interface & UX

{Describe the general visual layout, specific component usage, and responsive behavior.}
{**Reminder**: Global design tokens (e.g. "Use Tailwind", "Use Shadcn") belong in the project's `CLAUDE.md`, not here. This section is only for this feature's specific component composition.}

---

## [DES-DEC] Key Decisions

| Decision     | Options Considered | Choice | Rationale          |
| ------------ | ------------------ | ------ | ------------------ |
| {Decision 1} | A, B, C            | B      | {Why B was chosen} |
| {Decision 2} | X, Y               | X      | {Why X was chosen} |

---

## [DES-DATA] Data Model

### Database Schema

```sql
-- Example table definition
CREATE TABLE {table_name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    {column} {type} {constraints},
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### TypeScript Interfaces

```typescript
export interface {EntityName} {
  id: string;
  // ... properties
  createdAt: Date;
  updatedAt: Date;
}

export enum {EnumName} {
  VALUE_1 = 'VALUE_1',
  VALUE_2 = 'VALUE_2',
}
```

---

## [DES-API] API Contracts

### Server Actions

```typescript
// File: apps/{app}/src/app/(group)/{feature}/_actions/{feature}.action.ts

'use server';

export async function create{Entity}(data: Create{Entity}Input): Promise<Result<{Entity}>>
export async function get{Entity}(id: string): Promise<{Entity} | null>
export async function get{Entity}List(filters: Filters): Promise<PaginatedResult<{Entity}>>
export async function update{Entity}(id: string, data: Update{Entity}Input): Promise<Result<{Entity}>>
export async function delete{Entity}(id: string): Promise<Result<void>>
```

### Input/Output Types

```typescript
export interface Create{Entity}Input {
  // ... fields
}

export interface Update{Entity}Input {
  // ... fields
}

export interface Filters {
  status?: string;
  page?: number;
  limit?: number;
}
```

---

## [DES-FILES] File Structure

### New Files to Create

| File                                                               | Purpose                   |
| ------------------------------------------------------------------ | ------------------------- |
| `packages/db/src/core/models/{entity}.model.ts`                    | Domain model              |
| `packages/db/src/core/repositories/{entity}.repository.ts`         | Repository interface      |
| `packages/db/src/adapters/{adapter}/{entity}.repository.ts`        | Repository implementation |
| `packages/db/src/core/services/{entity}.service.ts`                | Service layer             |
| `apps/{app}/src/app/(group)/{feature}/_actions/{entity}.action.ts` | Server actions            |

### Files to Modify

| File                          | Changes                       |
| ----------------------------- | ----------------------------- |
| `packages/db/src/index.ts`    | Export new service factory    |
| `packages/configs/src/env.ts` | Add new environment variables |

---

## [DES-DEPS] Dependencies

### External Packages

| Package   | Version | Purpose   |
| --------- | ------- | --------- |
| {package} | ^x.y.z  | {purpose} |

### Internal Packages

| Package           | Purpose             |
| ----------------- | ------------------- |
| `@package/db`     | Database access     |
| `@package/s3`     | File storage        |
| `@package/mailer` | Email notifications |

---

## [DES-SEC] Security Considerations

- {Security consideration 1}
- {Security consideration 2}
- {Authentication/authorization requirements}

---

## [DES-ERR] Error Handling

| Scenario           | Handling           |
| ------------------ | ------------------ |
| {Error scenario 1} | {How it's handled} |
| {Error scenario 2} | {How it's handled} |

---

## [DES-TEST] Testing Strategy

### Unit Tests

- {What will be unit tested}
- {Mock strategy}

### Integration Tests

- {What will be integration tested}

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: {Phase Name}

1. {Step 1}
2. {Step 2}
3. {Step 3}

### Rollback Plan

{How to rollback if issues arise}

---

## File Reference Map

Track implementation files and their required `@see` references for traceability.

| Task  | File                                                               | Required @see        |
| ----- | ------------------------------------------------------------------ | -------------------- |
| {X.Y} | `packages/db/src/core/models/{entity}.model.ts`                    | design.md [DES-DATA] |
| {X.Y} | `packages/db/src/core/repositories/{entity}.repository.ts`         | design.md [DES-DATA] |
| {X.Y} | `packages/db/src/adapters/{adapter}/{entity}.repository.ts`        | design.md [DES-DATA] |
| {X.Y} | `packages/db/src/core/services/{entity}.service.ts`                | design.md [DES-API]  |
| {X.Y} | `apps/{app}/src/app/(group)/{feature}/_actions/{entity}.action.ts` | design.md [DES-API]  |

**Usage:**

- Fill in task numbers from tasks.md
- Update file paths for your feature
- Use Node ID syntax: `@see docs/specs/{feature}/design.md [DES-API]`
- Verify files have required `@see` references before marking task complete

---

## Open Technical Questions

| #   | Question             | Status |
| --- | -------------------- | ------ |
| 1   | {Technical question} | Open   |
