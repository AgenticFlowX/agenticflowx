/**
 * Multi-root Canvas discovery and collision-safe file lifecycle operations.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-3] [FR-5] [FR-6] [FR-7] [FR-12] [FR-19]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-FILES]
 */
import { createHash } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import {
  type CanvasTemplateId,
  createCanvasTemplate,
  parseJSONCanvas,
  serializeJSONCanvas,
} from "@afx/canvas-engine";
import {
  type CanvasDescriptor,
  type CanvasDocumentSnapshot,
  type WorkbenchMutationResult,
  type WorkbenchSourceIdentity,
  type WorkbenchSourceRevision,
  canvasDocumentId,
} from "@afx/shared";

import type { WorkbenchFileState } from "./workbench-file-state";
import type { WorkbenchMutationCoordinator } from "./workbench-mutation-coordinator";

const PROJECT_CANVAS = ".afx/project.canvas";
const NAMED_CANVAS_DIR = ".afx/canvases";

export interface CanvasLibrarySnapshot {
  canvases: CanvasDescriptor[];
  selectedId?: string;
}

export interface CanvasLibraryService {
  list(): Promise<CanvasLibrarySnapshot>;
  select(canvasId: string): Promise<CanvasDocumentSnapshot | undefined>;
  create(request: {
    requestId: string;
    targetRootUri: string;
    name: string;
    template?: CanvasTemplateId;
    pickLocation?: boolean;
  }): Promise<WorkbenchMutationResult>;
  rename(request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
    name: string;
  }): Promise<WorkbenchMutationResult>;
  duplicate(request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
    name: string;
  }): Promise<WorkbenchMutationResult>;
  delete(request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
  }): Promise<WorkbenchMutationResult>;
  current(): Promise<CanvasDocumentSnapshot | undefined>;
}

