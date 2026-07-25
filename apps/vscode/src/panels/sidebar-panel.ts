/**
 * SidebarPanel — webview view provider that bridges the chat UI to the agent manager.
 * Routes chat/send, chat/abort, chat/newSession from the webview to the agent; streams events back.
 * Deltas are coalesced per message id and flushed at ~16ms intervals.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-1] [FR-7] [FR-9] [FR-10] [FR-11]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-LIFECYCLE] [DES-PANELS-DISPATCH] [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]
 * @see docs/specs/350-agent-manager/spec.md [FR-2] [FR-4]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-LIFECYCLE] [DES-AGENT-DIAGNOSTICS]
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-1] [FR-4]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
 * @see docs/specs/200-app-vscode/spec.md [FR-9] [FR-10] [FR-11] [FR-12] [FR-14]
 * @see docs/specs/200-app-vscode/design.md [DES-SIDEBAR-FIRST-RESPONSE-WATCHDOG]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-5] [FR-6] [FR-13]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9] [FR-10] [FR-11] [FR-12] [FR-13]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";

import { spawn } from "child_process";
import * as vscode from "vscode";

import {
  AFX_STYLE_IDS,
  AFX_THEME_IDS,
  API_PROVIDER_IDS,
  type ActiveFileContextSnapshot,
  type AgentCommand,
  type ChatCompactionView,
  type ChatMessageView,
  type ChatTimelineItem,
  PROVIDER_DETAILS,
  type SettingsOpenTarget,
  composeIntentControlBlock,
  isIntentParentMode,
  normalizeIntentSlot,
  normalizeWorkbenchViewIds,
} from "@afx/shared";
import type {
  AfxStyleId,
  AfxThemeId,
  AgentEvent,
  AgentFileView,
  AgentImageAttachment,
  AgentManager,
  AgentModel,
  AgentRuntimeModel,
  AgentRuntimeStatus,
  AgentStatus,
  AgentToChat,
  AgentUiRequest,
  AgentUiResponse,
  ChatToAgent,
  ChatToolView,
  ChatUsageView,
  CompactionResult,
  ComposerIntentState,
  FocusOption,
  IntentSlot,
  Logger,
  PhaseRow,
  ProviderAuthMethod,
  RuntimeAppearanceSnapshot,
  SettingsSnapshot,
  SignOffSummary,
  WorkbenchViewId,
  WorkspaceMode,
} from "@afx/shared";

import { type AgentRuntimeMonitor, createAgentRuntimeMonitor } from "../agent-runtime-monitor";
import {
  configurationTargetFor,
  updateAfxConfigurationWithWorkspaceFallback,
} from "../configuration-target";
import {
  MODEL_DEFAULT_SELECTION_SETTING,
  type ModelSelectionIdentityV2,
  formatModelSelectionIdentity,
  formatSdkDefaultModel,
  identityMatchesModel,
  parseLegacySdkDefaultModel,
  parseModelSelectionIdentity,
  toModelSelectionIdentity,
} from "../model-default-selection";
import type { SecretStore } from "../secret-store";
import type {
  CustomProvidersMutation,
  CustomProvidersService,
} from "../services/custom-providers-service";
import { HistoryService } from "../services/history/history-service";
import { transcriptToTimeline } from "../services/history/transcript-to-timeline";
import type { OAuthService } from "../services/oauth/oauth-service";
import { applyTasksSignOff } from "../services/tasks-signoff";
import { appendNoteToWorkspace } from "../utils/notes-utils";
import {
  type ExploreGuardrailDecision,
  classifyExploreRuntimeTool,
  classifyExploreShellCommand,
  formatExploreRuntimeBlockMessage,
} from "./explore-guardrail";
import { getAppDistPath, loadWebviewHtml } from "./webview-html";

export const SIDEBAR_VIEW_TYPE = "afx-sidebar";

export interface SidebarPanelDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  extensionVersion?: string;
  bundledAfxSkillsVersion?: string;
  bundledPiNpmVersion?: string;
  bundledSkillsPath?: string;
  /** Resolved Pi agent directory (honours PI_CODING_AGENT_DIR). Defaults to ~/.pi/agent. */
  piAgentDir?: string;
  agentManager: AgentManager;
  runtimeMonitor?: AgentRuntimeMonitor;
  logger: Logger;
  secretStore?: SecretStore;
  /**
   * Shared AFX OAuth orchestrator. Drives the Settings `oauth/*` bridge commands
   * (sign in/out, method switch, paste-code, cancel). Optional so older entry
   * points compile; absent ⇒ oauth commands report unavailable.
   *
   * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
   * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
   */
  oauthService?: OAuthService;
  /**
   * Rebuild the host-owned runtime set after OAuth credentials change. A
   * subscription-only provider (for example `openai-codex`) must create or refresh
   * the Pi SDK runtime before Settings/model-picker snapshots can include it.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-4] [FR-6]
   * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-FLOW]
   */
  reconfigureAgentRuntimes?: (reason: string) => Promise<void>;
  /** Open a markdown document in the standalone editor-area AFX preview. */
  openAfxPreview?: (uri: vscode.Uri) => void;
  /**
   * Workspace memento for one-time onboarding flags (mode-suggest, tooltips).
   *
   * @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-GUARDRAIL]
   */
  workspaceState?: vscode.Memento;
  /**
   * Custom-providers service — owns AFX-managed records (Pi SDK track) and the
   * read-only Pi RPC track display. Optional so older entry points compile.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-10]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  customProvidersService?: CustomProvidersService;
}

interface VsCodeGitChange {
  uri: vscode.Uri;
}

interface VsCodeGitRepository {
  rootUri: vscode.Uri;
  state: {
    workingTreeChanges: readonly VsCodeGitChange[];
    indexChanges: readonly VsCodeGitChange[];
    mergeChanges: readonly VsCodeGitChange[];
    /** Some Git-compatible providers expose untracked files separately. */
    untrackedChanges?: readonly VsCodeGitChange[];
  };
}

interface VsCodeGitApi {
  readonly repositories: readonly VsCodeGitRepository[];
}

interface VsCodeGitExtensionExports {
  readonly enabled: boolean;
  getAPI(version: 1): VsCodeGitApi;
}

function chatFileCandidates(filePath: string): vscode.Uri[] {
  const normalized = filePath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized)) {
    return [vscode.Uri.file(path.normalize(normalized))];
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) return [vscode.Uri.file(path.normalize(normalized))];

  const candidates: vscode.Uri[] = [];
  const seen = new Set<string>();
  const addCandidate = (folder: vscode.WorkspaceFolder, relativePath: string): void => {
    const candidate = vscode.Uri.joinPath(folder.uri, relativePath);
    const key = path.normalize(candidate.fsPath);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };
  const [prefix, ...rest] = normalized.split("/");

  for (const folder of folders) {
    const folderName = folder.name || path.basename(folder.uri.fsPath);
    if (prefix === folderName || prefix === path.basename(folder.uri.fsPath)) {
      addCandidate(folder, rest.join("/"));
    }
  }
  for (const folder of folders) {
    addCandidate(folder, normalized);
  }

  return candidates;
}

async function resolveChatFileUri(
  filePath: string,
  changedUris: readonly vscode.Uri[] = [],
): Promise<vscode.Uri> {
  const candidates = chatFileCandidates(filePath);
  const changedByPath = new Map(
    changedUris.map((uri) => [path.normalize(uri.fsPath), uri] as const),
  );
  for (const candidate of candidates) {
    const changedUri = changedByPath.get(path.normalize(candidate.fsPath));
    if (changedUri) return changedUri;
  }
  for (const candidate of candidates) {
    try {
      await vscode.workspace.fs.stat(candidate);
      return candidate;
    } catch {
      // Continue probing the remaining workspace folders.
    }
  }
  return candidates[0] ?? vscode.Uri.file(path.normalize(filePath));
}

