/**
 * WorkbenchPanel — webview view provider for the bottom-panel workbench.
 * Pushes initial data, watches docs/specs/, dispatches inbound messages.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-2] [FR-8]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-LIFECYCLE] [DES-PANELS-DISPATCH]
 * @see docs/specs/220-app-workbench/spec.md [FR-3]
 * @see docs/specs/220-app-workbench/design.md [DES-WORKBENCH-HOST-PANEL] [DES-WORKBENCH-PROTOCOL]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-9] [FR-10]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LAUNCHPAD] [DES-API]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-3] [FR-12] [FR-19] [NFR-2] [NFR-5]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-HOST] [DES-ARCH] [DES-FILES]
 */
import * as path from "node:path";

import * as vscode from "vscode";

import {
  type Logger,
  type WorkbenchInbound,
  type WorkbenchMutationResult,
  type WorkbenchOutbound,
  isMarkdownPath,
  normalizeWorkbenchViewIds,
} from "@afx/shared";

import type { CanvasActionService } from "../services/canvas-action-service";
import {
  type CanvasContentPreviewService,
  createCanvasContentPreviewService,
  serializeCanvasSourcePreview,
  serializeCanvasUrlPreview,
} from "../services/canvas-content-preview-service";
import { PROJECT_CANVAS_PATH, createCanvasDataProvider } from "../services/canvas-data";
import type {
  CanvasEditSessionClient,
  CanvasEditSessionManager,
} from "../services/canvas-edit-session-manager";
import { createCanvasEditStream } from "../services/canvas-edit-stream";
import {
  type CanvasExportService,
  createCanvasExportService,
} from "../services/canvas-export-service";
import {
  findCanvasSubpathLine,
  makePortableCanvasFileReference,
  resolveCanvasFileReference,
} from "../services/canvas-file-reference";
import {
  type CanvasLibraryService,
  createCanvasLibraryService,
} from "../services/canvas-library-service";
import {
  type CanvasReferencePicker,
  createCanvasReferencePicker,
} from "../services/canvas-reference-picker";
import { postCanvasRequestFailure } from "../services/canvas-request-failure";
import { createDocGraphAuthorService } from "../services/doc-graph-author-service";
import {
  type KanbanBoardLifecycleService,
  createKanbanBoardLifecycleService,
} from "../services/kanban-board-lifecycle";
import { mutateKanbanMarkdown, parseKanbanMarkdown } from "../services/kanban-markdown";
import { toggleLinkedTaskItem } from "../services/linked-work-items";
import {
  type SpecDependencyIndexer,
  createSpecDependencyIndexer,
} from "../services/spec-dependency-indexer";
import { type SpecsDataProvider } from "../services/specs-data";
import { parseSprintPath, sliceSprintSection } from "../services/sprint";
import {
  type WorkbenchFileState,
  createWorkbenchFileState,
} from "../services/workbench-file-state";
import {
  type WorkbenchMutationCoordinator,
  createWorkbenchMutationCoordinator,
} from "../services/workbench-mutation-coordinator";
import {
  type NotesWorkspaceWriter,
  appendNoteToWorkspace,
  createNotesWorkspaceWriter,
} from "../utils/notes-utils";
import { type AfxPreviewDeps, openAfxPreview } from "./afx-preview-panel";
import {
  approveWorkSessionCheckboxes,
  toggleAllWorkSessionCheckboxes,
  toggleMarkdownCheckboxLine,
  toggleWorkSessionCheckbox,
  toggleWorkSessionCheckboxLine,
} from "./markdown-checkbox-toggle";
import { getAppDistPath, getAppearanceClass, loadWebviewHtml } from "./webview-html";

export const WORKBENCH_VIEW_TYPE = "afx-workbench";
const MARKDOWN_PREVIEW_EDITOR_ID = "vscode.markdown.preview.editor";
const WORKBENCH_REFRESH_DEBOUNCE_MS = 150;

export interface WorkbenchPanelDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  specsData?: SpecsDataProvider;
  fileState?: WorkbenchFileState;
  mutationCoordinator?: WorkbenchMutationCoordinator;
  notesWriter?: NotesWorkspaceWriter;
  workspaceState?: vscode.Memento;
  canvasActionService?: CanvasActionService;
  canvasEditSessionManager?: CanvasEditSessionManager;
  contentPreviewService?: CanvasContentPreviewService;
  referencePicker?: CanvasReferencePicker | null;
  canvasExportService?: CanvasExportService | null;
  logger?: Logger;
  openChatCommand?: (command: string, mode: "insert" | "send") => Promise<void>;
}

