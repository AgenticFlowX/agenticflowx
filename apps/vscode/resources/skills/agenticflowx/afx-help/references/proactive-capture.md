# AFX Proactive Capture

Single source of truth for proactive journal capture. Skills point here instead of copying the section.

The canonical protocol lives in `../afx-session/SKILL.md` (Proactive Capture Protocol). This reference states **when a skill may capture and when it must not**.

## Rule

- **Read-only skills never capture.** `/afx-check`, `/afx-report`, `/afx-discover`, and `/afx-next` never write `journal.md` or any file. When they detect something notable, they surface it in the result and recommend `/afx-session note` so the user can capture it.
- **Mutating skills may capture** only during an authorized mutation or an explicit session command, following the Proactive Capture Protocol in `afx-session`. Significant capture never happens as a side effect of a read.

## What qualifies as significant

Decisions, pivots, incidents, and implementation discoveries that change how future work proceeds. Not routine status.

Timestamps in captures follow `timestamp-rule.md`.
