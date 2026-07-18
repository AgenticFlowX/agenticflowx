/**
 * Experimental Canvas Workbench e2e + screenshot coverage.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-5] [FR-6] [FR-8] [FR-9] [FR-20] [NFR-6]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type Locator, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/workbench/screenshots");
const SPEC_PATH = "docs/specs/demo/spec.md";
const LARGE_SPEC_PATH = "docs/specs/213-app-chat-history/design.md";
const LARGE_SPEC_CONTENT = readFileSync(resolve(process.cwd(), "../../", LARGE_SPEC_PATH), "utf8");

async function enableCanvas(page: import("@playwright/test").Page) {
  await page.evaluate(
    ({ filePath, largeSpecPath, largeSpecContent }) => {
      window.addEventListener("message", (event: MessageEvent) => {
        const msg = event.data as { type?: string; filePath?: string } | undefined;
        if (msg?.type === "afxFetchDocContent" && msg.filePath === filePath) {
          const longBody = Array.from(
            { length: 24 },
            (_, index) =>
              `Canvas preview line ${index + 1} with enough text to make this node scroll.`,
          ).join("\n\n");
          window.postMessage(
            {
              type: "afxDocContent",
              filePath,
              content: `# Demo Spec\n\nInline spec content for the canvas node.\n\n${longBody}`,
            },
            "*",
          );
        }
        if (msg?.type === "afxFetchDocContent" && msg.filePath === largeSpecPath) {
          window.postMessage(
            {
              type: "afxDocContent",
              filePath: largeSpecPath,
              content: largeSpecContent,
            },
            "*",
          );
        }
      });
      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: { path: ".afx/project.canvas", exists: false, content: "" },
          documents: [
            {
              type: "SPEC",
              name: "Demo Spec",
              status: "Draft",
              owner: "@rix",
              filePath,
            },
            {
              type: "DESIGN",
              name: "App Chat History Design",
              status: "Draft",
              owner: "@rixrix",
              filePath: largeSpecPath,
            },
          ],
        },
        "*",
      );
    },
    { filePath: SPEC_PATH, largeSpecPath: LARGE_SPEC_PATH, largeSpecContent: LARGE_SPEC_CONTENT },
  );
}

test("canvas experiment stays hidden by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Canvas" })).toHaveCount(0);
});

test("canvas creates text/file nodes, links them, and stays visually stable", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 760, height: 360 });
  await page.goto("/");
  await enableCanvas(page);
  await page.getByRole("tab", { name: "Canvas" }).click();

  const world = page.getByTestId("canvas-world");
  const panBefore = await world.evaluate((element) => element.getAttribute("style") ?? "");
  await page.mouse.move(36, 132);
  await page.mouse.down();
  await page.mouse.move(88, 176);
  await page.mouse.up();
  await expect
    .poll(() => world.evaluate((element) => element.getAttribute("style") ?? ""))
    .not.toBe(panBefore);
  const panAfterDrag = await readCanvasTransform(world);
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 80);
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await readCanvasTransform(world)).x).toBeLessThan(panAfterDrag.x);
  const panAfterHorizontalWheel = await readCanvasTransform(world);
  expect(panAfterHorizontalWheel.y).toBe(panAfterDrag.y);
  await page.keyboard.down("Meta");
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 80);
  await page.keyboard.up("Shift");
  await page.keyboard.up("Meta");
  await expect
    .poll(async () => (await readCanvasTransform(world)).y)
    .toBeLessThan(panAfterHorizontalWheel.y);
  const panAfterVerticalWheel = await readCanvasTransform(world);
  expect(panAfterVerticalWheel.x).toBe(panAfterHorizontalWheel.x);

  await page.getByRole("button", { name: "Add text node" }).click();
  await page.getByRole("button", { name: "Add notepad node" }).click();
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("button", { name: "Open markdown document picker" }).click();
  await page.getByLabel("Document for file node").selectOption(SPEC_PATH);
  await page.getByRole("button", { name: "Add file node" }).click();

  const textNode = page.locator('[data-node-type="text"]').first();
  const fileNode = page.locator('[data-node-type="file"]').first();
  const noteNode = page.locator('[data-node-kind="note"]').first();
  const groupNode = page.locator('[data-node-kind="group"]').first();
  await expect(textNode).toBeVisible();
  await expect(fileNode).toBeVisible();
  await expect(page.getByText("Inline spec content for the canvas node.")).toBeVisible();
  await expect(noteNode).toBeVisible();
  await expect(groupNode).toBeVisible();
  await expect(textNode.locator('[data-node-icon="text"]')).toBeVisible();
  await expect(noteNode.locator('[data-node-icon="note"]')).toBeVisible();
  await expect(groupNode.locator('[data-node-icon="group"]')).toBeVisible();
  await expect(fileNode.locator('[data-node-icon="file"]')).toBeVisible();
  // Groups are visual containers only — no send-to-chat and no select toggle.
  await expect(groupNode.getByRole("button", { name: "Send node to chat" })).toHaveCount(0);
  await expect(groupNode.getByRole("button", { name: "Add node to selection" })).toHaveCount(0);
  await expect(textNode.getByLabel("Drag node")).toBeVisible();
  await expect(textNode.getByRole("button", { name: "Resize node" })).toBeVisible();
  const textResizeHandle = textNode.getByRole("button", { name: "Resize node" });
  const textActions = textNode.locator('[data-node-actions="true"]');
  await page.mouse.move(24, 330);
  await expect
    .poll(() => textActions.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("0");
  await expect
    .poll(() => textResizeHandle.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("0");
  const textBoxForHover = await textNode.boundingBox();
  if (textBoxForHover) {
    await page.mouse.move(textBoxForHover.x + 24, textBoxForHover.y + 20);
  }
  await expect
    .poll(() => textActions.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("1");
  await expect
    .poll(() => textResizeHandle.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("1");
  await renameCanvasNode(textNode, "Architecture card");
  await renameCanvasNode(noteNode, "Decision note");
  await renameCanvasNode(groupNode, "Sprint frame");
  const batchChatButton = page.getByRole("button", {
    name: "Send selected canvas context to chat",
  });
  await expect(batchChatButton).toBeDisabled();
  await expect(textNode.getByRole("button", { name: "Send node to chat" })).toBeVisible();
  await textNode.hover();
  await textNode.getByRole("button", { name: "Add node to selection" }).click();
  await fileNode.hover();
  await fileNode.getByRole("button", { name: "Add node to selection" }).click();
  await expect(batchChatButton).toBeEnabled();
  await expect(batchChatButton).toContainText("Chat 2");
  await textNode.click();

  const box = await textNode.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 30, box.y + 16);
    await page.mouse.down();
    await page.mouse.move(box.x - 20, box.y + 46);
    await page.mouse.up();
  }
  const resizeHandle = textNode.getByRole("button", { name: "Resize node" });
  const resizeBox = await resizeHandle.boundingBox();
  if (resizeBox) {
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      resizeBox.x + resizeBox.width / 2 + 40,
      resizeBox.y + resizeBox.height / 2 + 30,
    );
    await page.mouse.up();
  }

  const linkHandle = textNode.getByRole("button", { name: "Drag right connector" });
  const linkBox = await linkHandle.boundingBox();
  const fileBox = await fileNode.boundingBox();
  if (linkBox && fileBox) {
    await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(...visibleNodePoint(fileBox, page.viewportSize()?.height ?? 360));
    await page.mouse.up();
  }
  const edgeLabel = page.getByRole("button", { name: "Edit edge label Add label" });
  await expect(edgeLabel).toBeVisible();
  await edgeLabel.click();
  const edgeLabelInput = page.getByRole("textbox", { name: "Edge label" });
  await edgeLabelInput.fill("blocks");
  await edgeLabelInput.press("Enter");
  const namedEdgeLabel = page.getByRole("button", { name: "Edit edge label blocks" });
  await expect(namedEdgeLabel).toBeVisible();
  await namedEdgeLabel.dblclick();
  await expect(page.getByRole("textbox", { name: "Edge label" })).toHaveValue("blocks");
  await page.keyboard.press("Escape");
  const secondLinkBox = await linkHandle.boundingBox();
  const secondFileBox = await fileNode.boundingBox();
  if (secondLinkBox && secondFileBox) {
    await page.mouse.move(
      secondLinkBox.x + secondLinkBox.width / 2,
      secondLinkBox.y + secondLinkBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(...visibleNodePoint(secondFileBox, page.viewportSize()?.height ?? 360));
    await page.mouse.up();
  }
  await expect(page.locator("[data-edge-id]")).toHaveCount(2);

  const targetHandle = page.getByRole("button", { name: "Retarget target for edge blocks" });
  const targetHandleBox = await targetHandle.boundingBox();
  const noteBox = await noteNode.boundingBox();
  if (targetHandleBox && noteBox) {
    await page.mouse.move(
      targetHandleBox.x + targetHandleBox.width / 2,
      targetHandleBox.y + targetHandleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
    await page.mouse.up();
  }
  const retargetedTargetBox = await targetHandle.boundingBox();
  const updatedNoteBox = await noteNode.boundingBox();
  if (retargetedTargetBox && updatedNoteBox) {
    expect(retargetedTargetBox.x).toBeGreaterThanOrEqual(updatedNoteBox.x - 14);
    expect(retargetedTargetBox.x).toBeLessThanOrEqual(updatedNoteBox.x + updatedNoteBox.width + 14);
  }

  await page.getByRole("button", { name: "Delete edge blocks" }).click();
  await expect(page.locator("[data-edge-id]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Edit edge label blocks" })).toHaveCount(0);
  await expect(page.getByLabel(/Canvas save status/)).toBeVisible();

  const compactOverflow = await page.evaluate(() =>
    Math.max(0, document.body.scrollWidth - window.innerWidth),
  );
  expect(compactOverflow).toBeLessThanOrEqual(1);
  const compactPath = resolve(SCREENSHOT_DIR, "canvas-compact.png");
  const compact = await page.screenshot({ fullPage: false, path: compactPath });
  await testInfo.attach("canvas-compact.png", { body: compact, contentType: "image/png" });
  expect(compact.length).toBeGreaterThan(10_000);

  await page.setViewportSize({ width: 1400, height: 600 });
  await page.getByRole("button", { name: "Fit to view" }).click();
  const fileScroll = fileNode.locator('[data-canvas-scrollable="true"]');
  await fileScroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  const fileScrollBox = await fileScroll.boundingBox();
  if (fileScrollBox) {
    await page.mouse.move(fileScrollBox.x + fileScrollBox.width / 2, fileScrollBox.y + 80);
    await page.mouse.wheel(0, 360);
  }
  await expect.poll(() => fileScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const panBeforeNestedWheel = await world.evaluate(
    (element) => element.getAttribute("style") ?? "",
  );
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 240);
  await page.keyboard.up("Shift");
  await expect
    .poll(() => world.evaluate((element) => element.getAttribute("style") ?? ""))
    .toBe(panBeforeNestedWheel);
  await expect(page.getByText("100%")).toBeVisible();
  const wideOverflow = await page.evaluate(() =>
    Math.max(0, document.body.scrollWidth - window.innerWidth),
  );
  expect(wideOverflow).toBeLessThanOrEqual(1);
  const widePath = resolve(SCREENSHOT_DIR, "canvas-wide.png");
  const wide = await page.screenshot({ fullPage: false, path: widePath });
  await testInfo.attach("canvas-wide.png", { body: wide, contentType: "image/png" });
  expect(wide.length).toBeGreaterThan(10_000);
});

test("canvas handles large markdown, colors, resize clamps, and external updates", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 540, height: 420 });
  await page.goto("/");
  await enableCanvas(page);
  await page.getByRole("tab", { name: "Canvas" }).click();

  await page.getByRole("button", { name: "Open markdown document picker" }).click();
  await page.getByLabel("Document for file node").selectOption(LARGE_SPEC_PATH);
  await page.getByRole("button", { name: "Add file node" }).click();
  const fileNode = page.locator('[data-node-type="file"]').first();
  await expect(fileNode).toBeVisible();
  await expect(fileNode.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();

  const fileScroll = fileNode.locator('[data-canvas-scrollable="true"]');
  await fileScroll.evaluate((element) => {
    element.scrollTop = 0;
  });
  const fileScrollBox = await fileScroll.boundingBox();
  if (fileScrollBox) {
    await page.mouse.move(fileScrollBox.x + fileScrollBox.width / 2, fileScrollBox.y + 80);
    await page.mouse.wheel(0, 500);
  }
  await expect.poll(() => fileScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("button", { name: "Add text node" }).click();
  await expect(page.getByText("GROUP BOX")).toHaveCount(0);

  const textNode = page.locator('[data-node-kind="text"]').first();
  await textNode.click();
  await page.getByRole("button", { name: "Set selected node color" }).click();
  await page.getByRole("button", { name: "Set selected nodes color Purple" }).click();
  await expect
    .poll(() =>
      textNode.evaluate((element) => getComputedStyle(element as HTMLElement).borderLeftColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");

  const resizeHandle = textNode.getByRole("button", { name: "Resize node" });
  const resizeBox = await resizeHandle.boundingBox();
  if (resizeBox) {
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x - 500, resizeBox.y - 500);
    await page.mouse.up();
  }
  const resizedBox = await textNode.boundingBox();
  expect(resizedBox?.width ?? 0).toBeGreaterThanOrEqual(175);
  expect(resizedBox?.height ?? 0).toBeGreaterThanOrEqual(105);

  const dragBefore = await textNode.boundingBox();
  if (dragBefore) {
    await page.mouse.move(dragBefore.x + 24, dragBefore.y + 16);
    await page.mouse.down();
    await page.mouse.move(dragBefore.x + 82, dragBefore.y + 48);
    await page.mouse.up();
  }
  const dragAfter = await textNode.boundingBox();
  expect(Math.abs((dragAfter?.x ?? 0) - (dragBefore?.x ?? 0))).toBeGreaterThan(10);

  await page.getByRole("button", { name: "Add text node" }).click();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "afxUpdate",
        canvasEnabled: true,
        canvas: {
          path: ".afx/project.canvas",
          exists: true,
          content: '{"nodes":[],"edges":[]}',
        },
      },
      "*",
    );
  });
  await expect(page.getByText("External canvas update available")).toBeVisible();

  const compactOverflow = await page.evaluate(() =>
    Math.max(0, document.body.scrollWidth - window.innerWidth),
  );
  expect(compactOverflow).toBeLessThanOrEqual(1);
  const largePath = resolve(SCREENSHOT_DIR, "canvas-large-markdown-regression.png");
  const largeShot = await page.screenshot({ fullPage: false, path: largePath });
  await testInfo.attach("canvas-large-markdown-regression.png", {
    body: largeShot,
    contentType: "image/png",
  });
  expect(largeShot.length).toBeGreaterThan(10_000);
});

test("canvas toolbar and background remain quiet in light theme", async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1180, height: 520 });
  await page.goto("/");
  await page.evaluate(() => {
    document.body.classList.remove("vscode-dark");
    document.body.classList.add("vscode-light", "theme-meridian", "style-mira");
  });
  await enableCanvas(page);
  await page.getByRole("tab", { name: "Canvas" }).click();
  await page.getByRole("button", { name: "Add text node" }).click();
  await page.getByRole("button", { name: "Add notepad node" }).click();
  await page.getByRole("button", { name: "Add label" }).click();
  await page.getByRole("button", { name: "Open markdown document picker" }).click();
  await page.getByLabel("Document for file node").selectOption(SPEC_PATH);
  await page.getByRole("button", { name: "Add file node" }).click();

  await expect(page.getByRole("button", { name: "Add text node" })).toHaveText("Card");
  await expect(page.getByRole("button", { name: "Add label" })).toContainText("Label");
  const labelNode = page.locator('[data-node-kind="label"]').first();
  await expect(labelNode.locator('[data-node-icon="label"]')).toHaveCount(0);
  await renameCanvasNode(labelNode, "Milestone");
  const labelTitle = labelNode.getByRole("button", { name: "Rename node label Milestone" });
  const labelFrame = await labelNode.evaluate((element) => {
    const style = getComputedStyle(element as HTMLElement);
    return {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(labelFrame.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(labelFrame.borderTopColor).toBe("rgba(0, 0, 0, 0)");
  expect(labelFrame.boxShadow).not.toMatch(/rgba\([^)]+,\s*0\.[1-9]/);
  const labelTitleBox = await labelTitle.boundingBox();
  await labelTitle.hover();
  const labelDeleteBox = await labelNode
    .getByRole("button", { name: "Delete label" })
    .boundingBox();
  expect(labelTitleBox).not.toBeNull();
  expect(labelDeleteBox).not.toBeNull();
  if (labelTitleBox && labelDeleteBox) {
    expect(Math.abs(labelDeleteBox.x - (labelTitleBox.x + labelTitleBox.width))).toBeLessThan(72);
  }
  const labelFontBefore = await labelTitle.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element as HTMLElement).fontSize),
  );
  const labelResizeHandle = labelNode.getByRole("button", { name: "Resize node" });
  const labelResizeBox = await labelResizeHandle.boundingBox();
  if (labelTitleBox && labelResizeBox) {
    expect(Math.abs(labelResizeBox.x - (labelTitleBox.x + labelTitleBox.width))).toBeLessThan(24);
    expect(labelResizeBox.y).toBeGreaterThan(labelTitleBox.y + labelTitleBox.height - 28);
    expect(labelResizeBox.y).toBeLessThan(labelTitleBox.y + labelTitleBox.height + 8);
  }
  if (labelResizeBox) {
    await page.mouse.move(
      labelResizeBox.x + labelResizeBox.width / 2,
      labelResizeBox.y + labelResizeBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      labelResizeBox.x + labelResizeBox.width / 2 + 70,
      labelResizeBox.y + labelResizeBox.height / 2 + 46,
    );
    await page.mouse.up();
  }
  await expect
    .poll(() =>
      labelTitle.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element as HTMLElement).fontSize),
      ),
    )
    .toBeGreaterThan(labelFontBefore + 8);
  const labelTitleAfterResize = await labelTitle.boundingBox();
  const labelResizeAfterResize = await labelResizeHandle.boundingBox();
  if (labelTitleAfterResize && labelResizeAfterResize) {
    expect(
      Math.abs(labelResizeAfterResize.x - (labelTitleAfterResize.x + labelTitleAfterResize.width)),
    ).toBeLessThan(24);
    expect(labelResizeAfterResize.y).toBeGreaterThan(
      labelTitleAfterResize.y + labelTitleAfterResize.height - 28,
    );
    expect(labelResizeAfterResize.y).toBeLessThan(
      labelTitleAfterResize.y + labelTitleAfterResize.height + 8,
    );
  }
  await labelTitle.dblclick();
  const labelInput = labelNode.getByRole("textbox", { name: "Rename node label" });
  await expect(labelInput).toBeVisible();
  const labelInputBox = await labelInput.boundingBox();
  const labelResizeWhileEditing = await labelResizeHandle.boundingBox();
  if (labelInputBox && labelResizeWhileEditing) {
    expect(
      Math.abs(labelResizeWhileEditing.x - (labelInputBox.x + labelInputBox.width)),
    ).toBeLessThan(24);
    expect(labelResizeWhileEditing.y).toBeGreaterThan(labelInputBox.y + labelInputBox.height - 28);
    expect(labelResizeWhileEditing.y).toBeLessThan(labelInputBox.y + labelInputBox.height + 8);
  }
  await labelInput.press("Escape");
  await expect(labelNode.getByRole("button", { name: "Send node to chat" })).toHaveCount(0);
  await page.mouse.move(24, 500);
  await page.waitForTimeout(200);
  await expect(page.getByText("Inline spec content for the canvas node.")).toBeVisible();
  const overflow = await page.evaluate(() =>
    Math.max(0, document.body.scrollWidth - window.innerWidth),
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const lightPath = resolve(SCREENSHOT_DIR, "canvas-light-toolbar-grid.png");
  const lightShot = await page.screenshot({ fullPage: false, path: lightPath });
  await testInfo.attach("canvas-light-toolbar-grid.png", {
    body: lightShot,
    contentType: "image/png",
  });
  expect(lightShot.length).toBeGreaterThan(10_000);
});

test("canvas labels keep text-sized controls and hit areas in dense layouts", async ({ page }) => {
  const denseCanvas = {
    nodes: [
      {
        id: "n-near-label",
        type: "text",
        text: "Nearby",
        afxNodeKind: "label",
        x: 210,
        y: 185,
        width: 160,
        height: 34,
      },
      {
        id: "n-large-label",
        type: "text",
        text: "Large label",
        afxNodeKind: "label",
        x: 120,
        y: 82,
        width: 520,
        height: 170,
      },
    ],
    edges: [],
  };
  await page.setViewportSize({ width: 900, height: 360 });
  await page.goto("/");
  await page.evaluate((content) => {
    window.postMessage(
      {
        type: "afxUpdate",
        canvasEnabled: true,
        canvas: { path: ".afx/project.canvas", exists: true, content },
        documents: [],
      },
      "*",
    );
  }, JSON.stringify(denseCanvas));
  await page.getByRole("tab", { name: "Canvas" }).click();

  const largeLabel = page.locator('[data-node-id="n-large-label"]');
  const nearLabel = page.locator('[data-node-id="n-near-label"]');
  const nearTitle = nearLabel.getByRole("button", { name: "Rename node label Nearby" });
  await expect(largeLabel).toBeVisible();
  await expect(nearTitle).toBeVisible();

  const nearTitleBox = await nearTitle.boundingBox();
  if (nearTitleBox) {
    await page.mouse.move(
      nearTitleBox.x + nearTitleBox.width / 2,
      nearTitleBox.y + nearTitleBox.height / 2,
    );
  }
  await expect
    .poll(() =>
      nearLabel
        .locator('[data-label-actions="true"]')
        .evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe("1");
  await nearLabel.getByRole("button", { name: "Add node to selection" }).click();
  await expect(
    nearLabel.getByRole("button", { name: "Remove node from selection" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await nearLabel.evaluate((element) => element.className)).toContain("text-afx-brand");
  expect(await largeLabel.evaluate((element) => element.className)).not.toContain("text-afx-brand");
});

test("canvas stress renders a dense project map with parallel edges", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const stressCanvas = makeStressCanvas(144);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.evaluate((content) => {
    window.postMessage(
      {
        type: "afxUpdate",
        canvasEnabled: true,
        canvas: { path: ".afx/project.canvas", exists: true, content },
        documents: [],
      },
      "*",
    );
  }, JSON.stringify(stressCanvas));
  await page.getByRole("tab", { name: "Canvas" }).click();

  await expect(page.locator("[data-node-id]")).toHaveCount(stressCanvas.nodes.length);
  await expect(page.locator("[data-edge-id]")).toHaveCount(stressCanvas.edges.length);
  await page.getByRole("button", { name: "Fit to view" }).click();
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 360);
  await expect(page.getByLabel(/Canvas save status/)).toBeVisible();

  const overflow = await page.evaluate(() =>
    Math.max(0, document.body.scrollWidth - window.innerWidth),
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const stressPath = resolve(SCREENSHOT_DIR, "canvas-stress-144-nodes.png");
  const stressShot = await page.screenshot({ fullPage: false, path: stressPath });
  await testInfo.attach("canvas-stress-144-nodes.png", {
    body: stressShot,
    contentType: "image/png",
  });
  expect(stressShot.length).toBeGreaterThan(10_000);
});

function makeStressCanvas(nodeCount: number) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const col = index % 12;
    const row = Math.floor(index / 12);
    const x = col * 270;
    const y = row * 190;
    if (index % 18 === 0) {
      return {
        id: `n-${index}`,
        type: "group",
        label: `Frame ${index}`,
        x,
        y,
        width: 520,
        height: 320,
        color: "5",
      };
    }
    return {
      id: `n-${index}`,
      type: "text",
      text:
        index % 5 === 0
          ? `# Note ${index}\n\nStress note with enough markdown to render paragraphs, lists, and inline code.`
          : `Card ${index}\n\n- Spec link ${index}\n- Implementation note ${index}`,
      afxNodeKind: index % 5 === 0 ? "note" : undefined,
      color: String((index % 6) + 1),
      x,
      y,
      width: 240,
      height: 136,
    };
  });
  const edges = Array.from({ length: nodeCount - 1 }, (_, index) => ({
    id: `e-${index}`,
    fromNode: `n-${index}`,
    fromSide: "right",
    toNode: `n-${index + 1}`,
    toSide: "left",
    toEnd: "arrow",
    label: index % 9 === 0 ? `e${index}` : undefined,
  }));
  edges.push(
    {
      id: "e-parallel-1",
      fromNode: "n-1",
      fromSide: "right",
      toNode: "n-2",
      toSide: "left",
      toEnd: "arrow",
      label: "parallel a",
    },
    {
      id: "e-parallel-2",
      fromNode: "n-1",
      fromSide: "right",
      toNode: "n-2",
      toSide: "left",
      toEnd: "arrow",
      label: "parallel b",
    },
  );
  return { nodes, edges };
}

function visibleNodePoint(
  box: { x: number; y: number; width: number; height: number },
  viewportHeight: number,
): [number, number] {
  const y = Math.min(box.y + Math.max(24, box.height * 0.45), viewportHeight - 24);
  return [box.x + Math.min(80, box.width * 0.45), y];
}

async function renameCanvasNode(node: Locator, label: string) {
  // The rename control hover/focus-reveals (group keeps its label, but its options
  // reveal on hover too); labels reveal via their own control.
  const kind = await node.getAttribute("data-node-kind");
  if (kind === "label") {
    await node.getByRole("button", { name: /^Rename node label / }).hover();
  } else {
    await node.hover();
  }
  await node.getByRole("button", { name: "Rename node label", exact: true }).click();
  const input = node.getByRole("textbox", { name: "Rename node label" });
  await input.fill(label);
  await input.press("Enter");
  await expect(node.getByRole("button", { name: `Rename node label ${label}` })).toBeVisible();
}

async function readCanvasTransform(
  world: Locator,
): Promise<{ x: number; y: number; zoom: number }> {
  const style = await world.evaluate((element) => (element as HTMLElement).style.transform);
  const match =
    /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\) scale\((\d+(?:\.\d+)?)\)/.exec(style);
  if (!match) throw new Error(`Unable to read canvas transform from ${style}`);
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    zoom: Number(match[3]),
  };
}