export function createWorkbenchPanel(deps: WorkbenchPanelDeps): vscode.WebviewViewProvider {
  const {
    extensionUri,
    extensionMode,
    specsData,
    fileState,
    mutationCoordinator,
    notesWriter,
    workspaceState,
    canvasActionService,
    canvasEditSessionManager,
    contentPreviewService,
    referencePicker,
    canvasExportService,
    logger,
    openChatCommand,
  } = deps;
  const log = logger?.child("workbench-panel");

  return {
    resolveWebviewView(view: vscode.WebviewView): void {
      const workbenchDistPath = getAppDistPath(extensionUri, "workbench");
      const localResourceRoots = [
        ...(workbenchDistPath ? [vscode.Uri.file(workbenchDistPath)] : []),
        ...(vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? []),
      ];

      view.webview.options = {
        enableScripts: true,
        localResourceRoots,
      };

      view.webview.html = loadWebviewHtml(view.webview, extensionUri, "workbench", extensionMode);

      function post(msg: WorkbenchInbound): void {
        view.webview
          .postMessage(msg)
          .then(undefined, (err) =>
            log?.error("postMessage failed", err instanceof Error ? err : undefined),
          );
      }

      function computeTelemetryEnabled(): boolean {
        const cfg = vscode.workspace.getConfiguration("afx");
        const enabledBySetting = cfg.get<boolean>("telemetry.enabled", true);
        return enabledBySetting && vscode.env.isTelemetryEnabled;
      }

      function computeCanvasEnabled(): boolean {
        return vscode.workspace.getConfiguration("afx").get<boolean>("experimental.canvas", false);
      }

      const ownedFileState = fileState ? undefined : createWorkbenchFileState();
      const activeFileState = fileState ?? ownedFileState;
      const activeContentPreviewService =
        contentPreviewService ??
        (activeFileState
          ? createCanvasContentPreviewService({ fileState: activeFileState })
          : undefined);
      const activeReferencePicker =
        referencePicker === null
          ? undefined
          : (referencePicker ??
            (activeFileState
              ? createCanvasReferencePicker({ fileState: activeFileState })
              : undefined));
      const activeCanvasExportService =
        canvasExportService === null
          ? undefined
          : (canvasExportService ?? createCanvasExportService());

      const canvasData = createCanvasDataProvider({
        getWorkspaceRoot: () => vscode.workspace.workspaceFolders?.[0]?.uri,
        isEnabled: computeCanvasEnabled,
        fileState: activeFileState,
        logger: log,
      });
      const ownedMutationCoordinator =
        mutationCoordinator || !activeFileState
          ? undefined
          : createWorkbenchMutationCoordinator({ fileState: activeFileState });
      const activeMutationCoordinator = mutationCoordinator ?? ownedMutationCoordinator;
      const activeNotesWriter =
        notesWriter ??
        (activeFileState && activeMutationCoordinator
          ? createNotesWorkspaceWriter({
              fileState: activeFileState,
              coordinator: activeMutationCoordinator,
            })
          : undefined);
      const canvasLibrary =
        activeFileState && activeMutationCoordinator
          ? createCanvasLibraryService({
              fileState: activeFileState,
              coordinator: activeMutationCoordinator,
              workspaceState,
            })
          : undefined;
      const kanbanBoardLifecycle =
        activeFileState && activeMutationCoordinator
          ? createKanbanBoardLifecycleService({
              fileState: activeFileState,
              coordinator: activeMutationCoordinator,
            })
          : undefined;
      const specDependencyIndexer = activeFileState
        ? createSpecDependencyIndexer({ fileState: activeFileState })
        : undefined;

      async function pushCanvasLibrary(): Promise<void> {
        if (!canvasLibrary || !computeCanvasEnabled()) return;
        const library = await canvasLibrary.list();
        post({ type: "afxCanvasLibrary", ...library });
        const document = await canvasLibrary.current();
        if (document) post({ type: "afxCanvasDocument", document });
      }

      async function pushUpdate(): Promise<void> {
        if (!specsData) return;
        const data = await specsData.getPanelData();
        const canvasFields = await canvasData.getCanvasUpdateFields();
        const hiddenViews = normalizeWorkbenchViewIds(
          vscode.workspace
            .getConfiguration("afx")
            .get<unknown>("experimental.workbenchHiddenViews", []),
        );
        post({ type: "afxUpdate", ...data, ...canvasFields, hiddenViews });
        await pushCanvasLibrary();
      }

      async function refreshAndPost(): Promise<void> {
        if (!specsData) return;
        specsData.refresh();
        await pushUpdate();
      }

      const sharedCanvasEditClient = canvasEditSessionManager?.connect((result) => {
        post(result);
        if (result.outcome === "success") void refreshAndPost();
      });
      const canvasEditStream =
        !sharedCanvasEditClient && activeFileState && activeMutationCoordinator
          ? createCanvasEditStream({
              apply: (request, expectedRevision) =>
                activeMutationCoordinator.mutateText({
                  requestId: request.requestId,
                  target: request.target,
                  expectedRevision,
                  allowCreate: true,
                  allowDirty: true,
                  transform: () => request.content,
                }),
              post: (result) => {
                post(result);
                if (result.outcome === "success") void refreshAndPost();
              },
              shouldApplyImmediately: (request) => {
                const uri = activeFileState.resolve(request.target);
                return Boolean(
                  uri &&
                  vscode.workspace.textDocuments.some(
                    (document) => document.uri.toString() === uri.toString(),
                  ),
                );
              },
            })
          : undefined;
      const canvasEditStager = sharedCanvasEditClient ?? canvasEditStream;

      const previewDeps: AfxPreviewDeps = { extensionUri, extensionMode, logger };

      view.webview.onDidReceiveMessage((raw: unknown) => {
        if (!raw || typeof raw !== "object" || !("type" in raw)) return;
        const msg = raw as WorkbenchOutbound;
        void handleMessage(
          msg,
          post,
          specsData,
          log,
          computeTelemetryEnabled,
          openChatCommand,
          previewDeps,
          pushUpdate,
          refreshAndPost,
          (content) => canvasData.markSavedContent(content),
          activeFileState,
          activeMutationCoordinator,
          canvasEditStager,
          activeNotesWriter,
          canvasLibrary,
          kanbanBoardLifecycle,
          specDependencyIndexer,
          canvasActionService,
          activeContentPreviewService,
          activeReferencePicker,
          activeCanvasExportService,
          (uri) => view.webview.asWebviewUri(uri).toString(),
        ).catch((error: unknown) => {
          // A rejected handler must never leave a correlated request hanging on
          // the webview watchdog — surface an error result and log it.
          log?.error(
            "workbench message handler failed",
            error instanceof Error ? error : undefined,
          );
          postCanvasRequestFailure(msg, post, error);
        });
      });

      // Push initial data after a short tick for webview startup races.
      setTimeout(() => {
        void pushUpdate();
      }, 250);

      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      let sourceSubscription: vscode.Disposable | undefined;
      let canvasWatcher: vscode.Disposable | undefined;
      const refresh = (): void => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          void refreshAndPost();
        }, WORKBENCH_REFRESH_DEBOUNCE_MS);
      };

      const startWatchers = (): void => {
        if (sourceSubscription) return;
        sourceSubscription = activeFileState?.onDidChange((change) => {
          if (change.kind === "canvas" && !computeCanvasEnabled()) return;
          const owner = activeFileState.identify(change.uri);
          if (owner) post({ type: "afxCanvasContentPreviewInvalidated", owner });
          if (isMarkdownPath(change.uri.path)) {
            if (owner) post({ type: "afxDocContentInvalidated", owner });
          }
          refresh();
        });
        canvasWatcher = canvasData.onDidChange(refresh);
      };
      const stopWatchers = (): void => {
        sourceSubscription?.dispose();
        sourceSubscription = undefined;
        canvasWatcher?.dispose();
        canvasWatcher = undefined;
      };
      if (view.visible) {
        startWatchers();
      }

      const configSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
        const appearanceChanged =
          event.affectsConfiguration("afx.theme") || event.affectsConfiguration("afx.style");
        const telemetryChanged = event.affectsConfiguration("afx.telemetry.enabled");
        const canvasChanged = event.affectsConfiguration("afx.experimental.canvas");
        const hiddenViewsChanged = event.affectsConfiguration(
          "afx.experimental.workbenchHiddenViews",
        );

        if (!appearanceChanged && !telemetryChanged && !canvasChanged && !hiddenViewsChanged) {
          return;
        }
        if (appearanceChanged) {
          post({ type: "afxAppearanceUpdated", appearanceClass: getAppearanceClass() });
        }
        if (telemetryChanged) {
          post({ type: "afxTelemetryUpdated", enabled: computeTelemetryEnabled() });
        }
        if (canvasChanged) {
          stopWatchers();
          if (view.visible) startWatchers();
          void pushUpdate();
        }
        if (hiddenViewsChanged && !canvasChanged) void pushUpdate();
      });
      const telemetrySubscription = vscode.env.onDidChangeTelemetryEnabled(() => {
        post({ type: "afxTelemetryUpdated", enabled: computeTelemetryEnabled() });
      });

      view.onDidDispose(() => {
        if (refreshTimer) clearTimeout(refreshTimer);
        stopWatchers();
        const disposeOwnedState = () => {
          canvasData.dispose();
          ownedMutationCoordinator?.dispose();
          ownedFileState?.dispose();
        };
        sharedCanvasEditClient?.dispose();
        if (canvasEditStream) void canvasEditStream.dispose().finally(disposeOwnedState);
        else disposeOwnedState();
        configSubscription.dispose();
        telemetrySubscription.dispose();
      });

      view.onDidChangeVisibility(() => {
        if (!view.visible) {
          stopWatchers();
          return;
        }
        startWatchers();
        void refreshAndPost();
      });
    },
  };
}

