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
 */
import * as path from "node:path";

import * as vscode from "vscode";

import { type Logger, type WorkbenchInbound, type WorkbenchOutbound } from "@afx/shared";

import { type SpecsDataProvider } from "../services/specs-data";
import { parseSprintPath, sliceSprintSection } from "../services/sprint";
import { appendNoteToWorkspace } from "../utils/notes-utils";
import { getAppDistPath, getAppearanceClass, loadWebviewHtml } from "./webview-html";

export const WORKBENCH_VIEW_TYPE = "afx-workbench";
const MARKDOWN_PREVIEW_EDITOR_ID = "vscode.markdown.preview.editor";
const WORKBENCH_REFRESH_DEBOUNCE_MS = 75;
const WORKBENCH_WATCH_PATTERNS = ["docs/**/*.md", ".afx/notes.md", ".afx/kanban/*.md"] as const;

export interface WorkbenchPanelDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  specsData?: SpecsDataProvider;
  logger?: Logger;
  openChatCommand?: (command: string, mode: "insert" | "send") => Promise<void>;
}

export function createWorkbenchPanel(deps: WorkbenchPanelDeps): vscode.WebviewViewProvider {
  const { extensionUri, extensionMode, specsData, logger, openChatCommand } = deps;
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
        void handleMessage(msg, post, specsData, log, computeTelemetryEnabled, openChatCommand);
      });

      // Push initial data after a short tick for webview startup races.
      setTimeout(() => {
        void pushUpdate();
      }, 250);

      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      let watchers: vscode.FileSystemWatcher[] = [];
      const refresh = (): void => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          specsData?.refresh();
          void pushUpdate();
        }, WORKBENCH_REFRESH_DEBOUNCE_MS);
      };

      const startWatchers = (): void => {
        if (!specsData || watchers.length > 0) return;
        watchers = WORKBENCH_WATCH_PATTERNS.map((pattern) => {
          const watcher = vscode.workspace.createFileSystemWatcher(pattern);
          watcher.onDidChange(refresh);
          watcher.onDidCreate(refresh);
          watcher.onDidDelete(refresh);
          return watcher;
        });
      };
      const stopWatchers = (): void => {
        for (const watcher of watchers) watcher.dispose();
        watchers = [];
      };
      if (view.visible) {
        startWatchers();
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
        stopWatchers();
        configSubscription.dispose();
        telemetrySubscription.dispose();
      });

      view.onDidChangeVisibility(() => {
        if (!view.visible) {
          stopWatchers();
          return;
        }
        startWatchers();
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
  openChatCommand?: (command: string, mode: "insert" | "send") => Promise<void>,
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const primaryFolder = workspaceFolders[0];
  if (!primaryFolder) {
    if (msg.type === "afxOpenChatCommand" && openChatCommand) {
      await openChatCommand(msg.command, msg.mode);
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
      case "afxOpenChatCommand": {
        if (!openChatCommand) return;
        await openChatCommand(msg.command, msg.mode);
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
      case "afxToggleSession":
      case "afxChangeStatus":
        // host-side persistence not yet required for these — webview manages local state
        return;
    }
  } catch (err) {
    log?.error("handleMessage threw", err instanceof Error ? err : undefined);
  }
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
