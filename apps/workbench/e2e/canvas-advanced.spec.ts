/**
 * Advanced Canvas progressive-profile, composition, and accessibility E2E.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38] [FR-39] [FR-40] [FR-41] [FR-42] [FR-43] [FR-44] [NFR-7] [NFR-9] [NFR-12]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-UI] [DES-CANVAS-INTERACTIONS] [DES-TEST]
 */
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { createCanvasScenarioFixture } from "@afx/canvas-engine";
import type { CanvasDescriptor, CanvasDocumentSnapshot, CanvasEdge, JSONCanvas } from "@afx/shared";

const ROOT_URI = "file:///workspace";
const PROJECT: CanvasDescriptor = {
  id: "advanced-project",
  kind: "project",
  label: "Architecture Workshop",
  source: {
    rootUri: ROOT_URI,
    rootName: "workspace",
    relativePath: ".afx/project.canvas",
  },
  exists: true,
};
const DOCUMENT_ID = `${PROJECT.source.rootUri}::${PROJECT.source.relativePath}`;

test("progressive profiles keep one document intact and make hidden commands discoverable", async ({
  page,
}) => {
  const canvas = createCanvasScenarioFixture("rich-architecture");
  await bootCanvas(page, canvas, { width: 1180, height: 720 });

  const profile = page.getByRole("combobox", { name: "Canvas tools profile" });
  // AFX-capable workspaces boot straight into the full toolset.
  await expect(profile).toHaveValue("afx");
  await profile.selectOption("essentials");
  // Search/explore stays reachable in every profile (Ctrl+F must never no-op).
  await expect(page.getByRole("button", { name: "Explore canvas architecture" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reformat canvas" })).toHaveCount(0);

  const commandTrigger = page.getByRole("button", { name: "Search Canvas commands" });
  await commandTrigger.click();
  const commandMenu = page.getByRole("dialog", { name: "Canvas command menu" });
  await commandMenu.getByRole("textbox", { name: "Find a Canvas command" }).fill("reformat");
  await expect(commandMenu.getByRole("button", { name: /Reformat canvas/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(commandTrigger).toBeFocused();

  await clearOutbound(page);
  await profile.selectOption("architecture");
  await expect(page.getByRole("button", { name: "Explore canvas architecture" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reformat canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compose selection" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(canvas.nodes?.length ?? 0);

  await profile.selectOption("afx");
  await expect(profile).toHaveValue("afx");
  await page.waitForTimeout(350);
  expect(await outboundCount(page, "afxCanvasEdit")).toBe(0);
  expect(await bridgeContent(page)).toBe(JSON.stringify(canvas));
});

test("a beginner can choose the blank starter and create a portable first card", async ({
  page,
}) => {
  await bootCanvas(page, { nodes: [], edges: [] }, { width: 900, height: 620 });

  const starters = page.getByRole("region", { name: "Canvas starters" });
  await expect(starters).toBeVisible();
  // The .afx workspace path flips capabilities.afx on, so the profile defaults
  // to the full AFX toolset even on an empty canvas.
  await expect(page.getByRole("combobox", { name: "Canvas tools profile" })).toHaveValue("afx");
  await expect(page.getByRole("heading", { name: "What are you mapping?" })).toBeVisible();
  await starters.getByRole("button", { name: /Blank canvas/ }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);

  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  const edited = await waitForEditedCanvas(page, (candidate) => candidate.nodes?.length === 1);
  expect(edited.nodes?.[0]).toMatchObject({ type: "text" });
  expect(edited).not.toHaveProperty("afxCanvasKind");
});

test("safe SVG export rasterizes to an explicitly encoded bounded PNG", async ({ page }) => {
  await bootCanvas(
    page,
    {
      nodes: [
        { id: "png-card", type: "text", text: "PNG handoff", x: 0, y: 0, width: 240, height: 120 },
      ],
      edges: [],
    },
    { width: 1_000, height: 680 },
  );

  await clearOutbound(page);
  await page.getByRole("button", { name: "Export canvas" }).click();
  await page.getByRole("combobox", { name: "Export format" }).selectOption("png");
  await expect(page.getByText(/PNG pixels can vary across Chromium/)).toBeVisible();
  await page.getByRole("button", { name: "Save PNG…" }).click();

  await expect
    .poll(() => latestOutbound(page, "afxCanvasExport"))
    .toMatchObject({
      type: "afxCanvasExport",
      format: "png",
      encoding: "base64",
      suggestedName: "Architecture-Workshop.png",
    });
  const request = await latestOutbound(page, "afxCanvasExport");
  if (!request) throw new Error("Canvas PNG export did not reach the host bridge.");
  const content = request["content"];
  expect(typeof content).toBe("string");
  const bytes = Buffer.from(String(content), "base64");
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.toString("base64")).toBe(content);
});

test("Architecture profile exposes exploration, composition, and previewable layout", async ({
  page,
}) => {
  const canvas = createCanvasScenarioFixture("rich-architecture");
  await bootCanvas(page, canvas, { width: 1280, height: 760 }, "architecture");

  await expect(page.getByRole("button", { name: "Explore canvas architecture" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compose selection" })).toBeVisible();
  const reformat = page.getByRole("button", { name: "Reformat canvas" });
  await expect(reformat).toBeVisible();

  await clearOutbound(page);
  await reformat.click();
  const layout = page.getByRole("dialog", { name: "Canvas layout" });
  await layout.getByRole("combobox", { name: "Layout strategy" }).selectOption("grid");
  await layout.getByRole("checkbox", { name: "Preserve frame contents" }).uncheck();
  await layout.getByRole("button", { name: "Preview" }).click();
  await expect(layout.getByRole("status")).toContainText("canvas is unchanged until Apply");
  expect(await outboundCount(page, "afxCanvasEdit")).toBe(0);

  await layout.getByRole("button", { name: "Apply" }).click();
  const edited = await waitForEditedCanvas(page, (candidate) => geometryChanged(canvas, candidate));
  expect(edited.nodes).toHaveLength(canvas.nodes?.length ?? 0);
  expect(edited.edges).toHaveLength(canvas.edges?.length ?? 0);
});

test("edge inspector applies semantic style, waypoints, and durable dependency detach", async ({
  page,
}) => {
  const canvas = edgeInspectorFixture();
  await bootCanvas(page, canvas, { width: 1280, height: 760 }, "architecture");

  await page.locator(".react-flow__edge-path").first().click({ force: true });
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  const trigger = page.getByRole("button", { name: "Inspect selected edges" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const inspector = page.getByRole("dialog", { name: "Canvas edge inspector" });

  await inspector.getByRole("combobox", { name: "Relationship" }).selectOption("depends-on");
  await inspector.getByRole("button", { name: "Apply relationship" }).click();
  await inspector.getByRole("combobox", { name: "Edge route" }).selectOption("straight");
  await inspector.getByRole("combobox", { name: "Edge stroke" }).selectOption("dashed");
  await inspector.getByRole("combobox", { name: "Start marker" }).selectOption("arrow");
  await inspector.getByRole("combobox", { name: "End marker" }).selectOption("none");
  await inspector.getByRole("button", { name: "Apply connector" }).click();
  await inspector.getByRole("textbox", { name: "Edge color" }).fill("#0ea5e9");
  await inspector.getByRole("spinbutton", { name: "Edge opacity" }).fill("0.65");
  await inspector.getByRole("button", { name: "Apply appearance" }).click();
  await inspector.getByRole("button", { name: "Add waypoint" }).click();
  await inspector.getByRole("spinbutton", { name: "Waypoint 1 x" }).fill("120");
  await inspector.getByRole("spinbutton", { name: "Waypoint 1 y" }).fill("80");
  await inspector.getByRole("button", { name: "Apply waypoints" }).click();
  await inspector.getByRole("button", { name: "Detach generated dependency" }).click();

  const edited = await waitForEditedCanvas(page, (candidate) => {
    const edge = candidate.edges?.find(
      (item) => item.afxProvenance?.generatedEdgeId === "presentation-edge-request",
    );
    return (
      edge?.afxStyle?.relationship === "depends on" &&
      edge.afxStyle.route === "straight" &&
      edge.afxStyle.stroke === "dashed" &&
      edge.afxStyle.opacity === 0.65 &&
      edge.afxProvenance?.detached === true &&
      edge.id !== "presentation-edge-request"
    );
  });
  expect(edgeById(edited, "presentation-edge-request:manual")).toMatchObject({
    label: "depends on",
    color: "#0ea5e9",
    fromEnd: "arrow",
    toEnd: "none",
    afxStyle: {
      relationship: "depends on",
      route: "straight",
      stroke: "dashed",
      opacity: 0.65,
      waypoints: [{ x: 120, y: 80 }],
    },
    afxProvenance: {
      detached: true,
      generatedEdgeId: "presentation-edge-request",
      suppressionKey: expect.stringContaining("presentation-edge-request"),
    },
  });
});

test("nested frames stay spatially intact through presentation keyboard navigation", async ({
  page,
}) => {
  const canvas = createCanvasScenarioFixture("nested-frame-presentation");
  await bootCanvas(page, canvas, { width: 1360, height: 800 }, "architecture");

  const overview = page.locator('.react-flow__node[data-id="presentation-frame-overview"]');
  const detail = page.locator('.react-flow__node[data-id="presentation-frame-detail"]');
  await expect(overview).toBeVisible();
  await expect(detail).toBeVisible();
  await expectNestedGeometry(overview, detail);
  const initialNodeCount = await page.locator(".react-flow__node").count();

  const presentation = page.getByRole("region", { name: "Canvas presentation controls" });
  await expect(presentation).toBeVisible();
  await presentation.getByRole("button", { name: "Start presentation" }).click();
  await expect(presentation.getByRole("status")).toContainText("Frame 1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(presentation.getByRole("status")).toContainText("Frame 2 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(presentation.getByRole("status")).toContainText("Frame 3 of 3");
  await page.keyboard.press("Escape");
  await expect(presentation.getByRole("button", { name: "Start presentation" })).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(initialNodeCount);
});

test("advanced Canvas keeps popovers and keyboard focus usable at 360px", async ({ page }) => {
  const canvas = edgeInspectorFixture();
  await bootCanvas(page, canvas, { width: 360, height: 800 }, "architecture");

  await expectNoPageOverflow(page);
  const canvasSurface = page.getByTestId("react-flow-canvas");
  await expect
    .poll(() => canvasSurface.evaluate((element) => element.getBoundingClientRect().width))
    .toBeLessThanOrEqual(360);
  const toolbarGeometry = await page.getByTestId("canvas-toolbar").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(toolbarGeometry.scrollHeight).toBeLessThanOrEqual(toolbarGeometry.clientHeight + 1);

  const commandTrigger = page.getByRole("button", { name: "Search Canvas commands" });
  await expect(commandTrigger).toBeVisible();
  await commandTrigger.focus();
  await page.keyboard.press("Enter");
  const commandMenu = page.getByRole("dialog", { name: "Canvas command menu" });
  await expect(commandMenu.getByRole("textbox", { name: "Find a Canvas command" })).toBeFocused();
  await expectInsideViewport(commandMenu, 360);
  await page.keyboard.press("Escape");
  await expect(commandTrigger).toBeFocused();

  await page.locator(".react-flow__edge-path").first().click({ force: true });
  const inspectorTrigger = page.getByRole("button", { name: "Inspect selected edges" });
  await inspectorTrigger.focus();
  await page.keyboard.press("Enter");
  const inspector = page.getByRole("dialog", { name: "Canvas edge inspector" });
  await expectInsideViewport(inspector, 360);
  await page.keyboard.press("Escape");
  await expect(inspectorTrigger).toBeFocused();
  await expectNoPageOverflow(page);
});

async function bootCanvas(
  page: Page,
  canvas: JSONCanvas,
  viewport: { width: number; height: number },
  profile?: "essentials" | "architecture" | "afx",
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/");
  const document = snapshot(canvas);
  await page.evaluate(
    ({ descriptor, document, documentId, initialProfile }) => {
      const state = window as typeof window & {
        __afxAdvancedCanvasOutbound?: Array<Record<string, unknown>>;
        __afxAdvancedCanvasContent?: string;
      };
      state.__afxAdvancedCanvasOutbound = [];
      state.__afxAdvancedCanvasContent = document.content;
      localStorage.clear();
      if (initialProfile) {
        localStorage.setItem(`afx.canvas.profile.v1:${documentId}`, initialProfile);
      }

      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        state.__afxAdvancedCanvasOutbound?.push(message);

        if (message.type === "afxCanvasList") {
          window.postMessage(
            {
              type: "afxCanvasLibrary",
              canvases: [descriptor],
              selectedId: descriptor.id,
            },
            "*",
          );
        } else if (message.type === "afxCanvasSelect") {
          window.postMessage({ type: "afxCanvasDocument", document }, "*");
        } else if (message.type === "afxFetchDocContent") {
          const filePath = String(message.filePath);
          window.postMessage(
            {
              type: "afxDocContent",
              requestId: message.requestId,
              filePath,
              content: `# ${filePath.split("/").at(-1) ?? "Document"}\n\nLive fixture content.`,
              revision: {
                contentRevision: `fixture:${filePath}`,
                diskRevision: `fixture:${filePath}`,
                dirty: false,
              },
            },
            "*",
          );
        } else if (message.type === "afxCanvasEdit") {
          const content = String(message.content);
          state.__afxAdvancedCanvasContent = content;
          const revisionToken = `edited:${String(message.sequence)}`;
          const revision = {
            contentRevision: revisionToken,
            diskRevision: revisionToken,
            dirty: false,
          };
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasEditResult",
                requestId: String(message.requestId),
                sessionId: String(message.sessionId),
                sequence: Number(message.sequence),
                outcome: "success",
                target: message.target,
                revision,
              },
              "*",
            );
          }, 10);
        }
      });

      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: {
            path: descriptor.source.relativePath,
            content: document.content,
            exists: true,
            source: descriptor.source,
            revision: document.revision,
            documentId: document.documentId,
          },
        },
        "*",
      );
    },
    { descriptor: PROJECT, document, documentId: DOCUMENT_ID, initialProfile: profile },
  );

  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toHaveValue(PROJECT.id);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

function snapshot(canvas: JSONCanvas): CanvasDocumentSnapshot {
  return {
    documentId: DOCUMENT_ID,
    descriptor: PROJECT,
    source: PROJECT.source,
    revision: { contentRevision: "advanced:1", diskRevision: "advanced:1", dirty: false },
    content: JSON.stringify(canvas),
  };
}

function edgeInspectorFixture(): JSONCanvas {
  const canvas = createCanvasScenarioFixture("nested-frame-presentation");
  return {
    ...canvas,
    edges: (canvas.edges ?? []).map((edge, index) =>
      index === 0
        ? {
            ...edge,
            afxStyle: { version: 1, route: "bezier", stroke: "solid" },
            afxProvenance: {
              version: 1,
              kind: "declared-dependency",
              owner: "docs/specs/229-app-workbench-canvas/spec.md",
              detached: false,
            },
          }
        : edge,
    ),
  };
}

async function clearOutbound(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __afxAdvancedCanvasOutbound?: Array<Record<string, unknown>>;
    };
    state.__afxAdvancedCanvasOutbound = [];
  });
}

async function outboundCount(page: Page, type: string): Promise<number> {
  return page.evaluate((messageType) => {
    const state = window as typeof window & {
      __afxAdvancedCanvasOutbound?: Array<Record<string, unknown>>;
    };
    return (state.__afxAdvancedCanvasOutbound ?? []).filter(
      (message) => message["type"] === messageType,
    ).length;
  }, type);
}

async function latestOutbound(
  page: Page,
  type: string,
): Promise<Record<string, unknown> | undefined> {
  return page.evaluate((messageType) => {
    const state = window as typeof window & {
      __afxAdvancedCanvasOutbound?: Array<Record<string, unknown>>;
    };
    return (state.__afxAdvancedCanvasOutbound ?? [])
      .filter((message) => message["type"] === messageType)
      .at(-1);
  }, type);
}

async function bridgeContent(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const state = window as typeof window & { __afxAdvancedCanvasContent?: string };
    return state.__afxAdvancedCanvasContent;
  });
}

async function waitForEditedCanvas(
  page: Page,
  predicate: (canvas: JSONCanvas) => boolean,
): Promise<JSONCanvas> {
  await expect
    .poll(async () => {
      const content = await latestEditedContent(page);
      if (!content) return false;
      try {
        return predicate(JSON.parse(content) as JSONCanvas);
      } catch {
        return false;
      }
    })
    .toBe(true);
  const content = await latestEditedContent(page);
  if (!content) throw new Error("Canvas fixture did not observe an afxCanvasEdit payload.");
  return JSON.parse(content) as JSONCanvas;
}

async function latestEditedContent(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __afxAdvancedCanvasOutbound?: Array<Record<string, unknown>>;
    };
    const edits = (state.__afxAdvancedCanvasOutbound ?? []).filter(
      (message) => message["type"] === "afxCanvasEdit",
    );
    const content = edits.at(-1)?.["content"];
    return typeof content === "string" ? content : undefined;
  });
}

