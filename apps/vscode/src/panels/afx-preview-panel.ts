/**
 * AFX Preview panels — editor-area webviews that render markdown in the
 * Workbench DocumentStudio engine, beside the source file. One panel per file
 * URI (multiple previews can sit side by side for reading); re-invoking on the
 * same file reuses its panel. Each panel pushes the in-memory editor buffer on
 * a debounced change, so its preview updates live as the user types.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
 */
import * as vscode from "vscode";

import { parseFrontmatter } from "@afx/parsers";
import { type Logger, type WorkbenchInbound } from "@afx/shared";

import {
  approveWorkSessionCheckboxes,
  toggleAllWorkSessionCheckboxes,
  toggleMarkdownCheckboxLine,
  toggleWorkSessionCheckbox,
  toggleWorkSessionCheckboxLine,
} from "./markdown-checkbox-toggle";
import { getAppDistPath, getAppearanceClass, loadWebviewHtml } from "./webview-html";

const AFX_PREVIEW_VIEW_TYPE = "afxPreview";
const PREVIEW_DEBOUNCE_MS = 200;

export interface AfxPreviewDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  logger?: Logger;
  /** Route an AFX command (e.g. the "Refine" action) to the chat sidebar. */
  openChatCommand?: (command: string, mode: "insert" | "send") => Promise<void> | void;
}

/** Per-URI preview panel state. */
interface PreviewEntry {
  panel: vscode.WebviewPanel;
  uri: vscode.Uri;
  post: (msg: WorkbenchInbound) => void;
  disposables: vscode.Disposable[];
}

// Registry of live preview panels keyed by `uri.toString()`. One entry per file.
const panels = new Map<string, PreviewEntry>();
// Per-key debounce timers so typing in one file never cancels another's refresh.
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Shared host subscriptions (one each, not per-panel); registered lazily on first open.
let sharedDisposables: vscode.Disposable[] = [];

/**
 * Opens (or reveals) the AFX Preview panel for `targetUri` (falling back to the
 * active editor). One panel per file URI: a new file opens beside an existing
 * preview; re-invoking on a file already previewed reuses its panel.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
 */
export function openAfxPreview(deps: AfxPreviewDeps, targetUri?: vscode.Uri): void {
  const { extensionUri, extensionMode, logger } = deps;
  const log = logger?.child("afx-preview-panel");

  const resolved = targetUri ?? vscode.window.activeTextEditor?.document.uri;
  if (!resolved) {
    vscode.window.showWarningMessage("AgenticFlowX: open a markdown file to preview it.");
    return;
  }

  const key = resolved.toString();
  const existing = panels.get(key);
  if (existing) {
    existing.panel.reveal(vscode.ViewColumn.Beside, true);
    void pushPreview(existing, log);
    return;
  }

  ensureSharedSubscriptions(log);

  const workbenchDistPath = getAppDistPath(extensionUri, "workbench");
  const localResourceRoots = workbenchDistPath ? [vscode.Uri.file(workbenchDistPath)] : [];

  const panel = vscode.window.createWebviewPanel(
    AFX_PREVIEW_VIEW_TYPE,
    `AFX Preview — ${basename(resolved)}`,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots,
    },
  );

  panel.webview.html = loadWebviewHtml(panel.webview, extensionUri, "workbench", extensionMode, {
    view: "preview",
  });

  const post = (msg: WorkbenchInbound): void => {
    panel.webview
      .postMessage(msg)
      .then(undefined, (err) =>
        log?.error("postMessage failed", err instanceof Error ? err : undefined),
      );
  };

  const entry: PreviewEntry = { panel, uri: resolved, post, disposables: [] };
  panels.set(key, entry);

  entry.disposables.push(
    panel.webview.onDidReceiveMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object" || !("type" in raw)) return;
      const msg = raw as {
        type: string;
        command?: string;
        content?: string;
        mode?: string;
        line?: number;
        completed?: boolean;
        sessionIndex?: number;
        column?: string;
      };
      switch (msg.type) {
        case "afxReady":
          post({ type: "afxAppearanceUpdated", appearanceClass: getAppearanceClass() });
          void pushPreview(entry, log);
          return;
        case "afxOpenChatCommand":
          // The "Refine" action and any other chat command from the preview.
          if (typeof msg.command === "string") {
            void deps.openChatCommand?.(msg.command, msg.mode === "send" ? "send" : "insert");
          }
          return;
        case "afxCopyMarkdown":
          if (typeof msg.content === "string") {
            void vscode.env.clipboard.writeText(msg.content);
          }
          return;
        case "afxOpenFile":
          // The preview already targets this file's URI — open it directly,
          // ignoring the relative path (avoids re-resolution).
          if (msg.mode === "preview") {
            void vscode.commands.executeCommand("markdown.showPreview", entry.uri);
          } else {
            void vscode.window.showTextDocument(entry.uri, { preview: false });
          }
          return;
        case "afxToggleTask":
          if (typeof msg.line === "number" && typeof msg.completed === "boolean") {
            void mutatePreview(entry, log, (text) =>
              toggleMarkdownCheckboxLine(text, msg.line!, msg.completed!),
            );
          }
          return;
        case "afxToggleSession":
          if (
            typeof msg.sessionIndex === "number" &&
            typeof msg.completed === "boolean" &&
            (msg.column === "agent" || msg.column === "human")
          ) {
            const column = msg.column;
            void mutatePreview(entry, log, (text) =>
              typeof msg.line === "number"
                ? toggleWorkSessionCheckboxLine(text, msg.line, column, msg.completed!)
                : toggleWorkSessionCheckbox(text, msg.sessionIndex!, column, msg.completed!),
            );
          }
          return;
        case "afxToggleAllSessions":
          if (
            typeof msg.completed === "boolean" &&
            (msg.column === "agent" || msg.column === "human")
          ) {
            const column = msg.column;
            void mutatePreview(entry, log, (text) =>
              toggleAllWorkSessionCheckboxes(text, column, msg.completed!),
            );
          }
          return;
        case "afxApproveSessions":
          void mutatePreview(entry, log, approveWorkSessionCheckboxes);
          return;
        default:
          return;
      }
    }),
  );

  panel.onDidDispose(() => {
    panels.delete(key);
    const timer = debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(key);
    }
    for (const sub of entry.disposables) sub.dispose();
    entry.disposables = [];
    if (panels.size === 0) disposeSharedSubscriptions();
  });
}

