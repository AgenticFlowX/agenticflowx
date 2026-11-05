/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-16] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST] [DES-SEC]
 */
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentEvent, AgentManager } from "@afx/shared";

import {
  inventoryRepository,
  investigateRepository,
  requestInvestigationTurn,
} from "./blueprint-investigation";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "afx-investigate-"));
  roots.push(root);
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "README.md"), "Audio application\n");
  await writeFile(path.join(root, "src/main.cpp"), "void process() { engine.run(); }\n");
  await writeFile(path.join(root, "CMakeLists.txt"), "add_executable(audio src/main.cpp)\n");
  return root;
}
function agent(
  respond: (prompt: string, turn: number, emit: (event: AgentEvent) => void) => unknown,
): AgentManager {
  let listener: (event: AgentEvent) => void = () => {};
  let turn = 0;
  return {
    onEvent: vi.fn((callback) => {
      listener = callback;
      return {
        dispose: vi.fn(() => {
          listener = () => {};
        }),
      };
    }),
    send: vi.fn(async (prompt: string) => {
      const answer = await respond(prompt, turn++, listener);
      if (answer !== undefined) {
        listener({
          type: "text_delta",
          id: "reply",
          delta: typeof answer === "string" ? answer : JSON.stringify(answer),
        });
        listener({ type: "agent_end" });
      }
    }),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
    respondToUiRequest: vi.fn(async () => {}),
  } as unknown as AgentManager;
}
function hostResults(
  prompt: string,
): Array<{ result?: { evidence?: { id: string }; text?: string }; error?: string }> {
  return JSON.parse(prompt.split("\n")[1]!);
}
function currentFindings(prompt: string): Array<{ id: string; title: string }> {
  const marker =
    "Current finding identities (use findingId only to update one of these exact records):\n";
  return JSON.parse(prompt.split(marker)[1]!.split("\n")[0]!);
}

