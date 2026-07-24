/**
 * Optional editor-area JSON Canvas surface.
 *
 * The text document remains authoritative: every graph edit is validated and
 * applied through WorkspaceEdit so VS Code owns dirty state, undo/redo, save,
 * revert, hot exit, and synchronization with ordinary text editors.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-11] [FR-12] [FR-31] [FR-32]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EDITOR-AREA] [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-MULTI-INSTANCE]
 */
import { createHash } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import { applyCanvasMutation, parseJSONCanvas, serializeJSONCanvas } from "@afx/canvas-engine";
import { editFrontmatterList } from "@afx/parsers";
import {
  type CanvasDescriptor,
  type CanvasDocumentSnapshot,
  type CanvasViewState,
  type Logger,
  type WorkbenchInbound,
  type WorkbenchMutationResult,
  type WorkbenchOutbound,
  type WorkbenchSourceIdentity,
  type WorkbenchSourceRevision,
  canvasDocumentId,
} from "@afx/shared";
import { isMarkdownPath } from "@afx/shared";

import { getAppDistPath, getAppearanceClass, loadWebviewHtml } from "../panels/webview-html";
import type { CanvasActionService } from "../services/canvas-action-service";
import {
  type CanvasContentPreviewService,
  createCanvasContentPreviewService,
  serializeCanvasSourcePreview,
  serializeCanvasUrlPreview,
} from "../services/canvas-content-preview-service";
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
import type { CanvasLibraryService } from "../services/canvas-library-service";
import {
  type CanvasReferencePicker,
  createCanvasReferencePicker,
} from "../services/canvas-reference-picker";
import { postCanvasRequestFailure } from "../services/canvas-request-failure";
import {
  type SpecDependencyIndexer,
  createSpecDependencyIndexer,
} from "../services/spec-dependency-indexer";
import type { WorkbenchFileState } from "../services/workbench-file-state";
import {
  type WorkbenchMutationCoordinator,
  createWorkbenchMutationCoordinator,
} from "../services/workbench-mutation-coordinator";

export const AFX_CANVAS_EDITOR_VIEW_TYPE = "afx.canvasEditor";

export interface CanvasEditorProviderDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  fileState: WorkbenchFileState;
  logger?: Logger;
  openChatCommand?: (command: string, mode: "insert" | "send") => Promise<void> | void;
  appendNote?: (text: string) => Promise<void> | void;
  openAfxPreview?: (uri: vscode.Uri) => void;
  canvasActionService?: CanvasActionService;
  canvasEditSessionManager?: CanvasEditSessionManager;
  /** Enables library operations (list/create/rename/duplicate/delete) from the editor surface. */
  canvasLibrary?: CanvasLibraryService;
  /** Spec Map doc-index + dependency reconcile; created from fileState if omitted. */
  specDependencyIndexer?: SpecDependencyIndexer;
  /** Writes relationship frontmatter on source docs for draw-to-author; created from fileState if omitted. */
  authorCoordinator?: WorkbenchMutationCoordinator;
  contentPreviewService?: CanvasContentPreviewService;
  referencePicker?: CanvasReferencePicker | null;
  canvasExportService?: CanvasExportService | null;
  /** Trailing debounce for change/save-triggered snapshot pushes. */
  pushDebounceMs?: number;
}

interface EditorSession {
  clientId?: string;
  documentId: string;
  source: WorkbenchSourceIdentity;
  /** Depth counter — direct applyContent writes may overlap (save + mutation). */
  applyingEditDepth: number;
  viewState?: CanvasViewState;
}

function contentRevision(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function uriKey(uri: vscode.Uri): string {
  return `${uri.scheme}\u0000${uri.authority}\u0000${uri.path}`;
}

function serializeUri(uri: vscode.Uri): string {
  const rendered = typeof uri.toString === "function" ? uri.toString() : "";
  return rendered && rendered !== "[object Object]"
    ? rendered
    : `${uri.scheme || "file"}://${uri.authority ?? ""}${uri.path}`;
}

function fallbackSource(uri: vscode.Uri): WorkbenchSourceIdentity {
  const directory = path.posix.dirname(uri.path);
  return {
    rootUri: serializeUri(uri.with({ path: directory })),
    rootName: "External Canvas",
    relativePath: path.posix.basename(uri.path),
  };
}

function descriptorFor(source: WorkbenchSourceIdentity): CanvasDescriptor {
  const normalized = source.relativePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized);
  return {
    id: canvasDocumentId(source),
    kind:
      normalized === ".afx/project.canvas"
        ? "project"
        : normalized.startsWith(".afx/canvases/")
          ? "named"
          : "external",
    label: basename.replace(/\.canvas$/i, "") || basename,
    source,
    exists: true,
  };
}

