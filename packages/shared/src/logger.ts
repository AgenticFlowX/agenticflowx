/**
 * Structured logger — leveled, scoped, lazy. No third-party deps.
 *
 * Usage:
 *   const root = createLogger({ scope: "afx", level: "info", sinks: [outputChannelSink(channel)] });
 *   const log = root.child("rpc-manager");
 *   log.debug(() => `expensive: ${JSON.stringify(payload)}`);  // skipped when level > debug
 *   log.error("send failed", err);                              // err.stack rendered by sink
 *
 * @see docs/specs/100-package-shared/spec.md [FR-6]
 * @see docs/specs/100-package-shared/design.md [DES-LOG]
 * @see docs/adr/ADR-0003-structured-logger.md
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug" | "trace";

export type EmittedLevel = Exclude<LogLevel, "silent">;

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

export interface LogRecord {
  level: EmittedLevel;
  scope: string;
  ts: number;
  message: string;
  fields?: Record<string, unknown>;
  err?: Error;
}

export interface LogSink {
  write(record: LogRecord): void;
}

type LazyMessage = string | (() => string);

export interface Logger {
  readonly level: LogLevel;
  setLevel(level: LogLevel): void;
  child(name: string, fields?: Record<string, unknown>): Logger;
  trace(msg: LazyMessage, fields?: Record<string, unknown>): void;
  debug(msg: LazyMessage, fields?: Record<string, unknown>): void;
  info(msg: LazyMessage, fields?: Record<string, unknown>): void;
  warn(msg: LazyMessage, fields?: Record<string, unknown>): void;
  error(
    msg: LazyMessage,
    errOrFields?: Error | Record<string, unknown>,
    fields?: Record<string, unknown>,
  ): void;
}

export interface CreateLoggerOptions {
  scope?: string;
  level?: LogLevel;
  sinks: readonly LogSink[];
}

interface LoggerState {
  level: LogLevel;
  sinks: readonly LogSink[];
}

export function createLogger(opts: CreateLoggerOptions): Logger {
  const state: LoggerState = {
    level: opts.level ?? "info",
    sinks: opts.sinks,
  };
  return makeLogger(state, opts.scope ?? "", undefined);
}

function makeLogger(
  state: LoggerState,
  scope: string,
  bindings: Record<string, unknown> | undefined,
): Logger {
  function shouldEmit(level: EmittedLevel): boolean {
    return LEVEL_ORDER[state.level] >= LEVEL_ORDER[level];
  }

  function emit(
    level: EmittedLevel,
    msg: LazyMessage,
    err: Error | undefined,
    callFields: Record<string, unknown> | undefined,
  ): void {
    if (!shouldEmit(level)) return;
    const message = typeof msg === "function" ? msg() : msg;
    const merged = mergeFields(bindings, callFields);
    const record: LogRecord = {
      level,
      scope,
      ts: Date.now(),
      message,
      fields: merged,
      err,
    };
    for (const sink of state.sinks) {
      try {
        sink.write(record);
      } catch {
        // a faulty sink must not break logging
      }
    }
  }

  const logger: Logger = {
    get level() {
      return state.level;
    },
    setLevel(level) {
      state.level = level;
    },
    child(name, fields) {
      const childScope = scope ? `${scope}:${name}` : name;
      const childBindings = mergeFields(bindings, fields);
      return makeLogger(state, childScope, childBindings);
    },
    trace(msg, fields) {
      emit("trace", msg, undefined, fields);
    },
    debug(msg, fields) {
      emit("debug", msg, undefined, fields);
    },
    info(msg, fields) {
      emit("info", msg, undefined, fields);
    },
    warn(msg, fields) {
      emit("warn", msg, undefined, fields);
    },
    error(msg, errOrFields, fields) {
      const err = errOrFields instanceof Error ? errOrFields : undefined;
      const callFields = errOrFields instanceof Error ? fields : errOrFields;
      emit("error", msg, err, callFields);
    },
  };
  return logger;
}

// Child fields shallow-merge with parent; child wins on key collision (pino convention).
function mergeFields(
  parent: Record<string, unknown> | undefined,
  child: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!parent && !child) return undefined;
  if (!parent) return child;
  if (!child) return parent;
  return { ...parent, ...child };
}

// ---------------------------------------------------------------------------
// Sinks
// ---------------------------------------------------------------------------

const LEVEL_LABEL: Record<EmittedLevel, string> = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
  trace: "TRACE",
};

const FIELD_VALUE_MAX = 500;

/**
 * Sink that writes human-readable lines to a VSCode OutputChannel
 * (or anything with `appendLine(line: string): void`).
 *
 * Format: `[ISO] [LEVEL] [scope] message {k=v}`
 *   - scalar fields rendered as `k=v` pairs
 *   - object/array fields collapsed into a trailing `json={...}` blob
 *   - error stack rendered on the next line, indented 2 spaces
 */
