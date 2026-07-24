# afx-sprint design

Refine the **Design** section (`[DES-OVR]` Overview, `[DES-ARCH]` Architecture, `[DES-UI]` UI & UX, `[DES-DEC]` Key Decisions, `[DES-DATA]` Data Model, `[DES-API]` API Contracts, `[DES-FILES]` File Structure, `[DES-DEPS]` Dependencies, `[DES-SEC]` Security, `[DES-ERR]` Error Handling, `[DES-TEST]` Testing Strategy, `[DES-ROLLOUT]` Migration / Rollout), or approve it.

### Usage

```bash
/afx-sprint design [feature] [...context]   # Refine
/afx-sprint design [feature] --approve          # Mark Design section Approved
```

### Gate

- **Prerequisite**: `approval.spec == Approved`.
- If Spec is not Approved, stop and respond:

  ```text
  Design is gated on Spec approval.
  Current: approval.spec = Draft

  Run: /afx-sprint spec <feature> --approve   (after reviewing the Spec section)
  ```

### Refinement Loop (when called without `--approve`)

Same pattern as `/afx-sprint spec` but scoped to `## 2. Design`:

1. **Read Design section** (`## 2. Design` through the line before `## 3. Tasks`).
2. **Understand the ask** — accept `[...context]` or prompt for focus (architecture sketch, add a key decision, flesh out data model, add a security consideration, add error handling, update rollout plan, …).
3. **Propose diff** with specific Edit operations.
4. **Confirm** with user.
5. **Apply edits** using Edit tool, one change per call.
6. **Maintain anchors**: existing `[DES-X]` IDs stay. New sections get descriptive uppercase kebab-case IDs (e.g., `[DES-CACHE]`, `[DES-AUTH]`).
7. **Demote `approval.tasks`** to Draft if the design change meaningfully affects implementation (new component, changed data model, different API shape). Skip demotion for cosmetic edits — ask the user if unsure.
8. **Update `updated_at`**.
9. **Capture decision** to `journal.md` when a Key Decision resolves an Open Question from the Spec section.

### Approval Path (when called with `--approve`)

1. **Check gate**: `approval.spec == Approved` (else stop as above).
2. **Read Design section**.
3. **Run mini-audit**: at least one `[DES-X]` section present, Key Decisions table filled (or explicit `N/A` note).
4. **If audit fails**: report gaps.
5. **If audit passes**: Edit `approval.design` → `Approved`. Update `updated_at`. Capture to journal.

### Output (refinement)

```text
Design section updated for <feature>.
Changes:
  + [DES-CACHE]: Redis layer for hot reads
  ~ [DES-ARCH]: updated diagram to show new cache tier

Approval demoted: tasks Draft (design changed)

Next: /afx-sprint design <feature> --approve   # When Plan is ready for tasks
```

### Output (approval)

```text
Design section approved for <feature>.
Approval state: spec=Approved, design=Approved, tasks=Draft

Next: /afx-sprint task <feature>   # Break into tasks
```
