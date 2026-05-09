---
name: afx-research
description: Research workflow — discovery, comparison, summarization, and promotion of research artifacts to ADR/spec
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,research,discovery,analysis,adr"
  afx-argument-hint: "explore | compare | summarize | finalize"
  modeSlugs:
    - focus-research
    - architect
---

# /afx-research

Research workflow for AgenticFlowX with prompt-first intent routing.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADR files live (default: `docs/adr`)
- `library.research` - Global research library path (default: `docs/research`)
- `paths.research` - Legacy/optional override for research path (fallback only)

If neither file exists, use defaults.

## Usage

```bash
/afx-research explore <topic-or-prompt>
/afx-research compare <topic-or-prompt>
/afx-research summarize <topic-or-prompt>
/afx-research finalize <topic-or-prompt> --to adr|spec [--feature <name>]
```

## Purpose

Run discovery and analysis work **without coding**. This command is for research artifacts, option analysis, and recommendation synthesis that stay inside the AFX docs ecosystem.

## Living-Doc Boundary

Research artifacts preserve investigation history. When research is finalized into a spec or design, promote only the current decision, requirement, or constraint into the living `spec.md` / `design.md`; keep discarded options, chronology, and evidence in research or `journal.md`.

---

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Create/update markdown artifacts only in:
  - `docs/research/**`
  - `docs/specs/**`
  - `docs/adr/**`
- Include illustrative code snippets inside markdown documents

### Forbidden

- Create/modify/delete source code in application directories
- Delete any files or folder
- Run build/test/deploy/migration commands
- Modify runtime config used by application execution

If user asks for implementation, respond with:

```text
Out of scope for /afx-research (research-only mode). Use /afx-dev code after a spec/ADR decision is finalized.
```

### Proactive Journal Capture

When this skill detects a high-impact context change, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-research`**: Research finding that invalidates assumption, technology limitation discovered.

**Prompt-capture triggers** (propose + confirm via `/afx-session capture`): a finding that invalidates a spec assumption or changes a design direction. After updating the research doc, run the [Significance Check](../afx-session/SKILL.md#significance-check-context-aware-gate) first — skip silently for cosmetic edits. Only call `/afx-session capture --trigger design-pivot|missed-req --links <research-slug>` when the finding genuinely shifts direction. See [Prompt Capture Triggers](../afx-session/SKILL.md#prompt-capture-triggers-propose--confirm).

## Post-Action Checklist (MANDATORY)

After creating or modifying any research or ADR file, you MUST:

1. **Update `updated_at`**: Set to current ISO 8601 timestamp in frontmatter.
2. **Canonical Frontmatter**: Use `type: RES` for research, `type: ADR` for ADRs. Field order: `afx → type → status → owner → version → created_at → updated_at → tags → [superseded_by]`. Double quotes for all string values.
3. **Contextual Tagging**: If research introduces new domains or technologies, append relevant keywords to `tags` array.
4. **Format Preservation**: Maintain canonical field order. Use double quotes.

### Timestamp Format (MANDATORY)

When creating or updating research artifacts, ADRs, spec drafts, or frontmatter (`updated_at`, `created_at`), all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17` or `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

### Frontmatter (MANDATORY)

All research artifacts created by this skill MUST follow `assets/research-template.md` for canonical structure. Required frontmatter:

```yaml
---
afx: true
type: RES
status: Living
owner: "@handle"
created_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
updated_at: "YYYY-MM-DDTHH:MM:SS.mmmZ"
tags: [research, <dynamic-topic>, <dynamic-context>]
---
```

**Tag rules:**

- First tag is always `research`
- Remaining tags are **dynamic** — derived from the research topic, target feature, and relevant domain (e.g., `[research, auth, token-storage]` or `[research, afx, skill-format]`)
- Do not use generic placeholders like `topic` — infer specific tags from context

When `finalize --to adr` or `finalize --to spec`, use `type: ADR` or `type: SPEC` respectively with the same frontmatter schema.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer feature from the active file path (e.g., `docs/specs/user-auth/research/res-token-storage.md` → `user-auth`). If code is selected, use it as seed context for research exploration.
   - **CLI:** Infer from explicit arguments first, then cwd or branch name (`feat/user-auth` → `user-auth`), then conversation history.
   - **Fallback:** Research can be feature-scoped or global — prompt only if ambiguous.
3. **Trailing parameters (`[...context]`):** Treat extra words as research focus constraints (e.g., `/afx-research explore auth caching strategy` → explore auth and caching strategy together).

### Prompt-First Input Resolution (MANDATORY)

Input precedence is:

1. **Natural language prompt** (highest priority)
2. Explicit positional topic
3. Inferred context (branch, active spec, recent journal)
4. Optional flags as constraints (scope narrowing only)

When prompt is provided, do not override intent with flags.

### Intent Router

From prompt/topic, extract:

- `intent`: explore | compare | summarize | finalize
- `topic`: core research question
- `artifactTarget`: research | adr | spec
- `scope`: feature-local | global
- `confidence`: high | medium | low

If low confidence, continue with safest interpretation and print assumptions.

### Persistence Checkpoint (MANDATORY)

After producing `explore`, `compare`, or `summarize` output, **do not auto-write files**.

Agent must ask exactly one checkpoint question:

```text
Save this result now or keep refining?
1) Save to <resolved-research-path>/res-<slug>.md
   (resolved via: library.research → paths.research → docs/research)