function sameSource(left: WorkbenchSourceIdentity, right: WorkbenchSourceIdentity): boolean {
  return left.rootUri === right.rootUri && left.relativePath === right.relativePath;
}

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

function documentEnd(document: vscode.TextDocument): vscode.Position {
  if (document.lineCount <= 0) return new vscode.Position(0, 0);
  const lastLine = document.lineAt(document.lineCount - 1);
  return lastLine.range.end;
}

function parseError(content: string): string | undefined {
  try {
    parseJSONCanvas(content);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON Canvas document";
  }
}

/** Build one live, browser-safe snapshot from the authoritative TextDocument. */
export async function createCanvasEditorSnapshot(
  document: vscode.TextDocument,
  fileState: WorkbenchFileState,
): Promise<CanvasDocumentSnapshot> {
  const content = document.getText();
  const source = fileState.identify(document.uri) ?? fallbackSource(document.uri);
  const live = await fileState.readText(document.uri);
  const revision: WorkbenchSourceRevision = live?.sourceRevision ?? {
    contentRevision: contentRevision(content),
    documentVersion: document.version,
    dirty: document.isDirty,
  };
  const descriptor = descriptorFor(source);
  const error = parseError(content);
  return {
    documentId: descriptor.id,
    descriptor,
    source,
    revision: {
      ...revision,
      contentRevision: contentRevision(content),
      documentVersion: document.version,
      dirty: document.isDirty,
    },
    content,
    ...(error ? { parseError: error } : {}),
  };
}

function failure(
  requestId: string,
  target: WorkbenchSourceIdentity,
  outcome: "conflict" | "error",
  code: Extract<WorkbenchMutationResult, { outcome: "conflict" | "error" }>["code"],
  message: string,
  retryable: boolean,
  revision?: WorkbenchSourceRevision,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId,
    outcome,
    target,
    code,
    message,
    retryable,
    ...(revision ? { revision } : {}),
  };
}

/**
 * Creates the optional custom text editor. Each panel gets view-local state,
 * while all panels observe the same VS Code TextDocument change stream.
 */
