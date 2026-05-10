---
name: afx-design
description: Design authoring — generate, validate, review, and approve technical design documents (design.md)
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,design,architecture,validation,lifecycle"
  afx-argument-hint: "author | refine | validate | review | approve"
  modeSlugs:
    - focus-review-design
    - architect
---

# /afx-design

Technical design authoring, validation, review, and approval for `design.md` artifacts.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)

If neither file exists, use defaults.

## Usage

```bash
/afx-design author <name>                  # Generate design.md from approved spec
/afx-design refine <name>                  # Alias: refine or draft design.md from approved spec
/afx-design validate <name>                # Check design structure and traceability
/afx-design review <name>                  # Advisory quality check for design gaps
/afx-design approve <name>                 # Approve design (unlocks task planning)
```

## Purpose

Owns the `design.md` artifact exclusively. Handles design authoring from approved specs, structural validation, quality review, and approval gating that unlocks the task planning phase.

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve living artifact content. In `/afx-design`, this maps to `refine` (preferred alias), `author` (legacy-compatible initial draft), and targeted updates to `design.md`.
- **Validate**: check structural, parser, template, frontmatter, and traceability correctness.
- **Review**: apply LLM judgment for architecture quality, readiness, ambiguity, risk, and missing decisions.
- **Verify**: check implementation evidence against approved intent. This belongs to `/afx-task verify` and `/afx-check`, not `/afx-design`.
- **Approve**: advance a lifecycle gate after validation and review.
- **Evolve**: handle post-ship feature, bug, or change work by refining living docs and capturing history in `journal.md` / `tasks.md`.

## Documentation Principles

- `spec.md` and `design.md` are living documents: they represent current product and technical truth.
- `journal.md` captures decisions, amendments, production notes, and change rationale.
- `tasks.md` captures execution plan and work sessions.
- Do not introduce amendment directories or new artifact types for ordinary feature evolution; update the living docs and preserve history in the log artifacts.

---

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace (including source code for context)
- Create/update `design.md` only in `docs/specs/**/`
- Append to `docs/specs/**/journal.md` (captures only, via Proactive Capture Protocol)

### Forbidden

- Create/modify/delete source code in application directories
- Create/modify/delete `spec.md` (owned by `/afx-spec`)
- Create/modify/delete `tasks.md` (owned by `/afx-task`)
- Create/modify/delete folders or any non-design spec files
- Delete any files or directories
- Run build/test/deploy/migration commands
- Modify `.afx.yaml` or `.afx/` configuration
- **Destructive File Rewrites**: Never replace the entire contents of an existing `design.md` or `journal.md` file using a full-file rewrite. Always use targeted line-level replacements or append actions to preserve manually written human content.

If out-of-scope work is requested, return:

```text
Out of scope for /afx-design (design-management mode). Use /afx-spec for spec changes, /afx-task for task planning.
```

---

### Timestamp Format (MANDATORY)

All timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Frontmatter (MANDATORY)

When creating or modifying `design.md`, enforce the canonical AFX frontmatter schema:

```yaml
---
afx: true
type: DESIGN
status: Draft
owner: "@handle"
version: "1.0"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: ["{feature}"]
spec: spec.md
---
```

**Canonical field order**: `afx → type → status → owner → version → created_at → updated_at → tags → spec`. Use double quotes for all string values.

**Immutable fields** (must NOT be changed during approval): `afx`, `type`, `owner`, `created_at`.

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-design`**: Design decision with significant trade-offs, architecture change from original spec intent, approval with conditions.

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): new `[DES-X]` section added, Key Decisions table entry changed, architecture pivot. After applying the edit, run the [Significance Check](../afx-session/SKILL.md#significance-check-context-aware-gate) first — skip silently for cosmetic edits. Only call `/afx-session capture --trigger design-pivot --links <DES-anchor>` when the change encodes a real decision or reversal. See [Prompt Capture Triggers](../afx-session/SKILL.md#prompt-capture-triggers-propose--confirm).

---

## Lifecycle Precondition (BLOCKING)

**CRITICAL**: Design authoring is gated behind spec approval.

| Action    | Precondition                   | Check                    |
| --------- | ------------------------------ | ------------------------ |
| `author`  | `spec.md` status == `Approved` | Read spec.md frontmatter |
| `refine`  | `spec.md` status == `Approved` | Read spec.md frontmatter |
| `approve` | `design.md` has content        | Check design is authored |

Before authoring or approving, the agent **MUST**:

1. Read `spec.md` frontmatter for the target feature
2. Check the `status` field
3. If `status` is NOT `Approved`, **STOP** and output:

```text
BLOCKED: Cannot author design.md content.

