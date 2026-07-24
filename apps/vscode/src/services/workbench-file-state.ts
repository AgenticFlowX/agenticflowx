/**
 * Live workspace-document snapshots for Workbench data sources.
 *
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LIVE-DOCUMENTS]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-DIRTY-CONFLICT]
 */
import { createHash } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import {
  type WorkbenchSourceIdentity,
  type WorkbenchSourceRevision,
  canvasWorkspaceRootHint,
  isMarkdownPath,
} from "@afx/shared";

export type WorkbenchSourceKind = "docs" | "notes" | "board" | "canvas" | "file";
export type WorkbenchSourceChangeReason = "buffer" | "save" | "close" | "external";

export interface WorkbenchTextSnapshot {
  uri: vscode.Uri;
  content: string;
  revision: string;
  dirty: boolean;
  kind: WorkbenchSourceKind;
  source: WorkbenchSourceIdentity;
  sourceRevision: WorkbenchSourceRevision;
}

export interface WorkbenchSourceChange {
  uri: vscode.Uri;
  kind: WorkbenchSourceKind;
  reason: WorkbenchSourceChangeReason;
}

export interface WorkbenchFileState extends vscode.Disposable {
  classify(uri: vscode.Uri): WorkbenchSourceKind | undefined;
  identify(uri: vscode.Uri): WorkbenchSourceIdentity | undefined;
  resolve(source: WorkbenchSourceIdentity): vscode.Uri | undefined;
  readText(uri: vscode.Uri): Promise<WorkbenchTextSnapshot | null>;
  onDidChange(listener: (change: WorkbenchSourceChange) => void): vscode.Disposable;
}

export interface WorkbenchFileStateOptions {
  getWorkspaceFolders?: () => readonly vscode.WorkspaceFolder[] | undefined;
}

const WATCH_PATTERNS = [
  "**/docs/**/*.{md,markdown}",
  "**/.afx/notes.md",
  "**/.afx/kanban/**/*.md",
  "**/*.canvas",
  "**/*.{md,markdown,txt,json,jsonc,yaml,yml,toml,ini,env,ts,tsx,js,jsx,mjs,cjs,css,scss,html,htm,xml,csv,log,py,go,rs,java,kt,swift,sh,zsh,sql,graphql,png,jpg,jpeg,gif,webp,avif,bmp,svg}",
] as const;

const PREVIEW_FILE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".env",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".htm",
  ".xml",
  ".csv",
  ".log",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".sh",
  ".zsh",
  ".sql",
  ".graphql",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".svg",
]);

function uriKey(uri: vscode.Uri): string {
  return `${uri.scheme}\u0000${uri.authority}\u0000${uri.path}`;
}

