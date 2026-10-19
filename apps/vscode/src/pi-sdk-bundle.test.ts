/**
 * Guard the shipped API-provider bootstrap from depending on workspace
 * node_modules at runtime.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-2]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("bundled Pi SDK bootstrap", () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const resourceRoot = path.resolve(dirname, "../resources/pi-sdk");

  it("does not ship bare Pi package imports", () => {
    const bootstrapPath = path.resolve(resourceRoot, "bootstrap.js");
    const source = readFileSync(bootstrapPath, "utf8");

    expect(source).not.toMatch(
      /(?:from\s*["']@earendil-works\/pi-|import\(\s*["']@earendil-works\/pi-|from\s*["']@mariozechner\/pi-|import\(\s*["']@mariozechner\/pi-)/,
    );
  });

  it("marks the resource folder as ESM for Node startup", () => {
    const packageJsonPath = path.resolve(resourceRoot, "package.json");

    expect(JSON.parse(readFileSync(packageJsonPath, "utf8"))).toMatchObject({
      type: "module",
      afxBundledPi: { package: "@earendil-works/pi-coding-agent", version: "0.84.4" },
    });
  });

  it("ships Pi runtime assets required during RPC startup", () => {
    expect(existsSync(path.resolve(resourceRoot, "dist/modes/interactive/theme/dark.json"))).toBe(
      true,
    );
    expect(existsSync(path.resolve(resourceRoot, "dist/modes/interactive/theme/light.json"))).toBe(
      true,
    );
    expect(existsSync(path.resolve(resourceRoot, "dist/core/export-html/template.html"))).toBe(
      true,
    );
  });

  it("starts the shipped Pi 0.84.4 runtime and clears its real queues without a model request", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "afx-bundled-pi-"));
    const child = spawn(
      process.execPath,
      [
        path.join(resourceRoot, "bootstrap.js"),
        "--mode",
        "rpc",
        "--no-session",
        "--no-extensions",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
        "--provider",
        "openai",
        "--model",
        "gpt-5.4",
      ],
      {
        cwd,
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: path.join(cwd, "agent"),
          OPENAI_API_KEY: "fixture-key",
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const lines = createInterface({ input: child.stdout });
    const iterator = lines[Symbol.asyncIterator]();
    const updates: unknown[] = [];
    let id = 0;
    async function request(command: { type: string; [key: string]: unknown }): Promise<unknown> {
      const requestId = String(++id);
      child.stdin.write(JSON.stringify({ ...command, id: requestId }) + "\n");
      for (;;) {
        const line = await iterator.next();
        if (line.done) throw new Error("Pi exited before returning a response");
        const event = JSON.parse(line.value);
        if (event.type === "queue_update") updates.push(event);
        if (event.type !== "response" || event.id !== requestId) continue;
        if (!event.success) throw new Error(String(event.error));
        return event.data;
      }
    }
    try {
      await expect(request({ type: "get_state" })).resolves.toMatchObject({
        model: { provider: "openai", id: "gpt-5.4" },
      });
      await request({ type: "set_session_name", name: "AFX runtime smoke" });
      await request({ type: "steer", message: "steering fixture" });
      await request({ type: "follow_up", message: "follow-up fixture" });
      await expect(request({ type: "get_state" })).resolves.toMatchObject({
        pendingMessageCount: 2,
      });
      await expect(request({ type: "clear_queue" })).resolves.toEqual({
        steering: ["steering fixture"],
        followUp: ["follow-up fixture"],
      });
      await expect(request({ type: "get_state" })).resolves.toMatchObject({
        pendingMessageCount: 0,
      });
      expect(updates).toContainEqual(expect.objectContaining({ steering: [], followUp: [] }));
      await expect(request({ type: "new_session" })).resolves.toMatchObject({
        cancelled: false,
      });
    } finally {
      lines.close();
      child.kill();
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 20_000);
});