/**
 * Registers the single shared change/config subscriptions (idempotent). One
 * `onDidChangeTextDocument` (debounced per key) and one `onDidChangeConfiguration`
 * fan out to the matching / all registry entries, avoiding N subscriptions.
 */
function ensureSharedSubscriptions(log: Logger | undefined): void {
  if (sharedDisposables.length > 0) return;
  sharedDisposables.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const key = event.document.uri.toString();
      const entry = panels.get(key);
      if (!entry) return;
      const pending = debounceTimers.get(key);
      if (pending) clearTimeout(pending);
      debounceTimers.set(
        key,
        setTimeout(() => {
          debounceTimers.delete(key);
          void pushPreview(entry, log);
        }, PREVIEW_DEBOUNCE_MS),
      );
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("afx.theme") && !event.affectsConfiguration("afx.style")) {
        return;
      }
      for (const entry of panels.values()) {
        entry.post({ type: "afxAppearanceUpdated", appearanceClass: getAppearanceClass() });
      }
    }),
  );
}

/** Tears down the shared subscriptions once no panels remain. */
function disposeSharedSubscriptions(): void {
  for (const sub of sharedDisposables) sub.dispose();
  sharedDisposables = [];
}

function basename(uri: vscode.Uri): string {
  const path = uri.path || uri.fsPath || uri.toString();
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

async function pushPreview(entry: PreviewEntry, log: Logger | undefined): Promise<void> {
  try {
    const doc = await vscode.workspace.openTextDocument(entry.uri);
    const content = doc.getText();
    let isAfxHint = false;
    try {
      const { data: fm } = parseFrontmatter(content);
      isAfxHint =
        (fm["afx"] === true || fm["afx"] === "true") &&
        typeof fm["type"] === "string" &&
        typeof fm["status"] === "string";
    } catch {
      isAfxHint = false;
    }
    entry.post({
      type: "afxPreviewShow",
      filePath: vscode.workspace.asRelativePath(entry.uri, false),
      content,
      isAfxHint,
    });
  } catch (err) {
    log?.warn(() => `pushPreview failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function mutatePreview(
  entry: PreviewEntry,
  log: Logger | undefined,
  mutate: (text: string) => string,
): Promise<void> {
  try {
    const doc = await vscode.workspace.openTextDocument(entry.uri);
    const current = doc.getText();
    const next = mutate(current);
    if (next === current) return;

    const edit = new vscode.WorkspaceEdit();
    const lastLine = doc.lineAt(Math.max(0, doc.lineCount - 1));
    edit.replace(
      entry.uri,
      new vscode.Range(0, 0, lastLine.range.end.line, lastLine.range.end.character),
      next,
    );
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      log?.warn(() => `checkbox toggle edit was not applied for ${entry.uri.toString()}`);
      return;
    }
    void pushPreview(entry, log);
  } catch (err) {
    log?.warn(() => `checkbox toggle failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