Precondition not met:
  spec.md status is "{current_status}" (required: "Approved")

Approve the spec first:
  /afx-spec review {name}
  /afx-spec approve {name}
```

---

## Post-Action Checklist (MANDATORY)

After completing any action that modifies `design.md`, you MUST:

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in `design.md` frontmatter.
2. **Verify `spec` backlink**: Ensure `spec: spec.md` is present in frontmatter.
3. **Contextual Tagging**: If changes introduce new domains, frameworks, or concepts (e.g., adding Redis, a new API pattern), append relevant keywords to the `tags` array.
4. **Version & State Management**: If modifying a `design.md` that is currently `status: Approved`, evaluate the change. If it alters architecture or scope, bump `version` (e.g., "1.0" → "1.1") and revert `status: Draft` to force re-approval.
5. **Format Preservation**: Frontmatter fields must remain in canonical order (see **Frontmatter (MANDATORY)** section). Use double quotes for all string values.
6. **Template & Node ID Check**: Verify all 12 required `[DES-*]` sections are present, each `##` heading starts with a unique `[DES-ID]` node ID, and no IDs are duplicated. Custom sections allowed but required ones must not be omitted. See **Template Format Rules (CRITICAL)** section for the canonical list and format.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/design.md` → `user-auth`). If code is selected, use it as reference context for the design authoring.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Require explicit `<name>` — design authoring needs a target feature.
3. **Trailing parameters (`[...context]`):** Treat extra words as design constraints (e.g., `/afx-design refine auth redis cache` or `/afx-design author auth redis cache` → generate/update the design using Redis for caching). Do not discard trailing text; incorporate it into the authoring or review logic.

### Persistence Checkpoint (MANDATORY)

Do not auto-write design files. Before persisting any changes to `design.md`:

1. Present the proposed content to the user
2. Wait for explicit confirmation before writing
3. `journal.md` append-only entries may be written without checkpoint

### Next Command Suggestion (MANDATORY)

After EVERY `/afx-design` action, suggest the next command:

| Context                             | Suggested Next Command                          |
| ----------------------------------- | ----------------------------------------------- |
| After `author`                      | `/afx-design review <name>` to validate quality |
| After `refine`                      | `/afx-design review <name>` to validate quality |
| After `validate` (passed)           | `/afx-design review <name>` for quality check   |
| After `validate` (failed)           | Fix listed structural issues                    |
| After `review` (critical issues)    | Fix issues, then `/afx-design validate <name>`  |
| After `review` (no critical issues) | `/afx-design approve <name>` to approve design  |
| After `approve`                     | `/afx-task refine <name>` to generate/refine tasks |

**UI Action Block (ADDITIVE):** Preserve the text-only next-command suggestion. When the next moves include concrete `/afx-*` commands with resolved targets, also emit a marker-wrapped fenced JSON array immediately after the prose. Include at most three actions and omit non-command advice.

````markdown
<!-- AFX-UI-ACTIONS:START -->

```json
[
  {
    "rank": 1,
    "label": "Approve design",
    "command": "/afx-design approve onboarding",
    "mode": "run",
    "reason": "Review found no critical design issues.",
    "vocabulary": "Approve = advance a lifecycle gate."
  },
  {
    "rank": 2,
    "label": "Review design",
    "command": "/afx-design review onboarding",
    "mode": "insert",
    "reason": "Use this before approval if anything changed.",
    "vocabulary": "Review = apply quality judgment for readiness and risk."
  }
]
```

<!-- AFX-UI-ACTIONS:END -->
````

### Interactive Lifecycle Actions (MANDATORY)

When the agent detects a lifecycle gate is actionable after completing work, use `ask_followup_question` to present options as clickable buttons instead of text-only suggestions.

