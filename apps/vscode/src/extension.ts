/**
 * Extension entry point — activate/deactivate, panel registration, command wiring.
 * Reads VSCode config and injects into the active agent adapter; types agent as AgentManager.
 * Per-command @see anchors live inline at each registerCommand call.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-6] [FR-7] [FR-11] [FR-12] [FR-14]
 * @see docs/specs/200-app-vscode/design.md [DES-COMMAND-CATALOG] [DES-COMMAND-SET-MODE] [DES-SETTINGS-CATALOG] [DES-KEYBINDING-CATALOG] [DES-SIDEBAR-FIRST-RESPONSE-WATCHDOG]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-LIFECYCLE]
 * @see docs/specs/350-agent-manager/spec.md [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-LIFECYCLE]
 * @see docs/specs/351-agent-pi/spec.md [FR-2]
 * @see docs/specs/351-agent-pi/design.md [DES-API]
 * @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-9] [FR-10] [FR-11]
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import * as vscode from "vscode";

import { parseJSONCanvas } from "@afx/canvas-engine";
import {
  type AgentAuthMethod,
  type AgentCommand,
  type AgentEventListener,
  type AgentStatus,
  type Disposable,
  type IntentSlot,
  type LogLevel,
  type Logger,
  PROVIDER_DETAILS,
  type WorkbenchSourceIdentity,
  type WorkspaceMode,
  createLogger,
  formatIntentTokenEstimate,
  getIntentPrompt,
  normalizeIntentSlot,
  outputChannelSink,
  sddPrimaryActionForPath,
} from "@afx/shared";

import {
  type AgentInstance,
  createConfiguredAgentInstances,
  createCustomProvidersAdapter,
} from "./agent-factory";
import { createAgentRuntimeMonitor } from "./agent-runtime-monitor";
import {
  configurationTargetFor,
  updateAfxConfigurationWithWorkspaceFallback,
} from "./configuration-target";
import {
  AFX_CANVAS_EDITOR_VIEW_TYPE,
  createCanvasEditorProvider,
  openCanvasEditor,
} from "./editors/canvas-editor-provider";
import {
  MODEL_DEFAULT_SELECTION_SETTING,
  type ModelSelectionIdentityV2,
  formatSdkDefaultModel,
  parseLegacySdkDefaultModel,
  parseModelSelectionIdentity,
} from "./model-default-selection";
import { type ModelAuthClassifier, MultiplexedAgentManager } from "./multiplex-agent-manager";
import { type AfxPreviewDeps, openAfxPreview } from "./panels/afx-preview-panel";
import {
  SIDEBAR_VIEW_TYPE,
  type SidebarPanelProvider,
  createSidebarPanel,
} from "./panels/sidebar-panel";
import { WORKBENCH_VIEW_TYPE, createWorkbenchPanel } from "./panels/workbench-panel";
import { createAfxCodeActionProvider } from "./providers/afx-code-actions";
import {
  BLUEPRINT_PREVIEW_SCHEME,
  createBlueprintPreviewProvider,
} from "./providers/blueprint-preview";
import { createSeeCompletionProvider } from "./providers/see-completion";
import {
  OPEN_SPEC_AT_LINE_COMMAND,
  createSeeDocumentLinkProvider,
} from "./providers/see-document-links";
import { createSpecCodeLensProvider } from "./providers/spec-codelens";
import { createSpecDefinitionProvider } from "./providers/spec-definition";
import { createSpecHoverProvider } from "./providers/spec-hover";
import { SecretStore } from "./secret-store";
import {
  type BlueprintBinding,
  type BlueprintManifest,
  createBlueprint,
  openBlueprint,
} from "./services/blueprint-artifacts";
import {
  type BlueprintExecutionContext,
  createBlueprintSprint,
  listBlueprintSprints,
} from "./services/blueprint-execution-context";
import {
  type InvestigationResult,
  investigateRepository,
  renderInvestigation,
} from "./services/blueprint-investigation";
import { migrateBlueprint, recoverBlueprintMigration } from "./services/blueprint-migration";
import {
  loadBlueprintModel,
  reconcileBlueprintModel,
  saveBlueprintChanges,
  saveBlueprintModel,
} from "./services/blueprint-model-store";
import { loadFindingReviews, saveFindingReview } from "./services/blueprint-review";
import { chooseBlueprintSaveLocation } from "./services/blueprint-save-dialog";
import { createBlueprintObservationStorage } from "./services/blueprint-storage";
import {
  type BlueprintTraceStore,
  addTraceLink,
  loadTraceStore,
  relinkTraceSource,
  repositionBlueprintReferences,
  resolveBlueprintReferences,
} from "./services/blueprint-traces";
import {
  type CanvasActionExecutionContext,
  createCanvasActionService,
} from "./services/canvas-action-service";
import { createCanvasEditSessionManager } from "./services/canvas-edit-session-manager";
import { createCanvasLibraryService } from "./services/canvas-library-service";
import { createCustomProvidersService } from "./services/custom-providers-service";
import { createOAuthService } from "./services/oauth/oauth-service";
import {
  type ProjectContext,
  createDocumentRootResolver,
  discoverProjects,
  resolveProject,
} from "./services/project-context";
import {
  type RepositoryObservation,
  inspectDocumentSymbols,
} from "./services/repository-blueprint";
import { createSpecsDataProvider } from "./services/specs-data";
import { createSprintContextSync } from "./services/sprint-context";
import { type WorkbenchFileState, createWorkbenchFileState } from "./services/workbench-file-state";
import { createWorkbenchMutationCoordinator } from "./services/workbench-mutation-coordinator";
import { resolveAfxSessionDir } from "./session-dir";
import {
  appendNoteToWorkspace,
  createNotesWorkspaceWriter,
  installNotesWorkspaceWriter,
} from "./utils/notes-utils";

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
const AFX_ACTIVE_SDD_DOCUMENT_CONTEXT = "afx.activeSddDocument";
const RUNTIME_CONFIGURATION_KEYS = [
  "afx.agentBinaryPath",
  "afx.agentEphemeralSession",
  "afx.rpc.enabled",
  "afx.sessionDir",
  "afx.skills.extraPaths",
  "afx.pi.projectTrust",
  "afx.pi.excludedTools",
  "afx.network.httpProxy",
  "afx.sdk.enabled",
  "afx.sdk.ollamaBaseUrl",
] as const;
const SETTINGS_SNAPSHOT_CONFIGURATION_KEYS = [
  "afx.runtime.responseStartTimeoutMs",
  "afx.model.defaultSelection",
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
  /**
   * Custom-providers test surface — used by the e2e suite to verify that
   * AFX-managed records make it into the Pi SDK spawn env without ever
   * touching `~/.pi/agent/models.json`.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-10]
   * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
   */
  getCustomProvidersSnapshot(): Promise<unknown>;
  buildCustomProvidersSpawnEnv(): Promise<Record<string, string>>;
  upsertCustomProvider(input: {
    id: string;
    displayName?: string;
    baseUrl: string;
    api: "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai";
    apiKeyRef: { source: "vscode-secret" | "env-var" | "shell-cmd" | "none"; label?: string };
    apiKeyValue?: string;
    models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }>;
  }): Promise<{ ok: boolean; error?: string }>;
  removeCustomProvider(providerId: string): Promise<{ ok: boolean; error?: string }>;
  getBlueprintState(): {
    attached: boolean;
    executionContextActive: boolean;
    schemaVersion?: number;
    documentRootIds: string[];
  };
}

function sddPrimaryActionForActiveEditor(editor: vscode.TextEditor | undefined | null) {
  if (!editor?.document.uri) return null;
  if (editor.document.languageId && editor.document.languageId !== "markdown") return null;
  const relativePath = vscode.workspace
    .asRelativePath(editor.document.uri, false)
    .replace(/\\/g, "/");
  return sddPrimaryActionForPath(relativePath);
}

function canvasActionContext(execution: CanvasActionExecutionContext): string {
  const content = execution.nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if (node.type === "file") return `File: ${node.file}`;
      if (node.type === "link") return `Link: ${node.url}`;
      return `Group: ${node.label || "Untitled"}`;
    })
    .join("\n\n---\n\n")
    .trim();
  return content.slice(0, 24_000);
}

