/**
 * Regression replications for two reported Canvas interaction defects:
 * modifier-wheel zoom rubber-banding and body-drag being blocked.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-45] [NFR-6] [NFR-7]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-CANVAS-PRO]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/workbench/screenshots");
const ROOT_URI = "file:///workspace";

const PROJECT: CanvasDescriptor = {
  id: "project",
  kind: "project",
  label: "Project Canvas",
  source: { rootUri: ROOT_URI, rootName: "workspace", relativePath: ".afx/project.canvas" },
  exists: true,
};

const PROJECT_CANVAS: JSONCanvas = {
  nodes: [
    {
      id: "idea",
      type: "text",
      text: "# Zoom target\n\nScroll bursts must stay smooth.",
      x: 0,
      y: 0,
      width: 280,
      height: 150,
      color: "5",
    },
    {
      id: "risk",
      type: "text",
      text: "## Drag me\n\nGrab anywhere on this card, not just the header.",
      x: 360,
      y: 0,
      width: 280,
      height: 150,
      color: "3",
    },
  ],
  edges: [{ id: "idea-to-risk", fromNode: "idea", toNode: "risk", label: "relates" }],
};

function snapshot(descriptor: CanvasDescriptor, canvas: JSONCanvas): CanvasDocumentSnapshot {
  return {
    documentId: `${descriptor.source.rootUri}::${descriptor.source.relativePath}`,
    descriptor,
    source: descriptor.source,
    revision: { contentRevision: "revision-1", diskRevision: "revision-1", dirty: false },
    content: JSON.stringify(canvas),
  };
}

async function bootCanvas(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1180, height: 620 });
  await page.goto("/");
  await page.evaluate(
    ({ project, projectDocument }) => {
      const state = window as typeof window & {
        __afxCanvasOutbound?: Array<Record<string, unknown>>;
      };
      state.__afxCanvasOutbound = [];
      let revisionSequence = 1;
      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        if (
          [
            "afxCanvasEdit",
            "afxCanvasList",
            "afxCanvasSelect",
            "afxCanvasCreate",
            "afxCanvasPickReferences",
          ].includes(message.type)
        ) {
          state.__afxCanvasOutbound?.push(message);
        }
        if (message.type === "afxCanvasPickReferences") {
          window.postMessage(
            {
              type: "afxCanvasReferencesPicked",
              requestId: String(message.requestId),
              outcome: "success",
              references: [
                {
                  filePath: "docs/specs/demo/spec.md",
                  source: {
                    rootUri: "file:///workspace",
                    rootName: "workspace",
                    relativePath: "docs/specs/demo/spec.md",
                  },
                },
              ],
            },
            "*",
          );
        }
        if (message.type === "afxCanvasList") {
          window.postMessage(
            { type: "afxCanvasLibrary", canvases: [project], selectedId: project.id },
            "*",
          );
        }
        if (message.type === "afxCanvasEdit") {
          revisionSequence += 1;
          const nextRevision = `revision-${revisionSequence}`;
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasEditResult",
                requestId: String(message.requestId),
                sessionId: String(message.sessionId),
                sequence: Number(message.sequence),
                outcome: "success",
                target: message.target,
                revision: {
                  contentRevision: nextRevision,
                  diskRevision: nextRevision,
                  dirty: false,
                },
              },
              "*",
            );
          }, 25);
        }
      });
      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: {
            content: projectDocument.content,
            source: projectDocument.source,
            revision: projectDocument.revision,
          },
        },
        "*",
      );
      window.postMessage({ type: "afxCanvasDocument", document: projectDocument }, "*");
    },
    { project: PROJECT, projectDocument: snapshot(PROJECT, PROJECT_CANVAS) },
  );
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const buffer = await page.screenshot({ path: resolve(SCREENSHOT_DIR, name), fullPage: false });
  await testInfo.attach(name, { body: buffer, contentType: "image/png" });
}

test("cmd/ctrl wheel zoom burst progresses monotonically without rubber-banding", async ({
  page,
}, testInfo) => {
  await bootCanvas(page);
  const surface = page.getByTestId("react-flow-canvas");
  // Start from a known zoom so the burst never saturates the max-zoom clamp.
  await page.getByTestId("canvas-zoom-readout").click();
  await expect(page.getByTestId("canvas-zoom-readout")).toHaveText("100%");
  // The reset animates (~120ms); wait for the real transform to settle at 1.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
        const match = viewport?.style.transform.match(/scale\(([\d.]+)\)/);
        return match ? Number(match[1]) : Number.NaN;
      }),
    )
    .toBeCloseTo(1, 3);
  const bounds = await surface.boundingBox();
  expect(bounds).not.toBeNull();
  const origin = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 };

  // Dispatch a fast zoom-in burst and sample the applied scale after every
  // tick. Under the old per-tick 70ms animation the samples oscillate (the
  // reported "jumping"); the fix must produce strictly increasing zoom.
  const samples = await page.evaluate(
    async ({ x, y }) => {
      const target = document.querySelector(".afx-canvas-surface");
      if (!target) return [];
      const readZoomInPage = (): number => {
        const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
        const match = viewport?.style.transform.match(/scale\(([\d.]+)\)/);
        return match ? Number(match[1]) : Number.NaN;
      };
      const zooms: number[] = [];
      for (let tick = 0; tick < 6; tick += 1) {
        target.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -120,
            ctrlKey: true,
            clientX: x,
            clientY: y,
          }),
        );
        // One frame between ticks — matches a real trackpad/wheel event rate.
        await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
        zooms.push(readZoomInPage());
      }
      return zooms;
    },
    { x: origin.x, y: origin.y },
  );

  expect(samples).toHaveLength(6);
  for (const sample of samples) expect(Number.isFinite(sample)).toBe(true);
  // Strictly monotonic zoom-in: any decrease is the rubber-band jump.
  for (let index = 1; index < samples.length; index += 1) {
    expect(samples[index]).toBeGreaterThan(samples[index - 1]);
  }
  // The whole burst compounds — not one step repeatedly re-applied.
  expect(samples[samples.length - 1]).toBeGreaterThan(samples[0] * 1.5);

  // The toolbar readout follows the gesture.
  const readout = await page.getByTestId("canvas-zoom-readout").textContent();
  expect(Number.parseInt(readout ?? "0", 10)).toBeGreaterThan(100);
  await capture(page, testInfo, "canvas-zoom-burst-monotonic.png");
});

test("a node drags from its body, shows a grab cursor, and persists the move", async ({
  page,
}, testInfo) => {
  await bootCanvas(page);
  const node = page.locator('.react-flow__node[data-id="risk"]');
  const body = page.getByTestId("canvas-node-body-risk");

  // The affordance: anywhere on the card advertises grabbing.
  await expect(body).toHaveCSS("cursor", "grab");

  const before = await node.boundingBox();
  expect(before).not.toBeNull();
  // Press in the middle of the BODY (not the header) and drag.
  const start = {
    x: before!.x + before!.width / 2,
    y: before!.y + before!.height * 0.7,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 140, start.y + 90, { steps: 12 });
  await page.mouse.up();

  const after = await node.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x - before!.x).toBeGreaterThan(100);
  expect(after!.y - before!.y).toBeGreaterThan(60);

  // The move is staged to the host as a real edit, not just a visual shift.
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __afxCanvasOutbound?: Array<{ type?: string }> }
          ).__afxCanvasOutbound?.filter((message) => message.type === "afxCanvasEdit").length ?? 0,
      ),
    )
    .toBeGreaterThan(0);

  // Escape hatch 1: the toolbar toggle switches the card to text selection.
  await page.getByRole("button", { name: "Text selection (or hold Alt)" }).click();
  await expect(body).toHaveCSS("cursor", "text");
  // The first drag's geometry commit + host ack land asynchronously and
  // re-project the node. Wait until its position is stable across a spaced
  // sample window before measuring the locked baseline.
  let settled = await node.boundingBox();
  await expect
    .poll(
      async () => {
        const current = await node.boundingBox();
        const stable = Math.abs((current?.x ?? 0) - (settled?.x ?? 1)) < 0.5;
        settled = current;
        return stable;
      },
      { intervals: [250, 250, 250, 500], timeout: 5000 },
    )
    .toBe(true);
  const lockedBefore = settled;
  await page.mouse.move(lockedBefore!.x + lockedBefore!.width / 2, lockedBefore!.y + 40);
  await page.mouse.down();
  await page.mouse.move(lockedBefore!.x + 200, lockedBefore!.y + 160, { steps: 6 });
  await page.mouse.up();
  const lockedAfter = await node.boundingBox();
  expect(Math.abs(lockedAfter!.x - lockedBefore!.x)).toBeLessThan(2);
  await page.getByRole("button", { name: "Exit text selection" }).click();
  await expect(body).toHaveCSS("cursor", "grab");

  // Escape hatch 2: holding Alt gives the same mode transiently.
  await page.keyboard.down("Alt");
  await expect(body).toHaveCSS("cursor", "text");
  await page.keyboard.up("Alt");
  await expect(body).toHaveCSS("cursor", "grab");
  await capture(page, testInfo, "canvas-body-drag-moves-node.png");
});

test("status banners float over the surface without changing canvas layout", async ({
  page,
}, testInfo) => {
  await bootCanvas(page);
  const surface = page.locator(".react-flow").first();
  const before = await surface.boundingBox();
  expect(before).not.toBeNull();

  // Trigger a pending operation whose host reply never arrives — the
  // "Refreshing dependencies…" banner appears immediately.
  await page.getByRole("button", { name: "Spec Map" }).click();
  await page.getByRole("button", { name: "Sync specs", exact: true }).click();
  const banner = page.getByText("Refreshing dependencies…");
  await expect(banner).toBeVisible();

  // The banner floats: same canvas geometry, overlay is absolutely positioned.
  const after = await surface.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBeCloseTo(before!.y, 1);
  expect(after!.height).toBeCloseTo(before!.height, 1);
  await expect(page.getByTestId("canvas-status-overlay")).toHaveCSS("position", "absolute");
  await capture(page, testInfo, "canvas-status-banner-floating.png");
});

test("background patterns and warm tone are actually visible in both themes", async ({
  page,
}, testInfo) => {
  await bootCanvas(page);
  // An empty region of the surface, clear of nodes, toolbars, and overlays.
  const surface = page.getByTestId("react-flow-canvas");
  const box = await surface.boundingBox();
  const clip = {
    x: box!.x + box!.width - 340,
    y: box!.y + box!.height - 240,
    width: 300,
    height: 200,
  };
  const shot = async (name: string): Promise<Buffer> => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const buffer = await page.screenshot({ clip, path: resolve(SCREENSHOT_DIR, name) });
    await testInfo.attach(name, { body: buffer, contentType: "image/png" });
    return buffer;
  };
  const setTheme = (theme: "dark" | "light") =>
    page.evaluate((next) => {
      document.body.classList.remove(
        "vscode-dark",
        "vscode-light",
        "vscode-high-contrast",
        "vscode-high-contrast-light",
      );
      document.body.classList.add(`vscode-${next}`);
    }, theme);
  const backgroundCycle = () => page.getByRole("button", { name: /^Background: / });

  // ── Dark theme: dots must differ from a clean surface ──
  await setTheme("dark");
  const darkDots = await shot("appearance-dark-dots.png");
  await backgroundCycle().click(); // -> grid
  const darkGrid = await shot("appearance-dark-grid.png");
  await backgroundCycle().click(); // -> none
  const darkNone = await shot("appearance-dark-none.png");
  expect(darkDots.equals(darkNone)).toBe(false);
  expect(darkGrid.equals(darkNone)).toBe(false);
  expect(darkDots.equals(darkGrid)).toBe(false);

  // ── Light theme: same visibility guarantee ──
  await setTheme("light");
  await backgroundCycle().click(); // none -> dots
  const lightDots = await shot("appearance-light-dots.png");
  await backgroundCycle().click(); // -> grid
  await backgroundCycle().click(); // -> none
  const lightNone = await shot("appearance-light-none.png");
  expect(lightDots.equals(lightNone)).toBe(false);

  // ── Warm tone must change the surface in LIGHT theme (the reported bug) ──
  const flowBg = () =>
    page
      .locator(".react-flow")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  const lightThemeBg = await flowBg();
  await page.getByRole("button", { name: "Warm surface tone" }).click();
  const lightWarmBg = await flowBg();
  expect(lightWarmBg).not.toBe(lightThemeBg);
  const lightWarm = await shot("appearance-light-warm.png");
  expect(lightWarm.equals(lightNone)).toBe(false);

  // ── And in dark theme too ──
  await setTheme("dark");
  const darkWarmBg = await flowBg();
  await page.getByRole("button", { name: "Follow theme tone" }).click();
  const darkThemeBg = await flowBg();
  expect(darkWarmBg).not.toBe(darkThemeBg);
});

test("toolbars group into overflow menus on narrow panels and stay fully usable", async ({
  page,
}) => {
  await bootCanvas(page);
  // Wide: tier-2 buttons visible, overflow triggers absent.
  await expect(page.getByRole("button", { name: "Warm surface tone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More canvas tools" })).toBeHidden();
  await expect(page.getByRole("button", { name: "More canvas actions" })).toBeHidden();

  // Narrow panel: tier-2 collapses, overflow menus take over.
  await page.setViewportSize({ width: 560, height: 620 });
  await expect(page.getByRole("button", { name: "Warm surface tone" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Rename canvas" })).toBeHidden();
  const moreTools = page.getByRole("button", { name: "More canvas tools" });
  const moreActions = page.getByRole("button", { name: "More canvas actions" });
  await expect(moreTools).toBeVisible();
  await expect(moreActions).toBeVisible();

  // The hidden view toggles still work from the tools menu (warm tone).
  const flowBg = () =>
    page
      .locator(".react-flow")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  const before = await flowBg();
  await moreTools.click();
  await page.getByRole("menuitemcheckbox", { name: "Warm tone" }).click();
  expect(await flowBg()).not.toBe(before);

  // The hidden insert actions still work from the actions menu (add sticky).
  const count = () => page.locator(".react-flow__node").count();
  const nodesBefore = await count();
  await moreActions.click();
  await page.getByRole("menuitem", { name: "Add sticky note" }).click();
  await expect.poll(count).toBe(nodesBefore + 1);
});

test("attach offers markdown/spec picking and dialogs replace dead window.prompt", async ({
  page,
}) => {
  await bootCanvas(page);
  const count = () => page.locator(".react-flow__node").count();
  const outbound = (type: string) =>
    page.evaluate(
      (t) =>
        (
          window as typeof window & {
            __afxCanvasOutbound?: Array<{ type?: string; kind?: string }>;
          }
        ).__afxCanvasOutbound?.filter((message) => message.type === t) ?? [],
      type,
    );

  // Markdown/spec attach: menu item exists, sends the right kind, and the
  // picked reference lands on the canvas as a file node.
  const before = await count();
  await page.getByRole("button", { name: "Attach to canvas" }).click();
  await page.getByRole("button", { name: "Markdown & specs" }).click();
  await expect.poll(() => outbound("afxCanvasPickReferences")).toHaveLength(1);
  expect((await outbound("afxCanvasPickReferences"))[0]).toMatchObject({ kind: "markdown" });
  await expect.poll(count).toBe(before + 1);

  // New canvas: a real dialog opens (window.prompt does not exist in webviews),
  // and submitting it sends the create request.
  await page.getByRole("button", { name: "New canvas" }).click();
  const input = page.getByLabel("Canvas name");
  await expect(input).toBeVisible();
  await input.fill("Retro board");
  await page.getByRole("button", { name: "Create" }).click();
  await expect.poll(() => outbound("afxCanvasCreate")).toHaveLength(1);
  expect((await outbound("afxCanvasCreate"))[0]).toMatchObject({ name: "Retro board" });
});
