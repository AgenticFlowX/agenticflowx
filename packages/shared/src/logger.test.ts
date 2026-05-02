/**
 * Unit tests for the structured logger.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-6]
 * @see docs/specs/100-package-shared/design.md [DES-LOG]
 */
import { describe, expect, it, vi } from "vitest";

import {
  consoleSink,
  createLogger,
  memorySink,
  onErrorAutoShowSink,
  outputChannelSink,
} from "./logger";

describe("createLogger — level gating", () => {
  it("emits records at or above the configured level", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "info", sinks: [sink] });

    log.trace("t");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    const levels = sink.records().map((r) => r.level);
    expect(levels).toEqual(["info", "warn", "error"]);
  });

  it("does NOT invoke the lazy callback when the level is filtered out", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "warn", sinks: [sink] });
    const factory = vi.fn(() => "expensive");

    log.debug(factory);
    log.info(factory);

    expect(factory).not.toHaveBeenCalled();
    expect(sink.records()).toEqual([]);
  });

  it("invokes the lazy callback exactly once when the level passes", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "debug", sinks: [sink] });
    const factory = vi.fn(() => "computed");

    log.debug(factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(sink.records()[0]?.message).toBe("computed");
  });

  it("setLevel('silent') stops emission immediately", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "trace", sinks: [sink] });
    log.info("before");
    log.setLevel("silent");
    log.error("after");
    expect(sink.records().map((r) => r.message)).toEqual(["before"]);
  });

  it("setLevel on root propagates to existing children", () => {
    const sink = memorySink();
    const root = createLogger({ scope: "afx", level: "info", sinks: [sink] });
    const child = root.child("rpc-manager");

    child.debug("not yet"); // filtered
    expect(sink.records()).toEqual([]);

    root.setLevel("debug");
    child.debug("now");

    expect(sink.records().map((r) => r.message)).toEqual(["now"]);
    expect(sink.records()[0]?.scope).toBe("afx:rpc-manager");
  });
});

describe("createLogger — child scoping", () => {
  it("joins scope with ':' separator", () => {
    const sink = memorySink();
    const root = createLogger({ scope: "afx", level: "trace", sinks: [sink] });
    const a = root.child("rpc-manager");
    const b = a.child("agent-event");

    a.info("hello");
    b.info("world");

    expect(sink.records()[0]?.scope).toBe("afx:rpc-manager");
    expect(sink.records()[1]?.scope).toBe("afx:rpc-manager:agent-event");
  });

  it("merges fields, child wins on key collision", () => {
    const sink = memorySink();
    const root = createLogger({ scope: "afx", level: "trace", sinks: [sink] });
    const child = root.child("rpc", { runtime: "pi", common: "parent" });

    child.info("started", { common: "child", pid: 123 });

    expect(sink.records()[0]?.fields).toEqual({
      runtime: "pi",
      common: "child", // child overrides parent
      pid: 123,
    });
  });

  it("empty root scope: child scope is just the child name", () => {
    const sink = memorySink();
    const root = createLogger({ level: "trace", sinks: [sink] });
    const child = root.child("alpha");
    child.info("hi");
    expect(sink.records()[0]?.scope).toBe("alpha");
  });
});

