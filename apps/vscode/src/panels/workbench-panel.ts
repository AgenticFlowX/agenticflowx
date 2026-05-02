/**
 * WorkbenchPanel — webview view provider for the bottom-panel workbench.
 * Pushes initial data, watches docs/specs/, dispatches inbound messages.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 * @see docs/specs/220-app-workbench/spec.md [FR-3]
 * @see docs/specs/220-app-workbench/design.md [DES-API]
 */
import * as path from "node:path";

import * as vscode from "vscode";

import { type Logger, type WorkbenchInbound, type WorkbenchOutbound } from "@afx/shared";

import { type SpecsDataProvider } from "../services/specs-data";
import { parseSprintPath, sliceSprintSection } from "../services/sprint";
import { getAppDistPath, getAppearanceClass, loadWebviewHtml } from "./webview-html";

export const WORKBENCH_VIEW_TYPE = "afx-workbench";
const MARKDOWN_PREVIEW_EDITOR_ID = "vscode.markdown.preview.editor";
const WORKBENCH_REFRESH_DEBOUNCE_MS = 75;

export interface WorkbenchPanelDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  specsData?: SpecsDataProvider;
  logger?: Logger;
}

export function createWorkbenchPanel(deps: WorkbenchPanelDeps): vscode.WebviewViewProvider {
  const { extensionUri, extensionMode, specsData, logger } = deps;
  const log = logger?.child("workbench-panel");

  return {
    resolveWebviewView(view: vscode.WebviewView): void {
      const workbenchDistPath = getAppDistPath(extensionUri, "workbench");
      const localResourceRoots = workbenchDistPath ? [vscode.Uri.file(workbenchDistPath)] : [];

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

      async function pushUpdate(): Promise<void> {
        if (!specsData) return;
        const data = await specsData.getPanelData();
        post({ type: "afxUpdate", ...data });
      }

      view.webview.onDidReceiveMessage((raw: unknown) => {
        if (!raw || typeof raw !== "object" || !("type" in raw)) return;
        const msg = raw as WorkbenchOutbound;
        void handleMessage(msg, post, specsData, log, computeTelemetryEnabled);
      });

      // Push initial data after a short tick for webview startup races.
      setTimeout(() => {
        void pushUpdate();
      }, 250);

      const watchers = [
        vscode.workspace.createFileSystemWatcher("docs/**/*.md"),
        vscode.workspace.createFileSystemWatcher("*/docs/**/*.md"),
        vscode.workspace.createFileSystemWatcher("**/.afx/notes.md"),
        vscode.workspace.createFileSystemWatcher("**/.afx/kanban/*.md"),
      ];
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      const refresh = (): void => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          specsData?.refresh();
          void pushUpdate();
        }, WORKBENCH_REFRESH_DEBOUNCE_MS);
      };
      for (const watcher of watchers) {
        watcher.onDidChange(refresh);
        watcher.onDidCreate(refresh);
        watcher.onDidDelete(refresh);
      }

      const configSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
        const appearanceChanged =
          event.affectsConfiguration("afx.theme") || event.affectsConfiguration("afx.style");
        const telemetryChanged = event.affectsConfiguration("afx.telemetry.enabled");

        if (!appearanceChanged && !telemetryChanged) {
          return;
        }
        if (appearanceChanged) {
          post({ type: "afxAppearanceUpdated", appearanceClass: getAppearanceClass() });
        }
        if (telemetryChanged) {
          post({ type: "afxTelemetryUpdated", enabled: computeTelemetryEnabled() });
        }
      });
      const telemetrySubscription = vscode.env.onDidChangeTelemetryEnabled(() => {
        post({ type: "afxTelemetryUpdated", enabled: computeTelemetryEnabled() });
      });

      view.onDidDispose(() => {
        if (refreshTimer) clearTimeout(refreshTimer);
        for (const watcher of watchers) watcher.dispose();
        configSubscription.dispose();
        telemetrySubscription.dispose();
      });

      view.onDidChangeVisibility(() => {
        if (!view.visible) return;
        specsData?.refresh();
        void pushUpdate();
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
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const primaryFolder = workspaceFolders[0];
  if (!primaryFolder) return;
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
    if (!specsData) return;
    specsData.refresh();
    const data = await specsData.getPanelData();
    post({ type: "afxUpdate", ...data });
  }

  try {
    switch (msg.type) {
      case "afxReady": {
        if (!specsData) return;
        const data = await specsData.getPanelData();
        post({ type: "afxUpdate", ...data });
        post({ type: "afxTelemetryUpdated", enabled: computeTelemetryEnabled() });
        return;
      }
      case "afxOpenFile": {
        const { path: realPath, section } = parseSprintPath(msg.path);
        const uri = await resolvePath(realPath, true);
        const stat = await vscode.workspace.fs.stat(uri).then(
          () => true,
          () => false,
        );
        if (!stat) {
          log?.warn(() => `afxOpenFile: file not found, skipping (${realPath})`);
          vscode.window.showWarningMessage(`AgenticFlowX: file not found — ${realPath}`);
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
        if (section) {
          const buf = await vscode.workspace.fs.readFile(uri).then(
            (b) => Buffer.from(b).toString("utf8"),
            () => null,
          );
          if (buf) {
            const slice = sliceSprintSection(buf, section);
            if (slice) line = slice.startLine;
          }
        }
        if (typeof line === "number") {
          opts.selection = new vscode.Range(line, 0, line, 0);
        }
        await vscode.window.showTextDocument(uri, opts);
        return;
      }
      case "afxFetchDocContent": {
        const { path: realPath, section } = parseSprintPath(msg.filePath);
        const uri = await resolvePath(realPath, true);
        let fullContent: string;
        try {
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
        await vscode.workspace.fs.writeFile(uri, Buffer.from(msg.content, "utf8"));
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
        const uri = await resolvePath(msg.filePath, true);
        await vscode.workspace.fs.delete(uri);
        await refreshAndPost();
        return;
      }
      case "afxToggleTask": {
        const uri = await resolvePath(msg.path, true);
        const buf = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buf).toString("utf8");
        const lines = text.split("\n");
        const target = lines[msg.line - 1] ?? "";
        const next = target.replace(/\[( |x|X)\]/, msg.completed ? "[x]" : "[ ]");
        if (next === target) return;
        lines[msg.line - 1] = next;
        await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join("\n"), "utf8"));
        await refreshAndPost();
        return;
      }
      case "afxAppendNote": {
        const uri = await resolvePath(".afx/notes.md", true);
        let existing = "";
        try {
          existing = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
        } catch {
          existing = "---\nafx: true\ntype: NOTES\n---\n";
        }
        const now = new Date();
        const date = formatLocalDate(now);
        const time = formatLocalNoteTime(now);
        const sanitized = msg.text.trim();
        const next = insertNoteAtTop(existing, date, time, sanitized);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
        await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
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
      case "afxToggleSession":
      case "afxChangeStatus":
        // host-side persistence not yet required for these — webview manages local state
        return;
    }
  } catch (err) {
    log?.error("handleMessage threw", err instanceof Error ? err : undefined);
  }
}

