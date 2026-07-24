# plan <name>

**Purpose:** Generate implementation task breakdown from approved design.

**Lifecycle Gate:** `design.md` status MUST be `Approved`.

**Implementation:**

1. **Read Approved Spec + Design**
   - Load `spec.md` — extract requirements for traceability
   - Load `design.md` — extract components, interfaces, data models, Node IDs
   - Load `journal.md` — extract any task-related decisions

2. **Design Feedback** (advisory — does not block planning)

   Scan `design.md` for gaps that will affect task quality. For each major design section, check if it has substantive content (not just placeholder text). Report findings before generating tasks:

   ```
   Design Feedback:
     ⚠ [DES-ERR] Error handling section is empty — tasks will define error cases inline
     ⚠ [DES-TEST] No integration test strategy specified
     ✓ [DES-API] API contracts well-defined
     ✓ [DES-DATA] Data model complete

   Recommendation: /afx-design review {name} to address gaps before finalizing tasks
   ```

   If critical sections are empty (`[DES-ARCH]`, `[DES-API]`, `[DES-DATA]`), warn the user but continue — do not block.

3. **Generate Task Breakdown** using the tasks template (`assets/tasks-template.md`):

   **FORMAT ENFORCEMENT** — AFX parsers (CLI, the VS Code extension, and any other AFX-aware tool) will silently break if these are violated. See **Template Format Rules (CRITICAL)** (`references/task-format.md`) for the full regex reference.
   - Phase headers MUST be `## Phase N: {Name}` (h2, the word "Phase", a digit, colon, name)
   - Each `### N.N {Task Group Name}` heading is one dispatchable task with a stable WBS ID
   - Completion-criteria checkboxes MUST be `- [ ] {text}` at column 0 — NO indentation, NO bold task ID prefix
   - Each `- [ ]` line is one completion criterion for its enclosing task group; nested notes/evidence MUST NOT use checkboxes
   - Section order: Phases first, then Cross-Reference Index, then Work Sessions (last)
   - Cross-Reference Index MUST come AFTER all Phase sections, never before

   **Task content requirements:**
   - Organize into phases (setup, core, integration, testing, docs)
   - Each task group must have:
     - WBS numbering (Phase.Task, e.g., `1.1`, `2.3`)
     - Clear description of what to implement
     - File scope — list the specific files this task creates or modifies (use `<!-- files: ... -->` comment)
     - `@see` links using Node ID syntax with **full paths** (use `<!-- @see docs/specs/{feature}/design.md [DES-API] | docs/specs/{feature}/spec.md [FR-1] -->` comment)
     - One or more completion criteria — column-zero checkboxes; supporting detail/evidence may use plain indented sub-items
   - **Parallelization**: Tasks within a phase should be **independent by default** — no shared mutable state, no file overlap. When two tasks in the same phase DO depend on each other, note the dependency explicitly: `<!-- depends: 1.1 -->`. Cross-phase dependencies are implicit (phase N depends on phase N-1).
   - Order phases by dependency (setup before core, core before integration)
   - Generate Cross-Reference Index table linking tasks → spec requirements → design sections

4. **Persistence Checkpoint** (MANDATORY) — present to user, wait for confirmation

5. **Write tasks.md** — replace scaffold, preserve frontmatter, update `updated_at`, set backlinks

6. **Update journal.md** — append entry recording task planning session