describe("host-mediated Pi investigation", () => {
  it("follows source evidence across turns and never changes repository bytes", async () => {
    const root = await fixture();
    const before = await Promise.all(
      (await inventoryRepository(root)).map(async (file) => [
        file,
        await readFile(path.join(root, file), "utf8"),
      ]),
    );
    const manager = agent((prompt, turn) => {
      if (turn === 0)
        return {
          requests: ["README.md", "src/main.cpp", "CMakeLists.txt"].map((file) => ({
            operation: "read",
            path: file,
          })),
        };
      const evidenceIds = hostResults(prompt).map((item) => item.result!.evidence!.id);
      return {
        findings: ["purpose", "component", "flow"].map((category) => ({
          category,
          title: category,
          description: "The callback invokes the audio engine.",
          classification: "observed",
          evidenceIds,
        })),
        done: true,
        gaps: [],
      };
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(result.outcome).toBe("complete");
    expect(result.findings).toHaveLength(3);
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence[0]!.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(
      await Promise.all(
        (await inventoryRepository(root)).map(async (file) => [
          file,
          await readFile(path.join(root, file), "utf8"),
        ]),
      ),
    ).toEqual(before);
    expect(manager.dispose).toHaveBeenCalledOnce();
  });

  it("excludes secrets, generated files, traversal, symlink escapes and out-of-range evidence", async () => {
    const root = await fixture();
    const outside = await fixture();
    await writeFile(path.join(root, ".env"), "PRIVATE=never-send");
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, "node_modules/private.js"), "excluded");
    await symlink(path.join(outside, "README.md"), path.join(root, "escape.md"));
    const manager = agent((prompt, turn) => {
      if (turn === 0) {
        expect(prompt).not.toContain(".env");
        return {
          requests: [
            { operation: "read", path: ".env" },
            { operation: "read", path: "../README.md" },
            { operation: "read", path: "escape.md" },
            { operation: "read", path: "README.md", startLine: 100 },
          ],
        };
      }
      expect(hostResults(prompt).every((item) => item.error)).toBe(true);
      expect(prompt).not.toContain("never-send");
      return { done: true };
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(result.evidence).toHaveLength(0);
    expect(result.outcome).toBe("partial");
  });

  it("rejects invented citations and malformed responses without presenting a complete report", async () => {
    const root = await fixture();
    const manager = agent(() => ({
      findings: [
        {
          category: "flow",
          title: "invented",
          description: "unsupported",
          classification: "observed",
          evidenceIds: ["fake"],
        },
      ],
      done: true,
    }));
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(result.findings).toEqual([]);
    expect(result.outcome).toBe("partial");
    const invalid = await investigateRepository({
      root,
      manager: agent(() => "not json"),
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(invalid.outcome).toBe("failed");
    expect(invalid.stopReason).toContain("repair attempts");
  });

  it("aborts native tool calls and cancels a pending model turn", async () => {
    const manager = agent((_prompt, _turn, emit) => {
      emit({ type: "tool_start", toolCallId: "x", toolName: "bash" });
    });
    await expect(
      requestInvestigationTurn(manager, "inspect", new AbortController().signal),
    ).rejects.toThrow(/native tool/);
    expect(manager.abort).toHaveBeenCalledOnce();
    const controller = new AbortController();
    const pending = agent(() => undefined);
    const reply = requestInvestigationTurn(pending, "inspect", controller.signal);
    controller.abort();
    await expect(reply).rejects.toThrow(/cancelled/);
    expect(pending.abort).toHaveBeenCalledOnce();
  });

  it("retains partial source evidence after cancellation, timeout and read budgets", async () => {
    const root = await fixture();
    const controller = new AbortController();
    const manager = agent((_prompt, turn) => {
      if (turn === 0) return { requests: [{ operation: "read", path: "README.md" }] };
      controller.abort();
      return undefined;
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: controller.signal,
      progress: vi.fn(),
    });
    expect(result.outcome).toBe("cancelled");
    expect(result.evidence).toHaveLength(1);
    const timeout = await investigateRepository({
      root,
      manager: agent(() => undefined),
      signal: new AbortController().signal,
      progress: vi.fn(),
      limits: { milliseconds: 30 },
    });
    expect(timeout.stopReason).toBe("Time budget reached.");
    const limited = await investigateRepository({
      root,
      manager: agent(() => ({ requests: [{ operation: "read", path: "README.md" }] })),
      signal: new AbortController().signal,
      progress: vi.fn(),
      limits: { bytes: 1 },
    });
    expect(limited.outcome).toBe("partial");
    expect(limited.stopReason).toBe("Read budget reached.");
    expect(limited.evidence).toHaveLength(0);
  });

  it("retains only supported typed relationships and documented commands", async () => {
    const root = await fixture();
    const manager = agent((prompt, turn) => {
      if (!turn)
        return {
          requests: [
            { operation: "read", path: "src/main.cpp" },
            { operation: "read", path: "CMakeLists.txt" },
          ],
        };
      const evidenceIds = hostResults(prompt).map((item) => item.result!.evidence!.id);
      const component = (title: string) => ({
        category: "component",
        title,
        description: title,
        classification: "observed",
        evidenceIds,
      });
      if (turn === 1)
        return {
          findings: [
            component("Callback"),
            component("Engine"),
            {
              category: "build",
              title: "Build",
              description: "CMake target",
              classification: "observed",
              evidenceIds,
              command: {
                argv: ["cmake", "--build", "build"],
                workingDirectory: ".",
                prerequisites: ["CMake"],
              },
            },
          ],
          requests: [{ operation: "read", path: "README.md" }],
        };
      const identities = currentFindings(prompt);
      const callbackId = identities.find((item) => item.title === "Callback")!.id;
      const engineId = identities.find((item) => item.title === "Engine")!.id;
      return {
        relationships: [
          {
            fromFindingId: callbackId,
            toFindingId: engineId,
            type: "calls",
            description: "callback invokes engine",
            classification: "observed",
            evidenceIds,
          },
          {
            fromFindingId: callbackId,
            toFindingId: "00000000-0000-4000-8000-000000000000",
            type: "calls",
            description: "unknown",
            classification: "inferred",
            evidenceIds,
          },
        ],
        done: true,
      };
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(result.relationships).toHaveLength(1);
    expect(result.findings.find((finding) => finding.category === "build")?.command?.argv).toEqual([
      "cmake",
      "--build",
      "build",
    ]);
  });

  it("cancels a non-responsive symbol provider without hanging the investigation", async () => {
    const root = await fixture();
    const manager = agent(() => ({ requests: [{ operation: "symbols", path: "src/main.cpp" }] }));
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
      symbols: () => new Promise(() => {}),
      limits: { milliseconds: 30 },
    });
    expect(result.outcome).toBe("partial");
    expect(result.stopReason).toBe("Time budget reached.");
  });

  it("marks source that changed during investigation as partial", async () => {
    const root = await fixture();
    const manager = agent(async (prompt, turn) => {
      if (turn === 0) return { requests: [{ operation: "read", path: "README.md" }] };
      await writeFile(path.join(root, "README.md"), "Changed after observation\n");
      return {
        findings: [
          {
            category: "purpose",
            title: "audio",
            description: "audio",
            classification: "observed",
            evidenceIds: [hostResults(prompt)[0]!.result!.evidence!.id],
          },
        ],
        done: true,
      };
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(result.outcome).toBe("partial");
    expect(result.gaps).toContain("Changed during inspection: README.md");
  });
});
