/**
 * Curated AFX workbench and previewer extension captures for website/docs assets.
 *
 * Renders the real workbench webviews headless with genuine repository documents,
 * captures the release-story surfaces (SDD Studio and Canvas), the AFX previewer
 * (spec/design/tasks), and records a desktop video. All stills
 * are captured at deviceScaleFactor 2 (retina) for crisp website use.
 *
 * Run via `pnpm capture:extension` (see root package.json).
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1]
 */
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import { bootInPreviewMode, postPreview } from "./preview-test-helpers";

const REPO_ROOT = resolve(process.cwd(), "../..");
const CAPTURE_ROOT = resolve(REPO_ROOT, "apps/vscode-e2e/artifacts/extension-captures");
const WORKBENCH_DIR = resolve(CAPTURE_ROOT, "workbench");
const PREVIEWER_DIR = resolve(CAPTURE_ROOT, "previewer");
const VIDEO_DIR = resolve(CAPTURE_ROOT, "video");
const TEMP_DIR = resolve(CAPTURE_ROOT, ".tmp");
const VIDEO_TEMP_DIR = resolve(TEMP_DIR, "workbench-video");

/** Retina scale — website images are displayed at 1x CSS, so 2x keeps them crisp. */
const DSF = 2;
const WORKBENCH_VIEWPORT = { width: 1600, height: 900 } as const;
const PREVIEWER_VIEWPORT = { width: 1600, height: 1000 } as const;
const VIDEO_VIEWPORT = { width: 1920, height: 1080 } as const;

/**
 * Real, public afx-vscode-v2 feature docs — rendered live in the AFX previewer so
 * the website shows genuine specs (not throwaway fixtures). The canvas spec is an
 * as-built, FR-anchored document with the full template structure.
 */
const PREVIEW_DOCS: readonly { readonly id: string; readonly filePath: string }[] = [
  { id: "spec", filePath: "docs/specs/229-app-workbench-canvas/spec.md" },
  { id: "design", filePath: "docs/specs/229-app-workbench-canvas/design.md" },
  { id: "tasks", filePath: "docs/specs/229-app-workbench-canvas/tasks.md" },
];

function loadDoc(filePath: string): string {
  return readFileSync(resolve(REPO_ROOT, filePath), "utf8");
}

/** Release-story tabs reachable from a default boot (Canvas is enabled separately). */
const TAB_CAPTURES: readonly { readonly label: string; readonly file: string }[] = [
  { label: "SDD Studio", file: "workbench-sdd-studio-overview.png" },
];

const ANIMATION_RESET_CSS = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
  }
