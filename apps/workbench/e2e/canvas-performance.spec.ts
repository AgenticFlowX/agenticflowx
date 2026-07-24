/**
 * Deterministic Canvas performance and responsive stress evidence.
 *
 * These generous browser-smoke budgets detect hangs and major regressions;
 * they complement rather than claim the reference-hardware p95 gate.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-6] [NFR-7] [NFR-10]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-TEST]
 */
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

const ROOT_URI = "file:///workspace";
const PROJECT: CanvasDescriptor = {
  id: "performance-project",
  kind: "project",
  label: "Performance Canvas",
  source: {
    rootUri: ROOT_URI,
    rootName: "workspace",
    relativePath: ".afx/project.canvas",
  },
  exists: true,
};
const DOCUMENT_ID = `${PROJECT.source.rootUri}::${PROJECT.source.relativePath}`;

interface InteractionTiming {
  durationMs: number;
  settled: boolean;
}

interface StressReport {
  scenario: string;
  ci: boolean;
  nodes: number;
  edges: number;
  viewport: { width: number; height: number };
  thresholds: {
    bootMs: number;
    interactionMs: number;
    interactionLongTaskMs?: number;
  };
  timings: {
    bootToCanvasMs: number;
    pan: InteractionTiming;
    zoom: InteractionTiming;
    selection: InteractionTiming;
    fit: InteractionTiming;
    interactionLongTasksMs: number[];
    maxInteractionLongTaskMs: number;
  };
  rendering: {
    mountedNodes: number;
    mountedEdges: number;
    canvasWidth: number;
    toolbarClientHeight: number;
    toolbarScrollHeight: number;
    bodyOverflowPx: number;
    rootOverflowPx: number;
  };
  machine: {
    userAgent: string;
    hardwareConcurrency: number;
    deviceMemoryGiB?: number;
    devicePixelRatio: number;
  };
  diagnostics: {
    pageErrors: string[];
    consoleErrors: string[];
    reactFlowWarnings: string[];
  };
}

test.describe("Canvas deterministic performance stress", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("150 nodes and 200 edges stay responsive on desktop", async ({ page }, testInfo) => {
    const budgets = stressBudgets(testInfo.config.forbidOnly);
    const report = await runStressScenario(page, {
      scenario: "desktop-150-200",
      nodeCount: 150,
      edgeCount: 200,
      viewport: { width: 1440, height: 800 },
      ci: testInfo.config.forbidOnly,
      budget: budgets.standard,
    });
    await attachReport(testInfo, report);
    assertStressReport(report);
  });

  test("1000 nodes and 2000 edges remain navigable without crashing", async ({
    page,
  }, testInfo) => {
    const budgets = stressBudgets(testInfo.config.forbidOnly);
    const report = await runStressScenario(page, {
      scenario: "desktop-1000-2000",
      nodeCount: 1_000,
      edgeCount: 2_000,
      viewport: { width: 1600, height: 900 },
      ci: testInfo.config.forbidOnly,
      budget: budgets.push,
    });
    await attachReport(testInfo, report);
    assertStressReport(report);
  });

  test("150 nodes remain contained and operable at 360px", async ({ page }, testInfo) => {
    const budgets = stressBudgets(testInfo.config.forbidOnly);
    const report = await runStressScenario(page, {
      scenario: "narrow-360-150-200",
      nodeCount: 150,
      edgeCount: 200,
      viewport: { width: 360, height: 800 },
      ci: testInfo.config.forbidOnly,
      budget: budgets.narrow,
    });
    await attachReport(testInfo, report);
    assertStressReport(report);
  });
});

function stressBudgets(ci: boolean) {
  return {
    standard: {
      bootMs: ci ? 15_000 : 8_000,
      interactionMs: ci ? 5_000 : 2_500,
      interactionLongTaskMs: 100,
    },
    push: {
      bootMs: ci ? 30_000 : 18_000,
      interactionMs: ci ? 8_000 : 5_000,
    },
    narrow: {
      bootMs: ci ? 20_000 : 10_000,
      interactionMs: ci ? 8_000 : 4_000,
      interactionLongTaskMs: 100,
    },
  } as const;
}