export function createCanvasLibraryService(options: {
  fileState: WorkbenchFileState;
  coordinator: WorkbenchMutationCoordinator;
  getWorkspaceFolders?: () => readonly vscode.WorkspaceFolder[] | undefined;
  workspaceState?: vscode.Memento;
}): CanvasLibraryService {
  const getWorkspaceFolders =
    options.getWorkspaceFolders ?? (() => vscode.workspace.workspaceFolders);
  let selectedId = options.workspaceState?.get<string>("afx.canvas.selectedId");
  const rememberSelection = (id: string | undefined): void => {
    selectedId = id;
    void options.workspaceState?.update("afx.canvas.selectedId", id);
  };

  const list = async (): Promise<CanvasLibrarySnapshot> => {
    const folders = getWorkspaceFolders() ?? [];
    const descriptors = new Map<string, CanvasDescriptor>();

    for (const folder of folders) {
      const uri = vscode.Uri.joinPath(folder.uri, PROJECT_CANVAS);
      const descriptor = await describe(uri, "project", options.fileState);
      if (descriptor) descriptors.set(descriptor.id, descriptor);
    }

    const discovered = await vscode.workspace.findFiles(
      "**/*.canvas",
      "**/{.git,node_modules,.pnpm-store}/**",
    );
    for (const uri of discovered) {
      const source = options.fileState.identify(uri);
      if (!source) continue;
      const kind =
        source.relativePath === PROJECT_CANVAS
          ? "project"
          : source.relativePath.startsWith(`${NAMED_CANVAS_DIR}/`)
            ? "named"
            : "external";
      const descriptor = await describe(uri, kind, options.fileState);
      if (descriptor) descriptors.set(descriptor.id, descriptor);
    }

    const canvases = disambiguateLabels([...descriptors.values()], folders.length > 1).sort(
      (a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.label.localeCompare(b.label),
    );
    if (!selectedId || !canvases.some((canvas) => canvas.id === selectedId)) {
      rememberSelection(canvases.find((canvas) => canvas.exists)?.id ?? canvases[0]?.id);
    }
    return { canvases, ...(selectedId ? { selectedId } : {}) };
  };

  const select = async (canvasId: string): Promise<CanvasDocumentSnapshot | undefined> => {
    const library = await list();
    const descriptor = library.canvases.find((candidate) => candidate.id === canvasId);
    if (!descriptor) return undefined;
    rememberSelection(descriptor.id);
    return readDocument(descriptor, options.fileState);
  };

  const validate = async (request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
  }): Promise<
    | { ok: true; content: string; revision: WorkbenchSourceRevision; uri: vscode.Uri }
    | { ok: false; result: WorkbenchMutationResult }
  > => {
    const uri = options.fileState.resolve(request.target);
    if (!uri) {
      return {
        ok: false,
        result: errorResult(
          request,
          "outside-workspace",
          "Canvas is outside this workspace.",
          false,
        ),
      };
    }
    const snapshot = await options.fileState.readText(uri);
    if (!snapshot) {
      return {
        ok: false,
        result: errorResult(request, "not-found", "Canvas no longer exists.", true),
      };
    }
    if (snapshot.dirty) {
      return {
        ok: false,
        result: conflictResult(
          request,
          "dirty-document",
          "Save or discard the open Canvas text editor before retrying.",
          snapshot.sourceRevision,
        ),
      };
    }
    if (snapshot.revision !== request.expectedRevision) {
      return {
        ok: false,
        result: conflictResult(
          request,
          "stale-revision",
          "Canvas changed after this view loaded. Reload and retry.",
          snapshot.sourceRevision,
        ),
      };
    }
    return { ok: true, content: snapshot.content, revision: snapshot.sourceRevision, uri };
  };

  const writeNamed = async (
    requestId: string,
    source: WorkbenchSourceIdentity,
    content: string,
  ): Promise<WorkbenchMutationResult> =>
    options.coordinator.mutateText({
      requestId,
      target: source,
      allowCreate: true,
      requireMissing: true,
      transform: () => content,
    });

  const create = async (request: {
    requestId: string;
    targetRootUri: string;
    name: string;
    template?: CanvasTemplateId;
    pickLocation?: boolean;
  }): Promise<WorkbenchMutationResult> => {
    const folder = (getWorkspaceFolders() ?? []).find(
      (candidate) => serializeUri(candidate.uri) === request.targetRootUri,
    );
    let destination: WorkbenchSourceIdentity = {
      rootUri: request.targetRootUri,
      rootName: folder?.name ?? "workspace",
      relativePath: `${NAMED_CANVAS_DIR}/${slug(request.name)}.canvas`,
    };
    if (!folder || !slug(request.name)) {
      return errorResult(
        requestWithTarget(request, destination),
        "outside-workspace",
        "Choose a workspace and a valid Canvas name.",
        false,
      );
    }
    if (request.pickLocation) {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: folder.uri,
        openLabel: "Create canvas here",
        title: "Choose a folder for the new canvas",
      });
      const pickedUri = picked?.[0];
      if (!pickedUri) {
        return errorResult(
          requestWithTarget(request, destination),
          "cancelled",
          "Canvas creation cancelled.",
          true,
        );
      }
      const identity = options.fileState.identify(pickedUri);
      if (!identity) {
        return errorResult(
          requestWithTarget(request, destination),
          "outside-workspace",
          "Choose a folder inside an open workspace folder.",
          true,
        );
      }
      destination = {
        ...identity,
        relativePath: `${identity.relativePath ? `${identity.relativePath}/` : ""}${slug(
          request.name,
        )}.canvas`,
      };
    }
    const result = await writeNamed(
      request.requestId,
      destination,
      serializeJSONCanvas(createCanvasTemplate(request.template ?? "blank")),
    );
    if (result.outcome === "success") rememberSelection(canvasDocumentId(destination));
    return result;
  };

  const duplicate = async (request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
    name: string;
  }): Promise<WorkbenchMutationResult> => {
    const current = await validate(request);
    if (!current.ok) return current.result;
    const destination = siblingSource(request.target, request.name);
    if (!destination) return errorResult(request, "collision", "Enter a valid Canvas name.", false);
    const result = await writeNamed(request.requestId, destination, current.content);
    if (result.outcome === "success") rememberSelection(canvasDocumentId(destination));
    return result;
  };

  const rename = async (request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
    name: string;
  }): Promise<WorkbenchMutationResult> => {
    if (isProjectCanvas(request.target)) {
      return errorResult(
        request,
        "write-failed",
        "Project Canvas keeps its canonical filename.",
        false,
      );
    }
    const current = await validate(request);
    if (!current.ok) return current.result;
    const destination = siblingSource(request.target, request.name);
    if (!destination) return errorResult(request, "collision", "Enter a valid Canvas name.", false);
    if (destination.relativePath === request.target.relativePath)
      return successResult(request, current.revision);
    const written = await writeNamed(request.requestId, destination, current.content);
    if (written.outcome !== "success") return written;
    try {
      await vscode.workspace.fs.delete(current.uri);
    } catch (cause) {
      const destinationUri = options.fileState.resolve(destination);
      if (destinationUri) {
        await Promise.resolve(vscode.workspace.fs.delete(destinationUri)).catch(() => undefined);
      }
      return errorResult(
        request,
        "write-failed",
        cause instanceof Error ? cause.message : "Canvas could not be renamed.",
        true,
      );
    }
    rememberSelection(canvasDocumentId(destination));
    return { ...written, target: destination };
  };

  const remove = async (request: {
    requestId: string;
    target: WorkbenchSourceIdentity;
    expectedRevision: string;
  }): Promise<WorkbenchMutationResult> => {
    if (isProjectCanvas(request.target)) {
      return errorResult(request, "write-failed", "Project Canvas cannot be deleted.", false);
    }
    const current = await validate(request);
    if (!current.ok) return current.result;
    try {
      await vscode.workspace.fs.delete(current.uri);
    } catch (cause) {
      return errorResult(
        request,
        "write-failed",
        cause instanceof Error ? cause.message : "Canvas could not be deleted.",
        true,
      );
    }
    rememberSelection(undefined);
    return successResult(request, current.revision);
  };

  return {
    list,
    select,
    create,
    rename,
    duplicate,
    delete: remove,
    async current() {
      const library = await list();
      return library.selectedId ? select(library.selectedId) : undefined;
    },
  };
}