function isUriWithinRoot(uri: vscode.Uri, rootUri: vscode.Uri): boolean {
  const relative = path.relative(path.normalize(rootUri.fsPath), path.normalize(uri.fsPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Active AFX document context payload — composer doc-actions strip trigger.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 */
export interface ActiveDocContextPayload {
  format: "sprint" | "standard" | null;
  section: "SPEC" | "DESIGN" | "TASKS" | "SESSIONS" | null;
  docKind: "spec" | "design" | "tasks" | "journal" | "adr" | "research" | "context" | null;
  feature: string | null;
  filePath?: string | null;
  approvalStatus: string | null;
  taskPhases?: PhaseRow[];
  signOff?: SignOffSummary;
  parsedFocuses?: FocusOption[];
  specStatus?: string | null;
  designStatus?: string | null;
  tasksStatus?: string | null;
  tasksCompleted?: number;
  tasksTotal?: number;
  /**
   * Work Sessions table row counts — `total` = data rows; `signed` = rows
   * with Human cell `[x]`. Powers the spec stepper's fourth Work pill label.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  workSessionsTotal?: number;
  workSessionsSigned?: number;
  /**
   * Resolved sibling SDD file paths for the spec stepper's per-pill
   * click-to-open. Populated by sprint-context.ts only for files that exist
   * on disk; missing entries render the corresponding pill as disabled.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  siblingPaths?: { spec?: string; design?: string; tasks?: string; journal?: string };
  /**
   * 1-indexed in-file section heading lines for the spec stepper. Sprint files
   * populate spec/design/tasks/sessions; standard tasks.md populates only
   * `sessions`.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  sectionOffsets?: { spec?: number; design?: number; tasks?: number; sessions?: number };
}

export interface SidebarPanelProvider extends vscode.WebviewViewProvider {
  sendExternalPrompt(content: string): Promise<void>;
  appendToDraft(content: string): Promise<void>;
  openSettingsTarget(target: SettingsOpenTarget): Promise<void>;
  refreshRuntimeConfiguration(): Promise<void>;
  /**
   * Push the active AFX document context to the chat webview so it can render
   * the doc-actions or mode-suggest strip variants.
   *
   * @see docs/specs/100-package-shared/spec.md [FR-12]
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
   */
  postActiveDocContext(payload: ActiveDocContextPayload): void;
  /**
   * Recompute the custom-models snapshot fragment and broadcast a fresh
   * `agent/settingsSnapshot`. Called by the host when SecretStorage changes
   * for `afx.customProvider.*` or when the hand-edited `~/.pi/agent/models.json`
   * file watcher fires.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-10]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  refreshCustomModelsSnapshot(): Promise<void>;
}

interface SidebarState {
  isStreaming: boolean;
  /** Host-side lock for manual compaction requests until Pi resolves compact(). */
  isCompacting: boolean;
  messages: ChatTimelineItem[];
  tools: ChatToolView[];
  /** id of the assistant message currently being streamed, if any. */
  currentAssistantId: string | null;
  /** Runtime event id associated with the current assistant stream, when known. */
  currentAssistantSourceId: string | null;
  /** Last assistant message id completed in the active run, used for usage attribution. */
  lastAssistantId: string | null;
  /** requestId from the active send, so errors can be attributed. */
  currentRequestId: string | null;
  /** Last session totals snapshot for per-turn usage diffing. */
  lastUsageTotals: ChatUsageView | null;
  /** Suppress the runtime echo for the normal prompt, which the host renders optimistically. */
  suppressNextUserMessageStart: boolean;
  /** Whether the active send produced a response-bearing runtime event before the start timeout. */
  currentTurnSawRuntimeEvent: boolean;
}

interface QueuedUserDisplay {
  content: string;
}

interface StagedImageAttachment {
  id: string;
  name: string;
  mediaType: string;
  byteLength: number;
  image: AgentImageAttachment;
}

type ErrorPresentation = "transcript" | "toast" | "settings-toast";

const DELTA_FLUSH_MS = 16;
const RESPONSE_START_TIMEOUT_DEFAULT_MS = 60_000;
const RESPONSE_START_TIMEOUT_MIN_MS = 5_000;
const RESPONSE_START_TIMEOUT_MAX_MS = 600_000;
const OVERFLOW_RECOVERY_GRACE_MS = 1_500;
const OAUTH_PROACTIVE_REFRESH_LEAD_MS = 5 * 60 * 1000;
const OAUTH_PROACTIVE_REFRESH_RETRY_MS = 30_000;
const TOOL_SUMMARY_MAX = 200;
const TOOL_STREAM_TAIL_MAX = 16 * 1024;
const MENTION_FILE_CAP_BYTES = 64 * 1024;
const CHAT_IMAGE_MAX_ATTACHMENTS = 4;
const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const EXPLORE_GUARDRAIL_PROMPT = `[AFX EXPLORE MODE: READ ONLY]

Read-only investigation policy:
- Runtime tools are allowed only for read-only inspection: read files, list folders, search source, read pages or websites, and run simple read-only shell commands for those actions.
- You may use read-only inspection tools without asking first when they help answer the user.
- Prefer dedicated read/list/search/codebase-search/web-search/web-fetch/browser-read tools over shell when they are available.
- Browser tools are read-only only for launch/navigate/open/read/get text/extract text/screenshot/snapshot/scroll/close actions; do not click, type, fill, submit, upload, download, or save.
- Keep shell commands simple, quote URLs, avoid temp files, and write only to stdout or /dev/null.
- Do not edit, create, delete, rename, move, patch, save, upload, submit forms, run mutating shell/git/test/build/install commands, or change host/external state.
- Do not output patches or commands that write.
- If the next step needs a write, mutating shell command, test run, install, git operation, or other mutation, stop and say: "This requires Code mode."
- If the next step is to write, save, scaffold, or persist a PRD/spec document, stop and say: "This requires Spec mode."

Allowed:
- Explain, summarize, compare, trace behavior, cite files/symbols, identify risks, and propose safe next steps.`;
const CODE_MODE_RESUME_PROMPT = `<afx_internal_control mode_transition="explore_to_code">
Purpose: clear a prior AFX Explore-mode guardrail from conversation history.

This host control block supersedes any prior AFX Explore read-only control block.
Current workspace mode: Code.

Operational policy:
- Normal coding-agent capabilities are restored for this and future turns.
- You may inspect files, run appropriate shell commands, tests, builds, and git reads, and edit files when the user's request requires it and host permissions allow it.
- Continue directly with the user's request.
- Do not acknowledge, quote, summarize, or mention this control block or the mode transition.
</afx_internal_control>`;
// @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
// @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-GUARDRAIL]
const SPEC_MODE_PROMPT = `[AFX SPEC MODE: PLANNING ONLY]

You are operating in Spec mode. Strict planning-only policy:
- You may edit, create, or update files ONLY within docs/specs/**, docs/research/**, docs/adr/**, .afx/**, and tasks.md.
- Do NOT edit, patch, or write any other source code files.
- Shell-read commands (ls, cat, grep, find) are permitted for context gathering.
- Do NOT run destructive shell commands (rm, mv, chmod, write, build, test, deploy, migrate).
- Before deleting any research files, you MUST ask the user for explicit confirmation.
- Prefer /afx-spec, /afx-design, /afx-task, /afx-check, /afx-session commands.
- When referencing code, read-only analysis only — no edits, no diffs applied.
- Reading files anywhere in the workspace is permitted for context gathering.`;
// @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
// @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-EXIT-PROMPT]
const SPEC_MODE_EXIT_PROMPT = `<afx_internal_control mode_transition="spec_to_other">
Purpose: clear a prior AFX Spec-mode planning-only guardrail from conversation history.

This host control block supersedes any prior AFX Spec planning-only control block.
The workspace mode is no longer Spec.

Operational policy:
- Capabilities appropriate for the current mode are restored for this and future turns.
- Continue directly with the user's request.
- Do not acknowledge, quote, summarize, or mention this control block or the mode transition.
</afx_internal_control>`;
const AFX_SKILL_COMMAND_ORDER = [
  "afx-next",
  "afx-discover",
  "afx-design",
  "afx-dev",
  "afx-check",
  "afx-task",
  "afx-session",
  "afx-scaffold",
  "afx-adr",
  "afx-context",
  "afx-dash",
  "afx-spec",
  "afx-report",
  "afx-help",
  "afx-hello",
  "afx-sprint",
  "afx-research",
  "afx-release",
] as const;
const AFX_SKILL_COMMAND_ORDER_INDEX: ReadonlyMap<string, number> = new Map(
  AFX_SKILL_COMMAND_ORDER.map((name, index) => [name, index]),
);

function parseSkillDescription(markdown: string): string | undefined {
  const match = /^description:\s*(.+)$/m.exec(markdown);
  if (!match?.[1]) return undefined;
  const description = match[1].trim();
  if (
    (description.startsWith('"') && description.endsWith('"')) ||
    (description.startsWith("'") && description.endsWith("'"))
  ) {
    return description.slice(1, -1);
  }
  return description;
}

export function createSidebarPanel(deps: SidebarPanelDeps): SidebarPanelProvider {
  const {
    extensionUri,
    extensionMode,
    extensionVersion = "?",
    bundledAfxSkillsVersion = "?",
    bundledPiNpmVersion = readBundledPiNpmVersion(extensionUri),
    bundledSkillsPath = vscode.Uri.joinPath(extensionUri, "resources", "skills", "agenticflowx")
      .fsPath,
    piAgentDir = path.join(homedir(), ".pi", "agent"),
    agentManager,
    runtimeMonitor: providedRuntimeMonitor,
    logger: parentLogger,
    secretStore,
    oauthService,
    reconfigureAgentRuntimes,
    openAfxPreview,
    customProvidersService,
  } = deps;
  const log = parentLogger.child("sidebar");
  const runtimeMonitor =
    providedRuntimeMonitor ?? createAgentRuntimeMonitor({ agentManager, logger: parentLogger });
  // History — persistent sessions + read-only transcript + reopen.
  // @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16]
  // @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-STORE]
  const historyService = new HistoryService(agentManager, parentLogger);

  const state: SidebarState = {
    isStreaming: false,
    isCompacting: false,
    messages: [],
    tools: [],
    currentAssistantId: null,
    currentAssistantSourceId: null,
    lastAssistantId: null,
    currentRequestId: null,
    lastUsageTotals: null,
    suppressNextUserMessageStart: false,
    currentTurnSawRuntimeEvent: false,
  };
  let currentModel: AgentRuntimeModel | undefined;
  // Keep the requested posture in memory while the workspace setting write is in flight so
  // a same-tick send uses the newly selected mode instead of the previous one.
  // We clear it once the persisted settings snapshot catches up.
  let workspaceModeOverride: WorkspaceMode | null = null;
  let codeModeResetPending = false;
  // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-EXIT-PROMPT]
  let specModeResetPending = false;
  // @see docs/specs/100-package-shared/spec.md [FR-12]
  let lastActiveDocContext: ActiveDocContextPayload = {
    format: null,
    section: null,
    docKind: null,
    feature: null,
    filePath: null,
    approvalStatus: null,
  };
  let suppressRuntimeEventsUntilAgentEnd = false;
  let bundledSkillCountCache: number | null = null;
  let bundledSkillCommandsCache: AgentCommand[] | null = null;
  const blockedExploreToolCallIds = new Set<string>();
  const queuedUserDisplays: QueuedUserDisplay[] = [];
  let queueInjectionChain: Promise<void> = Promise.resolve();
  let queueInjectionEpoch = 0;
  const stagedImageAttachments = new Map<string, StagedImageAttachment>();

  /**
   * Serializes streaming queue injections so rapid steer/follow-up submissions
   * reach the runtime in the same order the composer sent them.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-4] [FR-8]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-QUEUE]
   */
  function enqueueQueueInjection(work: (epoch: number) => Promise<void>): Promise<void> {
    const epoch = queueInjectionEpoch;
    const run = () => (epoch === queueInjectionEpoch ? work(epoch) : Promise.resolve());
    const next = queueInjectionChain.then(run, run);
    queueInjectionChain = next.catch(() => undefined);
    return next;
  }

  // Pending delta text per message id; flushed on a single RAF-like timer.
  const pendingDeltas = new Map<string, string>();
  let flushTimer: NodeJS.Timeout | null = null;
  let turnStartTimeout: NodeJS.Timeout | null = null;
  let overflowRecoveryTimeout: NodeJS.Timeout | null = null;
  let retryRecoveryTimeout: NodeJS.Timeout | null = null;
  let pendingContextOverflowError: string | null = null;
  let pendingRetryableError: string | null = null;
  let retryToastRequestId: string | null = null;
  let modelRestoreAttempted = false;
  let oauthRefreshTimer: NodeJS.Timeout | null = null;
  let oauthRefreshInFlight = false;

  // Some adapters print fatal errors to stderr (e.g. provider 4xx) instead of
  // emitting a normalized `error` event. We line-buffer that stream so the user
  // sees the failure in chat instead of an indefinite spinner.
  let stderrLineBuf = "";
  let errorPostedThisTurn = false;
  let postedRestartRequiredInfo: string | null = null;

  /**
   * Reactive auth-error recovery (one per turn). When the runtime reports a
   * provider auth failure, the host restarts the runtime once — the respawn
   * re-resolves credentials via getSelectedProviderKey (refresh-on-read), so no
   * explicit refresh call is needed — then retries the failed turn exactly once.
   * A second consecutive auth_error in the same turn fails closed (no silent
   * cross-method fallback).
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   */
  let authRecoveryAttempted = false;
  let lastTurnSend: {
    content: string;
    mentions: readonly string[];
    intentSlot?: IntentSlot;
    images?: readonly AgentImageAttachment[];
  } | null = null;

  let webview: vscode.Webview | null = null;
  let chatReady = false;
  const pendingDraftMutations: Array<
    { type: "chat/draftAppend"; content: string } | { type: "chat/draftSet"; content: string }
  > = [];
  const pendingSettingsTargets: SettingsOpenTarget[] = [];
  const pendingToasts: Array<{
    tone: "success" | "info" | "error";
    message: string;
    description?: string;
    durationMs?: number;
  }> = [];

  function post(msg: AgentToChat): void {
    webview?.postMessage(msg);
  }

  /**
   * Drive the Settings `oauth/*` bridge commands through the shared OAuthService.
   * Only redacted `oauth/progress` / `oauth/status` reach the webview — never a
   * token, refresh value, or redirect URL. On any failure the card is
   * told via `oauth/status { ok: false }` plus a non-secret message.
   *
   * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
   * @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
   */
  async function handleOAuthCommand(
    msg: Extract<ChatToAgent, { type: `oauth/${string}` }>,
  ): Promise<void> {
    const { provider, requestId } = msg;
    if (!oauthService) {
      post({
        type: "oauth/status",
        requestId,
        ok: false,
        status: { provider, connected: false },
        error: "Sign-in is unavailable in this window.",
      });
      return;
    }
    try {
      switch (msg.type) {
        case "oauth/signIn": {
          post({ type: "oauth/progress", requestId, provider, phase: "starting" });
          const status = await oauthService.signIn(provider, {
            onAuthUrl: ({ url, proactivePaste }) => {
              void vscode.env.openExternal(vscode.Uri.parse(url));
              post({
                type: "oauth/progress",
                requestId,
                provider,
                phase: proactivePaste ? "paste-code" : "awaiting-browser",
              });
            },
            onUserCode: ({ userCode, verificationUri }) => {
              void vscode.env.openExternal(vscode.Uri.parse(verificationUri));
              post({
                type: "oauth/progress",
                requestId,
                provider,
                phase: "device-code",
                userCode,
                verificationUri,
              });
            },
            onProgress: (message) => {
              post({ type: "oauth/progress", requestId, provider, phase: "exchanging", message });
            },
            enterpriseInput: msg.enterpriseDomain,
          });
          post({ type: "oauth/progress", requestId, provider, phase: "done" });
          post({ type: "oauth/status", requestId, ok: true, status });
          void scheduleOAuthProactiveRefresh();
          await refreshAfterOAuthCredentialChange(requestId, `OAuth sign-in for ${provider}`);
          return;
        }
        case "oauth/signOut": {
          const status = await oauthService.signOut(provider);
          post({ type: "oauth/status", requestId, ok: true, status });
          void scheduleOAuthProactiveRefresh();
          await refreshAfterOAuthCredentialChange(requestId, `OAuth sign-out for ${provider}`);
          return;
        }
        case "oauth/setAuthMethod": {
          await oauthService.setAuthMethod(provider, msg.method);
          const status = await oauthService.getStatus(provider);
          post({ type: "oauth/status", requestId, ok: true, status });
          void scheduleOAuthProactiveRefresh();
          await refreshAfterOAuthCredentialChange(
            requestId,
            `OAuth active method changed for ${provider}`,
          );
          return;
        }
        case "oauth/submitCode": {
          oauthService.submitCode(provider, msg.code);
          return;
        }
        case "oauth/cancel": {
          oauthService.cancel(provider);
          post({ type: "oauth/progress", requestId, provider, phase: "cancelled" });
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      const status = await oauthService
        .getStatus(provider)
        .catch(() => ({ provider, connected: false }));
      post({ type: "oauth/progress", requestId, provider, phase: "error", message });
      post({ type: "oauth/status", requestId, ok: false, status, error: message });
    }
  }

  async function refreshAfterOAuthCredentialChange(
    requestId: string,
    reason: string,
  ): Promise<void> {
    try {
      await reconfigureAgentRuntimes?.(reason);
    } catch (err) {
      log.error("oauth runtime refresh failed", err instanceof Error ? err : undefined, {
        reason,
      });
      postError(
        requestId,
        `Subscription was updated, but the agent runtime did not refresh: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "settings-toast",
      );
    }
    await handleGetSettingsSnapshot(requestId);
    await postAvailableModels(requestId, { reportErrors: false });
  }

  function clearOAuthRefreshTimer(): void {
    if (!oauthRefreshTimer) return;
    clearTimeout(oauthRefreshTimer);
    oauthRefreshTimer = null;
  }

  function scheduleOAuthProactiveRefreshRetry(): void {
    clearOAuthRefreshTimer();
    oauthRefreshTimer = setTimeout(() => {
      oauthRefreshTimer = null;
      void performOAuthProactiveRefresh();
    }, OAUTH_PROACTIVE_REFRESH_RETRY_MS);
    oauthRefreshTimer.unref?.();
  }

  /**
   * Schedules a pre-expiry refresh for AFX-owned SDK OAuth records. The timer
   * only handles idle restarts; active streams still use the reactive auth-error
   * recovery path so in-flight turns are not interrupted.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   */
  async function scheduleOAuthProactiveRefresh(): Promise<void> {
    clearOAuthRefreshTimer();
    if (!secretStore || !oauthService) return;
    try {
      const now = Date.now();
      const providers = await secretStore.listOAuthProviders();
      let nextDelay: number | undefined;
      for (const provider of providers) {
        const normalized = normalizeProviderId(provider);
        const details = PROVIDER_DETAILS[normalized];
        if (!details?.oauthCapable) continue;
        const record = await secretStore.getOAuth(normalized);
        if (!record) continue;
        const activeMethod = await secretStore.getAuthMethod(normalized);
        if (activeMethod && activeMethod !== "subscription") continue;
        const delay = Math.max(0, record.expires - now - OAUTH_PROACTIVE_REFRESH_LEAD_MS);
        nextDelay = nextDelay === undefined ? delay : Math.min(nextDelay, delay);
      }
      if (nextDelay === undefined) return;
      oauthRefreshTimer = setTimeout(() => {
        oauthRefreshTimer = null;
        void performOAuthProactiveRefresh();
      }, nextDelay);
      oauthRefreshTimer.unref?.();
    } catch (err) {
      log.warn("oauth proactive refresh scheduling failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function performOAuthProactiveRefresh(): Promise<void> {
    if (!secretStore || !oauthService || oauthRefreshInFlight) return;
    if (state.isStreaming) {
      scheduleOAuthProactiveRefreshRetry();
      return;
    }

    oauthRefreshInFlight = true;
    let refreshedAny = false;
    let refreshFailed = false;
    try {
      const now = Date.now();
      const providers = await secretStore.listOAuthProviders();
      for (const provider of providers) {
        const normalized = normalizeProviderId(provider);
        const details = PROVIDER_DETAILS[normalized];
        if (!details?.oauthCapable) continue;
        const record = await secretStore.getOAuth(normalized);
        if (!record || record.expires - now > OAUTH_PROACTIVE_REFRESH_LEAD_MS) continue;
        const activeMethod = await secretStore.getAuthMethod(normalized);
        if (activeMethod && activeMethod !== "subscription") continue;
        const token = await oauthService.refreshAccessToken(normalized);
        if (token) {
          refreshedAny = true;
        } else {
          refreshFailed = true;
        }
      }
      if (refreshedAny && !state.isStreaming) {
        postChatToast({
          tone: "info",
          message: "Refreshing provider sign-in",
          description: "AFX is reconnecting the SDK runtime before the next turn.",
          durationMs: 4_000,
        });
        await runtimeMonitor.restart("oauth-proactive-refresh");
      }
    } finally {
      oauthRefreshInFlight = false;
      if (refreshFailed) {
        scheduleOAuthProactiveRefreshRetry();
      } else {
        void scheduleOAuthProactiveRefresh();
      }
    }
  }

  function includeActiveFileContext(): boolean {
    return vscode.workspace
      .getConfiguration("afx")
      .get<boolean>("context.includeActiveFileContext", true);
  }

  function workspaceMode(): WorkspaceMode {
    if (workspaceModeOverride) return workspaceModeOverride;
    const value = vscode.workspace.getConfiguration("afx").get<string>("mode.active", "code");
    if (value === "explore") return "explore";
    if (value === "spec") return "spec";
    return "code";
  }

  function persistedWorkspaceMode(): WorkspaceMode {
    const value = vscode.workspace.getConfiguration("afx").get<string>("mode.active", "code");
    if (value === "explore") return "explore";
    if (value === "spec") return "spec";
    return "code";
  }

  function intentSlotSetting(): IntentSlot {
    return normalizeIntentSlot(
      vscode.workspace.getConfiguration("afx").get<number>("composer.intent.slot", 1),
    );
  }

  function intentMinimizedSetting(): boolean {
    return vscode.workspace
      .getConfiguration("afx")
      .get<boolean>("composer.intent.minimized", false);
  }

  function intentSettingsSnapshot(): SettingsSnapshot["intent"] {
    const cfg = vscode.workspace.getConfiguration("afx");
    const slotInspect = cfg.inspect<number>("composer.intent.slot");
    const minimizedInspect = cfg.inspect<boolean>("composer.intent.minimized");
    const workspace: Partial<ComposerIntentState> = {};
    if (slotInspect?.workspaceValue !== undefined) {
      workspace.slot = normalizeIntentSlot(slotInspect.workspaceValue);
    }
    if (minimizedInspect?.workspaceValue !== undefined) {
      workspace.minimized = minimizedInspect.workspaceValue === true;
    }
    const hasWorkspaceOverride = Object.keys(workspace).length > 0;
    return {
      effective: {
        slot: intentSlotSetting(),
        minimized: intentMinimizedSetting(),
      },
      global: {
        slot: normalizeIntentSlot(slotInspect?.globalValue ?? 1),
        minimized: minimizedInspect?.globalValue === true,
      },
      workspace: hasWorkspaceOverride ? workspace : undefined,
      hasWorkspaceOverride,
    };
  }

  function isExploreMode(): boolean {
    return workspaceMode() === "explore";
  }

  /**
   * Captures the active editor file for the composer label.
   *
   * @see docs/specs/200-app-vscode/spec.md [FR-10]
   * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
   */
  function getActiveFileContextSnapshot(): ActiveFileContextSnapshot | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") return null;
    const filePath = editor.document.uri.fsPath;
    return {
      name: path.basename(filePath),
      path: filePath,
    };
  }

  /**
   * Pushes the current active-file label to the webview so the composer can
   * render the filename + hover tooltip.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-11]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
   */
  function postActiveFileContext(): void {
    if (!webview || !chatReady) return;
    post({ type: "agent/activeFileContext", snapshot: getActiveFileContextSnapshot() });
  }

  function getActiveWorkspaceFileMention(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") return null;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return null;
    const relative = path.relative(root, editor.document.uri.fsPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return relative.split(path.sep).join("/");
  }

  function normalizePromptMentions(content: string, mentions: readonly string[] = []): string[] {
    const normalized = normalizeMentions(content, mentions);
    if (!includeActiveFileContext()) return normalized;
    const activeFile = getActiveWorkspaceFileMention();
    if (!activeFile) return normalized;
    return Array.from(new Set([activeFile, ...normalized]));
  }

  function prefixWorkspaceModePrompt(content: string, intentSlot?: IntentSlot): string {
    // @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-EXIT-PROMPT]
    //
    // Layer reset prompts BEFORE the active mode's guardrail. Without this,
    // a spec→explore transition would emit only the explore guardrail and
    // drop SPEC_MODE_EXIT_PROMPT, so the agent would stay in spec posture
    // for one more turn even after the user switched.
    let prefix = "";
    if (specModeResetPending) {
      specModeResetPending = false;
      prefix = `${SPEC_MODE_EXIT_PROMPT}\n\n`;
    }
    const mode = workspaceMode();
    const activeIntentSlot = normalizeIntentSlot(intentSlot ?? intentSlotSetting());
    const intentBlock = isIntentParentMode(mode)
      ? composeIntentControlBlock(mode, activeIntentSlot)
      : null;
    const suffix = intentBlock ? `\n\n${intentBlock}\n\n${content}` : `\n\n${content}`;
    if (mode === "explore") return `${prefix}${EXPLORE_GUARDRAIL_PROMPT}${suffix}`;
    if (mode === "spec") return `${prefix}${SPEC_MODE_PROMPT}\n\n${content}`;
    if (codeModeResetPending) {
      codeModeResetPending = false;
      const codeContent = intentBlock ? `${intentBlock}\n\n${content}` : content;
      return `${prefix}${CODE_MODE_RESUME_PROMPT}\n\n${codeContent}`;
    }
    if (intentBlock) return `${prefix}${intentBlock}\n\n${content}`;
    return prefix ? `${prefix}${content}` : content;
  }

  function computeTelemetryState(): {
    enabled: boolean;
    source: "enabled" | "disabledBySetting" | "disabledByVscodeTelemetry";
  } {
    const cfg = vscode.workspace.getConfiguration("afx");
    const enabledBySetting = cfg.get<boolean>("telemetry.enabled", true);
    if (!enabledBySetting) return { enabled: false, source: "disabledBySetting" };
    if (!vscode.env.isTelemetryEnabled)
      return { enabled: false, source: "disabledByVscodeTelemetry" };
    return { enabled: true, source: "enabled" };
  }

  function postTelemetryState(): void {
    if (!webview || !chatReady) return;
    post({ type: "agent/telemetryState", ...computeTelemetryState() });
  }

  function markChatReady(): void {
    chatReady = true;
    flushPendingDraftMutations();
    flushPendingSettingsTargets();
    flushPendingToasts();
    postTelemetryState();
    void scheduleOAuthProactiveRefresh();
  }

  function flushPendingDraftMutations(): void {
    if (!webview || !chatReady) return;
    if (pendingDraftMutations.length === 0) return;
    for (const mutation of pendingDraftMutations.splice(0, pendingDraftMutations.length)) {
      post(mutation);
    }
  }

  function flushPendingSettingsTargets(): void {
    if (!webview || !chatReady) return;
    if (pendingSettingsTargets.length === 0) return;
    const target = pendingSettingsTargets.pop();
    pendingSettingsTargets.length = 0;
    if (!target) return;
    post({ type: "settings/openTarget", target });
  }

  function flushPendingToasts(): void {
    if (!webview || !chatReady) return;
    if (pendingToasts.length === 0) return;
    for (const payload of pendingToasts.splice(0, pendingToasts.length)) {
      post({ type: "chat/toast", ...payload });
    }
  }

  function postChatToast(payload: {
    tone: "success" | "info" | "error";
    message: string;
    description?: string;
    durationMs?: number;
    cancelableRetry?: boolean;
  }): void {
    if (!webview || !chatReady) {
      pendingToasts.push(payload);
      return;
    }
    post({ type: "chat/toast", ...payload });
  }

  function postRuntimeStatus(status: AgentRuntimeStatus, requestId?: string): void {
    currentModel = status.model ?? currentModel;
    post({ type: "agent/status", requestId, status });
    maybePostRestartRequiredStatusError(status, requestId);
  }

  function recordRuntimeStatus(status: AgentStatus, requestId?: string): void {
    runtimeMonitor.record(
      {
        ...status,
        model: status.model ?? currentModel,
      },
      requestId,
    );
  }

  function postError(
    requestId: string | undefined,
    message: string,
    presentation: ErrorPresentation,
  ): void {
    log.error(message, { requestId });
    if (presentation === "transcript") {
      appendErrorMessage(message);
    }
    post({
      type: "chat/error",
      requestId,
      message,
      displayInTranscript: false,
      showToast: presentation !== "settings-toast",
    });
  }

  function appendErrorMessage(message: string): void {
    const id = cryptoRandom();
    const createdAt = Date.now();
    const content = `⚠ ${message}`;
    state.messages.push({
      id,
      role: "assistant",
      content,
      createdAt,
      streaming: false,
      stopReason: "error",
    });
    post({ type: "chat/messageStart", id, role: "assistant", createdAt, content });
    post({ type: "chat/messageEnd", id, stopReason: "error" });
  }

  function hasConversationTranscript(): boolean {
    return state.messages.some((message) => {
      if (message.role !== "assistant") return true;
      return "stopReason" in message && message.stopReason !== "info";
    });
  }

  function appendInfoMessage(message: string): void {
    // Keep fresh sessions truly empty so the chat webview can render its
    // onboarding/welcome surface. Mode/model controls already reflect their
    // selected values; transcript info rows are only useful once a real
    // conversation exists to annotate.
    if (!hasConversationTranscript()) return;

    const id = cryptoRandom();
    const createdAt = Date.now();
    const content = `ℹ ${message}`;
    state.messages.push({
      id,
      role: "assistant",
      content,
      createdAt,
      streaming: false,
      stopReason: "info",
    });
    post({ type: "chat/messageStart", id, role: "assistant", createdAt, content });
    post({ type: "chat/messageEnd", id, stopReason: "info" });
  }

  function appendCompactionSummary(result: CompactionResult): void {
    const compactionMsg: ChatCompactionView = {
      id: `compaction-${Date.now()}`,
      role: "compactionSummary",
      summary: result.summary || "Session history compacted.",
      tokensBefore: result.tokensBefore,
      estimatedTokensAfter: result.estimatedTokensAfter,
      createdAt: Date.now(),
    };
    state.messages.push(compactionMsg);
    postSnapshot();
  }

  function clearTurnStartTimeout(): void {
    if (!turnStartTimeout) return;
    clearTimeout(turnStartTimeout);
    turnStartTimeout = null;
  }

  function clearOverflowRecoveryTimeout(): void {
    if (!overflowRecoveryTimeout) return;
    clearTimeout(overflowRecoveryTimeout);
    overflowRecoveryTimeout = null;
  }

  function clearPendingContextOverflow(): void {
    pendingContextOverflowError = null;
    clearOverflowRecoveryTimeout();
  }

  function clearRetryRecoveryTimeout(): void {
    if (!retryRecoveryTimeout) return;
    clearTimeout(retryRecoveryTimeout);
    retryRecoveryTimeout = null;
  }

  function clearPendingRetryableError(): void {
    pendingRetryableError = null;
    retryToastRequestId = null;
    clearRetryRecoveryTimeout();
  }

  function clearStreamingState(stopReason?: string): string | null {
    clearTurnStartTimeout();
    clearPendingContextOverflow();
    clearPendingRetryableError();
    const finishedId = finishCurrentAssistant(stopReason);
    state.isStreaming = false;
    state.currentRequestId = null;
    state.suppressNextUserMessageStart = false;
    state.currentTurnSawRuntimeEvent = false;
    return finishedId;
  }

  function clearStreamingStateForRestart(): void {
    const shouldPostSnapshot =
      state.isStreaming ||
      state.isCompacting ||
      state.currentAssistantId !== null ||
      state.currentRequestId !== null ||
      queuedUserDisplays.length > 0 ||
      pendingDeltas.size > 0 ||
      pendingContextOverflowError !== null ||
      pendingRetryableError !== null;

    queueInjectionEpoch += 1;
    queueInjectionChain = Promise.resolve();
    clearStreamingState("interrupt");
    state.isCompacting = false;
    queuedUserDisplays.length = 0;
    pendingDeltas.clear();
    suppressRuntimeEventsUntilAgentEnd = false;
    blockedExploreToolCallIds.clear();
    errorPostedThisTurn = false;

    if (shouldPostSnapshot) {
      postSnapshot();
    }
  }

  function failActiveTurn(requestId: string | undefined, message: string): void {
    if (!errorPostedThisTurn) {
      errorPostedThisTurn = true;
      postError(requestId, message, "transcript");
    }
    clearStreamingState("error");
    recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
  }

  /**
   * Reactive auth-error recovery. For an AFX-managed provider, the first auth
   * failure in a turn restarts the runtime once through the single restart owner
   * (`runtimeMonitor.restart`) — the respawn re-resolves credentials via
   * getSelectedProviderKey (refresh-on-read), so no explicit refresh call is
   * needed — then replays the failed prompt exactly once. External runtimes own
   * their credentials, so they fail closed with runtime-specific sign-in guidance
   * instead of claiming that an AFX refresh can repair them. A second consecutive
   * managed auth_error, or a missing replayable prompt, also fails closed with no
   * silent cross-method fallback.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   */
  function recoverFromAuthError(evt: Extract<AgentEvent, { type: "auth_error" }>): void {
    const requestId = state.currentRequestId ?? undefined;
    clearTurnStartTimeout();

    if (currentModel?.source === "external-agent") {
      const runtimeLabel =
        currentModel.instanceLabel ?? currentModel.instanceId ?? "External agent";
      const remediation =
        currentModel.instanceId === "pi"
          ? piAuthFailureRemediation(runtimeLabel, currentModel.provider)
          : `Authentication failed in ${runtimeLabel}. This external runtime owns its credentials; AFX Settings sign-in does not apply. Sign in through ${runtimeLabel}, then retry — or switch the model picker to a model under API Providers.`;
      failActiveTurn(requestId, `${evt.message}\n\n${remediation}`);
      return;
    }

    // Second consecutive auth failure in the same turn, or nothing to replay:
    // fail closed and prompt for the failing method rather than retry forever.
    if (authRecoveryAttempted || !lastTurnSend) {
      failActiveTurn(requestId, evt.message);
      return;
    }

    authRecoveryAttempted = true;
    const replay = lastTurnSend;
    postChatToast({
      tone: "info",
      message: "Reconnecting your provider",
      description: "Your sign-in expired. Refreshing access and retrying this message once.",
      durationMs: 4_000,
    });

    void (async () => {
      try {
        // Clear the failed turn's streaming/lock state so the replay isn't
        // rejected by the in-flight guard; preserves the transcript so far.
        clearStreamingState("interrupt");
        // Restart re-resolves credentials on the respawn (refresh-on-read).
        await runtimeMonitor.restart(requestId);
        // Replay the prompt without re-echoing the user message that is
        // already in the transcript.
        await handleSend(
          requestId ?? cryptoRandom(),
          replay.content,
          replay.mentions,
          replay.intentSlot,
          { isAuthRetry: true },
        );
      } catch (err) {
        eventLog.error("auth-error recovery failed", err instanceof Error ? err : undefined);
        failActiveTurn(requestId, evt.message);
      }
    })();
  }

  /**
   * @see docs/specs/200-app-vscode/spec.md [FR-14]
   * @see docs/specs/200-app-vscode/design.md [DES-SIDEBAR-FIRST-RESPONSE-WATCHDOG]
   */
  function responseStartTimeoutMs(): number {
    const raw = vscode.workspace
      .getConfiguration("afx")
      .get<number>("runtime.responseStartTimeoutMs", RESPONSE_START_TIMEOUT_DEFAULT_MS);
    if (!Number.isFinite(raw)) return RESPONSE_START_TIMEOUT_DEFAULT_MS;
    return Math.max(
      RESPONSE_START_TIMEOUT_MIN_MS,
      Math.min(RESPONSE_START_TIMEOUT_MAX_MS, Math.trunc(raw)),
    );
  }

  /**
   * `agent_start` only means the runtime accepted the prompt. If no response-bearing
   * event arrives in time, warn once but keep the turn alive for slow model warm-up.
   *
   * @see docs/specs/200-app-vscode/spec.md [FR-14]
   * @see docs/specs/200-app-vscode/design.md [DES-SIDEBAR-FIRST-RESPONSE-WATCHDOG]
   */
  function scheduleTurnStartTimeout(requestId: string): void {
    clearTurnStartTimeout();
    const timeoutMs = responseStartTimeoutMs();
    turnStartTimeout = setTimeout(() => {
      turnStartTimeout = null;
      if (
        state.currentRequestId !== requestId ||
        !state.isStreaming ||
        state.currentTurnSawRuntimeEvent
      ) {
        return;
      }
      log.warn("first model response is still pending", { requestId, timeoutMs });
      postChatToast({
        tone: "info",
        message: "Still waiting for the model",
        description:
          "The provider accepted the prompt but has not emitted output yet. Some providers, proxies, or cold models can take longer before the first token.",
        durationMs: 8_000,
      });
    }, timeoutMs);
    turnStartTimeout.unref?.();
  }

  function scheduleOverflowRecoveryTimeout(requestId: string | undefined): void {
    clearOverflowRecoveryTimeout();
    overflowRecoveryTimeout = setTimeout(() => {
      const message =
        pendingContextOverflowError ??
        "The selected provider reported that the prompt exceeds the model context window.";
      pendingContextOverflowError = null;
      overflowRecoveryTimeout = null;
      failActiveTurn(requestId, message);
    }, OVERFLOW_RECOVERY_GRACE_MS);
    overflowRecoveryTimeout.unref?.();
  }

  function scheduleRetryRecoveryTimeout(requestId: string | undefined): void {
    clearRetryRecoveryTimeout();
    retryRecoveryTimeout = setTimeout(() => {
      const message =
        pendingRetryableError ??
        "The selected provider returned a transient error and did not retry.";
      pendingRetryableError = null;
      retryRecoveryTimeout = null;
      failActiveTurn(requestId, message);
    }, OVERFLOW_RECOVERY_GRACE_MS);
    retryRecoveryTimeout.unref?.();
  }

  function maybePostRestartRequiredStatusError(
    status: AgentRuntimeStatus,
    requestId?: string,
  ): void {
    if (!status.restartRequired) {
      postedRestartRequiredInfo = null;
      return;
    }

    const message =
      status.info ??
      "Agent runtime failed to start repeatedly. Automatic retries are stopped; use Restart agent after fixing the binary path or provider settings.";
    if (postedRestartRequiredInfo === message) return;
    postedRestartRequiredInfo = message;
    postError(requestId, message, "toast");
  }

  function postSnapshot(): void {
    post({
      type: "chat/state",
      isStreaming: state.isStreaming,
      messages: state.messages,
      tools: state.tools,
    });
    postActiveFileContext();
    // On tab switch, emit current usage so the chat view can display it live.
    if (state.lastUsageTotals) {
      emitCurrentUsage();
    } else if (state.messages.length > 0) {
      void primeUsageTotals();
    }
  }

  /** Emits a chat/usage event with the current session totals. Call after any state change that affects usage display. */
  function emitCurrentUsage(): void {
    const totals = state.lastUsageTotals;
    if (!totals) return;
    post({
      type: "chat/usage",
      messageId: undefined,
      sessionFile: totals.sessionFile,
      sessionId: totals.sessionId,
      userMessages: totals.userMessages,
      assistantMessages: totals.assistantMessages,
      toolCalls: totals.toolCalls,
      toolResults: totals.toolResults,
      totalMessages: totals.totalMessages,
      tokens: totals.tokens,
      cost: totals.cost,
      contextUsage: totals.contextUsage,
    });
  }

  async function primeUsageTotals(): Promise<void> {
    try {
      state.lastUsageTotals = await agentManager.getUsage();
    } catch (err) {
      log.error("getUsage failed", err instanceof Error ? err : undefined);
    }
  }

  async function fetchAndEmitUsage(messageId?: string): Promise<void> {
    try {
      const currentTotals = await agentManager.getUsage();
      if (!currentTotals) return;

      const previous = state.lastUsageTotals;
      const turnUsage: ChatUsageView = previous
        ? {
            sessionFile: currentTotals.sessionFile,
            sessionId: currentTotals.sessionId,
            userMessages:
              currentTotals.userMessages !== undefined
                ? Math.max(0, currentTotals.userMessages - (previous.userMessages ?? 0))
                : undefined,
            assistantMessages:
              currentTotals.assistantMessages !== undefined
                ? Math.max(0, currentTotals.assistantMessages - (previous.assistantMessages ?? 0))
                : undefined,
            toolCalls:
              currentTotals.toolCalls !== undefined
                ? Math.max(0, currentTotals.toolCalls - (previous.toolCalls ?? 0))
                : undefined,
            toolResults:
              currentTotals.toolResults !== undefined
                ? Math.max(0, currentTotals.toolResults - (previous.toolResults ?? 0))
                : undefined,
            totalMessages:
              currentTotals.totalMessages !== undefined
                ? Math.max(0, currentTotals.totalMessages - (previous.totalMessages ?? 0))
                : undefined,
            tokens: {
              input: Math.max(0, currentTotals.tokens.input - previous.tokens.input),
              output: Math.max(0, currentTotals.tokens.output - previous.tokens.output),
              cacheRead: Math.max(0, currentTotals.tokens.cacheRead - previous.tokens.cacheRead),
              cacheWrite: Math.max(0, currentTotals.tokens.cacheWrite - previous.tokens.cacheWrite),
              total: Math.max(0, currentTotals.tokens.total - previous.tokens.total),
            },
            cost: Math.max(0, currentTotals.cost - previous.cost),
            contextUsage: currentTotals.contextUsage,
          }
        : currentTotals;

      state.lastUsageTotals = currentTotals;

      if (messageId) {
        const msg = state.messages.find((m) => m.id === messageId);
        // Only assign usage to regular messages — compaction summaries don't have it.
        if (msg && "usage" in msg) msg.usage = turnUsage;
      }

      post({
        type: "chat/usage",
        messageId,
        sessionFile: turnUsage.sessionFile,
        sessionId: turnUsage.sessionId,
        userMessages: turnUsage.userMessages,
        assistantMessages: turnUsage.assistantMessages,
        toolCalls: turnUsage.toolCalls,
        toolResults: turnUsage.toolResults,
        totalMessages: turnUsage.totalMessages,
        tokens: turnUsage.tokens,
        cost: turnUsage.cost,
        contextUsage: turnUsage.contextUsage,
      });
    } catch (err) {
      log.error("getUsage failed", err instanceof Error ? err : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // streaming flush
  // ---------------------------------------------------------------------------

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(flushPendingDeltas, DELTA_FLUSH_MS);
  }

  function flushPendingDeltas(): void {
    flushTimer = null;
    if (pendingDeltas.size === 0) return;
    for (const [id, delta] of pendingDeltas) {
      const m = state.messages.find((m) => m.id === id);
      // Only append delta to regular messages.
      if (m && "content" in m) m.content += delta;
      post({ type: "chat/messageDelta", id, delta });
    }
    pendingDeltas.clear();
  }

  function startAssistantMessage(id: string, content = "", sourceId: string | null = id): void {
    const createdAt = Date.now();
    state.currentAssistantId = id;
    state.currentAssistantSourceId = sourceId;
    state.lastAssistantId = id;
    state.messages.push({ id, role: "assistant", content, createdAt, streaming: true });
    post({ type: "chat/messageStart", id, role: "assistant", createdAt });
    if (content.length > 0) {
      post({ type: "chat/messageDelta", id, delta: content });
    }
  }

  function getCurrentAssistantMessage(): ChatMessageView | undefined {
    return state.currentAssistantId
      ? (state.messages.find(
          (m): m is ChatMessageView => m.id === state.currentAssistantId && "content" in m,
        ) ?? undefined)
      : undefined;
  }

  /**
   * Tool events can arrive before the first assistant text delta. In that case,
   * create a placeholder assistant row so the tool is not orphaned from later
   * state snapshots.
   */
  function ensureAssistantMessage(): ChatMessageView {
    const existing = getCurrentAssistantMessage();
    if (existing) return existing;
    const id = cryptoRandom();
    startAssistantMessage(id, "", null);
    // startAssistantMessage always appends a ChatMessageView.
    return state.messages[state.messages.length - 1] as ChatMessageView;
  }

  /**
   * Maps runtime stream ids onto the UI assistant message id.
   *
   * Tool-first turns start with a generated placeholder id because the runtime
   * stream id is not known yet. The first text/thinking delta claims that
   * placeholder via `currentAssistantSourceId`; later deltas for the same
   * runtime id must reuse the placeholder so tools, text, and thinking remain
   * one assistant turn across live updates and `chat/state` refreshes.
   */
  function resolveAssistantStreamId(eventId: string): string {
    if (!state.currentAssistantId) {
      startAssistantMessage(eventId);
      return eventId;
    }
    if (state.currentAssistantId === eventId || state.currentAssistantSourceId === eventId) {
      return state.currentAssistantId;
    }

    const current = getCurrentAssistantMessage();
    if (
      current?.streaming &&
      state.currentAssistantSourceId === null &&
      current.content.length === 0 &&
      !current.stopReason
    ) {
      state.currentAssistantSourceId = eventId;
      return current.id;
    }

    finishCurrentAssistant();
    startAssistantMessage(eventId);
    return eventId;
  }

  function finishCurrentAssistant(stopReason?: string): string | null {
    flushPendingDeltas();
    const finishedId = state.currentAssistantId;
    if (!finishedId) return null;
    const m = state.messages.find(
      (message): message is ChatMessageView => message.id === finishedId && "streaming" in message,
    );
    if (m) {
      m.streaming = false;
      m.stopReason = stopReason;
    }
    post({ type: "chat/messageEnd", id: finishedId, stopReason });
    state.currentAssistantId = null;
    state.currentAssistantSourceId = null;
    state.lastAssistantId = finishedId;
    return finishedId;
  }

  function startUserMessage(content: string): void {
    const id = cryptoRandom();
    const createdAt = Date.now();
    state.messages.push({ id, role: "user", content, createdAt });
    post({ type: "chat/messageStart", id, role: "user", createdAt, content });
    post({ type: "chat/messageEnd", id });
  }

  // ---------------------------------------------------------------------------
  // stderr handling — surface fatal errors that agent prints (not emits)
  // ---------------------------------------------------------------------------

  function handleAgentStderr(chunk: string): void {
    stderrLineBuf += chunk;
    let idx: number;
    while ((idx = stderrLineBuf.indexOf("\n")) !== -1) {
      const line = stderrLineBuf.slice(0, idx).replace(/\r$/, "");
      stderrLineBuf = stderrLineBuf.slice(idx + 1);
      if (line.trim().length === 0) continue;
      handleStderrLine(line);
    }
  }

  function handleStderrLine(line: string): void {
    if (!state.isStreaming) return;
    if (errorPostedThisTurn) return;

    const message = parseFatalStderrError(line);
    if (!message) return;
    failActiveTurn(state.currentRequestId ?? undefined, message);
  }

  // ---------------------------------------------------------------------------
  // AgentEvent dispatch
  // ---------------------------------------------------------------------------

  const eventLog = log.child("agent-event");

  function handleAgentEvent(evt: AgentEvent): void {
    eventLog.debug(() => evt.type);
    try {
      if (suppressRuntimeEventsUntilAgentEnd) {
        if (evt.type === "agent_end") {
          suppressRuntimeEventsUntilAgentEnd = false;
          blockedExploreToolCallIds.clear();
        } else {
          return;
        }
      }
      if (state.isStreaming && state.currentRequestId && eventProvesTurnStarted(evt)) {
        state.currentTurnSawRuntimeEvent = true;
        clearTurnStartTimeout();
      }
      dispatchAgentEvent(evt);
    } catch (err) {
      eventLog.error(() => `${evt.type}: handler threw`, err instanceof Error ? err : undefined);
      failActiveTurn(
        state.currentRequestId ?? undefined,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  function blockExploreRuntimeTool(toolName: string, decision: ExploreGuardrailDecision): void {
    suppressRuntimeEventsUntilAgentEnd = true;
    const requestId = state.currentRequestId ?? undefined;
    const message = formatExploreRuntimeBlockMessage(toolName, decision);

    void (async () => {
      try {
        await agentManager.abort();
      } catch (err) {
        eventLog.error(
          "abort after Explore tool block failed",
          err instanceof Error ? err : undefined,
        );
      }
    })();
    failActiveTurn(requestId, message);
  }

  function eventProvesTurnStarted(evt: AgentEvent): boolean {
    switch (evt.type) {
      case "message_start":
      case "message_end":
        return evt.role === "assistant";
      case "text_delta":
      case "thinking_delta":
      case "tool_delta":
      case "bash_delta":
      case "tool_start":
      case "tool_end":
      case "ui_request":
      case "context_overflow":
      case "retryable_error":
      case "auth_error":
      case "compaction_start":
      case "compaction_end":
      case "auto_retry_start":
      case "auto_retry_end":
      case "agent_end":
      case "error":
        return true;
      case "agent_start":
      case "queue_update":
        return false;
      default: {
        const _exhaustive: never = evt;
        return _exhaustive;
      }
    }
  }

  function dispatchAgentEvent(evt: AgentEvent): void {
    switch (evt.type) {
      case "agent_start": {
        state.isStreaming = true;
        recordRuntimeStatus({ running: true, isStreaming: true, model: currentModel });
        return;
      }
      case "agent_end": {
        if (pendingContextOverflowError) {
          scheduleOverflowRecoveryTimeout(state.currentRequestId ?? undefined);
          recordRuntimeStatus({
            running: true,
            isStreaming: true,
            model: currentModel,
            isCompacting: true,
          });
          return;
        }
        if (pendingRetryableError) {
          scheduleRetryRecoveryTimeout(state.currentRequestId ?? undefined);
          recordRuntimeStatus({
            running: true,
            isStreaming: true,
            model: currentModel,
          });
          return;
        }
        const finishedId = clearStreamingState();
        recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel });
        void fetchAndEmitUsage(finishedId ?? state.lastAssistantId ?? undefined);
        void broadcastRuntimeSettings();
        return;
      }
      case "context_overflow": {
        pendingContextOverflowError = evt.message;
        clearTurnStartTimeout();
        return;
      }
      case "retryable_error": {
        pendingRetryableError = evt.message;
        clearTurnStartTimeout();
        return;
      }
      case "auth_error": {
        recoverFromAuthError(evt);
        return;
      }
      case "compaction_start": {
        clearOverflowRecoveryTimeout();
        recordRuntimeStatus({
          running: true,
          isStreaming: state.isStreaming,
          model: currentModel,
          isCompacting: true,
        });
        void broadcastRuntimeSettings();
        if (evt.reason === "overflow") {
          postChatToast({
            tone: "info",
            message: "Context overflow detected",
            description: "Compacting the session and retrying the prompt.",
            durationMs: 4_000,
          });
        }
        return;
      }
      case "compaction_end": {
        clearOverflowRecoveryTimeout();
        if (evt.errorMessage) {
          pendingContextOverflowError = null;
          failActiveTurn(state.currentRequestId ?? undefined, evt.errorMessage);
          return;
        }
        if (evt.aborted && pendingContextOverflowError) {
          const message = "Context overflow recovery was cancelled.";
          pendingContextOverflowError = null;
          failActiveTurn(state.currentRequestId ?? undefined, message);
          return;
        }
        if (evt.result && evt.reason !== "manual") {
          appendCompactionSummary(evt.result);
          post({
            type: "agent/compacted",
            requestId: state.currentRequestId ?? `auto-compact-${Date.now()}`,
            result: evt.result,
          });
        }
        pendingContextOverflowError = null;
        recordRuntimeStatus({
          running: true,
          isStreaming: state.isStreaming || evt.willRetry,
          model: currentModel,
          isCompacting: false,
        });
        void broadcastRuntimeSettings();
        if (evt.willRetry && state.currentRequestId) {
          state.isStreaming = true;
          state.currentTurnSawRuntimeEvent = false;
          scheduleTurnStartTimeout(state.currentRequestId);
        }
        return;
      }
      case "auto_retry_start": {
        clearRetryRecoveryTimeout();
        pendingRetryableError = evt.errorMessage;
        state.isStreaming = true;
        recordRuntimeStatus({
          running: true,
          isStreaming: true,
          model: currentModel,
        });
        void broadcastRuntimeSettings();
        const retryRequestId = state.currentRequestId;
        if (!retryRequestId || retryToastRequestId !== retryRequestId) {
          retryToastRequestId = retryRequestId ?? "__unknown__";
          postChatToast({
            tone: "info",
            message: `Retrying provider request (${evt.attempt}/${evt.maxAttempts})`,
            description: `Transient provider error; retrying in ${formatRetryDelay(evt.delayMs)}.`,
            durationMs: 4_000,
            cancelableRetry: true,
          });
        }
        return;
      }
      case "auto_retry_end": {
        clearRetryRecoveryTimeout();
        if (!evt.success) {
          const message = evt.finalError ?? pendingRetryableError ?? "Provider retry failed.";
          pendingRetryableError = null;
          retryToastRequestId = null;
          failActiveTurn(state.currentRequestId ?? undefined, message);
          return;
        }
        pendingRetryableError = null;
        retryToastRequestId = null;
        recordRuntimeStatus({
          running: true,
          isStreaming: state.isStreaming,
          model: currentModel,
        });
        return;
      }
      case "message_start": {
        if (evt.role === "user") {
          if (state.suppressNextUserMessageStart) {
            state.suppressNextUserMessageStart = false;
            return;
          }
          const queuedDisplay = queuedUserDisplays.shift();
          startUserMessage(queuedDisplay?.content ?? evt.content ?? "");
          return;
        }
        if (evt.role !== "assistant") return;
        // API failure packed as errorMessage by the adapter.
        if (evt.errorMessage) {
          if (errorPostedThisTurn) return;
          failActiveTurn(state.currentRequestId ?? undefined, evt.errorMessage);
          return;
        }
        // Non-streaming: full content in message_start, no text_delta follows.
        if (evt.content && evt.content.length > 0) {
          clearPendingRetryableError();
          startAssistantMessage(cryptoRandom(), evt.content);
        }
        return;
      }
      case "message_end": {
        if (evt.role === "assistant") {
          if (evt.stopReason !== "error") clearPendingRetryableError();
          finishCurrentAssistant(evt.stopReason);
        }
        return;
      }
      case "text_delta": {
        const { id, delta } = evt;
        // First delta for this message — mint or reuse message state.
        clearPendingRetryableError();
        const targetId = resolveAssistantStreamId(id);
        if (delta.length === 0) return;
        pendingDeltas.set(targetId, (pendingDeltas.get(targetId) ?? "") + delta);
        scheduleFlush();
        return;
      }
      case "thinking_delta": {
        const { id, delta } = evt;
        if (delta.length === 0) return;
        clearPendingRetryableError();
        const targetId = resolveAssistantStreamId(id);
        const m = state.messages.find(
          (m): m is ChatMessageView => m.id === targetId && "thinking" in m,
        );
        if (m) m.thinking = (m.thinking ?? "") + delta;
        post({ type: "chat/thinkingDelta", id: targetId, delta });
        return;
      }
      case "tool_start": {
        const { toolCallId, toolName, args } = evt;
        if (!toolCallId) return;
        if (isExploreMode()) {
          const decision = classifyExploreRuntimeTool(toolName, args);
          if (decision.status === "block") {
            blockedExploreToolCallIds.add(toolCallId);
            void blockExploreRuntimeTool(toolName, decision);
            return;
          }
        }
        const tool: ChatToolView = { toolCallId, toolName, status: "running", args };
        state.tools.push(tool);
        const msg = ensureAssistantMessage();
        // tools may not exist yet on a freshly-created placeholder message.
        msg.tools = [...(msg.tools ?? []), tool];
        post({ type: "chat/toolStart", toolCallId, toolName, args: args ?? null });
        return;
      }
      case "tool_delta": {
        const { toolCallId, delta } = evt;
        if (!toolCallId || delta.length === 0) return;
        appendToolDelta(toolCallId, delta, "tool");
        return;
      }
      case "bash_delta": {
        // Id-less bash streams are scoped per turn so separate commands never merge
        // into one ever-running synthetic tool row.
        const toolCallId = evt.id ?? `bash-${state.currentRequestId ?? "idle"}`;
        if (evt.delta.length === 0) return;
        appendToolDelta(toolCallId, evt.delta, "bash");
        return;
      }
      case "tool_end": {
        const { toolCallId, ok, result } = evt;
        if (!toolCallId) return;
        if (blockedExploreToolCallIds.delete(toolCallId)) return;
        const summary = extractToolSummary(result);
        const firstChangedLine = extractFirstChangedLine(result);
        const tool = state.tools.find((t) => t.toolCallId === toolCallId);
        if (tool) {
          tool.status = ok ? "ok" : "error";
          tool.summary = summary;
          if (firstChangedLine !== undefined) tool.firstChangedLine = firstChangedLine;
        }
        for (const m of state.messages) {
          if (!("tools" in m)) continue;
          const mt = m.tools?.find((t: ChatToolView) => t.toolCallId === toolCallId);
          if (mt) {
            mt.status = ok ? "ok" : "error";
            mt.summary = summary;
            if (firstChangedLine !== undefined) mt.firstChangedLine = firstChangedLine;
          }
        }
        post({ type: "chat/toolEnd", toolCallId, ok, summary, firstChangedLine });
        return;
      }
      case "queue_update": {
        void broadcastRuntimeSettings();
        return;
      }
      case "ui_request": {
        void handleUiRequest(evt);
        return;
      }
      case "error": {
        const { message } = evt;
        eventLog.error(message, { payload: evt });
        failActiveTurn(state.currentRequestId ?? undefined, message);
        return;
      }
      default: {
        const _exhaustive: never = evt;
        eventLog.warn(`unhandled type=${(_exhaustive as { type: string }).type}`);
      }
    }
  }

  // Streaming accumulations are display state; keeping only the newest tail bounds
  // snapshot size for long-running tools. Terminal summaries are capped separately
  // on tool_end via TOOL_SUMMARY_MAX.
  function capToolStreamTail(text: string): string {
    return text.length > TOOL_STREAM_TAIL_MAX ? text.slice(-TOOL_STREAM_TAIL_MAX) : text;
  }

  function appendToolDelta(toolCallId: string, delta: string, toolName: string): void {
    let tool = state.tools.find((t) => t.toolCallId === toolCallId);
    if (!tool) {
      tool = { toolCallId, toolName, status: "running" };
      state.tools.push(tool);
      const msg = ensureAssistantMessage();
      msg.tools = [...(msg.tools ?? []), tool];
      post({ type: "chat/toolStart", toolCallId, toolName, args: null });
    }
    tool.output = capToolStreamTail(`${tool.output ?? tool.summary ?? ""}${delta}`);
    tool.summary = tool.output;
    for (const m of state.messages) {
      if (!("tools" in m)) continue;
      const mt = m.tools?.find((t: ChatToolView) => t.toolCallId === toolCallId);
      // The tool object can be shared between state.tools and msg.tools; appending
      // through both references would store every delta twice.
      if (mt && mt !== tool) {
        mt.output = capToolStreamTail(`${mt.output ?? mt.summary ?? ""}${delta}`);
        mt.summary = mt.output;
      }
    }
    post({ type: "chat/toolDelta", toolCallId, delta });
  }

  // ---------------------------------------------------------------------------
  // Agent UI requests
  // ---------------------------------------------------------------------------

  const uiLog = log.child("agent-ui");

  async function handleUiRequest(evt: AgentUiRequest): Promise<void> {
    try {
      switch (evt.method) {
        case "select": {
          const value = await vscode.window.showQuickPick(evt.options, {
            title: evt.title,
            ignoreFocusOut: true,
          });
          await respondToUiRequest(value ? { id: evt.id, value } : { id: evt.id, cancelled: true });
          return;
        }
        case "confirm": {
          const selected = await vscode.window.showWarningMessage(
            evt.message,
            { modal: true, detail: evt.title },
            "Confirm",
          );
          await respondToUiRequest({ id: evt.id, confirmed: selected === "Confirm" });
          return;
        }
        case "input": {
          const value = await vscode.window.showInputBox({
            title: evt.title,
            placeHolder: evt.placeholder,
            ignoreFocusOut: true,
          });
          await respondToUiRequest(
            value === undefined ? { id: evt.id, cancelled: true } : { id: evt.id, value },
          );
          return;
        }
        case "editor": {
          const value = await vscode.window.showInputBox({
            title: evt.title,
            value: evt.prefill,
            ignoreFocusOut: true,
          });
          await respondToUiRequest(
            value === undefined ? { id: evt.id, cancelled: true } : { id: evt.id, value },
          );
          return;
        }
        case "notify": {
          showNotification(evt);
          return;
        }
        case "setStatus": {
          uiLog.debug("setStatus", { key: evt.statusKey, text: evt.statusText });
          return;
        }
        case "setWidget": {
          uiLog.debug("setWidget", { key: evt.widgetKey, lines: evt.widgetLines ?? [] });
          return;
        }
        case "setTitle": {
          uiLog.debug("setTitle", { title: evt.title });
          return;
        }
        case "set_editor_text": {
          const mutation = { type: "chat/draftSet" as const, content: evt.text };
          if (!webview || !chatReady) {
            pendingDraftMutations.push(mutation);
          } else {
            post(mutation);
          }
          return;
        }
        default: {
          const _exhaustive: never = evt;
          uiLog.warn("unhandled", { evt: _exhaustive });
        }
      }
    } catch (err) {
      uiLog.error(`${evt.method} failed`, err instanceof Error ? err : undefined);
      if (requiresUiResponse(evt)) {
        await respondToUiRequest({ id: evt.id, cancelled: true });
      }
    }
  }

  async function respondToUiRequest(response: AgentUiResponse): Promise<void> {
    try {
      await agentManager.respondToUiRequest(response);
    } catch (err) {
      uiLog.error("respondToUiRequest failed", err instanceof Error ? err : undefined);
    }
  }

  function showNotification(evt: Extract<AgentUiRequest, { method: "notify" }>): void {
    if (evt.notifyType === "error") {
      vscode.window.showErrorMessage(evt.message);
      return;
    }
    if (evt.notifyType === "warning") {
      vscode.window.showWarningMessage(evt.message);
      return;
    }
    vscode.window.showInformationMessage(evt.message);
  }

  function requiresUiResponse(evt: AgentUiRequest): boolean {
    return (
      evt.method === "select" ||
      evt.method === "confirm" ||
      evt.method === "input" ||
      evt.method === "editor"
    );
  }

  // ---------------------------------------------------------------------------
  // Flow: [AgentManager.HostBridge]
  // Flow: [Bridge.ChatToAgent]
  // inbound from webview
  // ---------------------------------------------------------------------------

  const inboundLog = log.child("webview");

  function handleInbound(msg: ChatToAgent): void {
    inboundLog.debug(() => msg.type);
    try {
      dispatchInbound(msg);
    } catch (err) {
      inboundLog.error(() => `${msg.type}: handler threw`, err instanceof Error ? err : undefined);
      postError(undefined, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  /**
   * Inbound message dispatcher for the chat webview. Each `case` carries an
   * `@see` to the spec/design that owns the message variant. Use those anchors
   * as the entry point when changing a handler's behavior or contract.
   *
   * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  function dispatchInbound(msg: ChatToAgent): void {
    switch (msg.type) {
      // @see docs/specs/210-app-chat/design.md [DES-API]
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/ready":
      case "chat/getState": {
        markChatReady();
        runtimeMonitor.start();
        postSnapshot();
        void runtimeMonitor.check();
        void broadcastRuntimeSettings();
        // @see docs/specs/100-package-shared/spec.md [FR-12]
        // Replay the last cached active-doc context so the doc-actions / mode-suggest
        // strips render correctly when the webview boots while a sprint or 4-file
        // doc is already the active editor.
        post({
          type: "chat/activeDocContext",
          format: lastActiveDocContext.format,
          section: lastActiveDocContext.section,
          docKind: lastActiveDocContext.docKind,
          feature: lastActiveDocContext.feature,
          filePath: lastActiveDocContext.filePath,
          approvalStatus: lastActiveDocContext.approvalStatus,
          taskPhases: lastActiveDocContext.taskPhases,
          signOff: lastActiveDocContext.signOff,
          parsedFocuses: lastActiveDocContext.parsedFocuses,
          specStatus: lastActiveDocContext.specStatus,
          designStatus: lastActiveDocContext.designStatus,
          tasksStatus: lastActiveDocContext.tasksStatus,
          tasksCompleted: lastActiveDocContext.tasksCompleted,
          tasksTotal: lastActiveDocContext.tasksTotal,
          workSessionsTotal: lastActiveDocContext.workSessionsTotal,
          workSessionsSigned: lastActiveDocContext.workSessionsSigned,
          siblingPaths: lastActiveDocContext.siblingPaths,
          sectionOffsets: lastActiveDocContext.sectionOffsets,
        });
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "agent/checkStatus": {
        void runtimeMonitor.check(msg.requestId);
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "agent/restart": {
        clearStreamingStateForRestart();
        void runtimeMonitor.restart(msg.requestId);
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "agent/reload": {
        void vscode.commands.executeCommand("workbench.action.reloadWindow");
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
      case "chat/send": {
        void handleSend(
          msg.requestId,
          msg.content,
          msg.mentions,
          msg.intentSlot,
          undefined,
          msg.imageAttachmentIds,
        );
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/getModels": {
        void handleGetModels(msg.requestId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
      case "chat/setModel": {
        void handleSetModel(
          msg.requestId,
          msg.provider,
          msg.modelId,
          msg.instanceId,
          msg.authMethod,
        );
        return;
      }
      // @see docs/specs/201-app-vscode-panels/spec.md [FR-9] [FR-10] [FR-11]
      // @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
      case "chat/setMode": {
        void handleSetMode(msg.requestId, msg.mode);
        return;
      }
      // @see docs/specs/211-app-chat-composer/spec.md [FR-6] [FR-11]
      // @see docs/specs/214-app-chat-settings/spec.md [FR-1]
      case "chat/setIntentSlot": {
        void handleSetIntentSlot(msg.requestId, msg.slot);
        return;
      }
      // @see docs/specs/211-app-chat-composer/spec.md [FR-7] [FR-11]
      // @see docs/specs/214-app-chat-settings/spec.md [FR-1]
      case "chat/setIntentMinimized": {
        void handleSetIntentMinimized(msg.requestId, msg.minimized);
        return;
      }
      // @see docs/specs/211-app-chat-composer/spec.md [FR-11]
      // @see docs/specs/214-app-chat-settings/spec.md [FR-1]
      case "chat/setIntentScope": {
        void handleSetIntentScope(msg.requestId, msg.scope, {
          slot: msg.slot,
          minimized: msg.minimized,
        });
        return;
      }
      // @see docs/specs/211-app-chat-composer/spec.md [FR-11]
      // @see docs/specs/214-app-chat-settings/spec.md [FR-1]
      case "chat/clearIntentWorkspace": {
        void handleClearIntentWorkspace(msg.requestId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
      case "chat/getCommands": {
        void handleGetCommands(msg.requestId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
      case "chat/listFiles": {
        void handleListFiles(msg.requestId, msg.query, msg.limit);
        return;
      }
      case "chat/selectImages": {
        void handleSelectImages(msg.requestId);
        return;
      }
      case "chat/discardImages": {
        handleDiscardImages(msg.requestId, msg.imageAttachmentIds);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/getSettingsSnapshot": {
        void handleGetSettingsSnapshot(msg.requestId);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-SKILLS]
      case "skills/openPath": {
        void handleOpenSkillPath(msg.requestId, msg.path);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-SKILLS]
      case "skills/revealPath": {
        void handleRevealSkillPath(msg.requestId, msg.path);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-SKILLS]
      case "skills/create": {
        void handleCreateSkill(msg.requestId);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-SKILLS]
      case "skills/setProjectTrust": {
        void handleSetProjectTrust(msg.requestId, msg.value);
        return;
      }
      // @see docs/specs/100-package-shared/spec.md [FR-12]
      // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
      case "chat/setOnboardingFlag": {
        void deps.workspaceState?.update(`afx.${msg.key}`, msg.value);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-CONTEXT]
      case "chat/setIncludeActiveFileContext": {
        void handleSetIncludeActiveFileContext(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "provider/setApiKey": {
        void handleSetProviderApiKey(msg.requestId, msg.provider, msg.key, msg.config);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "provider/clearApiKey": {
        void handleClearProviderApiKey(msg.requestId, msg.provider);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "provider/setDefaultModel": {
        void handleSetProviderDefaultModel(msg.requestId, msg.provider, msg.modelId);
        return;
      }
      // @see docs/specs/351-agent-pi/design.md [DES-API]
      case "external/detectPiBinary": {
        void handleDetectPiBinary(msg.requestId);
        return;
      }
      // @see docs/specs/351-agent-pi/design.md [DES-API]
      case "external/setRpcEnabled": {
        void handleSetRpcEnabled(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/351-agent-pi/design.md [DES-API]
      case "external/setEphemeral": {
        void handleSetEphemeralSession(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-DIAGNOSTICS]
      case "chat/showLogs": {
        void vscode.commands.executeCommand("afx.showLogs");
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/openSettings": {
        void vscode.commands.executeCommand("workbench.action.openSettings", msg.key);
        return;
      }
      // @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-2]
      case "experimental/setCanvasEnabled": {
        void handleSetExperimentalCanvasEnabled(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/214-app-chat-settings/spec.md [FR-16]
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-WORKBENCH-VISIBILITY]
      case "experimental/setWorkbenchHiddenViews": {
        void handleSetWorkbenchHiddenViews(msg.requestId, msg.hidden);
        return;
      }
      // @see docs/specs/212-app-chat-messages/spec.md [FR-10]
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]
      case "chat/openWorkbench": {
        void vscode.commands.executeCommand("afx.openWorkbench");
        return;
      }
      // @see docs/specs/211-app-chat-composer/spec.md [FR-10]
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
      case "chat/openFile": {
        void handleOpenFile(msg.path, msg.line, msg.mode);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
      case "chat/openModelsJson": {
        const modelsJsonPath = path.join(piAgentDir, "models.json");
        if (!existsSync(modelsJsonPath)) {
          mkdirSync(piAgentDir, { recursive: true });
          writeFileSync(
            modelsJsonPath,
            JSON.stringify({ providers: [], modelOverrides: {} }, null, 2) + "\n",
            "utf-8",
          );
        }
        void vscode.window.showTextDocument(vscode.Uri.file(modelsJsonPath));
        return;
      }
      // @see docs/specs/901-cross-telemetry/design.md [DES-TELEMETRY-CATALOG]
      case "telemetry/setEnabled": {
        void handleSetTelemetryEnabled(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
      case "appearance/update": {
        void handleUpdateAppearance(msg.requestId, msg.theme, msg.style);
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/abort": {
        void handleAbort();
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/newSession": {
        void handleNewSession();
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/compact": {
        void handleCompact(msg.requestId, msg.customInstructions);
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/exportSession": {
        void handleExportSession(msg.requestId);
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/renameSession": {
        void handleRenameSession(msg.requestId, msg.name);
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/abortRetry": {
        void handleAbortRetry(msg.requestId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
      case "chat/steer": {
        void handleSteer(
          msg.requestId,
          msg.content,
          msg.mentions,
          msg.intentSlot,
          msg.imageAttachmentIds,
        );
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
      case "chat/followUp": {
        void handleFollowUp(
          msg.requestId,
          msg.content,
          msg.mentions,
          msg.intentSlot,
          msg.imageAttachmentIds,
        );
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
      case "chat/setThinkingLevel": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setThinkingLevel(msg.level));
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setSteeringMode": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setSteeringMode(msg.mode));
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setFollowUpMode": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setFollowUpMode(msg.mode));
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setAutoCompaction": {
        void handleSetRuntimeSetting(msg.requestId, () =>
          agentManager.setAutoCompaction(msg.enabled),
        );
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setAutoRetry": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setAutoRetry(msg.enabled));
        return;
      }
      // @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-FLOW]
      case "chat/saveNote": {
        void appendNoteToWorkspace(msg.content);
        return;
      }
      // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
      // @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
      case "chat/hostAction": {
        void handleHostAction(msg.requestId, msg.action, msg.uri);
        return;
      }
      case "chat/runCommand": {
        void handleRunCommand(msg.requestId, msg.command);
        return;
      }
      case "chat/confirmDangerous": {
        void handleConfirmDangerous(msg.requestId, msg.command, msg.reason);
        return;
      }
      // @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [FR-10]
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
      case "customModels/refresh": {
        void handleCustomModelsMutation(msg.requestId, { kind: "refresh" });
        return;
      }
      case "customModels/upsertProvider": {
        void handleCustomModelsMutation(msg.requestId, {
          kind: "upsertProvider",
          provider: {
            id: msg.provider.id,
            displayName: msg.provider.displayName,
            baseUrl: msg.provider.baseUrl,
            api: msg.provider.api,
            apiKeyRef: msg.provider.apiKeyRef,
            apiKeyValue: msg.provider.apiKeyValue,
            authHeader: msg.provider.authHeader,
            models: msg.provider.models,
            headers: msg.provider.headers,
            compat: msg.provider.compat,
          },
        });
        return;
      }
      case "customModels/removeProvider": {
        void handleCustomModelsMutation(msg.requestId, {
          kind: "removeProvider",
          providerId: msg.providerId,
        });
        return;
      }
      case "customModels/upsertModel": {
        void handleCustomModelsMutation(msg.requestId, {
          kind: "upsertModel",
          providerId: msg.providerId,
          model: msg.model,
        });
        return;
      }
      case "customModels/removeModel": {
        void handleCustomModelsMutation(msg.requestId, {
          kind: "removeModel",
          providerId: msg.providerId,
          modelId: msg.modelId,
        });
        return;
      }
      // OAuth bridge commands -> shared OAuthService; only redacted oauth/status
      // / oauth/progress ever reach the webview.
      // @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
      // @see docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-API]
      case "oauth/signIn":
      case "oauth/signOut":
      case "oauth/setAuthMethod":
      case "oauth/submitCode":
      case "oauth/cancel": {
        void handleOAuthCommand(msg);
        return;
      }
      // @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [FR-19]
      // @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-BRIDGE]
      case "session/list":
      case "history/load":
      case "history/reopen":
      case "session/delete":
      case "session/revealCwd": {
        void handleHistoryCommand(msg);
        return;
      }
      default: {
        const _never: never = msg;
        inboundLog.warn("unknown inbound", { msg: _never });
      }
    }
  }

  async function handleOpenFile(
    filePath: string,
    line: number | undefined,
    mode: "editor" | "afxPreview" | "gitChanges" | undefined,
  ): Promise<void> {
    if (mode === "gitChanges") {
      const fallbackUri = await resolveChatFileUri(filePath);
      const unavailableMessage = `AgenticFlowX: Git changes are unavailable for ${path.basename(fallbackUri.fsPath)}.`;
      const extension = vscode.extensions.getExtension<VsCodeGitExtensionExports>("vscode.git");
      if (!extension) {
        await offerOpenFileFallback(fallbackUri, line, unavailableMessage);
        return;
      }
      let api: VsCodeGitApi | undefined;
      try {
        const git = extension.isActive ? extension.exports : await extension.activate();
        api = git?.enabled ? git.getAPI(1) : undefined;
      } catch {
        // The user-facing fallback below covers activation and API failures.
      }
      if (!api) {
        await offerOpenFileFallback(fallbackUri, line, unavailableMessage);
        return;
      }
      const changes = api.repositories.flatMap((repository) => [
        ...repository.state.workingTreeChanges,
        ...repository.state.indexChanges,
        ...repository.state.mergeChanges,
        ...(repository.state.untrackedChanges ?? []),
      ]);
      const uri = await resolveChatFileUri(
        filePath,
        changes.map((change) => change.uri),
      );
      const requestedPath = path.normalize(uri.fsPath);
      const change = changes.find((entry) => path.normalize(entry.uri.fsPath) === requestedPath);
      if (change) {
        try {
          await vscode.commands.executeCommand("git.openChange", change.uri);
        } catch {
          await offerOpenFileFallback(
            uri,
            line,
            `AgenticFlowX: Could not open Git changes for ${path.basename(uri.fsPath)}.`,
          );
        }
      } else if (!api.repositories.some((repository) => isUriWithinRoot(uri, repository.rootUri))) {
        await offerOpenFileFallback(
          uri,
          line,
          `AgenticFlowX: ${path.basename(uri.fsPath)} is not in a Git repository.`,
        );
      } else {
        await offerOpenFileFallback(
          uri,
          line,
          `AgenticFlowX: No Git changes found for ${path.basename(uri.fsPath)}.`,
        );
      }
      return;
    }

    const uri = await resolveChatFileUri(filePath);
    if (mode === "afxPreview" && openAfxPreview) {
      openAfxPreview(uri);
      return;
    }
    await openSourceFile(uri, line);
  }

  function sourceOpenOptions(line: number | undefined): vscode.TextDocumentShowOptions | undefined {
    const lineIndex =
      typeof line === "number" && Number.isFinite(line) && line > 0 ? line - 1 : undefined;
    return lineIndex !== undefined
      ? { selection: new vscode.Range(lineIndex, 0, lineIndex, 0), preview: false }
      : undefined;
  }

  async function openSourceFile(uri: vscode.Uri, line: number | undefined): Promise<void> {
    await vscode.window.showTextDocument(uri, sourceOpenOptions(line));
  }

  async function offerOpenFileFallback(
    uri: vscode.Uri,
    line: number | undefined,
    message: string,
  ): Promise<void> {
    const exists = await vscode.workspace.fs.stat(uri).then(
      () => true,
      () => false,
    );
    if (!exists) {
      await vscode.window.showInformationMessage(message);
      return;
    }
    const choice = await vscode.window.showInformationMessage(message, "Open File");
    if (choice === "Open File") await openSourceFile(uri, line);
  }

  async function handleSend(
    requestId: string,
    content: string,
    mentions: readonly string[] = [],
    intentSlot?: IntentSlot,
    options?: { isAuthRetry?: boolean },
    imageAttachmentIds: readonly string[] = [],
  ): Promise<void> {
    if (state.isCompacting) {
      postError(requestId, "Compaction is in progress. Wait for it to finish.", "toast");
      restoreStagedAttachmentTray(imageAttachmentIds);
      return;
    }
    if (state.isStreaming) {
      postError(requestId, "Already streaming. Wait for the current turn to finish.", "toast");
      restoreStagedAttachmentTray(imageAttachmentIds);
      return;
    }

    // A fresh user turn (not an auth retry replay) resets the one-shot recovery
    // budget and records the prompt so a later auth_error can replay it once.
    // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
    if (!options?.isAuthRetry) {
      authRecoveryAttempted = false;
    }

    const images = options?.isAuthRetry
      ? lastTurnSend?.images
      : peekImageAttachments(stagedImageAttachments, imageAttachmentIds);
    if (!options?.isAuthRetry) {
      lastTurnSend = { content, mentions, intentSlot, images };
    }

    // An auth retry replays a prompt already shown in the transcript; don't echo
    // the user message a second time.
    // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
    if (!options?.isAuthRetry) {
      const userId = cryptoRandom();
      const createdAt = Date.now();
      state.messages.push({ id: userId, role: "user", content, createdAt });
      post({ type: "chat/messageStart", id: userId, role: "user", createdAt, content });
      post({ type: "chat/messageEnd", id: userId });
    }

    state.currentRequestId = requestId;
    state.isStreaming = true;
    state.lastAssistantId = null;
    state.suppressNextUserMessageStart = true;
    state.currentTurnSawRuntimeEvent = false;
    errorPostedThisTurn = false;
    retryToastRequestId = null;
    recordRuntimeStatus({ running: true, isStreaming: true, model: currentModel });
    scheduleTurnStartTimeout(requestId);

    try {
      const inflated = await inflateMentionContext(
        content,
        normalizePromptMentions(content, mentions),
      );
      const prompt = prefixWorkspaceModePrompt(inflated, intentSlot);
      if (images) await agentManager.send(prompt, images);
      else await agentManager.send(prompt);
      if (!options?.isAuthRetry) commitImageAttachments(stagedImageAttachments, imageAttachmentIds);
    } catch (err) {
      log.error("agent.send failed", err instanceof Error ? err : undefined, { requestId });
      const message = err instanceof Error ? err.message : String(err);
      failActiveTurn(requestId, message);
      postedRestartRequiredInfo = message;
      await runtimeMonitor.check(requestId);
    }
  }

  /**
   * @see docs/specs/211-app-chat-composer/spec.md [FR-9]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND]
   * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
   * @see docs/specs/211-app-chat-composer/spec.md [FR-13]
   */
  function handleRunCommand(requestId: string, command: string): void {
    const exploreShellDecision = isExploreMode() ? classifyExploreShellCommand(command) : undefined;
    if (exploreShellDecision?.status === "block") {
      const detail = exploreShellDecision.detail ? ` Detail: ${exploreShellDecision.detail}` : "";
      post({
        type: "agent/actionBlocked",
        requestId,
        mode: "explore",
        action: "runCommand",
        title: "Shell command blocked in Explore mode",
        message: `Explore mode allows read-only shell commands only (${exploreShellDecision.reason}).${detail} Use stdout or /dev/null, or switch to Code to run mutating commands.`,
        command,
      });
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      post({ type: "agent/commandOutput", requestId, error: "No workspace folder open" });
      return;
    }

    const isWin = process.platform === "win32";
    const shell = isWin ? "cmd" : "/bin/bash";
    const shellArgs = isWin ? ["/c", command] : ["-c", command];

    const proc = spawn(shell, shellArgs, {
      cwd: workspaceRoot,
      timeout: 30_000,
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      post({
        type: "agent/commandOutput",
        requestId,
        delta: chunk.toString(),
        kind: "stdout",
      });
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      post({
        type: "agent/commandOutput",
        requestId,
        delta: chunk.toString(),
        kind: "stderr",
      });
    });

    proc.on("close", (code: number | null, signal: string | null) => {
      if (signal === "SIGTERM") {
        post({
          type: "agent/commandOutput",
          requestId,
          done: true,
          exitCode: -1,
          error: "Command timed out after 30s",
        });
      } else {
        post({ type: "agent/commandOutput", requestId, done: true, exitCode: code ?? -1 });
      }
    });

    proc.on("error", (err: Error) => {
      log.error("shell execution failed", err);
      post({ type: "agent/commandOutput", requestId, error: err.message });
    });
  }

  /**
   * Run a host-side document mutation triggered by the composer doc-actions
   * strip. Currently only `tasks.signOff` is supported — opens the document at
   * `uri`, applies a single `vscode.WorkspaceEdit` (so the change lands as one
   * undo entry on the editor stack), saves, and posts a separate
   * `agent/signOffComplete` event back to the webview for toast/error UX.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-19]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  async function handleHostAction(
    requestId: string,
    action: "tasks.signOff",
    uriString: string,
  ): Promise<void> {
    // The discriminated `chat/hostAction` message type only allows
    // `tasks.signOff` today; if/when more actions ship, fan out by `action`
    // here and refresh the union in `messages.ts`.
    void action;
    const hostLog = log.child("host-action");

    let uri: vscode.Uri;
    try {
      uri = vscode.Uri.parse(uriString);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      hostLog.error(() => `invalid uri: ${uriString}`, err instanceof Error ? err : undefined);
      post({ type: "agent/signOffComplete", requestId, uri: uriString, ok: false, error: message });
      return;
    }

    try {
      const result = await applyTasksSignOff(uri);
      hostLog.info(
        () =>
          `tasks.signOff ${uriString} ok=${result.ok} rows=${result.rowsTicked} status=${result.newStatus}`,
      );
      post({
        type: "agent/signOffComplete",
        requestId,
        uri: uriString,
        ok: result.ok,
        rowsTicked: result.rowsTicked,
        newStatus: result.newStatus,
        ...(result.error ? { error: result.error } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      hostLog.error("tasks.signOff failed", err instanceof Error ? err : undefined);
      post({ type: "agent/signOffComplete", requestId, uri: uriString, ok: false, error: message });
    }
  }

  /**
   * Shows a VSCode warning dialog for dangerous commands and sends confirmation back.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [NFR-6]
   * @see docs/specs/211-app-chat-composer/design.md [DES-ERR]
   */
  async function handleConfirmDangerous(
    requestId: string,
    command: string,
    reason?: string,
  ): Promise<void> {
    const detail = reason
      ? `${reason}\n\nThis action cannot be undone.`
      : "This action cannot be undone.";
    const confirmed = await vscode.window.showWarningMessage(
      `⚠ Destructive command detected: "${command.slice(0, 50)}${command.length > 50 ? "…" : ""}"`,
      { detail, modal: true },
      "Run anyway",
      "Cancel",
    );
    post({ type: "agent/dangerousConfirmed", requestId, confirmed: confirmed === "Run anyway" });
  }

  /**
   * Apply a `customModels/*` mutation against the custom-providers service and
   * broadcast a fresh settings snapshot so the webview reconciles state.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [FR-10]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  async function handleCustomModelsMutation(
    requestId: string,
    mutation: CustomProvidersMutation,
  ): Promise<void> {
    if (!customProvidersService) {
      post({
        type: "customModels/result",
        requestId,
        ok: false,
        error: "customProvidersService unavailable",
      });
      return;
    }
    const result = await customProvidersService.applyMutation(mutation);
    post({
      type: "customModels/result",
      requestId,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    });
    if (result.ok) {
      await handleGetSettingsSnapshot(requestId);
    }
  }

  async function handleGetModels(requestId: string): Promise<void> {
    await postAvailableModels(requestId, { reportErrors: true });
  }

  async function postAvailableModels(
    requestId: string,
    options: { reportErrors: boolean },
  ): Promise<void> {
    try {
      const models = await agentManager.getAvailableModels();
      await maybeRestorePersistedModelSelection(requestId, models);
      post({ type: "agent/models", requestId, models });
    } catch (err) {
      log.error("getAvailableModels failed", err instanceof Error ? err : undefined);
      if (options.reportErrors) {
        postError(requestId, err instanceof Error ? err.message : String(err), "toast");
      }
    }
  }

  async function handleSetModel(
    requestId: string,
    provider: string,
    modelId: string,
    instanceId?: string,
    authMethod?: AgentRuntimeModel["authMethod"],
  ): Promise<void> {
    try {
      const shouldRestartForMethodFlip = isSameProviderAuthMethodFlip(
        currentModel,
        provider,
        instanceId,
        authMethod,
      );
      if (state.isStreaming && shouldRestartForMethodFlip) {
        postChatToast({
          tone: "info",
          message: "Finish the current response first",
          description: "Switching credential methods reconnects the SDK runtime.",
          durationMs: 4_000,
        });
        return;
      }
      if (state.isStreaming) {
        clearStreamingState("model_switch");
        recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
      }
      await applySelectedProviderAuthMethod(provider, authMethod);
      if (shouldRestartForMethodFlip) {
        recordRuntimeStatus(
          {
            running: true,
            isStreaming: false,
            info: "Reconnecting SDK runtime for the selected credential method.",
            model: currentModel,
          },
          requestId,
        );
        await runtimeMonitor.restart(requestId);
      }
      const model = await agentManager.setModel({
        provider,
        modelId,
        ...(instanceId ? { instanceId } : {}),
        ...(authMethod ? { authMethod } : {}),
      });
      const shouldRefreshSettings = await persistSelectedModelIdentity(
        requestId,
        model,
        instanceId,
      );
      currentModel = {
        provider: model.provider,
        id: model.id,
        name: model.name,
        reasoning: model.reasoning,
        source: model.source,
        instanceId: model.instanceId,
        instanceLabel: model.instanceLabel,
        authMethod: model.authMethod,
      };
      post({ type: "agent/modelChanged", requestId, model });
      appendInfoMessage(formatModelSwitchInfo(model));
      recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
      if (shouldRefreshSettings) {
        await handleGetSettingsSnapshot(requestId);
      }
    } catch (err) {
      log.error("setModel failed", err instanceof Error ? err : undefined, {
        provider,
        modelId,
        authMethod,
      });
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function applySelectedProviderAuthMethod(
    provider: string,
    authMethod?: AgentRuntimeModel["authMethod"],
  ): Promise<void> {
    if (authMethod !== "subscription" && authMethod !== "api-key") return;
    const details = PROVIDER_DETAILS[normalizeProviderId(provider)];
    if (!details?.oauthCapable) {
      if (authMethod === "subscription") {
        throw new Error(`Subscription sign-in is not available for ${provider}.`);
      }
      return;
    }
    if (!oauthService) {
      throw new Error("Subscription sign-in is unavailable in this window.");
    }
    if (authMethod === "subscription") {
      const status = await oauthService.getStatus(provider);
      if (!status.connected) {
        throw new Error(`Subscription is not connected for ${provider}.`);
      }
    } else if (!(await secretStore?.getApiKey(provider))) {
      throw new Error(`API key is not configured for ${provider}.`);
    }
    await oauthService.setAuthMethod(provider, authMethod);
  }

  /**
   * Switches the workspace posture through the shared `afx.setMode` command so
   * the same path serves command palette and webview-initiated changes.
   *
   * @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
   * @see docs/specs/201-app-vscode-panels/spec.md [FR-9]
   */
  async function handleSetMode(requestId: string, mode: WorkspaceMode): Promise<void> {
    // @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
    // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
    const nextMode: WorkspaceMode =
      mode === "explore" ? "explore" : mode === "spec" ? "spec" : "code";
    const previousMode = workspaceMode();
    if (previousMode === nextMode) {
      await handleGetSettingsSnapshot(requestId);
      return;
    }

    const shouldResetToCode = previousMode === "explore" && nextMode === "code";
    const shouldResetFromSpec = previousMode === "spec" && nextMode !== "spec";
    workspaceModeOverride = nextMode;
    if (shouldResetToCode) {
      codeModeResetPending = true;
    } else if (nextMode === "explore" || nextMode === "spec") {
      codeModeResetPending = false;
    }
    if (shouldResetFromSpec) {
      specModeResetPending = true;
    } else if (nextMode === "spec") {
      specModeResetPending = false;
    }
    try {
      await vscode.commands.executeCommand("afx.setMode", nextMode);
      appendInfoMessage(formatModeSwitchInfo(nextMode));
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      workspaceModeOverride = null;
      if (shouldResetToCode) {
        codeModeResetPending = false;
      }
      if (shouldResetFromSpec) {
        specModeResetPending = false;
      }
      log.error("setMode failed", err instanceof Error ? err : undefined, { mode });
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function persistSelectedModelIdentity(
    requestId: string,
    model: AgentModel,
    requestedInstanceId?: string,
  ): Promise<boolean> {
    const identity = toModelSelectionIdentity(model, requestedInstanceId);
    const isSdkModel = isApiProviderModel(model, requestedInstanceId);
    const defaultModel = formatSdkDefaultModel(model.provider, model.id);
    try {
      await updateAfxConfigurationWithWorkspaceFallback(
        MODEL_DEFAULT_SELECTION_SETTING,
        formatModelSelectionIdentity(identity),
        configurationTargetFor(MODEL_DEFAULT_SELECTION_SETTING),
        log,
      );
      if (isSdkModel) {
        await updateSdkDefaultModel(model.provider, model.id);
      }
      return true;
    } catch (err) {
      log.error("persist selected model identity failed", err instanceof Error ? err : undefined, {
        provider: model.provider,
        modelId: model.id,
        instanceId: identity.instanceId,
        authMethod: identity.authMethod,
      });
      const reason = err instanceof Error ? err.message : String(err);
      const selectionLabel = isSdkModel ? defaultModel : `${identity.instanceId}:${model.id}`;
      postError(
        requestId,
        `Model switched for this session, but AFX could not save ${selectionLabel} as your default: ${reason}`,
        "toast",
      );
      return false;
    }
  }

  async function maybeRestorePersistedModelSelection(
    requestId: string,
    models: readonly AgentModel[],
  ): Promise<void> {
    if (modelRestoreAttempted) return;
    modelRestoreAttempted = true;
    const requested = readConfiguredModelSelection();
    if (!requested || models.length === 0) return;

    const reconciled = await reconcileModelSelectionAuthMethod(requested);
    const target =
      findModelForSelection(models, reconciled) ?? chooseModelRestoreFallback(models, reconciled);
    if (!target) return;

    try {
      await applySelectedProviderAuthMethod(target.provider, target.authMethod);
      const selected = await agentManager.setModel({
        provider: target.provider,
        modelId: target.id,
        ...(target.instanceId ? { instanceId: target.instanceId } : {}),
        ...(target.authMethod ? { authMethod: target.authMethod } : {}),
      });
      await persistSelectedModelIdentity(requestId, selected, target.instanceId);
      currentModel = {
        provider: selected.provider,
        id: selected.id,
        name: selected.name,
        reasoning: selected.reasoning,
        source: selected.source,
        instanceId: selected.instanceId,
        instanceLabel: selected.instanceLabel,
        authMethod: selected.authMethod,
      };
      post({ type: "agent/modelChanged", requestId, model: selected });
      recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
    } catch (err) {
      log.warn("model selection restore failed", {
        provider: target.provider,
        modelId: target.id,
        instanceId: target.instanceId,
        authMethod: target.authMethod,
        error: err instanceof Error ? err.message : String(err),
      });
      const fallback = chooseModelRestoreFallback(
        models.filter((model) => !identityMatchesModel(toModelSelectionIdentity(target), model)),
        reconciled,
      );
      if (!fallback) return;
      try {
        const selected = await agentManager.setModel({
          provider: fallback.provider,
          modelId: fallback.id,
          ...(fallback.instanceId ? { instanceId: fallback.instanceId } : {}),
          ...(fallback.authMethod ? { authMethod: fallback.authMethod } : {}),
        });
        await persistSelectedModelIdentity(requestId, selected, fallback.instanceId);
        currentModel = {
          provider: selected.provider,
          id: selected.id,
          name: selected.name,
          reasoning: selected.reasoning,
          source: selected.source,
          instanceId: selected.instanceId,
          instanceLabel: selected.instanceLabel,
          authMethod: selected.authMethod,
        };
        post({ type: "agent/modelChanged", requestId, model: selected });
      } catch (fallbackErr) {
        log.warn("model selection fallback failed", {
          error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        });
      }
    }
  }

  function readConfiguredModelSelection(): ModelSelectionIdentityV2 | undefined {
    const cfg = vscode.workspace.getConfiguration("afx");
    const full = parseModelSelectionIdentity(cfg.get<string>(MODEL_DEFAULT_SELECTION_SETTING, ""));
    if (full) return full;
    return parseLegacySdkDefaultModel(cfg.get<string>("sdk.defaultModel", ""));
  }

  async function reconcileModelSelectionAuthMethod(
    selection: ModelSelectionIdentityV2,
  ): Promise<ModelSelectionIdentityV2> {
    if (selection.instanceId !== "pi-sdk") return selection;
    const active = await secretStore?.getAuthMethod(selection.provider);
    if (active && active !== selection.authMethod) {
      return { ...selection, authMethod: active };
    }
    return selection;
  }

  function findModelForSelection(
    models: readonly AgentModel[],
    selection: ModelSelectionIdentityV2,
  ): AgentModel | undefined {
    return models.find((model) => identityMatchesModel(selection, model));
  }

  function chooseModelRestoreFallback(
    models: readonly AgentModel[],
    selection: ModelSelectionIdentityV2,
  ): AgentModel | undefined {
    return (
      models.find((model) => (model.instanceId ?? "pi-sdk") === selection.instanceId) ??
      models.find((model) => isApiProviderModel(model, model.instanceId)) ??
      models.find((model) => model.source === "external-agent")
    );
  }

  async function handleGetCommands(requestId: string): Promise<void> {
    let runtimeCommands: AgentCommand[];
    try {
      runtimeCommands = await agentManager.getCommands();
    } catch (err) {
      if (isNoConfiguredRuntimeError(err)) runtimeCommands = [];
      else {
        log.error("getCommands failed", err instanceof Error ? err : undefined);
        postError(requestId, err instanceof Error ? err.message : String(err), "toast");
        return;
      }
    }

    try {
      const bundledCommands = await listBundledSkillCommands();
      post({
        type: "agent/commands",
        requestId,
        commands: mergeAgentCommands(runtimeCommands, bundledCommands),
      });
    } catch (err) {
      log.error("getCommands failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function handleListFiles(requestId: string, query = "**/*", limit = 200): Promise<void> {
    try {
      const cap = Math.max(1, Math.min(limit, 500));
      const recentPaths = getOpenWorkspaceFilePaths();
      const byPath = new Map<string, AgentFileView>();
      for (const p of recentPaths) byPath.set(p, { path: p, recent: true });
      const found = await vscode.workspace.findFiles(query.trim() || "**/*", undefined, cap);
      for (const uri of found) {
        const relative = toWorkspaceRelativePath(uri);
        if (!relative) continue;
        const existing = byPath.get(relative);
        byPath.set(relative, {
          path: relative,
          recent: existing?.recent ?? recentPaths.has(relative),
        });
      }
      const files = [...byPath.values()]
        .sort(
          (a, b) =>
            Number(Boolean(b.recent)) - Number(Boolean(a.recent)) || a.path.localeCompare(b.path),
        )
        .slice(0, cap);
      post({ type: "agent/files", requestId, files });
    } catch (err) {
      log.error("listFiles failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function handleSelectImages(requestId: string): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        title: "Attach images to chat",
        filters: {
          Images: ["png", "jpg", "jpeg", "webp", "gif"],
        },
      });
      if (!uris || uris.length === 0) {
        post({ type: "chat/imagesSelected", requestId, ok: true, attachments: [] });
        return;
      }

      if (uris.length > CHAT_IMAGE_MAX_ATTACHMENTS) {
        post({
          type: "chat/toast",
          tone: "info",
          message: `Only the first ${CHAT_IMAGE_MAX_ATTACHMENTS} images were attached.`,
        });
      }
      const selected = uris.slice(0, CHAT_IMAGE_MAX_ATTACHMENTS);
      const attachments: StagedImageAttachment[] = [];
      const failures: string[] = [];
      for (const uri of selected) {
        // One unreadable/oversize file must not discard the readable ones.
        try {
          attachments.push(await readChatImageAttachment(uri));
        } catch (err) {
          failures.push(err instanceof Error ? err.message : String(err));
        }
      }
      for (const attachment of attachments) stagedImageAttachments.set(attachment.id, attachment);
      if (failures.length > 0) {
        post({ type: "chat/toast", tone: "error", message: failures.join(" ") });
      }
      post({
        type: "chat/imagesSelected",
        requestId,
        ok: true,
        attachments: attachments.map(({ id, name, mediaType, byteLength }) => ({
          id,
          kind: "image",
          name,
          mediaType,
          byteLength,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("selectImages failed", err instanceof Error ? err : undefined);
      post({ type: "chat/imagesSelected", requestId, ok: false, attachments: [], error: message });
    }
  }

  function handleDiscardImages(requestId: string, imageAttachmentIds: readonly string[]): void {
    for (const id of imageAttachmentIds) stagedImageAttachments.delete(id);
    post({ type: "chat/imagesSelected", requestId, ok: true, attachments: [] });
  }

  // A host-rejected send already cleared the webview tray; re-post the still-staged
  // entries (no requestId — host-initiated) so the user does not lose their files.
  function restoreStagedAttachmentTray(imageAttachmentIds: readonly string[]): void {
    const attachments = imageAttachmentIds
      .map((id) => stagedImageAttachments.get(id))
      .filter((a): a is StagedImageAttachment => a !== undefined);
    if (attachments.length === 0) return;
    post({
      type: "chat/imagesSelected",
      ok: true,
      attachments: attachments.map(({ id, name, mediaType, byteLength }) => ({
        id,
        kind: "image",
        name,
        mediaType,
        byteLength,
      })),
    });
  }

  async function handleGetSettingsSnapshot(requestId: string): Promise<void> {
    try {
      const [models, bundledSkillCount] = await Promise.all([
        agentManager.getAvailableModels().catch((err: unknown) => {
          log.error("settings getAvailableModels failed", err instanceof Error ? err : undefined);
          return [] as AgentModel[];
        }),
        countBundledSkills(),
      ]);
      const cfg = vscode.workspace.getConfiguration("afx");
      const agentBinary = cfg.get<string>("agentBinaryPath", "").trim();
      const rpcEnabled = cfg.get<boolean>("rpc.enabled", false);
      const ephemeral = cfg.get<boolean>("agentEphemeralSession", false);
      const sessionDir = cfg.get<string>("sessionDir", "").trim();
      const includeActiveFileContext = cfg.get<boolean>("context.includeActiveFileContext", true);
      const mode = workspaceMode();
      const canvasEnabled = cfg.get<boolean>("experimental.canvas", false);
      const workbenchHiddenViews = normalizeWorkbenchViewIds(
        cfg.get<unknown>("experimental.workbenchHiddenViews", []),
      );
      const telemetryEnabled = cfg.get<boolean>("telemetry.enabled", true);
      const snapshot: SettingsSnapshot = {
        appearance: appearanceSnapshotFromConfig(cfg),
        engine: {
          rpcEnabled,
          agentBinary: agentBinary || "pi",
          bundledSkillsPath,
          bundledSkillCount,
          ephemeral,
          responseStartTimeoutMs: responseStartTimeoutMs(),
        },
        sdk: {
          enabled: cfg.get<boolean>("sdk.enabled", true),
          defaultModel: cfg.get<string>("sdk.defaultModel", "anthropic:claude-opus-4-5"),
          ollamaBaseUrl: cfg.get<string>("sdk.ollamaBaseUrl", "").trim(),
          sessionDir: sessionDir || "extension-managed storage",
        },
        context: {
          includeActiveFileContext,
        },
        mode: {
          active: mode,
        },
        intent: intentSettingsSnapshot(),
        onboarding: {
          // @see docs/specs/100-package-shared/spec.md [FR-12]
          specModeOfferDismissed:
            deps.workspaceState?.get<boolean>("afx.specModeOfferDismissed", false) ?? false,
          specModeTooltipSeen:
            deps.workspaceState?.get<boolean>("afx.specModeTooltipSeen", false) ?? false,
          docActionsTooltipSeen:
            deps.workspaceState?.get<boolean>("afx.docActionsTooltipSeen", false) ?? false,
        },
        providers: await groupProviders(
          models,
          cfg.get<string>("sdk.defaultModel", "anthropic:claude-opus-4-5"),
          cfg.get<string>("sdk.ollamaBaseUrl", "").trim(),
          secretStore,
        ),
        externalAgents: groupExternalAgents(models, { agentBinary, rpcEnabled, ephemeral }),
        experimental: {
          canvasEnabled,
          canvasPath: ".afx/project.canvas",
          workbenchHiddenViews,
        },
        // @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-10]
        // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
        ...(customProvidersService
          ? { customModels: await customProvidersService.getSnapshot() }
          : {}),
        skills: buildSkillsSnapshot(cfg, {
          bundledSkillCount,
          workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        }),
        diagnostics: { logLevel: cfg.get<string>("logLevel", "info") },
        telemetry: {
          enabled: telemetryEnabled,
          vscodeTelemetryEnabled: vscode.env.isTelemetryEnabled,
          effectiveEnabled: telemetryEnabled && vscode.env.isTelemetryEnabled,
        },
        about: {
          extensionVersion,
          bundledAfxSkillsVersion,
          bundledPiNpmVersion,
        },
      };
      post({ type: "agent/settingsSnapshot", requestId, snapshot });
      if (workspaceModeOverride && workspaceModeOverride === persistedWorkspaceMode()) {
        workspaceModeOverride = null;
      }
    } catch (err) {
      log.error("settings snapshot failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  function buildSkillsSnapshot(
    cfg: vscode.WorkspaceConfiguration,
    { bundledSkillCount, workspaceRoot }: { bundledSkillCount: number; workspaceRoot?: string },
  ): NonNullable<SettingsSnapshot["skills"]> {
    const projectTrust = normalizeProjectTrust(cfg.get<string>("pi.projectTrust", "ask"));
    const workspaceHasResources = workspaceRoot ? hasWorkspacePiResources(workspaceRoot) : false;
    const effectiveProjectTrust =
      projectTrust === "trust"
        ? "trust"
        : projectTrust === "ignore" || workspaceHasResources
          ? "ignore"
          : "none";
    const customPaths = normalizeStringList(
      cfg.get<readonly string[]>("skills.extraPaths", []),
    ).map((rawPath) => buildSkillPathSnapshot("custom", "Custom skills", rawPath, workspaceRoot));
    return {
      bundledSkillsPath,
      bundledSkillCount,
      globalPaths: [
        buildSkillPathSnapshot("global", "Pi global skills", path.join(piAgentDir, "skills")),
        buildSkillPathSnapshot(
          "global",
          "Agent Skills global",
          path.join(homedir(), ".agents", "skills"),
        ),
      ],
      workspacePaths: workspaceRoot
        ? [
            buildSkillPathSnapshot(
              "workspace",
              "Pi workspace skills",
              path.join(workspaceRoot, ".pi", "skills"),
              workspaceRoot,
              effectiveProjectTrust === "trust",
            ),
            buildSkillPathSnapshot(
              "workspace",
              "Agent Skills workspace",
              path.join(workspaceRoot, ".agents", "skills"),
              workspaceRoot,
              effectiveProjectTrust === "trust",
            ),
          ]
        : [],
      customPaths,
      projectTrust,
      effectiveProjectTrust,
      excludedTools: normalizeStringList(cfg.get<readonly string[]>("pi.excludedTools", [])),
      httpProxy: cfg.get<string>("network.httpProxy", "").trim(),
    };
  }

  function buildSkillPathSnapshot(
    kind: NonNullable<SettingsSnapshot["skills"]>["globalPaths"][number]["kind"],
    label: string,
    rawPath: string,
    workspaceRoot?: string,
    trusted?: boolean,
  ): NonNullable<SettingsSnapshot["skills"]>["globalPaths"][number] {
    const resolvedPath = resolveUserPath(rawPath, workspaceRoot);
    return {
      kind,
      label,
      path: resolvedPath,
      exists: existsSync(resolvedPath),
      ...(trusted !== undefined ? { trusted } : {}),
    };
  }

  function resolveUserPath(value: string, workspaceRoot?: string): string {
    if (value === "~") return homedir();
    if (value.startsWith("~/")) return path.join(homedir(), value.slice(2));
    if (path.isAbsolute(value)) return value;
    return workspaceRoot ? path.resolve(workspaceRoot, value) : path.resolve(value);
  }

  function normalizeProjectTrust(
    value: string | undefined,
  ): NonNullable<SettingsSnapshot["skills"]>["projectTrust"] {
    return value === "trust" || value === "ignore" ? value : "ask";
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

  function hasWorkspacePiResources(workspaceRoot: string): boolean {
    return [
      path.join(workspaceRoot, ".pi", "settings.json"),
      path.join(workspaceRoot, ".pi", "SYSTEM.md"),
      path.join(workspaceRoot, ".pi", "APPEND_SYSTEM.md"),
      path.join(workspaceRoot, ".pi", "skills"),
      path.join(workspaceRoot, ".pi", "prompts"),
      path.join(workspaceRoot, ".pi", "themes"),
      path.join(workspaceRoot, ".pi", "extensions"),
      path.join(workspaceRoot, ".agents", "skills"),
    ].some((candidate) => existsSync(candidate));
  }

  async function handleOpenSkillPath(requestId: string, targetPath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(targetPath);
      const stat = await vscode.workspace.fs.stat(uri);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- VS Code FileType is a bitmask.
      if ((stat.type & vscode.FileType.Directory) === vscode.FileType.Directory) {
        const skillFile = vscode.Uri.file(path.join(targetPath, "SKILL.md"));
        try {
          await vscode.workspace.fs.stat(skillFile);
          await vscode.window.showTextDocument(skillFile, { preview: false });
        } catch {
          await vscode.commands.executeCommand("revealFileInOS", uri);
        }
        return;
      }
      await vscode.window.showTextDocument(uri, { preview: false });
    } catch (err) {
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleRevealSkillPath(requestId: string, targetPath: string): Promise<void> {
    try {
      await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(targetPath));
    } catch (err) {
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetProjectTrust(
    requestId: string,
    value: NonNullable<SettingsSnapshot["skills"]>["projectTrust"],
  ): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("pi.projectTrust", value, vscode.ConfigurationTarget.Workspace);
      await deps.reconfigureAgentRuntimes?.("Pi project trust changed");
      await handleGetSettingsSnapshot(requestId);
      await handleGetCommands(requestId);
    } catch (err) {
      log.error("set Pi project trust failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleCreateSkill(requestId: string): Promise<void> {
    try {
      const cfg = vscode.workspace.getConfiguration("afx");
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const targets = createSkillTargets(cfg, workspaceRoot);
      const target =
        targets.length === 1
          ? targets[0]
          : await vscode.window.showQuickPick(targets, {
              placeHolder: "Choose where to create the skill",
            });
      if (!target) return;
      const nameInput = await vscode.window.showInputBox({
        prompt: "Skill name",
        placeHolder: "my-skill",
        validateInput: (value) =>
          normalizeSkillName(value) === value.trim()
            ? undefined
            : "Use lowercase letters, numbers, and hyphens.",
      });
      const skillName = normalizeSkillName(nameInput ?? "");
      if (!skillName) return;
      const skillDir = path.join(target.path, skillName);
      const skillFile = path.join(skillDir, "SKILL.md");
      if (existsSync(skillFile)) {
        throw new Error(`Skill already exists: ${skillFile}`);
      }
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(skillFile, createSkillTemplate(skillName), "utf8");
      await vscode.window.showTextDocument(vscode.Uri.file(skillFile), { preview: false });
      await deps.reconfigureAgentRuntimes?.("Pi skill created");
      await handleGetSettingsSnapshot(requestId);
      await handleGetCommands(requestId);
    } catch (err) {
      log.error("create skill failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  function createSkillTargets(
    cfg: vscode.WorkspaceConfiguration,
    workspaceRoot?: string,
  ): Array<{ label: string; description: string; path: string }> {
    const targets = [
      {
        label: "Global Pi skills",
        description: path.join(piAgentDir, "skills"),
        path: path.join(piAgentDir, "skills"),
      },
    ];
    if (workspaceRoot) {
      targets.push({
        label: "Workspace skills",
        description: path.join(workspaceRoot, ".agents", "skills"),
        path: path.join(workspaceRoot, ".agents", "skills"),
      });
    }
    for (const rawPath of normalizeStringList(
      cfg.get<readonly string[]>("skills.extraPaths", []),
    )) {
      const resolvedPath = resolveUserPath(rawPath, workspaceRoot);
      targets.push({
        label: `Custom: ${rawPath}`,
        description: resolvedPath,
        path: resolvedPath,
      });
    }
    return targets;
  }

  function normalizeSkillName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);
  }

  function createSkillTemplate(skillName: string): string {
    return `---\nname: ${skillName}\ndescription: Describe when ${skillName} should be used.\n---\n\n# ${formatSkillTitle(skillName)}\n\n## Instructions\n\nAdd the workflow, constraints, and examples this skill should teach the agent.\n`;
  }

  function formatSkillTitle(skillName: string): string {
    return skillName
      .split("-")
      .filter(Boolean)
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  async function handleSetProviderApiKey(
    requestId: string,
    provider: string,
    key: string | undefined,
    config?: Record<string, string>,
  ): Promise<void> {
    try {
      if (config) {
        await vscode.commands.executeCommand("afx.setProviderApiKey", provider, key, config);
      } else {
        await vscode.commands.executeCommand("afx.setProviderApiKey", provider, key);
      }
      const normalizedProvider = normalizeProviderId(provider);
      if (key?.trim() && PROVIDER_DETAILS[normalizedProvider]?.oauthCapable && oauthService) {
        await oauthService.setAuthMethod(normalizedProvider, "api-key");
        const status = await oauthService.getStatus(normalizedProvider);
        post({ type: "oauth/status", requestId, ok: true, status });
      }
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("set provider key failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleClearProviderApiKey(requestId: string, provider: string): Promise<void> {
    try {
      await vscode.commands.executeCommand("afx.clearProviderApiKey", provider);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("clear provider key failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetProviderDefaultModel(
    requestId: string,
    provider: string,
    modelId: string,
  ): Promise<void> {
    try {
      await updateSdkDefaultModel(provider, modelId);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("set provider default model failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleDetectPiBinary(requestId: string): Promise<void> {
    try {
      await vscode.commands.executeCommand("afx.detectPiBinary");
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("detect Pi binary failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetRpcEnabled(requestId: string, enabled: boolean): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("rpc.enabled", enabled, vscode.ConfigurationTarget.Global);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("set Pi RPC enabled failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetEphemeralSession(requestId: string, enabled: boolean): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("agentEphemeralSession", enabled, vscode.ConfigurationTarget.Global);
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set ephemeral session failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetTelemetryEnabled(requestId: string, enabled: boolean): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("telemetry.enabled", enabled, vscode.ConfigurationTarget.Global);
      postTelemetryState();
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set telemetry enabled failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetExperimentalCanvasEnabled(
    requestId: string,
    enabled: boolean,
  ): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("experimental.canvas", enabled, vscode.ConfigurationTarget.Global);
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set experimental canvas failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetWorkbenchHiddenViews(
    requestId: string,
    hidden: readonly WorkbenchViewId[],
  ): Promise<void> {
    try {
      const normalized = normalizeWorkbenchViewIds(hidden);
      await updateAfxConfigurationWithWorkspaceFallback(
        "experimental.workbenchHiddenViews",
        normalized,
        vscode.ConfigurationTarget.Workspace,
        log,
      );
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set Workbench hidden views failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetIntentSlot(requestId: string, slot: IntentSlot): Promise<void> {
    try {
      const normalized = normalizeIntentSlot(slot);
      await updateAfxConfigurationWithWorkspaceFallback(
        "composer.intent.slot",
        normalized,
        configurationTargetFor("composer.intent.slot"),
        log,
      );
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set Intent slot failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetIntentMinimized(requestId: string, minimized: boolean): Promise<void> {
    try {
      await updateAfxConfigurationWithWorkspaceFallback(
        "composer.intent.minimized",
        minimized,
        configurationTargetFor("composer.intent.minimized"),
        log,
      );
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set Intent minimized failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetIntentScope(
    requestId: string,
    scope: "global" | "workspace",
    state: Partial<ComposerIntentState>,
  ): Promise<void> {
    try {
      const cfg = vscode.workspace.getConfiguration("afx");
      if (scope === "global") {
        if (state.slot !== undefined) {
          await cfg.update(
            "composer.intent.slot",
            normalizeIntentSlot(state.slot),
            vscode.ConfigurationTarget.Global,
          );
        }
        if (state.minimized !== undefined) {
          await cfg.update(
            "composer.intent.minimized",
            state.minimized === true,
            vscode.ConfigurationTarget.Global,
          );
        }
        await cfg.update("composer.intent.slot", undefined, vscode.ConfigurationTarget.Workspace);
        await cfg.update(
          "composer.intent.minimized",
          undefined,
          vscode.ConfigurationTarget.Workspace,
        );
        await handleGetSettingsSnapshot(requestId);
        return;
      }

      if (state.slot !== undefined) {
        await cfg.update(
          "composer.intent.slot",
          normalizeIntentSlot(state.slot),
          vscode.ConfigurationTarget.Workspace,
        );
      }
      if (state.minimized !== undefined) {
        await cfg.update(
          "composer.intent.minimized",
          state.minimized === true,
          vscode.ConfigurationTarget.Workspace,
        );
      }
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set Intent scope failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleClearIntentWorkspace(requestId: string): Promise<void> {
    try {
      const cfg = vscode.workspace.getConfiguration("afx");
      await cfg.update("composer.intent.slot", undefined, vscode.ConfigurationTarget.Workspace);
      await cfg.update(
        "composer.intent.minimized",
        undefined,
        vscode.ConfigurationTarget.Workspace,
      );
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("clear Intent workspace override failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetIncludeActiveFileContext(
    requestId: string,
    enabled: boolean,
  ): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("context.includeActiveFileContext", enabled, vscode.ConfigurationTarget.Global);
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set active file context failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleUpdateAppearance(
    requestId: string,
    themeValue: string | undefined,
    styleValue: string | undefined,
  ): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("afx");
    const current = appearanceSnapshotFromConfig(cfg);
    const theme = themeValue === undefined ? current.theme : normalizeTheme(themeValue);
    const style = styleValue === undefined ? current.style : normalizeStyle(styleValue);

    if (!theme || !style) {
      postError(
        requestId,
        "Unknown appearance value. AFX kept the current theme/style settings.",
        "settings-toast",
      );
      return;
    }

    try {
      await Promise.all([
        themeValue === undefined
          ? Promise.resolve()
          : cfg.update("theme", theme, vscode.ConfigurationTarget.Global),
        styleValue === undefined
          ? Promise.resolve()
          : cfg.update("style", style, vscode.ConfigurationTarget.Global),
      ]);
      const appearance = appearanceSnapshotFromValues(theme, style);
      post({ type: "agent/appearanceUpdated", requestId, appearance });
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("appearance update failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleAbort(): Promise<void> {
    try {
      await agentManager.abort();
    } catch (err) {
      log.error("abort failed", err instanceof Error ? err : undefined);
    }
    const finishedId = clearStreamingState("aborted");
    post({ type: "chat/aborted" });
    recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel });
    void fetchAndEmitUsage(finishedId ?? undefined);
  }

  /**
   * History — list/load/reopen/delete persisted sessions. Listing and reading are
   * out-of-band (the runtime stays untouched); reopen repoints the live runtime via
   * `switchSession` and rehydrates the Chat view through the standard `chat/state`
   * snapshot.
   *
   * @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [FR-19]
   * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-BRIDGE] [DES-PERSISTENT-FLOW]
   */
  async function handleHistoryCommand(
    msg:
      | { type: "session/list"; requestId?: string; allWorkspaces?: boolean }
      | { type: "history/load"; requestId?: string; sessionPath: string }
      | { type: "history/reopen"; requestId?: string; sessionPath: string }
      | { type: "session/delete"; requestId?: string; sessionPath: string }
      | { type: "session/revealCwd"; requestId?: string; cwd: string },
  ): Promise<void> {
    switch (msg.type) {
      case "session/list": {
        const result = await historyService.listSessions(
          msg.allWorkspaces ? { allWorkspaces: true } : undefined,
        );
        post({
          type: "session/list",
          ...(msg.requestId ? { requestId: msg.requestId } : {}),
          supported: result.supported,
          sessions: result.sessions,
        });
        return;
      }
      case "history/load": {
        const entries = await historyService.getTranscript(msg.sessionPath);
        post({
          type: "history/loaded",
          ...(msg.requestId ? { requestId: msg.requestId } : {}),
          sessionPath: msg.sessionPath,
          entries,
        });
        return;
      }
      case "history/reopen": {
        try {
          const switched = agentManager.switchSession
            ? await agentManager.switchSession(msg.sessionPath)
            : { cancelled: true };
          if (switched.cancelled) return;
        } catch (err) {
          log.error("history reopen failed", err instanceof Error ? err : undefined);
          return;
        }
        const entries = await historyService.getTranscript(msg.sessionPath);
        const { messages, tools } = transcriptToTimeline(entries);
        state.messages = messages;
        state.tools = tools;
        state.isStreaming = false;
        state.lastUsageTotals = null;
        postSnapshot();
        void broadcastRuntimeSettings();
        return;
      }
      case "session/delete": {
        try {
          await historyService.deleteSession(msg.sessionPath);
        } catch (err) {
          log.error("history delete failed", err instanceof Error ? err : undefined);
        }
        const result = await historyService.listSessions();
        post({ type: "session/list", supported: result.supported, sessions: result.sessions });
        return;
      }
      case "session/revealCwd": {
        // Open only cwd values discovered from persisted sessions, never an arbitrary
        // webview-supplied path.
        const cwd = msg.cwd.trim();
        if (!cwd) return;
        const result = await historyService.listSessions({ allWorkspaces: true });
        if (result.sessions.some((session) => session.cwd === cwd)) {
          void vscode.env.openExternal(vscode.Uri.file(cwd));
        }
        return;
      }
    }
  }

  async function handleNewSession(): Promise<void> {
    try {
      await agentManager.newSession();
    } catch (err) {
      log.error("newSession failed", err instanceof Error ? err : undefined);
    }
    state.messages = [];
    state.tools = [];
    state.isStreaming = false;
    state.currentAssistantId = null;
    state.currentAssistantSourceId = null;
    state.lastAssistantId = null;
    state.currentRequestId = null;
    state.suppressNextUserMessageStart = false;
    state.currentTurnSawRuntimeEvent = false;
    pendingContextOverflowError = null;
    pendingRetryableError = null;
    retryToastRequestId = null;
    state.lastUsageTotals = null;
    queuedUserDisplays.length = 0;
    pendingDeltas.clear();
    stagedImageAttachments.clear();
    lastTurnSend = null;
    clearTurnStartTimeout();
    clearOverflowRecoveryTimeout();
    clearRetryRecoveryTimeout();
    postSnapshot();
    void broadcastRuntimeSettings();
  }

  /**
   * Handles compaction — runs Pi's compact, replaces the message list with just a
   * summary card, and broadcasts the updated state.
   *
   * We do NOT try to match `firstKeptEntryId` against local message IDs because
   * Pi and AFX use independent ID schemes.
   *
   * Performance: creates a new array reference so React can efficiently diff and
   * unmount the old message components.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-6]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  async function handleCompact(requestId: string, customInstructions?: string): Promise<void> {
    if (state.isCompacting) {
      postError(requestId, "Compaction is already in progress.", "toast");
      return;
    }
    if (state.isStreaming) {
      postError(requestId, "Wait for the current turn to finish before compacting.", "toast");
      return;
    }

    beginManualCompaction();

    try {
      const result = await agentManager.compact(customInstructions);

      // Create a fresh array with only the summary — this gives React a new
      // reference so it can efficiently diff and unmount old message components.
      const compactionMsg: ChatCompactionView = {
        id: `compaction-${Date.now()}`,
        role: "compactionSummary",
        summary: result.summary || "Session history compacted.",
        tokensBefore: result.tokensBefore,
        estimatedTokensAfter: result.estimatedTokensAfter,
        createdAt: Date.now(),
      };
      state.messages = [compactionMsg];

      clearTurnStateAfterCompaction();

      // Broadcast the result and updated snapshot to the webview.
      post({ type: "agent/compacted", requestId, result });
      postSnapshot();
    } catch (err) {
      log.error("compact failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    } finally {
      finishManualCompaction();
    }
  }

  function beginManualCompaction(): void {
    state.isCompacting = true;
    recordRuntimeStatus({
      running: true,
      isStreaming: false,
      model: currentModel,
      isCompacting: true,
    });
    void broadcastRuntimeSettings();
  }

  function finishManualCompaction(): void {
    state.isCompacting = false;
    recordRuntimeStatus({
      running: true,
      isStreaming: state.isStreaming,
      model: currentModel,
      isCompacting: false,
    });
    void broadcastRuntimeSettings();
  }

  function clearTurnStateAfterCompaction(): void {
    state.isStreaming = false;
    state.currentRequestId = null;
    state.currentAssistantId = null;
    state.currentAssistantSourceId = null;
    state.lastAssistantId = null;
    state.suppressNextUserMessageStart = false;
    state.currentTurnSawRuntimeEvent = false;
    pendingDeltas.clear();
    clearTurnStartTimeout();
    clearPendingContextOverflow();
    clearPendingRetryableError();
    queuedUserDisplays.length = 0;
  }

  async function handleSteer(
    requestId: string,
    content: string,
    mentions: readonly string[] = [],
    intentSlot?: IntentSlot,
    imageAttachmentIds: readonly string[] = [],
  ): Promise<void> {
    if (!state.isStreaming) {
      postError(requestId, "Cannot steer: no turn is currently streaming.", "toast");
      restoreStagedAttachmentTray(imageAttachmentIds);
      return;
    }
    try {
      const images = peekImageAttachments(stagedImageAttachments, imageAttachmentIds);
      await enqueueQueueInjection(async (epoch) => {
        const inflated = await inflateMentionContext(
          content,
          normalizePromptMentions(content, mentions),
        );
        const prompt = prefixWorkspaceModePrompt(inflated, intentSlot);
        if (images) await agentManager.steer(prompt, images);
        else await agentManager.steer(prompt);
        commitImageAttachments(stagedImageAttachments, imageAttachmentIds);
        if (epoch !== queueInjectionEpoch) return;
        queuedUserDisplays.push({ content });
        void broadcastRuntimeSettings();
      });
    } catch (err) {
      log.error("agent.steer failed", err instanceof Error ? err : undefined, { requestId });
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function handleFollowUp(
    requestId: string,
    content: string,
    mentions: readonly string[] = [],
    intentSlot?: IntentSlot,
    imageAttachmentIds: readonly string[] = [],
  ): Promise<void> {
    if (!state.isStreaming) {
      postError(requestId, "Cannot queue follow-up: no turn is currently streaming.", "toast");
      restoreStagedAttachmentTray(imageAttachmentIds);
      return;
    }
    try {
      const images = peekImageAttachments(stagedImageAttachments, imageAttachmentIds);
      await enqueueQueueInjection(async (epoch) => {
        const inflated = await inflateMentionContext(
          content,
          normalizePromptMentions(content, mentions),
        );
        const prompt = prefixWorkspaceModePrompt(inflated, intentSlot);
        if (images) await agentManager.followUp(prompt, images);
        else await agentManager.followUp(prompt);
        commitImageAttachments(stagedImageAttachments, imageAttachmentIds);
        if (epoch !== queueInjectionEpoch) return;
        queuedUserDisplays.push({ content });
        void broadcastRuntimeSettings();
      });
    } catch (err) {
      log.error("agent.followUp failed", err instanceof Error ? err : undefined, { requestId });
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function handleExportSession(requestId: string): Promise<void> {
    try {
      if (!agentManager.exportHtml) {
        throw new Error("HTML export is not supported by the active runtime.");
      }
      const { path: exportedPath } = await agentManager.exportHtml();
      post({ type: "chat/sessionExported", requestId, ok: true });
      // The path stays host-side; the webview only learns success/failure.
      void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(exportedPath));
    } catch (err) {
      log.error("exportSession failed", err instanceof Error ? err : undefined, { requestId });
      post({
        type: "chat/sessionExported",
        requestId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleRenameSession(requestId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      postError(requestId, "Session name cannot be empty.", "toast");
      return;
    }
    try {
      if (!agentManager.setSessionName) {
        throw new Error("Renaming sessions is not supported by the active runtime.");
      }
      await agentManager.setSessionName(trimmed);
      await broadcastRuntimeSettings(requestId);
    } catch (err) {
      log.error("renameSession failed", err instanceof Error ? err : undefined, { requestId });
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function handleAbortRetry(requestId: string): Promise<void> {
    try {
      if (!agentManager.abortRetry) {
        throw new Error("Cancelling retries is not supported by the active runtime.");
      }
      await agentManager.abortRetry();
    } catch (err) {
      log.error("abortRetry failed", err instanceof Error ? err : undefined, { requestId });
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function handleSetRuntimeSetting(
    requestId: string,
    apply: () => Promise<void>,
  ): Promise<void> {
    try {
      await apply();
      await broadcastRuntimeSettings(requestId);
    } catch (err) {
      log.error("runtime setting failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function broadcastRuntimeSettings(requestId?: string): Promise<void> {
    try {
      const status = await agentManager.getStatus();
      post({
        type: "agent/runtimeSettings",
        requestId,
        settings: {
          thinkingLevel: status.thinkingLevel,
          availableThinkingLevels: status.availableThinkingLevels,
          steeringMode: status.steeringMode,
          followUpMode: status.followUpMode,
          autoCompactionEnabled: status.autoCompactionEnabled,
          autoRetryEnabled: status.autoRetryEnabled,
          isCompacting: state.isCompacting || status.isCompacting,
          sessionId: status.sessionId,
          sessionFile: status.sessionFile,
          sessionName: status.sessionName,
          messageCount: status.messageCount,
          pendingMessageCount: status.pendingMessageCount,
          rpcEnabled: status.rpcEnabled,
          runtimeConfigured: status.runtimeConfigured,
        },
      });
    } catch (err) {
      log.warn("broadcastRuntimeSettings failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const CONTENT_MENTION_RE = /(^|[^A-Za-z0-9\\])@([\w./_-]+)/g;
  const TRAILING_MENTION_PUNCTUATION_RE = /[),.;:]+$/g;

  function looksLikeWorkspaceFileMention(value: string): boolean {
    if (!value) return false;
    // Block common non-file mentions; AFX currently only resolves workspace files.
    if (value === "problems" || value === "terminal" || value === "git-changes") return false;
    // Likely commit hash (7-40 char hex); not supported as mentions.
    if (/^[a-f0-9]{7,40}$/i.test(value)) return false;
    // Absolute paths are rejected by the mention reader.
    if (value.startsWith("/")) return false;
    // Heuristic: prefer path-ish tokens; avoid random @words becoming "unavailable references".
    return value.includes("/") || value.includes(".") || value.startsWith(".");
  }

  function extractMentionsFromText(content: string): string[] {
    const seen = new Set<string>();
    const mentions: string[] = [];
    for (const match of content.matchAll(CONTENT_MENTION_RE)) {
      const raw = match[2];
      if (!raw) continue;
      const candidate = raw.replace(TRAILING_MENTION_PUNCTUATION_RE, "");
      if (!looksLikeWorkspaceFileMention(candidate)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      mentions.push(candidate);
    }
    return mentions;
  }

  function normalizeMentions(content: string, explicit: readonly string[] = []): string[] {
    const merged = [...explicit, ...extractMentionsFromText(content)].filter(
      (m) => m.trim().length > 0,
    );
    return Array.from(new Set(merged));
  }

  async function inflateMentionContext(
    content: string,
    mentions: readonly string[],
  ): Promise<string> {
    const uniqueMentions = Array.from(new Set(mentions.filter((m) => m.trim().length > 0)));
    if (uniqueMentions.length === 0) return content;

    const blocks: string[] = [];
    const unavailable: string[] = [];
    for (const mention of uniqueMentions) {
      const resolved = await readMentionFile(mention);
      if (resolved.ok) {
        blocks.push(
          [`### ${mention}`, `\`\`\`${languageForPath(mention)}`, resolved.content, "```"].join(
            "\n",
          ),
        );
      } else {
        unavailable.push(`@${mention} [unavailable: ${resolved.reason}]`);
      }
    }

    if (blocks.length === 0 && unavailable.length === 0) return content;
    return [
      "The user referenced these files:",
      "",
      ...blocks,
      ...(unavailable.length > 0 ? ["", "Unavailable references:", ...unavailable] : []),
      "",
      "Then asked:",
      content,
    ].join("\n");
  }

  async function readMentionFile(
    mention: string,
  ): Promise<{ ok: true; content: string } | { ok: false; reason: string }> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return { ok: false, reason: "no workspace folder" };
    if (path.isAbsolute(mention)) return { ok: false, reason: "absolute paths are not allowed" };

    const targetPath = path.resolve(root, mention);
    const relative = path.relative(root, targetPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return { ok: false, reason: "outside workspace" };
    }

    try {
      const uri = vscode.Uri.file(targetPath);
      const stat = await vscode.workspace.fs.stat(uri);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- bitwise check on FileType flags; symlink-to-file resolves to (FileType.File | FileType.SymbolicLink)
      if ((stat.type & vscode.FileType.File) !== vscode.FileType.File) {
        return { ok: false, reason: "not a regular file" };
      }
      if (stat.size > MENTION_FILE_CAP_BYTES) {
        return { ok: false, reason: "truncated: file too large" };
      }
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.slice(0, 512).includes(0)) return { ok: false, reason: "binary file" };
      return { ok: true, content: new TextDecoder("utf-8").decode(bytes) };
    } catch (err) {
      log.warn("mention read failed", {
        mention,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, reason: err instanceof Error ? err.message : "read failed" };
    }
  }

  async function countBundledSkills(): Promise<number> {
    if (bundledSkillCountCache !== null) return bundledSkillCountCache;
    if (bundledSkillCommandsCache !== null) {
      bundledSkillCountCache = bundledSkillCommandsCache.length;
      return bundledSkillCountCache;
    }
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(bundledSkillsPath));
      bundledSkillCountCache = entries.filter(
        ([, type]) => type === vscode.FileType.Directory,
      ).length;
    } catch (err) {
      log.warn("bundled skill count unavailable", {
        bundledSkillsPath,
        err: err instanceof Error ? err.message : String(err),
      });
      bundledSkillCountCache = 0;
    }
    return bundledSkillCountCache;
  }

  async function listBundledSkillCommands(): Promise<AgentCommand[]> {
    if (bundledSkillCommandsCache !== null) return bundledSkillCommandsCache;
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(bundledSkillsPath));
      const skillNames = entries
        .filter(([name, type]) => name.startsWith("afx-") && type === vscode.FileType.Directory)
        .map(([name]) => name);
      const commands = await Promise.all(
        skillNames.map(async (skillName): Promise<AgentCommand> => {
          const description = await readBundledSkillDescription(skillName);
          return {
            name: `skill:${skillName}`,
            description,
            source: "skill",
            sourceInfo: {
              path: path.join(bundledSkillsPath, skillName, "SKILL.md"),
              source: "path",
              scope: "bundled",
              origin: "package",
              baseDir: bundledSkillsPath,
            },
          };
        }),
      );
      bundledSkillCommandsCache = commands.sort(compareBundledSkillCommands);
      bundledSkillCountCache = bundledSkillCommandsCache.length;
    } catch (err) {
      log.warn("bundled skill commands unavailable", {
        bundledSkillsPath,
        err: err instanceof Error ? err.message : String(err),
      });
      bundledSkillCommandsCache = [];
      bundledSkillCountCache = 0;
    }
    return bundledSkillCommandsCache;
  }

  async function readBundledSkillDescription(skillName: string): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(
        vscode.Uri.file(path.join(bundledSkillsPath, skillName, "SKILL.md")),
      );
      return parseSkillDescription(new TextDecoder("utf-8").decode(bytes));
    } catch {
      return undefined;
    }
  }

  function compareBundledSkillCommands(a: AgentCommand, b: AgentCommand): number {
    const aName = a.name.replace(/^skill:/, "");
    const bName = b.name.replace(/^skill:/, "");
    const aIndex = AFX_SKILL_COMMAND_ORDER_INDEX.get(aName) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = AFX_SKILL_COMMAND_ORDER_INDEX.get(bName) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || aName.localeCompare(bName);
  }

  function mergeAgentCommands(
    runtimeCommands: readonly AgentCommand[],
    bundledCommands: readonly AgentCommand[],
  ): AgentCommand[] {
    const byKey = new Map<string, AgentCommand>();
    for (const command of bundledCommands) {
      byKey.set(agentCommandKey(command), command);
    }
    for (const command of runtimeCommands) {
      const key = agentCommandKey(command);
      const bundled = byKey.get(key);
      byKey.set(key, {
        ...bundled,
        ...command,
        description: command.description ?? bundled?.description,
        // A runtime may rediscover the same vendored core skill. Preserve the
        // extension-owned provenance so external `afx-*` skills are never
        // mistaken for the canonical bundled AgenticFlowX set.
        sourceInfo: bundled?.sourceInfo ?? command.sourceInfo,
      });
    }
    return [...byKey.values()];
  }

  function agentCommandKey(command: AgentCommand): string {
    return `${command.source}:${command.name}`;
  }

  function getOpenWorkspaceFilePaths(): Set<string> {
    const paths = new Set<string>();
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input as { uri?: vscode.Uri } | undefined;
        if (!input?.uri || input.uri.scheme !== "file") continue;
        const relative = toWorkspaceRelativePath(input.uri);
        if (relative) paths.add(relative);
      }
    }
    return paths;
  }

  function toWorkspaceRelativePath(uri: vscode.Uri): string | null {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return null;
    const relative = path.relative(root, uri.fsPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return relative.split(path.sep).join("/");
  }

  // ---------------------------------------------------------------------------
  // view provider
  // ---------------------------------------------------------------------------

  function resolveWebviewView(view: vscode.WebviewView): void {
    const chatDistPath = getAppDistPath(extensionUri, "chat");
    const localResourceRoots = chatDistPath ? [vscode.Uri.file(chatDistPath)] : [];

    view.webview.options = {
      enableScripts: true,
      localResourceRoots,
    };
    view.webview.html = loadWebviewHtml(view.webview, extensionUri, "chat", extensionMode);
    webview = view.webview;
    chatReady = false;

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      view.webview.onDidReceiveMessage((raw: unknown) => {
        if (!raw || typeof raw !== "object") return;
        const typed = raw as { type?: unknown };
        if (typeof typed.type !== "string") return;
        handleInbound(raw as ChatToAgent);
      }),
      runtimeMonitor.onStatus(postRuntimeStatus),
      view.onDidChangeVisibility(() => {
        if (view.visible) void runtimeMonitor.check();
      }),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) void runtimeMonitor.check();
      }),
      vscode.window.onDidChangeActiveTextEditor(() => {
        postActiveFileContext();
      }),
      agentManager.onEvent(handleAgentEvent),
      agentManager.onStderr(handleAgentStderr),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration("afx.telemetry.enabled")) return;
        postTelemetryState();
      }),
      vscode.env.onDidChangeTelemetryEnabled(() => {
        postTelemetryState();
      }),
    );

    view.onDidDispose(() => {
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* ignore */
        }
      }
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      clearTurnStartTimeout();
      clearOAuthRefreshTimer();
      stagedImageAttachments.clear();
      if (webview === view.webview) {
        webview = null;
        chatReady = false;
      }
    });
  }

  return {
    resolveWebviewView,
    async sendExternalPrompt(content: string): Promise<void> {
      const requestId = cryptoRandom();
      if (state.isStreaming) {
        await handleFollowUp(requestId, content);
        postChatToast({
          tone: "info",
          message: "Queued as follow-up",
          description: "AFX will run this after the current response completes.",
        });
        return;
      }
      await handleSend(requestId, content);
    },
    appendToDraft(content: string): Promise<void> {
      const insertion = content.trim();
      if (!insertion) return Promise.resolve();
      if (!webview || !chatReady) {
        pendingDraftMutations.push({ type: "chat/draftAppend", content: insertion });
        return Promise.resolve();
      }
      post({ type: "chat/draftAppend", content: insertion });
      return Promise.resolve();
    },
    openSettingsTarget(target: SettingsOpenTarget): Promise<void> {
      if (!webview || !chatReady) {
        pendingSettingsTargets.push(target);
        return Promise.resolve();
      }
      post({ type: "settings/openTarget", target });
      return Promise.resolve();
    },
    async refreshRuntimeConfiguration(): Promise<void> {
      if (!webview) return;
      const requestId = cryptoRandom();
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    },
    postActiveDocContext(payload: ActiveDocContextPayload): void {
      // @see docs/specs/100-package-shared/spec.md [FR-12]
      lastActiveDocContext = payload;
      if (!webview || !chatReady) return;
      post({
        type: "chat/activeDocContext",
        format: payload.format,
        section: payload.section,
        docKind: payload.docKind,
        feature: payload.feature,
        filePath: payload.filePath,
        approvalStatus: payload.approvalStatus,
        taskPhases: payload.taskPhases,
        signOff: payload.signOff,
        parsedFocuses: payload.parsedFocuses,
        specStatus: payload.specStatus,
        designStatus: payload.designStatus,
        tasksStatus: payload.tasksStatus,
        tasksCompleted: payload.tasksCompleted,
        tasksTotal: payload.tasksTotal,
        workSessionsTotal: payload.workSessionsTotal,
        workSessionsSigned: payload.workSessionsSigned,
        siblingPaths: payload.siblingPaths,
        sectionOffsets: payload.sectionOffsets,
      });
    },
    async refreshCustomModelsSnapshot(): Promise<void> {
      // @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-10]
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
      if (!webview) return;
      const requestId = cryptoRandom();
      await handleGetSettingsSnapshot(requestId);
    },
  };
}

/**
 * Pi owns both subscription credentials and provider API keys, but `/login`
 * only repairs subscription-backed providers. Keep recovery guidance aligned
 * with the selected provider instead of sending API-key users into OAuth.
 *
 * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-7]
 */
function piAuthFailureRemediation(runtimeLabel: string, provider: string): string {
  const prefix = `Authentication failed in ${runtimeLabel}. This external runtime owns its credentials; AFX Settings sign-in does not apply.`;
  const fallback = "Or switch the model picker to a model under API Providers.";

  if (provider === "openai-codex" || provider === "github-copilot") {
    return `${prefix} Open Pi CLI in a terminal, run /login, then retry. ${fallback}`;
  }

  if (provider === "anthropic") {
    return `${prefix} In Pi, run /login for a Claude subscription or configure ANTHROPIC_API_KEY for API access, then retry. ${fallback}`;
  }

  return `${prefix} Configure the ${provider} provider API key or environment in Pi, then retry. ${fallback}`;
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function cryptoRandom(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readChatImageAttachment(uri: vscode.Uri): Promise<StagedImageAttachment> {
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.size > CHAT_IMAGE_MAX_BYTES) {
    throw new Error(`${path.basename(uri.fsPath || uri.path)} is larger than 8 MB.`);
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  if (bytes.byteLength > CHAT_IMAGE_MAX_BYTES) {
    throw new Error(`${path.basename(uri.fsPath || uri.path)} is larger than 8 MB.`);
  }
  const mediaType = detectImageMediaType(bytes);
  if (!mediaType) {
    throw new Error(`${path.basename(uri.fsPath || uri.path)} is not a supported image.`);
  }
  const id = cryptoRandom();
  const name = path.basename(uri.fsPath || uri.path) || "image";
  return {
    id,
    name,
    mediaType,
    byteLength: bytes.byteLength,
    image: {
      type: "image",
      mimeType: mediaType,
      data: Buffer.from(bytes).toString("base64"),
    },
  };
}

function detectImageMediaType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

// Staged entries are read without deleting so a failed agent call keeps them
// available for retry; callers commit (delete) only after the send succeeds.
function peekImageAttachments(
  staged: Map<string, StagedImageAttachment>,
  ids: readonly string[],
): readonly AgentImageAttachment[] | undefined {
  const images: AgentImageAttachment[] = [];
  for (const id of ids) {
    const attachment = staged.get(id);
    if (!attachment) continue;
    images.push(attachment.image);
  }
  return images.length > 0 ? images : undefined;
}

function commitImageAttachments(
  staged: Map<string, StagedImageAttachment>,
  ids: readonly string[],
): void {
  for (const id of ids) staged.delete(id);
}

function parseFatalStderrError(line: string): string | undefined {
  const jsonMatch = line.match(/\{[\s\S]*\}\s*$/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as {
        error?: { message?: string; type?: string } | string;
        level?: string;
        severity?: string;
        type?: string;
        message?: string;
      };
      const level = `${obj.level ?? obj.severity ?? obj.type ?? ""}`.toLowerCase();
      const hasFatalLevel = level === "error" || level === "fatal";
      if (typeof obj.error === "string" && obj.error.length > 0) {
        return obj.error;
      }
      if (
        typeof obj.error === "object" &&
        typeof obj.error.message === "string" &&
        obj.error.message.length > 0
      ) {
        return obj.error.message;
      }
      if (hasFatalLevel && typeof obj.message === "string" && obj.message.length > 0) {
        return obj.message;
      }
    } catch {
      /* not JSON — fall through */
    }
  }
  const errMatch = line.match(
    /^\s*(?:Fatal|FATAL|Error|TypeError|RangeError|ReferenceError|SyntaxError):\s*(.+)$/,
  );
  if (errMatch?.[1]) return errMatch[1].trim();
  return undefined;
}

function formatRetryDelay(delayMs: number): string {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return "a moment";
  if (delayMs < 1_000) return `${Math.round(delayMs)}ms`;
  const seconds = delayMs / 1_000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

function extractToolSummary(result: unknown): string | undefined {
  const r = result as { content?: Array<{ type: string; text?: string }> } | undefined;
  const first = r?.content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") return undefined;
  const text = first.text.trim();
  if (text.length <= TOOL_SUMMARY_MAX) return text.slice(0, TOOL_SUMMARY_MAX);
  return text.slice(0, TOOL_SUMMARY_MAX) + "…";
}

/**
 * Extracts the first-changed line (1-indexed) from a tool result's `details`
 * payload. pi-mono's `edit` tool emits `result.details.firstChangedLine`; other
 * harnesses may populate the same field. Returns undefined when absent or invalid.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
function extractFirstChangedLine(result: unknown): number | undefined {
  const r = result as { details?: { firstChangedLine?: unknown } } | undefined;
  const v = r?.details?.firstChangedLine;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

async function groupProviders(
  models: readonly AgentModel[],
  sdkDefaultModel: string,
  ollamaBaseUrl: string,
  secretStore?: SecretStore,
): Promise<SettingsSnapshot["providers"]> {
  const byProvider = new Map<string, AgentModel[]>();
  for (const model of models) {
    if (model.source === "external-agent") continue;
    const provider = normalizeProviderId(model.provider);
    const providerModels = byProvider.get(provider) ?? [];
    providerModels.push(model);
    byProvider.set(provider, providerModels);
  }
  const [defaultProvider, defaultModelId] = parseModelRef(sdkDefaultModel);
  const providerIds = new Set<string>([...API_PROVIDER_IDS, ...byProvider.keys()]);
  if (ollamaBaseUrl || byProvider.has("ollama")) providerIds.add("ollama");

  const keyedProviders = new Set(
    (
      await Promise.all(
        [...providerIds].map(async (provider) =>
          secretStore && (await secretStore.getApiKey(provider)) ? provider : null,
        ),
      )
    ).filter((provider): provider is string => provider !== null),
  );
  const configuredProviders = new Set(
    (
      await Promise.all(
        [...providerIds].map(async (provider) => {
          if (!secretStore || !keyedProviders.has(provider)) return null;
          return (await providerHasRequiredConfig(secretStore, provider)) ? provider : null;
        }),
      )
    ).filter((provider): provider is string => provider !== null),
  );
  const configuredConfigFields = new Map(
    await Promise.all(
      [...providerIds].map(async (provider): Promise<[string, string[]]> => [
        provider,
        secretStore ? await getConfiguredProviderConfigFields(secretStore, provider) : [],
      ]),
    ),
  );

  // Redacted OAuth state per provider for the card method chooser / connected
  // surfaces — presence booleans + active method only; never tokens.
  // @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [NFR-1]
  // @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-SEC]
  const oauthState = new Map<
    string,
    { subscriptionConnected: boolean; activeMethod?: ProviderAuthMethod }
  >(
    await Promise.all(
      [...providerIds].map(
        async (
          provider,
        ): Promise<
          [string, { subscriptionConnected: boolean; activeMethod?: ProviderAuthMethod }]
        > => {
          if (!secretStore) return [provider, { subscriptionConnected: false }];
          const [record, activeMethod] = await Promise.all([
            secretStore.getOAuth(provider),
            secretStore.getAuthMethod(provider),
          ]);
          return [provider, { subscriptionConnected: record !== undefined, activeMethod }];
        },
      ),
    ),
  );

  return [...providerIds]
    .map((provider) => {
      const providerModels = byProvider.get(provider) ?? [];
      // Read OAuth capability flags from the catalog entry directly (not the
      // narrowed fallback) so the non-OAuth providers leave them undefined.
      const catalogEntry = PROVIDER_DETAILS[provider];
      const details = catalogEntry ?? {
        displayName: titleCase(provider),
        modelHint: "Models available from this provider",
      };
      const noKeyNeeded = provider === "ollama" && Boolean(ollamaBaseUrl);
      const oauth = oauthState.get(provider) ?? { subscriptionConnected: false };
      const configured =
        configuredProviders.has(provider) ||
        providerModels.length > 0 ||
        oauth.subscriptionConnected;
      const state: SettingsSnapshot["providers"][number]["state"] = noKeyNeeded
        ? "no-key-needed"
        : configured
          ? "configured"
          : keyedProviders.has(provider)
            ? "invalid"
            : "empty";
      return {
        id: provider,
        name: provider,
        displayName: details.displayName,
        modelCount: providerModels.length,
        state,
        modelHint: details.modelHint,
        defaultModel: provider === defaultProvider ? defaultModelId : undefined,
        models: providerModels,
        helpUrl: details.helpUrl,
        configFields: catalogEntry?.configFields ? [...catalogEntry.configFields] : undefined,
        configuredConfigFields: configuredConfigFields.get(provider),
        oauthCapable: catalogEntry?.oauthCapable,
        oauthFlow: catalogEntry?.oauthFlow,
        dualMethod: catalogEntry?.dualMethod,
        activeMethod: oauth.activeMethod,
        subscriptionConnected: oauth.subscriptionConnected,
      } satisfies SettingsSnapshot["providers"][number];
    })
    .sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
}

async function providerHasRequiredConfig(
  secretStore: SecretStore,
  provider: string,
): Promise<boolean> {
  const fields = (PROVIDER_DETAILS[provider]?.configFields ?? []).filter(
    (field) => field.required !== false,
  );
  if (fields.length === 0) return true;
  for (const field of fields) {
    if (!(await readProviderEnvVar(secretStore, field.envVar))) return false;
  }
  return true;
}

async function getConfiguredProviderConfigFields(
  secretStore: SecretStore,
  provider: string,
): Promise<string[]> {
  const fields = PROVIDER_DETAILS[provider]?.configFields ?? [];
  const configured: string[] = [];
  for (const field of fields) {
    if (await readProviderEnvVar(secretStore, field.envVar)) configured.push(field.id);
  }
  return configured;
}

function readProviderEnvVar(secretStore: SecretStore, envVar: string): Promise<string | undefined> {
  const store = secretStore as SecretStore & {
    getProviderEnvVar?: (name: string) => Promise<string | undefined>;
  };
  return store.getProviderEnvVar?.(envVar) ?? Promise.resolve(undefined);
}

function groupExternalAgents(
  models: readonly AgentModel[],
  input: { agentBinary: string; rpcEnabled: boolean; ephemeral: boolean },
): SettingsSnapshot["externalAgents"] {
  if (!input.rpcEnabled) {
    return [
      {
        id: "pi",
        name: "Pi CLI",
        status: "disabled",
        modelCount: 0,
        binaryPath: input.agentBinary || "Auto-detect from PATH",
        enabled: false,
        ephemeral: input.ephemeral,
      },
    ];
  }

  const byInstance = new Map<string, AgentModel[]>();
  for (const model of models) {
    if (model.source !== "external-agent") continue;
    const instanceId = model.instanceId ?? "pi";
    const instanceModels = byInstance.get(instanceId) ?? [];
    instanceModels.push(model);
    byInstance.set(instanceId, instanceModels);
  }
  if (byInstance.size === 0) {
    return [
      {
        id: "pi",
        name: "Pi CLI",
        status: "unavailable",
        modelCount: 0,
        binaryPath: input.agentBinary || "Auto-detect from PATH",
        enabled: true,
        ephemeral: input.ephemeral,
      },
    ];
  }
  return [...byInstance.entries()].map(([id, instanceModels]) => ({
    id,
    name: instanceModels[0]?.instanceLabel ?? titleCase(id),
    status: "connected",
    modelCount: instanceModels.length,
    binaryPath: input.agentBinary || "Auto-detect from PATH",
    enabled: true,
    ephemeral: input.ephemeral,
  }));
}

function parseModelRef(value: string): [provider: string, modelId: string | undefined] {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) return ["anthropic", undefined];
  return [normalizeProviderId(trimmed.slice(0, separator)), trimmed.slice(separator + 1)];
}

function isApiProviderModel(model: AgentModel, requestedInstanceId?: string): boolean {
  return (
    model.source === "api-provider" ||
    model.instanceId === "pi-sdk" ||
    requestedInstanceId === "pi-sdk"
  );
}

function isSameProviderAuthMethodFlip(
  previous: AgentRuntimeModel | undefined,
  provider: string,
  instanceId: string | undefined,
  authMethod: AgentRuntimeModel["authMethod"] | undefined,
): boolean {
  if (authMethod !== "subscription" && authMethod !== "api-key") return false;
  if (!previous || (previous.authMethod !== "subscription" && previous.authMethod !== "api-key")) {
    return false;
  }
  const nextInstance = instanceId ?? previous.instanceId ?? "pi-sdk";
  return (
    nextInstance === "pi-sdk" &&
    (previous.instanceId ?? "pi-sdk") === "pi-sdk" &&
    normalizeProviderId(previous.provider) === normalizeProviderId(provider) &&
    previous.authMethod !== authMethod
  );
}

function isNoConfiguredRuntimeError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (/no configured agent runtime/i.test(err.message) ||
      /no agent runtime configured/i.test(err.message))
  );
}

function formatModelSwitchInfo(model: AgentModel): string {
  const source =
    model.source === "external-agent" ? (model.instanceLabel ?? "External agent") : "API provider";
  const provider =
    PROVIDER_DETAILS[normalizeProviderId(model.provider)]?.displayName ?? titleCase(model.provider);
  return `Switched to ${provider} — ${model.name || model.id} (${model.id}). Runtime: ${source}.`;
}

function formatModeSwitchInfo(mode: WorkspaceMode): string {
  if (mode === "explore") return "Switched to Explore mode. Read-only guardrails are active.";
  if (mode === "spec") return "Switched to Spec mode. Planning-only guardrails are active.";
  return "Switched to Code mode. Normal workspace actions are available.";
}

async function updateSdkDefaultModel(provider: string, modelId: string): Promise<void> {
  await vscode.workspace
    .getConfiguration("afx")
    .update(
      "sdk.defaultModel",
      formatSdkDefaultModel(provider, modelId),
      vscode.ConfigurationTarget.Global,
    );
}

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase();
}

function readBundledPiNpmVersion(extensionUri: vscode.Uri): string {
  try {
    const packageJsonPath = vscode.Uri.joinPath(
      extensionUri,
      "resources",
      "pi-sdk",
      "package.json",
    ).fsPath;
    const metadata = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      afxBundledPi?: { package?: unknown; version?: unknown };
    };
    const packageName = metadata.afxBundledPi?.package;
    const version = metadata.afxBundledPi?.version;
    if (typeof version !== "string" || version.trim().length === 0) return "?";
    if (typeof packageName !== "string" || packageName.trim().length === 0) {
      return version.trim();
    }
    return `${packageName.trim()}@${version.trim()}`;
  } catch {
    return "?";
  }
}

function titleCase(value: string): string {
  return value.replace(
    /(^|[-_\s])([a-z])/g,
    (_match, prefix: string, char: string) =>
      `${prefix === "-" || prefix === "_" ? " " : prefix}${char.toUpperCase()}`,
  );
}

function appearanceSnapshotFromConfig(
  cfg: vscode.WorkspaceConfiguration,
): RuntimeAppearanceSnapshot {
  const rawTheme = cfg.get<string>("theme", "meridian");
  const rawStyle = cfg.get<string>("style", "lyra");
  return appearanceSnapshotFromValues(
    normalizeTheme(rawTheme) ?? "meridian",
    normalizeStyle(rawStyle) ?? (rawTheme === "lyra" ? "lyra" : "lyra"),
  );
}

function appearanceSnapshotFromValues(
  theme: AfxThemeId,
  style: AfxStyleId,
): RuntimeAppearanceSnapshot {
  return {
    theme,
    style,
    themes: AFX_THEME_IDS.map((id) => ({
      id,
      label: id === "meridian" ? "AFX / Meridian" : id,
      implemented: true,
      description: "AFX identity and brass accents over VS Code host surfaces.",
    })),
    styles: AFX_STYLE_IDS.map((id) => ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      implemented: true,
      description:
        id === "lyra"
          ? "Compact, boxy shadcn treatment."
          : "Runtime treatment tokens over the Lyra primitive baseline.",
    })),
  };
}

function normalizeTheme(value: string): AfxThemeId | null {
  if (value === "lyra") return "meridian";
  return (AFX_THEME_IDS as readonly string[]).includes(value) ? (value as AfxThemeId) : null;
}

function normalizeStyle(value: string): AfxStyleId | null {
  return (AFX_STYLE_IDS as readonly string[]).includes(value) ? (value as AfxStyleId) : null;
}

function languageForPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    md: "markdown",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
  };
  return map[ext] ?? ext;
}
