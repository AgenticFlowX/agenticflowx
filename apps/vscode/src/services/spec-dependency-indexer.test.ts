/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-26] [FR-27] [NFR-4]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-SPEC-MAP] [DES-TEST]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { detachGeneratedDependencies, parseJSONCanvas } from "@afx/canvas-engine";
import type { JSONCanvas, WorkbenchSourceIdentity } from "@afx/shared";

import {
  type SpecDependencyRecord,
  createSpecDependencyIndexer,
  projectDependencies,
} from "./spec-dependency-indexer";
import type { WorkbenchFileState } from "./workbench-file-state";

const canvasSource: WorkbenchSourceIdentity = {
  rootUri: "file:///repo",
  rootName: "repo",
  relativePath: ".afx/canvases/roadmap.canvas",
};
const authorSource: WorkbenchSourceIdentity = {
  rootUri: "file:///repo",
  rootName: "repo",
  relativePath: "docs/specs/120-package-db-core/spec.md",
};

function spec(name: string, dependsOn: string[] = []): SpecDependencyRecord {
  return {
    key: `file:///repo:${name}`,
    title: name,
    source: {
      rootUri: "file:///repo",
      rootName: "repo",
      relativePath: `docs/specs/${name}/spec.md`,
    },
    dependsOn,
  };
}

// Expansion model (230): edges only draw between specs already present on the
// canvas as manual file nodes. These helpers place the endpoints.
function fileNode(name: string) {
  return {
    id: `node-${name}`,
    type: "file" as const,
    file: `docs/specs/${name}/spec.md`,
    x: 0,
    y: 0,
    width: 300,
    height: 190,
  };
}

function canvasWith(...names: string[]): JSONCanvas {
  return { nodes: names.map(fileNode), edges: [] };
}