2) Continue refining in chat
3) Promote to ADR flow
```

Only write to disk after explicit user confirmation.

For save operations:

- Resolve in this order:
  1. `library.research`
  2. `paths.research` (legacy fallback)
  3. `docs/research` (default)
- Enforce filename format: `res-<kebab-slug>.md`

### Next Command Suggestion (MANDATORY)

| Context                      | Suggested Next Command                    |
| ---------------------------- | ----------------------------------------- |
| After `explore`              | `/afx-research compare <topic>`           |
| After `compare`              | `/afx-research summarize <topic>`         |
| After `summarize`            | `/afx-research finalize <topic> --to adr` |
| After `finalize --to adr`    | `/afx-adr review <id>`                    |
| After `finalize --to spec`   | `/afx-spec refine <feature>`              |
| If decisions ready for build | `/afx-task refine <feature-or-instruction>` |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```text
Next (ranked):

1. /afx-research compare <topic> # Context-driven: Deepen analysis
2. /afx-research summarize <topic> # Context-driven: Synthesize findings
3. /afx-research finalize <topic> --to adr # Context-driven: Promote to decision
   ──
4. /afx-session note "research follow-up" # Capture findings before switching
5. /afx-next # Re-orient after research
```

---

## Subcommands

## 1. explore

Build research context from existing docs.

### Process

1. Resolve topic from prompt-first router
2. Search related artifacts:
   - `docs/specs/**/spec.md`
   - `docs/specs/**/design.md`
   - `docs/specs/**/research/*.md`
   - `docs/adr/*.md`
3. Produce findings with source paths
4. Present results in chat without writing files
5. Ask the mandatory save/refine checkpoint
6. If user selects save, persist to `<resolved-research-path>/res-<slug>.md`
7. Write optional capture note to `journal.md` if user asks

### Output

```markdown
## Research Discovery: {topic}

### Signals Found

- {finding}

### Existing Decisions

- {ADR reference}

### Open Questions

- {question}

### Assumptions

- {assumption}
```

## 2. compare

Generate options/tradeoff analysis.

### Output

```markdown
## Option Comparison: {topic}

| Option | Benefits | Risks | Complexity | Confidence |
| ------ | -------- | ----- | ---------- | ---------- |
| A      | ...      | ...   | Low        | Medium     |
```

## 3. summarize

Produce a recommendation brief from findings.

### Output

```markdown
## Research Summary: {topic}

### Recommendation

{recommended direction}

### Why

- {reason}

### Risks

- {risk}

### Decision Readiness

- Ready for ADR: Yes/No
```

## 4. finalize

Finalize research outcomes into ADR or Spec draft.

### Usage

```bash
/afx-research finalize "<topic>" --to adr
/afx-research finalize "<topic>" --to spec --feature <name>
```

### Process

- `--to adr`: create/update ADR draft in `docs/adr/` or feature-local `docs/specs/{feature}/research/`
- `--to spec`: create/update spec draft in `docs/specs/{feature}/spec.md`

### Notes

- Preserve frontmatter conventions from AFX templates
- Do not create implementation tasks or code
- Before creating ADR/spec artifacts, ask for explicit confirmation to proceed with promotion write actions

---

## Error Handling

**Topic not found / no related artifacts:**

```
No existing research, specs, or ADRs found for '{topic}'.
Starting from scratch — explore will search broader context.
```

**Research doc already exists:**

```
Error: 'res-{slug}.md' already exists at {path}
Use /afx-research explore {topic} to continue, or choose a different topic.
```

**Ambiguous topic:**

```
Multiple matches for '{topic}':
  1. docs/research/res-caching-strategy.md
  2. docs/specs/caching/research/res-cache-layer.md
Which one? (1/2)
```

**Finalize without prior research:**

```
Warning: No existing research artifacts found for '{topic}'.
Consider running /afx-research explore first, or proceed with finalize from conversation context.
```

---

## Related Commands

| Command     | Relationship                                  |
| ----------- | --------------------------------------------- |
| `/afx-adr`  | Finalize architecture decisions from research |
| `/afx-spec` | Refine living specs with finalized decisions   |
| `/afx-task` | Refine implementation plan after approval      |
| `/afx-dev`  | Implementation (outside research-only mode)   |
