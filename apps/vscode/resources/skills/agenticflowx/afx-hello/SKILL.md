---
name: afx-hello
description: Verify AFX installation and environment — detect AI provider, confirm skill availability, and show project health snapshot
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,diagnostics,environment,onboarding"
---

# /afx-hello

Environment diagnostics and AFX installation verification. Useful for onboarding, troubleshooting, and confirming the framework is correctly configured.

## Usage

```bash
/afx-hello
```

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Read `.afx.yaml` configuration
- Check for presence of skill files, templates, and spec directories

### Forbidden

- Create/modify/delete any files
- Run build/test/deploy/migration commands

If changes are requested, return:

```text
Out of scope for /afx-hello (read-only diagnostics mode). Use /afx-scaffold to scaffold or /afx-spec to manage specs.
```

### Timestamp Format (MANDATORY)

When writing execution reports or creating journal entries, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

## Post-Action Checklist (MANDATORY)

Since this is a read-only diagnostics skill, no files are modified. However, after executing, you MUST:

1. Verify all checks are completed as listed in the Output Format.

### Proactive Journal Capture

When this skill detects a high-impact diagnostic failure event, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-hello`**: Critical environment configuration gap discovered.

---

## Agent Instructions

### Trailing Parameters

When trailing arguments are passed (e.g., `/afx-hello tools only`, `/afx-hello skip auth`), treat them as keyword filters to scope the diagnostic output. This command is context-agnostic — it does not infer feature context from IDE state or cwd.

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-hello` action, suggest the most appropriate next command based on context (e.g., `/afx-next` or `/afx-scaffold`).

### Diagnostics Process

When invoked, perform these checks and report results:

1. **AI Provider Detection**
   - Identify which AI agent is running (Claude Code, Copilot, Cursor, Cline, Codex, etc.)
   - Report model name if available

2. **AFX Installation Check**
   - `.afx.yaml` exists and is parseable
   - `.claude/skills/` directory exists with skill files
   - `.agents/skills/` directory exists (if multi-agent)
   - `CLAUDE.md` exists and references AFX

3. **Skill Availability**
   - List all installed AFX skills (scan skill directories)
   - Flag any expected skills that are missing

4. **Project Health Snapshot**
   - Count specs under `docs/specs/` (total, by status if parseable)
   - Check for `.afx.yaml` config completeness
   - Report any obvious issues (missing templates dir, broken paths)

### Output Format

```markdown
## AFX Environment Check

**Agent**: Claude Code (claude-opus-4-6)
**Workspace**: /path/to/project

### Installation

| Component       | Status | Path                        |
| --------------- | ------ | --------------------------- |
| .afx.yaml       | ✓      | .afx.yaml                   |
| CLAUDE.md       | ✓      | CLAUDE.md                   |
| Skills (Claude) | ✓      | .claude/skills/ (14 skills) |
| Skills (Agents) | ✓      | .agents/skills/ (14 skills) |
| Templates       | ✓      | Bundled in skill assets/    |

### Project Health

| Metric      | Value |
| ----------- | ----- |
| Total Specs | 12    |
| Draft       | 3     |
| Approved    | 7     |
| Living      | 2     |

### Quick Start

Ready to go! Try:
/afx-next # What should I do now?
/afx-spec create <name> # Start a new feature
/afx-discover capabilities # Explore the project
```