describe("projectDependencies", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("draws declared edges among present spec nodes idempotently, retaining manual records", () => {
    const source: JSONCanvas = {
      customRoot: { retained: true },
      nodes: [
        {
          id: "manual-a",
          type: "file",
          file: "docs/specs/a/spec.md",
          x: 913,
          y: 217,
          width: 333,
          height: 177,
          customNode: "keep",
        },
        {
          id: "manual-b",
          type: "file",
          file: "docs/specs/b/spec.md",
          x: 40,
          y: 40,
          width: 300,
          height: 190,
        },
        {
          id: "manual-note",
          type: "text",
          text: "## Keep me",
          x: 20,
          y: 20,
          width: 200,
          height: 100,
        },
      ],
      edges: [
        {
          id: "manual-edge",
          fromNode: "manual-note",
          toNode: "manual-a",
          label: "manual",
          customEdge: "keep",
        },
      ],
    };

    const first = projectDependencies(source, [spec("a", ["b"]), spec("b")], canvasSource);
    const second = projectDependencies(
      parseJSONCanvas(first.content),
      [spec("a", ["b"]), spec("b")],
      canvasSource,
    );
    const canvas = parseJSONCanvas(second.content);

    expect(second.content).toBe(first.content);
    expect(canvas["customRoot"]).toEqual({ retained: true });
    // No auto-generated nodes: only the three manual nodes remain.
    expect(canvas.nodes).toHaveLength(3);
    expect(canvas.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "manual-a", x: 913, customNode: "keep" }),
        expect.objectContaining({ id: "manual-note", text: "## Keep me" }),
      ]),
    );
    // The declared dependency is drawn between the two present nodes.
    expect(canvas.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "manual-edge", customEdge: "keep" }),
        expect.objectContaining({
          fromNode: "manual-a",
          toNode: "manual-b",
          label: "depends on",
          afxProvenance: expect.objectContaining({ kind: "declared-dependency" }),
        }),
      ]),
    );
  });

  it("does not draw an edge to a dependency that is not loaded on the canvas", () => {
    // Only spec `a` is present; its dependency `b` is discovered but not loaded.
    const result = projectDependencies(
      canvasWith("a"),
      [spec("a", ["b"]), spec("b")],
      canvasSource,
    );
    const canvas = parseJSONCanvas(result.content);
    expect(canvas.nodes).toHaveLength(1); // no node auto-added for b
    expect(canvas.edges ?? []).toHaveLength(0); // b not present → no edge
  });

  it("surfaces unresolved, ambiguous, and cyclic diagnostics without generating nodes", () => {
    const records = [
      spec("a", ["b", "missing"]),
      spec("b", ["a"]),
      { ...spec("duplicate"), key: "file:///repo:duplicate-1" },
      {
        ...spec("duplicate"),
        key: "file:///repo:duplicate-2",
        source: {
          rootUri: "file:///repo",
          rootName: "repo",
          relativePath: "docs/research/duplicate.md",
        },
      },
      spec("owner", ["duplicate"]),
    ];
    const result = projectDependencies(canvasWith("a", "b"), records, canvasSource);
    const canvas = parseJSONCanvas(result.content);

    expect(result.diagnostics.unresolved).toContain("file:///repo:a -> missing");
    expect(result.diagnostics.ambiguous).toContain("file:///repo:owner -> duplicate");
    expect(result.diagnostics.cycles).toHaveLength(1);
    // No generated text nodes for unresolved/ambiguous — diagnostics only.
    expect((canvas.nodes ?? []).some((node) => node.type === "text")).toBe(false);
    // The a↔b cycle is drawn between the two present nodes.
    expect(canvas.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "depends on · cycle", color: "1" }),
      ]),
    );
  });

  it("migrates legacy detached relationships to fresh manual IDs on refresh", () => {
    const first = projectDependencies(
      canvasWith("a", "b"),
      [spec("a", ["b"]), spec("b")],
      canvasSource,
    );
    const canvas = parseJSONCanvas(first.content);
    const edge = canvas.edges?.[0];
    expect(edge).toBeDefined();
    if (!edge) return;
    edge.label = "my relationship";
    edge.afxProvenance = { ...edge.afxProvenance!, detached: true };

    const refreshed = parseJSONCanvas(
      projectDependencies(canvas, [spec("a")], canvasSource).content,
    );
    expect(refreshed.edges).toContainEqual(
      expect.objectContaining({
        id: `${edge.id}:manual`,
        label: "my relationship",
        afxProvenance: expect.objectContaining({
          detached: true,
          generatedEdgeId: edge.id,
          suppressionKey: expect.stringContaining(edge.id),
        }),
      }),
    );
  });

  it("does not regenerate a declared relationship after it is detached", () => {
    const records = [spec("a", ["b"]), spec("b")];
    const first = projectDependencies(canvasWith("a", "b"), records, canvasSource);
    const canvas = parseJSONCanvas(first.content);
    const edge = canvas.edges?.[0];
    expect(edge).toBeDefined();
    if (!edge) return;

    const detached = detachGeneratedDependencies(canvas, [edge.id]);
    detached.edges![0]!.label = "user-owned relationship";

    const refreshed = projectDependencies(detached, records, canvasSource);
    expect(() => parseJSONCanvas(refreshed.content)).not.toThrow();
    const parsed = parseJSONCanvas(refreshed.content);

    expect(parsed.edges).toEqual([
      expect.objectContaining({
        id: `${edge.id}:manual`,
        label: "user-owned relationship",
        afxProvenance: expect.objectContaining({ detached: true, generatedEdgeId: edge.id }),
      }),
    ]);
    expect(projectDependencies(parsed, records, canvasSource).content).toBe(refreshed.content);
  });

  it("discovers all afx doc kinds and AFX Sprints across roots without a result cap", async () => {
    const canonicalUri = vscode.Uri.file("/client-a/docs/specs/100-core/spec.md");
    const sprintUri = vscode.Uri.file("/client-b/docs/specs/900-fleet/12-history/12-history.md");
    const tasksUri = vscode.Uri.file("/client-b/docs/specs/900-fleet/12-history/tasks.md");
    const findFiles = vi
      .spyOn(vscode.workspace, "findFiles")
      .mockImplementation(async (include) =>
        typeof include === "string" && include === "docs/**/*.md"
          ? [canonicalUri, sprintUri, tasksUri]
          : [],
      );
    const content = new Map([
      [
        canonicalUri.path,
        "---\nafx: true\ntype: SPEC\nstatus: Approved\ndepends_on: [12-history]\n---\n# Core\n",
      ],
      [sprintUri.path, "---\nafx: true\ntype: SPRINT\nstatus: Living\n---\n# Persistent History\n"],
      [tasksUri.path, "---\nafx: true\ntype: TASKS\n---\n# Tasks\n"],
    ]);
    const identify = (uri: vscode.Uri): WorkbenchSourceIdentity | undefined => {
      const root = uri.path.startsWith("/client-a/")
        ? { path: "/client-a/", uri: "file:///client-a", name: "client-a" }
        : uri.path.startsWith("/client-b/")
          ? { path: "/client-b/", uri: "file:///client-b", name: "client-b" }
          : undefined;
      return root
        ? {
            rootUri: root.uri,
            rootName: root.name,
            relativePath: uri.path.slice(root.path.length),
          }
        : undefined;
    };
    const fileState = {
      classify: () => "docs" as const,
      identify,
      resolve: () => undefined,
      async readText(uri: vscode.Uri) {
        const source = identify(uri);
        const raw = content.get(uri.path);
        if (!source || raw === undefined) return null;
        return {
          uri,
          content: raw,
          revision: uri.path,
          dirty: false,
          kind: "docs" as const,
          source,
          sourceRevision: { contentRevision: uri.path, dirty: false },
        };
      },
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    } satisfies WorkbenchFileState;

    // Discovery reads bytes directly (no open buffers, no readText hashing).
    vi.spyOn(vscode.workspace, "textDocuments", "get").mockReturnValue([]);
    vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
      const raw = content.get(uri.path);
      if (raw === undefined) throw new Error("missing");
      return Buffer.from(raw, "utf8");
    });

    // Both the core spec and the cross-root sprint are already on the canvas as
    // manual file nodes; the discovered `depends_on: [12-history]` draws between
    // them. The tasks file is discovered (for resolution) but not loaded.
    const presentCanvas = JSON.stringify({
      nodes: [
        {
          id: "n-core",
          type: "file",
          file: "docs/specs/100-core/spec.md",
          x: 0,
          y: 0,
          width: 300,
          height: 190,
        },
        {
          id: "n-sprint",
          type: "file",
          file: "client-b/docs/specs/900-fleet/12-history/12-history.md",
          x: 400,
          y: 0,
          width: 300,
          height: 190,
        },
      ],
      edges: [],
    });
    const refreshed = await createSpecDependencyIndexer({ fileState }).refresh(presentCanvas, {
      rootUri: "file:///client-a",
      rootName: "client-a",
      relativePath: ".afx/canvases/architecture.canvas",
    });
    const canvas = parseJSONCanvas(refreshed.content);

    expect(findFiles).toHaveBeenCalledOnce();
    expect(findFiles.mock.calls[0]).toHaveLength(3); // glob, exclude, maxResults cap
    // No auto-generated nodes — only the two manual nodes are present, and the
    // discovered tasks file is NOT added (not loaded).
    expect(canvas.nodes).toHaveLength(2);
    expect(
      (canvas.nodes ?? []).some((node) => node.type === "file" && node.file.includes("tasks.md")),
    ).toBe(false);
    // The declared dependency resolves the sprint (not the sibling tasks file)
    // and draws one edge between the two present nodes.
    expect(canvas.edges).toEqual([
      expect.objectContaining({
        fromNode: "n-core",
        toNode: "n-sprint",
        label: "depends on",
        afxProvenance: expect.objectContaining({ kind: "declared-dependency" }),
      }),
    ]);
  });

  it("rejects reconciliation when discovery exceeds its budget instead of deleting edges", async () => {
    vi.useFakeTimers();
    vi.spyOn(vscode.workspace, "findFiles").mockImplementation(
      async () => await new Promise<never>(() => {}),
    );
    const fileState = {
      classify: () => "docs" as const,
      identify: () => undefined,
      resolve: () => undefined,
      readText: async () => null,
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    } satisfies WorkbenchFileState;
    const refresh = createSpecDependencyIndexer({ fileState }).refresh(
      JSON.stringify({
        nodes: [fileNode("a"), fileNode("b")],
        edges: [
          {
            id: "generated",
            fromNode: "node-a",
            toNode: "node-b",
            afxProvenance: {
              version: 1,
              kind: "declared-dependency",
              owner: "file:///repo:a",
              detached: false,
            },
          },
        ],
      }),
      canvasSource,
    );

    const rejection = expect(refresh).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
  });
});

