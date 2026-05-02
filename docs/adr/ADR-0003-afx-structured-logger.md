---
afx: true
type: ADR
status: Accepted
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T14:09:51.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["adr", "architecture", "logging", "observability", "performance"]
---

# ADR-0003: AFX Structured Logger with Lazy Evaluation

## Context

Logging in the current monorepo was fragmented across ~32 callsites in 11 source files:

- `packages/shared/src/agent.ts` exported a one-method `Logger` interface (`appendLine`) — too thin to gate verbosity.
- `packages/agent/pi/src/rpc-manager.ts` defined its own `log()` wrapper around `output.appendLine`.
- `packages/agent/pi/src/rpc-client.ts` accepted a separate optional `logger?: { info, warn, error }` shape — different from the `Logger` interface above.
- `apps/vscode/src/panels/sidebar-panel.ts` defined local `log()` and `logErr()` wrappers with `[HH:MM:SS.mmm]` timestamp prefix, plus an inline `safeJson` helper for `JSON.stringify` truncation. ~18 callsites.
- `apps/vscode/src/extension.ts` called `output.appendLine` directly inside `agentSmokeTest` (~7 callsites).
- `packages/transport/{mock,vscode}.ts` and the chat/workbench bridges used raw `console.*`.

Roughly **14 of 32 callsites used eager evaluation** — template literals interpolating `JSON.stringify`, `error.message` extraction, `.join`, `.trimEnd`. With aggressive logging, every callsite paid the formatting cost even when no consumer was reading the output.

There was no env var, VSCode setting, or runtime toggle for verbosity. No third-party logger was installed. Earlier internal implementations took different approaches:

- A functional API (`logDebug/logInfo/logWarn/logError`) with a runtime `setLogLevel()`. No scoping, no lazy evaluation.
- An interface with optional `context` string and a `process.env.DEBUG` gate. No lazy evaluation, no level hierarchy.

Neither prior design supported the "aggressive logging without runtime cost" pattern that lazy callbacks enable.

---

## Decision

**Build a thin (~100 LOC) structured logger in `@afx/shared`. No third-party dependencies.**

The contract:

```typescript
type LogLevel = "silent" | "error" | "warn" | "info" | "debug" | "trace";

interface Logger {
  readonly level: LogLevel;
  setLevel(level: LogLevel): void;
  child(name: string, fields?: Record<string, unknown>): Logger;
  trace(msg: string | (() => string), fields?: Record<string, unknown>): void;
  debug(msg: string | (() => string), fields?: Record<string, unknown>): void;
  info(msg: string | (() => string), fields?: Record<string, unknown>): void;
  warn(msg: string | (() => string), fields?: Record<string, unknown>): void;
  error(
    msg: string | (() => string),
    errOrFields?: Error | Record<string, unknown>,
    fields?: Record<string, unknown>,
  ): void;
}

function createLogger(opts: { scope?: string; level?: LogLevel; sinks: LogSink[] }): Logger;

// Sinks
function outputChannelSink(channel: { appendLine(line: string): void }): LogSink;
function onErrorAutoShowSink(channel: { show(preserveFocus?: boolean): void }): LogSink;
function consoleSink(): LogSink;
function memorySink(): LogSink & { records(): LogRecord[]; clear(): void };
```

**Key behaviors:**

1. **Lazy evaluation via callbacks.** `logger.debug(() => \`expensive ${JSON.stringify(x)}\`)`— the callback is invoked only when the level passes.`silent` short-circuits before any work.
2. **Scoped child loggers.** `root.child("rpc-manager").child("agent-event")` produces records with scope `"afx:rpc-manager:agent-event"`. Encodes "where it was called" in every log line.
3. **Child field merging.** Pino convention — child fields shallow-merge with parent; child wins on key collision. Locked by unit test.
4. **Runtime level setter propagates.** `root.setLevel("debug")` updates all existing child loggers via shared mutable state. No need to recreate the tree.
5. **Dedicated error API.** `logger.error("send failed", err)` — sinks render the stack on indented lines. Eliminates the `err instanceof Error ? err.message : String(err)` ternary that appeared in 6+ callsites.
6. **Pluggable sinks.** Faulty sinks are isolated (try/catch around `sink.write`).

**Wiring:**

- `apps/vscode/src/extension.ts` creates the root logger with `outputChannelSink(channel)` + `onErrorAutoShowSink(channel)`. Channel ownership stays with the extension; sinks do not dispose channels.
- Initial level resolution: `process.env.AFX_LOG_LEVEL` → `vscode.workspace.getConfiguration("afx").get("logLevel")` → `"info"`.
- A new VSCode setting `afx.logLevel` (enum: silent/error/warn/info/debug/trace, default info) is wired to a `onDidChangeConfiguration` listener that calls `logger.setLevel(...)`.
- `packages/agent/pi/src/rpc-{manager,client}.ts` accept `logger: Logger` (manager) and `logger?: Logger` (client). Each calls `parent.child("rpc-manager")` once at the top of their factory.
- `packages/transport/*` and the chat/workbench bridges create module-level loggers backed by `consoleSink()` — webview-side, no OutputChannel.

---

## Rationale

### Why a custom logger and not pino / winston / debug?

