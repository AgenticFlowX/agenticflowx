---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T14:29:39.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "agent", "rpc", "agent-adapter", "adapter"]
promoted_to: docs/adr/ADR-0004-afx-agent-adapter-roadmap.md
---

# Agent Adapter RPC Substrate

The idea is: treat each coding runtime as a protocol-specific adapter and make `AgentManager` the **only** thing in the extension that knows how to talk to that adapter. Everything else talks to a small, stable TypeScript interface.

## Why an adapter substrate instead of one universal wire

JSON-RPC 2.0 is a useful reference shape: `jsonrpc: "2.0"`, `method`, `params`, `id` in requests, and `result` or `error` in responses, over any transport. Some future runtimes may use strict JSON-RPC. Pi does not: it uses newline-delimited JSON with a custom envelope and event stream.

Because the wire formats will not always match, AFX should standardize at the adapter boundary instead of pretending every runtime is the same protocol. The stable layer is `AgentManager`; the transport is an implementation detail owned by `packages/agent/<runtime>/`.

This gives AFX one internal event model while leaving room for stdio JSONL, JSON-RPC, WebSocket, SDK calls, or future protocol shapes.

## The shape of the abstraction

Think in two layers:

1. **Extension‑internal interface (TypeScript)** — what the rest of AgenticFlowX sees.
2. **JSON‑RPC 2.0 client implementation** — hides stdio/WebSocket/MCP and each agent’s quirks.

Example internal interface (pseudo‑TS):

```ts
type AgentId = string;
type SessionId = string;

interface AgentEngine {
  startSession(args: {
    agentId: AgentId;
    workspaceRoot: string;
    initialPrompt?: string;
  }): Promise<SessionId>;

  sendUserMessage(sessionId: SessionId, message: string): Promise<void>;

  // streamed events: tokens, plans, edits, tool calls, status
  onEvent(sessionId: SessionId, handler: (event: AgentEvent) => void): Disposable;

  stopSession(sessionId: SessionId): Promise<void>;
}
```

AgentManager then chooses an adapter per workspace/spec. Each adapter owns its native transport and maps native events onto `AgentEvent`.

## Minimal internal method set

Under the hood, each adapter can be normalized around a small set of internal methods, even if the native API is more complex:

- `startSession` - spin up or attach to a coding session
- `send` - user sends a prompt, spec, or instruction
- `abort` - cancel the active turn
- `newSession` - reset runtime state where supported
- `getStatus` - return session/model/runtime status
- `getUsage` - return usage if the runtime exposes it
- `respondToUiRequest` - answer runtime-originated confirmations

The event stream is implemented either as:

- runtime-emitted notifications with typed payloads, or
- a continuous JSONL output stream that the adapter treats as out-of-band events.

The payload for `agent.event` can be your own schema, e.g.:

```json
{
  "jsonrpc": "2.0",
  "method": "agent.event",
  "params": {
    "sessionId": "123",
    "type": "token" | "plan" | "edit" | "status" | "error",
    "data": { ... }
  }
}
```

Each adapter maps _its_ native events onto this internal schema.

## Current runtime: Pi

Pi is the current adapter and the precedent for all follow-up adapter work:

- Transport: stdio subprocess.
- Wire: newline-delimited JSON in Pi RPC mode.
- Adapter package: `packages/agent/pi/`.
- Boundary: native Pi commands/events are translated inside the adapter; consumers only see `AgentManager`, `AgentStatus`, `AgentUsage`, `AgentEvent`, and UI-request types from `@afx/shared`.
- Safety: tool calls and confirmations must be surfaced through AFX policy before host execution.

This is enough to validate the adapter boundary without importing comparison research into the product repository.

## Handling different transports

Transport is an implementation detail of each adapter:

- **stdio JSONL**: current Pi adapter shape.
- **stdio JSON-RPC**: viable for a future runtime that exposes strict request/response framing.
- **WebSocket JSON-RPC**: viable if a future runtime needs a long-lived network transport.
- **SDK/in-process**: viable only if the SDK can preserve cancellation, event streaming, and policy enforcement.

Your AgentManager doesn’t care; it only sees `AgentEngine` methods and event callbacks.

## Why this helps your spec layer

Once all adapters look the same to AgentManager, the spec-driven environment can:

- Choose runtime per spec, per workspace, or per task node.
- Run multi-runtime execution graphs when the product needs them.
- Swap engines in user settings without touching spec execution logic at all.
