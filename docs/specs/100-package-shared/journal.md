---
afx: true
type: JOURNAL
status: Living
tags: ["package", "shared", "protocol", "types", "agent", "logging"]
---

# @afx/shared — Journal

## Discussion: AgentManager contract added (2026-04-26T08:05:52.000Z)

### Context

During the `packages/agent/pi` extraction work, it became clear that `sidebar-panel.ts` was importing `PiManager` directly — making Pi the only possible agent runtime. To decouple the extension host from Pi, a runtime-agnostic contract is needed in `@afx/shared` so that swapping to any future runtime requires only changing which factory is called in `extension.ts`.

### Decision

Add `AgentManager`, `AgentEvent`, `AgentStatus`, `Disposable`, and `Logger` to `@afx/shared` as FR-6. All agent adapters (`packages/agent/pi`, future `packages/agent/future-runtime`, etc.) implement this interface. The extension host and sidebar panel depend only on `AgentManager` — never on `PiManager` or any adapter-specific type.

`Disposable` and `Logger` are minimal structural interfaces that VSCode types satisfy structurally, keeping the shared package free of VSCode API imports.

### Links

- FR-6 added to `spec.md`
- `agent.ts` added to `design.md` (DES-ARCH, DES-DATA, DES-API, DES-FILES, File Reference Map)
- Related: `packages/agent/pi` extraction plan, ADR for AgentManager abstraction

---

## Implementation complete (2026-04-26T11:35:05.000Z)

Phase 2 tasks shipped. `packages/shared/src/agent.ts` created and exported from `index.ts`. All downstream consumers (`apps/vscode`, `packages/agent/pi`) import `AgentManager` and `AgentEvent` from `@afx/shared`. `pnpm check:types` passes with zero errors across 6 packages.

---

## Discussion: Structured Logger (ADR-0003) (2026-04-26T14:09:51.000Z)

### Context — Logger

Logging across the workspace was fragmented — `Logger { appendLine }`, ad-hoc `log()` wrappers, separate `{ info, warn, error }` shapes in `rpc-client.ts`, raw `console.*` in transports and bridges, and ~14 of 32 callsites doing eager `JSON.stringify` / `error.message` extraction inside template literals. With aggressive logging, every callsite paid the cost regardless of whether anyone read the output.

Surveyed prior art: pino (heavy, JSON-first, awkward in OutputChannel), winston (heavy), `debug` (no levels). Earlier internal wrappers were thin but lacked scope+lazy. Industry norms: pino-style child loggers, lazy callbacks, level enum.

### Decision — Logger

Custom thin logger in `packages/shared/src/logger.ts` (~100 LOC, no deps). Six levels (silent..trace), scoped child loggers (`root.child("rpc-manager")` → `[afx:rpc-manager]`), lazy callbacks (`logger.debug(() => expensive())`), pluggable sinks (OutputChannel, console, memory, autoShow). Level resolution: `AFX_LOG_LEVEL` env > `afx.logLevel` setting > `info` default. Live updates via `onDidChangeConfiguration`.

Migrated all 32 callsites across 11 files. Replaced `Logger { appendLine }` with the structured contract; `vscode.OutputChannel` enters through `outputChannelSink(channel)` instead of satisfying `Logger` directly. `onErrorAutoShowSink(channel)` preserves the prior "open AFX output on first error" UX.

### Links — Logger

- ADR-0003: `docs/adr/ADR-0003-afx-structured-logger.md`
- FR-6 added; spec bumped to v1.2; design.md adds `[DES-LOG]` section
- 25 logger unit tests + 82 total workspace tests passing
- New VSCode setting `afx.logLevel`; new env override `AFX_LOG_LEVEL`