export function outputChannelSink(channel: { appendLine(line: string): void }): LogSink {
  return {
    write(record) {
      const ts = new Date(record.ts).toISOString();
      const level = LEVEL_LABEL[record.level];
      const scope = record.scope ? ` [${record.scope}]` : "";
      const tail = formatFieldsTail(record.fields);
      channel.appendLine(`[${ts}] [${level}]${scope} ${record.message}${tail}`);
      if (record.err?.stack) {
        for (const line of record.err.stack.split("\n")) {
          channel.appendLine(`  ${line}`);
        }
      }
    },
  };
}

/**
 * Optional sink that shows the channel on the first error record. Use only for
 * explicit diagnostic sessions; ordinary chat UX should log errors without
 * stealing focus.
 */
export function onErrorAutoShowSink(channel: { show(preserveFocus?: boolean): void }): LogSink {
  let shown = false;
  return {
    write(record) {
      if (shown) return;
      if (record.level !== "error") return;
      shown = true;
      try {
        channel.show(true);
      } catch {
        // VSCode-only; ignore in tests
      }
    },
  };
}

/**
 * Sink that routes records to console methods. Use in webview / browser contexts.
 *
 * - error → console.error
 * - warn  → console.warn
 * - info  → console.info
 * - debug → console.debug ?? console.log
 * - trace → console.debug ?? console.log
 *
 * First arg: `[scope] message`. Fields appear as the second arg so devtools renders the object.
 * Errors are passed as a third arg when present.
 */
export function consoleSink(): LogSink {
  return {
    write(record) {
      const prefix = record.scope ? `[${record.scope}]` : "[afx]";
      const head = `${prefix} ${record.message}`;
      const args: unknown[] = [head];
      if (record.fields) args.push(record.fields);
      if (record.err) args.push(record.err);
      const fn = pickConsoleFn(record.level);
      fn(...args);
    },
  };
}

function pickConsoleFn(level: EmittedLevel): (...args: unknown[]) => void {
  switch (level) {
    case "error":
      return console.error.bind(console);
    case "warn":
      return console.warn.bind(console);
    case "info":
      return console.info.bind(console);
    case "debug":
    case "trace":
      return (console.debug ?? console.log).bind(console);
  }
}

/**
 * Test-only sink that captures records in memory.
 * Exposed for fixtures; not intended for production use.
 */
export interface MemorySink extends LogSink {
  records(): readonly LogRecord[];
  clear(): void;
}

export function memorySink(): MemorySink {
  const captured: LogRecord[] = [];
  return {
    write(record) {
      captured.push(record);
    },
    records() {
      return captured;
    },
    clear() {
      captured.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function formatFieldsTail(fields: Record<string, unknown> | undefined): string {
  if (!fields) return "";
  const keys = Object.keys(fields);
  if (keys.length === 0) return "";
  const scalars: string[] = [];
  const complex: Record<string, unknown> = {};
  let hasComplex = false;
  for (const k of keys) {
    const v = fields[k];
    if (isScalar(v)) {
      scalars.push(`${k}=${formatScalar(v)}`);
    } else {
      complex[k] = v;
      hasComplex = true;
    }
  }
  let tail = "";
  if (scalars.length > 0) tail += ` {${scalars.join(", ")}}`;
  if (hasComplex) tail += ` json=${safeStringify(complex)}`;
  return tail;
}

function isScalar(v: unknown): v is string | number | boolean | null | undefined | bigint {
  const t = typeof v;
  return (
    v === null ||
    t === "undefined" ||
    t === "string" ||
    t === "number" ||
    t === "boolean" ||
    t === "bigint"
  );
}

function formatScalar(v: unknown): string {
  if (typeof v === "string") {
    if (v.length > FIELD_VALUE_MAX) return JSON.stringify(v.slice(0, FIELD_VALUE_MAX) + "…");
    return JSON.stringify(v);
  }
  return String(v);
}

function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value, (_k, v: unknown) => {
      if (typeof v === "string" && v.length > FIELD_VALUE_MAX) {
        return v.slice(0, FIELD_VALUE_MAX) + "…";
      }
      return v;
    });
    return json ?? String(value);
  } catch (err) {
    return `<unserialisable: ${err instanceof Error ? err.message : String(err)}>`;
  }
}
