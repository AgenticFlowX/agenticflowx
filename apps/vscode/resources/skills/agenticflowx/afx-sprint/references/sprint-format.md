# afx-sprint — Format, Usage & Vocabulary

Single-document SDD format reference: configuration, the command surface, approval gates, purpose, canonical vocabulary, and documentation principles.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` — where feature directories live (default: `docs/specs`)

If neither file exists, use defaults.

## Usage

Every subcommand accepts optional trailing **`[...context]`** — natural-language intent that supplements the command. Use it to pass refinement asks, focus hints, clarifications, or decisions directly on the command line rather than going through a prompt-reply loop.

```bash
/afx-sprint new <feature> [...context]                  # Scaffold; context seeds initial Spec content
/afx-sprint refine [feature] [spec|design|task] [...context] # Alias: refine inferred or explicit section
/afx-sprint spec [feature] [...context]                 # Refine Spec section with context as the ask
/afx-sprint spec [feature] --approve [...context]       # Approve Spec; context captured as approval note
/afx-sprint design [feature] [...context]               # Refine Design section (gated on spec Approved)
/afx-sprint design [feature] --approve [...context]     # Approve Design
/afx-sprint task [feature] [...context]                 # Refine Tasks section (gated on design Approved)
/afx-sprint task [feature] --approve [...context]       # Approve Tasks (unlocks code)
/afx-sprint code [feature] [task-id] [...context]       # Implement — gated on all three Approved; delegates to /afx-task code
/afx-sprint verify [feature] [...context]               # Sanity-check; context narrows focus (e.g., "only anchors")
/afx-sprint graduate [feature] [...context]             # Split to 4-file; context captured in graduation journal entry
```

`<feature>` is a kebab-case slug. When omitted, feature is inferred from IDE active file, branch, or cwd.

**Trailing context examples:**

```bash
/afx-sprint spec dark-mode tighten FR-2 to specify keyboard shortcut
/afx-sprint refine dark-mode spec tighten FR-2 to specify keyboard shortcut
/afx-sprint design dark-mode "use CSS variables, not data attributes — faster paint"
/afx-sprint task dark-mode cover [DES-TOKENS] with a dedicated phase
/afx-sprint code dark-mode 3.1 start with the theme provider, skip persistence for now
/afx-sprint verify dark-mode --focus anchors
```

## Approval Gates

Sprint preserves AFX's staged-approval discipline in a single file via the `approval` block in frontmatter:

```yaml
approval:
  spec: Draft # or Approved
  design: Draft # gated on spec: Approved
  tasks: Draft # gated on design: Approved
```

**Gate rules** (enforced by subcommands):

| Subcommand | Prerequisite                                                  | Effect of `--approve` flag         |
| ---------- | ------------------------------------------------------------- | ---------------------------------- |
| `spec`     | none                                                          | `approval.spec` → `Approved`       |
| `design`   | `approval.spec == Approved`                                   | `approval.design` → `Approved`     |
| `task`     | `approval.spec == Approved` AND `approval.design == Approved` | `approval.tasks` → `Approved`      |
| `code`     | all three `Approved`                                          | n/a (implementation, not approval) |
| `graduate` | all three `Approved` AND `/afx-sprint verify` passes          | n/a (splits to 4-file)             |

Top-level `status` in frontmatter reflects the overall sprint state:

- `Draft` — any section still Draft
- `Approved` — all three sections Approved (set automatically when the `task --approve` transition completes the trio)
- `Superseded` — replaced by a newer approved revision

Implementation does not change an approved sprint's status; it remains `Approved`. "Living documentation" is a principle, not a stored status.

Re-approval after edits: if a section is edited _after_ being Approved, the subcommand demotes it back to `Draft` and demotes any downstream sections (e.g., editing an approved Spec demotes Design and Tasks to Draft). The user must re-approve in order. This enforces the same discipline as the 4-file flow where changing `spec.md` invalidates downstream artifacts.

## Purpose

Compress the full SDD discipline into a single document without losing traceability. The same FR/DES anchors, the same `@see` linking rules, the same two-stage Agent + Human verification — just in one file instead of three. When the work is surgical, one file is faster to write, read, and keep coherent.

The skill treats the single doc as a **tactical unit** that can graduate into the strategic 4-file structure once scope is proven. Until then, ceremony is minimal.

## SDD Vocabulary (CANONICAL)

Use these terms consistently across AFX skills, docs, chat actions, and UI surfaces:

- **Refine**: improve living artifact content. In `/afx-sprint`, this maps to `refine` (dispatcher alias) plus `spec`, `design`, and `task` section edits.
- **Validate**: check structural, parser, template, frontmatter, anchor, and approval-state correctness.
- **Review**: apply LLM judgment for quality, readiness, ambiguity, risk, and missing coverage.
- **Verify**: check implementation or sprint readiness evidence against approved intent. `/afx-sprint verify` is the pre-code sanity check; `/afx-task verify` handles task implementation evidence.
- **Approve**: advance a section gate in order: Spec -> Design -> Tasks.
- **Evolve**: handle post-ship feature, bug, or change work by refining the living sprint doc or graduating when scope grows, while capturing history in `journal.md` and Work Sessions.

## Documentation Principles

- Sprint format is living state while active: the Spec, Design, and Tasks sections represent current truth for small work.
- `journal.md` captures decisions, amendments, production notes, and change rationale.
- Work Sessions capture execution history.
- Do not introduce amendment directories or new artifact types for ordinary feature evolution; refine the sprint doc or graduate to the 4-file flow when the work outgrows single-doc SDD.

## Related Commands

| Command         | Relationship                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `/afx-task`     | `code` subcommand delegates here; `validate` / `verify` become fully compatible after graduation |
| `/afx-spec`     | Graduation target for spec.md; `validate` is recommended after graduation                        |
| `/afx-design`   | Graduation target for design.md                                                                  |
| `/afx-session`  | `journal.md` is shared — sprint feeds the same capture stream                                    |
| `/afx-context`  | Handoff bundles should include `<feature>.md` + `journal.md` while sprint format is active       |
| `/afx-check`    | `trace` works during sprint mode; `links` / `coverage` become fully compatible after graduation  |
| `/afx-scaffold` | Complementary: `afx-scaffold spec <name>` for full 4-file; this for single                       |