function geometryChanged(before: JSONCanvas, after: JSONCanvas): boolean {
  const initial = new Map(
    (before.nodes ?? []).map((node) => [
      node.id,
      `${node.x}:${node.y}:${node.width}:${node.height}`,
    ]),
  );
  return (after.nodes ?? []).some(
    (node) => initial.get(node.id) !== `${node.x}:${node.y}:${node.width}:${node.height}`,
  );
}

function edgeById(canvas: JSONCanvas, id: string): CanvasEdge {
  const edge = canvas.edges?.find((candidate) => candidate.id === id);
  if (!edge) throw new Error(`Missing Canvas edge ${id}.`);
  return edge;
}

async function expectNestedGeometry(parent: Locator, child: Locator): Promise<void> {
  const parentBox = await parent.boundingBox();
  const childBox = await child.boundingBox();
  if (!parentBox || !childBox) throw new Error("Nested presentation frames have no geometry.");
  expect(childBox.x).toBeGreaterThanOrEqual(parentBox.x);
  expect(childBox.y).toBeGreaterThanOrEqual(parentBox.y);
  expect(childBox.x + childBox.width).toBeLessThanOrEqual(parentBox.x + parentBox.width + 1);
  expect(childBox.y + childBox.height).toBeLessThanOrEqual(parentBox.y + parentBox.height + 1);
}

async function expectInsideViewport(locator: Locator, viewportWidth: number): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Canvas popover has no browser geometry.");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(801);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    root: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);
}