- **Bundle size.** Pino is ~14KB and the browser build has a different API; both webviews would ship redundant copies. Our 32 callsites do not justify the size or the integration friction.
- **OutputChannel ergonomics.** Pino emits newline-delimited JSON. Humans read VSCode OutputChannels — `[ISO] [LEVEL] [scope] message {k=v}` is the industry-standard human-readable shape. We would need a custom transport for pino either way.
- **Dual host/webview.** The same `Logger` contract has to satisfy a Node extension host AND two browser webviews. A thin abstraction with pluggable sinks is cleaner than reconciling pino/winston's environment-specific builds.
- **Aggregation deferred.** If we later ship structured logs to DataDog/Loki/etc., we add a `httpSink` or wire in pino as a backend behind the same `Logger` interface. The migration is one file.

### Why scoped child loggers (pino convention) and not flat scope strings?

The `child(name)` pattern lets each module derive its own sub-scope without coordinating. `sidebar-panel.ts` uses `log.child("agent-event")`, `rpc-manager.ts` uses `log.child("client")`. The tree is implicit in the call hierarchy and the resulting `[afx:sidebar:agent-event]` scope is greppable. No central registry needed.

### Why callbacks (`() => string`) for lazy evaluation?

JavaScript template literals are eagerly built at the call site. The cost — `JSON.stringify`, `Array.join`, `.trimEnd`, error extraction — is paid even when the level is filtered. Wrapping in a thunk defers the cost behind the level gate. The cost of the thunk allocation when filtered is ~negligible vs the work it skips. Pino achieves the same effect by passing structured args (`logger.debug({ payload }, "msg")`) but at the cost of a less natural call site.

### Why `setLevel` instead of `levelRef`?

`setLevel` is ergonomic from any consumer (`logger.setLevel("debug")`). Internally it mutates the shared state object that all children share — propagation is automatic. A `levelRef` parameter would leak implementation detail into every consumer.

### Why drop the structural compatibility with `vscode.OutputChannel`?

The old `Logger` interface was `{ appendLine(value: string): void }` — satisfied by `vscode.OutputChannel` with no adapter. Convenient, but it's a single-method API that can't carry levels, scopes, or fields. The new contract is strictly richer. To preserve the OutputChannel as a sink target, we wrap it in `outputChannelSink(channel)` — which still consumes the structural `{ appendLine }` shape. So OutputChannel is still the underlying writer; it just enters through a sink rather than directly satisfying `Logger`.

### Why preserve `outputShown` auto-show as a sink?

The prior `sidebar-panel.ts:logErr` opened the AFX OutputChannel on the first error. This is a UX behavior, not a logging concern. We extracted it as `onErrorAutoShowSink(channel)` — a sink wrapper that calls `channel.show(true)` on the first record at level `error`. Channel ownership stays with the extension entry, not the sink.

---

## Webview asymmetry (deferred)

Webviews use `consoleSink()` only. They do not read `AFX_LOG_LEVEL` (no Node env), and they do not currently receive the host's `afx.logLevel` setting. Webview log volume today is <5 lines total — defaulting to `info` is fine.

If webview log volume grows, the future enhancement is a `transportSink` that pipes records to the host (or vice versa) over the existing `@afx/transport` channel. That work is gated by an ADR amendment, not this one.

---

## Consequences

### Positive

- **Single contract** across the host, the Pi adapter, and both webviews. Replaces three divergent shapes.
- **Aggressive logging is free when off.** Lazy callbacks + level gating mean `logger.debug(() => buildExpensive())` costs only the gate check when the level is `info` or higher.
- **Scoped output.** Every line carries `[afx:rpc-manager:client]` or `[afx:sidebar:agent-event]` — easy to grep, easy to mute by package.
- **Runtime level changes.** `afx.logLevel` setting flips verbosity without restarting the extension; env var override survives across editor restarts.
- **Errors carry stacks.** `logger.error(msg, err)` rendered with an indented stack — replaces 6 inline ternaries.
- **Tests.** `memorySink()` makes log assertions trivial.

### Negative / accepted trade-offs

- **Breaking shape change for `Logger`.** The old structural compat with `vscode.OutputChannel` is gone. Two internal callers (`extension.ts`, `rpc-manager.ts`) updated in this same change.
- **Webviews without level control.** Webview loggers default to `info`. If we need parity, we add the transport sink later.
- **One more abstraction to maintain.** ~100 LOC + tests, but no upstream churn, no transitive deps.

### Not decided here

- `transportSink` (host ↔ webview log forwarding) — deferred until needed.
- DataDog / Loki / OpenTelemetry export — fits as a future sink, no contract change required.
- File rotation / disk persistence — deferred; OutputChannel is sufficient for v1.

---

## References

- `docs/specs/100-package-shared/spec.md [FR-5]` — Logger surface enumerated
- `docs/specs/100-package-shared/design.md [DES-LOG]` — implementation notes
- `packages/shared/src/logger.ts` — implementation
- `packages/shared/src/logger.test.ts` — contract tests
- ADR-0001: Pi Engine Integration Strategy (transport choice — RPC over subprocess)
- ADR-0002: AgentManager Abstraction + packages/agent/pi Extraction
