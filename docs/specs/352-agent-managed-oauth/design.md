---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "managed-sdk", "subscription"]
spec: spec.md
---

# Agent Managed OAuth - Technical Design

## [DES-OVR] Overview

Managed OAuth is an ownership boundary. AFX may authenticate and inject credentials only for bundled SDK runtimes it owns; external user-run runtimes stay user-configured.

---

## [DES-POLICY] Runtime Ownership Policy

| Runtime kind            | AFX OAuth behavior                                                   |
| ----------------------- | -------------------------------------------------------------------- |
| Bundled Pi SDK          | AFX can own OAuth, SecretStorage, refresh, and env injection         |
| External Pi RPC         | AFX does not inject OAuth/API credentials; user runs `pi /login`     |
| Future bundled SDK      | May reuse provider flows only after an injection adapter is designed |
| Future external harness | User-configured unless explicitly converted to managed runtime       |

---

## [DES-ARCH] Architecture

```
352 policy
  +-- 353 credential store
  +-- 354 provider flows
  +-- 355 SDK credential injection
  +-- 218 provider settings guidance
```

The policy spec owns scope and constraints. Child specs own concrete files.

---

## [DES-SEC] Security Considerations

- Do not pass AFX-owned credentials to external user processes.
- Do not generalize into a broker for arbitrary runtimes until a second managed SDK proves common requirements.
- Keep external runtime UI copy guidance-only and avoid sign-in actions that imply AFX ownership.

---

## [DES-TEST] Testing Strategy

- External RPC env-scrub tests verify the policy at the runtime boundary.
- Settings tests verify external runtime cards do not render AFX OAuth sign-in actions.
- SDK injection tests verify managed Pi SDK can receive selected credentials.

---

## File Reference Map

| Task | File                                         | Required @see                                               |
| ---- | -------------------------------------------- | ----------------------------------------------------------- |
| 1.1  | `apps/vscode/src/agent-factory.ts`           | `docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]` |
| 1.2  | `apps/chat/src/components/provider-card.tsx` | `docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]` |

---

## Open Technical Questions

| #   | Question                                                             | Status   |
| --- | -------------------------------------------------------------------- | -------- |
| 1   | Which second managed SDK will validate a reusable injection adapter? | Deferred |