**Trigger conditions:**

| Condition                                                                         | Question                                                                       | Options                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| After `review` with 0 Critical issues                                             | "Design has no critical issues. Ready to approve?"                             | "Approve design" / "Review again" / "Not now"     |
| After `review` with Critical issues found                                         | "Critical issues found that should be fixed before approval."                  | "Fix issues" / "Review again" / "Not now"         |
| After `author` completes                                                          | "Design authored. Want to review it?"                                          | "Review design" / "Continue editing" / "Not now"  |
| After `validate` passes (all checks ✓)                                            | "Validation passed. Want a quality review?"                                    | "Review design" / "Approve design" / "Not now"    |
| After `validate` fails (structural issues)                                        | "Validation found structural issues. Fix them now?"                            | "Show issues" / "Not now"                         |
| After `approve` completes successfully                                            | "Design approved. Task planning is now unlocked."                              | "Plan tasks" / "Not now"                          |
| design.md is Draft + spec.md is Approved (detected during any action)             | "Design is ready for approval. Approving unlocks task planning."               | "Approve design" / "Review first" / "Not now"     |
| spec.md is Approved + no design.md exists (detected during any action)            | "Approved spec found with no design yet. Ready to author?"                     | "Author design" / "Not now"                       |
| design.md is Approved + has been modified (version bump triggered status → Draft) | "Approved design was modified. Status reverted to Draft — re-approval needed." | "Re-approve design" / "Review first" / "Not now"  |
| spec.md `updated_at` > design.md `updated_at` (detected during any action)        | "Spec was updated after this design was written. Design may be stale."         | "Review design" / "Diff spec changes" / "Not now" |

**Rules:**

- Only trigger when the lifecycle gate is actually actionable (preconditions met)
- Include "Not now" as the last option — never force the user
- If user selects an action, execute it immediately (run the approval/review flow)
- If user selects "Not now", continue normally — do not re-ask in the same conversation
- Keep existing text-only "Next Command Suggestion" for non-lifecycle contexts
- These buttons complement, not replace, the text suggestions

---

## Template Format Rules (CRITICAL)

The AFX `design.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it to extract sections and node IDs. Deviations cause **silent failures** in tools that render designs (e.g., the VS Code extension fails to display sections). These rules define the canonical format — custom sections are allowed but required ones must not be omitted.

**Template reference:** `assets/design-template.md`

### Section Headings

Heading levels determine what AFX parsers can see:

- `#` (h1): Document title only — `# {Feature Name} — Design`
- `##` (h2): Major design sections — **captured by AFX parsers**, MUST include `[DES-ID]` node ID
- `###` (h3): Sub-sections — **captured by AFX parsers**
- `####` and deeper: **NOT captured** — do not use for sections that need to be visible to AFX tools

### Required Sections with Node IDs

All `design.md` files MUST contain these `##` sections with their `[DES-ID]` anchors:

| #   | Heading                                     | Node ID         |
| --- | ------------------------------------------- | --------------- |
| 1   | `## [DES-OVR] Overview`                     | `[DES-OVR]`     |
| 2   | `## [DES-ARCH] Architecture`                | `[DES-ARCH]`    |
| 3   | `## [DES-UI] User Interface & UX`           | `[DES-UI]`      |
| 4   | `## [DES-DEC] Key Decisions`                | `[DES-DEC]`     |
| 5   | `## [DES-DATA] Data Model`                  | `[DES-DATA]`    |
| 6   | `## [DES-API] API Contracts`                | `[DES-API]`     |
| 7   | `## [DES-FILES] File Structure`             | `[DES-FILES]`   |
| 8   | `## [DES-DEPS] Dependencies`                | `[DES-DEPS]`    |
| 9   | `## [DES-SEC] Security Considerations`      | `[DES-SEC]`     |
| 10  | `## [DES-ERR] Error Handling`               | `[DES-ERR]`     |
| 11  | `## [DES-TEST] Testing Strategy`            | `[DES-TEST]`    |
| 12  | `## [DES-ROLLOUT] Migration / Rollout Plan` | `[DES-ROLLOUT]` |

Optional: `## File Reference Map`, `## Open Technical Questions`

### Node ID Format

