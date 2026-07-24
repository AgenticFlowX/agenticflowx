# code {id}

**Purpose:** The shared implementation engine. Load the context appropriate to the task artifact and write code with `@see` traceability.

**Absorbed from:** `afx-dev code`

**Implementation:**

1. **Resolve the task artifact**
   - **Standard SDD:** `tasks.md` containing the selected `### N.N` task group.
   - **Dash:** `<feature>.md` with `type: DASH` containing the selected `### N.N` task group.
   - Reject any other single-document type rather than guessing.

2. **Load Context**
   - **Standard SDD:** read the selected task group, its mapped requirements/design anchors, and only the relevant sections of `spec.md` and `design.md`.
   - **Dash:** read frontmatter, Purpose, the selected task group and criteria, file scope, dependencies, and Work Sessions. Do not require or invent `spec.md`/`design.md`.
   - Read existing source code to understand current patterns and architecture.

3. **Implement**
   - Write source code fulfilling the task requirements
   - Follow existing code patterns and architecture in the project
   - Run build/test/lint as needed

**`code all <name>` variant:** Resolve the feature's `tasks.md`, collect task-group IDs with at least one unchecked completion criterion in document order, and run the same `code {id}` implementation flow for each task one at a time. Stop after the first failed build/test/verification gate and report the next remaining task instead of continuing blindly.

## Code Drift Guardrail (MANDATORY)

During implementation, if you discover that the requested logic fundamentally conflicts with the codebase, introduces severe edge cases unaccounted for in `design.md`, or requires >5 lines of unmapped complex logic:

1. **STOP CODING.** Do not hack around the design or unilaterally invent new architecture.
2. **Proactive Capture:** Log the drift in `journal.md` detailing the discrepancy, the impact, and your recommended architectural course correction.
3. **Escalate:** Stop execution and prompt the user: _"I've hit a logic conflict with the design. See `journal.md` for my analysis. We need to update the design via `/afx-design` or `/afx-spec` before I can continue coding this task."_
4. **Resume:** Once the user updates the source of truth, resume the `/afx-task code {id}` command.

5. **Add `@see` Annotations** (class and function level):

   ```typescript
   /**
    * User authentication service
    *
    * @see docs/specs/user-auth/design.md [DES-API]
    * @see docs/specs/user-auth/tasks.md [2.1]
    */
   export class AuthService {
     /**
      * @see docs/specs/user-auth/spec.md [FR-1]
      * @see docs/specs/user-auth/design.md [DES-SEC]
      */
     async login(credentials: LoginInput): Promise<AuthResult> {
       // implementation
     }
   }
   ```

   **Annotation Rules:**
   - Annotate exported classes, interfaces, and functions that fulfill spec requirements
   - Use Node ID syntax: `@see path/to/file.md [NODE-ID]`
   - Line-level annotations ONLY for non-obvious requirement implementations
   - **NEVER** dump blanket `@see` at the top of the file
   - **NEVER** annotate every line — that creates noise

6. **Update the resolved task artifact**:
   - Mark the task criteria `[x]` only after implementation and its stated checks pass.
   - **Locate `## Work Sessions`** at the bottom of `tasks.md` or the Dash. Append a `Coded` row with the files you modified:

     ```markdown
     | 2026-03-31 | {id} | Coded | auth.service.ts, auth.action.ts | [x] | [] |
     ```

   - Update `updated_at`.
   - For standard SDD, annotate against `tasks.md [N.N]` plus relevant FR/DES nodes.
   - For Dash, annotate against `docs/specs/<feature>/<feature>.md [N.N]`; do not invent FR/DES nodes.
