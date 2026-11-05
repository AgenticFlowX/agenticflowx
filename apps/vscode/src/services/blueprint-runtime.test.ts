/**
 * Opt-in real Pi 1.5.0 subprocess/HTTP protocol integration; deterministic local model responses.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-16] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST] [DES-API]
 */
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

import { createLogger } from "@afx/shared";

import { createConfiguredAgentInstances } from "../agent-factory";
import type { SecretStore } from "../secret-store";
import { createBlueprint } from "./blueprint-artifacts";
import { investigateRepository } from "./blueprint-investigation";
import { loadBlueprintModel, saveBlueprintModel } from "./blueprint-model-store";

it.skipIf(process.env["AFX_PI_INTEGRATION"] !== "1").each(["sdk", "rpc"] as const)(
  "investigates through Pi 1.5.0 (%s), validates citations and reopens its model",
  async (adapter) => {
    const temporary = await mkdtemp(path.join(tmpdir(), "afx-real-pi-"));
    const root = path.join(temporary, "code");
    await mkdir(root);
    const runtime = path.resolve(__dirname, "../../resources/pi-sdk/bootstrap.js");
    const metadata = JSON.parse(
      await readFile(
        path.resolve(
          __dirname,
          "../../../../packages/agent/pi-sdk/node_modules/@earendil-works/pi-coding-agent/package.json",
        ),
        "utf8",
      ),
    );
    expect(metadata.version).toBe("0.84.4");
    await writeFile(
      path.join(root, "main.ts"),
      "export function main() { return processAudio(); }\n",
    );
    await writeFile(path.join(root, "engine.ts"), "export function processAudio() { return 1; }\n");
    await writeFile(path.join(root, "README.md"), "Audio engine fixture\n");
    let requests = 0;
    const server = createServer((request, response) => {
      void (async () => {
        try {
          let body = "";
          for await (const chunk of request) body += chunk;
          const payload = JSON.parse(body);
          expect(payload.tools ?? []).toEqual([]);
          requests++;
          const last = payload.messages.at(-1).content;
          const text =
            typeof last === "string"
              ? last
              : last.map((block: { text?: string }) => block.text ?? "").join("");
          const host = text.includes("Host evidence results:")
            ? (JSON.parse(text.split("\n")[1]) as Array<{ result: { evidence: { id: string } } }>)
            : undefined;
          const answer = host
            ? {
                findings: ["purpose", "component", "flow"].map((category) => ({
                  category,
                  title: category,
                  description: "main calls processAudio in the engine.",
                  classification: "observed",
                  evidenceIds: host.map((item) => item.result.evidence.id),
                })),
                done: true,
                gaps: [],
              }
            : {
                requests: ["main.ts", "engine.ts", "README.md"].map((file) => ({
                  operation: "read",
                  path: file,
                })),
              };
          response.writeHead(200, { "Content-Type": "text/event-stream" });
          const chunk = (delta: unknown, finish_reason: string | null = null) =>
            response.write(
              `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta, finish_reason }] })}\n\n`,
            );
          chunk({ role: "assistant", content: JSON.stringify(answer) });
          chunk({}, "stop");
          response.end("data: [DONE]\n\n");
        } catch {
          response.writeHead(500);
          response.end("fixture protocol failure");
        }
      })();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address() as { port: number };
      const binary = path.join(temporary, "pi-0844.mjs");
      await writeFile(
        binary,
        `#!${process.execPath}\nimport { spawn } from "node:child_process";\nconst child = spawn(process.execPath, [${JSON.stringify(runtime)}, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });\nchild.on("exit", code => process.exit(code ?? 1));\nprocess.on("SIGTERM", () => child.kill("SIGTERM"));\n`,
      );
      await chmod(binary, 0o700);
      const providerEnv = {
        AFX_CUSTOM_PROVIDERS_JSON: JSON.stringify({
          providers: {
            fixture: {
              baseUrl: `http://127.0.0.1:${address.port}/v1`,
              api: "openai-completions",
              apiKey: "local-fixture",
              models: [
                {
                  id: "fixture",
                  name: "fixture",
                  reasoning: false,
                  input: ["text"],
                  contextWindow: 32000,
                  maxTokens: 4096,
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                },
              ],
            },
          },
        }),
      };
      const instances = await createConfiguredAgentInstances({
        logger: createLogger({ level: "silent", sinks: [] }),
        bootstrapPath: runtime,
        cwd: root,
        sessionDir: path.join(temporary, "agent-state"),
        inspectionMode: true,
        ephemeral: true,
        secretStore: {
          getApiKey: async () => undefined,
          getOAuth: async () => undefined,
          getAuthMethod: async () => undefined,
          listOAuthProviders: async () => [],
          getProviderEnvVar: async () => undefined,
        } as unknown as SecretStore,
        piSdkCustomProviderIds: ["fixture"],
        piSdkCustomInitial: { provider: "fixture", modelId: "fixture" },
        piSdkExtraEnv: providerEnv,
        ...(adapter === "rpc"
          ? {
              rpcEnabled: true,
              piAvailable: true,
              sdkEnabled: false,
              binaryPath: binary,
              runtimeEnv: {
                ...providerEnv,
                AFX_PROVIDER: "fixture",
                AFX_MODEL_ID: "fixture",
                PI_CODING_AGENT_DIR: path.join(temporary, "agent-state"),
              },
            }
          : {}),
      });
      expect(instances).toHaveLength(1);
      const result = await investigateRepository({
        root,
        manager: instances[0]!.manager,
        signal: new AbortController().signal,
        progress: () => {},
        limits: { milliseconds: 20_000 },
      });
      expect(result.stopReason).toBe("Investigation scope completed.");
      expect(result.outcome).toBe("complete");
      expect(requests).toBe(2);
      expect((await readdir(root)).sort()).toEqual(["README.md", "engine.ts", "main.ts"]);
      const artifactRoot = path.join(temporary, "artifacts");
      const manifest = await createBlueprint({
        schemaVersion: 2,
        artifactRoot,
        name: "Fixture",
        repository: { name: "fixture", kind: "folder" },
        researchMarkdown: "Fixture inspection",
      });
      const model = await saveBlueprintModel(
        artifactRoot,
        manifest,
        manifest.repositories[0]!.id,
        result,
      );
      expect(
        await loadBlueprintModel(artifactRoot, manifest, manifest.repositories[0]!.id),
      ).toEqual(model);
      expect(await readFile(path.join(root, "main.ts"), "utf8")).toBe(
        "export function main() { return processAudio(); }\n",
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(temporary, { recursive: true, force: true });
    }
  },
  30_000,
);
