/**
 * E2E for Spec Authoring: widened all-kind discovery, live file→canvas
 * re-sync, and delete-to-remove write-back.
 *
 * @see docs/specs/230-app-workbench-spec-authoring/spec.md [FR-1] [FR-6] [FR-14]
 * @see docs/specs/230-app-workbench-spec-authoring/design.md [DES-LIVE] [DES-TEST]
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

const ROOT_URI = "file:///workspace";

const PROJECT: CanvasDescriptor = {
  id: "project",
  kind: "project",
  label: "Project Canvas",
  source: { rootUri: ROOT_URI, rootName: "workspace", relativePath: ".afx/project.canvas" },
  exists: true,
};

function docNode(id: string, file: string, kind: string, x: number) {
  return {
    id,
    type: "file" as const,
    file,
    x,
    y: 0,
    width: 300,
    height: 190,
    afxSource: { rootUri: ROOT_URI, rootName: "workspace", relativePath: file },
    afxDoc: { version: 1, kind, id: id.replace(/^spec-/, "") },
    afxGenerated: { version: 1, kind: "spec-node", key: id },
  };
}

// A reconciled Spec Map: a spec, its ADR, and a dependency edge between specs.
const GRAPH: JSONCanvas = {
  nodes: [
    docNode("spec-220-checkout", "docs/specs/220-checkout/spec.md", "spec", 0),
    docNode("spec-110-cart", "docs/specs/110-cart/spec.md", "spec", 400),
    docNode("adr-0001", "docs/adr/0001-auth.md", "adr", 800),
  ],
  edges: [
    {
      id: "afx-dependency-checkout-cart",
      fromNode: "spec-220-checkout",
      toNode: "spec-110-cart",
      toEnd: "arrow",
      label: "depends on",
      afxProvenance: { version: 1, kind: "declared-dependency", owner: "220-checkout" },
    } as NonNullable<JSONCanvas["edges"]>[number],
  ],
};

function snapshot(canvas: JSONCanvas, revision = "revision-1"): CanvasDocumentSnapshot {
  return {
    documentId: `${PROJECT.source.rootUri}::${PROJECT.source.relativePath}`,
    descriptor: PROJECT,
    source: PROJECT.source,
    revision: { contentRevision: revision, diskRevision: revision, dirty: false },
    content: JSON.stringify(canvas),
  };
}

type OutboundMessage = Record<string, unknown> & { type?: string };

async function bootSpecMap(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1180, height: 640 });
  await page.goto("/");
  await page.evaluate(
    ({ project, doc }) => {
      const state = window as typeof window & {
        __afxCanvasOutbound?: Array<Record<string, unknown>>;
      };
      state.__afxCanvasOutbound = [];
      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        if (
          [
            "afxCanvasList",
            "afxCanvasRefreshDependencies",
            "afxCanvasAuthorRelationship",
            "afxCanvasDocIndex",
            "afxCanvasEdit",
          ].includes(message.type)
        ) {
          state.__afxCanvasOutbound?.push(message);
        }
        if (message.type === "afxCanvasList") {
          window.postMessage(
            { type: "afxCanvasLibrary", canvases: [project], selectedId: project.id },
            "*",
          );
        }
        if (message.type === "afxCanvasDocIndex") {
          window.postMessage(
            {
              type: "afxCanvasDocIndex",
              requestId: String(message.requestId),
              entries: [
                {
                  // Matches the loaded checkout node (afxDoc.id "220-checkout")
                  // and declares a dependency that is NOT on the canvas.
                  id: "220-checkout",
                  title: "Checkout",
                  kind: "spec",
                  source: {
                    rootUri: "file:///workspace",
                    rootName: "workspace",
                    relativePath: "docs/specs/220-checkout/spec.md",
                  },
                  relationships: { depends_on: ["999-payments"] },
                },
                {
                  id: "999-payments",
                  title: "Payments",
                  kind: "spec",
                  source: {
                    rootUri: "file:///workspace",
                    rootName: "workspace",
                    relativePath: "docs/specs/999-payments/spec.md",
                  },
                  relationships: {},
                },
                {
                  id: "120-db",
                  title: "Database Core",
                  kind: "spec",
                  source: {
                    rootUri: "file:///workspace",
                    rootName: "workspace",
                    relativePath: "docs/specs/120-db/spec.md",
                  },
                  relationships: {},
                },
              ],
            },
            "*",
          );
        }
      });
      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: { content: doc.content, source: doc.source, revision: doc.revision },
        },
        "*",
      );
      window.postMessage({ type: "afxCanvasDocument", document: doc }, "*");
    },
    { project: PROJECT, doc: snapshot(GRAPH) },
  );
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  // Spec Map mode surfaces the generated relationships.
  await page.getByRole("button", { name: "Spec Map" }).click();
}

function outbound(page: Page, type: string): Promise<OutboundMessage[]> {
  return page.evaluate(
    (t) =>
      (
        window as typeof window & { __afxCanvasOutbound?: OutboundMessage[] }
      ).__afxCanvasOutbound?.filter((message) => message.type === t) ?? [],
    type,
  );
}

test("discovers and kind-tags all afx document kinds on the map", async ({ page }) => {
  await bootSpecMap(page);
  // Every generated doc node carries a kind chip (spec / adr).
  await expect(page.getByTestId("canvas-doc-kind-spec-220-checkout")).toHaveText("spec");
  await expect(page.getByTestId("canvas-doc-kind-adr-0001")).toHaveText("adr");
  // The declared dependency renders (no empty state).
  await expect(page.getByTestId("canvas-spec-map-empty")).toHaveCount(0);
});

test("Add spec picker seeds the map from the doc index without a file dialog", async ({ page }) => {
  await bootSpecMap(page);

  const before = await page.locator(".react-flow__node").count();
  await page.getByRole("button", { name: "Add spec" }).click();
  // The picker lists workspace specs by title (no OS file picker).
  await page.getByRole("textbox", { name: "Find a spec" }).fill("database");
  await page.getByRole("button", { name: /Database Core/ }).click();

  // The chosen spec drops onto the canvas as a kind-tagged node.
  await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
  await expect
    .poll(async () => (await outbound(page, "afxCanvasDocIndex")).length)
    .toBeGreaterThan(0);
});

test("a dependency badge expands unloaded dependencies onto the map (FR-2)", async ({ page }) => {
  await bootSpecMap(page);

  // The checkout node declares a dependency (999-payments) not on the canvas,
  // so it shows an expand badge with count 1.
  const badge = page.getByTestId("canvas-expand-badge-spec-220-checkout");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("1");

  const before = await page.locator(".react-flow__node").count();
  await badge.click();
  // Single unloaded dep → the picker offers it directly.
  await page.getByRole("button", { name: /Payments/ }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
});

test("live re-syncs when a document changes behind the canvas (FR-14)", async ({ page }) => {
  await bootSpecMap(page);

  // A human or agent edits a spec's frontmatter on disk → the host invalidates
  // the doc → Spec Map reconciles itself without any user action.
  await page.evaluate((owner) => {
    window.postMessage({ type: "afxDocContentInvalidated", owner }, "*");
  }, PROJECT.source);

  await expect
    .poll(async () => (await outbound(page, "afxCanvasRefreshDependencies")).length)
    .toBeGreaterThan(0);
});

test("delete-to-remove offers frontmatter removal for a generated edge (FR-6)", async ({
  page,
}) => {
  await bootSpecMap(page);

  // Select the generated dependency edge and delete it.
  await page.locator(".react-flow__edge").first().click();
  await page.keyboard.press("Delete");

  // The choice dialog offers removal vs detach.
  const dialog = page.getByTestId("canvas-choice-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Remove from frontmatter/ }).click();

  await expect
    .poll(async () => (await outbound(page, "afxCanvasAuthorRelationship")).length)
    .toBe(1);
  const [authored] = await outbound(page, "afxCanvasAuthorRelationship");
  expect(authored?.["remove"]).toBe(true);
  expect(authored?.["relationship"]).toBe("depends_on");
  expect(authored?.["targetId"]).toBe("110-cart");
});
