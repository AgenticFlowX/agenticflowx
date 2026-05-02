/**
 * Bundled AFX skills end-to-end contract.
 * Launches the VS Code extension with real Pi RPC, verifies bundled skills are
 * discoverable through Pi `get_commands`, and sends one AFX skill command
 * through the adapter rewrite into a deterministic local provider.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-1] [FR-2] [FR-3] [FR-8]
 * @see docs/specs/420-dx-testing/spec.md [FR-3]
 * @see docs/specs/420-dx-testing/design.md [DES-ARCH] [DES-TEST]
 */
import * as assert from "node:assert";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";

import * as vscode from "vscode";

interface AgentCommand {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
}

interface AgentStatus {
  running: boolean;
  isStreaming: boolean;
  model?: {
    provider?: string;
    id?: string;
  };
  info?: string;
}

interface AgentEvent {
  type: string;
  delta?: string;
  message?: string;
}

interface Disposable {
  dispose(): void;
}

interface AfxExtensionTestApi {
  getAgentStatus(): Promise<AgentStatus>;
  getAgentCommands(): Promise<AgentCommand[]>;
  sendAgentMessage(message: string): Promise<void>;
  onAgentEvent(listener: (event: AgentEvent) => void): Disposable;
  reconfigureAgentRuntimes(reason?: string): Promise<void>;
  stopAgentRuntime(): Promise<void>;
}

interface ProviderRequest {
  path: string;
  body: Record<string, unknown>;
}

interface FakeProvider {
  readonly baseUrl: string;
  readonly requests: ProviderRequest[];
  nextRequest(timeoutMs?: number): Promise<ProviderRequest>;
  close(): Promise<void>;
}

const REAL_PI_BINARY_CANDIDATES = [
  process.env["AFX_E2E_PI_BINARY"],
  findExecutableOnPath("pi"),
].filter((value): value is string => Boolean(value));

