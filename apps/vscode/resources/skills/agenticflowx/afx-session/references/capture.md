# /afx-session capture

Preserve a **verbatim user prompt + focused agent-reply excerpt** at a pivotal moment, linked to the artifact change it produced. Complements the summary-style Discussions — stores the _how_, not just the _what_.

> The Prompt Capture Triggers table and the Significance Check gate that decide **when** a proactive capture is proposed live in `references/proactive-capture.md`.

### Usage

```bash
/afx-session capture [feature] [--trigger <kind>] [--links <anchors>] [--agent <name>] [--model <id>] [...context]
```

- `[feature]`: feature slug. Omitted → inferred from IDE/CLI context, falls back to global journal (`docs/specs/journal.md`).
- `--trigger <kind>`: one of `new-fr`, `new-nfr`, `removed-fr`, `design-pivot`, `missed-req`, `scope-cut`, `ambiguity-resolved`, `question-resolved`, `other`. Optional — agent infers from recent changes if omitted.
- `--links <anchors>`: comma-separated anchors affected (e.g., `FR-4,DES-RATE-LIMIT,1.3`). Optional — agent infers from recent tool-use if omitted.
- `--agent <name>`: explicit agent identity override (e.g., `claude-code`, `codex`, `copilot`). Optional — defaults to the running agent's self-reported name.
- `--model <id>`: explicit model identifier override (e.g., `claude-opus-4-7`, `claude-sonnet-4-6`, `gpt-5-codex`). Optional — defaults to the running agent's self-reported model.
- `[...context]`: free-text hint about which exchange to capture or why it matters (e.g., `"the lockout discussion"`, `"that security pivot"`).

### Process (Manual Invocation)

1. **Resolve feature** and target `journal.md` (feature-scoped or global).
2. **Identify the pivotal exchange** in the recent conversation:
   - If trailing context names it (`"last exchange about lockouts"`), use it to locate the turns.
   - Otherwise scan recent turns and pick the most recent significant exchange based on artifact edits or user signal phrases.
3. **Compose entry**:
   - Extract the **verbatim user prompt** (trim only leading/trailing whitespace; preserve line breaks exactly).
   - Extract a **focused excerpt** from the agent's reply — 1–5 sentences covering the decision. Use `[...]` for omitted portions. Do not paraphrase.
   - **Infer trigger** if not provided: consult the Prompt Capture Triggers table in the Proactive Capture Protocol.
   - **Compute outcome links**: scan recent Edit / Write tool-use for file modifications that align with this exchange. List concrete file:anchor changes.
   - **Resolve agent + model identity**:
     - If `--agent` and `--model` flags provided → use verbatim.
     - Otherwise → the running agent self-reports its own name and model (each AFX-supported agent has runtime access to this: Claude Code, Codex, Copilot, etc.).
     - Use canonical names matching the git co-author convention: `claude-code`, `codex`, `copilot`. For model, use the official model ID (e.g., `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `gpt-5-codex`).
     - If identity cannot be determined → write `unknown` for either field. **Never fabricate** an agent or model name.
   - **Tag**: auto-generate 2–5 tags from prompt keywords + the trigger kind.
4. **Show preview** (complete markdown block, exactly as it will be appended) and ask `Apply this capture? [y/n]`.
5. **On confirm**: append to `## Prompt Captures` section in `journal.md`, assigning next available `{PREFIX}-P{NNN}` ID. Update `updated_at` frontmatter to the current ISO 8601 timestamp.
6. **On reject**: drop silently. No orphan state, no partial write.

### Process (Proactive Invocation from Caller Skill)

Called by `/afx-sprint`, `/afx-spec`, `/afx-design`, `/afx-task`, `/afx-research`, `/afx-dev` after they apply a triggering edit. The caller passes `--trigger` and `--links` directly. Step 2 is skipped:

1. Use caller-supplied `trigger` and `links`.
2. Use the caller's just-completed agent reply as the excerpt source and the preceding user prompt as the verbatim.
3. Proceed to step 3 (compose) → step 4 (preview + confirm) → step 5 (append).

The user confirmation gate is **always required**, even for proactive invocations. Captures are never written silently.

### Entry Format

Appended to `## Prompt Captures` in `journal.md`:

```markdown
### {PREFIX}-P{NNN} — {One-line summary of what the prompt surfaced}

- `type:prompt-capture` `{YYYY-MM-DDTHH:MM:SS.mmmZ}` `[tag1, tag2, trigger-kind]`
- trigger: {kind}
- triggered-change: {FR-X}, {[DES-X]}, {task X.Y}, ...
- agent: {claude-code | codex | copilot | other | unknown}
- model: {claude-opus-4-7 | claude-sonnet-4-6 | gpt-5-codex | ... | unknown}

**User prompt** (verbatim):

> {Exact user text, preserving line breaks}

**Agent reply** (excerpt):

> {1–5 sentence excerpt; `[...]` for omissions}

**Outcome**: {path/to/file.md anchor added}, {path/to/other.md section changed}, ...
```

### ID Convention

- `{PREFIX}` = feature prefix already defined in `journal.md`'s `<!-- prefix: XX -->` comment.
- `-P` distinguishes **prompt captures** from discussions (`-D`).
- `{NNN}` = next sequential zero-padded integer within the Prompt Captures section.
- Example: `UA-P001`, `UA-P002` in `docs/specs/user-auth/journal.md`.

### Example

User running `/afx-sprint spec dark-mode "add FR for keyboard shortcut"`:

1. Sprint applies the edit → adds `FR-4: Toggle via Cmd+Shift+D shortcut`.
2. Sprint delegates to `/afx-session capture --trigger new-fr --links FR-4`.
3. Capture composes and previews:

   ```markdown
   ### DM-P001 — Added keyboard shortcut to toggle dark mode

   - `type:prompt-capture` `2026-04-19T10:14:22.000Z` `[dark-mode, keyboard, a11y, new-fr]`
   - trigger: new-fr
   - triggered-change: FR-4
   - agent: claude-code
   - model: claude-opus-4-7

   **User prompt** (verbatim):

   > add FR for keyboard shortcut

   **Agent reply** (excerpt):

   > Adding FR-4: Toggle via Cmd+Shift+D. This also hits the a11y goal in NFR-2 — keyboard-only users can switch themes without a pointer.

   **Outcome**: docs/specs/dark-mode/dark-mode.md FR-4 added
   ```

4. User confirms `y` → appended to `docs/specs/dark-mode/journal.md`.

### Error Handling

**No recent pivotal exchange found:**

```text
No pivotal exchange detected in the last 10 turns.
Hint: pass [...context] to point at an earlier moment, or use /afx-session note for a quick summary instead.
```

**Target journal.md missing:**

```text
Error: docs/specs/<feature>/journal.md not found.
Run: /afx-scaffold spec <feature>   # Create the feature structure first
```

**User rejects preview:**

```text
Capture discarded. No changes written.
```

### Next Command Suggestion

| Context                           | Suggested Next Command                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| After successful capture          | Continue the current flow (`/afx-sprint spec ...`, etc.)                                     |
| After rejected preview            | `/afx-session note "<summary>"` as a lighter alternative                                     |
| Capture surfaced a decision       | `/afx-session log <feature>` to consolidate into a discussion                                |
| Capture implies ADR-worthy choice | `/afx-session promote <P-id>` (future — not yet implemented; use `/afx-adr create` manually) |
</content>
