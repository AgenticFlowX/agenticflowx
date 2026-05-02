---
afx: true
type: ADR
status: Proposed
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-27T13:00:27.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["adr", "pi", "security", "permissions", "auto-approve"]
---

# ADR-0006: Pi Controlled Auto-Approve Safety Layer

## Context

AFX is integrating Pi as the agent runtime through RPC. Pi is intentionally high agency: it streams, plans, invokes tools, and can drive coding work through shell, file, edit, and extension UI actions.

That is the product value, but it also creates the security boundary AFX must own. A user experiences these actions inside AFX, not inside a raw Pi terminal, so AFX needs a clear policy for when the host permits, confirms, blocks, or audits Pi-initiated actions.

The supporting research is captured in [`res-pi-tool-call-safety-model.md`](../research/pi/res-pi-tool-call-safety-model.md). The key finding is that Pi provides hooks and an RPC surface, but AFX must provide the product safety model: path limits, command policy, confirmation UX, auto-approve settings, denial behavior, and audit visibility.

The product direction is:

```text
Keep the Pi spirit.
Do not reimplement the whole Pi runtime.
Add AFX-controlled permission and auto-approve around host actions.
Default to guarded behavior.
Let users deliberately opt into more flow, including Free Flow, with a large warning.
```

## Decision

Adopt **Plain Pi + AFX-Controlled Auto-Approve** for this rewrite.

Pi remains the runtime engine. AFX will add a host-side permission service that normalizes Pi tool/action requests, evaluates policy, asks or auto-approves where appropriate, records an audit event, and returns an allow, deny, abort, or timeout result back to the runtime.

### Safety Profiles

AFX will support three safety profiles:

| Profile                 | Default         | Decision                                                                                                                             |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Guarded                 | Yes             | Ask before risky host actions, deny critical actions by default, remember only scoped approvals                                      |
| Controlled Auto-Approve | Opt-in          | Let users auto-approve scoped categories such as read-only, mentioned-file writes, allowlisted commands, and session actions         |
| Free Flow               | Explicit opt-in | Broad auto-approve profile for trusted or disposable workspaces, enabled only after a large warning and shown persistently in the UI |

### Default Policy

Guarded mode is the first-run default.

- Non-mutating status and rendering actions may proceed.
- Shell commands ask by default.
- File writes ask by default.
- Broad or unmentioned file reads ask by default unless a scoped read auto-approve rule exists.
- Secret-like files are denied by default.
- Outside-workspace writes are denied by default.
- Destructive, privilege-escalating, or remote-script command shapes are denied by default.

### Auto-Approve Policy

Auto-approve is not one global switch in the normal settings path. It is category and rule based.

Initial categories:

- Read-only workspace access.
- Writes to files explicitly mentioned by the user.
- Shell commands matching allowlisted prefixes.
- Extension UI confirmations with low or medium risk.
- Session-level actions such as follow-up prompts or mode/session operations.

Initial scopes:

- Once.
- Current session.

Workspace-persisted and always-persisted approvals are deferred until AFX has a settings or policy editor that can show, edit, export, and revoke those rules.

### Free Flow Policy

Free Flow is a broad auto-approve profile, not an invisible bypass.

It must require a stronger confirmation than a normal permission card. The warning must say, plainly, that Pi may run commands, edit or delete files, read project data, install packages, and change the workspace quickly. It must also say that AFX permissions are not OS-level sandboxing.

When Free Flow is enabled:

- AFX still routes actions through the permission service.
- AFX still emits audit events.
- Chat and status surfaces show a persistent visible signal.
- The first implementation should scope Free Flow to the current session.
- Direct Pi RPC paths must not bypass the policy service.

Critical non-overridable denies can remain in place while the first implementation proves hook coverage. If the product later wants a true "trust everything" developer mode, that should be a separate decision with its own warning and verification plan.

### UX Policy

Permission requests should be first-class events, not ordinary assistant prose.

AFX will render permission cards in chat when timing allows, with native VS Code prompts as a fallback for urgent host-side decisions. Every native prompt result must still appear in chat/history afterward.

Denials must be model-readable. Pi should receive a clear reason such as:

```text
Denied by AFX policy: command matched critical remote-script rule.
Denied by user: write to unmentioned file was rejected.
Denied by AFX policy: path is outside the current workspace.
```

## Rationale

This gives AFX the right split of responsibility:

- Pi stays Pi: fast, direct, capable, and responsible for agent orchestration.
- AFX owns the IDE trust boundary: user intent, workspace context, visible approvals, and audit trails.
- Users who want a conservative default get one.
- Users who want a faster agent loop can opt into scoped auto-approve.
- Users who explicitly want the rawer Pi experience can enable Free Flow after an unmistakable warning.

The design borrows the strongest patterns from nearby tools without copying their entire architecture:

- legacy-style category auto-approval and command allow/deny rules.
- AI agent-style path enforcement at tool boundaries.
- AI agent-style durable permission request/reply lifecycle and explicit "not a sandbox" warning.

This avoids the two extremes: silently trusting all Pi actions by default, or reimplementing Pi's tools inside AFX before the foundation has shipped.

## Consequences

### Positive

- AFX can explain its security posture clearly.
- The default behavior protects new users and unknown workspaces.
- Power users still have a fast path through controlled auto-approve and Free Flow.
- Permission decisions become auditable in chat, history, and debug surfaces.
- The permission model can become runtime-neutral later because chat renders AFX permission events, not raw Pi RPC details.

### Negative / Trade-offs

- AFX must verify that Pi exposes risky actions early enough to block before execution.
- Permission prompts add friction in Guarded mode.
- Auto-approve settings can become dangerous if the UI hides their scope.
- Free Flow creates real risk and must be presented as a high-trust mode, not a convenience toggle.
- The first implementation needs focused tests for command classification, path boundaries, pending permission recovery, and denial mapping.

### Implementation Constraints

- No Pi action path exposed through AFX should bypass the permission service.
- If Pi exposes a risky action only after execution starts, AFX must either avoid exposing that action, route it through an AFX-owned tool, or document the limitation before enabling auto-approve for that class.
- Policy enforcement must live in host/runtime code, not only in prompts.
- Permission prompts are not sandboxing. Users who need real isolation should use OS, VM, container, or disposable workspace isolation.

## Alternatives Considered

- **Plain Pi Trust by default**: Let Pi run broadly and only display events. Rejected as the default because AFX needs a visible product safety posture. Retained as an explicit Free Flow profile with a large warning and audit visibility.
- **AFX Confirmation Wrapper only**: Ask for risky actions but do not support auto-approve profiles. Rejected because it creates too much friction for the intended coding-agent workflow.
- **AFX-Owned Tool Execution**: Reimplement shell, file, edit, and high-risk tools behind AFX services and treat Pi mostly as a planner. Deferred because it fights Pi's current grain and is too large for the foundation. It remains a fallback for action classes Pi cannot expose safely before execution.