- Uppercase kebab-case inside square brackets: `[DES-API]`, `[DES-DATA]`
- MUST appear at the **start** of the `##` heading: `## [DES-API] API Contracts`
- Each ID MUST be unique within the file — no duplicates
- These IDs are referenced by `@see` annotations in source code and tasks.md
- **NOT**: `## API Contracts` (missing ID), `## API Contracts [DES-API]` (ID at end), `## [des-api]` (lowercase)

### Frontmatter

See **Frontmatter (MANDATORY)** section above for canonical field order and full schema. `type` MUST be `DESIGN`, `spec: spec.md` backlink is mandatory.

---

## Subcommands

### refine <name>

**Purpose:** Preferred alias for `author`; refine or draft `design.md` from an approved spec.

**Behavior:** Execute the same core flow as `author <name>`. If `design.md` is empty or scaffold-only, draft the design from the approved spec. If `design.md` already has content, perform targeted refinement that preserves existing human-written sections, follows the Persistence Checkpoint, and demotes approval only when the change alters architecture or scope.

Keep `author` supported indefinitely for compatibility, but prefer `refine` in new UI labels, help text, and examples.

### author <name>

**Purpose:** Generate technical design document from approved spec.

**Lifecycle Gate:** `spec.md` status MUST be `Approved`.

**Implementation:**

1. **Read Approved Spec**
   - Load `spec.md` — extract requirements (FR-xxx, NFR-xxx), user stories, acceptance criteria, dependencies
   - Load `journal.md` — extract any design discussions or decisions already captured
   - Read source code if relevant — understand existing patterns and architecture

2. **Generate Design Content** using the design template (`assets/design-template.md`):
   - `## [DES-OVR] Overview` — brief technical approach summary
   - `## [DES-ARCH] Architecture` — system context, component diagram
   - `## [DES-UI] User Interface & UX` — component composition (if applicable)
   - `## [DES-DEC] Key Decisions` — decision table with rationale
   - `## [DES-DATA] Data Model` — schemas, TypeScript interfaces
   - `## [DES-API] API Contracts` — server actions, input/output types
   - `## [DES-FILES] File Structure` — new files and modifications
   - `## [DES-DEPS] Dependencies` — external and internal packages
   - `## [DES-SEC] Security Considerations`
   - `## [DES-ERR] Error Handling`
   - `## [DES-TEST] Testing Strategy`
   - `## [DES-ROLLOUT] Migration / Rollout Plan`
   - Every section MUST link back to spec requirements via `@see` with Node IDs

3. **Persistence Checkpoint** (MANDATORY)
   - Present the proposed design.md content to the user
   - Wait for explicit confirmation before writing

4. **Write design.md**
   - Replace scaffold content with authored design
   - Preserve frontmatter, update `updated_at`
   - Ensure `spec: spec.md` backlink is present

5. **Update journal.md** — append entry recording design authoring session

**`@see` Annotation Format in design.md:**

```markdown
## [DES-API] API Contracts

<!-- @see spec.md [FR-1] [FR-2] -->

{Design content referencing these requirements}
```

---

### validate <name>

**Purpose:** Structural compliance check for design.md — deterministic, blocking for approval.

**Implementation:**

1. **File Existence**: Check `design.md` exists at `docs/specs/<name>/design.md`
2. **Frontmatter Validation**:
   - Has `afx: true`, `type: DESIGN`, `status` field
   - Has `spec: spec.md` backlink
   - Has `version` (quoted string)
   - Has `created_at` and `updated_at` (non-midnight timestamps)
   - Field order is canonical
3. **Node ID Check**:
   - Every `##` heading has a `[DES-ID]` prefix
   - No duplicate Node IDs within the file
4. **Template Section Compliance**: Check all 12 required `[DES-*]` sections exist (see **Template Format Rules** → Required Sections with Node IDs for the canonical list)
5. **Traceability Check**: At least one `@see spec.md [FR-X]` or `[NFR-X]` reference exists

**Output:**

```
Validation: user-authentication (design.md)

Frontmatter: ✓ Valid (DESIGN, spec backlink present)
Node IDs: ✓ All sections have [DES-ID], no duplicates
Template Sections: ✓ All 9 required sections present
Traceability: ✓ 12 @see links to spec requirements

Status: PASSED
```