async function describe(
  uri: vscode.Uri,
  kind: CanvasDescriptor["kind"],
  fileState: WorkbenchFileState,
): Promise<CanvasDescriptor | undefined> {
  const source = fileState.identify(uri);
  if (!source) return undefined;
  const stat = await vscode.workspace.fs.stat(uri).then(
    (value) => value,
    () => undefined,
  );
  return {
    id: canvasDocumentId(source),
    kind,
    label: baseLabel(source, kind),
    source,
    exists: Boolean(stat),
    ...(stat ? { updatedAt: new Date(stat.mtime).toISOString() } : {}),
  };
}

async function readDocument(
  descriptor: CanvasDescriptor,
  fileState: WorkbenchFileState,
): Promise<CanvasDocumentSnapshot | undefined> {
  const uri = fileState.resolve(descriptor.source);
  if (!uri) return undefined;
  const snapshot = await fileState.readText(uri);
  const content = snapshot?.content ?? "";
  let parseError: string | undefined;
  try {
    parseJSONCanvas(content);
  } catch (cause) {
    parseError = cause instanceof Error ? cause.message : "Invalid JSON Canvas";
  }
  const revision =
    snapshot?.sourceRevision ??
    ({
      contentRevision: digest(content),
      ...(descriptor.exists ? { diskRevision: digest(content) } : {}),
      dirty: false,
    } satisfies WorkbenchSourceRevision);
  return {
    documentId: descriptor.id,
    descriptor,
    source: descriptor.source,
    revision,
    content,
    ...(parseError ? { parseError } : {}),
  };
}

function disambiguateLabels(
  descriptors: CanvasDescriptor[],
  multipleRoots: boolean,
): CanvasDescriptor[] {
  const basenameCounts = new Map<string, number>();
  for (const descriptor of descriptors) {
    const name = path.posix.basename(descriptor.source.relativePath).toLowerCase();
    basenameCounts.set(name, (basenameCounts.get(name) ?? 0) + 1);
  }
  return descriptors.map((descriptor) => {
    const basename = path.posix.basename(descriptor.source.relativePath).toLowerCase();
    const collision = (basenameCounts.get(basename) ?? 0) > 1;
    const relative =
      descriptor.kind === "project"
        ? baseLabel(descriptor.source, descriptor.kind)
        : collision
          ? shortestUsefulSuffix(descriptor.source.relativePath)
          : baseLabel(descriptor.source, descriptor.kind);
    return {
      ...descriptor,
      label: multipleRoots ? `${descriptor.source.rootName} · ${relative}` : relative,
    };
  });
}

function shortestUsefulSuffix(relativePath: string): string {
  const parts = relativePath.split("/").filter(Boolean);
  return parts
    .slice(-2)
    .join("/")
    .replace(/\.canvas$/i, "");
}

function baseLabel(source: WorkbenchSourceIdentity, kind: CanvasDescriptor["kind"]): string {
  if (kind === "project") return "Project Canvas";
  return path.posix.basename(source.relativePath).replace(/\.canvas$/i, "");
}

function siblingSource(
  source: WorkbenchSourceIdentity,
  name: string,
): WorkbenchSourceIdentity | undefined {
  const filename = slug(name);
  if (!filename) return undefined;
  const parent = path.posix.dirname(source.relativePath);
  return { ...source, relativePath: `${parent}/${filename}.canvas` };
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isProjectCanvas(source: WorkbenchSourceIdentity): boolean {
  const normalized = path.posix.normalize(source.relativePath.replaceAll("\\", "/"));
  return normalized === PROJECT_CANVAS;
}

function serializeUri(uri: vscode.Uri): string {
  const rendered = uri.toString();
  return rendered && rendered !== "[object Object]"
    ? rendered
    : `${uri.scheme || "file"}://${uri.authority ?? ""}${uri.path}`;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function kindOrder(kind: CanvasDescriptor["kind"]): number {
  return kind === "project" ? 0 : kind === "named" ? 1 : 2;
}

function requestWithTarget(
  request: { requestId: string },
  target: WorkbenchSourceIdentity,
): { requestId: string; target: WorkbenchSourceIdentity } {
  return { requestId: request.requestId, target };
}

function successResult(
  request: { requestId: string; target: WorkbenchSourceIdentity },
  revision: WorkbenchSourceRevision,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "success",
    target: request.target,
    revision,
  };
}

function conflictResult(
  request: { requestId: string; target: WorkbenchSourceIdentity },
  code: "dirty-document" | "stale-revision",
  message: string,
  revision: WorkbenchSourceRevision,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "conflict",
    target: request.target,
    code,
    message,
    revision,
    retryable: true,
  };
}

function errorResult(
  request: { requestId: string; target: WorkbenchSourceIdentity },
  code: "outside-workspace" | "not-found" | "collision" | "cancelled" | "write-failed",
  message: string,
  retryable: boolean,
): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "error",
    target: request.target,
    code,
    message,
    retryable,
  };
}