describe("index (Add-spec / authoring token)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("carries the bare frontmatter token separate from the root-qualified id", async () => {
    const specUri = vscode.Uri.file("/repo/docs/specs/120-package-db-core/spec.md");
    const adrUri = vscode.Uri.file("/repo/docs/adr/ADR-0003-structured-logger.md");
    const designAUri = vscode.Uri.file("/repo/docs/specs/120-package-db-core/design.md");
    const designBUri = vscode.Uri.file("/repo/docs/specs/130-package-ui/design.md");
    vi.spyOn(vscode.workspace, "findFiles").mockImplementation(async (include) =>
      typeof include === "string" && include === "docs/**/*.md"
        ? [specUri, adrUri, designAUri, designBUri]
        : [],
    );
    const content = new Map([
      [specUri.path, "---\nafx: true\ntype: SPEC\n---\n# DB Core\n"],
      [adrUri.path, "---\nafx: true\ntype: ADR\n---\n# Structured Logger\n"],
      [designAUri.path, "---\nafx: true\ntype: DESIGN\n---\n# DB Core Design\n"],
      [designBUri.path, "---\nafx: true\ntype: DESIGN\n---\n# UI Design\n"],
    ]);
    const identify = (uri: vscode.Uri): WorkbenchSourceIdentity | undefined =>
      uri.path.startsWith("/repo/")
        ? {
            rootUri: "file:///repo",
            rootName: "repo",
            relativePath: uri.path.slice("/repo/".length),
          }
        : undefined;
    const fileState = {
      classify: () => "docs" as const,
      identify,
      resolve: () => undefined,
      readText: async () => null,
      onDidChange: () => ({ dispose() {} }),
      dispose() {},
    } satisfies WorkbenchFileState;
    vi.spyOn(vscode.workspace, "textDocuments", "get").mockReturnValue([]);
    vi.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
      const raw = content.get(uri.path);
      if (raw === undefined) throw new Error("missing");
      return Buffer.from(raw, "utf8");
    });

    const indexer = createSpecDependencyIndexer({ fileState });
    const entries = await indexer.index();
    const spec = entries.find((entry) => entry.kind === "spec");
    const adr = entries.find((entry) => entry.kind === "adr");
    const designs = entries.filter((entry) => entry.kind === "design");

    // The id stays root-qualified (canvas identity); the token is the bare value
    // authoring writes into YAML — never the `file://…:` form.
    expect(spec?.id).toBe("file:///repo:120-package-db-core");
    expect(spec?.token).toBe("120-package-db-core");
    expect(spec?.token).not.toContain("file://");
    // Non-spec kinds use unique portable paths, not globally-colliding stems.
    expect(adr?.token).toBe("docs/adr/ADR-0003-structured-logger");
    expect(designs.map((entry) => entry.token)).toEqual([
      "docs/specs/120-package-db-core/design",
      "docs/specs/130-package-ui/design",
    ]);
    expect(new Set(designs.map((entry) => entry.token)).size).toBe(2);

    await expect(indexer.resolveAuthorToken(adr!.id, authorSource)).resolves.toBe(
      "docs/adr/ADR-0003-structured-logger",
    );
    await expect(
      indexer.resolveAuthorToken("/Users/alice/private/spec.md", authorSource),
    ).resolves.toBeUndefined();
  });
});
