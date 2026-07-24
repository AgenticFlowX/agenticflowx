# refine <name>

**Purpose:** Preferred alias for `plan`; refine or draft `tasks.md` from an approved design.

**Behavior:** Execute the same core flow as `plan <name>` (see `references/plan.md`). If `tasks.md` is empty or scaffold-only, generate the implementation plan from the approved design. If `tasks.md` already has content, perform targeted refinement that preserves task IDs, Work Sessions, and human-authored task notes. Do not modify source code during `refine`.

Keep `plan` supported indefinitely for compatibility, but prefer `refine` in new UI labels, help text, and examples.
