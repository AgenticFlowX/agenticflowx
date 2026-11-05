/**
 * Bounded workspace project discovery and deepest-owner resolution.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-1] [FR-2]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-ARCH] [DES-DATA] [DES-API]
 */
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

export const PROJECT_DISCOVERY_LIMITS = {
  maxDepth: 4,
  maxProjects: 50,
  maxCandidates: 5_000,
} as const;

export type ProjectKind = "repository" | "folder";
export type GitMarkerKind = "directory" | "file" | "unavailable";

export interface ProjectContext {
  id: string;
  rootUri: vscode.Uri;
  workspaceUri: vscode.Uri;
  name: string;
  kind: ProjectKind;
  gitMarker: GitMarkerKind;
  checkoutIdentity: string;
  packagePaths: string[];
  discovery: {
    complete: boolean;
    reason?: "depth-limit" | "project-limit" | "candidate-limit" | "read-failed";
  };
}

export interface ProjectDiscoveryResult {
  projects: ProjectContext[];
  complete: boolean;
  candidateCount: number;
  reasons: ProjectContext["discovery"]["reason"][];
}

export interface ProjectDiscoveryOptions {
  limits?: Partial<{ maxDepth: number; maxProjects: number; maxCandidates: number }>;
}

function uriIdentity(uri: vscode.Uri): string {
  return `${uri.scheme ?? "file"}\u0000${uri.authority ?? ""}\u0000${uri.path ?? uri.fsPath}`;
}

function contains(root: vscode.Uri, candidate: vscode.Uri): boolean {
  if ((root.scheme ?? "file") !== (candidate.scheme ?? "file")) return false;
  if ((root.authority ?? "") !== (candidate.authority ?? "")) return false;
  const relative = path.posix.relative(
    root.path ?? root.fsPath,
    candidate.path ?? candidate.fsPath,
  );
  return relative === "" || (relative !== ".." && !relative.startsWith("../"));
}

async function markerKind(root: string): Promise<GitMarkerKind | undefined> {
  try {
    const stat = await lstat(path.join(root, ".git"));
    if (stat.isDirectory()) return "directory";
    if (stat.isFile()) {
      const marker = await readFile(path.join(root, ".git"), "utf8");
      return /^gitdir:\s*\S+/m.test(marker) ? "file" : "unavailable";
    }
    return "unavailable";
  } catch {
    return undefined;
  }
}

/**
 * Discovers repository roots without invoking Git or following symlinked directories.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-1] [NFR-2] [NFR-4]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-API] [DES-SEC]
 */
export async function discoverProjects(
  folders: readonly vscode.WorkspaceFolder[],
  options: ProjectDiscoveryOptions = {},
): Promise<ProjectDiscoveryResult> {
  const limits = { ...PROJECT_DISCOVERY_LIMITS, ...options.limits };
  const projects: ProjectContext[] = [];
  const packageCandidates: vscode.Uri[] = [];
  const reasons = new Set<ProjectContext["discovery"]["reason"]>();
  let candidateCount = 0;

  const addProject = async (
    rootUri: vscode.Uri,
    workspaceUri: vscode.Uri,
    fallback: boolean,
  ): Promise<void> => {
    if (projects.length >= limits.maxProjects) {
      reasons.add("project-limit");
      return;
    }
    const marker = await markerKind(rootUri.fsPath);
    if (!marker && !fallback) return;
    projects.push({
      id: uriIdentity(rootUri),
      rootUri,
      workspaceUri,
      name: path.posix.basename(rootUri.path ?? rootUri.fsPath) || path.basename(rootUri.fsPath),
      kind: marker ? "repository" : "folder",
      gitMarker: marker ?? "unavailable",
      checkoutIdentity: uriIdentity(rootUri),
      packagePaths: [],
      discovery: { complete: true },
    });
  };

  for (const folder of folders) {
    const before = projects.length;
    await addProject(folder.uri, folder.uri, true);
    const walk = async (directory: string, depth: number): Promise<void> => {
      if (candidateCount >= limits.maxCandidates || projects.length >= limits.maxProjects) return;
      if (depth >= limits.maxDepth) {
        reasons.add("depth-limit");
        return;
      }
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        reasons.add("read-failed");
        return;
      }
      for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name.startsWith("."))
          continue;
        candidateCount += 1;
        if (candidateCount > limits.maxCandidates) {
          reasons.add("candidate-limit");
          break;
        }
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const child = path.join(directory, entry.name);
        const childUri = vscode.Uri.file(child);
        for (const manifest of ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"]) {
          try {
            await lstat(path.join(child, manifest));
            packageCandidates.push(vscode.Uri.file(path.join(child, manifest)));
          } catch {
            // Not every folder is a package.
          }
        }
        const marker = await markerKind(child);
        if (marker) {
          await addProject(childUri, folder.uri, false);
        }
        await walk(child, depth + 1);
      }
    };
    if (folder.uri.scheme === "file") await walk(folder.uri.fsPath, 0);

    const workspaceProjects = projects.slice(before);
    for (const project of workspaceProjects) {
      for (const manifest of ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"]) {
        try {
          await lstat(path.join(project.rootUri.fsPath, manifest));
          packageCandidates.push(vscode.Uri.file(path.join(project.rootUri.fsPath, manifest)));
        } catch {
          // An absent supported manifest is an ordinary observation.
        }
      }
    }
  }

  for (const manifest of packageCandidates) {
    const owner = resolveProject(manifest, projects);
    if (!owner) continue;
    const relative = path.relative(owner.rootUri.fsPath, manifest.fsPath).split(path.sep).join("/");
    if (!owner.packagePaths.includes(relative)) owner.packagePaths.push(relative);
  }

  if (projects.length >= limits.maxProjects) reasons.add("project-limit");
  const complete = reasons.size === 0;
  const reason = reasons.values().next().value;
  if (!complete) for (const project of projects) project.discovery = { complete, reason };
  return { projects, complete, candidateCount, reasons: [...reasons] };
}

/**
 * Returns the deepest project containing a document and never falls back to the first root.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-2] [NFR-4]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-DATA] [DES-API]
 */
export function resolveProject(
  documentUri: vscode.Uri,
  projects: readonly ProjectContext[],
): ProjectContext | undefined {
  return projects
    .filter((project) => contains(project.rootUri, documentUri))
    .sort(
      (left, right) =>
        (right.rootUri.path ?? right.rootUri.fsPath).length -
        (left.rootUri.path ?? left.rootUri.fsPath).length,
    )[0];
}

export function createDocumentRootResolver(
  getProjects: () => readonly ProjectContext[],
): (document: vscode.TextDocument) => string | undefined {
  return (document) => resolveProject(document.uri, getProjects())?.rootUri.fsPath;
}
