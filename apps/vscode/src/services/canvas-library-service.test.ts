/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-5] [FR-6] [FR-7] [FR-12]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-TEST]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchMutationResult, WorkbenchSourceIdentity } from "@afx/shared";

import { createCanvasLibraryService } from "./canvas-library-service";
import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";
import type {
  WorkbenchMutationCoordinator,
  WorkbenchTextMutation,
} from "./workbench-mutation-coordinator";

const roots = [
  { uri: vscode.Uri.file("/repo"), name: "repo", index: 0 },
  { uri: vscode.Uri.file("/other"), name: "other", index: 1 },
] as vscode.WorkspaceFolder[];

function sourceFor(uri: vscode.Uri): WorkbenchSourceIdentity | undefined {
  const root = roots.find(
    (candidate) => uri.path === candidate.uri.path || uri.path.startsWith(`${candidate.uri.path}/`),
  );
  if (!root) return undefined;
  return {
    rootUri: `file://${root.uri.path}`,
    rootName: root.name,
    relativePath: uri.path.slice(root.uri.path.length).replace(/^\//, ""),
  };
}

function uriFor(source: WorkbenchSourceIdentity): vscode.Uri | undefined {
  const root = roots.find((candidate) => `file://${candidate.uri.path}` === source.rootUri);
  return root ? vscode.Uri.joinPath(root.uri, source.relativePath) : undefined;
}

function snapshot(uri: vscode.Uri, content = '{"nodes":[],"edges":[]}'): WorkbenchTextSnapshot {
  const source = sourceFor(uri)!;
  return {
    uri,
    content,
    revision: "rev-1",
    dirty: false,
    kind: "canvas",
    source,
    sourceRevision: { contentRevision: "rev-1", diskRevision: "rev-1", dirty: false },
  };
}

function fileState(
  readText: (uri: vscode.Uri) => Promise<WorkbenchTextSnapshot | null> = async (uri) =>
    snapshot(uri),
): WorkbenchFileState {
  return {
    classify: () => "canvas",
    identify: sourceFor,
    resolve: uriFor,
    readText,
    onDidChange: () => ({ dispose() {} }),
    dispose() {},
  };
}

function coordinator(
  implementation?: (request: WorkbenchTextMutation) => Promise<WorkbenchMutationResult>,
): WorkbenchMutationCoordinator {
  const defaultImplementation = async (
    request: WorkbenchTextMutation,
  ): Promise<WorkbenchMutationResult> => ({
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "success",
    target: request.target,
    revision: { contentRevision: "next", diskRevision: "next", dirty: false },
  });
  return {
    mutateText: vi.fn(implementation ?? defaultImplementation),
    dispose() {},
  };
}

describe("createCanvasLibraryService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("discovers project, named, and external canvases across roots with unambiguous labels", async () => {
    vi.spyOn(vscode.workspace, "findFiles").mockResolvedValue([
      vscode.Uri.file("/repo/.afx/project.canvas"),
      vscode.Uri.file("/repo/.afx/canvases/roadmap.canvas"),
      vscode.Uri.file("/repo/docs/plan.canvas"),
      vscode.Uri.file("/other/docs/plan.canvas"),
    ]);
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 1_700_000_000_000,
      size: 20,
    });
    const service = createCanvasLibraryService({
      fileState: fileState(),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });

    const library = await service.list();

    expect(library.canvases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "project", label: "repo · Project Canvas" }),
        expect.objectContaining({ kind: "named", label: "repo · roadmap" }),
        expect.objectContaining({ kind: "external", label: "repo · docs/plan" }),
        expect.objectContaining({ kind: "external", label: "other · docs/plan" }),
      ]),
    );
    expect(library.canvases).toHaveLength(5);
    expect(library.selectedId).toBeDefined();
  });

  it("discovers more than 500 canvases without a maxResults cap or order-dependent collisions", async () => {
    const discovered = Array.from({ length: 256 }, (_, index) => {
      const filename = `feature-${String(index).padStart(3, "0")}.canvas`;
      return [
        vscode.Uri.file(`/repo/docs/${filename}`),
        vscode.Uri.file(`/other/architecture/${filename}`),
      ];
    }).flat();
    const findFiles = vi
      .spyOn(vscode.workspace, "findFiles")
      .mockResolvedValueOnce(discovered)
      .mockResolvedValueOnce([...discovered].reverse());
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 1_700_000_000_000,
      size: 20,
    });
    const service = createCanvasLibraryService({
      fileState: fileState(),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });

    const first = await service.list();
    const second = await service.list();
    const firstIds = first.canvases.map((canvas) => canvas.id);

    expect(findFiles.mock.calls).toEqual([
      ["**/*.canvas", "**/{.git,node_modules,.pnpm-store}/**"],
      ["**/*.canvas", "**/{.git,node_modules,.pnpm-store}/**"],
    ]);
    expect(first.canvases).toHaveLength(514);
    expect(new Set(firstIds).size).toBe(514);
    expect(second.canvases.map((canvas) => canvas.id)).toEqual(firstIds);
    expect(first.canvases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "repo · docs/feature-000",
          source: expect.objectContaining({
            rootUri: "file:///repo",
            relativePath: "docs/feature-000.canvas",
          }),
        }),
        expect.objectContaining({
          label: "other · architecture/feature-000",
          source: expect.objectContaining({
            rootUri: "file:///other",
            relativePath: "architecture/feature-000.canvas",
          }),
        }),
      ]),
    );
  });

  it("creates named canvases through the coordinator with a collision guard and starter", async () => {
    vi.spyOn(vscode.workspace, "findFiles").mockResolvedValue([]);
    vi.spyOn(vscode.workspace.fs, "stat").mockRejectedValue(new Error("missing"));
    const mutations: WorkbenchTextMutation[] = [];
    const service = createCanvasLibraryService({
      fileState: fileState(async () => null),
      coordinator: coordinator(async (request) => {
        mutations.push(request);
        return {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "success",
          target: request.target,
          revision: { contentRevision: "next", diskRevision: "next", dirty: false },
        };
      }),
      getWorkspaceFolders: () => roots.slice(0, 1),
    });

    const result = await service.create({
      requestId: "create-1",
      targetRootUri: "file:///repo",
      name: "Next Feature",
      template: "feature",
    });

    expect(result).toEqual(expect.objectContaining({ outcome: "success" }));
    expect(mutations[0]).toEqual(
      expect.objectContaining({
        target: expect.objectContaining({ relativePath: ".afx/canvases/next-feature.canvas" }),
        allowCreate: true,
        requireMissing: true,
      }),
    );
    await expect(Promise.resolve(mutations[0]!.transform(""))).resolves.toContain("User problem");
  });

  it("creates in a picked workspace folder when pickLocation is requested", async () => {
    vi.spyOn(vscode.workspace, "findFiles").mockResolvedValue([]);
    vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue([
      vscode.Uri.file("/repo/docs/planning"),
    ]);
    const mutations: WorkbenchTextMutation[] = [];
    const service = createCanvasLibraryService({
      fileState: fileState(async () => null),
      coordinator: coordinator(async (request) => {
        mutations.push(request);
        return {
          type: "afxMutationResult",
          requestId: request.requestId,
          outcome: "success",
          target: request.target,
          revision: { contentRevision: "next", diskRevision: "next", dirty: false },
        };
      }),
      getWorkspaceFolders: () => roots.slice(0, 1),
    });

    const result = await service.create({
      requestId: "create-picked",
      targetRootUri: "file:///repo",
      name: "Next Feature",
      pickLocation: true,
    });

    expect(result).toEqual(expect.objectContaining({ outcome: "success" }));
    expect(mutations[0]).toEqual(
      expect.objectContaining({
        target: expect.objectContaining({ relativePath: "docs/planning/next-feature.canvas" }),
        allowCreate: true,
        requireMissing: true,
      }),
    );
  });

  it("returns a quiet cancelled result when the folder picker is dismissed", async () => {
    vi.spyOn(vscode.workspace, "findFiles").mockResolvedValue([]);
    vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue(undefined);
    const mutate = coordinator();
    const service = createCanvasLibraryService({
      fileState: fileState(async () => null),
      coordinator: mutate,
      getWorkspaceFolders: () => roots.slice(0, 1),
    });

    const result = await service.create({
      requestId: "create-cancelled",
      targetRootUri: "file:///repo",
      name: "Next Feature",
      pickLocation: true,
    });

    expect(result).toEqual(expect.objectContaining({ outcome: "error", code: "cancelled" }));
    expect(mutate.mutateText).not.toHaveBeenCalled();
  });

  it("rejects a picked folder outside every workspace root", async () => {
    vi.spyOn(vscode.workspace, "findFiles").mockResolvedValue([]);
    vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue([
      vscode.Uri.file("/elsewhere/planning"),
    ]);
    const mutate = coordinator();
    const service = createCanvasLibraryService({
      fileState: fileState(async () => null),
      coordinator: mutate,
      getWorkspaceFolders: () => roots.slice(0, 1),
    });

    const result = await service.create({
      requestId: "create-outside",
      targetRootUri: "file:///repo",
      name: "Next Feature",
      pickLocation: true,
    });

    expect(result).toEqual(
      expect.objectContaining({ outcome: "error", code: "outside-workspace" }),
    );
    expect(mutate.mutateText).not.toHaveBeenCalled();
  });

  it("rejects stale or dirty lifecycle operations before touching disk", async () => {
    vi.spyOn(vscode.workspace, "findFiles").mockResolvedValue([]);
    const remove = vi.spyOn(vscode.workspace.fs, "delete");
    const target = sourceFor(vscode.Uri.file("/repo/.afx/canvases/risk.canvas"))!;
    const staleService = createCanvasLibraryService({
      fileState: fileState(),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });
    const dirtyService = createCanvasLibraryService({
      fileState: fileState(async (uri) => ({
        ...snapshot(uri),
        dirty: true,
        sourceRevision: { contentRevision: "rev-1", diskRevision: "disk", dirty: true },
      })),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });

    await expect(
      staleService.delete({ requestId: "stale", target, expectedRevision: "old" }),
    ).resolves.toEqual(expect.objectContaining({ outcome: "conflict", code: "stale-revision" }));
    await expect(
      dirtyService.delete({ requestId: "dirty", target, expectedRevision: "rev-1" }),
    ).resolves.toEqual(expect.objectContaining({ outcome: "conflict", code: "dirty-document" }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("protects project.canvas from deletion", async () => {
    const target = sourceFor(vscode.Uri.file("/repo/.afx/project.canvas"))!;
    const service = createCanvasLibraryService({
      fileState: fileState(),
      coordinator: coordinator(),
      getWorkspaceFolders: () => roots,
    });

    await expect(
      service.delete({ requestId: "delete-project", target, expectedRevision: "rev-1" }),
    ).resolves.toEqual(
      expect.objectContaining({ outcome: "error", code: "write-failed", retryable: false }),
    );
  });

  it.each(["./.afx/project.canvas", ".afx//project.canvas", ".afx\\project.canvas"])(
    "protects the Project Canvas through normalized alias %s",
    async (relativePath) => {
      const target = {
        ...sourceFor(vscode.Uri.file("/repo/.afx/project.canvas"))!,
        relativePath,
      };
      const mutate = coordinator();
      const remove = vi.spyOn(vscode.workspace.fs, "delete");
      const service = createCanvasLibraryService({
        fileState: fileState(),
        coordinator: mutate,
        getWorkspaceFolders: () => roots,
      });

      await expect(
        service.rename({
          requestId: "rename-project-alias",
          target,
          expectedRevision: "rev-1",
          name: "renamed",
        }),
      ).resolves.toEqual(
        expect.objectContaining({ outcome: "error", code: "write-failed", retryable: false }),
      );
      await expect(
        service.delete({
          requestId: "delete-project-alias",
          target,
          expectedRevision: "rev-1",
        }),
      ).resolves.toEqual(
        expect.objectContaining({ outcome: "error", code: "write-failed", retryable: false }),
      );
      expect(mutate.mutateText).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    },
  );
});