suite("AFX bundled skills — real Pi RPC", function (this: Mocha.Suite) {
  this.timeout(60_000);

  let provider: FakeProvider | null = null;
  let agentDir: string | null = null;
  let api: AfxExtensionTestApi | null = null;
  let previousPiAgentDir: string | undefined;
  let previousPiOffline: string | undefined;
  let previousPiSkipVersionCheck: string | undefined;
  let previousSettings: {
    rpcEnabled: boolean | undefined;
    binaryPath: string | undefined;
    ephemeral: boolean | undefined;
    sdkEnabled: boolean | undefined;
  } | null = null;

  suiteSetup(async function (this: Mocha.Context) {
    const binaryPath = resolvePiBinaryPath();
    if (!binaryPath) {
      this.skip();
      return;
    }

    provider = await startFakeOpenAICompatibleProvider();
    agentDir = createPiAgentDir(provider.baseUrl);
    previousPiAgentDir = process.env["PI_CODING_AGENT_DIR"];
    previousPiOffline = process.env["PI_OFFLINE"];
    previousPiSkipVersionCheck = process.env["PI_SKIP_VERSION_CHECK"];
    process.env["PI_CODING_AGENT_DIR"] = agentDir;
    process.env["PI_OFFLINE"] = "1";
    process.env["PI_SKIP_VERSION_CHECK"] = "1";

    const config = vscode.workspace.getConfiguration("afx");
    previousSettings = {
      rpcEnabled: config.get<boolean>("rpc.enabled"),
      binaryPath: config.get<string>("agentBinaryPath"),
      ephemeral: config.get<boolean>("agentEphemeralSession"),
      sdkEnabled: config.get<boolean>("sdk.enabled"),
    };
    await config.update("rpc.enabled", true, vscode.ConfigurationTarget.Global);
    await config.update("agentBinaryPath", binaryPath, vscode.ConfigurationTarget.Global);
    await config.update("agentEphemeralSession", true, vscode.ConfigurationTarget.Global);
    await config.update("sdk.enabled", false, vscode.ConfigurationTarget.Global);

    const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(extension, "Extension agenticflowx.agenticflowx not found");
    api = (await extension.activate()) as AfxExtensionTestApi;
    assert.ok(api, "Extension test API was not returned in ExtensionMode.Test");
    await api.reconfigureAgentRuntimes("skills e2e setup");
  });

  suiteTeardown(async () => {
    await api?.stopAgentRuntime().catch(() => undefined);
    if (previousSettings) {
      const config = vscode.workspace.getConfiguration("afx");
      await config.update(
        "rpc.enabled",
        previousSettings.rpcEnabled,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "agentBinaryPath",
        previousSettings.binaryPath,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "agentEphemeralSession",
        previousSettings.ephemeral,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "sdk.enabled",
        previousSettings.sdkEnabled,
        vscode.ConfigurationTarget.Global,
      );
    }

    restoreEnv("PI_CODING_AGENT_DIR", previousPiAgentDir);
    restoreEnv("PI_OFFLINE", previousPiOffline);
    restoreEnv("PI_SKIP_VERSION_CHECK", previousPiSkipVersionCheck);

    await provider?.close();
    if (agentDir) rmSync(agentDir, { recursive: true, force: true });
  });

  test("loads every bundled AFX skill through Pi get_commands", async () => {
    const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(extension, "Extension agenticflowx.agenticflowx not found");
    const skillsRoot = join(extension.extensionPath, "resources", "skills", "agenticflowx");
    const expectedSkillNames = bundledSkillCommandNames(skillsRoot);
    assert.ok(expectedSkillNames.length > 0, "No bundled AFX skills found in extension resources");

    const status = await waitFor(
      () => requiredApi().getAgentStatus(),
      (value) => value.running && value.model?.provider === "afx-e2e",
      20_000,
      "Pi RPC runtime to start with the fake provider model",
    );
    assert.strictEqual(status.model?.id, "afx-e2e-model");

    const commands = await requiredApi().getAgentCommands();
    const actualSkillNames = commands
      .filter((command) => command.source === "skill")
      .map((command) => command.name)
      .sort();

    assert.deepStrictEqual(actualSkillNames, expectedSkillNames);
  });

  test("rewrites and executes /afx-hello through real Pi skill expansion", async () => {
    const textPromise = waitForAgentText(requiredApi(), /AFX skill e2e OK/, 20_000);

    await requiredApi().sendAgentMessage("/afx-hello");
    const request = await requiredProvider().nextRequest(20_000);
    const serializedRequest = JSON.stringify(request.body);

    assert.strictEqual(request.path, "/v1/chat/completions");
    assert.match(serializedRequest, /<skill name=\\"afx-hello\\"/);
    assert.match(serializedRequest, /Verify AFX installation and environment/);
    assert.match(await textPromise, /AFX skill e2e OK/);
  });

  function requiredApi(): AfxExtensionTestApi {
    assert.ok(api, "Extension test API was not initialized");
    return api;
  }

  function requiredProvider(): FakeProvider {
    assert.ok(provider, "Fake provider was not initialized");
    return provider;
  }
});

function resolvePiBinaryPath(): string | undefined {
  for (const candidate of REAL_PI_BINARY_CANDIDATES) {
    if (candidate === "pi") return candidate;
    if (!existsSync(candidate)) continue;
    return candidate;
  }
  return undefined;
}

function createPiAgentDir(baseUrl: string): string {
  const dir = mkdtemp("afx-pi-skills-e2e-");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "models.json"),
    JSON.stringify(
      {
        providers: {
          "afx-e2e": {
            baseUrl,
            apiKey: "afx-e2e-key",
            api: "openai-completions",
            models: [
              {
                id: "afx-e2e-model",
                name: "AFX E2E Model",
                contextWindow: 200_000,
                maxTokens: 1024,
              },
            ],
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "settings.json"),
    JSON.stringify(
      {
        defaultProvider: "afx-e2e",
        defaultModel: "afx-e2e-model",
        enabledModels: ["afx-e2e/afx-e2e-model"],
        quietStartup: true,
        compaction: { enabled: false },
        retry: {
          enabled: false,
          provider: {
            timeoutMs: 5_000,
            maxRetries: 0,
          },
        },
      },
      null,
      2,
    ),
  );
  return dir;
}

function bundledSkillCommandNames(skillsRoot: string): string[] {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, "SKILL.md")))
    .map((entry) => `skill:${entry.name}`)
    .sort();
}