async function runStressScenario(
  page: Page,
  options: {
    scenario: string;
    nodeCount: number;
    edgeCount: number;
    viewport: { width: number; height: number };
    ci: boolean;
    budget: {
      bootMs: number;
      interactionMs: number;
      interactionLongTaskMs?: number;
    };
  },
): Promise<StressReport> {
  const diagnostics = {
    pageErrors: [] as string[],
    consoleErrors: [] as string[],
    reactFlowWarnings: [] as string[],
  };
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") diagnostics.consoleErrors.push(text);
    if (text.includes("[React Flow]")) diagnostics.reactFlowWarnings.push(text);
  });

  const canvas = makeStressCanvas(options.nodeCount, options.edgeCount);
  await page.setViewportSize(options.viewport);
  await page.goto("/");
  const bootStartedAt = await installStressBridge(page, canvas);
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible({
    timeout: options.budget.bootMs,
  });
  await expect(page.locator(".react-flow__node").first()).toBeVisible({
    timeout: options.budget.bootMs,
  });
  await expect(page.locator(".react-flow__edge").first()).toBeAttached({
    timeout: options.budget.bootMs,
  });
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: options.budget.bootMs,
  });
  await nextPaint(page);
  const bootToCanvasMs = await elapsedSince(page, bootStartedAt);

  await clearLongTasks(page);
  const canvasSurface = page.getByTestId("react-flow-canvas");
  const initialPan = await readViewportTransform(page);
  const surfaceBox = await canvasSurface.boundingBox();
  if (!surfaceBox) throw new Error("Canvas stress surface has no browser geometry.");
  const pan = await measureTransition(
    page,
    async () => {
      await page.mouse.move(
        surfaceBox.x + surfaceBox.width / 2,
        surfaceBox.y + surfaceBox.height / 2,
      );
      await page.mouse.wheel(0, 280);
    },
    async () => {
      const next = await readViewportTransform(page);
      return Math.abs(next.x - initialPan.x) > 0.5 || Math.abs(next.y - initialPan.y) > 0.5;
    },
    options.budget.interactionMs,
  );

  const initialZoom = await readViewportTransform(page);
  const zoom = await measureTransition(
    page,
    () => page.getByRole("button", { name: /Zoom In/i }).click(),
    async () => (await readViewportTransform(page)).zoom > initialZoom.zoom + 0.001,
    options.budget.interactionMs,
  );

  const firstNode = await visibleCanvasNode(page);
  const selection = await measureTransition(
    page,
    () => firstNode.click({ force: true }),
    async () => (await page.locator(".react-flow__node.selected").count()) > 0,
    options.budget.interactionMs,
  );

  const initialFit = await readViewportTransform(page);
  const fit = await measureTransition(
    page,
    () => page.getByRole("button", { name: "Fit selection or canvas" }).click(),
    async () => differentTransform(await readViewportTransform(page), initialFit),
    options.budget.interactionMs,
  );
  await nextPaint(page);

  const interactionLongTasksMs = await readLongTasks(page);
  const rendering = await page.evaluate(() => {
    const canvasElement = document.querySelector('[data-testid="react-flow-canvas"]');
    const toolbar = document.querySelector('[data-testid="canvas-toolbar"]');
    return {
      mountedNodes: document.querySelectorAll(".react-flow__node").length,
      mountedEdges: document.querySelectorAll(".react-flow__edge").length,
      canvasWidth: canvasElement?.getBoundingClientRect().width ?? 0,
      toolbarClientHeight: toolbar?.clientHeight ?? 0,
      toolbarScrollHeight: toolbar?.scrollHeight ?? 0,
      bodyOverflowPx: document.body.scrollWidth - window.innerWidth,
      rootOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  const machine = await page.evaluate(() => {
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    return {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      ...(navigatorWithMemory.deviceMemory === undefined
        ? {}
        : { deviceMemoryGiB: navigatorWithMemory.deviceMemory }),
      devicePixelRatio: window.devicePixelRatio,
    };
  });

  return {
    scenario: options.scenario,
    ci: options.ci,
    nodes: options.nodeCount,
    edges: options.edgeCount,
    viewport: options.viewport,
    thresholds: options.budget,
    timings: {
      bootToCanvasMs: round(bootToCanvasMs),
      pan,
      zoom,
      selection,
      fit,
      interactionLongTasksMs: interactionLongTasksMs.map(round),
      maxInteractionLongTaskMs: round(Math.max(0, ...interactionLongTasksMs)),
    },
    rendering,
    machine,
    diagnostics,
  };
}

async function installStressBridge(page: Page, canvas: JSONCanvas): Promise<number> {
  const document = snapshot(canvas);
  return page.evaluate(
    ({ descriptor, document }) => {
      const state = window as typeof window & {
        __afxCanvasStressLongTasks?: number[];
        __afxCanvasStressObserver?: PerformanceObserver;
      };
      state.__afxCanvasStressLongTasks = [];
      if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        state.__afxCanvasStressObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.__afxCanvasStressLongTasks?.push(entry.duration);
          }
        });
        state.__afxCanvasStressObserver.observe({ entryTypes: ["longtask"] });
      }

      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
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
        }
      });

      const startedAt = performance.now();
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
      return startedAt;
    },
    { descriptor: PROJECT, document },
  );
}