function contentRevision(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function containingWorkspaceFolder(
  uri: vscode.Uri,
  folders: readonly vscode.WorkspaceFolder[],
): { folder: vscode.WorkspaceFolder; relativePath: string } | undefined {
  let best: { folder: vscode.WorkspaceFolder; relativePath: string } | undefined;
  for (const folder of folders) {
    if (folder.uri.scheme !== uri.scheme || folder.uri.authority !== uri.authority) continue;
    const relative = path.posix.relative(folder.uri.path, uri.path);
    if (relative === "" || (!relative.startsWith("../") && relative !== "..")) {
      if (!best || folder.uri.path.length > best.folder.uri.path.length) {
        best = { folder, relativePath: relative };
      }
    }
  }
  return best;
}

function serializeUri(uri: vscode.Uri): string {
  const rendered = typeof uri.toString === "function" ? uri.toString() : "";
  return rendered && rendered !== "[object Object]"
    ? rendered
    : `${uri.scheme || "file"}://${uri.authority ?? ""}${uri.path}`;
}

function classifyPath(relativePath: string): WorkbenchSourceKind | undefined {
  const normalized = relativePath.replaceAll("\\", "/");
  if (/(^|\/)docs\//i.test(normalized) && isMarkdownPath(normalized)) return "docs";
  if (/(^|\/)\.afx\/notes\.md$/i.test(normalized)) return "notes";
  if (/(^|\/)\.afx\/kanban\/.*\.md$/i.test(normalized)) return "board";
  if (/\.canvas$/i.test(normalized)) return "canvas";
  if (PREVIEW_FILE_EXTENSIONS.has(path.posix.extname(normalized).toLocaleLowerCase()))
    return "file";
  return undefined;
}

/**
 * Creates a lazily subscribed source service. Open editor buffers always win
 * over disk bytes, allowing the Workbench to reflect unsaved manual edits.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-17] [FR-20]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LIVE-DOCUMENTS]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-12] [FR-20] [FR-30] [FR-31]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE]
 */
export function createWorkbenchFileState(
  options: WorkbenchFileStateOptions = {},
): WorkbenchFileState {
  const getWorkspaceFolders =
    options.getWorkspaceFolders ?? (() => vscode.workspace.workspaceFolders);
  const listeners = new Set<(change: WorkbenchSourceChange) => void>();
  let subscriptions: vscode.Disposable[] = [];
  let disposed = false;

  const identify = (uri: vscode.Uri): WorkbenchSourceIdentity | undefined => {
    const folders = getWorkspaceFolders() ?? [];
    const match = containingWorkspaceFolder(uri, folders);
    if (!match) return undefined;
    return {
      rootUri: serializeUri(match.folder.uri),
      rootName: match.folder.name,
      relativePath: match.relativePath.replaceAll("\\", "/"),
    };
  };

  const resolve = (source: WorkbenchSourceIdentity): vscode.Uri | undefined => {
    const folders = getWorkspaceFolders() ?? [];
    const exact = folders.find((candidate) => serializeUri(candidate.uri) === source.rootUri);
    const rootHint = canvasWorkspaceRootHint(source);
    const hinted = rootHint ? folders.filter((candidate) => candidate.name === rootHint) : [];
    const folder = exact ?? (hinted.length === 1 ? hinted[0] : undefined);
    if (!folder || path.posix.isAbsolute(source.relativePath)) return undefined;
    const normalized = path.posix.normalize(source.relativePath.replaceAll("\\", "/"));
    if (normalized === ".." || normalized.startsWith("../")) return undefined;
    const uri = vscode.Uri.joinPath(folder.uri, normalized);
    return containingWorkspaceFolder(uri, [folder]) ? uri : undefined;
  };

  const classify = (uri: vscode.Uri): WorkbenchSourceKind | undefined => {
    const source = identify(uri);
    return source ? classifyPath(source.relativePath) : undefined;
  };

  const emit = (uri: vscode.Uri, reason: WorkbenchSourceChangeReason): void => {
    const kind = classify(uri);
    if (!kind) return;
    for (const listener of listeners) listener({ uri, kind, reason });
  };

  const stop = (): void => {
    for (const subscription of subscriptions) subscription.dispose();
    subscriptions = [];
  };

  const start = (): void => {
    if (disposed || subscriptions.length > 0) return;
    subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => emit(event.document.uri, "buffer")),
      vscode.workspace.onDidSaveTextDocument((document) => emit(document.uri, "save")),
      vscode.workspace.onDidCloseTextDocument((document) => emit(document.uri, "close")),
    );
    for (const pattern of WATCH_PATTERNS) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      subscriptions.push(
        watcher,
        watcher.onDidChange((uri) => emit(uri, "external")),
        watcher.onDidCreate((uri) => emit(uri, "external")),
        watcher.onDidDelete((uri) => emit(uri, "external")),
      );
    }
  };

  return {
    classify,
    identify,
    resolve,

    async readText(uri) {
      const kind = classify(uri);
      const source = identify(uri);
      if (!kind || !source) return null;
      const openDocument = vscode.workspace.textDocuments.find(
        (document) => uriKey(document.uri) === uriKey(uri),
      );
      if (openDocument) {
        const content = openDocument.getText();
        const revision = contentRevision(content);
        const diskRevision = await vscode.workspace.fs.readFile(uri).then(
          (bytes) => contentRevision(Buffer.from(bytes).toString("utf8")),
          () => undefined,
        );
        return {
          uri,
          content,
          revision,
          dirty: openDocument.isDirty,
          kind,
          source,
          sourceRevision: {
            contentRevision: revision,
            diskRevision,
            documentVersion: openDocument.version,
            dirty: openDocument.isDirty,
          },
        };
      }
      try {
        const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
        const revision = contentRevision(content);
        return {
          uri,
          content,
          revision,
          dirty: false,
          kind,
          source,
          sourceRevision: {
            contentRevision: revision,
            diskRevision: revision,
            dirty: false,
          },
        };
      } catch {
        return null;
      }
    },

    onDidChange(listener) {
      if (disposed) return { dispose() {} };
      listeners.add(listener);
      start();
      let listenerDisposed = false;
      return {
        dispose() {
          if (listenerDisposed) return;
          listenerDisposed = true;
          listeners.delete(listener);
          if (listeners.size === 0) stop();
        },
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      stop();
    },
  };
}