async function startFakeOpenAICompatibleProvider(): Promise<FakeProvider> {
  const requests: ProviderRequest[] = [];
  const waiters: Array<(request: ProviderRequest) => void> = [];

  const server = createServer((req, res) => {
    void handleFakeProviderRequest(req, res, requests, waiters).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    nextRequest(timeoutMs = 10_000) {
      const existing = requests.shift();
      if (existing) return Promise.resolve(existing);
      return new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(() => {
          rejectPromise(new Error("Timed out waiting for fake provider request"));
        }, timeoutMs);
        waiters.push((request) => {
          clearTimeout(timer);
          resolvePromise(request);
        });
      });
    },
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((err) => (err ? rejectPromise(err) : resolvePromise()));
      }),
  };
}

async function handleFakeProviderRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requests: ProviderRequest[],
  waiters: Array<(request: ProviderRequest) => void>,
): Promise<void> {
  if (req.url !== "/v1/chat/completions") {
    res.writeHead(404).end();
    return;
  }

  const body = await readJson(req, res);
  if (body === undefined) return;

  const request = { path: req.url, body };
  const waiter = waiters.shift();
  if (waiter) waiter(request);
  else requests.push(request);

  writeStreamingChatCompletion(res);
}

async function readJson(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | undefined> {
  let text = "";
  for await (const chunk of req) {
    text += String(chunk);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Request body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    return undefined;
  }
}

function writeStreamingChatCompletion(res: ServerResponse): void {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const base = {
    id,
    object: "chat.completion.chunk",
    created,
    model: "afx-e2e-model",
  };

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
    })}\n\n`,
  );
  res.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [{ index: 0, delta: { content: "AFX skill e2e OK" }, finish_reason: null }],
    })}\n\n`,
  );
  res.write(
    `data: ${JSON.stringify({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 4,
        total_tokens: 14,
      },
    })}\n\n`,
  );
  res.write("data: [DONE]\n\n");
  res.end();
}

function waitForAgentText(
  extensionApi: AfxExtensionTestApi,
  matcher: RegExp,
  timeoutMs: number,
): Promise<string> {
  let text = "";
  let disposable: Disposable | undefined;
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      disposable?.dispose();
      rejectPromise(new Error(`Timed out waiting for agent text matching ${matcher}`));
    }, timeoutMs);

    disposable = extensionApi.onAgentEvent((event) => {
      if (event.type === "error") {
        clearTimeout(timer);
        disposable?.dispose();
        rejectPromise(new Error(event.message ?? "Agent emitted an error event"));
        return;
      }
      if (event.type !== "text_delta" || typeof event.delta !== "string") return;
      text += event.delta;
      if (!matcher.test(text)) return;
      clearTimeout(timer);
      disposable?.dispose();
      resolvePromise(text);
    });
  });
}

async function waitFor<T>(
  read: () => Promise<T>,
  matches: (value: T) => boolean,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const started = Date.now();
  let lastValue: T | undefined;
  while (Date.now() - started < timeoutMs) {
    lastValue = await read();
    if (matches(lastValue)) return lastValue;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${JSON.stringify(lastValue)}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function mkdtemp(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function findExecutableOnPath(command: string): string | undefined {
  const pathValue = process.env["PATH"];
  if (!pathValue) return undefined;
  const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const folder of pathValue.split(delimiter)) {
    if (!folder) continue;
    for (const extension of extensions) {
      const candidate = resolve(folder, `${command}${extension}`);
      if (existsSync(candidate) && basename(candidate).toLowerCase().startsWith(command)) {
        return candidate;
      }
    }
  }
  return undefined;
}
