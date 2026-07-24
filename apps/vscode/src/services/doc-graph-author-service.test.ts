/**
 * @see docs/specs/230-app-workbench-spec-authoring/spec.md [FR-4] [FR-6] [FR-9]
 * @see docs/specs/230-app-workbench-spec-authoring/design.md [DES-API] [DES-SEC]
 */
import { describe, expect, it, vi } from "vitest";

import type { WorkbenchMutationResult, WorkbenchSourceIdentity } from "@afx/shared";

import { createDocGraphAuthorService } from "./doc-graph-author-service";
import type { SpecDependencyIndexer } from "./spec-dependency-indexer";
import type {
  WorkbenchMutationCoordinator,
  WorkbenchTextMutation,
} from "./workbench-mutation-coordinator";

const SOURCE: WorkbenchSourceIdentity = {
  rootUri: "file:///repo",
  rootName: "repo",
  relativePath: "docs/specs/220-checkout/spec.md",
};
const CANVAS: WorkbenchSourceIdentity = {
  rootUri: "file:///repo",
  rootName: "repo",
  relativePath: ".afx/project.canvas",
};

function ok(request: WorkbenchTextMutation): WorkbenchMutationResult {
  return {
    type: "afxMutationResult",
    requestId: request.requestId,
    outcome: "success",
    target: request.target,
    revision: { contentRevision: "next", diskRevision: "next", dirty: false },
  };
}

function coordinator(
  impl: (request: WorkbenchTextMutation) => Promise<WorkbenchMutationResult>,
): WorkbenchMutationCoordinator {
  return { mutateText: vi.fn(impl), dispose() {} };
}

const indexer: SpecDependencyIndexer = {
  refresh: vi.fn(async (content: string) => ({
    content,
    diagnostics: { unresolved: [], ambiguous: [], cycles: [] },
  })),
  index: vi.fn(async () => []),
  resolveAuthorToken: vi.fn(async () => "110-cart"),
};

function request(remove = false) {
  return {
    requestId: "author-1",
    source: SOURCE,
    targetId: "110-cart",
    relationship: "depends_on" as const,
    remove,
    canvasTarget: CANVAS,
  };
}

describe("createDocGraphAuthorService", () => {
  it("edits the source frontmatter then reconciles the canvas", async () => {
    const targets: WorkbenchTextMutation[] = [];
    const service = createDocGraphAuthorService({
      coordinator: coordinator(async (mutation) => {
        targets.push(mutation);
        return ok(mutation);
      }),
      indexer,
      isWorkspaceTrusted: () => true,
    });

    const result = await service.author(request());

    expect(result.outcome).toBe("success");
    // First mutation edits the spec doc, second reconciles the canvas.
    expect(targets[0]?.target).toBe(SOURCE);
    expect(targets[0]?.allowDirty).toBe(false);
    expect(targets[1]?.target).toBe(CANVAS);
    expect(targets[1]?.allowDirty).toBe(true);
    const edited = await targets[0]?.transform(
      "---\nafx: true\ndepends_on: [130-payments]\n---\nbody",
    );
    expect(edited).toContain('depends_on: [130-payments, "110-cart"]');
  });

  it("refuses to write in an untrusted workspace", async () => {
    const mutate = coordinator(async (mutation) => ok(mutation));
    const service = createDocGraphAuthorService({
      coordinator: mutate,
      indexer,
      isWorkspaceTrusted: () => false,
    });

    const result = await service.author(request());

    expect(result).toMatchObject({ outcome: "error", code: "untrusted-workspace" });
    expect(mutate.mutateText).not.toHaveBeenCalled();
  });

  it("does not reconcile when the frontmatter edit fails (dirty/conflict)", async () => {
    let calls = 0;
    const service = createDocGraphAuthorService({
      coordinator: coordinator(async (mutation) => {
        calls += 1;
        return {
          type: "afxMutationResult",
          requestId: mutation.requestId,
          outcome: "conflict",
          target: mutation.target,
          code: "dirty-document",
          message: "unsaved changes",
          retryable: true,
        };
      }),
      indexer,
      isWorkspaceTrusted: () => true,
    });

    const result = await service.author(request());

    expect(result).toMatchObject({ outcome: "conflict", code: "dirty-document" });
    expect(calls).toBe(1); // only the source edit was attempted
  });

  it("removes the entry on delete-to-remove", async () => {
    const targets: WorkbenchTextMutation[] = [];
    const service = createDocGraphAuthorService({
      coordinator: coordinator(async (mutation) => {
        targets.push(mutation);
        return ok(mutation);
      }),
      indexer,
      isWorkspaceTrusted: () => true,
    });

    await service.author(request(true));
    const edited = await targets[0]?.transform(
      "---\nafx: true\ndepends_on: [110-cart, 130-payments]\n---\nbody",
    );
    expect(edited).toContain("depends_on: [130-payments]");
    expect(edited).not.toContain("110-cart");
  });

  it("surfaces a canvas reconciliation conflict after the source edit succeeds", async () => {
    let calls = 0;
    const service = createDocGraphAuthorService({
      coordinator: coordinator(async (mutation) => {
        calls += 1;
        if (calls === 1) return ok(mutation);
        return {
          type: "afxMutationResult",
          requestId: mutation.requestId,
          outcome: "conflict",
          target: mutation.target,
          code: "stale-revision",
          message: "canvas changed",
          retryable: true,
        };
      }),
      indexer,
      isWorkspaceTrusted: () => true,
    });

    await expect(service.author(request())).resolves.toMatchObject({
      outcome: "conflict",
      code: "stale-revision",
      target: CANVAS,
    });
  });

  it("rejects an unknown or path-like target before opening a YAML write", async () => {
    const mutate = coordinator(async (mutation) => ok(mutation));
    const service = createDocGraphAuthorService({
      coordinator: mutate,
      indexer: { ...indexer, resolveAuthorToken: vi.fn(async () => undefined) },
      isWorkspaceTrusted: () => true,
    });

    await expect(
      service.author({ ...request(), targetId: "/Users/alice/private/spec.md" }),
    ).resolves.toMatchObject({ outcome: "error", code: "parse-error" });
    expect(mutate.mutateText).not.toHaveBeenCalled();
  });
});
