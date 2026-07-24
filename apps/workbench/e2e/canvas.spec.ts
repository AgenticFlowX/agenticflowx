/**
 * Shared CanvasApp/React Flow Workbench regression coverage.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-2] [FR-6] [FR-7] [FR-11] [FR-12] [FR-20] [FR-44] [NFR-7]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/workbench/screenshots");
const ROOT_URI = "file:///workspace";
const SPEC_PATH = "docs/specs/demo/spec.md";
const PREVIEW_CONTENT =
  "# Demo specification\n\nLive Markdown preview from the revisioned Canvas host.";

const PROJECT: CanvasDescriptor = {
  id: "project",
  kind: "project",
  label: "Project Canvas",
  source: {
    rootUri: ROOT_URI,
    rootName: "workspace",
    relativePath: ".afx/project.canvas",
  },
  exists: true,
};

const EMPTY_CANVAS: JSONCanvas = { nodes: [], edges: [] };

const EDIT_CANVAS: JSONCanvas = {
  nodes: [
    {
      id: "seed",
      type: "text",
      text: "# Initial delivery plan\n\nEdit this card and persist it through the host.",
      x: 0,
      y: 0,
      width: 300,
      height: 160,
      color: "5",
    },
  ],
  edges: [],
};

const FILE_PREVIEW_CANVAS: JSONCanvas = {
  nodes: [
    {
      id: "demo-spec",
      type: "file",
      file: SPEC_PATH,
      subpath: "#requirements",
      afxSource: { ...PROJECT.source, relativePath: SPEC_PATH },
      x: 0,
      y: 0,
      width: 380,
      height: 260,
      color: "6",
    },
  ],
  edges: [],
};

const RESPONSIVE_CANVAS: JSONCanvas = {
  nodes: [
    {
      id: "responsive-outcome",
      type: "text",
      text: "# Outcome\n\nA useful architecture plan in the sidebar.",
      x: 0,
      y: 0,
      width: 280,
      height: 150,
      color: "4",
    },
    {
      id: "responsive-spec",
      type: "file",
      file: SPEC_PATH,
      afxSource: { ...PROJECT.source, relativePath: SPEC_PATH },
      x: 380,
      y: 0,
      width: 320,
      height: 190,
      color: "6",
    },
    {
      id: "responsive-next",
      type: "text",
      text: "## Next\n\nVerify the narrow workflow.",
      x: 190,
      y: 280,
      width: 280,
      height: 150,
      color: "3",
    },
  ],
  edges: [
    {
      id: "responsive-edge-outcome-spec",
      fromNode: "responsive-outcome",
      fromSide: "right",
      toNode: "responsive-spec",
      toSide: "left",
      toEnd: "arrow",
      label: "defined by",
    },
    {
      id: "responsive-edge-spec-next",
      fromNode: "responsive-spec",
      fromSide: "bottom",
      toNode: "responsive-next",
      toSide: "top",
      toEnd: "arrow",
      label: "guides",
    },
  ],
};

function snapshot(canvas: JSONCanvas, revision = "canvas-r1"): CanvasDocumentSnapshot {
  return {
    documentId: `${PROJECT.source.rootUri}::${PROJECT.source.relativePath}`,
    descriptor: PROJECT,
    source: PROJECT.source,
    revision: { contentRevision: revision, diskRevision: revision, dirty: false },
    content: JSON.stringify(canvas),
  };
}

async function installCanvasHost(
  page: Page,
  canvas: JSONCanvas,
  options: { autoAcknowledgeEdits?: boolean } = {},
): Promise<void> {
  const document = snapshot(canvas);
  await page.evaluate(
    ({ project, document, previewContent, pickedFilePath, autoAcknowledgeEdits }) => {
      const host = window as typeof window & {
        __afxCanvasOutbound?: Array<Record<string, unknown>>;
        __afxCanvasAutoAcknowledge?: boolean;
        __afxReactFlowWarnings?: string[];
      };
      host.__afxCanvasOutbound = [];
      host.__afxCanvasAutoAcknowledge = autoAcknowledgeEdits;
      host.__afxReactFlowWarnings = [];
      let currentDocument = document;
      let revisionSequence = 1;
      const recordedTypes = new Set([
        "afxCanvasList",
        "afxCanvasSelect",
        "afxCanvasEdit",
        "afxCanvasContentPreviewRequest",
        "afxOpenFile",
        "afxPickMarkdownFile",
      ]);
      const originalWarn = console.warn.bind(console);
      console.warn = (...args: unknown[]) => {
        const message = args.map(String).join(" ");
        if (message.includes("[React Flow]")) host.__afxReactFlowWarnings?.push(message);
        originalWarn(...args);
      };

      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        if (recordedTypes.has(message.type)) host.__afxCanvasOutbound?.push(message);

        if (message.type === "afxCanvasList") {
          window.postMessage(
            { type: "afxCanvasLibrary", canvases: [project], selectedId: project.id },
            "*",
          );
          window.postMessage({ type: "afxCanvasDocument", document: currentDocument }, "*");
          return;
        }

        if (message.type === "afxCanvasSelect" && message["canvasId"] === project.id) {
          window.postMessage({ type: "afxCanvasDocument", document: currentDocument }, "*");
          return;
        }

        if (message.type === "afxCanvasEdit") {
          revisionSequence += 1;
          const revision = {
            contentRevision: `canvas-r${revisionSequence}`,
            diskRevision: `canvas-r${revisionSequence}`,
            dirty: false,
          };
          currentDocument = {
            ...currentDocument,
            content: String(message["content"]),
            revision,
          };
          if (!host.__afxCanvasAutoAcknowledge) return;
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasEditResult",
                requestId: String(message["requestId"]),
                sessionId: String(message["sessionId"]),
                sequence: Number(message["sequence"]),
                outcome: "success",
                target: message["target"],
                revision,
              },
              "*",
            );
          }, 250);
          return;
        }

        if (message.type === "afxCanvasContentPreviewRequest") {
          const owner = message["owner"] as CanvasDocumentSnapshot["source"];
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasContentPreviewResult",
                requestId: String(message["requestId"]),
                owner,
                revision: {
                  contentRevision: "preview-r1",
                  diskRevision: "preview-r1",
                  dirty: false,
                },
                preview: {
                  kind: "markdown",
                  state: "ready",
                  content: previewContent,
                  mediaType: "text/markdown",
                  byteLength: previewContent.length,
                },
              },
              "*",
            );
          }, 25);
          return;
        }

        if (message.type === "afxPickMarkdownFile") {
          window.postMessage({ type: "afxMarkdownFilePicked", filePath: pickedFilePath }, "*");
        }
      });

      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: {
            path: project.source.relativePath,
            content: document.content,
            exists: true,
            source: project.source,
            revision: document.revision,
            documentId: document.documentId,
          },
        },
        "*",
      );
    },
    {
      project: PROJECT,
      document,
      previewContent: PREVIEW_CONTENT,
      pickedFilePath: SPEC_PATH,
      autoAcknowledgeEdits: options.autoAcknowledgeEdits ?? true,
    },
  );
}

async function openCanvas(page: Page): Promise<void> {
  const tab = page.getByRole("tab", { name: "Canvas" });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toHaveValue(PROJECT.id);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

async function bootCanvas(
  page: Page,
  canvas: JSONCanvas,
  viewport: { width: number; height: number },
  options: { autoAcknowledgeEdits?: boolean } = {},
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await installCanvasHost(page, canvas, options);
  await openCanvas(page);
}

async function outbound(page: Page, type: string): Promise<Array<Record<string, unknown>>> {
  return page.evaluate((messageType) => {
    const host = window as typeof window & {
      __afxCanvasOutbound?: Array<Record<string, unknown>>;
    };
    return (host.__afxCanvasOutbound ?? []).filter((message) => message["type"] === messageType);
  }, type);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    root: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);
}

async function expectNoReactFlowWarnings(page: Page): Promise<void> {
  const warnings = await page.evaluate(() => {
    const host = window as typeof window & { __afxReactFlowWarnings?: string[] };
    return host.__afxReactFlowWarnings ?? [];
  });
  expect(warnings).toEqual([]);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshot = await page.screenshot({
    path: resolve(SCREENSHOT_DIR, name),
    fullPage: false,
  });
  await testInfo.attach(name, { body: screenshot, contentType: "image/png" });
  expect(screenshot.length).toBeGreaterThan(10_000);
}

test("Canvas stays gated by default and opens an empty shared React Flow surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 520 });
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Canvas" })).toHaveCount(0);

  await installCanvasHost(page, EMPTY_CANVAS);
  await openCanvas(page);

  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add card" })).toBeVisible();
  await expect(page.getByText("Canvas experiment disabled.")).toHaveCount(0);
  await expectNoReactFlowWarnings(page);
});

test("Canvas edits Markdown and remains dirty until its revisioned save succeeds", async ({
  page,
}) => {
  await bootCanvas(page, EDIT_CANVAS, { width: 960, height: 560 });

  const node = page.getByTestId("react-flow-canvas-node-seed");
  await expect(node).toBeVisible();
  await node.dblclick();
  const editor = node.getByRole("textbox", { name: "Canvas node markdown" });
  await editor.fill("# Edited delivery plan\n\nPersisted through the revision-aware host.");
  await editor.press("Control+Enter");

  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
  await expect.poll(async () => (await outbound(page, "afxCanvasEdit")).length).toBe(1);
  const [edit] = await outbound(page, "afxCanvasEdit");
  expect(edit).toMatchObject({
    type: "afxCanvasEdit",
    sequence: 1,
    documentId: `${PROJECT.source.rootUri}::${PROJECT.source.relativePath}`,
    target: PROJECT.source,
    baseRevision: "canvas-r1",
  });
  expect(String(edit?.["content"])).toContain("Edited delivery plan");

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Edited delivery plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save canvas" })).toBeDisabled();
  await expectNoReactFlowWarnings(page);
});

test("Canvas renders a revisioned Markdown preview and opens the exact AFX preview target", async ({
  page,
}) => {
  await bootCanvas(page, FILE_PREVIEW_CANVAS, { width: 980, height: 600 });

  const fileNode = page.getByTestId("react-flow-canvas-node-demo-spec");
  await expect(fileNode).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo specification" })).toBeVisible();
  await expect(
    page.getByText("Live Markdown preview from the revisioned Canvas host."),
  ).toBeVisible();

  await expect
    .poll(async () => (await outbound(page, "afxCanvasContentPreviewRequest")).length)
    .toBeGreaterThan(0);
  const requests = await outbound(page, "afxCanvasContentPreviewRequest");
  expect(requests.at(-1)).toMatchObject({
    type: "afxCanvasContentPreviewRequest",
    owner: { ...PROJECT.source, relativePath: SPEC_PATH },
  });

  await fileNode.click();
  await page.getByRole("button", { name: "Rendered preview" }).click();
  await expect.poll(async () => (await outbound(page, "afxOpenFile")).length).toBe(1);
  const [previewOpen] = await outbound(page, "afxOpenFile");
  expect(previewOpen).toEqual({
    type: "afxOpenFile",
    path: SPEC_PATH,
    mode: "afxPreview",
    owner: { ...PROJECT.source, relativePath: SPEC_PATH },
    subpath: "#requirements",
  });
  await expectNoReactFlowWarnings(page);
});

test("Canvas stays usable without page overflow at 360px", async ({ page }, testInfo) => {
  await bootCanvas(page, RESPONSIVE_CANVAS, { width: 360, height: 800 });

  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  const toolbar = page.getByTestId("canvas-toolbar");
  const geometry = await toolbar.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth);

  await page.getByRole("button", { name: "Fit selection or canvas" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const surface = document.querySelector('[data-testid="react-flow-canvas"]');
        const nodes = [...document.querySelectorAll(".react-flow__node")];
        if (!surface || nodes.length === 0) return false;
        const bounds = surface.getBoundingClientRect();
        return nodes.every((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.left >= bounds.left - 1 &&
            rect.right <= bounds.right + 1 &&
            rect.top >= bounds.top - 1 &&
            rect.bottom <= bounds.bottom + 1
          );
        });
      }),
    )
    .toBe(true);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-responsive-360.png");
  await expectNoReactFlowWarnings(page);
});

test("Canvas blocks an external replacement until the user resolves the conflict", async ({
  page,
}, testInfo) => {
  await bootCanvas(page, EDIT_CANVAS, { width: 540, height: 680 }, { autoAcknowledgeEdits: false });

  const node = page.getByTestId("react-flow-canvas-node-seed");
  await node.dblclick();
  const editor = node.getByRole("textbox", { name: "Canvas node markdown" });
  await editor.fill("# Local unsaved edit\n\nKeep this visible until conflict review.");
  await editor.press("Control+Enter");
  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
  await expect.poll(async () => (await outbound(page, "afxCanvasEdit")).length).toBe(1);

  const externalCanvas: JSONCanvas = {
    nodes: [
      {
        id: "external",
        type: "text",
        text: "# External replacement\n\nManually edited on disk.",
        x: 0,
        y: 0,
        width: 300,
        height: 160,
        color: "3",
      },
    ],
    edges: [],
  };
  await page.evaluate(
    (document) => {
      window.postMessage({ type: "afxCanvasDocument", document }, "*");
    },
    snapshot(externalCanvas, "external-r2"),
  );

  await expect(page.getByRole("alert")).toContainText(
    "The file changed while this canvas had unsaved work",
  );
  await expect(page.getByText("Conflict", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local unsaved edit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "External replacement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save canvas" })).toBeDisabled();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-conflict.png");

  await page.getByRole("button", { name: "Reload external" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "External replacement" })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expectNoReactFlowWarnings(page);
});
