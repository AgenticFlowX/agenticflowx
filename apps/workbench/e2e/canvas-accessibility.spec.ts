/**
 * Canvas accessibility and responsive-interaction release regressions.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38] [FR-43] [FR-44] [NFR-7] [NFR-12]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PROFILES] [DES-CANVAS-INTERACTIONS] [DES-TEST]
 */
import { expect, test } from "@playwright/test";
import type { Browser, Locator, Page } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

const ROOT_URI = "file:///workspace";
const PROJECT: CanvasDescriptor = {
  id: "accessibility-project",
  kind: "project",
  label: "Accessible Architecture Map",
  source: {
    rootUri: ROOT_URI,
    rootName: "workspace",
    relativePath: ".afx/project.canvas",
  },
  exists: true,
};
const DOCUMENT_ID = `${PROJECT.source.rootUri}::${PROJECT.source.relativePath}`;

const PORTABLE_CANVAS: JSONCanvas = {
  vendorExtension: { keep: "byte-for-byte", nested: { enabled: true } },
  nodes: [
    {
      id: "outcome",
      type: "text",
      text: "# Outcome\n\nMap an accessible release path.",
      x: 0,
      y: 0,
      width: 280,
      height: 150,
      color: "4",
    },
    {
      id: "spec",
      type: "file",
      file: "docs/specs/229-app-workbench-canvas/spec.md",
      x: 380,
      y: 0,
      width: 330,
      height: 190,
      color: "6",
    },
    {
      id: "next",
      type: "text",
      text: "## Next\n\nVerify narrow and keyboard workflows.",
      x: 190,
      y: 280,
      width: 280,
      height: 150,
      color: "3",
    },
  ],
  edges: [
    {
      id: "outcome-spec",
      fromNode: "outcome",
      fromSide: "right",
      toNode: "spec",
      toSide: "left",
      toEnd: "arrow",
      label: "defined by",
    },
    {
      id: "spec-next",
      fromNode: "spec",
      fromSide: "bottom",
      toNode: "next",
      toSide: "top",
      toEnd: "arrow",
      label: "guides",
    },
  ],
};

test("360px Workbench contains Canvas chrome without page overflow", async ({ page }) => {
  await bootWorkbenchCanvas(page, PORTABLE_CANVAS, { width: 360, height: 800 });

  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await expectNoDocumentOverflow(page);
  await expectSurfaceInsideViewport(page);

  const shellTabs = page.getByRole("tablist");
  const fileToolbar = page.getByTestId("canvas-toolbar");
  for (const rail of [shellTabs, fileToolbar]) {
    const geometry = await rail.evaluate((element) => ({
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(361);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
    expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth);
  }

  await page.getByRole("button", { name: "Fit selection or canvas" }).click();
  await expect.poll(() => allNodesInsideCanvas(page)).toBe(true);
  await expectNoDocumentOverflow(page);
});

test("Essentials supports a keyboard-only first-card workflow and restores focus", async ({
  page,
}) => {
  const empty: JSONCanvas = { nodes: [], edges: [] };
  await bootWorkbenchCanvas(page, empty, { width: 900, height: 620 });
  // The AFX workspace boots into the full toolset; this journey verifies the
  // minimal profile, so pick Essentials the way a user would.
  const profile = page.getByRole("combobox", { name: "Canvas tools profile" });
  await profile.selectOption("essentials");
  await expect(profile).toHaveValue("essentials");
  await clearOutbound(page);

  const canvasFile = page.getByRole("combobox", { name: "Canvas file" });
  await tabTo(page, canvasFile);
  await page.keyboard.press("Control+K");

  const commandTrigger = page.getByRole("button", { name: "Search Canvas commands" });
  const commandMenu = page.getByRole("dialog", { name: "Canvas command menu" });
  const search = commandMenu.getByRole("textbox", { name: "Find a Canvas command" });
  await expect(search).toBeFocused();
  await page.keyboard.type("Add card");
  const addCardCommand = commandMenu.getByRole("button", { name: /Add card/ });
  await page.keyboard.press("Tab");
  await expect(addCardCommand).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(commandMenu).toHaveCount(0);
  await expect(commandTrigger).toBeFocused();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  const edited = await waitForLatestCanvas(page, (canvas) => canvas.nodes?.length === 1);
  expect(edited.nodes?.[0]).toMatchObject({ type: "text" });
  expect(edited).not.toHaveProperty("afxCanvasKind");
  expect(edited.nodes?.[0]).not.toHaveProperty("afxNodeKind");
});

test("Canvas controls expose names and a keyboard-visible focus indicator", async ({ page }) => {
  await bootWorkbenchCanvas(page, PORTABLE_CANVAS, { width: 1024, height: 720 });

  const unnamedButtons = await page
    .getByTestId("canvas-toolbar")
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const name =
            button.getAttribute("aria-label") ??
            button.textContent?.trim() ??
            button.getAttribute("title") ??
            "";
          return name.length === 0;
        })
        .map((button) => button.outerHTML),
    );
  expect(unnamedButtons).toEqual([]);

  const commandTrigger = page.getByRole("button", { name: "Search Canvas commands" });
  await tabTo(page, commandTrigger);
  await expectKeyboardFocusIndicator(commandTrigger);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Find a Canvas command" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(commandTrigger).toBeFocused();
  await expectKeyboardFocusIndicator(commandTrigger);

  const addCard = page.getByRole("button", { name: "Add card" });
  await tabTo(page, addCard);
  await expectKeyboardFocusIndicator(addCard);
});