describe("outputChannelSink — formatting", () => {
  it("renders [ISO] [LEVEL] [scope] message", () => {
    const lines: string[] = [];
    const log = createLogger({
      scope: "afx",
      level: "info",
      sinks: [outputChannelSink({ appendLine: (l) => lines.push(l) })],
    });
    log.info("started");
    expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[INFO\] \[afx\] started$/);
  });

  it("renders scalar fields as {k=v}", () => {
    const lines: string[] = [];
    const log = createLogger({
      scope: "afx",
      level: "info",
      sinks: [outputChannelSink({ appendLine: (l) => lines.push(l) })],
    });
    log.info("ok", { code: 200, ms: 12.5, retry: false, tag: "primary" });
    expect(lines[0]).toContain('{code=200, ms=12.5, retry=false, tag="primary"}');
  });

  it("renders object/array fields as json={...} tail", () => {
    const lines: string[] = [];
    const log = createLogger({
      scope: "afx",
      level: "info",
      sinks: [outputChannelSink({ appendLine: (l) => lines.push(l) })],
    });
    log.info("payload", { batch: [1, 2, 3], obj: { k: "v" } });
    expect(lines[0]).toMatch(/json=\{.*"batch":\[1,2,3\].*"obj":\{"k":"v"\}.*\}$/);
  });

  it("mixes scalars and objects: scalars first, json= tail second", () => {
    const lines: string[] = [];
    const log = createLogger({
      scope: "afx",
      level: "info",
      sinks: [outputChannelSink({ appendLine: (l) => lines.push(l) })],
    });
    log.info("mix", { a: 1, payload: { b: 2 } });
    expect(lines[0]).toMatch(/\{a=1\} json=\{"payload":\{"b":2\}\}$/);
  });

  it("renders error stack on indented lines after the message", () => {
    const lines: string[] = [];
    const log = createLogger({
      scope: "afx",
      level: "error",
      sinks: [outputChannelSink({ appendLine: (l) => lines.push(l) })],
    });
    const err = new Error("boom");
    log.error("send failed", err);
    expect(lines[0]).toContain("[ERROR] [afx] send failed");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toMatch(/^ {2}/); // stack lines indented
  });

  it("truncates long string fields to 500 chars + ellipsis", () => {
    const lines: string[] = [];
    const log = createLogger({
      scope: "afx",
      level: "info",
      sinks: [outputChannelSink({ appendLine: (l) => lines.push(l) })],
    });
    const big = "x".repeat(600);
    log.info("big", { value: big });
    expect(lines[0]).toContain("…");
    expect(lines[0]?.length ?? 0).toBeLessThan(700);
  });
});

describe("error API", () => {
  it("error(msg, err) attaches the Error to the record", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "error", sinks: [sink] });
    const err = new Error("boom");
    log.error("oops", err);
    expect(sink.records()[0]?.err).toBe(err);
    expect(sink.records()[0]?.fields).toBeUndefined();
  });

  it("error(msg, err, fields) attaches both", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "error", sinks: [sink] });
    const err = new Error("boom");
    log.error("oops", err, { requestId: "r1" });
    expect(sink.records()[0]?.err).toBe(err);
    expect(sink.records()[0]?.fields).toEqual({ requestId: "r1" });
  });

  it("error(msg, fields) without an Error treats arg2 as fields", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "afx", level: "error", sinks: [sink] });
    log.error("oops", { requestId: "r1" });
    expect(sink.records()[0]?.err).toBeUndefined();
    expect(sink.records()[0]?.fields).toEqual({ requestId: "r1" });
  });
});

describe("onErrorAutoShowSink", () => {
  it("calls channel.show(true) on the first error record only", () => {
    const channel = { show: vi.fn() };
    const log = createLogger({
      scope: "afx",
      level: "error",
      sinks: [onErrorAutoShowSink(channel)],
    });
    log.warn("ignored"); // not error
    expect(channel.show).not.toHaveBeenCalled();
    log.error("first");
    log.error("second");
    expect(channel.show).toHaveBeenCalledTimes(1);
    expect(channel.show).toHaveBeenCalledWith(true);
  });
});

describe("consoleSink", () => {
  it("routes to console method matching the level", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const log = createLogger({ scope: "test", level: "trace", sinks: [consoleSink()] });
    log.error("e");
    log.warn("w");
    log.info("i");

    expect(errSpy).toHaveBeenCalledWith("[test] e");
    expect(warnSpy).toHaveBeenCalledWith("[test] w");
    expect(infoSpy).toHaveBeenCalledWith("[test] i");

    errSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("passes fields as second arg and error as third", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger({ scope: "x", level: "trace", sinks: [consoleSink()] });
    const err = new Error("boom");
    log.error("oops", err, { req: 1 });
    expect(errSpy).toHaveBeenCalledWith("[x] oops", { req: 1 }, err);
    errSpy.mockRestore();
  });
});

describe("memorySink", () => {
  it("captures records and supports clear()", () => {
    const sink = memorySink();
    const log = createLogger({ scope: "x", level: "trace", sinks: [sink] });
    log.info("a");
    log.info("b");
    expect(sink.records()).toHaveLength(2);
    sink.clear();
    expect(sink.records()).toHaveLength(0);
  });
});

describe("sink robustness", () => {
  it("a faulty sink does not break logging to other sinks", () => {
    const broken: { write: () => void } = {
      write: () => {
        throw new Error("sink boom");
      },
    };
    const good = memorySink();
    const log = createLogger({ scope: "x", level: "info", sinks: [broken, good] });
    log.info("ok");
    expect(good.records()).toHaveLength(1);
  });
});