`;

test("captures every workbench surface", async ({ baseURL, browser }) => {
  resetDir(WORKBENCH_DIR);

  const page = await newPage(browser, WORKBENCH_VIEWPORT);
  try {
    // Curated release tabs. The standalone harness is seeded with real docs so
    // captures never expose the development bridge's placeholder prose.
    for (const { label, file } of TAB_CAPTURES) {
      await openWorkbench(page, baseURL);
      await page.getByRole("tab", { name: label }).click();
      await expect(page.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
      await page.waitForTimeout(200);
      await capture(page, WORKBENCH_DIR, file, WORKBENCH_VIEWPORT);
    }

    // SDD Studio focus + compare view modes.
    await openWorkbench(page, baseURL);
    await expect(page.getByTestId("sdd-studio-cockpit")).toBeVisible();
    await page.getByRole("button", { name: "Focus doc" }).click();
    await expect(page.getByTestId("sdd-studio-focus")).toBeVisible();
    await capture(page, WORKBENCH_DIR, "workbench-sdd-studio-focus.png", WORKBENCH_VIEWPORT);

    await page.getByRole("button", { name: "Compare docs" }).click();
    await expect(page.locator('[data-afx-sdd-studio="compare"]')).toBeVisible();
    await capture(page, WORKBENCH_DIR, "workbench-sdd-studio-compare.png", WORKBENCH_VIEWPORT);

    // Canvas is an opt-in experiment — load a stable, meaningful release map.
    await openWorkbench(page, baseURL);
    await enableCanvas(page);
    await page.getByRole("tab", { name: "Canvas" }).click();
    await expect(page.getByTestId("canvas-surface")).toBeVisible();
    await expect(page.getByRole("heading", { name: "OAuth recovery" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Canvas save status saved" })).toBeVisible();
    await capture(page, WORKBENCH_DIR, "workbench-canvas.png", WORKBENCH_VIEWPORT);
  } finally {
    await page.context().close();
  }
});

test("captures previewer documents", async ({ baseURL, browser }) => {
  resetDir(PREVIEWER_DIR);

  const page = await newPage(browser, PREVIEWER_VIEWPORT);
  try {
    for (const doc of PREVIEW_DOCS) {
      await page.goto(requiredBaseURL(baseURL));
      await bootInPreviewMode(page);
      await page.addStyleTag({ content: ANIMATION_RESET_CSS });
      await postPreview(page, doc.filePath, loadDoc(doc.filePath), true);
      await expect(page.getByText("Quality pulse")).toBeVisible();
      await capture(page, PREVIEWER_DIR, `previewer-${doc.id}.png`, PREVIEWER_VIEWPORT);
    }
  } finally {
    await page.context().close();
  }
});

/**
 * Narrated workbench flow: a visible cursor glides between targets and clicks
 * slowly through the SDD Studio view modes, then opens a live spec in the
 * previewer — paced so a viewer can follow "how it's done".
 */
test("records the workbench → previewer flow as video", async ({ baseURL, browser }) => {
  resetDir(VIDEO_TEMP_DIR);
  mkdirSync(VIDEO_DIR, { recursive: true });

  const page = await newRecordedPage(browser, VIDEO_TEMP_DIR, VIDEO_VIEWPORT);
  const pos = { x: 980, y: 560 };
  try {
    // Land on the SDD Studio cockpit — keep natural animations (no reset).
    await page.goto(requiredBaseURL(baseURL));
    await seedCuratedWorkbench(page);
    await installCursor(page);
    await page.mouse.move(pos.x, pos.y);
    await expect(page.getByTestId("sdd-studio-cockpit")).toBeVisible();
    await page.waitForTimeout(1300);

    // Walk the SDD Studio view modes.
    await clickAt(page, pos, page.getByRole("button", { name: "Focus doc" }));
    await expect(page.getByTestId("sdd-studio-focus")).toBeVisible();
    await page.waitForTimeout(1200);

    await clickAt(page, pos, page.getByRole("button", { name: "Compare docs" }));
    await expect(page.locator('[data-afx-sdd-studio="compare"]')).toBeVisible();
    await page.waitForTimeout(1300);

    // Open a real, live spec in the previewer and dwell on it.
    const specDoc = PREVIEW_DOCS[0];
    await bootInPreviewMode(page);
    await postPreview(page, specDoc.filePath, loadDoc(specDoc.filePath), true);
    await expect(page.getByText("Quality pulse")).toBeVisible();
    await page.waitForTimeout(1100);
    await page.mouse.wheel(0, 360);
    await page.waitForTimeout(1500);
  } finally {
    await saveVideoAndClose(
      page,
      resolve(VIDEO_DIR, "workbench-previewer-extension-flow-1920x1080.webm"),
    );
    rmSync(TEMP_DIR, { force: true, recursive: true });
  }
});

/** A soft glowing cursor that follows Playwright's mouse, drawn into the recording. */
const CURSOR_CSS = `
  .afx-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; width: 26px; height: 26px;
    margin: -13px 0 0 -13px; border-radius: 50%; border: 2px solid rgba(212,166,86,.95);
    background: rgba(212,166,86,.2); box-shadow: 0 2px 10px rgba(20,27,53,.5); pointer-events: none; }
  .afx-cursor::after { content: ""; position: absolute; inset: -10px; border-radius: 50%;
    border: 2px solid rgba(212,166,86,.6); opacity: 0; }
  .afx-cursor.click::after { animation: afx-ring .5s ease-out; }
  @keyframes afx-ring { 0% { opacity: .9; transform: scale(.35); } 100% { opacity: 0; transform: scale(1.4); } }