test("reduced motion and profile switching preserve the exact Canvas bytes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const original = JSON.stringify(PORTABLE_CANVAS);
  await bootWorkbenchCanvas(page, PORTABLE_CANVAS, { width: 1180, height: 720 });
  await clearOutbound(page);

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  await page.evaluate(() => {
    const viewport = document.querySelector(".react-flow__viewport");
    if (!viewport) throw new Error("React Flow viewport is unavailable.");
    const state = window as typeof window & {
      __afxReducedMotionObserver?: MutationObserver;
      __afxReducedMotionTransforms?: number;
    };
    state.__afxReducedMotionTransforms = 0;
    state.__afxReducedMotionObserver = new MutationObserver((records) => {
      state.__afxReducedMotionTransforms =
        (state.__afxReducedMotionTransforms ?? 0) + records.length;
    });
    state.__afxReducedMotionObserver.observe(viewport, {
      attributes: true,
      attributeFilter: ["style"],
    });
  });
  await page.getByRole("button", { name: "Fit selection or canvas" }).click();
  await page.waitForTimeout(250);
  const transformUpdates = await page.evaluate(() => {
    const state = window as typeof window & {
      __afxReducedMotionObserver?: MutationObserver;
      __afxReducedMotionTransforms?: number;
    };
    state.__afxReducedMotionObserver?.disconnect();
    return state.__afxReducedMotionTransforms ?? 0;
  });
  expect(transformUpdates).toBeLessThanOrEqual(2);

  const profile = page.getByRole("combobox", { name: "Canvas tools profile" });
  await profile.selectOption("architecture");
  await profile.selectOption("afx");
  await profile.selectOption("essentials");
  await page.waitForTimeout(250);

  expect(await outboundCount(page, "afxCanvasEdit")).toBe(0);
  expect(await hostContent(page)).toBe(original);
});

test("editor-area Canvas remains labelled and focus-visible in forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await bootEditorCanvas(page, PORTABLE_CANVAS, { width: 1360, height: 860 });

  expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
  await expect(page.getByRole("tab", { name: "Canvas" })).toHaveCount(0);
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expectSurfaceInsideViewport(page);
  await expectNoDocumentOverflow(page);

  const commandTrigger = page.getByRole("button", { name: "Search Canvas commands" });
  await tabTo(page, commandTrigger);
  await expectKeyboardFocusIndicator(commandTrigger);
  const themeTokens = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return { border: style.getPropertyValue("--border"), ring: style.getPropertyValue("--ring") };
  });
  expect(themeTokens.border.trim()).not.toBe("");
  expect(themeTokens.ring.trim()).not.toBe("");
});

