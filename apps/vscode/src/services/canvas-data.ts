/**
 * Experimental Workbench canvas host data provider.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-3] [FR-12] [FR-19]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-HOST]
 */
import * as vscode from "vscode";

import type { CanvasFilePayload, Logger } from "@afx/shared";

export const PROJECT_CANVAS_PATH = ".afx/project.canvas";

export interface CanvasDataProvider {
  getCanvasUpdateFields(): Promise<{ canvasEnabled: boolean; canvas?: CanvasFilePayload }>;
  getCanvasPayload(): Promise<CanvasFilePayload>;
  markSavedContent(content: string): void;
  onDidChange(cb: () => void): vscode.Disposable;
  dispose(): void;
}

interface CanvasDataProviderOptions {
  getWorkspaceRoot(): vscode.Uri | undefined;
  isEnabled(): boolean;
  logger?: Logger;
}

/**
 * Reads and watches `.afx/project.canvas` only when the experiment flag is on.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-3] [FR-12] [FR-19] [NFR-2] [NFR-5]
 */
export function createCanvasDataProvider(opts: CanvasDataProviderOptions): CanvasDataProvider {
  const log = opts.logger?.child("canvas-data");
  let watcher: vscode.FileSystemWatcher | undefined;
  let lastSavedContent: string | undefined;
  const listenerDisposables = new Set<vscode.Disposable>();

  function canvasUri(): vscode.Uri | undefined {
    const root = opts.getWorkspaceRoot();
    return root ? vscode.Uri.joinPath(root, PROJECT_CANVAS_PATH) : undefined;
  }

  return {
    async getCanvasUpdateFields() {
      if (!opts.isEnabled()) {
        return { canvasEnabled: false };
      }
      return { canvasEnabled: true, canvas: await this.getCanvasPayload() };
    },

    async getCanvasPayload() {
      const uri = canvasUri();
      if (!uri) {
        return { path: PROJECT_CANVAS_PATH, content: "", exists: false };
      }
      try {
        const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
        return { path: PROJECT_CANVAS_PATH, content, exists: true };
      } catch (err) {
        log?.debug(
          () =>
            `canvas file unavailable at ${PROJECT_CANVAS_PATH} (${err instanceof Error ? err.message : String(err)})`,
        );
        return { path: PROJECT_CANVAS_PATH, content: "", exists: false };
      }
    },

    markSavedContent(content) {
      lastSavedContent = content;
    },

    onDidChange(cb) {
      if (!opts.isEnabled()) {
        return { dispose() {} };
      }
      if (!watcher) {
        watcher = vscode.workspace.createFileSystemWatcher(PROJECT_CANVAS_PATH);
      }
      const handleChange = (): void => {
        void (async () => {
          if (lastSavedContent !== undefined) {
            const payload = await this.getCanvasPayload();
            if (payload.exists && payload.content === lastSavedContent) {
              lastSavedContent = undefined;
              return;
            }
            lastSavedContent = undefined;
          }
          cb();
        })();
      };
      const change = watcher.onDidChange(handleChange);
      const create = watcher.onDidCreate(handleChange);
      const remove = watcher.onDidDelete(handleChange);
      let disposed = false;
      const disposable = {
        dispose() {
          if (disposed) return;
          disposed = true;
          change.dispose();
          create.dispose();
          remove.dispose();
          listenerDisposables.delete(disposable);
        },
      };
      listenerDisposables.add(disposable);
      return disposable;
    },

    dispose() {
      for (const disposable of Array.from(listenerDisposables)) {
        disposable.dispose();
      }
      watcher?.dispose();
      watcher = undefined;
    },
  };
}
