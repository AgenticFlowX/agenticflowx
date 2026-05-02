---
afx: true
type: ADR
status: Accepted
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T08:15:14.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["adr", "architecture", "agent", "pi", "abstraction", "packages", "rpc", "adapter"]
---

# ADR-0002: AFX AgentManager Abstraction + packages/agent/pi Extraction

## Context

The initial Pi integration (`apps/vscode/src/engine/pi-client.ts` + `pi-manager.ts`) was co-located inside the extension host. This caused two structural problems:

1. **VSCode coupling in the engine layer.** `pi-manager.ts` imported `* as vscode` directly — reading `vscode.workspace.getConfiguration()`, `vscode.workspace.workspaceFolders`, and using `vscode.Disposable`. This made the module untestable without a VSCode host and unextractable into a standalone package.

2. **Hard-coded Pi dependency in the panel.** `sidebar-panel.ts` imported `PiManager` by type and handled raw `PiEvent` shapes. Any future runtime swap would require modifying the panel and the extension host entrypoint simultaneously — the wrong abstraction boundary.

The monorepo is still in its initial phase; getting this boundary right now is far cheaper than retrofitting it after a second runtime is introduced.

---

## Decision

**Extract the Pi adapter into `packages/agent/pi/` and introduce an `AgentManager` interface in `@afx/shared`.**

Concretely:

1. **New package `@afx/agent-pi`** (`packages/agent/pi/`) — a thin Node.js-only adapter. Contains only the RPC transport mechanism; no VSCode imports.

2. **Transport-explicit naming.** Files renamed from `pi-client.ts`/`pi-manager.ts` to `rpc-client.ts`/`rpc-manager.ts`. The name signals the mechanism (JSONL-over-subprocess RPC), not the runtime. Future adapters (`sdk-manager.ts`, `ws-client.ts`) slot in naturally without naming collisions.

3. **Config injection via `PiRpcManagerOptions`.** `rpc-manager.ts` receives `{ output: Logger; binaryPath?: string; ephemeral: boolean; cwd?: string }` from the caller. `extension.ts` reads VSCode settings and passes values in. No `vscode` import ever enters `packages/agent/pi/`.

4. **`AgentManager` interface in `@afx/shared` (FR-6).** All adapters implement this contract. The extension host and sidebar panel depend only on `AgentManager`; they never import `PiRpcManager` or any adapter-specific type.

5. **Event normalisation inside the adapter.** Pi-native event shapes are translated to the `AgentEvent` union inside `rpc-manager.ts` before reaching any consumer. `sidebar-panel.ts` handles only `AgentEvent` — it contains no Pi-specific parsing.

6. **VSCode-side agent factory.** `apps/vscode/src/agent-factory.ts` models configured coding agents as `AgentInstance[]`. current build returns one Pi-backed instance; later multi-agent support can add instances without changing panel code.

7. **`pnpm-workspace.yaml` updated** to include the `packages/agent/*` glob, enabling nested adapter packages to be discovered as workspace packages.

---

## Rationale

### Why extract now rather than after a second runtime

Adding a second runtime without the abstraction in place would require touching three files simultaneously: the engine module, the extension host entrypoint, and the sidebar panel. With the abstraction, the second runtime is one new package + a small branch in the VSCode agent factory.

### Why transport-explicit naming

`pi-client.ts` and `pi-manager.ts` would need to coexist with other runtime-specific client files. The naming would grow confusing because "client" means different things for different transports. `rpc-client.ts`/`rpc-manager.ts` names the mechanism. An SDK-based adapter would be `sdk-client.ts`/`sdk-manager.ts`. A WebSocket adapter would be `ws-client.ts`/`ws-manager.ts`. Each file is self-describing.

### Why inject config rather than read it in the adapter

VSCode API access inside `packages/agent/pi/` would couple the package to the extension host runtime, preventing unit testing (mocking `child_process.spawn`) and any future reuse in a CLI or test harness. Injection makes the adapter a pure Node.js module whose only runtime dependency is `node:child_process`.

### Why normalise events inside the adapter

If Pi-native event shapes leak into `sidebar-panel.ts`, every future runtime swap requires updating the panel's event handler. By normalising inside the adapter, swapping runtimes is a factory function change in `extension.ts` — nothing else changes.

---

## `AgentManager` contract