test("coarse-pointer users can reach and tap compact Canvas actions", async ({ browser }) => {
  await withTouchPage(browser, async (page) => {
    await bootWorkbenchCanvas(page, PORTABLE_CANVAS, { width: 390, height: 844 });
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

    const addCard = page.getByRole("button", { name: "Add card" });
    const target = await addCard.boundingBox();
    if (!target) throw new Error("The compact Add card touch target has no geometry.");
    expect(target.width).toBeGreaterThanOrEqual(24);
    expect(target.height).toBeGreaterThanOrEqual(24);

    await clearOutbound(page);
    await addCard.tap();
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    await waitForLatestCanvas(page, (canvas) => canvas.nodes?.length === 4);
    await expectNoDocumentOverflow(page);
    await expectSurfaceInsideViewport(page);
  });
});

async function bootWorkbenchCanvas(
  page: Page,
  canvas: JSONCanvas,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await installWorkbenchCanvasHost(page, canvas);
  const tab = page.getByRole("tab", { name: "Canvas" });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toHaveValue(PROJECT.id);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

async function bootEditorCanvas(
  page: Page,
  canvas: JSONCanvas,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/?afx-view=canvas-editor");
  await page.evaluate((canvasDocument) => {
    globalThis.document.body.classList.add("vscode-high-contrast");
    globalThis.document.body.style.setProperty("--vscode-focusBorder", "Highlight");
    globalThis.document.body.style.setProperty("--vscode-contrastBorder", "CanvasText");
    window.postMessage(
      {
        type: "afxCanvasEditorDocument",
        clientId: "pending",
        document: canvasDocument,
        enabled: true,
      },
      "*",
    );
  }, snapshot(canvas));
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
}

async function installWorkbenchCanvasHost(page: Page, canvas: JSONCanvas): Promise<void> {
  const document = snapshot(canvas);
  await page.evaluate(
    ({ descriptor, document }) => {
      const host = window as typeof window & {
        __afxCanvasA11yOutbound?: Array<Record<string, unknown>>;
        __afxCanvasA11yContent?: string;
      };
      host.__afxCanvasA11yOutbound = [];
      host.__afxCanvasA11yContent = document.content;
      localStorage.clear();

      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        host.__afxCanvasA11yOutbound?.push(message);

        if (message.type === "afxCanvasList") {
          window.postMessage(
            { type: "afxCanvasLibrary", canvases: [descriptor], selectedId: descriptor.id },
            "*",
          );
          return;
        }
        if (message.type === "afxCanvasSelect") {
          window.postMessage({ type: "afxCanvasDocument", document }, "*");
          return;
        }
        if (message.type === "afxFetchDocContent") {
          const filePath = String(message["filePath"]);
          window.postMessage(
            {
              type: "afxDocContent",
              requestId: message["requestId"],
              filePath,
              content: `# ${filePath.split("/").at(-1) ?? "Document"}\n\nAccessible fixture.`,
              revision: {
                contentRevision: `fixture:${filePath}`,
                diskRevision: `fixture:${filePath}`,
                dirty: false,
              },
            },
            "*",
          );
          return;
        }
        if (message.type === "afxCanvasEdit") {
          const content = String(message["content"]);
          host.__afxCanvasA11yContent = content;
          const revisionToken = `a11y:${String(message["sequence"])}`;
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasEditResult",
                requestId: String(message["requestId"]),
                sessionId: String(message["sessionId"]),
                sequence: Number(message["sequence"]),
                outcome: "success",
                target: message["target"],
                revision: {
                  contentRevision: revisionToken,
                  diskRevision: revisionToken,
                  dirty: false,
                },
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
    { descriptor: PROJECT, document },
  );
}

function snapshot(canvas: JSONCanvas): CanvasDocumentSnapshot {
  return {
    documentId: DOCUMENT_ID,
    descriptor: PROJECT,
    source: PROJECT.source,
    revision: { contentRevision: "a11y:1", diskRevision: "a11y:1", dirty: false },
    content: JSON.stringify(canvas),
  };
}

async function clearOutbound(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = window as typeof window & {
      __afxCanvasA11yOutbound?: Array<Record<string, unknown>>;
    };
    host.__afxCanvasA11yOutbound = [];
  });
}

async function outboundCount(page: Page, type: string): Promise<number> {
  return page.evaluate((messageType) => {
    const host = window as typeof window & {
      __afxCanvasA11yOutbound?: Array<Record<string, unknown>>;
    };
    return (host.__afxCanvasA11yOutbound ?? []).filter((message) => message["type"] === messageType)
      .length;
  }, type);
}

async function hostContent(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const host = window as typeof window & { __afxCanvasA11yContent?: string };
    return host.__afxCanvasA11yContent;
  });
}

