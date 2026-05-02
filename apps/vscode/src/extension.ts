/**
 * Extension entry point — activate/deactivate, panel registration, command wiring.
 * Reads VSCode config and injects into the active agent adapter; types agent as AgentManager.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-6] [FR-7]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 * @see docs/specs/300-infra-pi/spec.md [FR-1] [FR-6] [FR-7]
 * @see docs/specs/300-infra-pi/design.md [DES-API]
 */
import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";

import * as vscode from "vscode";

import {
  type AgentCommand,
  type AgentEventListener,
  type AgentStatus,
  type Disposable,
  type LogLevel,
  type Logger,
  createLogger,
  onErrorAutoShowSink,
  outputChannelSink,
} from "@afx/shared";

import { type AgentInstance, createConfiguredAgentInstances } from "./agent-factory";
import { createAgentRuntimeMonitor } from "./agent-runtime-monitor";
import { MultiplexedAgentManager } from "./multiplex-agent-manager";
import {
  SIDEBAR_VIEW_TYPE,
  type SidebarPanelProvider,
  createSidebarPanel,
} from "./panels/sidebar-panel";
import { WORKBENCH_VIEW_TYPE, createWorkbenchPanel } from "./panels/workbench-panel";
import { createAfxCodeActionProvider } from "./providers/afx-code-actions";
import { createSeeCompletionProvider } from "./providers/see-completion";
import {
  OPEN_SPEC_AT_LINE_COMMAND,
  createSeeDocumentLinkProvider,
} from "./providers/see-document-links";
import { createSpecCodeLensProvider } from "./providers/spec-codelens";
import { createSpecDefinitionProvider } from "./providers/spec-definition";
import { createSpecHoverProvider } from "./providers/spec-hover";
import { SecretStore } from "./secret-store";
import { createSpecsDataProvider } from "./services/specs-data";
import { createSprintContextSync } from "./services/sprint-context";
import { resolveAfxSessionDir } from "./session-dir";

const TRACE_LANGUAGES: vscode.DocumentSelector = [
  { language: "typescript" },
  { language: "javascript" },
  { language: "typescriptreact" },
  { language: "javascriptreact" },
  { language: "python" },
  { language: "go" },
  { language: "markdown" },
  { language: "html" },
  { language: "css" },
  { language: "yaml" },
  { language: "json" },
  { language: "jsonc" },
];

const VALID_LEVELS = new Set<LogLevel>(["silent", "error", "warn", "info", "debug", "trace"]);
const RUNTIME_CONFIGURATION_KEYS = [
  "afx.agentBinaryPath",
  "afx.agentEphemeralSession",
  "afx.rpc.enabled",
  "afx.sessionDir",
  "afx.sdk.enabled",
  "afx.sdk.ollamaBaseUrl",
] as const;

let agentInstances: AgentInstance[] = [];
let agentManager: MultiplexedAgentManager | null = null;

