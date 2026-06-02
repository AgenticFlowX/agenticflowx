/**
 * @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [NFR-6] [NFR-9]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-TEST]
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertSessionPathAllowed,
  isSessionPathAllowed,
  listSessionsFromDisk,
  parseSessionInfo,
  parseTranscript,
  piSessionRoots,
  readTranscriptFromDisk,
} from "./session-store";

const SESSION_A = [
  `{"type":"session","id":"a","timestamp":"2026-06-01T10:00:00.000Z","cwd":"/work","parentSession":"/old.jsonl"}`,
  `{"type":"session_info","id":"i","parentId":null,"name":"Named session"}`,
  `{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"first ask","timestamp":1000}}`,
  `{"type":"message","id":"m2","parentId":"m1","message":{"role":"assistant","content":[{"type":"text","text":"hello"},{"type":"toolCall","id":"tc1","name":"edit","arguments":{"path":"a.ts"}}],"timestamp":2000}}`,
  `{"type":"message","id":"m3","parentId":"m2","message":{"role":"toolResult","toolCallId":"tc1","toolName":"edit","content":[{"type":"text","text":"ok"}],"isError":false,"timestamp":3000}}`,
  `{"type":"message","id":"m4","parentId":"m3","message":{"role":"bashExecution","command":"pnpm verify","exitCode":0,"timestamp":4000}}`,
].join("\n");

const SESSION_B = [
  `{"type":"session","id":"b","timestamp":"2026-06-01T09:00:00.000Z","cwd":"/other"}`,
  `{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"other workspace","timestamp":500}}`,
].join("\n");

// Lives in a per-project subdir (the real Pi layout: <dir>/sessions/<encoded-cwd>/).
const SESSION_C = [
  `{"type":"session","id":"c","timestamp":"2026-06-02T09:00:00.000Z","cwd":"/nested"}`,
  `{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"nested project","timestamp":9000}}`,
].join("\n");

describe("parseSessionInfo", () => {
  it("normalizes a session file into a list row (epoch-ms, label, fork, cwd)", () => {
    const parsed = parseSessionInfo(SESSION_A, "/sessions/a.jsonl");
    expect(parsed).not.toBeNull();
    expect(parsed?.cwd).toBe("/work");
    expect(parsed?.info).toMatchObject({
      id: "a",
      path: "/sessions/a.jsonl",
      label: "Named session", // session_info name wins over firstMessage
      firstMessage: "first ask",
      messageCount: 4,
      createdAt: Date.parse("2026-06-01T10:00:00.000Z"),
      updatedAt: 4000, // last message timestamp
      forkedFrom: "/old.jsonl",
    });
  });

  it("returns null for non-session content", () => {
    expect(parseSessionInfo("", "/x")).toBeNull();
    expect(parseSessionInfo(`{"type":"message","id":"m"}`, "/x")).toBeNull();
  });
});

describe("parseTranscript", () => {
  it("resolves the leaf branch and maps every role", () => {
    const out = parseTranscript(SESSION_A);
    expect(out.map((e) => e.role)).toEqual(["user", "assistant", "tool", "bash"]);
    expect(out[0]).toMatchObject({ role: "user", text: "first ask" });
    expect(out[1]).toMatchObject({
      role: "assistant",
      text: "hello",
      toolCalls: [{ id: "tc1", name: "edit", args: { path: "a.ts" } }],
    });
    expect(out[2]).toMatchObject({
      role: "tool",
      toolResult: { toolCallId: "tc1", toolName: "edit", ok: true, summary: "ok" },
    });
    expect(out[3]).toMatchObject({ role: "bash", bash: { command: "pnpm verify", exitCode: 0 } });
  });

  it("follows parentId (ignores an abandoned branch off m1)", () => {
    const branched = [
      `{"type":"session","id":"s","timestamp":"2026-06-01T10:00:00.000Z"}`,
      `{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"root","timestamp":1}}`,
      `{"type":"message","id":"abandoned","parentId":"m1","message":{"role":"assistant","content":[{"type":"text","text":"WRONG"}],"timestamp":2}}`,
      `{"type":"message","id":"m2","parentId":"m1","message":{"role":"assistant","content":[{"type":"text","text":"kept"}],"timestamp":3}}`,
    ].join("\n");
    const out = parseTranscript(branched);
    // Leaf = last entry (m2); branch = root → m2, abandoned excluded.
    expect(out.map((e) => e.text)).toEqual(["root", "kept"]);
  });

  it("uses the last message as the leaf when metadata is appended after it", () => {
    const renamed = [
      `{"type":"session","id":"s","timestamp":"2026-06-01T10:00:00.000Z"}`,
      `{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"root","timestamp":1}}`,
      `{"type":"message","id":"m2","parentId":"m1","message":{"role":"assistant","content":[{"type":"text","text":"kept"}],"timestamp":2}}`,
      `{"type":"session_info","id":"rename","parentId":null,"name":"Renamed later"}`,
    ].join("\n");
    const out = parseTranscript(renamed);
    expect(out.map((e) => e.text)).toEqual(["root", "kept"]);
  });
});

describe("disk readers", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "afx-history-"));
    await writeFile(join(dir, "a.jsonl"), SESSION_A);
    await writeFile(join(dir, "b.jsonl"), SESSION_B);
    await writeFile(join(dir, "ignore.txt"), "not a session");
    // Nested per-project session (the real Pi layout).
    await mkdir(join(dir, "sessions", "--nested--"), { recursive: true });
    await writeFile(join(dir, "sessions", "--nested--", "c.jsonl"), SESSION_C);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("listSessionsFromDisk filters by workspace cwd", async () => {
    const here = await listSessionsFromDisk([dir], "/work");
    expect(here.map((s) => s.id)).toEqual(["a"]);
  });

  it("listSessionsFromDisk lists all sessions (incl. nested subdirs), newest-first", async () => {
    const all = await listSessionsFromDisk([dir]);
    // c (nested, updated 9000) > a (4000) > b (500)
    expect(all.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("listSessionsFromDisk merges multiple roots and dedupes overlap", async () => {
    // Same dir passed twice + a missing dir → still one set of sessions.
    const merged = await listSessionsFromDisk([dir, dir, join(dir, "nope")]);
    expect(merged.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("listSessionsFromDisk returns [] for a missing dir", async () => {
    expect(await listSessionsFromDisk([join(dir, "nope")])).toEqual([]);
  });

  it("readTranscriptFromDisk reads a file's leaf branch", async () => {
    const out = await readTranscriptFromDisk(join(dir, "a.jsonl"));
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ role: "user", text: "first ask" });
  });

  it("readTranscriptFromDisk returns [] for a missing file", async () => {
    expect(await readTranscriptFromDisk(join(dir, "nope.jsonl"))).toEqual([]);
  });

  it("allows only existing JSONL files under known session roots", async () => {
    const allowed = join(dir, "a.jsonl");
    const outsideDir = await mkdtemp(join(tmpdir(), "afx-history-outside-"));
    const outside = join(outsideDir, "outside.jsonl");
    await writeFile(outside, SESSION_A);
    await writeFile(join(dir, "not-jsonl.txt"), SESSION_A);

    expect(await isSessionPathAllowed(allowed, [dir])).toBe(true);
    expect(await isSessionPathAllowed(outside, [dir])).toBe(false);
    expect(await isSessionPathAllowed(join(dir, "not-jsonl.txt"), [dir])).toBe(false);
    await expect(assertSessionPathAllowed(outside, [dir])).rejects.toThrow(/outside configured/);

    await rm(outsideDir, { recursive: true, force: true });
  });
});

describe("piSessionRoots", () => {
  it("includes the AFX dir (first), the injected agent dir, and the default store", () => {
    const roots = piSessionRoots("/afx/sessions", "/custom/pi");
    expect(roots[0]).toBe("/afx/sessions");
    expect(roots).toContain(join("/custom/pi", "sessions"));
    expect(roots.some((r) => r.endsWith(join(".pi", "agent", "sessions")))).toBe(true);
  });

  it("dedupes when the injected agent dir is the default store", () => {
    // agentDir === ~/.pi/agent → its sessions root equals the always-added default.
    const roots = piSessionRoots(undefined, join(homedir(), ".pi", "agent"));
    const defaults = roots.filter((r) => r === join(homedir(), ".pi", "agent", "sessions"));
    expect(defaults).toHaveLength(1);
  });

  it("works without an AFX dir or agent dir", () => {
    const roots = piSessionRoots();
    expect(roots.length).toBeGreaterThanOrEqual(1);
    expect(roots.some((r) => r.endsWith(join(".pi", "agent", "sessions")))).toBe(true);
  });
});