async function waitForLatestCanvas(
  page: Page,
  predicate: (canvas: JSONCanvas) => boolean,
): Promise<JSONCanvas> {
  await expect
    .poll(async () => {
      const content = await page.evaluate(() => {
        const host = window as typeof window & {
          __afxCanvasA11yOutbound?: Array<Record<string, unknown>>;
        };
        const edit = (host.__afxCanvasA11yOutbound ?? [])
          .filter((message) => message["type"] === "afxCanvasEdit")
          .at(-1);
        return typeof edit?.["content"] === "string" ? edit["content"] : undefined;
      });
      if (!content) return false;
      try {
        return predicate(JSON.parse(content) as JSONCanvas);
      } catch {
        return false;
      }
    })
    .toBe(true);
  const content = await hostContent(page);
  if (!content) throw new Error("Canvas host did not receive edited content.");
  return JSON.parse(content) as JSONCanvas;
}

async function tabTo(page: Page, target: Locator, limit = 80): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  const active = await page.evaluate(() => document.activeElement?.outerHTML ?? "none");
  throw new Error(
    `Keyboard navigation did not reach the requested Canvas control. Active: ${active}`,
  );
}

async function expectKeyboardFocusIndicator(target: Locator): Promise<void> {
  const indicator = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
    return {
      focusVisible: element.matches(":focus-visible"),
      visible:
        (style.outlineStyle !== "none" && outlineWidth > 0) ||
        (style.boxShadow !== "none" && style.boxShadow.trim().length > 0),
    };
  });
  expect(indicator.focusVisible).toBe(true);
  expect(indicator.visible).toBe(true);
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => ({
    bodyOverflow: document.body.scrollWidth - window.innerWidth,
    rootOverflow: document.documentElement.scrollWidth - window.innerWidth,
    rootHeightOverflow: document.getElementById("root")
      ? document.getElementById("root")!.scrollHeight -
        document.getElementById("root")!.clientHeight
      : 0,
  }));
  expect(Math.max(geometry.bodyOverflow, geometry.rootOverflow)).toBeLessThanOrEqual(1);
  expect(geometry.rootHeightOverflow).toBeLessThanOrEqual(1);
}

async function expectSurfaceInsideViewport(page: Page): Promise<void> {
  const bounds = await page.getByTestId("react-flow-canvas").boundingBox();
  if (!bounds) throw new Error("Canvas surface has no browser geometry.");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Playwright did not expose a viewport size.");
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function allNodesInsideCanvas(page: Page): Promise<boolean> {
  return page.evaluate(() => {
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
  });
}

async function withTouchPage(browser: Browser, run: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    await run(await context.newPage());
  } finally {
    await context.close();
  }
}
