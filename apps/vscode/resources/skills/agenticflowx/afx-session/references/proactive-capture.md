# Proactive Capture Protocol (MANDATORY)

> **Shared cross-cutting rule** (read-only skills never capture; mutating skills may capture only during an authorized mutation or explicit session command): `../afx-help/references/proactive-capture.md`. This file holds the `/afx-session`-specific auto-capture mechanics.

**Cross-cutting rule**: This protocol applies to ALL AFX skills, not just `/afx-session`. When any skill detects a high-impact context change during its operation, it MUST auto-capture to `journal.md` without waiting for the user to invoke `/afx-session`.

**Triggers for `/afx-session`**: User discusses complex architectural trade-offs, scope cuts, or defers decisions without explicitly running `log`.

## Trigger Conditions

Auto-capture (without asking) when the agent detects:

| Trigger              | Example                               | What to capture                        |
| -------------------- | ------------------------------------- | -------------------------------------- |
| Decision deferred    | "not now", "later", "future phase"    | Decision + reason + what it blocks     |
| ADR-impacting choice | "let's use Postgres instead of Mongo" | The decision + alternatives considered |
| Spec deviation       | "skip that requirement for MVP"       | Which FR/NFR is affected + why         |
| Research finding     | "turns out X doesn't support Y"       | Finding + source + impact              |
| Architecture change  | "move auth to a separate service"     | What changed + what's affected         |
| Scope cut            | "drop feature X from this release"    | What's cut + where to track it         |

## Capture Format

Append to `## Captures` section in the appropriate `journal.md`:

```markdown
- **{YYYY-MM-DDTHH:MM:SS.mmmZ}** - [AUTO:{skill}] {one-line summary}
  `[{auto-tags}, auto-capture]`
  **Impact**: {what this affects: ADR/spec/code/research}
  **Action**: {deferred|decided|changed|cut} → {when/what to revisit}
```

## Rules

1. **Write to `## Captures`** — not `## Discussions` (that's for `/afx-session log`)
2. **Tag with `auto-capture`** — so entries are filterable
3. **Include source skill** — prefix: `[AUTO:afx-dev]`, `[AUTO:afx-spec]`, etc.
4. **No duplicates** — if the same decision was just captured, skip
5. **Feature routing** — if the context has an active feature, write to `docs/specs/{feature}/journal.md`. Otherwise write to `docs/specs/journal.md`
6. **Consolidation** — still suggest `/afx-session log` at natural breakpoints to consolidate captures into full discussion entries

## Example

During `/afx-task code`, the user says "let's skip pagination for now, we'll do it in Phase 2":

```markdown
- **2025-03-17T14:30:00.000Z** - [AUTO:afx-dev] Pagination deferred to Phase 2
  `[pagination, deferred, phase-2, auto-capture]`
  **Impact**: spec — FR-7 (pagination) remains unimplemented
  **Action**: deferred → revisit in Phase 2 planning
```

## Prompt Capture Triggers (propose + confirm)

Separate from auto-capture above, **prompt captures** preserve the verbatim user prompt + agent-reply excerpt at pivotal moments. Unlike auto-capture (silent summary), prompt captures are **proposed to the user for confirmation** before writing. Delegate to `/afx-session capture` when detecting:

| Observed change                                                            | Inferred trigger           |
| -------------------------------------------------------------------------- | -------------------------- |
| New `FR-X` / `NFR-X` row added to spec                                     | `new-fr` / `new-nfr`       |
| FR/NFR row removed or moved to Non-Goals                                   | `removed-fr` / `scope-cut` |
| New `[DES-X]` section added, or Key Decisions table entry changed          | `design-pivot`             |
| Open Question moved from `Open` → `Resolved`                               | `question-resolved`        |
| User phrases: "oh wait", "actually", "I missed", "what about", "we forgot" | `missed-req`               |
| Ambiguity clarified mid-conversation (no artifact change yet)              | `ambiguity-resolved`       |
| Any other pivotal moment the user explicitly marks                         | `other`                    |

When a caller skill (`/afx-sprint`, `/afx-spec`, `/afx-design`, `/afx-task`, `/afx-research`, `/afx-dev`) detects one of these triggers **after applying** the artifact edit, it should:

1. **Apply the Significance Check** below. If the change fails, skip silently — do not propose.
2. Otherwise call `/afx-session capture` with the detected `trigger` kind and `links` (anchors just modified).
3. Let `/afx-session capture` compose and show the preview.
4. Only write on user confirmation.

Prompt captures complement — don't replace — the silent summary captures above. Both can fire for the same event (summary for fast recall, prompt capture for verbatim fidelity).

### Significance Check (Context-Aware Gate)

Triggers in the table above are **pattern-based** — they fire on any edit that matches. Many such edits are cosmetic (typo, rewording, reformatting) and shouldn't create journal noise. Before proposing a capture, every **proactive** invocation MUST run the following two-stage gate. **Manual invocations of `/afx-session capture` skip this gate entirely** — the user has already decided.

**Stage 1 — Hard Skips** (always skip, no capture):

- Only whitespace, punctuation, or casing changed
- Pure synonym swap / rewording with no semantic shift (e.g., "users can" → "a user can")
- User phrased the edit as `typo`, `fix wording`, `polish`, `reformat`, `style`, `nit`, `cleanup`
- Reverting a change made less than 3 turns ago (treat as correction, not decision)
- Change is limited to a heading's formatting or a table's column width
- `updated_at` / version / metadata-only edits

**Stage 2 — Significance Rubric** (propose only if **at least one** is yes):

1. **New decision or reversal?** — Does the change encode a new decision, new constraint, or reversal of a prior decision? (new FR, removed FR, `[DES-X]` pivot, Open Question → Resolved, requirement demoted from Must Have to Should Have, scope moved in/out of Non-Goals.)
2. **Institutional knowledge at stake?** — Would a future reader (agent or human) need to know **why** this change happened to correctly interpret the spec? If the edit is self-explanatory from the current artifact alone, answer no.
3. **Earned through discussion?** — Did the change emerge from meaningful back-and-forth in the conversation? Signals: ≥3 conversation turns spent on it, user used pivot phrases (`wait`, `actually`, `I missed`, `we forgot`, `let's pivot`), or the user pushed back on an earlier agent proposal.

**Ambiguity rule**: if all three questions answer `maybe` (no clear yes, no clear no), **default to skip**. Err on the side of fewer captures. The journal is better sparse-and-meaningful than dense-and-noisy. The user can always run `/afx-session capture` manually to force a capture.

**Logging skipped triggers**: do not log, do not announce. Skipped triggers are invisible — the conversation continues without interruption.

**Example — trigger fires, significance check skips:**

> User: "tiny fix — FR-2 should say 'can log in' not 'is able to log in'"
> Agent: applies the edit, detects `edit to FR-2 pattern`, enters Significance Check:
>
> - Hard Skip stage: user phrased as "tiny fix" → **Skip**. No capture proposed.

**Example — trigger fires, significance check proceeds:**

> User: "wait, we need rate limiting on login — had a credential stuffing incident last quarter"
> Agent: adds FR-4, detects `new FR` trigger, enters Significance Check:
>
> - Hard Skip stage: no match.
> - Rubric: Q1 yes (new constraint), Q2 yes (incident rationale would be lost), Q3 yes (pivot phrase "wait"). → **Propose capture**. Shows preview, user confirms, entry appended.
</content>
