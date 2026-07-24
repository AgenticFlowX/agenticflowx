/**
 * Multi-root workspace file picker for portable Canvas file nodes.
 *
 * A standard relative `file` value remains readable in JSON Canvas tools;
 * `source` is an optional AFX root hint for otherwise ambiguous multi-root
 * workspaces.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-30] [FR-35] [FR-36] [FR-44]
 */
import * as path from "node:path";

import * as vscode from "vscode";

import { type WorkbenchSourceIdentity, portableCanvasSourceIdentity } from "@afx/shared";

import type { WorkbenchFileState } from "./workbench-file-state";

export type CanvasReferenceKind = "any" | "markdown" | "image" | "canvas";

export interface CanvasPickedReference {
  filePath: string;
  source: WorkbenchSourceIdentity;
}

export interface CanvasReferencePicker {
  pick(options: {
    owner?: WorkbenchSourceIdentity;
    kind?: CanvasReferenceKind;
    allowMultiple?: boolean;
  }): Promise<CanvasPickedReference[]>;
}

export function createCanvasReferencePicker(options: {
  fileState: Pick<WorkbenchFileState, "identify" | "resolve">;
  showOpenDialog?: typeof vscode.window.showOpenDialog;
}): CanvasReferencePicker {
  const showOpenDialog = options.showOpenDialog ?? vscode.window.showOpenDialog;
  return {
    async pick(request) {
      const defaultUri = request.owner ? options.fileState.resolve(request.owner) : undefined;
      const selected = await showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: request.allowMultiple ?? true,
        title: pickerTitle(request.kind ?? "any"),
        openLabel: request.allowMultiple === false ? "Attach file" : "Attach files",
        ...(defaultUri ? { defaultUri: parentUri(defaultUri) } : {}),
        filters: pickerFilters(request.kind ?? "any"),
      });
      if (!selected || selected.length === 0) return [];
      const references = new Map<string, CanvasPickedReference>();
      for (const uri of selected) {
        const source = options.fileState.identify(uri);
        if (!source) continue;
        const key = `${source.rootUri}\0${source.relativePath}`;
        const sameOwner = request.owner
          ? source.rootUri === request.owner.rootUri || source.rootName === request.owner.rootName
          : false;
        references.set(key, {
          filePath: sameOwner ? source.relativePath : `${source.rootName}/${source.relativePath}`,
          source: portableCanvasSourceIdentity(source),
        });
      }
      if (references.size === 0) {
        // Every selected file resolved outside the workspace — canvas file
        // nodes store workspace-relative paths, so this must surface as an
        // explicit error rather than a silent no-op.
        throw new Error(
          selected.length === 1
            ? "The selected file is outside this workspace. Copy it into the workspace first, then attach it."
            : "The selected files are outside this workspace. Copy them into the workspace first, then attach them.",
        );
      }
      return [...references.values()].sort(
        (left, right) =>
          left.source.rootName.localeCompare(right.source.rootName) ||
          left.filePath.localeCompare(right.filePath),
      );
    },
  };
}

function parentUri(uri: vscode.Uri): vscode.Uri {
  if (uri.scheme === "file") return vscode.Uri.file(path.dirname(uri.fsPath));
  const authority = uri.authority ? `//${uri.authority}` : "";
  return vscode.Uri.parse(`${uri.scheme}:${authority}${path.posix.dirname(uri.path)}`);
}

function pickerTitle(kind: CanvasReferenceKind): string {
  if (kind === "markdown") return "Attach Markdown or spec files to Canvas";
  if (kind === "image") return "Attach images to Canvas";
  if (kind === "canvas") return "Open an existing Canvas";
  return "Attach workspace files to Canvas";
}

function pickerFilters(kind: CanvasReferenceKind): Record<string, string[]> | undefined {
  if (kind === "markdown") return { "Markdown and specs": ["md", "markdown"] };
  if (kind === "image") {
    return { Images: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"] };
  }
  if (kind === "canvas") return { "JSON Canvas": ["canvas"] };
  return undefined;
}