function snapshot(canvas: JSONCanvas): CanvasDocumentSnapshot {
  return {
    documentId: DOCUMENT_ID,
    descriptor: PROJECT,
    source: PROJECT.source,
    revision: { contentRevision: "stress:1", diskRevision: "stress:1", dirty: false },
    content: JSON.stringify(canvas),
  };
}

function makeStressCanvas(nodeCount: number, edgeCount: number): JSONCanvas {
  const columns = Math.ceil(Math.sqrt(nodeCount));
  const routes = ["bezier", "straight", "step", "smoothstep"] as const;
  const strokes = ["solid", "dashed", "dotted"] as const;
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `stress-node-${String(index + 1).padStart(4, "0")}`,
    type: "text" as const,
    text: `## Component ${index + 1}\n\nDeterministic stress fixture content.`,
    x: (index % columns) * 260,
    y: Math.floor(index / columns) * 180,
    width: 220,
    height: 140,
    color: String((index % 6) + 1),
  }));
  const edges = Array.from({ length: edgeCount }, (_, index) => {
    const fromIndex = index % nodeCount;
    const layer = Math.floor(index / nodeCount);
    const toIndex = (fromIndex + 1 + (layer % (nodeCount - 1))) % nodeCount;
    return {
      id: `stress-edge-${String(index + 1).padStart(4, "0")}`,
      fromNode: nodes[fromIndex]!.id,
      fromSide: "right" as const,
      toNode: nodes[toIndex]!.id,
      toSide: "left" as const,
      toEnd: "arrow" as const,
      ...(index % 20 === 0 ? { label: `dependency ${index + 1}` } : {}),
      afxStyle: {
        version: 1 as const,
        route: routes[index % routes.length]!,
        stroke: strokes[index % strokes.length]!,
      },
    };
  });
  return { nodes, edges };
}

async function visibleCanvasNode(page: Page) {
  const nodeId = await page.evaluate(() => {
    const surface = document.querySelector('[data-testid="react-flow-canvas"]');
    if (!surface) return undefined;
    const surfaceBox = surface.getBoundingClientRect();
    const candidates = [...document.querySelectorAll<HTMLElement>(".react-flow__node")]
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(
        ({ box }) =>
          box.width > 0 &&
          box.height > 0 &&
          box.left >= surfaceBox.left &&
          box.right <= surfaceBox.right &&
          box.top >= surfaceBox.top + 48 &&
          box.bottom <= surfaceBox.bottom,
      )
      .sort((left, right) => {
        const centerX = surfaceBox.left + surfaceBox.width / 2;
        const centerY = surfaceBox.top + surfaceBox.height / 2;
        const leftDistance = Math.hypot(
          left.box.left + left.box.width / 2 - centerX,
          left.box.top + left.box.height / 2 - centerY,
        );
        const rightDistance = Math.hypot(
          right.box.left + right.box.width / 2 - centerX,
          right.box.top + right.box.height / 2 - centerY,
        );
        return leftDistance - rightDistance;
      });
    return candidates[0]?.node.dataset["id"];
  });
  if (!nodeId) throw new Error("No fully visible Canvas node is available for selection.");
  return page.locator(`.react-flow__node[data-id="${nodeId}"]`);
}