/**
 * Edit or delete a note by ISO timestamp. Supports both note storage formats:
 *   - Inline:  `- **YYYY-MM-DDTHH:MM:SS.mmmZ** body text`
 *   - Section: `## YYYY-MM-DD\n\n### HH:MM:SS.mmmZ\nbody text\n`
 *
 * `newText === null` deletes the note. Returns the rewritten file content,
 * or `null` if the timestamp couldn't be located.
 */
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

/**
 * Insert a new note entry at the top of the body — newest first.
 * If today's `## YYYY-MM-DD` heading already exists, prepend the new
 * `### HH:MM:SS.mmm` block right under it. Otherwise prepend a fresh
 * day section at the top of the body.
 */
function insertNoteAtTop(existing: string, date: string, time: string, text: string): string {
  const fmMatch = existing.match(/^---\n[\s\S]*?\n---\n?/);
  const frontmatter = fmMatch?.[0] ?? "";
  const body = existing.slice(frontmatter.length).replace(/^\s+/, "");

  const newEntry = `### ${time}\n${text}`;
  const todayHeading = `## ${date}`;
  const todayIdx = body.search(new RegExp(`^##\\s+${date}\\s*$`, "m"));

  let nextBody: string;
  if (todayIdx === -1) {
    nextBody = `${todayHeading}\n\n${newEntry}\n${body ? `\n${body}` : ""}`;
  } else {
    const before = body.slice(0, todayIdx);
    const afterHeadingStart = todayIdx + todayHeading.length;
    const after = body.slice(afterHeadingStart).replace(/^\n+/, "");
    nextBody = `${before}${todayHeading}\n\n${newEntry}\n\n${after}`;
  }

  const fmTail = frontmatter && !frontmatter.endsWith("\n") ? "\n" : "";
  return `${frontmatter}${fmTail}${frontmatter ? "\n" : ""}${nextBody.trimEnd()}\n`;
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatLocalNoteTime(date: Date): string {
  return `${[
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":")}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}