export interface AfxExtensionTestApi {
  getAgentStatus(): Promise<AgentStatus>;
  getAgentCommands(): Promise<AgentCommand[]>;
  sendAgentMessage(message: string): Promise<void>;
  onAgentEvent(listener: AgentEventListener): Disposable;
  reconfigureAgentRuntimes(reason?: string): Promise<void>;
  stopAgentRuntime(): Promise<void>;
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<AfxExtensionTestApi | undefined> {
  const channel = vscode.window.createOutputChannel("AgenticFlowX");
  const logger = createLogger({
    scope: "agenticflowx",
    level: resolveInitialLevel(),
    sinks: [outputChannelSink(channel), onErrorAutoShowSink(channel)],
  });

  const packageJSON = context.extension.packageJSON as { version?: string };
  const secretStore = new SecretStore(context);
  logger.info(() => `activated v${packageJSON.version ?? "?"}`, {
    mode: vscode.ExtensionMode[context.extensionMode],
  });

  const bundledSkillsPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "skills",
    "agenticflowx",
  ).fsPath;
  const bundledDefaultConfigPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "defaults",
    ".afx.yaml",
  ).fsPath;
  const bundledPiSdkBootstrapPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "pi-sdk",
    "bootstrap.js",
  ).fsPath;
  const additionalSkillPaths = existsSync(bundledSkillsPath) ? [bundledSkillsPath] : undefined;
  const defaultConfigPath = existsSync(bundledDefaultConfigPath)
    ? bundledDefaultConfigPath
    : undefined;
  if (!additionalSkillPaths) {
    logger.warn("bundled skills path missing; Pi will rely on workspace-discovered skills", {
      bundledSkillsPath,
    });
  }

  async function buildAgentInstances(): Promise<AgentInstance[]> {
    const cfg = vscode.workspace.getConfiguration("afx");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const configuredPiBinary = cfg.get<string>("agentBinaryPath", "").trim();
    const rpcEnabled = cfg.get<boolean>("rpc.enabled", false);
    const piBinaryPath = rpcEnabled
      ? resolvePiBinaryPath(configuredPiBinary, workspaceRoot)
      : undefined;
    return createConfiguredAgentInstances({
      logger,
      binaryPath: piBinaryPath,
      piAvailable: rpcEnabled && Boolean(piBinaryPath),
      rpcEnabled,
      ephemeral: cfg.get<boolean>("agentEphemeralSession", false),
      sessionDir: resolveAfxSessionDir(context),
      cwd: workspaceRoot,
      additionalSkillPaths,
      defaultConfigPath,
      secretStore,
      bootstrapPath: bundledPiSdkBootstrapPath,
      sdkEnabled: cfg.get<boolean>("sdk.enabled", true),
      sdkDefaultModel: cfg.get<string>("sdk.defaultModel", "anthropic:claude-opus-4-5"),
      ollamaBaseUrl: cfg.get<string>("sdk.ollamaBaseUrl", "").trim() || undefined,
    });
  }

  agentInstances = await buildAgentInstances();
  agentManager = new MultiplexedAgentManager(agentInstances, {
    rpcEnabledGetter: () =>
      vscode.workspace.getConfiguration("afx").get<boolean>("rpc.enabled", false),
  });
  const runtimeMonitor = createAgentRuntimeMonitor({
    agentManager,
    logger,
  });
  let sidebarProvider: SidebarPanelProvider | null = null;
  const commandOwnedProviderCredentialKeys = new Map<string, NodeJS.Timeout>();

  let runtimeRebuildChain = Promise.resolve();
  function scheduleAgentRuntimeRebuild(reason: string): Promise<void> {
    runtimeRebuildChain = runtimeRebuildChain
      .then(async () => {
        const next = await buildAgentInstances();
        agentInstances = next;
        await agentManager?.replaceInstances(next);
        logger.info("agent runtimes reconfigured", {
          reason,
          instances: next.map((instance) => instance.id).join(","),
        });
        await runtimeMonitor.restart();
        await sidebarProvider?.refreshRuntimeConfiguration();
      })
      .catch((err) => {
        logger.error(
          "agent runtime reconfiguration failed",
          err instanceof Error ? err : undefined,
        );
        vscode.window.showErrorMessage(
          `AgenticFlowX: failed to reconfigure agent runtimes — ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    return runtimeRebuildChain;
  }

  function rememberCommandOwnedProviderCredentialChange(secretKey: string): void {
    const existing = commandOwnedProviderCredentialKeys.get(secretKey);
    if (existing) clearTimeout(existing);
    const cleanup = setTimeout(() => commandOwnedProviderCredentialKeys.delete(secretKey), 5_000);
    cleanup.unref?.();
    commandOwnedProviderCredentialKeys.set(secretKey, cleanup);
  }

  function consumeCommandOwnedProviderCredentialChange(secretKey: string): boolean {
    const cleanup = commandOwnedProviderCredentialKeys.get(secretKey);
    if (!cleanup) return false;
    clearTimeout(cleanup);
    commandOwnedProviderCredentialKeys.delete(secretKey);
    return true;
  }

  context.subscriptions.push(
    channel,
    {
      dispose: () => {
        for (const cleanup of commandOwnedProviderCredentialKeys.values()) {
          clearTimeout(cleanup);
        }
        commandOwnedProviderCredentialKeys.clear();
      },
    },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("afx.logLevel")) {
        const next = resolveInitialLevel();
        logger.info(`logLevel → ${next}`);
        logger.setLevel(next);
      }
      if (RUNTIME_CONFIGURATION_KEYS.some((key) => e.affectsConfiguration(key))) {
        void scheduleAgentRuntimeRebuild("configuration changed");
      }
    }),
    secretStore.onDidChange((e) => {
      if (!e.key.startsWith("afx.apiKey.")) return;
      if (consumeCommandOwnedProviderCredentialChange(e.key)) return;
      void scheduleAgentRuntimeRebuild("provider credential changed");
    }),
  );

  sidebarProvider = createSidebarPanel({
    extensionUri: context.extensionUri,
    extensionMode: context.extensionMode,
    extensionVersion: packageJSON.version ?? "?",
    bundledSkillsPath,
    agentManager,
    runtimeMonitor,
    logger,
    secretStore,
  });
  const specsData = createSpecsDataProvider(
    () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    logger,
  );
  context.subscriptions.push({ dispose: () => specsData.dispose() });

  const workbenchProvider = createWorkbenchPanel({
    extensionUri: context.extensionUri,
    extensionMode: context.extensionMode,
    specsData,
    logger,
  });

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
  statusItem.text = "$(symbol-keyword) AgenticFlowX";
  statusItem.command = "afx.openSidebar";
  statusItem.show();

  context.subscriptions.push(
    runtimeMonitor,
    statusItem,
    vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_TYPE, sidebarProvider),
    vscode.window.registerWebviewViewProvider(WORKBENCH_VIEW_TYPE, workbenchProvider),
    vscode.commands.registerCommand("afx.openSidebar", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.afx");
      await vscode.commands.executeCommand(`${SIDEBAR_VIEW_TYPE}.focus`);
    }),
    vscode.commands.registerCommand("afx.openWorkbench", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.afx-workbench-container");
      await vscode.commands.executeCommand(`${WORKBENCH_VIEW_TYPE}.focus`);
    }),
    vscode.commands.registerCommand("afx.showLogs", () => channel.show(true)),
    vscode.commands.registerCommand("afx.agentSmokeTest", () => agentSmokeTest(channel, logger)),
    vscode.commands.registerCommand("afx.agentRestart", async () => {
      await runtimeMonitor.restart();
      vscode.window.showInformationMessage("AgenticFlowX: agent runtime restarted");
    }),
    vscode.commands.registerCommand(
      "afx.setProviderApiKey",
      async (provider?: string, key?: string) => {
        const providerId =
          provider?.trim() ||
          (await vscode.window.showInputBox({
            prompt: "Provider id",
            placeHolder: "anthropic",
            ignoreFocusOut: true,
          }));
        if (!providerId) return;
        const normalizedProviderId = normalizeProviderId(providerId);
        const apiKey =
          key?.trim() ||
          (await vscode.window.showInputBox({
            prompt: `API key for ${normalizedProviderId}`,
            password: true,
            ignoreFocusOut: true,
          }));
        if (!apiKey) return;
        const secretKey = providerApiKeySecretKey(normalizedProviderId);
        rememberCommandOwnedProviderCredentialChange(secretKey);
        try {
          await secretStore.setApiKey(normalizedProviderId, apiKey);
        } catch (err) {
          consumeCommandOwnedProviderCredentialChange(secretKey);
          throw err;
        }
        await scheduleAgentRuntimeRebuild(`API key saved for ${normalizedProviderId}`);
        vscode.window.showInformationMessage(
          `AgenticFlowX: saved API key for ${normalizedProviderId}`,
        );
      },
    ),
    vscode.commands.registerCommand("afx.clearProviderApiKey", async (provider?: string) => {
      const providerId =
        provider?.trim() ||
        (await vscode.window.showInputBox({
          prompt: "Provider id to clear",
          placeHolder: "anthropic",
          ignoreFocusOut: true,
        }));
      if (!providerId) return;
      const normalizedProviderId = normalizeProviderId(providerId);
      const secretKey = providerApiKeySecretKey(normalizedProviderId);
      rememberCommandOwnedProviderCredentialChange(secretKey);
      try {
        await secretStore.clearApiKey(normalizedProviderId);
      } catch (err) {
        consumeCommandOwnedProviderCredentialChange(secretKey);
        throw err;
      }
      await scheduleAgentRuntimeRebuild(`API key cleared for ${normalizedProviderId}`);
      vscode.window.showInformationMessage(
        `AgenticFlowX: cleared API key for ${normalizedProviderId}`,
      );
    }),
    vscode.commands.registerCommand("afx.detectPiBinary", async () => {
      const detected = detectExecutableOnPath("pi");
      if (!detected) {
        vscode.window.showWarningMessage("AgenticFlowX: Pi CLI was not found on PATH");
        return;
      }
      await vscode.workspace
        .getConfiguration("afx")
        .update("agentBinaryPath", detected, vscode.ConfigurationTarget.Global);
      await vscode.workspace
        .getConfiguration("afx")
        .update("rpc.enabled", true, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`AgenticFlowX: Pi CLI detected at ${detected}`);
    }),
    vscode.commands.registerCommand(
      OPEN_SPEC_AT_LINE_COMMAND,
      async (arg: { path: string; line: number } | undefined) => {
        if (!arg?.path) return;
        const uri = vscode.Uri.file(arg.path);
        const line = Math.max(0, arg.line ?? 0);
        await vscode.window.showTextDocument(uri, {
          selection: new vscode.Range(line, 0, line, 0),
          preview: false,
        });
      },
    ),
  );

  const getRoot = (): string | undefined => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(TRACE_LANGUAGES, createSpecCodeLensProvider(getRoot)),
    vscode.languages.registerHoverProvider(TRACE_LANGUAGES, createSpecHoverProvider(getRoot)),
    vscode.languages.registerDefinitionProvider(
      TRACE_LANGUAGES,
      createSpecDefinitionProvider(getRoot),
    ),
    vscode.languages.registerDocumentLinkProvider(
      TRACE_LANGUAGES,
      createSeeDocumentLinkProvider(getRoot),
    ),
    vscode.languages.registerCompletionItemProvider(
      TRACE_LANGUAGES,
      createSeeCompletionProvider(getRoot),
      "/",
      "#",
      "[",
    ),
  );

  if (agentManager) {
    const { disposables } = createAfxCodeActionProvider(logger, agentManager, {
      sendPrompt: async (prompt) => {
        await vscode.commands.executeCommand("afx.openSidebar");
        await sidebarProvider.sendExternalPrompt(prompt);
      },
      appendDraft: async (content) => {
        await vscode.commands.executeCommand("afx.openSidebar");
        await sidebarProvider.appendToDraft(content);
      },
    });
    for (const d of disposables) context.subscriptions.push(d);
  }

  const sprintContext = createSprintContextSync(logger);
  for (const d of sprintContext.disposables) context.subscriptions.push(d);

  void vscode.commands.executeCommand("setContext", "afx.loaded", true);

  if (context.extensionMode !== vscode.ExtensionMode.Test) return undefined;

  return {
    getAgentStatus: () => requireAgentManager().getStatus(),
    getAgentCommands: () => requireAgentManager().getCommands(),
    sendAgentMessage: (message) => requireAgentManager().send(message),
    onAgentEvent: (listener) => requireAgentManager().onEvent(listener),
    reconfigureAgentRuntimes: (reason = "test api") => scheduleAgentRuntimeRebuild(reason),
    stopAgentRuntime: () => requireAgentManager().stop(),
  };
}

export async function deactivate(): Promise<void> {
  await agentManager?.dispose();
  agentInstances = [];
  agentManager = null;
}

async function agentSmokeTest(channel: vscode.OutputChannel, logger: Logger): Promise<void> {
  const smoke = logger.child("smoke-test");
  const manager = agentManager;
  if (!manager) {
    vscode.window.showErrorMessage("AgenticFlowX: agent manager not initialized");
    return;
  }
  channel.show(true);
  smoke.info("requesting agent status via AgentManager.getStatus()");
  try {
    const status = await manager.getStatus();
    smoke.info(() => `getStatus: ${JSON.stringify(status)}`);
    if (!status.running) {
      const message =
        "Agent process is not running. Check the configured binary path and AgenticFlowX output log.";
      smoke.error(message);
      vscode.window.showErrorMessage(`AgenticFlowX: agent smoke-test failed — ${message}`);
      return;
    }
    vscode.window.showInformationMessage(
      "AgenticFlowX: agent smoke-test OK (see AgenticFlowX output)",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    smoke.error(message, err instanceof Error ? err : undefined);
    vscode.window.showErrorMessage(`AgenticFlowX: agent smoke-test failed — ${message}`);
  }
}

function resolveInitialLevel(): LogLevel {
  const fromEnv = process.env["AFX_LOG_LEVEL"]?.toLowerCase();
  if (fromEnv && (VALID_LEVELS as Set<string>).has(fromEnv)) return fromEnv as LogLevel;

  const fromSetting = vscode.workspace
    .getConfiguration("afx")
    .get<string>("logLevel")
    ?.toLowerCase();
  if (fromSetting && (VALID_LEVELS as Set<string>).has(fromSetting)) return fromSetting as LogLevel;

  return "info";
}

function detectExecutableOnPath(command: string): string | undefined {
  const pathValue = process.env["PATH"];
  if (!pathValue) return undefined;
  const extensions =
    process.platform === "win32"
      ? (process.env["PATHEXT"] ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .map((extension) => extension.toLowerCase())
      : [""];
  for (const folder of pathValue.split(delimiter)) {
    if (!folder) continue;
    for (const candidate of executableCandidates(folder, command, extensions)) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function resolvePiBinaryPath(configured: string, workspaceRoot?: string): string | undefined {
  if (!configured) return detectExecutableOnPath("pi");
  if (!hasPathSeparator(configured) && !isAbsolute(configured)) {
    return detectExecutableOnPath(configured);
  }
  const candidate = isAbsolute(configured)
    ? configured
    : join(workspaceRoot ?? process.cwd(), configured);
  return existsSync(candidate) ? candidate : undefined;
}

function hasPathSeparator(value: string): boolean {
  return value.includes("/") || value.includes("\\");
}

function executableCandidates(
  folder: string,
  command: string,
  extensions: readonly string[],
): string[] {
  const existingExtension = extname(command);
  if (existingExtension) return [join(folder, command)];
  return extensions.map((extension) => join(folder, `${command}${extension}`));
}

function providerApiKeySecretKey(provider: string): string {
  return `afx.apiKey.${provider}`;
}

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase();
}

function requireAgentManager(): MultiplexedAgentManager {
  if (!agentManager) throw new Error("AgenticFlowX: agent manager not initialized");
  return agentManager;
}
