/**
 * Host-only boundary for untrusted JSON Canvas file-node references.
 *
 * The persisted `file` field remains a standard portable relative path. The
 * owning Canvas source identity travels only over the webview protocol so a
 * multi-root host can resolve the reference deterministically.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-30]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-HOST] [DES-SEC]
 */
import * as path from "node:path";

import * as vscode from "vscode";

import { type WorkbenchSourceIdentity, canvasWorkspaceRootHint } from "@afx/shared";

export type CanvasFileReferenceFailureReason = "outside-workspace" | "ambiguous" | "not-found";

export type CanvasFileReferenceResolution =
  | { ok: true; uri: vscode.Uri }
  | { ok: false; reason: CanvasFileReferenceFailureReason; message: string };

interface ResolveCanvasFileReferenceOptions {
  workspaceFolders?: readonly vscode.WorkspaceFolder[];
  owner?: WorkbenchSourceIdentity;
}

/** Resolve one Canvas file reference without absolute paths, traversal, or first-root fallback. */
export async function resolveCanvasFileReference(
  filePath: string,
  options: ResolveCanvasFileReferenceOptions = {},
): Promise<CanvasFileReferenceResolution> {
  const folders = options.workspaceFolders ?? vscode.workspace.workspaceFolders ?? [];
  const normalized = normalizePortablePath(filePath);
  if (!normalized) return outsideWorkspace(filePath);

  if (options.owner) {
    const exact = folders.find(
      (candidate) => uriIdentity(candidate.uri) === normalizeUriIdentity(options.owner!.rootUri),
    );
    const rootHint = canvasWorkspaceRootHint(options.owner);
    const hinted = rootHint ? folders.filter((candidate) => candidate.name === rootHint) : [];
    const folder = exact ?? (hinted.length === 1 ? hinted[0] : undefined);
    if (!folder) {
      return {
        ok: false,
        reason: "outside-workspace",
        message: `Canvas file reference \`${filePath}\` belongs to a workspace root that is not open.`,
      };
    }
    const relativePath = stripNamedRoot(normalized, options.owner.rootName);
    const candidate = containedUri(folder, relativePath);
    if (!candidate) return outsideWorkspace(filePath);
    if (!(await exists(candidate))) return notFound(filePath);
    return { ok: true, uri: candidate };
  }

  const namedRoots = folders.filter((folder) =>
    normalized.startsWith(`${folder.name.replaceAll("\\", "/")}/`),
  );
  if (namedRoots.length > 1) return ambiguous(filePath);
  if (namedRoots.length === 1) {
    const folder = namedRoots[0]!;
    const candidate = containedUri(folder, stripNamedRoot(normalized, folder.name));
    if (!candidate) return outsideWorkspace(filePath);
    if (!(await exists(candidate))) return notFound(filePath);
    return { ok: true, uri: candidate };
  }

  const matches: vscode.Uri[] = [];
  for (const folder of folders) {
    const candidate = containedUri(folder, normalized);
    if (candidate && (await exists(candidate))) matches.push(candidate);
  }
  if (matches.length > 1) return ambiguous(filePath);
  if (matches.length === 0) return notFound(filePath);
  return { ok: true, uri: matches[0]! };
}

/** Map JSON Canvas `subpath` fragments to a zero-based Markdown source line. */
export function findCanvasSubpathLine(
  content: string,
  subpath: string | undefined,
): number | undefined {
  if (!subpath?.startsWith("#")) return undefined;
  let fragment = subpath.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    // Keep malformed percent escapes literal; an unmatched fragment is harmless.
  }
  if (!fragment) return undefined;
  const lines = content.split(/\r?\n/);
  if (fragment.startsWith("^")) {
    const blockId = fragment.slice(1).trim();
    if (!blockId) return undefined;
    const blockPattern = new RegExp(`(?:^|\\s)\\^${escapeRegExp(blockId)}(?:\\s*$|\\s)`);
    const index = lines.findIndex((line) => blockPattern.test(line));
    return index >= 0 ? index : undefined;
  }

  const expected = normalizeHeading(fragment);
  if (!expected) return undefined;
  const index = lines.findIndex((line) => {
    const match = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    return Boolean(match && normalizeHeading(match[1] ?? "") === expected);
  });
  return index >= 0 ? index : undefined;
}

/** Convert a picked URI to a portable path only when it belongs to the Canvas owner root. */
export function makePortableCanvasFileReference(
  uri: vscode.Uri,
  owner: WorkbenchSourceIdentity,
  workspaceFolders: readonly vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders ?? [],
): string | undefined {
  const exact = workspaceFolders.find(
    (candidate) => uriIdentity(candidate.uri) === normalizeUriIdentity(owner.rootUri),
  );
  const rootHint = canvasWorkspaceRootHint(owner);
  const hinted = rootHint
    ? workspaceFolders.filter((candidate) => candidate.name === rootHint)
    : [];
  const folder = exact ?? (hinted.length === 1 ? hinted[0] : undefined);
  if (!folder) return undefined;
  const relative = path.posix.relative(folder.uri.path, uri.path);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith("../") ||
    path.posix.isAbsolute(relative)
  ) {
    return undefined;
  }
  return relative.replaceAll("\\", "/");
}

function normalizePortablePath(filePath: string): string | undefined {
  if (!filePath || filePath.includes("\0")) return undefined;
  const portable = filePath.replaceAll("\\", "/");
  if (path.posix.isAbsolute(portable) || path.win32.isAbsolute(filePath)) return undefined;
  const normalized = path.posix.normalize(portable);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return undefined;
  return normalized;
}

function containedUri(
  folder: vscode.WorkspaceFolder,
  relativePath: string,
): vscode.Uri | undefined {
  const candidate = vscode.Uri.joinPath(folder.uri, relativePath);
  const relative = path.posix.relative(folder.uri.path, candidate.path);
  if (relative === ".." || relative.startsWith("../") || path.posix.isAbsolute(relative)) {
    return undefined;
  }
  return candidate;
}

function stripNamedRoot(filePath: string, rootName: string): string {
  const portableRootName = rootName.replaceAll("\\", "/");
  return filePath.startsWith(`${portableRootName}/`)
    ? filePath.slice(portableRootName.length + 1)
    : filePath;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  return vscode.workspace.fs.stat(uri).then(
    () => true,
    () => false,
  );
}

function uriIdentity(uri: vscode.Uri): string {
  const rendered = uri.toString();
  return normalizeUriIdentity(
    rendered && rendered !== "[object Object]"
      ? rendered
      : `${uri.scheme || "file"}://${uri.authority ?? ""}${uri.path}`,
  );
}

function normalizeUriIdentity(value: string): string {
  return value.replace(/\/$/, "");
}

function outsideWorkspace(filePath: string): CanvasFileReferenceResolution {
  return {
    ok: false,
    reason: "outside-workspace",
    message: `Canvas file reference \`${filePath}\` must be a relative path inside its workspace root.`,
  };
}

function ambiguous(filePath: string): CanvasFileReferenceResolution {
  return {
    ok: false,
    reason: "ambiguous",
    message: `Canvas file reference \`${filePath}\` exists in more than one workspace root. Re-add it from the intended Canvas root.`,
  };
}

function notFound(filePath: string): CanvasFileReferenceResolution {
  return {
    ok: false,
    reason: "not-found",
    message: `Canvas file reference \`${filePath}\` was not found in the selected workspace root.`,
  };
}

function normalizeHeading(value: string): string {
  return value
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
