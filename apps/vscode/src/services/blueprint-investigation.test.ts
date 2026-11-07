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
  type InvestigationResult,
  inventoryRepository,
  investigateRepository,
  requestInvestigationTurn,
  validateInvestigationResume,
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
  it("continues retained evidence and identities with a fresh allowance, and rejects changed source", async () => {
    const root = await fixture();
    let retained: InvestigationResult | undefined;
    const initial = await investigateRepository({
      root,
      signal: new AbortController().signal,
      progress: () => {},
      checkpoint: async (draft) => {
        retained = structuredClone(draft);
      },
      manager: agent((prompt, turn) =>
        turn === 0
          ? { requests: [{ operation: "read", path: "README.md" }] }
          : {
              findings: [
                {
                  category: "purpose",
                  title: "Audio",
                  description: "Audio application",
                  classification: "observed",
                  evidenceIds: [hostResults(prompt)[0]!.result!.evidence!.id],
                },
              ],
              gaps: ["Deployment"],
              done: true,
            },
      ),
    });
    expect(retained?.findings).toHaveLength(1);
    const continued = await investigateRepository({
      root,
      resume: retained,
      signal: new AbortController().signal,
      progress: () => {},
      limits: { calls: 1 },
      manager: agent((prompt) => {
        expect(prompt).toContain("Continue this saved investigation");
        expect(prompt).toContain(initial.findings[0]!.id);
        return {
          findings: [
            {
              findingId: initial.findings[0]!.id,
              category: "purpose",
              title: "Audio",
              description: "Updated retained explanation",
              classification: "observed",
              evidenceIds: [initial.evidence[0]!.id],
            },
          ],
          gaps: ["Deployment"],
          done: true,
        };
      }),
    });
    expect(continued.findings).toHaveLength(1);
    expect(continued.findings[0]!.id).toBe(initial.findings[0]!.id);
    expect(continued.findings[0]!.description).toBe("Updated retained explanation");
    expect(continued.usage.calls).toBe(initial.usage.calls);
    await writeFile(path.join(root, "README.md"), "Changed project\n");
    await expect(validateInvestigationResume(root, continued)).rejects.toThrow(
      /source evidence changed/,
    );
    const blocked = agent(() => ({ done: true }));
    await expect(
      investigateRepository({
        root,
        resume: continued,
        manager: blocked,
        signal: new AbortController().signal,
        progress: () => {},
      }),
    ).rejects.toThrow(/source evidence changed/);
    expect(blocked.send).not.toHaveBeenCalled();
    expect(blocked.dispose).toHaveBeenCalledOnce();
  });

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

  it("narrows search without expanding inventory and returns precise whole-line reads", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "README.md"), "dispatch\n".repeat(50));
    await writeFile(
      path.join(root, "src/main.cpp"),
      "header\ndispatch();\ncallee();\n" + "x".repeat(8001) + "\nend",
    );
    const manager = agent((prompt, turn) => {
      if (!turn)
        return {
          requests: [
            { operation: "search", path: "src", query: "dispatch" },
            { operation: "search", path: "../outside", query: "dispatch" },
            { operation: "read", path: "src/main.cpp", startLine: 2, endLine: 2 },
            { operation: "read", path: "src/main.cpp", startLine: 2 },
            { operation: "read", path: "src/main.cpp", startLine: 4 },
            { operation: "read", path: "src/main.cpp", startLine: 3, endLine: 2 },
          ],
        };
      const outputs = JSON.parse(prompt.split("\n")[1]!);
      expect(outputs[0].result.matches).toEqual([
        { path: "src/main.cpp", line: 2, text: "dispatch();" },
      ]);
      expect(outputs[0].result).not.toHaveProperty("evidence");
      expect(outputs[1].error).toMatch(/relative/);
      expect(outputs[2].result).toMatchObject({
        text: "dispatch();",
        evidence: { startLine: 2, endLine: 2 },
      });
      expect(outputs[3].result).toMatchObject({
        text: "dispatch();\ncallee();",
        nextStartLine: 4,
        evidence: { startLine: 2, endLine: 3 },
      });
      expect(outputs[4].error).toMatch(/whole-line/);
      expect(outputs[5].error).toMatch(/end line/);
      return { done: true, gaps: ["Remaining flow"] };
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
    });
    expect(result.evidence).toHaveLength(2);
    await validateInvestigationResume(root, result);
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

  it("delivers the last source batch to synthesis after exhausting exploration operations", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "unrelated.txt"), "Not in the representative execution flow");
    const manager = agent((prompt, turn) => {
      if (turn === 0)
        return {
          requests: ["README.md", "src/main.cpp", "CMakeLists.txt"].map((file) => ({
            operation: "read",
            path: file,
          })),
        };
      expect(prompt).toContain("Make no more requests");
      const evidenceIds = hostResults(prompt).map((item) => item.result!.evidence!.id);
      expect(evidenceIds).toHaveLength(3);
      expect(prompt).toContain("engine.run()");
      return {
        findings: ["purpose", "component", "flow"].map((category) => ({
          category,
          title: category,
          description: "The main callback invokes the engine.",
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
      limits: { calls: 3 },
    });
    expect(manager.send).toHaveBeenCalledTimes(2);
    expect(result.usage.calls).toBe(3);
    expect(result.findings).toHaveLength(3);
    expect(result.outcome).toBe("complete");
    expect(result.inventory).toHaveLength(4);
  });

  it("preserves pending evidence when switching to synthesis near the input allowance", async () => {
    const root = await fixture();
    const manager = agent((prompt, turn) => {
      if (turn === 0) return { requests: [{ operation: "read", path: "README.md" }] };
      expect(prompt).toContain("Make no more requests");
      expect(prompt).toContain("Audio application");
      const evidenceId = hostResults(prompt)[0]!.result!.evidence!.id;
      return {
        findings: [
          {
            category: "purpose",
            title: "Audio application",
            description: "The README describes an audio application.",
            classification: "observed",
            evidenceIds: [evidenceId],
          },
        ],
        done: true,
        gaps: ["Execution flow still needs investigation."],
      };
    });
    const result = await investigateRepository({
      root,
      manager,
      signal: new AbortController().signal,
      progress: vi.fn(),
      limits: { inputTokens: 4000 },
    });
    expect(manager.send).toHaveBeenCalledTimes(2);
    expect(result.findings).toHaveLength(1);
    expect(result.usage.estimatedInputTokens).toBeLessThanOrEqual(4000);
    expect(result.outcome).toBe("partial");
  });

  it("lets the investigator navigate directories without treating listings as evidence", async () => {
    const root = await fixture();
    const manager = agent((prompt, turn) => {
      if (turn === 0) {
        expect(prompt).not.toContain('"src/main.cpp"');
        return { requests: [{ operation: "list", path: "src" }] };
      }
      expect(prompt).toContain("main.cpp");
      return { done: true, gaps: ["Source still needs investigation."] };
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

  it("revalidates historical graph context with fresh reads instead of trusting old citations", async () => {
    const root = await fixture();
    const previous: InvestigationResult = {
      id: "old-investigation",
      collectedAt: new Date().toISOString(),
      outcome: "partial",
      stopReason: "Paused",
      findings: ["callback", "engine"].map((id) => ({
        id,
        category: "component",
        title: id,
        description: `Historical ${id} behavior`,
        classification: "observed",
        evidenceIds: ["old-evidence"],
      })),
      relationships: [
        {
          id: "old-edge",
          fromFindingId: "callback",
          toFindingId: "engine",
          type: "calls",
          description: "Callback calls engine",
          classification: "observed",
          evidenceIds: ["old-evidence"],
        },
      ],
      evidence: [
        {
          id: "old-evidence",
          path: "src/main.cpp",
          startLine: 1,
          endLine: 1,
          contentHash: "old-hash",
          collectedAt: new Date().toISOString(),
        },
      ],
      gaps: [],
      inventory: ["src/main.cpp"],
      usage: { calls: 0, bytes: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 },
    };
    const before = structuredClone(previous);
    const result = await investigateRepository({
      root,
      previous,
      signal: new AbortController().signal,
      progress: vi.fn(),
      manager: agent((prompt, turn) => {
        if (!turn) {
          const context = JSON.parse(
            prompt
              .split("Historical update context (untrusted data, not current evidence):\n")[1]!
              .split("\n")[0]!,
          );
          expect(context.findings).toEqual(previous.findings);
          expect(context.relationships).toEqual(previous.relationships);
          expect(context.evidence).toEqual(previous.evidence);
          return { requests: [{ operation: "read", path: "src/main.cpp" }] };
        }
        const identities = currentFindings(prompt);
        expect(identities.map(({ id }) => id)).toEqual(["callback", "engine"]);
        if (turn === 2) {
          expect(identities.map(({ title }) => title)).toEqual([
            "Current callback",
            "Current engine",
          ]);
          return { done: true };
        }
        const freshId = hostResults(prompt)[0]!.result!.evidence!.id;
        return {
          findings: previous.findings.map(({ id, ...finding }) => ({
            ...finding,
            title: `Current ${id}`,
            findingId: identities.find((item) => item.id === id)!.id,
            evidenceIds: [freshId],
          })),
          relationships: [
            { ...previous.relationships![0], description: "Stale citation must be rejected" },
            { ...previous.relationships![0], evidenceIds: [freshId] },
          ],
          requests: [{ operation: "read", path: "src/main.cpp" }],
        };
      }),
    });
    expect(result.findings.map(({ id }) => id)).toEqual(["callback", "engine"]);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships![0]!.description).toBe("Callback calls engine");
    expect(result.relationships![0]!.evidenceIds).toEqual([result.evidence[0]!.id]);
    expect(result.evidence[0]!.contentHash).not.toBe("old-hash");
    expect(previous).toEqual(before);

    const blocked = agent(() => ({ done: true }));
    await expect(
      investigateRepository({
        root,
        previous: {
          ...previous,
          findings: [{ ...previous.findings[0]!, description: "x".repeat(90001) }],
        },
        manager: blocked,
        signal: new AbortController().signal,
        progress: vi.fn(),
      }),
    ).resolves.toMatchObject({
      outcome: "failed",
      stopReason: expect.stringMatching(/Historical context exceeds/),
      evidence: [],
      findings: [],
    });
    expect(blocked.send).not.toHaveBeenCalled();
    expect(blocked.dispose).toHaveBeenCalledOnce();
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