async function handleMessage(
  msg: WorkbenchOutbound,
  post: (m: WorkbenchInbound) => void,
  specsData: SpecsDataProvider | undefined,
  log: Logger | undefined,
  computeTelemetryEnabled: () => boolean,
  openChatCommand?: (command: string, mode: "insert" | "send") => Promise<void>,
  previewDeps?: AfxPreviewDeps,
  pushPanelUpdate?: () => Promise<void>,
  refreshPanelData?: () => Promise<void>,
  markCanvasSaved?: (content: string) => void,
  fileState?: WorkbenchFileState,
  mutationCoordinator?: WorkbenchMutationCoordinator,
  canvasEditStager?: Pick<CanvasEditSessionClient, "stage">,
  notesWriter?: NotesWorkspaceWriter,
  canvasLibrary?: CanvasLibraryService,
  kanbanBoardLifecycle?: KanbanBoardLifecycleService,
  specDependencyIndexer?: SpecDependencyIndexer,
  canvasActionService?: CanvasActionService,
  contentPreviewService?: CanvasContentPreviewService,
  referencePicker?: CanvasReferencePicker,
  canvasExportService?: CanvasExportService,
  toWebviewResource?: (uri: vscode.Uri) => string,
): Promise<void> {
  if (msg.type === "afxCopyMarkdown") {
    await vscode.env.clipboard.writeText(msg.content);
    return;
  }
  if (msg.type === "afxOpenSettings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      msg.setting ?? "afx.experimental.workbenchHiddenViews",
    );
    return;
  }
  if (msg.type === "afxCanvasPickReferences") {
    if (!referencePicker) {
      post({
        type: "afxCanvasReferencesPicked",
        requestId: msg.requestId,
        outcome: "error",
        references: [],
        message: "Canvas file picking is unavailable in this host.",
      });
      return;
    }
    try {
      log?.info(`canvas reference pick requested (kind=${msg.kind ?? "any"})`);
      const references = await referencePicker.pick({
        ...(msg.owner ? { owner: msg.owner } : {}),
        kind: msg.kind,
        allowMultiple: msg.allowMultiple,
      });
      log?.info(`canvas reference pick resolved (${references.length} reference(s))`);
      post(
        references.length > 0
          ? {
              type: "afxCanvasReferencesPicked",
              requestId: msg.requestId,
              outcome: "success",
              references,
            }
          : {
              type: "afxCanvasReferencesPicked",
              requestId: msg.requestId,
              outcome: "cancelled",
              references: [],
            },
      );
    } catch (error) {
      log?.error("canvas reference pick failed", error instanceof Error ? error : undefined);
      post({
        type: "afxCanvasReferencesPicked",
        requestId: msg.requestId,
        outcome: "error",
        references: [],
        message: error instanceof Error ? error.message : "The Canvas file picker failed.",
      });
    }
    return;
  }
  if (msg.type === "afxCanvasExport") {
    if (!canvasExportService) {
      post({
        type: "afxCanvasExportResult",
        requestId: msg.requestId,
        outcome: "error",
        code: "capability-unavailable",
        message: "Canvas export is unavailable in this host.",
      });
      return;
    }
    try {
      const result = await canvasExportService.export({
        format: msg.format,
        content: msg.content,
        encoding: msg.encoding,
        suggestedName: msg.suggestedName,
      });
      if (result.outcome === "success") {
        post({
          type: "afxCanvasExportResult",
          requestId: msg.requestId,
          outcome: "success",
          targetName: path.posix.basename(result.target.path.replace(/\\/g, "/")),
          byteLength: result.byteLength,
        });
      } else if (result.outcome === "cancelled") {
        post({ type: "afxCanvasExportResult", requestId: msg.requestId, outcome: "cancelled" });
      } else {
        post({ type: "afxCanvasExportResult", requestId: msg.requestId, ...result });
      }
    } catch (error) {
      post({
        type: "afxCanvasExportResult",
        requestId: msg.requestId,
        outcome: "error",
        code: "write-failed",
        message: error instanceof Error ? error.message : "The Canvas export failed.",
      });
    }
    return;
  }
  if (msg.type === "afxCanvasContentPreviewRequest") {
    if (!contentPreviewService) {
      post({
        type: "afxCanvasContentPreviewResult",
        requestId: msg.requestId,
        owner: msg.owner,
        preview: {
          kind: "file",
          state: "error",
          code: "read-failed",
          message: "Canvas content previews are unavailable in this host.",
        },
      });
      return;
    }
    const result = serializeCanvasSourcePreview(
      await contentPreviewService.previewSource(msg.owner),
      toWebviewResource,
    );
    post({
      type: "afxCanvasContentPreviewResult",
      requestId: msg.requestId,
      ...result,
    });
    return;
  }
  if (msg.type === "afxCanvasUrlPreviewRequest") {
    log?.info(`canvas url preview requested (${msg.url})`);
    const preview = contentPreviewService
      ? serializeCanvasUrlPreview(
          await contentPreviewService.previewUrl({
            url: msg.url,
            allowNetwork: msg.allowNetwork,
          }),
        )
      : {
          state: "offline" as const,
          code: "network-error" as const,
          message: "Canvas URL previews are unavailable in this host.",
        };
    log?.info(`canvas url preview resolved (state=${preview.state})`);
    post({
      type: "afxCanvasUrlPreviewResult",
      requestId: msg.requestId,
      url: msg.url,
      preview,
    });
    return;
  }
  if (msg.type === "afxOpenExternalUrl") {
    const uri = safeHttpUri(msg.url);
    if (uri) await vscode.env.openExternal(uri);
    else vscode.window.showWarningMessage("AgenticFlowX: only HTTP and HTTPS links can be opened.");
    return;
  }

  if (
    (msg.type === "afxCreateKanbanBoard" ||
      msg.type === "afxRenameKanbanBoard" ||
      msg.type === "afxDeleteKanbanBoard") &&
    typeof msg.requestId === "string"
  ) {
    const fallbackTarget = {
      rootUri:
        msg.type === "afxCreateKanbanBoard" ? msg.targetRootUri : (msg.target?.rootUri ?? ""),
      rootName:
        msg.type === "afxCreateKanbanBoard" ? "workspace" : (msg.target?.rootName ?? "workspace"),
      relativePath:
        msg.type === "afxCreateKanbanBoard"
          ? ".afx/kanban/invalid-board.md"
          : (msg.target?.relativePath ?? ".afx/kanban/unknown.md"),
    };
    let result: WorkbenchMutationResult;
    try {
      if (!kanbanBoardLifecycle) {
        result = {
          type: "afxMutationResult",
          requestId: msg.requestId,
          outcome: "error",
          target: fallbackTarget,
          code: "capability-unavailable",
          message: "Board lifecycle operations are unavailable in this Workbench host.",
          retryable: true,
        };
      } else if (
        (msg.type === "afxCreateKanbanBoard" && typeof msg.targetRootUri !== "string") ||
        (msg.type !== "afxCreateKanbanBoard" &&
          (!msg.target || typeof msg.expectedRevision !== "string"))
      ) {
        result = {
          type: "afxMutationResult",
          requestId: msg.requestId,
          outcome: "error",
          target: fallbackTarget,
          code: "parse-error",
          message: "Board lifecycle request is missing its source identity or revision.",
          retryable: false,
        };
      } else {
        result =
          msg.type === "afxCreateKanbanBoard"
            ? await kanbanBoardLifecycle.create(msg)
            : msg.type === "afxRenameKanbanBoard"
              ? await kanbanBoardLifecycle.rename(msg)
              : await kanbanBoardLifecycle.delete(msg);
      }
    } catch (cause) {
      result = {
        type: "afxMutationResult",
        requestId: msg.requestId,
        outcome: "error",
        target: fallbackTarget,
        code: "write-failed",
        message: cause instanceof Error ? cause.message : "Board lifecycle operation failed.",
        retryable: true,
      };
    }
    post(result);
    if (result.outcome === "success") await refreshAndPost();
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const primaryFolder = workspaceFolders[0];
  if (!primaryFolder) {
    if (msg.type === "afxOpenChatCommand" && openChatCommand) {
      await openChatCommand(msg.command, msg.mode);
    } else {
      postCanvasRequestFailure(
        msg,
        post,
        new Error("Canvas operations require an open workspace folder."),
      );
    }
    return;
  }
  const rootUri: vscode.Uri = primaryFolder.uri;

  function stripWorkspaceNamePrefix(normalizedPath: string, workspaceUri: vscode.Uri): string {
    const workspaceName = path.basename(workspaceUri.fsPath).replace(/\\/g, "/");
    return normalizedPath.startsWith(`${workspaceName}/`)
      ? normalizedPath.slice(workspaceName.length + 1)
      : normalizedPath;
  }

  async function resolvePath(p: string, requireExisting = false): Promise<vscode.Uri> {
    if (!p) return rootUri;
    const normalized = p.replace(/\\/g, "/");
    if (path.isAbsolute(normalized)) {
      return vscode.Uri.file(path.normalize(normalized));
    }

    const candidates: vscode.Uri[] = [];
    const seen = new Set<string>();
    for (const folder of workspaceFolders) {
      const rel = stripWorkspaceNamePrefix(normalized, folder.uri);
      const key = `${folder.uri.fsPath}::${rel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(vscode.Uri.joinPath(folder.uri, rel));
    }

    if (requireExisting) {
      for (const candidate of candidates) {
        const exists = await vscode.workspace.fs.stat(candidate).then(
          () => true,
          () => false,
        );
        if (exists) return candidate;
      }
    }

    const fallbackRel = stripWorkspaceNamePrefix(normalized, rootUri);
    return vscode.Uri.joinPath(rootUri, fallbackRel);
  }

  async function openMarkdownPreview(uri: vscode.Uri): Promise<void> {
    const errors: string[] = [];
    const attempt = async (
      label: string,
      run: () => Thenable<unknown> | Promise<unknown>,
    ): Promise<boolean> => {
      try {
        await run();
        return true;
      } catch (err) {
        errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    };

    if (
      await attempt("markdown.showPreviewToSide", () =>
        vscode.commands.executeCommand("markdown.showPreviewToSide", uri),
      )
    ) {
      return;
    }

    if (
      await attempt("vscode.openWith(markdown preview editor)", () =>
        vscode.commands.executeCommand("vscode.openWith", uri, MARKDOWN_PREVIEW_EDITOR_ID, {
          viewColumn: vscode.ViewColumn.Beside,
          preview: true,
        }),
      )
    ) {
      return;
    }

    if (
      await attempt("markdown.showPreview", () =>
        vscode.commands.executeCommand("markdown.showPreview", uri),
      )
    ) {
      return;
    }

    if (
      await attempt("showTextDocument + markdown.showPreviewToSide", async () => {
        await vscode.window.showTextDocument(uri, {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
        });
        await vscode.commands.executeCommand("markdown.showPreviewToSide");
      })
    ) {
      return;
    }

    throw new Error(errors.join(" | "));
  }

  async function refreshAndPost(): Promise<void> {
    if (refreshPanelData) {
      await refreshPanelData();
      return;
    }
    if (!specsData) return;
    specsData.refresh();
    const data = await specsData.getPanelData();
    post({ type: "afxUpdate", ...data });
  }

  try {
    switch (msg.type) {
      case "afxReady": {
        if (!specsData) return;
        if (pushPanelUpdate) {
          await pushPanelUpdate();
        } else {
          const data = await specsData.getPanelData();
          post({ type: "afxUpdate", ...data });
        }
        post({ type: "afxTelemetryUpdated", enabled: computeTelemetryEnabled() });
        return;
      }
      case "afxOpenFile": {
        const { path: realPath, section } = parseSprintPath(msg.path);
        const resolution = await resolveCanvasFileReference(realPath, {
          workspaceFolders,
          ...(msg.owner ? { owner: msg.owner } : {}),
        });
        if (!resolution.ok) {
          log?.warn(() => `afxOpenFile: ${resolution.message}`);
          vscode.window.showWarningMessage(`AgenticFlowX: ${resolution.message}`);
          return;
        }
        const uri = resolution.uri;
        if (msg.mode === "afxPreview") {
          if (previewDeps) openAfxPreview(previewDeps, uri);
          return;
        }
        if (msg.mode === "preview" && realPath.toLowerCase().endsWith(".md")) {
          try {
            await openMarkdownPreview(uri);
            return;
          } catch (err) {
            log?.warn(
              () =>
                `afxOpenFile: failed to open markdown preview (${realPath}) (${err instanceof Error ? err.message : String(err)})`,
            );
            vscode.window.showWarningMessage(
              `AgenticFlowX: unable to open markdown preview — ${realPath}`,
            );
            return;
          }
        }
        const opts: vscode.TextDocumentShowOptions = { preview: msg.mode === "preview" };
        let line: number | undefined =
          typeof msg.line === "number" ? Math.max(0, msg.line - 1) : undefined;
        if (section || msg.subpath) {
          const buf = await vscode.workspace.fs.readFile(uri).then(
            (b) => Buffer.from(b).toString("utf8"),
            () => null,
          );
          if (buf) {
            if (section) {
              const slice = sliceSprintSection(buf, section);
              if (slice) line = slice.startLine;
            } else {
              line = findCanvasSubpathLine(buf, msg.subpath) ?? line;
            }
          }
        }
        if (typeof line === "number") {
          opts.selection = new vscode.Range(line, 0, line, 0);
        }
        await vscode.window.showTextDocument(uri, opts);
        return;
      }
      case "afxOpenChatCommand": {
        if (!openChatCommand) return;
        await openChatCommand(msg.command, msg.mode);
        return;
      }
      case "afxPickMarkdownFile": {
        const picked = await vscode.window.showOpenDialog({
          title: "Add markdown to AFX Canvas",
          defaultUri: rootUri,
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { Markdown: ["md", "markdown"] },
        });
        const uri = picked?.[0];
        if (!uri) return;
        const filePath = msg.owner
          ? makePortableCanvasFileReference(uri, msg.owner, workspaceFolders)
          : formatPickedMarkdownPath(uri, workspaceFolders);
        if (!filePath) {
          vscode.window.showWarningMessage(
            "AgenticFlowX: Canvas file nodes must stay in the same workspace root as their Canvas. Open that root's Canvas before adding this file.",
          );
          return;
        }
        post({
          type: "afxMarkdownFilePicked",
          filePath,
        });
        return;
      }
      case "afxFetchDocContent": {
        const { path: realPath, section } = parseSprintPath(msg.filePath);
        const resolution = await resolveCanvasFileReference(realPath, {
          workspaceFolders,
          ...(msg.owner ? { owner: msg.owner } : {}),
        });
        if (!resolution.ok) {
          log?.warn(() => `afxFetchDocContent: ${resolution.message}`);
          post({
            type: "afxDocContent",
            filePath: msg.filePath,
            content: `> Canvas file reference blocked: ${resolution.message}`,
            ...(msg.requestId ? { requestId: msg.requestId } : {}),
            ...(msg.owner ? { owner: msg.owner } : {}),
          });
          return;
        }
        const uri = resolution.uri;
        let fullContent: string;
        try {
          const live = await fileState?.readText(uri);
          if (live) {
            fullContent = live.content;
            let content = fullContent;
            if (section) {
              const slice = sliceSprintSection(fullContent, section);
              if (slice) content = slice.content;
            }
            post({
              type: "afxDocContent",
              filePath: msg.filePath,
              content,
              ...(msg.requestId ? { requestId: msg.requestId } : {}),
              owner: live.source,
              revision: live.sourceRevision,
            });
            return;
          }
          const buf = await vscode.workspace.fs.readFile(uri);
          fullContent = Buffer.from(buf).toString("utf8");
        } catch (err) {
          log?.warn(
            () =>
              `afxFetchDocContent: read failed for ${realPath} (${err instanceof Error ? err.message : String(err)})`,
          );
          post({
            type: "afxDocContent",
            filePath: msg.filePath,
            content: `> File not found in workspace: \`${realPath}\``,
            ...(msg.requestId ? { requestId: msg.requestId } : {}),
            ...(msg.owner ? { owner: msg.owner } : {}),
          });
          return;
        }
        let content = fullContent;
        if (section) {
          const slice = sliceSprintSection(fullContent, section);
          if (slice) content = slice.content;
        }
        post({
          type: "afxDocContent",
          filePath: msg.filePath,
          content,
          ...(msg.requestId ? { requestId: msg.requestId } : {}),
          ...(fileState?.identify(uri) ? { owner: fileState.identify(uri) } : {}),
        });
        return;
      }
      case "afxSaveFile": {
        const { path: realPath, section } = parseSprintPath(msg.path);
        if (section) {
          log?.warn(
            () =>
              `refusing to save sprint section in place — open ${realPath} in editor (section ${section})`,
          );
          return;
        }
        const uri = await resolvePath(realPath);
        if (realPath.replace(/\\/g, "/") === PROJECT_CANVAS_PATH) {
          await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(rootUri, ".afx"));
        }
        await vscode.workspace.fs.writeFile(uri, Buffer.from(msg.content, "utf8"));
        if (realPath.replace(/\\/g, "/") === PROJECT_CANVAS_PATH) {
          markCanvasSaved?.(msg.content);
        }
        await refreshAndPost();
        return;
      }
      case "afxCanvasSave": {
        if (!mutationCoordinator) return;
        const result = await mutationCoordinator.mutateText({
          requestId: msg.requestId,
          target: msg.target,
          expectedRevision: msg.expectedRevision,
          allowCreate: true,
          transform: () => msg.content,
        });
        post(result);
        if (result.outcome === "success") await refreshAndPost();
        return;
      }
      case "afxCanvasEdit": {
        if (canvasEditStager) {
          canvasEditStager.stage(msg);
        } else {
          post({
            type: "afxCanvasEditResult",
            requestId: msg.requestId,
            sessionId: msg.sessionId,
            sequence: msg.sequence,
            outcome: "error",
            target: msg.target,
            code: "capability-unavailable",
            message: "Canvas editing is unavailable in this Workbench host.",
            retryable: true,
          });
        }
        return;
      }
      case "afxOpenCanvasEditor": {
        await vscode.commands.executeCommand("afx.openCanvasEditor", msg.target);
        return;
      }
      case "afxCanvasList": {
        if (!canvasLibrary) return;
        const library = await canvasLibrary.list();
        post({ type: "afxCanvasLibrary", ...library });
        const document = await canvasLibrary.current();
        if (document) post({ type: "afxCanvasDocument", document });
        return;
      }
      case "afxCanvasSelect": {
        const document = await canvasLibrary?.select(msg.canvasId);
        if (document) post({ type: "afxCanvasDocument", document });
        return;
      }
      case "afxCanvasCreate":
      case "afxCanvasRename":
      case "afxCanvasDuplicate":
      case "afxCanvasDelete": {
        if (!canvasLibrary) {
          // Never drop a correlated library request silently — the webview
          // would sit on its operation lock until the watchdog times out.
          post({
            type: "afxMutationResult",
            requestId: msg.requestId,
            outcome: "error",
            target:
              msg.type === "afxCanvasCreate"
                ? { rootUri: msg.targetRootUri, rootName: "workspace", relativePath: "" }
                : msg.target,
            code: "capability-unavailable",
            message: "Canvas library operations need an open workspace folder.",
            retryable: true,
          });
          return;
        }
        const result =
          msg.type === "afxCanvasCreate"
            ? await canvasLibrary.create(msg)
            : msg.type === "afxCanvasRename"
              ? await canvasLibrary.rename(msg)
              : msg.type === "afxCanvasDuplicate"
                ? await canvasLibrary.duplicate(msg)
                : await canvasLibrary.delete(msg);
        post(result);
        if (result.outcome === "success") await refreshAndPost();
        return;
      }
      case "afxCanvasRefreshDependencies": {
        log?.info("[spec-map v2] Sync specs starting (budgeted, docs/**-anchored)");
        if (!mutationCoordinator || !specDependencyIndexer) {
          post({
            type: "afxMutationResult",
            requestId: msg.requestId,
            outcome: "error",
            target: msg.target,
            code: "capability-unavailable",
            message: "Canvas dependency refresh is unavailable in this Workbench host.",
            retryable: true,
          });
          return;
        }
        const syncStartedAt = Date.now();
        let summary:
          | Awaited<ReturnType<SpecDependencyIndexer["refresh"]>>["diagnostics"]
          | undefined;
        const result = await mutationCoordinator.mutateText({
          requestId: msg.requestId,
          target: msg.target,
          expectedRevision: msg.expectedRevision,
          allowDirty: true,
          transform: async (content) => {
            const refreshed = await specDependencyIndexer.refresh(content, msg.target);
            summary = refreshed.diagnostics;
            return refreshed.content;
          },
        });
        log?.info(`[spec-map v2] Sync specs ${result.outcome} in ${Date.now() - syncStartedAt}ms`);
        post(result);
        if (result.outcome === "success") {
          await refreshAndPost();
          const issueCount =
            (summary?.unresolved.length ?? 0) +
            (summary?.ambiguous.length ?? 0) +
            (summary?.cycles.length ?? 0);
          if (issueCount > 0) {
            vscode.window.showWarningMessage(
              `AgenticFlowX: dependency map refreshed with ${issueCount} issue${issueCount === 1 ? "" : "s"}.`,
            );
          } else {
            vscode.window.showInformationMessage("AgenticFlowX: dependency map refreshed.");
          }
        }
        return;
      }
      case "afxCanvasDocIndex": {
        const roots = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.name);
        log?.info(
          `[spec-map v2] doc-index scan starting (roots: ${roots.join(", ") || "none"}, indexer: ${Boolean(specDependencyIndexer)})`,
        );
        const entries = specDependencyIndexer ? await specDependencyIndexer.index() : [];
        log?.info(`[spec-map v2] doc-index found ${entries.length} afx docs`);
        post({ type: "afxCanvasDocIndex", requestId: msg.requestId, entries });
        return;
      }
      case "afxCanvasAuthorRelationship": {
        if (!mutationCoordinator || !specDependencyIndexer) {
          post({
            type: "afxMutationResult",
            requestId: msg.requestId,
            outcome: "error",
            target: msg.source,
            code: "capability-unavailable",
            message: "Relationship authoring is unavailable in this Workbench host.",
            retryable: true,
          });
          return;
        }
        const result = await createDocGraphAuthorService({
          coordinator: mutationCoordinator,
          indexer: specDependencyIndexer,
        }).author(msg);
        post(result);
        if (result.outcome === "success") await refreshAndPost();
        return;
      }
      case "afxCanvasRunAction": {
        post(
          canvasActionService
            ? await canvasActionService.run(msg)
            : {
                type: "afxMutationResult",
                requestId: msg.requestId,
                outcome: "error",
                target: msg.target,
                code: "capability-unavailable",
                message: "Canvas actions are unavailable in this Workbench host.",
                retryable: true,
              },
        );
        return;
      }
      case "afxMutateKanbanBoard": {
        if (!mutationCoordinator) return;
        const result = await mutationCoordinator.mutateText({
          requestId: msg.requestId,
          target: msg.target,
          expectedRevision: msg.expectedRevision,
          transform(content) {
            const outcome = mutateKanbanMarkdown(parseKanbanMarkdown(content), msg.mutation);
            if (!outcome.ok) throw new Error(outcome.message);
            return outcome.content;
          },
        });
        post(result);
        if (result.outcome === "success") await refreshAndPost();
        return;
      }
      case "afxToggleLinkedTask": {
        if (!mutationCoordinator) return;
        const result = await mutationCoordinator.mutateText({
          requestId: msg.requestId,
          target: msg.target,
          expectedRevision: msg.expectedRevision,
          transform(content) {
            const outcome = toggleLinkedTaskItem(
              content,
              msg.wbsId,
              msg.itemFingerprint,
              msg.completed,
            );
            if (!outcome.ok) throw new Error(outcome.message);
            return outcome.content;
          },
        });
        post(result);
        if (result.outcome === "success") await refreshAndPost();
        return;
      }
      case "afxMutateNotes": {
        if (!notesWriter) return;
        const result = await notesWriter.mutate(msg);
        post(result);
        if (result.outcome === "success") await refreshAndPost();
        return;
      }
      case "afxCreateSampleDocs": {
        await createSampleDocs(rootUri, msg.kind);
        await refreshAndPost();
        return;
      }
      case "afxCreateKanbanBoard": {
        const slug = msg.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!slug) return;
        const dir = await resolvePath(".afx/kanban");
        const uri = vscode.Uri.joinPath(dir, `${slug}.md`);
        const title = msg.name.trim();
        const content = `---\nafx: true\ntype: KANBAN\ntitle: "${title.replace(/"/g, '\\"')}"\nstatus: active\n---\n\n# ${title}\n\n## Backlog\n\n## In Progress\n\n## Review\n\n## Done\n`;
        await vscode.workspace.fs.createDirectory(dir);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
        await refreshAndPost();
        return;
      }
      case "afxRenameKanbanBoard": {
        if (!msg.filePath) return;
        const newTitle = msg.name.trim();
        if (!newTitle) return;
        const newSlug = newTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!newSlug) return;
        const oldUri = await resolvePath(msg.filePath, true);
        // Keep the new file in the same directory as the old one — handles
        // multi-root workspaces where the board may live outside the primary root.
        const parentUri = vscode.Uri.joinPath(oldUri, "..");
        const newUri = vscode.Uri.joinPath(parentUri, `${newSlug}.md`);
        if (oldUri.fsPath === newUri.fsPath) return;
        // Update title field + h1 in the file body
        const buf = await vscode.workspace.fs.readFile(oldUri);
        const oldText = Buffer.from(buf).toString("utf8");
        const escaped = newTitle.replace(/"/g, '\\"');
        const withTitle = oldText.replace(/^title:\s*.*$/m, `title: "${escaped}"`);
        const withH1 = withTitle.replace(/^#\s+.*$/m, `# ${newTitle}`);
        await vscode.workspace.fs.writeFile(newUri, Buffer.from(withH1, "utf8"));
        await vscode.workspace.fs.delete(oldUri);
        await refreshAndPost();
        return;
      }
      case "afxDeleteKanbanBoard": {
        if (!msg.filePath) return;
        const uri = await resolvePath(msg.filePath, true);
        await vscode.workspace.fs.delete(uri);
        await refreshAndPost();
        return;
      }
      case "afxToggleTask": {
        const { path: realPath, section } = parseSprintPath(msg.path);
        const uri = await resolvePath(realPath, true);
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buf).toString("utf8");
        let line = msg.line;
        if (section) {
          const slice = sliceSprintSection(text, section);
          if (slice) line = slice.contentStartLine + msg.line;
        }
        const next = toggleMarkdownCheckboxLine(text, line, msg.completed);
        if (next === text) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
        await refreshAndPost();
        return;
      }
      case "afxToggleSession": {
        const { path: realPath } = parseSprintPath(msg.filePath);
        const uri = await resolvePath(realPath, true);
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buf).toString("utf8");
        const column = msg.column === "human" ? "human" : "agent";
        const next =
          typeof msg.line === "number"
            ? toggleWorkSessionCheckboxLine(text, msg.line, column, msg.completed)
            : toggleWorkSessionCheckbox(text, msg.sessionIndex, column, msg.completed);
        if (next === text) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
        await refreshAndPost();
        return;
      }
      case "afxToggleAllSessions": {
        const { path: realPath } = parseSprintPath(msg.filePath);
        const uri = await resolvePath(realPath, true);
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buf).toString("utf8");
        const next = toggleAllWorkSessionCheckboxes(text, msg.column, msg.completed);
        if (next === text) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
        await refreshAndPost();
        return;
      }
      case "afxApproveSessions": {
        const { path: realPath } = parseSprintPath(msg.filePath);
        const uri = await resolvePath(realPath, true);
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buf).toString("utf8");
        const next = approveWorkSessionCheckboxes(text);
        if (next === text) return;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
        await refreshAndPost();
        return;
      }
      case "afxAppendNote": {
        await appendNoteToWorkspace(msg.text.trim());
        await refreshAndPost();
        return;
      }
      case "afxEditNote": {
        const uri = await resolvePath(".afx/notes.md", true);
        try {
          const existing = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
          const next = mutateNote(existing, msg.timestamp, msg.text.trim());
          if (next === null) {
            log?.warn(() => `edit note: timestamp not found (${msg.timestamp})`);
            return;
          }
          await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
          await refreshAndPost();
        } catch (err) {
          log?.warn(() => `edit note failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
      case "afxDeleteNote": {
        const uri = await resolvePath(".afx/notes.md", true);
        try {
          const existing = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
          const next = mutateNote(existing, msg.timestamp, null);
          if (next === null) return;
          await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
          await refreshAndPost();
        } catch (err) {
          log?.warn(
            () => `delete note failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return;
      }
      case "afxSelectFeature":
      case "afxChangeStatus":
        // host-side persistence not yet required for these — webview manages local state
        return;
      case "afxCanvasEditorReady":
      case "afxCanvasApplyMutation":
      case "afxCanvasEditorSetViewState":
        log?.warn(
          () =>
            `rejected ${msg.type}: custom-editor message was sent to the Workbench panel surface`,
        );
        return;
    }
  } catch (err) {
    log?.error("handleMessage threw", err instanceof Error ? err : undefined);
    throw err;
  }
}

