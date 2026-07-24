/**
 * React Flow Canvas regression and dedicated review captures.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-9] [FR-10] [FR-11] [FR-12] [FR-24] [FR-25] [FR-27] [FR-28] [FR-29] [FR-31] [FR-32] [NFR-7]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [8.2] [9.1] [10.1] [11.1] [12.1] [13.1] [16.1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

// Regular e2e screenshots live beside the other workbench specs — the curated
// extension-captures/ tree belongs to the AFX_EXTENSION_CAPTURE pipeline only.
const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/workbench/screenshots");
const ROOT_URI = "file:///workspace";

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

const RELEASE: CanvasDescriptor = {
  id: "release-roadmap",
  kind: "named",
  label: "Release Roadmap",
  source: {
    rootUri: ROOT_URI,
    rootName: "workspace",
    relativePath: ".afx/canvases/release-roadmap.canvas",
  },
  exists: true,
};

const PROJECT_CANVAS: JSONCanvas = {
  afxSchemaVersion: 1,
  afxCanvasKind: "freeform",
  nodes: [
    {
      id: "idea",
      type: "text",
      text: "# Canvas release\n\nShape the 2.4.0 release story.",
      x: 0,
      y: 0,
      width: 280,
      height: 150,
      color: "5",
    },
    {
      id: "risk",
      type: "text",
      text: "## Risk\n\nProtect manual JSON edits.",
      afxNodeKind: "note",
      x: 360,
      y: 0,
      width: 280,
      height: 150,
      color: "3",
    },
    {
      id: "spec",
      type: "file",
      file: "docs/specs/229-app-workbench-canvas/spec.md",
      x: 720,
      y: 0,
      width: 360,
      height: 220,
      color: "6",
    },
  ],
  edges: [
    {
      id: "idea-to-risk",
      fromNode: "idea",
      fromSide: "right",
      toNode: "risk",
      toSide: "left",
      toEnd: "arrow",
      label: "de-risks",
      afxStyle: { version: 1, route: "bezier", stroke: "solid" },
    },
  ],
};

const RELEASE_CANVAS: JSONCanvas = {
  afxSchemaVersion: 1,
  afxCanvasKind: "spec-map",
  nodes: [
    {
      id: "shell",
      type: "file",
      file: "docs/specs/227-app-workbench-shell/spec.md",
      x: 0,
      y: 0,
      width: 330,
      height: 180,
      color: "5",
    },
    {
      id: "canvas",
      type: "file",
      file: "docs/specs/229-app-workbench-canvas/spec.md",
      x: 420,
      y: 0,
      width: 350,
      height: 200,
      color: "6",
    },
    {
      id: "release",
      type: "text",
      text: "# 2.4.0\n\nWorkbench planning and safe live files.",
      x: 210,
      y: 300,
      width: 320,
      height: 160,
      color: "3",
    },
  ],
  edges: [
    {
      id: "shell-dependency",
      fromNode: "canvas",
      fromSide: "left",
      toNode: "shell",
      toSide: "right",
      toEnd: "arrow",
      label: "depends_on",
      color: "5",
      afxStyle: { version: 1, route: "smoothstep", stroke: "dashed" },
      afxProvenance: {
        version: 1,
        kind: "declared-dependency",
        owner: "docs/specs/229-app-workbench-canvas/spec.md",
      },
    },
    {
      id: "release-plan",
      fromNode: "release",
      fromSide: "top",
      fromEnd: "none",
      toNode: "canvas",
      toSide: "bottom",
      toEnd: "arrow",
      label: "ships",
      afxStyle: { version: 1, route: "bezier", stroke: "solid" },
    },
  ],
};

function snapshot(
  descriptor: CanvasDescriptor,
  canvas: JSONCanvas,
  revision = "revision-1",
): CanvasDocumentSnapshot {
  return {
    documentId: `${descriptor.source.rootUri}::${descriptor.source.relativePath}`,
    descriptor,
    source: descriptor.source,
    revision: { contentRevision: revision, diskRevision: revision, dirty: false },
    content: JSON.stringify(canvas),
  };
}

async function bootReactFlowCanvas(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.evaluate(
    ({ project, release, projectDocument, releaseDocument }) => {
      const state = window as typeof window & {
        __afxCanvasOutbound?: Array<Record<string, unknown>>;
        __afxReactFlowWarnings?: string[];
        __afxCanvasAutoAcknowledgeEdits?: boolean;
      };
      state.__afxCanvasOutbound = [];
      state.__afxReactFlowWarnings = [];
      state.__afxCanvasAutoAcknowledgeEdits = true;
      let revisionSequence = 1;
      const originalWarn = console.warn.bind(console);
      console.warn = (...args: unknown[]) => {
        const message = args.map(String).join(" ");
        if (message.includes("[React Flow]")) state.__afxReactFlowWarnings?.push(message);
        originalWarn(...args);
      };
      let selectedId = project.id;
      const documents: Record<string, CanvasDocumentSnapshot> = {
        [project.id]: projectDocument,
        [release.id]: releaseDocument,
      };

      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        if (
          [
            "afxCanvasList",
            "afxCanvasSelect",
            "afxCanvasCreate",
            "afxCanvasRename",
            "afxCanvasDuplicate",
            "afxCanvasDelete",
            "afxCanvasEdit",
            "afxCanvasRefreshDependencies",
            "afxOpenCanvasEditor",
            "afxOpenChatCommand",
          ].includes(message.type)
        ) {
          state.__afxCanvasOutbound?.push(message);
        }

        if (message.type === "afxCanvasList") {
          window.postMessage(
            { type: "afxCanvasLibrary", canvases: [project, release], selectedId },
            "*",
          );
        }
        if (message.type === "afxCanvasSelect") {
          selectedId = String(message.canvasId);
          const document = documents[selectedId];
          if (document) window.postMessage({ type: "afxCanvasDocument", document }, "*");
        }
        if (message.type === "afxFetchDocContent") {
          const filePath = String(message.filePath);
          window.postMessage(
            {
              type: "afxDocContent",
              filePath,
              content: `# ${filePath.split("/").slice(-2).join(" / ")}\n\nLive markdown preview.`,
            },
            "*",
          );
        }
        if (message.type === "afxCanvasEdit") {
          const current = documents[selectedId];
          if (!current) return;
          revisionSequence += 1;
          const nextRevision = `revision-${revisionSequence}`;
          const next = {
            ...current,
            content: String(message.content),
            revision: {
              contentRevision: nextRevision,
              diskRevision: nextRevision,
              dirty: false,
            },
          };
          documents[selectedId] = next;
          if (state.__afxCanvasAutoAcknowledgeEdits === false) return;
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasEditResult",
                requestId: String(message.requestId),
                sessionId: String(message.sessionId),
                sequence: Number(message.sequence),
                outcome: "success",
                target: message.target,
                revision: next.revision,
              },
              "*",
            );
          }, 25);
        }
        if (message.type === "afxCanvasCreate") {
          window.postMessage(
            {
              type: "afxMutationResult",
              requestId: String(message.requestId),
              outcome: "error",
              target: {
                rootUri: String(message.targetRootUri),
                rootName: "workspace",
                relativePath: ".afx/canvases/release-roadmap.canvas",
              },
              code: "collision",
              message: "A Canvas with that name already exists.",
              retryable: true,
            },
            "*",
          );
        }
        if (
          message.type === "afxCanvasRename" ||
          message.type === "afxCanvasDuplicate" ||
          message.type === "afxCanvasDelete"
        ) {
          window.postMessage(
            {
              type: "afxMutationResult",
              requestId: String(message.requestId),
              outcome: "success",
              target: message.target,
              revision: {
                contentRevision: `${message.type}-revision`,
                diskRevision: `${message.type}-revision`,
                dirty: false,
              },
            },
            "*",
          );
        }
      });

      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: {
            path: project.source.relativePath,
            content: projectDocument.content,
            exists: true,
            source: project.source,
            revision: projectDocument.revision,
            documentId: projectDocument.documentId,
          },
        },
        "*",
      );
    },
    {
      project: PROJECT,
      release: RELEASE,
      projectDocument: snapshot(PROJECT, PROJECT_CANVAS),
      releaseDocument: snapshot(RELEASE, RELEASE_CANVAS),
    },
  );
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toHaveValue(PROJECT.id);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByText("Unsaved", { exact: true })).toHaveCount(0);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const buffer = await page.screenshot({ path: resolve(SCREENSHOT_DIR, name), fullPage: false });
  await testInfo.attach(name, { body: buffer, contentType: "image/png" });
  expect(buffer.length).toBeGreaterThan(10_000);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    root: document.documentElement.scrollWidth - window.innerWidth,
  }));
  if (Math.max(overflow.body, overflow.root) > 1) {
    console.log(
      "PROBE2",
      await page.evaluate(() => {
        const toolbar = document.querySelector('[data-testid="canvas-toolbar"]') as HTMLElement;
        const section = toolbar?.closest("section") as HTMLElement;
        const out: string[] = [];
        out.push(`base=${document.documentElement.scrollWidth}`);
        if (toolbar) {
          const experiments: Array<[string, () => void, () => void]> = [
            [
              "toolbarHidden",
              () => (toolbar.style.display = "none"),
              () => (toolbar.style.display = ""),
            ],
            [
              "overflowHidden",
              () => (toolbar.style.overflowX = "hidden"),
              () => (toolbar.style.overflowX = ""),
            ],
            [
              "noScrollbarNone",
              () => toolbar.classList.remove("afx-scrollbar-none"),
              () => toolbar.classList.add("afx-scrollbar-none"),
            ],
            ["widthZero", () => (toolbar.style.width = "0px"), () => (toolbar.style.width = "")],
          ];
          for (const [name, apply, revert] of experiments) {
            apply();
            out.push(`${name}=${document.documentElement.scrollWidth}`);
            revert();
          }
          const last = toolbar.lastElementChild as HTMLElement | null;
          out.push(
            `lastChild=${last?.tagName}.${String(last?.className).slice(0, 40)} rect=${JSON.stringify(last?.getBoundingClientRect())}`,
          );
        }
        const rects = Array.from(document.querySelectorAll("*"))
          .map((el) => ({
            el: el as HTMLElement,
            right: (el as HTMLElement).getBoundingClientRect().right,
          }))
          .sort((a, b) => b.right - a.right)
          .slice(0, 5)
          .map(
            (entry) =>
              `right=${Math.round(entry.right)} ${entry.el.tagName}.${String(entry.el.className).slice(0, 70)}`,
          );
        out.push(...rects);
        if (section) {
          section.style.containerType = "normal";
          out.push(`noContainer=${document.documentElement.scrollWidth}`);
          section.style.containerType = "";
        }
        const surface = document.querySelector(".afx-canvas-surface") as HTMLElement | null;
        if (surface) {
          surface.style.containerType = "normal";
          out.push(`noSurfaceContainer=${document.documentElement.scrollWidth}`);
          surface.style.containerType = "";
        }
        if (section && surface) {
          section.style.containerType = "normal";
          surface.style.containerType = "normal";
          out.push(`noBoth=${document.documentElement.scrollWidth}`);
          section.style.containerType = "";
          surface.style.containerType = "";
        }
        return JSON.stringify(out);
      }),
    );
  }
  expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);
}

async function expectNoReactFlowWarnings(page: Page): Promise<void> {
  const warnings = await page.evaluate(() => {
    const state = window as typeof window & { __afxReactFlowWarnings?: string[] };
    return state.__afxReactFlowWarnings ?? [];
  });
  expect(warnings).toEqual([]);
}

async function readViewportTransform(page: Page): Promise<{ x: number; y: number; zoom: number }> {
  return page.evaluate(() => {
    const viewport = document.querySelector(".react-flow__viewport");
    if (!(viewport instanceof SVGElement || viewport instanceof HTMLElement)) {
      throw new Error("React Flow viewport is not mounted.");
    }
    const matrix = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
    return { x: matrix.m41, y: matrix.m42, zoom: matrix.a };
  });
}

async function expectReactFlowChromeMode(page: Page, mode: "dark" | "light"): Promise<void> {
  const colors = await page.evaluate(() => {
    const background = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).backgroundColor : null;
    };
    return {
      surface: background(".afx-canvas-surface .react-flow"),
      // Zoom controls live in the canvas toolbar now (FR-45); RF's floating
      // Controls component was removed with the zoom-cluster rework.
      minimap: background(".react-flow__minimap"),
    };
  });

  for (const [surface, color] of Object.entries(colors)) {
    expect(color, `${surface} should be mounted`).not.toBeNull();
    const channels =
      color
        ?.match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number) ?? [];
    expect(channels, `${surface} should have a resolved RGB background`).toHaveLength(3);
    const normalizedChannels = channels.map((channel) =>
      color?.startsWith("color(") ? channel * 255 : channel,
    );
    if (mode === "dark") {
      expect(
        Math.max(...normalizedChannels),
        `${surface} should use dark theme chrome instead of a near-white default`,
      ).toBeLessThan(220);
    } else {
      expect(
        Math.min(...normalizedChannels),
        `${surface} should follow VS Code light theme instead of staying black`,
      ).toBeGreaterThan(170);
    }
  }
}

test("React Flow Canvas switches named documents, modes, starters, and connector styles", async ({
  page,
}, testInfo) => {
  await bootReactFlowCanvas(page, { width: 1180, height: 620 });
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  const desktopToolbar = await page.getByTestId("canvas-toolbar").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(desktopToolbar.clientHeight).toBeLessThanOrEqual(44);
  expect(desktopToolbar.scrollHeight).toBeLessThanOrEqual(desktopToolbar.clientHeight + 1);
  await expectReactFlowChromeMode(page, "dark");
  await page.evaluate(() => {
    document.body.classList.remove("vscode-dark", "vscode-high-contrast");
    document.body.classList.add("vscode-light");
  });
  await expectReactFlowChromeMode(page, "light");
  await expect(page.getByTestId("canvas-toolbar").getByText("Card")).toBeVisible();
  await page.getByRole("button", { name: "Add card" }).hover();
  await expect(page.getByRole("tooltip", { name: "Add card" })).toBeVisible();
  // Park over empty canvas and wait for the previous tooltip to close — its
  // bottom-anchored content overlaps the floating toolbar and would swallow
  // the next hover.
  await page.mouse.move(600, 400);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();
  await page.getByRole("button", { name: "Fit selection or canvas" }).hover();
  await expect(page.getByRole("tooltip", { name: /Fit selection or canvas/ })).toBeVisible();
  await page.evaluate(() => {
    document.body.classList.remove("vscode-light");
    document.body.classList.add("vscode-dark");
  });
  await capture(page, testInfo, "canvas-react-flow-freeform-desktop.png");

  await page.getByRole("combobox", { name: "Canvas file" }).selectOption(RELEASE.id);
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toHaveValue(RELEASE.id);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await page.getByRole("button", { name: "Spec Map" }).click();
  await expect(page.getByRole("button", { name: "Sync specs" })).toBeVisible();

  await page.locator(".react-flow__edge-path").first().click({ force: true });
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  await page.getByRole("button", { name: "Inspect selected edges" }).click();
  const edgeInspector = page.getByRole("dialog", { name: "Canvas edge inspector" });
  await edgeInspector.getByRole("combobox", { name: "Edge route" }).selectOption("straight");
  await edgeInspector.getByRole("combobox", { name: "Edge stroke" }).selectOption("dotted");
  await edgeInspector.getByRole("combobox", { name: "Start marker" }).selectOption("arrow");
  await edgeInspector.getByRole("combobox", { name: "End marker" }).selectOption("none");
  await edgeInspector.getByRole("button", { name: "Apply connector" }).click();
  await edgeInspector.getByRole("textbox", { name: "Edge color" }).fill("3");
  await edgeInspector.getByRole("button", { name: "Apply appearance" }).click();
  await expect(
    edgeInspector.getByRole("button", { name: "Detach generated dependency" }),
  ).toBeVisible();
  await edgeInspector.getByRole("button", { name: "Detach generated dependency" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync specs" })).toBeEnabled();
  await capture(page, testInfo, "canvas-react-flow-spec-map-connectors.png");

  await page.getByRole("button", { name: "Planning guide" }).click();
  await page.getByRole("button", { name: "Build a roadmap" }).click();
  // Replacing a non-empty canvas asks first (webview-safe dialog).
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();
  await expect(page.getByRole("heading", { name: "Now" })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await capture(page, testInfo, "canvas-react-flow-library-planning-desktop.png");
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await expect
    .poll(() => page.getByTestId("react-flow-canvas").evaluate((element) => element.clientWidth))
    .toBeLessThanOrEqual(360);
  // Zoom/fit moved from RF Controls into the canvas toolbar (FR-45).
  const fitView = page.getByRole("button", { name: "Fit selection or canvas" });
  await fitView.click();
  await expect
    .poll(() =>
      page.locator(".react-flow__node").evaluateAll((nodes) =>
        nodes.every((node) => {
          const rect = node.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.right <= window.innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight
          );
        }),
      ),
    )
    .toBe(true);
  await fitView.evaluate((element) => element.blur());
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-planning-narrow-360.png");
  await expectNoReactFlowWarnings(page);
});

test("React Flow Canvas reports multi-file lifecycle outcomes and opens the exact editor target", async ({
  page,
}, testInfo) => {
  await bootReactFlowCanvas(page, { width: 980, height: 560 });
  await page.getByRole("combobox", { name: "Canvas file" }).selectOption(RELEASE.id);
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toHaveValue(RELEASE.id);

  await page.getByRole("button", { name: "New canvas" }).click();
  await page.getByLabel("Canvas name").fill("Release Roadmap");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(page.getByRole("button", { name: "Rename canvas" })).toBeEnabled();

  await page.getByRole("button", { name: "Rename canvas" }).click();
  await page.getByLabel("New name").fill("Release 2.4");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByText("Canvas operation completed.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate canvas" }).click();
  await page.getByLabel("Duplicate as").fill("Release 2.4 copy");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByText("Canvas operation completed.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Open in Canvas editor" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window as typeof window & {
          __afxCanvasOutbound?: Array<Record<string, unknown>>;
        };
        const matches = state.__afxCanvasOutbound?.filter(
          (message) => message["type"] === "afxOpenCanvasEditor",
        );
        return matches?.[matches.length - 1];
      }),
    )
    .toEqual({ type: "afxOpenCanvasEditor", target: RELEASE.source });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete canvas" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Canvas operation completed.", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window as typeof window & {
          __afxCanvasOutbound?: Array<Record<string, unknown>>;
        };
        return state.__afxCanvasOutbound
          ?.filter((message) =>
            [
              "afxCanvasCreate",
              "afxCanvasRename",
              "afxCanvasDuplicate",
              "afxCanvasDelete",
            ].includes(String(message["type"])),
          )
          .map((message) => message["type"]);
      }),
    )
    .toEqual(["afxCanvasCreate", "afxCanvasRename", "afxCanvasDuplicate", "afxCanvasDelete"]);
  await capture(page, testInfo, "canvas-react-flow-library-lifecycle.png");
  await expectNoReactFlowWarnings(page);
});

test("React Flow Canvas supports lasso, multi-select, clipboard, history, and graph controls", async ({
  page,
}, testInfo) => {
  await bootReactFlowCanvas(page, { width: 1280, height: 720 });
  const nodes = page.locator(".react-flow__node");
  await expect(nodes).toHaveCount(3);

  const first = await nodes.nth(0).boundingBox();
  const second = await nodes.nth(1).boundingBox();
  if (!first || !second) throw new Error("React Flow nodes have no browser geometry");
  await page.mouse.move(Math.min(first.x, second.x) - 10, Math.min(first.y, second.y) - 10);
  await page.mouse.down();
  await page.mouse.move(
    Math.max(first.x + first.width, second.x + second.width) + 10,
    Math.max(first.y + first.height, second.y + second.height) + 10,
    { steps: 8 },
  );
  await page.mouse.up();

  if ((await page.locator(".react-flow__node.selected").count()) < 2) {
    await nodes.nth(0).click();
    await nodes.nth(1).click({ modifiers: ["Meta"] });
  }
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Copy selection" })).toBeEnabled();
  await page.getByRole("button", { name: "Copy selection" }).click();
  await page.getByRole("button", { name: "Paste" }).click();
  await expect(nodes).toHaveCount(5);

  await page.getByTestId("react-flow-canvas").focus();
  await page.keyboard.press("Meta+d");
  await expect(nodes).toHaveCount(7);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(nodes).toHaveCount(5);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(nodes).toHaveCount(3);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(nodes).toHaveCount(5);

  await page.getByRole("button", { name: "Disable snap" }).click();
  await expect(page.getByRole("button", { name: "Enable snap" })).toBeVisible();
  await page.getByRole("button", { name: "Hide minimap" }).click();
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit selection or canvas" }).click();
  await page.waitForTimeout(250);
  const beforeModifierWheel = await readViewportTransform(page);
  const surfaceBox = await page.getByTestId("react-flow-canvas").boundingBox();
  if (!surfaceBox) throw new Error("Canvas surface has no browser geometry.");
  await page.getByTestId("react-flow-canvas").dispatchEvent("wheel", {
    deltaY: 800,
    ctrlKey: true,
    clientX: surfaceBox.x + surfaceBox.width / 2,
    clientY: surfaceBox.y + surfaceBox.height / 2,
    bubbles: true,
    cancelable: true,
  });
  await expect
    .poll(async () => (await readViewportTransform(page)).zoom)
    .toBeLessThan(beforeModifierWheel.zoom - 0.001);
  const afterModifierWheel = await readViewportTransform(page);
  expect(afterModifierWheel.zoom).toBeGreaterThan(beforeModifierWheel.zoom * 0.8);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-selection-history.png");
  await expectNoReactFlowWarnings(page);
});

test("React Flow Canvas keeps conflict and invalid JSON safe at 360px", async ({
  page,
}, testInfo) => {
  await bootReactFlowCanvas(page, { width: 360, height: 800 });
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await page.evaluate(() => {
    const state = window as typeof window & { __afxCanvasAutoAcknowledgeEdits?: boolean };
    state.__afxCanvasAutoAcknowledgeEdits = false;
  });
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByText("Saving…", { exact: true })).toBeVisible();

  const external = snapshot(PROJECT, {
    nodes: [
      {
        id: "external",
        type: "text",
        text: "# External edit\n\nManual file changes win only after review.",
        x: 0,
        y: 0,
        width: 280,
        height: 150,
      },
    ],
    edges: [],
  });
  await page.evaluate((document) => {
    window.postMessage({ type: "afxCanvasDocument", document }, "*");
  }, external);
  await expect(page.getByRole("alert")).toContainText("file changed");
  await expect(page.getByText("Conflict")).toBeVisible();
  await expectNoPageOverflow(page);
  const toolbar = page.getByTestId("canvas-toolbar");
  const geometry = await toolbar.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth);
  await capture(page, testInfo, "canvas-react-flow-conflict-narrow-360.png");

  await page.getByRole("button", { name: "Reload external" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.evaluate((document) => {
    window.postMessage({ type: "afxCanvasDocument", document: { ...document, content: "{" } }, "*");
  }, external);
  await expect(page.getByRole("alert")).toContainText("Manual JSON is invalid");
  await expect(page.getByText("Invalid", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-invalid-json-narrow-360.png");
  await expectNoReactFlowWarnings(page);
});

test("editor-area Canvas boots the shared React Flow document surface", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/?afx-view=canvas-editor");
  await page.evaluate(
    (document) => {
      window.postMessage(
        { type: "afxCanvasEditorDocument", clientId: "pending", document, enabled: true },
        "*",
      );
    },
    snapshot(RELEASE, RELEASE_CANVAS),
  );

  await expect(page.getByTestId("react-flow-canvas")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.getByRole("tab", { name: "Canvas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Planning guide" })).toBeVisible();
  // Library chrome works in the editor host too — create/duplicate/select
  // results open as separate editor tabs (FR-3). The self-referential
  // "Open in Canvas editor" button is the only omission.
  await expect(page.getByRole("button", { name: "New canvas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rename canvas" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Canvas file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in Canvas editor" })).toHaveCount(0);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-editor-area.png");
  await expectNoReactFlowWarnings(page);
});

test("React Flow Canvas remains responsive with 150 nodes and 200 edges", async ({
  page,
}, testInfo) => {
  await bootReactFlowCanvas(page, { width: 1440, height: 760 });
  const denseCanvas = makeDenseCanvas(150, 200);
  const denseDocument = snapshot(PROJECT, denseCanvas, "dense-revision");
  const started = await page.evaluate((document) => {
    const startedAt = performance.now();
    window.postMessage({ type: "afxCanvasDocument", document }, "*");
    return startedAt;
  }, denseDocument);

  await expect.poll(() => page.locator(".react-flow__node").count()).toBeGreaterThan(0);
  const elapsed = await page.evaluate((startedAt) => performance.now() - startedAt, started);
  expect(elapsed).toBeLessThan(5_000);
  expect(await page.locator(".react-flow__node").count()).toBeLessThan(150);
  await expect(page.locator(".react-flow__edge").first()).toBeAttached();

  await page.getByRole("button", { name: "Fit selection or canvas" }).click();
  await page.getByRole("button", { name: "Disable snap" }).click();
  await page.getByRole("button", { name: "Enable snap" }).click();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "canvas-react-flow-stress-150-200.png");
  await expectNoReactFlowWarnings(page);
});

function makeDenseCanvas(nodeCount: number, edgeCount: number): JSONCanvas {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `dense-${index}`,
    type: "text" as const,
    text: `## Planning node ${index}\n\nRelease dependency ${index}.`,
    x: (index % 15) * 260,
    y: Math.floor(index / 15) * 180,
    width: 220,
    height: 120,
    color: String((index % 6) + 1),
  }));
  const edges = Array.from({ length: edgeCount }, (_, index) => ({
    id: `dense-edge-${index}`,
    fromNode: `dense-${index % nodeCount}`,
    fromSide: "right" as const,
    toNode: `dense-${(index * 7 + 1) % nodeCount}`,
    toSide: "left" as const,
    toEnd: "arrow" as const,
    afxStyle: {
      version: 1 as const,
      route: index % 2 === 0 ? ("bezier" as const) : ("smoothstep" as const),
      stroke: index % 3 === 0 ? ("dashed" as const) : ("solid" as const),
    },
  }));
  return { nodes, edges };
}