export function createCanvasEditorProvider(
  deps: CanvasEditorProviderDeps,
): vscode.CustomTextEditorProvider {
  const log = deps.logger?.child("canvas-editor");
  const contentPreviewService =
    deps.contentPreviewService ?? createCanvasContentPreviewService({ fileState: deps.fileState });
  const referencePicker =
    deps.referencePicker === null
      ? undefined
      : (deps.referencePicker ?? createCanvasReferencePicker({ fileState: deps.fileState }));
  const canvasExportService =
    deps.canvasExportService === null
      ? undefined
      : (deps.canvasExportService ?? createCanvasExportService());
  const canvasLibrary = deps.canvasLibrary;
  // Spec Map (doc-index + Sync + authoring) is available in the editor host too,
  // not just the Workbench panel, so the same canvas behaves the same wherever
  // it opens. The coordinator writes frontmatter on *other* spec files.
  const specDependencyIndexer =
    deps.specDependencyIndexer ?? createSpecDependencyIndexer({ fileState: deps.fileState });
  const authorCoordinator =
    deps.authorCoordinator ?? createWorkbenchMutationCoordinator({ fileState: deps.fileState });

  return {
    resolveCustomTextEditor(document, webviewPanel, cancellationToken) {
      if (cancellationToken.isCancellationRequested) return;

      const workbenchDistPath = getAppDistPath(deps.extensionUri, "workbench");
      webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          ...(workbenchDistPath ? [vscode.Uri.file(workbenchDistPath)] : []),
          ...(vscode.workspace.workspaceFolders?.map((folder) => folder.uri) ?? []),
        ],
      };
      webviewPanel.webview.html = loadWebviewHtml(
        webviewPanel.webview,
        deps.extensionUri,
        "workbench",
        deps.extensionMode,
        { view: "canvas-editor" },
      );

      const workspaceSource = deps.fileState.identify(document.uri);
      const source = workspaceSource ?? fallbackSource(document.uri);
      const session: EditorSession = {
        documentId: descriptorFor(source).id,
        source,
        applyingEditDepth: 0,
      };
      const disposables: vscode.Disposable[] = [];

      const post = (message: WorkbenchInbound): void => {
        webviewPanel.webview.postMessage(message).then(undefined, (error) => {
          log?.error("postMessage failed", error instanceof Error ? error : undefined);
        });
      };

      const pushDocument = async (): Promise<void> => {
        const snapshot = await createCanvasEditorSnapshot(document, deps.fileState);
        session.documentId = snapshot.documentId;
        session.source = snapshot.source;
        post({
          type: "afxCanvasEditorDocument",
          clientId: session.clientId ?? "pending",
          document: snapshot,
          enabled: vscode.workspace
            .getConfiguration("afx")
            .get<boolean>("experimental.canvas", false),
        });
      };

      const terminalSuccess = async (requestId: string): Promise<WorkbenchMutationResult> => {
        const snapshot = await createCanvasEditorSnapshot(document, deps.fileState);
        return {
          type: "afxMutationResult",
          requestId,
          outcome: "success",
          target: snapshot.source,
          revision: snapshot.revision,
        };
      };

      const applyContent = async (
        requestId: string,
        expectedRevision: string | undefined,
        content: string,
      ): Promise<WorkbenchMutationResult> => {
        const currentContent = document.getText();
        const currentRevision = contentRevision(currentContent);
        const currentSnapshot = await createCanvasEditorSnapshot(document, deps.fileState);
        if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
          return failure(
            requestId,
            session.source,
            "conflict",
            "stale-revision",
            "The canvas changed after this editor view loaded. Reload before retrying.",
            true,
            currentSnapshot.revision,
          );
        }
        try {
          parseJSONCanvas(content);
        } catch (error) {
          return failure(
            requestId,
            session.source,
            "error",
            "parse-error",
            error instanceof Error ? error.message : "Invalid JSON Canvas document",
            false,
            currentSnapshot.revision,
          );
        }
        if (content === currentContent) {
          return terminalSuccess(requestId);
        }

        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          document.uri,
          new vscode.Range(new vscode.Position(0, 0), documentEnd(document)),
          content,
        );
        session.applyingEditDepth += 1;
        try {
          const applied = await vscode.workspace.applyEdit(edit);
          if (!applied) {
            return failure(
              requestId,
              session.source,
              "error",
              "write-failed",
              "VS Code rejected the canvas edit.",
              true,
              currentSnapshot.revision,
            );
          }
        } catch (error) {
          return failure(
            requestId,
            session.source,
            "error",
            "write-failed",
            error instanceof Error ? error.message : "The canvas edit could not be applied.",
            true,
            currentSnapshot.revision,
          );
        } finally {
          session.applyingEditDepth -= 1;
        }
        return terminalSuccess(requestId);
      };

      const finishMutation = async (result: WorkbenchMutationResult): Promise<void> => {
        post(result);
        if (result.outcome === "success") await pushDocument();
      };

      // Out-of-workspace canvases can't be resolved by the mutation coordinator
      // (its writes key off workspace identity), so external documents keep the
      // provider-owned stream whose applyContent works on any TextDocument.
      const sharedCanvasEditClient = workspaceSource
        ? deps.canvasEditSessionManager?.connect((result) => {
            post(result);
          })
        : undefined;
      const ownedCanvasEditStream = sharedCanvasEditClient
        ? undefined
        : createCanvasEditStream({
            apply: (request, expectedRevision) =>
              applyContent(request.requestId, expectedRevision, request.content),
            post: (result) => {
              post(result);
              if (result.outcome === "success") void pushDocument();
            },
            shouldApplyImmediately: () => true,
          });
      const canvasEditStager: Pick<CanvasEditSessionClient, "stage"> =
        sharedCanvasEditClient ?? ownedCanvasEditStream!;

      const editorCanvasId = (): string => canvasDocumentId(session.source);

      const openCanvasEditorTab = async (target: WorkbenchSourceIdentity): Promise<void> => {
        const uri = deps.fileState.resolve(target);
        if (!uri) return;
        await vscode.commands.executeCommand("vscode.openWith", uri, AFX_CANVAS_EDITOR_VIEW_TYPE);
      };

      const postEditorLibrary = async (): Promise<void> => {
        if (!canvasLibrary) return;
        const library = await canvasLibrary.list();
        const currentId = editorCanvasId();
        post({
          type: "afxCanvasLibrary",
          canvases: library.canvases,
          ...(library.canvases.some((candidate) => candidate.id === currentId)
            ? { selectedId: currentId }
            : library.selectedId !== undefined
              ? { selectedId: library.selectedId }
              : {}),
        });
      };

      const handleMessage = async (message: WorkbenchOutbound): Promise<void> => {
        // This editor intentionally handles only the Canvas-safe subset of the shared Workbench protocol.
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (message.type) {
          case "afxReady":
            post({ type: "afxAppearanceUpdated", appearanceClass: getAppearanceClass() });
            await pushDocument();
            return;
          case "afxCanvasEditorReady":
            session.clientId = message.clientId;
            await pushDocument();
            post({
              type: "afxCanvasEditorState",
              clientId: message.clientId,
              ...(session.viewState ? { viewState: session.viewState } : {}),
            });
            return;
          case "afxCanvasSave":
            if (!sameSource(message.target, session.source)) {
              post(
                failure(
                  message.requestId,
                  message.target,
                  "error",
                  "outside-workspace",
                  "This editor can only update its bound canvas document.",
                  false,
                ),
              );
              return;
            }
            await finishMutation(
              await applyContent(message.requestId, message.expectedRevision, message.content),
            );
            return;
          case "afxCanvasEdit":
            if (
              !sameSource(message.target, session.source) ||
              message.documentId !== session.documentId ||
              (session.clientId && message.sessionId !== session.clientId)
            ) {
              post({
                type: "afxCanvasEditResult",
                requestId: message.requestId,
                sessionId: message.sessionId,
                sequence: message.sequence,
                outcome: "error",
                target: message.target,
                code: "outside-workspace",
                message: "The Canvas edit was addressed to another editor session.",
                retryable: false,
              });
              return;
            }
            canvasEditStager.stage(message);
            return;
          case "afxCanvasApplyMutation": {
            if (
              (session.clientId && message.clientId !== session.clientId) ||
              message.documentId !== session.documentId
            ) {
              post(
                failure(
                  message.requestId,
                  session.source,
                  "error",
                  "outside-workspace",
                  "The canvas mutation was addressed to another editor instance.",
                  false,
                ),
              );
              return;
            }
            const current = document.getText();
            const revision = contentRevision(current);
            if (
              message.baseVersion !== revision &&
              message.baseVersion !== String(document.version)
            ) {
              const snapshot = await createCanvasEditorSnapshot(document, deps.fileState);
              post(
                failure(
                  message.requestId,
                  session.source,
                  "conflict",
                  "stale-revision",
                  "The canvas changed after this operation started.",
                  true,
                  snapshot.revision,
                ),
              );
              return;
            }
            try {
              const next = applyCanvasMutation(parseJSONCanvas(current), message.mutation);
              await finishMutation(
                await applyContent(message.requestId, revision, serializeJSONCanvas(next)),
              );
            } catch (error) {
              const snapshot = await createCanvasEditorSnapshot(document, deps.fileState);
              post(
                failure(
                  message.requestId,
                  session.source,
                  "error",
                  "parse-error",
                  error instanceof Error ? error.message : "The canvas mutation is invalid.",
                  false,
                  snapshot.revision,
                ),
              );
            }
            return;
          }
          case "afxCanvasEditorSetViewState":
            if (!session.clientId || message.clientId === session.clientId) {
              session.viewState = message.viewState;
              post({
                type: "afxCanvasEditorState",
                clientId: message.clientId,
                viewState: message.viewState,
              });
            }
            return;
          case "afxOpenSettings":
            await vscode.commands.executeCommand(
              "workbench.action.openSettings",
              message.setting ?? "afx.experimental.canvas",
            );
            return;
          // Library operations from the editor surface. An editor tab is bound
          // to one TextDocument, so create/duplicate/select open their result
          // as a separate editor tab; rename/delete retire this tab (FR-3).
          case "afxCanvasList": {
            await postEditorLibrary();
            return;
          }
          case "afxCanvasSelect": {
            if (!canvasLibrary) return;
            const library = await canvasLibrary.list();
            const chosen = library.canvases.find((candidate) => candidate.id === message.canvasId);
            if (chosen && chosen.id !== editorCanvasId()) {
              await openCanvasEditorTab(chosen.source);
            }
            // This tab keeps its own document — snap the switcher back to it.
            await postEditorLibrary();
            return;
          }
          case "afxCanvasCreate":
          case "afxCanvasRename":
          case "afxCanvasDuplicate":
          case "afxCanvasDelete": {
            if (!canvasLibrary) {
              post({
                type: "afxMutationResult",
                requestId: message.requestId,
                outcome: "error",
                target:
                  message.type === "afxCanvasCreate"
                    ? { rootUri: message.targetRootUri, rootName: "workspace", relativePath: "" }
                    : message.target,
                code: "capability-unavailable",
                message: "Canvas library operations need an open workspace folder.",
                retryable: true,
              });
              return;
            }
            const result =
              message.type === "afxCanvasCreate"
                ? await canvasLibrary.create(message)
                : message.type === "afxCanvasRename"
                  ? await canvasLibrary.rename(message)
                  : message.type === "afxCanvasDuplicate"
                    ? await canvasLibrary.duplicate(message)
                    : await canvasLibrary.delete(message);
            post(result);
            if (result.outcome !== "success") return;
            if (message.type === "afxCanvasCreate" || message.type === "afxCanvasDuplicate") {
              await openCanvasEditorTab(result.target);
              await postEditorLibrary();
              return;
            }
            if (message.type === "afxCanvasRename") {
              // The renamed file replaced this one on disk; move to the new tab.
              await openCanvasEditorTab(result.target);
            }
            webviewPanel.dispose();
            return;
          }
          case "afxCanvasDocIndex": {
            log?.info("[spec-map v2] editor doc-index scan starting");
            try {
              const entries = await specDependencyIndexer.index();
              log?.info(`[spec-map v2] editor doc-index found ${entries.length} afx docs`);
              post({ type: "afxCanvasDocIndex", requestId: message.requestId, entries });
            } catch (error) {
              // Answer with an empty index rather than leaving the Add-spec
              // picker spinning if discovery throws.
              log?.error(
                "[spec-map v2] editor doc-index failed",
                error instanceof Error ? error : undefined,
              );
              post({ type: "afxCanvasDocIndex", requestId: message.requestId, entries: [] });
            }
            return;
          }
          case "afxCanvasRefreshDependencies": {
            log?.info("[spec-map v2] editor Sync specs starting");
            try {
              const refreshed = await specDependencyIndexer.refresh(
                document.getText(),
                session.source,
              );
              const result = await applyContent(
                message.requestId,
                message.expectedRevision,
                refreshed.content,
              );
              log?.info(`[spec-map v2] editor Sync specs ${result.outcome}`);
              await finishMutation(result);
            } catch (error) {
              log?.error(
                "[spec-map v2] editor Sync specs failed",
                error instanceof Error ? error : undefined,
              );
              post({
                type: "afxMutationResult",
                requestId: message.requestId,
                outcome: "error",
                target: message.target,
                code: "write-failed",
                message: error instanceof Error ? error.message : "Sync specs failed.",
                retryable: true,
              });
            }
            return;
          }
          case "afxCanvasAuthorRelationship": {
            if (!vscode.workspace.isTrusted) {
              post({
                type: "afxMutationResult",
                requestId: message.requestId,
                outcome: "error",
                target: message.source,
                code: "untrusted-workspace",
                message: "Trust this workspace to author relationships from the canvas.",
                retryable: false,
              });
              return;
            }
            const op = message.remove ? "remove" : "add";
            const targetToken = await specDependencyIndexer.resolveAuthorToken(
              message.targetId,
              message.source,
              message.remove ? message.declaredToken : undefined,
            );
            if (!targetToken) {
              post({
                type: "afxMutationResult",
                requestId: message.requestId,
                outcome: "error",
                target: message.source,
                code: "parse-error",
                message: "The relationship target is no longer a unique indexed document.",
                retryable: false,
              });
              return;
            }
            log?.info(
              `[spec-map v2] editor authoring ${op} ${message.relationship} -> ${targetToken}`,
            );
            try {
              // 1) Surgical frontmatter edit on the *source* document (a different
              //    file from this canvas), through the coordinator so it is
              //    conflict-aware and never clobbers an unrelated dirty buffer.
              const edited = await authorCoordinator.mutateText({
                requestId: message.requestId,
                target: message.source,
                expectedRevision: message.sourceExpectedRevision,
                allowDirty: false,
                transform: (content) => {
                  const result = editFrontmatterList(
                    content,
                    message.relationship,
                    targetToken,
                    op,
                  );
                  if (result.outcome === "unsupported") {
                    throw new Error(
                      `The ${message.relationship} value is not a supported YAML list and was not changed.`,
                    );
                  }
                  return result.content;
                },
              });
              if (edited.outcome !== "success") {
                log?.info(`[spec-map v2] editor authoring ${edited.outcome}`);
                post(edited);
                return;
              }
              // 2) Reconcile *this* canvas through the editor's own write path
              //    (like Sync) so the document's revision tracking stays coherent.
              const refreshed = await specDependencyIndexer.refresh(
                document.getText(),
                session.source,
              );
              const result = await applyContent(
                message.requestId,
                message.canvasExpectedRevision,
                refreshed.content,
              );
              log?.info(`[spec-map v2] editor authoring reconcile ${result.outcome}`);
              await finishMutation(result);
            } catch (error) {
              log?.error(
                "[spec-map v2] editor authoring failed",
                error instanceof Error ? error : undefined,
              );
              post({
                type: "afxMutationResult",
                requestId: message.requestId,
                outcome: "error",
                target: message.source,
                code: "write-failed",
                message:
                  error instanceof Error ? error.message : "Authoring the relationship failed.",
                retryable: true,
              });
            }
            return;
          }
          case "afxCanvasPickReferences": {
            if (!referencePicker) {
              post({
                type: "afxCanvasReferencesPicked",
                requestId: message.requestId,
                outcome: "error",
                references: [],
                message: "Canvas file picking is unavailable in this host.",
              });
              return;
            }
            try {
              log?.info(`canvas reference pick requested (kind=${message.kind ?? "any"})`);
              const references = await referencePicker.pick({
                owner: message.owner ?? session.source,
                kind: message.kind,
                allowMultiple: message.allowMultiple,
              });
              log?.info(`canvas reference pick resolved (${references.length} reference(s))`);
              post(
                references.length > 0
                  ? {
                      type: "afxCanvasReferencesPicked",
                      requestId: message.requestId,
                      outcome: "success",
                      references,
                    }
                  : {
                      type: "afxCanvasReferencesPicked",
                      requestId: message.requestId,
                      outcome: "cancelled",
                      references: [],
                    },
              );
            } catch (error) {
              log?.error(
                "canvas reference pick failed",
                error instanceof Error ? error : undefined,
              );
              post({
                type: "afxCanvasReferencesPicked",
                requestId: message.requestId,
                outcome: "error",
                references: [],
                message: error instanceof Error ? error.message : "The Canvas file picker failed.",
              });
            }
            return;
          }
          case "afxCanvasExport": {
            if (!canvasExportService) {
              post({
                type: "afxCanvasExportResult",
                requestId: message.requestId,
                outcome: "error",
                code: "capability-unavailable",
                message: "Canvas export is unavailable in this host.",
              });
              return;
            }
            try {
              const result = await canvasExportService.export({
                format: message.format,
                content: message.content,
                encoding: message.encoding,
                suggestedName: message.suggestedName,
              });
              if (result.outcome === "success") {
                post({
                  type: "afxCanvasExportResult",
                  requestId: message.requestId,
                  outcome: "success",
                  targetName: path.posix.basename(result.target.path.replace(/\\/g, "/")),
                  byteLength: result.byteLength,
                });
              } else if (result.outcome === "cancelled") {
                post({
                  type: "afxCanvasExportResult",
                  requestId: message.requestId,
                  outcome: "cancelled",
                });
              } else {
                post({ type: "afxCanvasExportResult", requestId: message.requestId, ...result });
              }
            } catch (error) {
              post({
                type: "afxCanvasExportResult",
                requestId: message.requestId,
                outcome: "error",
                code: "write-failed",
                message: error instanceof Error ? error.message : "The Canvas export failed.",
              });
            }
            return;
          }
          case "afxCanvasContentPreviewRequest": {
            try {
              const result = serializeCanvasSourcePreview(
                await contentPreviewService.previewSource(message.owner),
                (uri) => webviewPanel.webview.asWebviewUri(uri).toString(),
              );
              post({
                type: "afxCanvasContentPreviewResult",
                requestId: message.requestId,
                ...result,
              });
            } catch (error) {
              // Never strand the preview spinner: a throw here (missing file,
              // unreadable bytes, serialize failure) must still answer the request.
              log?.error(
                "canvas content preview failed",
                error instanceof Error ? error : undefined,
              );
              post({
                type: "afxCanvasContentPreviewResult",
                requestId: message.requestId,
                owner: message.owner,
                preview: {
                  kind: "file",
                  state: "error",
                  code: "read-failed",
                  message: error instanceof Error ? error.message : "The preview failed.",
                },
              });
            }
            return;
          }
          case "afxCanvasUrlPreviewRequest": {
            log?.info(`canvas url preview requested (${message.url})`);
            try {
              const urlPreview = serializeCanvasUrlPreview(
                await contentPreviewService.previewUrl({
                  url: message.url,
                  allowNetwork: message.allowNetwork,
                }),
              );
              log?.info(`canvas url preview resolved (state=${urlPreview.state})`);
              post({
                type: "afxCanvasUrlPreviewResult",
                requestId: message.requestId,
                url: message.url,
                preview: urlPreview,
              });
            } catch (error) {
              log?.error("canvas url preview failed", error instanceof Error ? error : undefined);
              post({
                type: "afxCanvasUrlPreviewResult",
                requestId: message.requestId,
                url: message.url,
                preview: {
                  state: "error",
                  code: "network-error",
                  message: error instanceof Error ? error.message : "The URL preview failed.",
                },
              });
            }
            return;
          }
          case "afxOpenExternalUrl": {
            const uri = safeHttpUri(message.url);
            if (uri) await vscode.env.openExternal(uri);
            else {
              vscode.window.showWarningMessage(
                "AgenticFlowX: only HTTP and HTTPS links can be opened.",
              );
            }
            return;
          }
          case "afxOpenFile": {
            const resolution = await resolveCanvasFileReference(message.path, {
              owner: message.owner ?? session.source,
            });
            if (!resolution.ok) {
              vscode.window.showWarningMessage(`AgenticFlowX: ${resolution.message}`);
              return;
            }
            const target = resolution.uri;
            if (message.mode === "afxPreview") deps.openAfxPreview?.(target);
            else {
              const options: vscode.TextDocumentShowOptions = {
                preview: message.mode === "preview",
              };
              let line =
                typeof message.line === "number" ? Math.max(0, message.line - 1) : undefined;
              if (message.subpath) {
                const content = await vscode.workspace.fs.readFile(target).then(
                  (bytes) => Buffer.from(bytes).toString("utf8"),
                  () => undefined,
                );
                if (content) line = findCanvasSubpathLine(content, message.subpath) ?? line;
              }
              if (line !== undefined) options.selection = new vscode.Range(line, 0, line, 0);
              await vscode.window.showTextDocument(target, options);
            }
            return;
          }
          case "afxFetchDocContent": {
            const resolution = await resolveCanvasFileReference(message.filePath, {
              owner: message.owner ?? session.source,
            });
            if (!resolution.ok) {
              post({
                type: "afxDocContent",
                filePath: message.filePath,
                content: `> Canvas file reference blocked: ${resolution.message}`,
                ...(message.requestId ? { requestId: message.requestId } : {}),
                ...(message.owner ? { owner: message.owner } : {}),
              });
              return;
            }
            try {
              const live = await deps.fileState.readText(resolution.uri);
              if (!live) throw new Error("Referenced Markdown is unavailable.");
              post({
                type: "afxDocContent",
                filePath: message.filePath,
                content: live.content,
                ...(message.requestId ? { requestId: message.requestId } : {}),
                owner: live.source,
                revision: live.sourceRevision,
              });
            } catch {
              post({
                type: "afxDocContent",
                filePath: message.filePath,
                content: "",
                ...(message.requestId ? { requestId: message.requestId } : {}),
                ...(message.owner ? { owner: message.owner } : {}),
              });
            }
            return;
          }
          case "afxPickMarkdownFile": {
            const picked = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: { Markdown: ["md", "markdown"] },
              defaultUri: vscode.workspace.getWorkspaceFolder(document.uri)?.uri,
            });
            const selected = picked?.[0];
            if (!selected) return;
            const relative = makePortableCanvasFileReference(selected, session.source);
            if (!relative) {
              vscode.window.showWarningMessage(
                "AgenticFlowX: Canvas file nodes must stay in the same workspace root as their Canvas.",
              );
              return;
            }
            post({ type: "afxMarkdownFilePicked", filePath: relative });
            return;
          }
          case "afxOpenChatCommand":
            await deps.openChatCommand?.(message.command, message.mode);
            return;
          case "afxAppendNote":
            await deps.appendNote?.(message.text);
            return;
          case "afxCanvasRunAction":
            if (!sameSource(message.target, session.source)) {
              post(
                failure(
                  message.requestId,
                  message.target,
                  "error",
                  "outside-workspace",
                  "This editor can only run actions declared by its bound canvas document.",
                  false,
                ),
              );
            } else if (deps.canvasActionService) {
              post(await deps.canvasActionService.run(message));
            } else {
              post(
                failure(
                  message.requestId,
                  message.target,
                  "error",
                  "capability-unavailable",
                  "Canvas actions are unavailable in this editor host.",
                  true,
                ),
              );
            }
            return;
          default:
            // Canvas actions are never auto-executed by loading or parsing a file.
            return;
        }
      };

      // Change/save events coalesce through a short trailing debounce so bursts
      // (rapid typing in a split text editor, undo chains) yield one snapshot.
      // pushDocument always reads the live TextDocument, so the last timer wins.
      let pushTimer: ReturnType<typeof setTimeout> | undefined;
      const pushDebounceMs = deps.pushDebounceMs ?? 150;
      const schedulePushDocument = (): void => {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => {
          pushTimer = undefined;
          void pushDocument();
        }, pushDebounceMs);
      };

      /**
       * True when the observed document change is this panel's own write:
       * either a direct applyContent (save/mutation) or a staged edit the
       * shared session manager is applying for this panel's client. Other
       * panels' writes still push, keeping multi-instance views in sync.
       */
      const isOwnWrite = (): boolean => {
        if (session.applyingEditDepth > 0) return true;
        return Boolean(
          session.clientId &&
          deps.canvasEditSessionManager?.applyingClientId(session.source) === session.clientId,
        );
      };

      disposables.push(
        webviewPanel.webview.onDidReceiveMessage((raw: unknown) => {
          if (!raw || typeof raw !== "object" || !("type" in raw)) return;
          const message = raw as WorkbenchOutbound;
          void handleMessage(message).catch((error) => {
            log?.error("message handler failed", error instanceof Error ? error : undefined);
            postCanvasRequestFailure(message, post, error, session.source);
          });
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
          if (isOwnWrite() || uriKey(event.document.uri) !== uriKey(document.uri)) return;
          schedulePushDocument();
        }),
        // Saving changes dirty/disk state without necessarily changing text,
        // so it needs its own authoritative snapshot. Undo, redo, and revert
        // flow through onDidChangeTextDocument above.
        vscode.workspace.onDidSaveTextDocument((savedDocument) => {
          if (uriKey(savedDocument.uri) !== uriKey(document.uri)) return;
          schedulePushDocument();
        }),
        deps.fileState.onDidChange((change) => {
          const owner = deps.fileState.identify(change.uri);
          if (!owner) return;
          post({ type: "afxCanvasContentPreviewInvalidated", owner });
          if (isMarkdownPath(change.uri.path)) post({ type: "afxDocContentInvalidated", owner });
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
          if (
            event.affectsConfiguration("afx.experimental.canvas") ||
            event.affectsConfiguration("afx.theme") ||
            event.affectsConfiguration("afx.style")
          ) {
            post({ type: "afxAppearanceUpdated", appearanceClass: getAppearanceClass() });
            void pushDocument();
          }
        }),
      );

      webviewPanel.onDidDispose(() => {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = undefined;
        for (const disposable of disposables) disposable.dispose();
        sharedCanvasEditClient?.dispose();
        if (ownedCanvasEditStream) void ownedCanvasEditStream.dispose();
      });
    },
  };
}

/** Explicitly opens the optional editor without becoming the default handler for `.canvas`. */
export async function openCanvasEditor(
  fileState: WorkbenchFileState,
  target?: vscode.Uri | WorkbenchSourceIdentity,
): Promise<void> {
  let uri: vscode.Uri | undefined;
  if (target && "relativePath" in target) uri = fileState.resolve(target);
  else if (target) uri = target;
  else if (vscode.window.activeTextEditor?.document.uri.path.toLowerCase().endsWith(".canvas")) {
    uri = vscode.window.activeTextEditor.document.uri;
  } else {
    uri = (
      await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { "JSON Canvas": ["canvas"] },
      })
    )?.[0];
  }
  if (!uri) return;
  await vscode.commands.executeCommand("vscode.openWith", uri, AFX_CANVAS_EDITOR_VIEW_TYPE);
}