function formatPickedMarkdownPath(
  uri: vscode.Uri,
  workspaceFolders: readonly vscode.WorkspaceFolder[],
): string {
  const pickedPath = path.normalize(uri.fsPath);
  let shortestRelative: string | undefined;
  for (const folder of workspaceFolders) {
    const rootPath = path.normalize(folder.uri.fsPath);
    const relative = path.relative(rootPath, pickedPath);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (!shortestRelative || relative.length < shortestRelative.length) {
      shortestRelative = relative;
    }
  }
  return (shortestRelative ?? pickedPath).replace(/\\/g, "/");
}

async function createSampleDocs(rootUri: vscode.Uri, kind: "full-spec" | "sprint"): Promise<void> {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
  if (kind === "sprint") {
    const dir = vscode.Uri.joinPath(rootUri, "docs", "specs", "sample-sprint-tour");
    await vscode.workspace.fs.createDirectory(dir);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(dir, "sample-sprint-tour.md"),
      Buffer.from(sampleSprintDoc(now), "utf8"),
    );
    return;
  }

  const dir = vscode.Uri.joinPath(rootUri, "docs", "specs", "sample-workbench-tour");
  await vscode.workspace.fs.createDirectory(dir);
  const files: Array<[string, string]> = [
    ["spec.md", sampleSpecDoc(now)],
    ["design.md", sampleDesignDoc(now)],
    ["tasks.md", sampleTasksDoc(now)],
    ["journal.md", sampleJournalDoc(now)],
  ];
  for (const [name, content] of files) {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(dir, name),
      Buffer.from(content, "utf8"),
    );
  }
}