function resolveCanvasNodeUri(
  fileState: WorkbenchFileState,
  execution: CanvasActionExecutionContext,
  rawPath: string,
): vscode.Uri | undefined {
  const normalized = rawPath.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../")) {
    return undefined;
  }
  const parts = normalized.split("/").filter(Boolean);
  const namedRoot = vscode.workspace.workspaceFolders?.find(
    (folder) => folder.name === parts[0] && parts.length > 1,
  );
  if (namedRoot) {
    return fileState.resolve({
      rootUri:
        fileState.identify(vscode.Uri.joinPath(namedRoot.uri, parts.slice(1).join("/")))?.rootUri ??
        "",
      rootName: namedRoot.name,
      relativePath: parts.slice(1).join("/"),
    });
  }
  return fileState.resolve({ ...execution.target, relativePath: normalized });
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<AfxExtensionTestApi | undefined> {
  const channel = vscode.window.createOutputChannel("AgenticFlowX");
  const logger = createLogger({
    scope: "agenticflowx",
    level: resolveInitialLevel(),
    sinks: [outputChannelSink(channel)],
  });

  const packageJSON = context.extension.packageJSON as {
    version?: string;
    afxSkillsPin?: string;
  };
  let discoveredProjects: ProjectContext[] = [];
  let projectDiscoveryGeneration = 0;
  let activeBlueprint:
    | {
        artifactRoot: string;
        manifest: BlueprintManifest;
        binding: BlueprintBinding;
        traces: BlueprintTraceStore;
      }
    | undefined;
  let activeExecutionContext: BlueprintExecutionContext | undefined;
  let activeBlueprintWatcher: vscode.FileSystemWatcher | undefined;
  context.subscriptions.push({
    dispose: () => {
      activeBlueprintWatcher?.dispose();
    },
  });
  let openedBlueprint: { artifactRoot: string; manifest: BlueprintManifest } | undefined;
  const previewProvider = createBlueprintPreviewProvider();
  const observationStorage = createBlueprintObservationStorage(context.storageUri?.fsPath);
  const observations = new Map<string, RepositoryObservation>();
  const investigations = new Map<string, InvestigationResult>();
  const investigationParents = new Map<string, string | null>();
  const blueprintLensChanges = new vscode.EventEmitter<void>();
  context.subscriptions.push(blueprintLensChanges);
  const bindingState = context.globalState as
    (vscode.Memento & { setKeysForSync?(keys: readonly string[]): void }) | undefined;
  const BINDING_KEY = "afx.blueprint.bindings.v1";

  const refreshProjects = async (): Promise<void> => {
    const generation = ++projectDiscoveryGeneration;
    const result = await discoverProjects(vscode.workspace.workspaceFolders ?? []);
    if (generation !== projectDiscoveryGeneration) return;
    discoveredProjects = result.projects;
    await observationStorage.cleanup(discoveredProjects.map((project) => project.id));
  };
  await refreshProjects();

  const saveLocalBinding = async (binding: BlueprintBinding): Promise<void> => {
    if (!bindingState) return;
    const current = bindingState.get<Record<string, BlueprintBinding>>(BINDING_KEY, {});
    await bindingState.update(BINDING_KEY, { ...current, [binding.blueprintId]: binding });
  };
  const secretStore = new SecretStore(context);
  // One AFX-owned OAuth orchestrator, shared by the Pi-SDK credential seam
  // (agent-factory) and the Settings OAuth bridge handlers (sidebar-panel) so
  // in-flight sign-in/refresh state is stable across agent rebuilds (FR-6, NFR-4).
  // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
  // @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
  const oauthService = createOAuthService({
    secretStore,
    logger: logger.child("oauth"),
    globalStorageUri: context.globalStorageUri,
  });
  const modelAuthClassifier: ModelAuthClassifier = async ({ instance, provider }) => {
    if (instance.runtime !== "pi-sdk") return { methods: [] };
    if (provider === "ollama") return { methods: ["local"], activeMethod: "local" };

    const methods: AgentAuthMethod[] = [];
    if (await secretStore.getOAuth(provider)) methods.push("subscription");
    if (await secretStore.getApiKey(provider)) methods.push("api-key");

    const availableMethods =
      methods.length > 0 ? methods : (["api-key"] satisfies AgentAuthMethod[]);
    const active = await secretStore.getAuthMethod(provider);
    const activeMethod = active && availableMethods.includes(active) ? active : undefined;
    return {
      methods: availableMethods,
      activeMethod:
        activeMethod ?? (availableMethods.length === 1 ? availableMethods[0] : undefined),
    };
  };
  // @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [FR-10]
  // @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
  const customProvidersAdapter = createCustomProvidersAdapter();
  const customProvidersService = createCustomProvidersService({
    context,
    secretStore,
    adapter: customProvidersAdapter,
    logger,
  });
  logger.info(() => `activated v${packageJSON.version ?? "?"}`, {
    mode: vscode.ExtensionMode[context.extensionMode],
  });

  const bundledSkillsPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "skills",
    "agenticflowx",
  ).fsPath;
  const bundledAfxSkillOverlayPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "harness-overlays",
    "common",
    "agenticflowx-vscode.md",
  ).fsPath;
  const bundledPiSdkBootstrapPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "pi-sdk",
    "bootstrap.js",
  ).fsPath;
  const additionalSkillPaths = existsSync(bundledSkillsPath) ? [bundledSkillsPath] : undefined;
  const additionalSystemPromptPaths = existsSync(bundledAfxSkillOverlayPath)
    ? [bundledAfxSkillOverlayPath]
    : undefined;
  if (!additionalSkillPaths) {
    logger.warn("bundled skills path missing; Pi will rely on workspace-discovered skills", {
      bundledSkillsPath,
    });
  }
  if (!additionalSystemPromptPaths) {
    logger.warn(
      "AFX skill invocation host overlay missing; bundled skills will run without host hints",
      { bundledAfxSkillOverlayPath },
    );
  }

  function configuredModelSelection(
    cfg = vscode.workspace.getConfiguration("afx"),
  ): ModelSelectionIdentityV2 | undefined {
    const full = parseModelSelectionIdentity(cfg.get<string>(MODEL_DEFAULT_SELECTION_SETTING, ""));
    if (full) return full;
    return parseLegacySdkDefaultModel(cfg.get<string>("sdk.defaultModel", ""));
  }

  // Resolved Pi agent dir: `$PI_CODING_AGENT_DIR` when set, else `~/.pi/agent`.
  // The host owns env resolution and injects this into the agent factory and
  // sidebar so adapters never read `process.env` themselves.
  const piAgentDir = process.env["PI_CODING_AGENT_DIR"] ?? join(homedir(), ".pi", "agent");

  function resolveConfiguredSkillPaths(
    paths: readonly string[] | undefined,
    workspaceRoot?: string,
  ): Array<{ rawPath: string; resolvedPath: string }> {
    return normalizeStringList(paths).map((rawPath) => ({
      rawPath,
      resolvedPath: resolveUserPath(rawPath, workspaceRoot),
    }));
  }

  function resolveUserPath(value: string, workspaceRoot?: string): string {
    if (value === "~") return homedir();
    if (value.startsWith("~/")) return join(homedir(), value.slice(2));
    if (isAbsolute(value)) return value;
    return workspaceRoot ? resolve(workspaceRoot, value) : resolve(value);
  }

  function resolveProjectTrust(
    value: string,
    workspaceRoot?: string,
  ): "trust" | "ignore" | undefined {
    const normalized = value === "trust" || value === "ignore" ? value : "ask";
    if (normalized === "trust" || normalized === "ignore") return normalized;
    return workspaceRoot && hasWorkspacePiResources(workspaceRoot) ? "ignore" : undefined;
  }

  function hasWorkspacePiResources(workspaceRoot: string): boolean {
    return [
      join(workspaceRoot, ".pi", "settings.json"),
      join(workspaceRoot, ".pi", "SYSTEM.md"),
      join(workspaceRoot, ".pi", "APPEND_SYSTEM.md"),
      join(workspaceRoot, ".pi", "skills"),
      join(workspaceRoot, ".pi", "prompts"),
      join(workspaceRoot, ".pi", "themes"),
      join(workspaceRoot, ".pi", "extensions"),
      join(workspaceRoot, ".agents", "skills"),
    ].some((candidate) => existsSync(candidate));
  }

  function normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        (value as readonly unknown[])
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ];
  }

  function buildRuntimeEnv(httpProxy: string | undefined): Record<string, string> | undefined {
    const proxy = httpProxy?.trim();
    return proxy ? { HTTP_PROXY: proxy, HTTPS_PROXY: proxy } : undefined;
  }

  async function buildAgentInstances(inspectionRoot?: string): Promise<AgentInstance[]> {
    const cfg = vscode.workspace.getConfiguration("afx");
    const workspaceRoot =
      inspectionRoot ??
      activeExecutionContext?.codeRoot ??
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const configuredPiBinary = cfg.get<string>("agentBinaryPath", "").trim();
    const rpcEnabled = cfg.get<boolean>("rpc.enabled", false);
    const piBinaryPath = rpcEnabled
      ? resolvePiBinaryPath(configuredPiBinary, workspaceRoot)
      : undefined;
    const customSkillPaths = resolveConfiguredSkillPaths(
      cfg.get<readonly string[]>("skills.extraPaths", []),
      workspaceRoot,
    );
    const effectiveSkillPaths = [
      ...(additionalSkillPaths ?? []),
      ...customSkillPaths.map((entry) => entry.resolvedPath),
    ];
    const projectTrust = resolveProjectTrust(
      cfg.get<string>("pi.projectTrust", "ask"),
      workspaceRoot,
    );
    const excludedTools = normalizeStringList(cfg.get<readonly string[]>("pi.excludedTools", []));
    const runtimeEnv = {
      ...(buildRuntimeEnv(cfg.get<string>("network.httpProxy", "")) ?? {}),
      ...(!inspectionRoot && activeExecutionContext
        ? { AFX_BLUEPRINT_CONTEXT_JSON: JSON.stringify(activeExecutionContext) }
        : {}),
    };
    const legacySdkDefaultModel = cfg.get<string>("sdk.defaultModel", "anthropic:claude-opus-4-5");
    const selected = configuredModelSelection(cfg);
    const sdkDefaultModel =
      selected?.instanceId === "pi-sdk"
        ? formatSdkDefaultModel(selected.provider, selected.modelId)
        : legacySdkDefaultModel;
    const [piSdkExtraEnv, customDescriptor] = await Promise.all([
      customProvidersService.buildEnvForPiSdkSpawn(),
      customProvidersService.describeForSpawn(sdkDefaultModel),
    ]);
    return createConfiguredAgentInstances({
      logger,
      binaryPath: piBinaryPath,
      piAvailable: rpcEnabled && Boolean(piBinaryPath),
      rpcEnabled,
      ephemeral: inspectionRoot ? true : cfg.get<boolean>("agentEphemeralSession", false),
      inspectionMode: Boolean(inspectionRoot),
      sessionDir: resolveAfxSessionDir(context),
      agentDir: piAgentDir,
      cwd: workspaceRoot,
      additionalSystemPromptPaths: inspectionRoot ? [] : additionalSystemPromptPaths,
      additionalSkillPaths: inspectionRoot ? [] : effectiveSkillPaths,
      projectTrust: inspectionRoot ? "ignore" : projectTrust,
      excludedTools,
      runtimeEnv: Object.keys(runtimeEnv).length > 0 ? runtimeEnv : undefined,
      secretStore,
      // Shared OAuth orchestrator (active-method resolver for the bundled Pi SDK seam).
      // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
      // @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
      oauthService,
      globalStorageUri: context.globalStorageUri,
      bootstrapPath: bundledPiSdkBootstrapPath,
      sdkEnabled: cfg.get<boolean>("sdk.enabled", true),
      sdkDefaultModel,
      ollamaBaseUrl: cfg.get<string>("sdk.ollamaBaseUrl", "").trim() || undefined,
      piSdkExtraEnv: Object.keys(piSdkExtraEnv).length > 0 ? piSdkExtraEnv : undefined,
      piSdkCustomProviderIds: customDescriptor.ids.length > 0 ? customDescriptor.ids : undefined,
      piSdkCustomInitial: customDescriptor.initial,
    });
  }

  agentInstances = await buildAgentInstances();
  agentManager = new MultiplexedAgentManager(agentInstances, {
    instanceId: configuredModelSelection()?.instanceId,
    rpcEnabledGetter: () =>
      vscode.workspace.getConfiguration("afx").get<boolean>("rpc.enabled", false),
    modelAuthClassifier,
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

  let projectTrustPromptInFlight = false;
  async function maybePromptProjectTrust(): Promise<void> {
    if (projectTrustPromptInFlight) return;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !hasWorkspacePiResources(workspaceRoot)) return;
    const cfg = vscode.workspace.getConfiguration("afx");
    const projectTrust = cfg.get<string>("pi.projectTrust", "ask");
    if (projectTrust === "trust" || projectTrust === "ignore") return;

    projectTrustPromptInFlight = true;
    try {
      const trust = "Trust workspace";
      const ignore = "Ignore workspace";
      const openSettings = "Open Skills settings";
      const choice = await vscode.window.showWarningMessage(
        "AgenticFlowX found workspace Pi resources.",
        {
          modal: true,
          detail:
            "AFX is starting Pi with workspace skills and Pi project resources blocked until you choose. Trust this workspace to load them, ignore them, or open Settings > Support > Skills & commands later.",
        },
        trust,
        ignore,
        openSettings,
      );
      if (choice === openSettings) {
        await vscode.commands.executeCommand("afx.openSidebar");
        await sidebarProvider?.openSettingsTarget("skills");
        return;
      }
      if (choice !== trust && choice !== ignore) return;
      await cfg.update(
        "pi.projectTrust",
        choice === trust ? "trust" : "ignore",
        vscode.ConfigurationTarget.Workspace,
      );
    } finally {
      projectTrustPromptInFlight = false;
    }
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
      if (e.affectsConfiguration("afx.mode.active")) {
        void sidebarProvider?.refreshRuntimeConfiguration();
        refreshStatusBarMode();
      }
      if (
        e.affectsConfiguration("afx.composer.intent.slot") ||
        e.affectsConfiguration("afx.composer.intent.minimized")
      ) {
        void sidebarProvider?.refreshRuntimeConfiguration();
      }
      if (SETTINGS_SNAPSHOT_CONFIGURATION_KEYS.some((key) => e.affectsConfiguration(key))) {
        void sidebarProvider?.refreshRuntimeConfiguration();
      }
      if (RUNTIME_CONFIGURATION_KEYS.some((key) => e.affectsConfiguration(key))) {
        void scheduleAgentRuntimeRebuild("configuration changed");
      }
      if (e.affectsConfiguration("afx.pi.projectTrust")) {
        void maybePromptProjectTrust();
      }
    }),
    secretStore.onDidChange((e) => {
      const providerCredentialChanged =
        e.key.startsWith("afx.apiKey.") || SecretStore.isProviderEnvKey(e.key);
      if (!providerCredentialChanged) return;
      if (e.key.startsWith("afx.apiKey.") && consumeCommandOwnedProviderCredentialChange(e.key)) {
        return;
      }
      void scheduleAgentRuntimeRebuild("provider credential changed");
    }),
    // @see docs/specs/214-app-chat-settings/spec.md [FR-10]
    // @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
    customProvidersService.onDidChange(() => {
      void scheduleAgentRuntimeRebuild("custom providers updated");
      void sidebarProvider?.refreshCustomModelsSnapshot();
    }),
    customProvidersService,
  );

  // Shared: route an AFX command (e.g. the preview "Refine" action) to the chat
  // sidebar — either appended to the draft or sent immediately.
  const openChatCommand = async (command: string, mode: "insert" | "send"): Promise<void> => {
    await vscode.commands.executeCommand("afx.openSidebar");
    if (mode === "send") {
      await sidebarProvider?.sendExternalPrompt(command);
      return;
    }
    await sidebarProvider?.appendToDraft(command);
  };

  const afxPreviewDeps: AfxPreviewDeps = {
    extensionUri: context.extensionUri,
    extensionMode: context.extensionMode,
    logger,
    openChatCommand,
  };

  sidebarProvider = createSidebarPanel({
    extensionUri: context.extensionUri,
    extensionMode: context.extensionMode,
    extensionVersion: packageJSON.version ?? "?",
    bundledAfxSkillsVersion: packageJSON.afxSkillsPin ?? "?",
    bundledSkillsPath,
    piAgentDir,
    agentManager,
    runtimeMonitor,
    logger,
    secretStore,
    // Shared OAuth orchestrator for the Settings oauth/* bridge handlers (FR-1/9).
    // @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
    // @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
    oauthService,
    reconfigureAgentRuntimes: scheduleAgentRuntimeRebuild,
    beforeAgentSend: async () => {
      if (!activeBlueprint) return;
      const pinned = activeExecutionContext;
      if (!pinned)
        throw new Error(
          "A Blueprint is attached for navigation. Start a Blueprint Planning Session or create/continue a Blueprint Sprint before chatting, so specs and links stay outside the source checkout. Detach it to return to ordinary chat.",
        );
      const manifest = await openBlueprint(pinned.artifactRoot);
      if (
        manifest.id !== pinned.blueprintId ||
        manifest.revision !== pinned.blueprintRevision ||
        !manifest.repositories.some((repo) => repo.id === pinned.repositoryId)
      )
        throw new Error(
          "The pinned Blueprint context changed or became unavailable. End the session and reopen the intended Blueprint; no source-checkout fallback was used.",
        );
      await vscode.workspace.fs.stat(vscode.Uri.file(pinned.codeRoot));
      if (activeExecutionContext !== pinned)
        throw new Error("Blueprint context changed before send; retry in the intended session.");
    },
    openAfxPreview: (uri) => openAfxPreview(afxPreviewDeps, uri),
    // @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
    workspaceState: context.workspaceState,
    // @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-10]
    customProvidersService,
  });
  const workbenchFileState = createWorkbenchFileState({
    getWorkspaceFolders: () => {
      const workspaceFolders = [...(vscode.workspace.workspaceFolders ?? [])];
      if (!activeBlueprint) return workspaceFolders;
      return [
        ...workspaceFolders,
        {
          uri: vscode.Uri.file(activeBlueprint.artifactRoot),
          name: `Blueprint: ${activeBlueprint.manifest.name}`,
          index: workspaceFolders.length,
        },
      ];
    },
  });
  const workbenchMutationCoordinator = createWorkbenchMutationCoordinator({
    fileState: workbenchFileState,
  });
  const canvasEditSessionManager = createCanvasEditSessionManager({
    apply: (request, expectedRevision) =>
      workbenchMutationCoordinator.mutateText({
        requestId: request.requestId,
        target: request.target,
        expectedRevision,
        allowCreate: true,
        allowDirty: true,
        transform: () => {
          parseJSONCanvas(request.content);
          return request.content;
        },
      }),
    shouldApplyImmediately: (request) => {
      const uri = workbenchFileState.resolve(request.target);
      return Boolean(
        uri &&
        vscode.workspace.textDocuments.some(
          (document) => document.uri.toString() === uri.toString(),
        ),
      );
    },
  });
  const notesWriter = createNotesWorkspaceWriter({
    fileState: workbenchFileState,
    coordinator: workbenchMutationCoordinator,
  });
  const notesWriterInstallation = installNotesWorkspaceWriter(notesWriter);
  const canvasActionService = createCanvasActionService({
    fileState: workbenchFileState,
    capabilities: {
      "open-source": async (execution) => {
        for (const node of execution.nodes) {
          if (node.type !== "file") continue;
          const uri = resolveCanvasNodeUri(workbenchFileState, execution, node.file);
          if (!uri) throw new Error("Canvas file node is outside the workspace.");
          await vscode.window.showTextDocument(uri, { preview: true });
        }
      },
      "send-chat": async (execution) => {
        await openChatCommand(
          execution.action.command?.trim() || canvasActionContext(execution),
          "send",
        );
      },
      "promote-note": async (execution) => {
        const target = { ...execution.target, relativePath: ".afx/notes.md" };
        const uri = workbenchFileState.resolve(target);
        if (!uri) throw new Error("Canvas Notes target is outside the workspace.");
        const current = await workbenchFileState.readText(uri);
        const result = await notesWriter.mutate({
          requestId: `canvas-note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          target,
          expectedRevision: current?.revision,
          mutation: { kind: "append", text: canvasActionContext(execution) },
        });
        if (result.outcome !== "success") throw new Error(result.message);
      },
      "prepare-spec": async (execution) => {
        await openChatCommand(
          execution.action.command?.trim() ||
            `/afx-spec refine ${execution.action.label?.trim() || "next-feature"}`,
          "insert",
        );
      },
      "prepare-sprint": async (execution) => {
        await openChatCommand(
          execution.action.command?.trim() ||
            `/afx-sprint ${execution.action.label?.trim() || "next-feature"}`,
          "insert",
        );
      },
    },
  });
  const canvasEditorProvider = createCanvasEditorProvider({
    extensionUri: context.extensionUri,
    extensionMode: context.extensionMode,
    fileState: workbenchFileState,
    logger,
    openChatCommand,
    appendNote: appendNoteToWorkspace,
    openAfxPreview: (uri) => openAfxPreview(afxPreviewDeps, uri),
    canvasActionService,
    canvasEditSessionManager,
    authorCoordinator: workbenchMutationCoordinator,
    canvasLibrary: createCanvasLibraryService({
      fileState: workbenchFileState,
      coordinator: workbenchMutationCoordinator,
      workspaceState: context.workspaceState,
    }),
  });
  const specsData = createSpecsDataProvider(
    () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    logger,
    {
      fileState: workbenchFileState,
      getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
    },
  );
  context.subscriptions.push(
    canvasEditSessionManager,
    workbenchFileState,
    workbenchMutationCoordinator,
    notesWriterInstallation,
    { dispose: () => specsData.dispose() },
  );

  const workbenchProvider = createWorkbenchPanel({
    extensionUri: context.extensionUri,
    extensionMode: context.extensionMode,
    specsData,
    fileState: workbenchFileState,
    mutationCoordinator: workbenchMutationCoordinator,
    notesWriter,
    workspaceState: context.workspaceState,
    canvasActionService,
    canvasEditSessionManager,
    logger,
    openChatCommand,
  });
  void maybePromptProjectTrust();

  // @see docs/specs/200-app-vscode/spec.md [FR-11]
  // @see docs/specs/200-app-vscode/design.md [DES-COMMAND-CATALOG]
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = "afx.setMode";
  function refreshStatusBarMode(): void {
    const mode = normalizeWorkspaceMode(
      vscode.workspace.getConfiguration("afx").get<string>("mode.active", "code"),
    );
    statusItem.text = formatStatusBarMode(mode);
    statusItem.tooltip = formatStatusBarTooltip(mode);
  }
  refreshStatusBarMode();
  statusItem.show();

  context.subscriptions.push(
    runtimeMonitor,
    statusItem,
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-LIFECYCLE]
    vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_TYPE, sidebarProvider),
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-LIFECYCLE]
    vscode.window.registerWebviewViewProvider(WORKBENCH_VIEW_TYPE, workbenchProvider),
    // Optional JSON Canvas handler: priority remains `option`, so AFX never
    // replaces another Canvas editor unless the user explicitly chooses it.
    // @see docs/specs/229-app-workbench-canvas/spec.md [FR-32]
    vscode.window.registerCustomEditorProvider(AFX_CANVAS_EDITOR_VIEW_TYPE, canvasEditorProvider, {
      webviewOptions: { retainContextWhenHidden: false },
      supportsMultipleEditorsPerDocument: true,
    }),
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-COMMAND-OPEN-SIDEBAR]
    vscode.commands.registerCommand("afx.openSidebar", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.afx");
      await vscode.commands.executeCommand(`${SIDEBAR_VIEW_TYPE}.focus`);
    }),
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-COMMAND-OPEN-WORKBENCH]
    vscode.commands.registerCommand("afx.openWorkbench", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.afx-workbench-container");
      await vscode.commands.executeCommand(`${WORKBENCH_VIEW_TYPE}.focus`);
    }),
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-COMMAND-OPEN-WORKBENCH]
    vscode.commands.registerCommand("afx.openSddStudio", async () => {
      await vscode.commands.executeCommand("afx.openWorkbench");
    }),
    // @see docs/specs/229-app-workbench-canvas/spec.md [FR-32]
    vscode.commands.registerCommand(
      "afx.openCanvasEditor",
      async (target?: vscode.Uri | WorkbenchSourceIdentity) => {
        await openCanvasEditor(workbenchFileState, target);
      },
    ),
    // @see docs/specs/200-app-vscode/design.md [DES-COMMAND-CATALOG]
    vscode.commands.registerCommand("afx.newSdd", async () => {
      await openChatCommand("/afx-spec new ", "insert");
    }),
    // @see docs/specs/200-app-vscode/design.md [DES-COMMAND-CATALOG]
    vscode.commands.registerCommand("afx.refineCurrentDocument", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor?.document.uri) {
        vscode.window.showInformationMessage("AgenticFlowX: open an AFX markdown document first.");
        return;
      }
      const action = sddPrimaryActionForActiveEditor(editor);
      if (!action) {
        vscode.window.showInformationMessage(
          "AgenticFlowX: current document is not an AFX SDD document.",
        );
        return;
      }
      openAfxPreview(afxPreviewDeps, editor.document.uri);
      await openChatCommand(action.command, action.mode);
    }),
    // @see docs/specs/200-app-vscode/design.md [DES-COMMAND-CATALOG]
    vscode.commands.registerCommand("afx.showLogs", () => channel.show(true)),
    // @see docs/specs/350-agent-manager/design.md [DES-AGENT-COMMAND-SMOKE-TEST]
    vscode.commands.registerCommand("afx.agentSmokeTest", () => agentSmokeTest(channel, logger)),
    // @see docs/specs/350-agent-manager/design.md [DES-AGENT-COMMAND-RESTART]
    vscode.commands.registerCommand("afx.agentRestart", async () => {
      await runtimeMonitor.restart();
      vscode.window.showInformationMessage("AgenticFlowX: agent runtime restarted");
    }),
    // @see docs/specs/201-app-vscode-panels/spec.md [FR-9] [FR-10] [FR-11]
    // @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
    vscode.commands.registerCommand("afx.setMode", async (mode?: WorkspaceMode) => {
      const currentMode = normalizeWorkspaceMode(
        vscode.workspace.getConfiguration("afx").get<string>("mode.active", "code"),
      );
      const nextMode = mode ?? (await pickWorkspaceMode(currentMode));
      if (!nextMode || nextMode === currentMode) return;
      await updateAfxConfigurationWithWorkspaceFallback(
        "mode.active",
        nextMode,
        configurationTargetFor("mode.active"),
        logger,
      );
    }),
    // @see docs/specs/211-app-chat-composer/spec.md [FR-20]
    // @see docs/specs/214-app-chat-settings/spec.md [FR-1]
    vscode.commands.registerCommand("afx.setIntent", async (slot?: IntentSlot) => {
      const cfg = vscode.workspace.getConfiguration("afx");
      const mode = normalizeWorkspaceMode(cfg.get<string>("mode.active", "code"));
      if (mode === "spec") {
        vscode.window.showInformationMessage(
          "AgenticFlowX: Intent is available in Code and Explore modes.",
        );
        return;
      }
      const currentSlot = normalizeIntentSlot(cfg.get<number>("composer.intent.slot", 1));
      const nextSlot = slot ?? (await pickComposerIntent(mode, currentSlot));
      if (!nextSlot || nextSlot === currentSlot) return;
      const target = configurationTargetFor("composer.intent.slot");
      await updateAfxConfigurationWithWorkspaceFallback(
        "composer.intent.slot",
        nextSlot,
        target,
        logger,
      );
    }),
    // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
    vscode.commands.registerCommand(
      "afx.setProviderApiKey",
      async (provider?: string, key?: string, config?: Record<string, string>) => {
        const providerId =
          provider?.trim() ||
          (await vscode.window.showInputBox({
            prompt: "Provider id",
            placeHolder: "anthropic",
            ignoreFocusOut: true,
          }));
        if (!providerId) return;
        const normalizedProviderId = normalizeProviderId(providerId);
        const suppliedConfig = config ?? {};
        const hasSuppliedConfig = Object.values(suppliedConfig).some((value) => value.trim());
        const apiKey =
          key?.trim() ||
          (hasSuppliedConfig
            ? undefined
            : await vscode.window.showInputBox({
                prompt: `API key for ${normalizedProviderId}`,
                password: true,
                ignoreFocusOut: true,
              }));
        if (!apiKey && !hasSuppliedConfig) return;

        const configToStore: Record<string, string> = {};
        for (const field of PROVIDER_DETAILS[normalizedProviderId]?.configFields ?? []) {
          const supplied = suppliedConfig[field.envVar]?.trim();
          if (supplied) {
            configToStore[field.envVar] = supplied;
            continue;
          }
          const existing = await secretStore.getProviderEnvVar(field.envVar);
          if (existing || field.required === false || hasSuppliedConfig) continue;
          const value = await vscode.window.showInputBox({
            prompt: `${field.label} for ${normalizedProviderId}`,
            placeHolder: field.placeholder,
            password: field.secret === true,
            ignoreFocusOut: true,
          });
          if (!value?.trim()) return;
          configToStore[field.envVar] = value.trim();
        }

        if (apiKey) {
          const secretKey = providerApiKeySecretKey(normalizedProviderId);
          rememberCommandOwnedProviderCredentialChange(secretKey);
          try {
            await secretStore.setApiKey(normalizedProviderId, apiKey);
          } catch (err) {
            consumeCommandOwnedProviderCredentialChange(secretKey);
            throw err;
          }
        }
        for (const [envVar, value] of Object.entries(configToStore)) {
          await secretStore.setProviderEnvVar(envVar, value);
        }
        await scheduleAgentRuntimeRebuild(`provider setup saved for ${normalizedProviderId}`);
        vscode.window.showInformationMessage(
          `AgenticFlowX: saved provider setup for ${normalizedProviderId}`,
        );
      },
    ),
    // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
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
    // @see docs/specs/351-agent-pi/design.md [DES-PI-COMMAND-DETECT-BINARY]
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
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-COMMAND-OPEN-AT-LINE]
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

  let inspectionGeneration = 0;
  let activeInspection: AbortController | undefined;
  context.subscriptions.push({ dispose: () => activeInspection?.abort() });

  async function selectBlueprintProject(
    sourceUri?: vscode.Uri,
  ): Promise<ProjectContext | undefined> {
    const captured = sourceUri ?? vscode.window.activeTextEditor?.document.uri;
    const resolvedProject = captured ? resolveProject(captured, discoveredProjects) : undefined;
    if (resolvedProject) return resolvedProject;
    if (discoveredProjects.length === 1) return discoveredProjects[0];
    const picked = await vscode.window.showQuickPick(
      discoveredProjects.map((project) => ({
        label: project.name,
        description: `${project.kind} · ${project.rootUri.toString()}`,
        project,
      })),
      {
        title: "AFX: Choose repository to inspect",
        placeHolder: "Select an explicit project root",
      },
    );
    return picked?.project;
  }

  async function inspectAndOpenBlueprint(
    project: ProjectContext,
    sourceUri?: vscode.Uri,
  ): Promise<void> {
    activeInspection?.abort();
    const controller = new AbortController();
    activeInspection = controller;
    const generation = ++inspectionGeneration;
    const boundRepository = activeBlueprint?.manifest.repositories.find(
      (repo) => activeBlueprint?.binding.checkouts[repo.id] === project.rootUri.fsPath,
    );
    const previousModel =
      activeBlueprint && boundRepository
        ? await loadBlueprintModel(
            activeBlueprint.artifactRoot,
            activeBlueprint.manifest,
            boundRepository.id,
          )
        : undefined;
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showWarningMessage(
        "Trust this workspace before starting a Pi investigation.",
      );
      return;
    }
    const instances = await buildAgentInstances(project.rootUri.fsPath);
    const selection = configuredModelSelection(vscode.workspace.getConfiguration("afx"));
    const instance = selection
      ? instances.find((candidate) => candidate.id === selection.instanceId)
      : instances[0];
    if (!instance) {
      await Promise.all(instances.map((candidate) => candidate.manager.dispose()));
      throw new Error(
        "The selected Pi runtime is unavailable. Choose an available model in AFX Settings before inspecting this repository.",
      );
    }
    for (const other of instances) if (other !== instance) await other.manager.dispose();
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `AFX: Inspecting ${project.name}`,
        cancellable: true,
      },
      async (progress, cancellation) => {
        const subscription = cancellation.onCancellationRequested(() => controller.abort());
        if (cancellation.isCancellationRequested) controller.abort();
        try {
          if (selection?.instanceId === instance.id) await instance.manager.setModel(selection);
          return await investigateRepository({
            root: project.rootUri.fsPath,
            manager: instance.manager,
            signal: controller.signal,
            progress: (message) => progress.report({ message }),
            previous: investigations.get(project.id) ?? previousModel?.investigation,
            reviewGuidance:
              activeBlueprint && boundRepository
                ? await loadFindingReviews(
                    activeBlueprint.artifactRoot,
                    activeBlueprint.manifest,
                    boundRepository.id,
                  )
                : [],
            symbols: async (relativePath) => {
              const document = await vscode.workspace.openTextDocument(
                vscode.Uri.joinPath(project.rootUri, relativePath),
              );
              return inspectDocumentSymbols(document, generation, () => inspectionGeneration);
            },
          });
        } finally {
          subscription.dispose();
          await instance.manager.dispose();
        }
      },
    );
    if (generation !== inspectionGeneration) return;
    investigations.set(project.id, result);
    investigationParents.set(project.id, previousModel?.modelRevisionId ?? null);
    const uri = previewProvider.update({
      id: project.id,
      projectId: project.id,
      ...(sourceUri ? { sourceUri } : {}),
      content: renderInvestigation(result, project.name),
    });
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Active,
      preview: true,
    });
  }

  async function selectBoundRepository() {
    const blueprint = activeBlueprint;
    if (!blueprint) return undefined;
    const repositories = blueprint.manifest.repositories.filter(
      (repo) => blueprint.binding.checkouts[repo.id],
    );
    if (repositories.length === 1) return repositories[0];
    return (
      await vscode.window.showQuickPick(
        repositories.map((repository) => ({
          label: repository.name,
          description: blueprint.binding.checkouts[repository.id],
          repository,
        })),
        { title: "Choose Blueprint repository" },
      )
    )?.repository;
  }

  async function activateBlueprint(
    artifactRoot: string,
    manifest: BlueprintManifest,
    project: ProjectContext,
  ): Promise<void> {
    const savedBindings = bindingState?.get<Record<string, BlueprintBinding>>(BINDING_KEY, {});
    const existing = savedBindings?.[manifest.id];
    const firstRepository =
      manifest.repositories.length === 1
        ? manifest.repositories[0]
        : (
            await vscode.window.showQuickPick(
              manifest.repositories.map((repository) => ({
                label: repository.name,
                description: repository.id,
                repository,
              })),
              { title: "Bind repository to selected checkout" },
            )
          )?.repository;
    if (!firstRepository) return;
    const binding: BlueprintBinding = existing ?? {
      blueprintId: manifest.id,
      artifactRoot,
      checkouts: { [firstRepository.id]: project.rootUri.fsPath },
    };
    binding.artifactRoot = artifactRoot;
    binding.checkouts[firstRepository.id] = project.rootUri.fsPath;
    const traces = await loadTraceStore(artifactRoot, manifest);
    activeBlueprint = { artifactRoot, manifest, binding, traces };
    activeBlueprintWatcher?.dispose();
    activeBlueprintWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        artifactRoot,
        manifest.schemaVersion === 3 ? "blueprint.json" : manifest.artifacts.traces,
      ),
    );
    activeBlueprintWatcher.onDidChange(() => blueprintLensChanges.fire());
    activeBlueprintWatcher.onDidCreate(() => blueprintLensChanges.fire());
    activeBlueprintWatcher.onDidDelete(() => blueprintLensChanges.fire());
    await saveLocalBinding(binding);
    await vscode.commands.executeCommand("setContext", "afx.blueprintAttached", true);
    void vscode.window.showInformationMessage(`Blueprint attached: ${manifest.name}`);
    blueprintLensChanges.fire();
  }

  async function ensureBlueprintDocumentRoot(
    blueprint: NonNullable<typeof activeBlueprint>,
    repositoryId: string,
  ): Promise<{ id: string; root: string } | undefined> {
    const descriptor = blueprint.manifest.documents?.[0] ?? {
      id: "sdd",
      name: "AFX documents",
      kind: "sdd" as const,
    };
    const existing = blueprint.binding.documentRoots?.[descriptor.id];
    if (existing) return { id: descriptor.id, root: existing };
    const projectRoot = blueprint.binding.checkouts[repositoryId];
    const choice = await vscode.window.showQuickPick(
      [
        {
          label: "$(folder) This project",
          description: projectRoot ? join(projectRoot, "docs/specs") : undefined,
          value: "project" as const,
        },
        {
          label: "$(folder-opened) Choose another folder…",
          description: "Keep AFX documents in a separate repository or private location",
          value: "choose" as const,
        },
      ],
      {
        title: "Where should AFX documents live?",
        placeHolder: "Asked once, when you first create or link a document",
      },
    );
    if (!choice) return undefined;
    const root =
      choice.value === "project"
        ? projectRoot
        : (
            await vscode.window.showOpenDialog({
              title: "Choose AFX document root",
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
            })
          )?.[0]?.fsPath;
    if (!root) return undefined;
    blueprint.binding.documentRoots = {
      ...(blueprint.binding.documentRoots ?? {}),
      [descriptor.id]: root,
    };
    await saveLocalBinding(blueprint.binding);
    return { id: descriptor.id, root };
  }

  const getRoot = createDocumentRootResolver(() => discoveredProjects);
  const getExternalReferences = async (document: vscode.TextDocument) => {
    const blueprint = activeBlueprint;
    if (!blueprint) return [];
    try {
      blueprint.traces = await loadTraceStore(blueprint.artifactRoot, blueprint.manifest);
    } catch {
      return resolveBlueprintReferences(
        document,
        blueprint.artifactRoot,
        blueprint.binding,
        blueprint.traces,
      ).map((reference) => ({ ...reference, resolution: "unresolved" as const }));
    }
    if (activeBlueprint !== blueprint) return [];
    const references = resolveBlueprintReferences(
      document,
      blueprint.artifactRoot,
      blueprint.binding,
      blueprint.traces,
    );
    if (
      !references.some(
        (reference) =>
          reference.resolution !== "resolved" &&
          blueprint.traces.links.some((link) => link.id === reference.linkId && link.source.symbol),
      )
    )
      return references;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const symbols = await Promise.race([
        inspectDocumentSymbols(document, document.version, () => document.version),
        new Promise<undefined>((resolve) => {
          timer = setTimeout(() => resolve(undefined), 1500);
        }),
      ]);
      return symbols?.state === "current"
        ? repositionBlueprintReferences(references, blueprint.traces, symbols.symbols)
        : references;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const blueprintMetadataWatcher = vscode.workspace.createFileSystemWatcher(
    "**/{package.json,pyproject.toml,Cargo.toml,go.mod,.git}",
  );
  const invalidateExternalObservation = (uri: vscode.Uri): void => {
    const project = resolveProject(uri, discoveredProjects);
    if (!project) return;
    observations.delete(project.id);
    previewProvider.markStale(project.id, "stale");
    void observationStorage.clear(project.id);
  };

  // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-API]
  context.subscriptions.push(
    previewProvider,
    blueprintMetadataWatcher,
    blueprintMetadataWatcher.onDidCreate(invalidateExternalObservation),
    blueprintMetadataWatcher.onDidChange(invalidateExternalObservation),
    blueprintMetadataWatcher.onDidDelete(invalidateExternalObservation),
    vscode.workspace.registerTextDocumentContentProvider(BLUEPRINT_PREVIEW_SCHEME, previewProvider),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void refreshProjects();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const project = resolveProject(event.document.uri, discoveredProjects);
      if (project)
        previewProvider.markStale(project.id, event.document.isDirty ? "dirty" : "stale");
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const project = resolveProject(document.uri, discoveredProjects);
      if (!project) return;
      observations.delete(project.id);
      previewProvider.markStale(project.id, "stale");
      void observationStorage.clear(project.id);
    }),
    vscode.commands.registerCommand("afx.inspectRepository", async (source?: vscode.Uri) => {
      const captured = source ?? vscode.window.activeTextEditor?.document.uri;
      const project = await selectBlueprintProject(captured);
      if (!project) return;
      await inspectAndOpenBlueprint(project, captured);
    }),
    vscode.commands.registerCommand("afx.refreshBlueprint", async (previewUri?: vscode.Uri) => {
      const record = previewUri ? previewProvider.get(previewUri) : undefined;
      const project = discoveredProjects.find((candidate) => candidate.id === record?.projectId);
      if (!project) return;
      await inspectAndOpenBlueprint(project, record?.sourceUri);
    }),
    vscode.commands.registerCommand("afx.changeBlueprintProject", async () => {
      const project = await selectBlueprintProject();
      if (project) await inspectAndOpenBlueprint(project);
    }),
    vscode.commands.registerCommand("afx.copyBlueprintContext", async (previewUri?: vscode.Uri) => {
      const record = previewUri ? previewProvider.get(previewUri) : undefined;
      if (record) await vscode.env.clipboard.writeText(record.content);
    }),
    vscode.commands.registerCommand("afx.clearBlueprintCache", async (projectId?: string) => {
      await observationStorage.clear(projectId);
      if (projectId) observations.delete(projectId);
      else observations.clear();
      vscode.window.showInformationMessage("AgenticFlowX: observation cache cleared.");
    }),
    vscode.commands.registerCommand("afx.showBlueprintCacheDetails", () => {
      const details = observationStorage.details();
      vscode.window.showInformationMessage(
        `AgenticFlowX: Blueprint observations use ${details.mode} storage${details.storageRoot ? ` at ${details.storageRoot}` : ""}.`,
      );
    }),
    vscode.commands.registerCommand("afx.saveBlueprint", async (previewUri?: vscode.Uri) => {
      const record = previewUri ? previewProvider.get(previewUri) : undefined;
      const project =
        discoveredProjects.find((candidate) => candidate.id === record?.projectId) ??
        (await selectBlueprintProject(record?.sourceUri));
      if (!project) return;
      const investigation = investigations.get(project.id);
      if (!investigation || investigation.evidence.length === 0)
        throw new Error("Inspect this repository successfully before saving a Blueprint.");
      const destination = await chooseBlueprintSaveLocation(project);
      if (!destination) return;
      const { artifactRoot, name, attach } = destination;
      const manifest = await createBlueprint({
        schemaVersion: 3,
        artifactRoot,
        name,
        repository: { name: project.name, kind: project.kind === "repository" ? "git" : "folder" },
        researchMarkdown: renderInvestigation(investigation, project.name),
      });
      await saveBlueprintModel(artifactRoot, manifest, manifest.repositories[0]!.id, investigation);
      const savedManifest = await openBlueprint(artifactRoot);
      if (attach) await activateBlueprint(artifactRoot, savedManifest, project);
      vscode.window.showInformationMessage(`AgenticFlowX: saved Blueprint at ${artifactRoot}.`);
    }),
    vscode.commands.registerCommand("afx.openBlueprint", async (manifestUri?: vscode.Uri) => {
      const selected = manifestUri
        ? [manifestUri]
        : await vscode.window.showOpenDialog({
            title: "Open Blueprint…",
            canSelectFiles: true,
            canSelectFolders: true,
            canSelectMany: false,
            filters: { "AFX Blueprint": ["json"] },
          });
      const chosen = selected?.[0]?.fsPath;
      if (!chosen) return;
      const manifest = await openBlueprint(chosen);
      const artifactRoot = chosen.endsWith(".json") ? resolve(chosen, "..") : chosen;
      openedBlueprint = { artifactRoot, manifest };
      await vscode.window.showTextDocument(
        vscode.Uri.file(
          join(
            artifactRoot,
            manifest.schemaVersion === 3 ? "blueprint.md" : manifest.artifacts.overview,
          ),
        ),
      );
    }),
    vscode.commands.registerCommand("afx.migrateBlueprint", async () => {
      const blueprint = openedBlueprint ?? activeBlueprint;
      if (!blueprint) throw new Error("Open the v1 Blueprint to migrate first.");
      if (activeExecutionContext)
        throw new Error("End the work session before migrating its Blueprint.");
      const manifest = await migrateBlueprint(blueprint.artifactRoot);
      openedBlueprint = { artifactRoot: blueprint.artifactRoot, manifest };
      if (activeBlueprint?.manifest.id === manifest.id) {
        activeBlueprint.manifest = manifest;
        activeBlueprint.traces = await loadTraceStore(blueprint.artifactRoot, manifest);
      }
      void vscode.window.showInformationMessage(
        "Blueprint migrated to v2. Inspect its bound repository to create a semantic model.",
      );
    }),
    vscode.commands.registerCommand("afx.recoverBlueprintMigration", async () => {
      const selected = await vscode.window.showOpenDialog({
        title: "Recover Blueprint Migration",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      });
      if (!selected?.[0]) return;
      const artifactRoot = selected[0].fsPath;
      const manifest = await recoverBlueprintMigration(artifactRoot);
      openedBlueprint = { artifactRoot, manifest };
      void vscode.window.showInformationMessage(
        "Blueprint migration recovered; reopen or attach it to continue.",
      );
    }),
    vscode.commands.registerCommand("afx.attachBlueprint", async (sourceUri?: vscode.Uri) => {
      if (!openedBlueprint) await vscode.commands.executeCommand("afx.openBlueprint");
      if (!openedBlueprint) return;
      const project = await selectBlueprintProject(sourceUri);
      if (project)
        await activateBlueprint(openedBlueprint.artifactRoot, openedBlueprint.manifest, project);
    }),
    vscode.commands.registerCommand("afx.beginBlueprintPlanning", async () => {
      const blueprint = activeBlueprint;
      if (!blueprint) throw new Error("Attach a Blueprint first.");
      await vscode.window.showTextDocument(
        vscode.Uri.file(join(blueprint.artifactRoot, "blueprint.md")),
      );
    }),
    vscode.commands.registerCommand("afx.endBlueprintSession", async () => {
      if ((await requireAgentManager().getStatus()).isStreaming)
        throw new Error(
          "Wait for or stop the active conversation before ending its Blueprint session.",
        );
      activeExecutionContext = undefined;
      await scheduleAgentRuntimeRebuild("Blueprint work session ended");
    }),
    vscode.commands.registerCommand("afx.detachBlueprint", async () => {
      if (activeExecutionContext)
        throw new Error("End the Blueprint work session before detaching.");
      activeBlueprintWatcher?.dispose();
      activeBlueprintWatcher = undefined;
      activeBlueprint = undefined;
      await vscode.commands.executeCommand("setContext", "afx.blueprintAttached", false);
      blueprintLensChanges.fire();
    }),
    vscode.commands.registerCommand("afx.saveBlueprintRevision", async () => {
      const blueprint = activeBlueprint;
      if (!blueprint) throw new Error("Attach a Blueprint before saving a new model revision.");
      const repository = await selectBoundRepository();
      if (!repository) return;
      const project = discoveredProjects.find(
        (item) => item.rootUri.fsPath === blueprint.binding.checkouts[repository.id],
      );
      const result = project ? investigations.get(project.id) : undefined;
      if (!result?.evidence.length)
        throw new Error("Inspect the bound repository before saving a new model revision.");
      const model = await saveBlueprintModel(
        blueprint.artifactRoot,
        blueprint.manifest,
        repository.id,
        result,
        project ? investigationParents.get(project.id) : undefined,
      );
      blueprint.manifest = await openBlueprint(blueprint.artifactRoot);
      void vscode.window.showInformationMessage(
        `Saved Blueprint model revision ${model.modelRevisionId}. Authored specs and trace links are retained.`,
      );
    }),
    vscode.commands.registerCommand("afx.reviewBlueprintFinding", async () => {
      const blueprint = activeBlueprint;
      const repository = await selectBoundRepository();
      if (!blueprint || !repository)
        throw new Error("Attach a Blueprint before reviewing findings.");
      const model = await loadBlueprintModel(
        blueprint.artifactRoot,
        blueprint.manifest,
        repository.id,
      );
      if (!model) throw new Error("Save an investigated model first.");
      const selected = await vscode.window.showQuickPick(
        model.investigation.findings.map((finding) => ({
          label: finding.title,
          description: finding.category,
          detail: finding.description,
          finding,
        })),
        { title: "Review Blueprint Finding" },
      );
      if (!selected) return;
      const decision = await vscode.window.showQuickPick(
        ["accepted", "rejected", "corrected"] as const,
        {
          title: "Finding decision",
          placeHolder: "This records your research review, not task verification.",
        },
      );
      if (decision !== "accepted" && decision !== "rejected" && decision !== "corrected") return;
      const notes = await vscode.window.showInputBox({
        title: "Finding review notes",
        prompt: "Describe the correction or basis for your decision.",
        ignoreFocusOut: true,
      });
      if (notes === undefined) return;
      await saveFindingReview(
        blueprint.artifactRoot,
        blueprint.manifest,
        model,
        selected.finding.id,
        decision,
        notes,
      );
      blueprint.manifest = await openBlueprint(blueprint.artifactRoot);
      void vscode.window.showInformationMessage(
        "Finding review saved separately from the derived model and retained for reinspection.",
      );
    }),
    vscode.commands.registerCommand("afx.checkBlueprintChanges", async () => {
      if (!activeBlueprint) throw new Error("Attach a saved Blueprint first.");
      const repository = await selectBoundRepository();
      if (!repository) return;
      const model = await loadBlueprintModel(
        activeBlueprint.artifactRoot,
        activeBlueprint.manifest,
        repository.id,
      );
      if (!model) throw new Error("This Blueprint has no saved semantic model.");
      const codeRoot = activeBlueprint.binding.checkouts[repository.id];
      if (!codeRoot) throw new Error("Bind a code checkout first.");
      const changes = await reconcileBlueprintModel(model, codeRoot);
      await saveBlueprintChanges(activeBlueprint.artifactRoot, activeBlueprint.manifest, changes);
      activeBlueprint.manifest = await openBlueprint(activeBlueprint.artifactRoot);
      const content = [
        `# Blueprint changes: ${activeBlueprint.manifest.name}`,
        "",
        `Compared with model ${model.modelRevisionId}`,
        `Git baseline: ${model.baseline.gitRevision ?? "unavailable"} → ${changes.toGitRevision ?? "unavailable"}. Content hashes determine freshness.`,
        "",
        `Affected claims: ${changes.affectedClaimIds.length} · Affected entities: ${changes.affectedEntityIds.length}`,
        ...model.claims
          .filter((claim) => changes.affectedClaimIds.includes(claim.id))
          .map((claim) => `- Needs review: ${claim.description}`),
        "",
        "## Possible moves — review before relinking",
        ...changes.renameCandidates.map(
          (candidate) =>
            `- \`${candidate.from}\` → \`${candidate.to}\` (${candidate.basis}; ${candidate.state})`,
        ),
        "",
        ...(["changed", "missing", "added", "current", "unknown"] as const).flatMap((state) => [
          `## ${state} (${changes[state].length})`,
          "",
          ...changes[state].map((file) => `- \`${file}\``),
          "",
        ]),
        "Unknown files were not examined by this model. Reinspect explicitly to investigate impact.",
      ].join("\n");
      const uri = previewProvider.update({
        id: `changes-${model.modelRevisionId}`,
        projectId: model.repositoryId,
        content,
      });
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri), {
        viewColumn: vscode.ViewColumn.Active,
        preview: true,
      });
    }),
    vscode.commands.registerCommand("afx.linkSourceToBlueprint", async () => {
      const blueprint = activeBlueprint;
      const editor = vscode.window.activeTextEditor;
      if (!blueprint || !editor) {
        vscode.window.showWarningMessage(
          "AgenticFlowX: open a saved Blueprint and source file first.",
        );
        return;
      }
      const repository = blueprint.manifest.repositories.find((candidate) => {
        const root = blueprint.binding.checkouts[candidate.id];
        if (!root) return false;
        const candidatePath = relative(root, editor.document.uri.fsPath);
        return (
          candidatePath !== ".." &&
          !candidatePath.startsWith(`..${sep}`) &&
          !isAbsolute(candidatePath)
        );
      });
      if (!repository)
        throw new Error("The source file is outside this Blueprint's bound checkouts.");
      const documentRoot = await ensureBlueprintDocumentRoot(blueprint, repository.id);
      if (!documentRoot) return;
      const targetPath = await vscode.window.showInputBox({
        title: "Link to Blueprint…",
        prompt: `Markdown path inside ${documentRoot.root}`,
        placeHolder: "docs/specs/feature/spec.md",
        ignoreFocusOut: true,
      });
      if (!targetPath) return;
      const anchorId = await vscode.window.showInputBox({
        title: "Link to Blueprint…",
        prompt: "Optional requirement, design or task ID",
        placeHolder: "FR-1",
        ignoreFocusOut: true,
      });
      const selection = editor.selection;
      let sourceScope: "file" | "symbol" | "range" = selection.isEmpty ? "file" : "range";
      let sourceSymbol:
        | {
            name: string;
            kind: number;
            range: {
              start: { line: number; character: number };
              end: { line: number; character: number };
            };
            selectionRange: {
              start: { line: number; character: number };
              end: { line: number; character: number };
            };
          }
        | undefined;
      if (selection.isEmpty) {
        const symbols =
          (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            "vscode.executeDocumentSymbolProvider",
            editor.document.uri,
          )) ?? [];
        const flatten = (items: readonly vscode.DocumentSymbol[]): vscode.DocumentSymbol[] =>
          items.flatMap((item) => [item, ...flatten(item.children)]).slice(0, 200);
        const choice = await vscode.window.showQuickPick(
          [
            { label: "$(file) Entire file", value: undefined as vscode.DocumentSymbol | undefined },
            ...flatten(symbols).map((symbol) => ({
              label: `$(symbol-method) ${symbol.name}`,
              description: symbol.detail,
              value: symbol,
            })),
          ],
          { title: "Link to Blueprint… Choose source scope" },
        );
        if (!choice) return;
        if (choice.value) {
          const symbol = choice.value;
          const mapRange = (range: vscode.Range) => ({
            start: { line: range.start.line, character: range.start.character },
            end: { line: range.end.line, character: range.end.character },
          });
          sourceScope = "symbol";
          sourceSymbol = {
            name: symbol.name,
            kind: Number(symbol.kind) + 1,
            range: mapRange(symbol.range),
            selectionRange: mapRange(symbol.selectionRange),
          };
        }
      }
      const sourcePath = relative(
        blueprint.binding.checkouts[repository.id]!,
        editor.document.uri.fsPath,
      ).replaceAll("\\", "/");
      blueprint.traces = await addTraceLink(
        blueprint.artifactRoot,
        blueprint.manifest,
        blueprint.traces.revision,
        {
          repositoryId: repository.id,
          sourcePath,
          languageId: editor.document.languageId,
          scope: sourceScope,
          ...(sourceScope === "range"
            ? {
                range: {
                  start: { line: selection.start.line, character: selection.start.character },
                  end: { line: selection.end.line, character: selection.end.character },
                },
              }
            : {}),
          targetPath,
          documentRootId: documentRoot.id,
          documentRoot: documentRoot.root,
          ...(anchorId
            ? {
                targetAnchor: {
                  kind: /^FR-|^NFR-/.test(anchorId)
                    ? "requirement"
                    : /^DES-/.test(anchorId)
                      ? "design"
                      : /^\d+\.\d+$/.test(anchorId)
                        ? "task"
                        : "section",
                  id: anchorId,
                },
              }
            : {}),
          ...(sourceSymbol ? { symbol: sourceSymbol } : {}),
          content: editor.document.getText(),
        },
      );
      blueprint.manifest = await openBlueprint(blueprint.artifactRoot);
      await vscode.commands.executeCommand("editor.action.codeLensRefresh");
      blueprintLensChanges.fire();
      vscode.window.showInformationMessage("AgenticFlowX: source link saved in the Blueprint.");
    }),
    vscode.commands.registerCommand("afx.reviewBlueprintLinks", async () => {
      const blueprint = activeBlueprint;
      const editor = vscode.window.activeTextEditor;
      if (!blueprint || !editor) {
        vscode.window.showWarningMessage(
          "AgenticFlowX: open a saved Blueprint and the intended source file first.",
        );
        return;
      }
      const selected = await vscode.window.showQuickPick(
        blueprint.traces.links.map((link) => ({
          label: `${link.lastKnownResolution === "resolved" ? "$(pass)" : "$(warning)"} ${link.target.anchor ? `[${link.target.anchor.id}] ` : ""}${link.target.path}`,
          description: `${link.source.path} · ${link.lastKnownResolution ?? "unresolved"}`,
          detail: link.description,
          link,
        })),
        {
          title: "Review or Relink Blueprint Reference…",
          placeHolder: "Choose the reference to bind to the active file or selection",
        },
      );
      if (!selected) return;
      const repository = blueprint.manifest.repositories.find((candidate) => {
        const root = blueprint.binding.checkouts[candidate.id];
        if (!root) return false;
        const candidatePath = relative(root, editor.document.uri.fsPath);
        return (
          candidatePath !== ".." &&
          !candidatePath.startsWith(`..${sep}`) &&
          !isAbsolute(candidatePath)
        );
      });
      if (!repository)
        throw new Error("The active source file is outside this Blueprint's bound checkouts.");
      const selection = editor.selection;
      const mapRange = (range: vscode.Range) => ({
        start: { line: range.start.line, character: range.start.character },
        end: { line: range.end.line, character: range.end.character },
      });
      blueprint.traces = await relinkTraceSource(
        blueprint.artifactRoot,
        blueprint.manifest,
        blueprint.traces.revision,
        selected.link.id,
        {
          repositoryId: repository.id,
          path: relative(
            blueprint.binding.checkouts[repository.id]!,
            editor.document.uri.fsPath,
          ).replaceAll("\\", "/"),
          languageId: editor.document.languageId,
          scope: selection.isEmpty ? "file" : "range",
          ...(!selection.isEmpty ? { range: mapRange(selection) } : {}),
          content: editor.document.getText(),
        },
      );
      blueprint.manifest = await openBlueprint(blueprint.artifactRoot);
      await vscode.commands.executeCommand("editor.action.codeLensRefresh");
      vscode.window.showInformationMessage(
        "AgenticFlowX: Blueprint reference relinked to the active source.",
      );
    }),
    vscode.commands.registerCommand("afx.newBlueprintSprint", async () => {
      const blueprint = activeBlueprint;
      if (!blueprint) throw new Error("Open a saved Blueprint before creating a Sprint.");
      const name = await vscode.window.showInputBox({
        title: "New Blueprint Sprint",
        prompt: "Sprint name",
      });
      if (!name) return;
      const repository = await selectBoundRepository();
      if (!repository) return;
      const documentRoot = await ensureBlueprintDocumentRoot(blueprint, repository.id);
      if (!documentRoot) return;
      const created = await createBlueprintSprint({
        manifest: blueprint.manifest,
        artifactRoot: blueprint.artifactRoot,
        documentRoot: documentRoot.root,
        name,
        owner: "@owner",
      });
      await vscode.window.showTextDocument(vscode.Uri.file(created.sprintPath), { preview: false });
    }),
    vscode.commands.registerCommand("afx.continueBlueprintTask", async () => {
      const blueprint = activeBlueprint;
      if (!blueprint) throw new Error("Open a saved Blueprint before continuing a Sprint.");
      const repository = await selectBoundRepository();
      if (!repository) return;
      const documentRoot = await ensureBlueprintDocumentRoot(blueprint, repository.id);
      if (!documentRoot) return;
      const sprints = await listBlueprintSprints(
        blueprint.manifest,
        blueprint.artifactRoot,
        documentRoot.root,
      );
      const selected = await vscode.window.showQuickPick(
        sprints.map((sprint) => ({ label: sprint.id, description: sprint.sprintPath, sprint })),
        { title: "Continue Blueprint Sprint" },
      );
      if (!selected) return;
      await vscode.window.showTextDocument(vscode.Uri.file(selected.sprint.sprintPath), {
        preview: false,
      });
    }),
    // @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
    // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
    vscode.commands.registerCommand("afx.openAfxPreview", (uri?: vscode.Uri) =>
      openAfxPreview(afxPreviewDeps, uri ?? vscode.window.activeTextEditor?.document.uri),
    ),
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-MOCKUP-CODELENS]
    vscode.languages.registerCodeLensProvider(
      TRACE_LANGUAGES,
      createSpecCodeLensProvider(getRoot, getExternalReferences, blueprintLensChanges.event),
    ),
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-CONTEXT-EXTRACTION]
    vscode.languages.registerHoverProvider(TRACE_LANGUAGES, createSpecHoverProvider(getRoot)),
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-NODE-RESOLUTION]
    vscode.languages.registerDefinitionProvider(
      TRACE_LANGUAGES,
      createSpecDefinitionProvider(getRoot),
    ),
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-NODE-RESOLUTION]
    vscode.languages.registerDocumentLinkProvider(
      TRACE_LANGUAGES,
      createSeeDocumentLinkProvider(getRoot),
    ),
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-NODE-ENUMERATION]
    vscode.languages.registerCompletionItemProvider(
      TRACE_LANGUAGES,
      createSeeCompletionProvider(getRoot),
      "/",
      "#",
      "[",
    ),
  );

  if (agentManager) {
    // Flow: [EditorActions.Dispatch]
    const { disposables } = createAfxCodeActionProvider(logger, agentManager, {
      sendPrompt: async (prompt) => {
        await vscode.commands.executeCommand("afx.openSidebar");
        await sidebarProvider.sendExternalPrompt(prompt);
      },
      appendDraft: async (content) => {
        await vscode.commands.executeCommand("afx.openSidebar");
        await sidebarProvider.appendToDraft(content);
      },
      saveNote: async (content) => {
        await appendNoteToWorkspace(content);
      },
    });
    for (const d of disposables) context.subscriptions.push(d);
  }

  // @see docs/specs/100-package-shared/spec.md [FR-12]
  // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
  const sprintContext = createSprintContextSync(logger, {
    onDocContextChange: (ctx) => sidebarProvider?.postActiveDocContext(ctx),
  });
  for (const d of sprintContext.disposables) context.subscriptions.push(d);

  const updateActiveSddDocumentContext = () => {
    void vscode.commands.executeCommand(
      "setContext",
      AFX_ACTIVE_SDD_DOCUMENT_CONTEXT,
      sddPrimaryActionForActiveEditor(vscode.window.activeTextEditor) != null,
    );
  };
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateActiveSddDocumentContext),
  );
  updateActiveSddDocumentContext();

  void vscode.commands.executeCommand("setContext", "afx.loaded", true);

  if (context.extensionMode !== vscode.ExtensionMode.Test) return undefined;

  return {
    getAgentStatus: () => requireAgentManager().getStatus(),
    getAgentCommands: () => requireAgentManager().getCommands(),
    sendAgentMessage: (message) => requireAgentManager().send(message),
    onAgentEvent: (listener) => requireAgentManager().onEvent(listener),
    reconfigureAgentRuntimes: (reason = "test api") => scheduleAgentRuntimeRebuild(reason),
    stopAgentRuntime: () => requireAgentManager().stop(),
    getCustomProvidersSnapshot: () => customProvidersService.getSnapshot(),
    buildCustomProvidersSpawnEnv: () => customProvidersService.buildEnvForPiSdkSpawn(),
    upsertCustomProvider: (input) =>
      customProvidersService.applyMutation({ kind: "upsertProvider", provider: input }),
    removeCustomProvider: (providerId) =>
      customProvidersService.applyMutation({ kind: "removeProvider", providerId }),
    getBlueprintState: () => ({
      attached: Boolean(activeBlueprint),
      executionContextActive: Boolean(activeExecutionContext),
      ...(activeBlueprint ? { schemaVersion: activeBlueprint.manifest.schemaVersion } : {}),
      documentRootIds: Object.keys(activeBlueprint?.binding.documentRoots ?? {}),
    }),
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

async function pickWorkspaceMode(current: WorkspaceMode): Promise<WorkspaceMode | undefined> {
  const selected = await vscode.window.showQuickPick(
    [
      {
        label: "$(circle-filled) Code",
        description: "Default. Full access. The active coding harness can act and edit.",
        value: "code" as const,
      },
      {
        label: "$(circle-filled) Explore",
        description: "Experimental. Read-only investigation mode.",
        value: "explore" as const,
      },
      {
        label: "$(circle-filled) Spec",
        description:
          "Spec-Driven Development. Refine specs, designs, tasks, and ADRs — never your source code.",
        value: "spec" as const,
      },
    ],
    {
      title: "AFX: Switch Workspace Mode",
      placeHolder: `Current: ${current}`,
      ignoreFocusOut: true,
    },
  );
  return selected?.value ?? current;
}

async function pickComposerIntent(
  mode: Extract<WorkspaceMode, "code" | "explore">,
  current: IntentSlot,
): Promise<IntentSlot | undefined> {
  const selected = await vscode.window.showQuickPick(
    ([1, 2, 3, 4] as const).map((slot) => {
      const intent = getIntentPrompt(mode, slot);
      return {
        label: `${slot === current ? "$(circle-filled)" : "$(circle-outline)"} ${intent.label}`,
        description: formatIntentTokenEstimate(intent.estimatedTokens),
        detail: intent.description,
        value: slot,
      };
    }),
    {
      title: "AFX: Switch Composer Intent",
      placeHolder: `Current: ${getIntentPrompt(mode, current).label}`,
      ignoreFocusOut: true,
    },
  );
  return selected?.value ?? current;
}

// @see docs/specs/100-package-shared/spec.md [FR-11]
function normalizeWorkspaceMode(value: string | undefined): WorkspaceMode {
  if (value === "explore") return "explore";
  if (value === "spec") return "spec";
  return "code";
}

// @see docs/specs/200-app-vscode/spec.md [FR-11]
// @see docs/specs/200-app-vscode/design.md [DES-COMMAND-CATALOG]
function formatStatusBarMode(mode: WorkspaceMode): string {
  const dot = mode === "explore" ? "🟠" : mode === "spec" ? "🟣" : "🟢";
  return `${dot} ${formatModeLabel(mode)}`;
}

function formatModeLabel(mode: WorkspaceMode): string {
  return mode === "explore" ? "Explore" : mode === "spec" ? "Spec" : "Code";
}

// @see docs/specs/200-app-vscode/spec.md [FR-11]
function formatStatusBarTooltip(mode: WorkspaceMode): string {
  const summary =
    mode === "explore"
      ? "Read-only investigation. Tool calls that would write or run shell commands are blocked."
      : mode === "spec"
        ? "Spec-Driven Development. The agent refines specs, designs, tasks, and ADRs — never your source code."
        : "Default full-access mode. The agent can read, write, and run shell commands.";
  return `AgenticFlowX — ${formatModeLabel(mode)} mode\n${summary}\n\nClick to switch (⌘⇧M / Ctrl+Shift+M).`;
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