```typescript
// packages/shared/src/agent.ts
interface Disposable {
  dispose(): void;
}
interface Logger {
  appendLine(value: string): void;
}

interface AgentStatus {
  running: boolean;
  isStreaming: boolean;
  model?: string;
}

interface AgentUsageStats {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}

type AgentUiResponse =
  | { id: string; value: string }
  | { id: string; confirmed: boolean }
  | { id: string; cancelled: true };

type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "message_start"; role: "user" | "assistant"; content?: string; errorMessage?: string }
  | { type: "text_delta"; id: string; delta: string }
  | { type: "thinking_delta"; id: string; delta: string }
  | { type: "tool_start"; toolCallId: string; toolName: string; args?: Record<string, unknown> }
  | { type: "tool_end"; toolCallId: string; ok: boolean; result?: unknown }
  | { type: "ui_request"; id: string; method: string }
  | { type: "error"; message: string };

interface AgentManager {
  send(message: string): Promise<void>;
  abort(): Promise<void>;
  newSession(): Promise<void>;
  getStatus(): Promise<AgentStatus>;
  getUsage(): Promise<AgentUsageStats | null>;
  respondToUiRequest(response: AgentUiResponse): Promise<void>;
  onEvent(listener: AgentEventListener): Disposable;
  onStderr(listener: AgentStderrListener): Disposable;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

`Disposable` and `Logger` are minimal structural interfaces. `vscode.OutputChannel` satisfies `Logger` structurally; `vscode.Disposable` satisfies `Disposable` structurally. No adapter package ever imports `vscode`.

---

## Runtime swap example

```typescript
// Add a future runtime: one branch in apps/vscode/src/agent-factory.ts
import { createRuntimeManager } from "@afx/agent-example";

// future package

manager = createRuntimeManager({
  output,
  binaryPath: cfg.get<string>("exampleRuntimeBinaryPath", "example-runtime"),
  cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
});
// sidebar-panel.ts, @afx/shared, @afx/transport: zero changes
```

---

## Package layout after this ADR

```text
packages/
├── shared/       (@afx/shared — AgentManager, AgentEvent, types, protocol)
├── parsers/      (@afx/parsers)
├── transport/    (@afx/transport)
├── ui/           (@afx/ui)
└── agent/
    └── pi/       (@afx/agent-pi — rpc-client.ts, rpc-manager.ts)
    # future:
    # └── example/  (@afx/agent-example)
```

---

## Consequences

### Positive

- Extension host and sidebar are runtime-agnostic — depend only on `AgentManager`.
- Usage telemetry and extension UI requests remain runtime-agnostic contract methods/events instead of raw adapter requests.
- Adding a second agent runtime is contained to a new `packages/agent/*` package + a small branch in `apps/vscode/src/agent-factory.ts`.
- The VSCode host is future-shaped for multiple configured `AgentInstance`s while current build still starts only one Pi-backed agent.
- `packages/agent/pi/` is testable without a VSCode host (mock `child_process.spawn`).
- Transport-explicit naming (`rpc-client.ts`, `rpc-manager.ts`) future-proofs the naming as new transports are added.

### Negative / accepted trade-offs

- One additional package to maintain (`@afx/agent-pi`).
- `pnpm install` must be re-run when the new package is added.
- `packages/agent/pi/` carries `@mariozechner/pi-coding-agent` as a devDependency for type-only use — consumers must not accidentally bundle it.

### Not decided here

- Which runtime should be added second — that is a future decision.
- WebSocket/browser-extension transport (referenced in naming rationale) — future design doc.
- Multi-agent session routing, UI selection, and per-message `agentId` — out of scope until there is a concrete UX.

---

## References

- `docs/specs/100-package-shared/spec.md [FR-5]` — AgentManager in @afx/shared
- `docs/specs/300-infra-pi/spec.md [FR-1] [FR-5] [FR-8] [FR-9]` — PiRpcManager implements AgentManager
- `docs/specs/200-app-vscode/spec.md [FR-6] [FR-7]` — extension.ts injects config, sidebar-panel uses AgentManager
- `docs/specs/310-infra-build/spec.md [FR-5]` — pnpm-workspace.yaml includes packages/agent/\*
- ADR-0001: Pi Engine Integration Strategy (transport choice — RPC over subprocess)

---

## Addendum (2026-04-27): contract extensions from chat-foundation

The original `AgentManager` defined here covered only the streaming/lifecycle surface (`send`, `abort`, `newSession`, `getStatus`, `getUsage`, `respondToUiRequest`, `onEvent`, `onStderr`, `stop`, `dispose`). The `chat-foundation` sprint (Phase 2.1) extended the contract with four runtime-agnostic query methods needed by the chat composer's model selector, slash popup, and Settings tab:

```typescript
interface AgentManager {
  // ...original surface...

  // Added in chat-foundation Phase 2.1:
  getAvailableModels(): Promise<AgentModel[]>;
  setModel(target: { provider: string; modelId: string }): Promise<AgentModel>;
  getCommands(): Promise<AgentCommand[]>;
  getStderr(): string;
}
```

Companion type changes (`AgentModel`, `AgentCommand`, structured `AgentStatus.model`) live in `packages/shared/src/agent.ts`. These are runtime-agnostic: non-process adapters may return empty arrays / empty strings without violating the contract. The Pi adapter in `packages/agent/pi/src/rpc-manager.ts` implements them via the `get_available_models`, `set_model`, `get_commands` RPC requests and the buffered stderr captured by `rpc-client.ts`.

The abstraction boundary is unchanged: `apps/vscode/src/panels/sidebar-panel.ts` still depends only on `AgentManager`, never on the Pi adapter.