function sampleFrontmatter(type: string, now: string, extra = ""): string {
  return [
    "---",
    "afx: true",
    `type: ${type}`,
    "status: Draft",
    'owner: "@you"',
    'version: "0.1"',
    `created_at: "${now}"`,
    `updated_at: "${now}"`,
    'tags: ["sample", "workbench"]',
    extra.trim(),
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function sampleSpecDoc(now: string): string {
  return `${sampleFrontmatter("SPEC", now)}# Sample Workbench Tour

## Overview

Create a first-run Workbench experience that helps new users start with AFX without memorizing commands.

## Goals

- Make the bottom panel useful before any real project documents exist.
- Let users create sample docs or draft generation commands from one place.
- Show how specs, tasks, documents, boards, notes, and analytics connect.

## Success Metrics

- A new user can create sample AFX docs in under one minute.
- The Workbench first screen has no dead empty states.
- The document reader makes the sample spec readable without opening the editor.

## Scope

Include launchpad actions, a polished reader, and a starter board. Defer cloud integrations and external template catalogs.

## User Stories

- As a new user, I want a clear first action so I know where to begin.
- As a returning user, I want generated docs to appear in the Workbench immediately.
- As a maintainer, I want the sample to live in normal markdown files.
`;
}

function sampleDesignDoc(now: string): string {
  return `${sampleFrontmatter("DESIGN", now, "spec: spec.md")}# Sample Workbench Tour Design

## Design Direction

Use the Workbench as the visual control plane for AFX markdown. Empty states should be active launch surfaces, not explanatory dead ends.

## Architecture

- Workbench webview sends typed launchpad messages.
- VS Code host creates sample markdown files inside the workspace.
- The existing scanner refreshes state and repopulates tabs.

## UI

- Launchpad: action grid plus a first-10-minutes progress preview.
- Documents: studio reader with quality pulse and outline.
- Board: visible movement controls with markdown persistence.

## Risks

- Users may mistake sample docs for production docs; keep the sample slug explicit.
- File creation must stay workspace-local and typed through the host bridge.
`;
}

function sampleTasksDoc(now: string): string {
  return `${sampleFrontmatter("TASKS", now, "spec: spec.md\ndesign: design.md")}# Sample Workbench Tour Tasks

## Phase 1: Launchpad

- [x] Create a first-run Workbench launchpad
- [ ] Connect sample document creation
- [ ] Verify empty Workbench and Documents states

## Phase 2: Reader

- [ ] Render the sample spec in the document studio
- [ ] Show outline and quality pulse

## Phase 3: Board

- [ ] Create starter board cards
- [ ] Verify column movement

## Work Sessions

| Date | Task | Action | Files | Agent | Human |
| --- | --- | --- | --- | --- | --- |
| ${now} | Launchpad | Created sample plan | docs/specs/sample-workbench-tour/* | [x] | [ ] |
`;
}

function sampleJournalDoc(now: string): string {
  return `${sampleFrontmatter("JOURNAL", now, "spec: spec.md")}# Sample Workbench Tour Journal

## ${now.slice(0, 10)}

The Workbench should be useful the first time it opens. The sample project exists to make every tab feel alive while still teaching the real AFX file shape.
`;
}

function sampleSprintDoc(now: string): string {
  return `${sampleFrontmatter("SPRINT", now)}# Sample Sprint Tour

<!-- SPRINT-SECTION-START: SPEC -->
## 1. Spec

Create a compact Workbench onboarding path that starts from one sprint document.

### Success Metrics

- User can see Spec, Design, Tasks, and Work slices from one file.
- The chat stepper can preserve context while previewing this markdown.
<!-- SPRINT-SECTION-END: SPEC -->

<!-- SPRINT-SECTION-START: DESIGN -->
## 2. Design

Keep the sprint small: a launchpad action, a document preview, and a verification checklist.
<!-- SPRINT-SECTION-END: DESIGN -->

<!-- SPRINT-SECTION-START: TASKS -->
## 3. Tasks

- [ ] Draft launchpad copy
- [ ] Wire sample creation
- [ ] Capture Playwright screenshots
<!-- SPRINT-SECTION-END: TASKS -->

<!-- SPRINT-SECTION-START: SESSIONS -->
## 4. Work Sessions

| Date | Task | Action | Files | Agent | Human |
| --- | --- | --- | --- | --- | --- |
| ${now} | Sprint sample | Created sample sprint | docs/specs/sample-sprint-tour/sample-sprint-tour.md | [x] | [ ] |
<!-- SPRINT-SECTION-END: SESSIONS -->
`;
}

/**
 * Edit or delete a note by ISO timestamp. Supports both note storage formats:
 *   - Inline:  `- **YYYY-MM-DDTHH:MM:SS.mmmZ** body text`
 *   - Section: `## YYYY-MM-DD\n\n### HH:MM:SS.mmmZ\nbody text\n`
 *
 * `newText === null` deletes the note. Returns the rewritten file content,
 * or `null` if the timestamp couldn't be located.
 */
function safeHttpUri(value: string): vscode.Uri | undefined {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return undefined;
    }
    return vscode.Uri.parse(url.toString());
  } catch {
    return undefined;
  }
}

function mutateNote(existing: string, timestamp: string, newText: string | null): string | null {
  const lines = existing.split("\n");
  const time = timestamp.slice(11, 23);
  const inlineMarker = `**${timestamp}**`;

  // Inline format — the whole note lives on one line.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.includes(inlineMarker)) continue;
    if (newText === null) {
      lines.splice(i, 1);
    } else {
      const m = line.match(/^(\s*[-*]?\s*\*\*[^*]+\*\*\s*)(.*)$/);
      if (!m) return null;
      lines[i] = `${m[1]}${newText.replace(/\n+/g, " ").trim()}`;
    }
    return lines.join("\n");
  }

  // Section format — body spans from `### {time}` heading until the next h2/h3.
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() === `### ${time}`) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i] ?? "")) {
      endIdx = i;
      break;
    }
  }

  if (newText === null) {
    return [...lines.slice(0, startIdx), ...lines.slice(endIdx)]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  const before = lines.slice(0, startIdx + 1);
  const after = lines.slice(endIdx);
  const body = newText.split("\n");
  return [...before, ...body, "", ...after].join("\n").replace(/\n{3,}/g, "\n\n");
}