---

### review <name>

**Purpose:** Advisory content quality check — requires agent judgment, not blocking.

**Implementation:**

1. **FR Completeness**: Does the design cover ALL functional requirements (FR-_) from spec.md? Cross-reference every FR-N ID in the spec requirements table against design sections — each must have at least one DES-_ section addressing it.
2. **NFR Completeness**: Does the design cover ALL non-functional requirements (NFR-_) from spec.md? Cross-reference every NFR-N ID in the spec requirements table against design sections — each must have at least one DES-_ section or explicit mention. Do NOT rely on named categories alone (performance, security, etc.) — check the actual NFR IDs.
3. **Acceptance Criteria Coverage**: Does spec.md have acceptance criteria for every FR and NFR? If a requirement has no acceptance criteria section, flag it as a gap.
4. **Error Boundaries**: Are error scenarios defined for each component?
5. **Consistency**: Does design terminology match spec terminology?
6. **Living Document Purity**: No historical narrative (belongs in journal.md)
7. **Risk Analysis**: High-risk components identified? External dependency SLAs documented?
8. **Cross-Spec Impact**: If `spec.md` has `depends_on`, check that design addresses integration points

**Output:**

```
Review: user-authentication (design.md)

Score: 85% compliant

Critical Issues (0): None

Major Issues (2):
  [GAP] NFR-3 (accessibility) not addressed in design
  [CONSISTENCY] design.md uses "login" but spec.md uses "authentication"

Minor Issues (3):
  [QUALITY] [DES-ERR] Error handling table missing timeout scenarios
  [RISK] External dependency: SendGrid SLA not documented
  [QUALITY] [DES-TEST] Testing strategy lacks integration test plan

Recommendations:
  1. Add accessibility section or note in [DES-UI]
  2. Standardize terminology to "authentication"
```

---

### approve <name>

**Purpose:** Mark design.md as approved, unlocking task planning.

**Implementation:**

1. **Check Precondition**: `spec.md` status must be `Approved`
2. **Check Current Status**: If `design.md` already `Approved`, exit with error
3. **Run Validation**: Execute `/afx-design validate <name>` — if structural issues exist, **BLOCK**
4. **Run Review**: Execute `/afx-design review <name>` — report quality issues (advisory, not blocking)
5. **Approve**:
   - Update `design.md` frontmatter: `status: Draft → Approved`, add `approved_at`, update `updated_at`
   - Add journal entry recording approval
6. **Output**:

```text
Approved: user-authentication (design.md)

✓ spec.md is Approved (precondition met)
✓ Structural validation passed
✓ Status changed: Draft → Approved
✓ /afx-task plan UNLOCKED
✓ Journal updated with approval record

Note: 2 Major and 3 Minor quality issues remain. Address in future versions if needed.

Next: /afx-task plan user-authentication
```

---

## Error Handling

### Common Errors

1. **Spec Not Approved**

   ```text
   BLOCKED: Cannot author design.md content.

   Precondition not met:
     spec.md status is "Draft" (required: "Approved")

   Approve the spec first:
     /afx-spec review {name}
     /afx-spec approve {name}
   ```

2. **Design Already Approved**

   ```text
   Error: design.md already approved.

   To modify an approved design:
     1. Bump version in design.md (e.g., "1.0" → "1.1")
     2. Set status back to Draft
     3. Make changes
     4. Run /afx-design approve {name} again
   ```

3. **Validation Failed**

   ```text
   Approval BLOCKED: user-authentication (design.md)

   Structural issues found:
     ✗ Missing [DES-SEC] Security Considerations section
     ✗ No @see links to spec requirements

   Fix these issues, then run:
     /afx-design validate {name}
     /afx-design approve {name}
   ```

---

## Related Commands

### From Other Commands → `/afx-design`

- `/afx-spec approve` → Suggest `/afx-design refine <name>`
- `/afx-check links` → Suggest `/afx-design validate <name>` for design link check

### From `/afx-design` → Other Commands

- `/afx-design approve` → Suggest `/afx-task refine <name>`
- `/afx-design review` (issues found) → Suggest `/afx-design validate <name>` after fixes