`;

async function installCursor(page: Page) {
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate(() => {
    if ((window as unknown as { __afxCursor?: boolean }).__afxCursor) {
      return;
    }
    (window as unknown as { __afxCursor?: boolean }).__afxCursor = true;
    const dot = document.createElement("div");
    dot.className = "afx-cursor";
    dot.style.left = "980px";
    dot.style.top = "560px";
    document.body.appendChild(dot);
    window.addEventListener(
      "mousemove",
      (event) => {
        dot.style.left = `${event.clientX}px`;
        dot.style.top = `${event.clientY}px`;
      },
      true,
    );
    window.addEventListener(
      "mousedown",
      () => {
        dot.classList.remove("click");
        void dot.offsetWidth;
        dot.classList.add("click");
      },
      true,
    );
  });
}

/** Glide the cursor to a target over ~0.4s so the movement reads in the video. */
async function glide(
  page: Page,
  pos: { x: number; y: number },
  locator: ReturnType<Page["locator"]>,
  steps = 20,
) {
  const box = await locator.boundingBox();
  if (!box) {
    return;
  }
  const tx = box.x + box.width / 2;
  const ty = box.y + box.height / 2;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(pos.x + (tx - pos.x) * (i / steps), pos.y + (ty - pos.y) * (i / steps));
    await page.waitForTimeout(18);
  }
  pos.x = tx;
  pos.y = ty;
  await page.waitForTimeout(450);
}

async function clickAt(
  page: Page,
  pos: { x: number; y: number },
  locator: ReturnType<Page["locator"]>,
) {
  await glide(page, pos, locator);
  await locator.click();
  await page.waitForTimeout(1000);
}

async function newPage(
  browser: Browser,
  viewport: { readonly width: number; readonly height: number },
): Promise<Page> {
  const context = await browser.newContext({ deviceScaleFactor: DSF, viewport });
  return context.newPage();
}

async function newRecordedPage(
  browser: Browser,
  videoDir: string,
  viewport: { readonly width: number; readonly height: number },
): Promise<Page> {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: viewport },
    viewport,
  });
  return context.newPage();
}

async function openWorkbench(page: Page, baseURL: string | undefined) {
  await page.goto(requiredBaseURL(baseURL));
  await page.addStyleTag({ content: ANIMATION_RESET_CSS });
  await seedCuratedWorkbench(page);
}

/** Seed the standalone harness with current repository docs and consistent proof. */
async function seedCuratedWorkbench(page: Page) {
  const docContents = Object.fromEntries(
    PREVIEW_DOCS.map((doc) => [doc.filePath, loadDoc(doc.filePath)]),
  );
  await page.evaluate(
    ({ docContents }) => {
      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as { filePath?: string; type?: string } | undefined;
        if (message?.type !== "afxFetchDocContent" || !message.filePath) return;
        const content = docContents[message.filePath];
        if (content === undefined) return;
        window.postMessage({ type: "afxDocContent", filePath: message.filePath, content }, "*");
      });

      window.postMessage(
        {
          type: "afxUpdate",
          pipeline: [
            {
              name: "229-app-workbench-canvas",
              specStatus: "Living",
              designStatus: "Living",
              tasksStatus: "Complete",
              completed: 45,
              total: 45,
              featureStatus: "Complete",
              specPath: "docs/specs/229-app-workbench-canvas/spec.md",
              designPath: "docs/specs/229-app-workbench-canvas/design.md",
              tasksPath: "docs/specs/229-app-workbench-canvas/tasks.md",
            },
          ],
          featureTasks: [
            {
              name: "229-app-workbench-canvas",
              tasksPath: "docs/specs/229-app-workbench-canvas/tasks.md",
              completed: 45,
              total: 45,
              phases: [
                { number: 1, name: "Foundations", completed: 14, total: 14, line: 28, items: [] },
                {
                  number: 2,
                  name: "Canvas surface",
                  completed: 13,
                  total: 13,
                  line: 72,
                  items: [],
                },
                {
                  number: 3,
                  name: "Live-node actions",
                  completed: 3,
                  total: 3,
                  line: 114,
                  items: [],
                },
                { number: 4, name: "Verification", completed: 9, total: 9, line: 126, items: [] },
                {
                  number: 5,
                  name: "As-built reconciliation",
                  completed: 6,
                  total: 6,
                  line: 158,
                  items: [],
                },
              ],
              workSessions: [
                {
                  date: "2026-06-03T07:28:52.000Z",
                  task: "1.1-4.3",
                  action: "Coded and verified",
                  filesModified: "apps/workbench/src/views/canvas.tsx",
                  agent: true,
                  human: true,
                },
                {
                  date: "2026-06-04T11:03:56.000Z",
                  task: "5.1-5.3",
                  action: "Graduated and verified",
                  filesModified: "docs/specs/229-app-workbench-canvas/",
                  agent: true,
                  human: true,
                },
              ],
            },
          ],
          documents: [
            {
              type: "SPEC",
              name: "App Workbench Canvas — Product Specification",
              status: "Living",
              owner: "@rix",
              filePath: "docs/specs/229-app-workbench-canvas/spec.md",
              isAfx: true,
              updatedAt: "2026-06-06T11:03:56.000Z",
              excerpt: "A freeform workspace canvas that graduates ideas into the SDD flow.",
            },
            {
              type: "DESIGN",
              name: "App Workbench Canvas — Technical Design",
              status: "Living",
              owner: "@rix",
              filePath: "docs/specs/229-app-workbench-canvas/design.md",
              isAfx: true,
              updatedAt: "2026-06-06T11:03:56.000Z",
              excerpt: "Host, bridge, JSON Canvas, and Workbench interaction design.",
            },
            {
              type: "TASKS",
              name: "App Workbench Canvas — Implementation Tasks",
              status: "Living",
              owner: "@rix",
              filePath: "docs/specs/229-app-workbench-canvas/tasks.md",
              isAfx: true,
              updatedAt: "2026-06-06T11:03:56.000Z",
              excerpt: "All 45 implementation and verification tasks completed.",
            },
          ],
          journal: [],
          kanban: { dirPath: ".afx/kanban", boards: [] },
          notes: [],
          notesRaw: "",
          notesFilePath: ".afx/notes.md",
          ghostTasks: { count: 0, items: [] },
          canvasEnabled: false,
        },
        "*",
      );
    },
    { docContents },
  );
  await expect(page.getByText("App Workbench Canvas").first()).toBeVisible();
}

/** Enable the opt-in Canvas experiment and load a stable release-readiness map. */
async function enableCanvas(page: Page) {
  const content = JSON.stringify({
    nodes: [
      {
        id: "release-group",
        type: "group",
        x: 0,
        y: 0,
        width: 1120,
        height: 600,
        label: "AFX 2.4 release readiness",
        color: "4",
      },
      {
        id: "oauth",
        type: "text",
        x: 40,
        y: 70,
        width: 300,
        height: 180,
        color: "4",
        text: "# OAuth recovery\n\nManaged Pi resolves refreshed credentials; external Pi shows runtime-owned login guidance.",
      },
      {
        id: "proof",
        type: "text",
        x: 410,
        y: 70,
        width: 300,
        height: 180,
        color: "5",
        text: "# Proof gates\n\n- Unit and host tests\n- Real extension-host E2E\n- Curated 2x captures",
      },
      {
        id: "spec",
        type: "file",
        x: 780,
        y: 70,
        width: 300,
        height: 220,
        color: "2",
        file: "docs/specs/229-app-workbench-canvas/spec.md",
        subpath: "#requirements",
      },
      {
        id: "risks",
        type: "text",
        x: 410,
        y: 350,
        width: 300,
        height: 160,
        color: "1",
        text: "# Residual risks\n\nKeep missing layout and credentialed OAuth proof visible until verified.",
      },
    ],
    edges: [
      {
        id: "oauth-proof",
        fromNode: "oauth",
        fromSide: "right",
        toNode: "proof",
        toSide: "left",
        toEnd: "arrow",
        label: "verify",
      },
      {
        id: "proof-spec",
        fromNode: "proof",
        fromSide: "right",
        toNode: "spec",
        toSide: "left",
        toEnd: "arrow",
        label: "trace",
      },
      {
        id: "proof-risks",
        fromNode: "proof",
        fromSide: "bottom",
        toNode: "risks",
        toSide: "top",
        toEnd: "arrow",
        label: "audit",
      },
    ],
  });
  await page.evaluate((content) => {
    window.postMessage(
      {
        type: "afxUpdate",
        canvasEnabled: true,
        canvas: { path: ".afx/project.canvas", exists: true, content },
      },
      "*",
    );
  }, content);
}

/** Fixed-size retina capture — asserts the PNG is viewport * deviceScaleFactor. */
async function capture(
  page: Page,
  dir: string,
  fileName: string,
  viewport: { readonly width: number; readonly height: number },
) {
  mkdirSync(dir, { recursive: true });
  const screenshot = await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: resolve(dir, fileName),
  });
  expect(screenshot.length).toBeGreaterThan(10_000);
  expect(readPngDimensions(screenshot)).toEqual({
    width: viewport.width * DSF,
    height: viewport.height * DSF,
  });
}

async function saveVideoAndClose(page: Page, outputPath: string) {
  const video = page.video();
  await page.context().close();
  if (!video) {
    throw new Error("Expected Playwright video capture to be available.");
  }
  await video.saveAs(outputPath);
  await video.delete();
}

function resetDir(path: string) {
  rmSync(path, { force: true, recursive: true });
  mkdirSync(path, { recursive: true });
}

function requiredBaseURL(baseURL: string | undefined) {
  if (!baseURL) {
    throw new Error("Extension capture requires a Playwright baseURL.");
  }
  return baseURL;
}

function readPngDimensions(data: Buffer) {
  if (data.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Captured file is not a PNG.");
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}