async function measureTransition(
  page: Page,
  action: () => Promise<unknown>,
  settled: () => Promise<boolean>,
  timeoutMs: number,
): Promise<InteractionTiming> {
  const startedAt = await browserNow(page);
  await action();
  const didSettle = await waitUntil(page, settled, timeoutMs);
  await nextPaint(page);
  return { durationMs: round(await elapsedSince(page, startedAt)), settled: didSettle };
}

async function waitUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await page.waitForTimeout(16);
  }
  return false;
}

async function readViewportTransform(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  return page.evaluate(() => {
    const viewport = document.querySelector(".react-flow__viewport");
    if (!(viewport instanceof SVGElement || viewport instanceof HTMLElement)) {
      throw new Error("React Flow viewport is not mounted.");
    }
    const matrix = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
    return { x: matrix.m41, y: matrix.m42, zoom: matrix.m11 };
  });
}

function differentTransform(
  left: { x: number; y: number; zoom: number },
  right: { x: number; y: number; zoom: number },
): boolean {
  return (
    Math.abs(left.x - right.x) > 0.5 ||
    Math.abs(left.y - right.y) > 0.5 ||
    Math.abs(left.zoom - right.zoom) > 0.001
  );
}

async function clearLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __afxCanvasStressLongTasks?: number[];
      __afxCanvasStressObserver?: PerformanceObserver;
    };
    // Discard observer records queued during boot before starting the
    // interaction-only measurement window.
    state.__afxCanvasStressObserver?.takeRecords();
    state.__afxCanvasStressLongTasks = [];
  });
}

async function readLongTasks(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __afxCanvasStressLongTasks?: number[];
      __afxCanvasStressObserver?: PerformanceObserver;
    };
    for (const entry of state.__afxCanvasStressObserver?.takeRecords() ?? []) {
      state.__afxCanvasStressLongTasks?.push(entry.duration);
    }
    return state.__afxCanvasStressLongTasks ?? [];
  });
}

async function browserNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

async function elapsedSince(page: Page, startedAt: number): Promise<number> {
  return page.evaluate((start) => performance.now() - start, startedAt);
}

async function nextPaint(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function attachReport(testInfo: TestInfo, report: StressReport): Promise<void> {
  const output = JSON.stringify(report, null, 2);
  await testInfo.attach(`${report.scenario}-timings.json`, {
    body: output,
    contentType: "application/json",
  });
}

function assertStressReport(report: StressReport): void {
  expect(
    report.timings.bootToCanvasMs,
    `${report.scenario} boot-to-canvas budget`,
  ).toBeLessThanOrEqual(report.thresholds.bootMs);
  for (const [name, timing] of Object.entries({
    pan: report.timings.pan,
    zoom: report.timings.zoom,
    selection: report.timings.selection,
    fit: report.timings.fit,
  })) {
    expect(timing.settled, `${report.scenario} ${name} should settle`).toBe(true);
    expect(
      timing.durationMs,
      `${report.scenario} ${name} responsiveness budget`,
    ).toBeLessThanOrEqual(report.thresholds.interactionMs);
  }
  if (report.thresholds.interactionLongTaskMs !== undefined) {
    expect(
      report.timings.maxInteractionLongTaskMs,
      `${report.scenario} interaction long-task ceiling`,
    ).toBeLessThanOrEqual(report.thresholds.interactionLongTaskMs);
  }
  expect(report.rendering.mountedNodes).toBeGreaterThan(0);
  expect(report.rendering.mountedNodes).toBeLessThanOrEqual(report.nodes);
  expect(report.rendering.mountedEdges).toBeGreaterThan(0);
  expect(report.rendering.mountedEdges).toBeLessThanOrEqual(report.edges);
  expect(report.rendering.canvasWidth).toBeLessThanOrEqual(report.viewport.width + 1);
  expect(report.rendering.toolbarScrollHeight).toBeLessThanOrEqual(
    report.rendering.toolbarClientHeight + 1,
  );
  expect(
    Math.max(report.rendering.bodyOverflowPx, report.rendering.rootOverflowPx),
  ).toBeLessThanOrEqual(1);
  expect(report.diagnostics.pageErrors).toEqual([]);
  expect(report.diagnostics.consoleErrors).toEqual([]);
  expect(report.diagnostics.reactFlowWarnings).toEqual([]);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
