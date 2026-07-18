/**
 * Curated AFX chat browser-harness captures for website/docs assets.
 *
 * Renders the production chat webview bundle headless with MockTransport fixture
 * data and captures the surfaces the site uses. These are deterministic visual
 * assets, not Electron extension-host or live-provider/OAuth proof. The historic
 * The `capture:extension` command stays stable while output is owned by the
 * VS Code E2E harness.
 * Stills are deviceScaleFactor 2 (retina).
 *
 * Run via `pnpm capture:extension` (see root package.json).
 *
 * @see docs/specs/210-app-chat/spec.md [FR-1]
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/217-app-chat-model-selector/spec.md [FR-1]
 */
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const REPO_ROOT = resolve(process.cwd(), "../..");
const CAPTURE_ROOT = resolve(REPO_ROOT, "apps/vscode-e2e/artifacts/extension-captures");
const CHAT_DIR = resolve(CAPTURE_ROOT, "chat");
const VIDEO_DIR = resolve(CAPTURE_ROOT, "video");
const TEMP_DIR = resolve(CAPTURE_ROOT, ".tmp");
const VIDEO_TEMP_DIR = resolve(TEMP_DIR, "chat-video");

/** Retina scale — website images are displayed at 1x CSS, so 2x keeps them crisp. */
const DSF = 2;
const SCREENSHOT_VIEWPORT = { width: 1600, height: 900 } as const;
const SIDEBAR_VIEWPORT = { width: 656, height: 1104 } as const;
const ROOMY_CHAT_VIEWPORT = { width: 480, height: 820 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const VIDEO_VIEWPORT = { width: 1920, height: 1080 } as const;
const SDD_CAPTURE_VIEWPORTS = [
  { file: "chat-sdd-guide.png", viewport: SCREENSHOT_VIEWPORT },
  { file: "chat-sdd-guide-sidebar-656x1104.png", viewport: SIDEBAR_VIEWPORT },
  // Exact sprint layout row L-03: roomy chat sidebar.
  { file: "chat-sdd-guide-l03-480x820.png", viewport: ROOMY_CHAT_VIEWPORT },
  { file: "chat-sdd-guide-mobile-390x844.png", viewport: MOBILE_VIEWPORT },
] as const;
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

test("captures curated chat browser-mock screenshots", async ({ baseURL, browser }) => {
  resetDir(CHAT_DIR);

  const page = await newPage(browser, SCREENSHOT_VIEWPORT);
  const pageErrors = monitorPageErrors(page);
  try {
    await openChat(page, baseURL);
    await capture(page, "chat-desktop.png", SCREENSHOT_VIEWPORT);

    // Preserve the useful legacy History scenario in the curated release set.
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await capture(page, "chat-history.png", SCREENSHOT_VIEWPORT);
    await page.getByRole("tab", { name: "Chat" }).click();

    // The desktop landing capture is Code mode; capture the distinct read-only mode.
    await selectMode(page, "Explore");
    await capture(page, "chat-mode-explore.png", SCREENSHOT_VIEWPORT);

    // Providers / Fleet — Settings → Models.
    // The animated intent panel can briefly overlap the sticky tab strip after
    // the mode transition. This is an asset harness, so invoke the visible tab's
    // keyboard activation rather than spending the whole capture budget on
    // pointer stability retries that do not add product coverage.
    const settingsTab = page.getByRole("tab", { name: "Settings" });
    await settingsTab.focus();
    await page.keyboard.press("Enter");
    await expect(settingsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Thinking level")).toBeVisible();
    await page.getByRole("button", { name: "Models", exact: true }).click();
    await expect(page.getByText("Hosted API key").first()).toBeVisible();
    await placeBelowStickyHeader(page.locator("#settings-models"));
    await capture(page, "chat-providers.png", SCREENSHOT_VIEWPORT);

    // Settings → Support → Skills & commands.
    await page.getByRole("button", { name: "Support", exact: true }).click();
    const skills = page.getByTestId("settings-skills-disclosure");
    await expect(skills.getByText("Skills & commands")).toBeVisible();
    await expect(page.getByText("2.4.0", { exact: true })).toBeVisible();
    await skills.scrollIntoViewIfNeeded();
    await capture(page, "chat-settings-support.png", SCREENSHOT_VIEWPORT);
    await skills.locator("summary").click();
    await expect
      .poll(() => skills.evaluate((element) => (element as HTMLDetailsElement).open))
      .toBe(true);
    await placeBelowStickyHeader(skills, 252);
    await capture(page, "chat-settings-skills.png", SCREENSHOT_VIEWPORT);

    // Honest combined SDD state: timeline guide + Changed Docs remain visible.
    // Do not dismiss Modified merely to make the release asset look quieter.
    await openChat(page, baseURL);
    await openSddGuideScenario(page);
    for (const { file, viewport } of SDD_CAPTURE_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await frameCombinedSddState(page);
      await capture(page, file, viewport);
    }

    // Spec stepper.
    await page.setViewportSize(SCREENSHOT_VIEWPORT);
    await openChat(page, baseURL);
    await openSpecStepperScenario(page);
    await capture(page, "chat-spec-stepper.png", SCREENSHOT_VIEWPORT);

    expect(pageErrors).toEqual([]);
  } finally {
    await page.context().close();
  }

  // Narrow chat and Spec-stepper treatment at an established mobile viewport.
  const mobilePage = await newPage(browser, MOBILE_VIEWPORT);
  const mobileErrors = monitorPageErrors(mobilePage);
  try {
    await openChat(mobilePage, baseURL);
    await capture(mobilePage, "chat-mobile.png", MOBILE_VIEWPORT);
    await openSpecStepperScenario(mobilePage);
    await expectHorizontallyContained(mobilePage, mobilePage.getByTestId("spec-stepper"));
    await capture(mobilePage, "chat-spec-stepper-mobile-390x844.png", MOBILE_VIEWPORT);
    expect(mobileErrors).toEqual([]);
  } finally {
    await mobilePage.context().close();
  }

  // Realistic narrow Settings proof for the new providers, Pi runtime ownership,
  // and Skills surfaces. The content is fixture-backed and intentionally named
  // as browser/mock evidence by this test, not credentialed runtime proof.
  const settingsPage = await newPage(browser, ROOMY_CHAT_VIEWPORT);
  const settingsErrors = monitorPageErrors(settingsPage);
  try {
    await openChat(settingsPage, baseURL);
    await openSettings(settingsPage);

    await settingsPage.getByRole("button", { name: "Models", exact: true }).click();
    await expect(settingsPage.getByText("Hosted API key").first()).toBeVisible();
    await placeBelowStickyHeader(settingsPage.locator("#settings-models"), 112);
    await expectHorizontallyContained(settingsPage, settingsPage.locator("#settings-models"));
    await capture(settingsPage, "chat-providers-l03-480x820.png", ROOMY_CHAT_VIEWPORT);

    await settingsPage.getByRole("button", { name: "Runtimes", exact: true }).click();
    const rpcSwitch = settingsPage.getByRole("switch", { name: "Enable Pi RPC" });
    if ((await rpcSwitch.getAttribute("aria-checked")) !== "true") {
      await rpcSwitch.click();
    }
    await expect(rpcSwitch).toHaveAttribute("aria-checked", "true");
    const piCardTitle = settingsPage.getByText("Pi RPC (subprocess)", { exact: true });
    await expect(piCardTitle).toBeVisible();
    const piOwnership = settingsPage.getByText(
      /External Pi uses its own credentials|Pi owns provider credentials/,
    );
    await expect(piOwnership.first()).toBeVisible();
    await placeBelowStickyHeader(piCardTitle, 196);
    await expectHorizontallyContained(settingsPage, piCardTitle);
    await expectHorizontallyContained(settingsPage, piOwnership.first());
    await capture(settingsPage, "chat-settings-pi-runtime-l03-480x820.png", ROOMY_CHAT_VIEWPORT);
    const dismissToast = settingsPage.getByRole("button", { name: "Dismiss notification" });
    if (await dismissToast.isVisible()) await dismissToast.click();

    await settingsPage.getByRole("button", { name: "Support", exact: true }).click();
    const narrowSkills = settingsPage.getByTestId("settings-skills-disclosure");
    await expect(narrowSkills.getByText("Skills & commands")).toBeVisible();
    await narrowSkills.locator("summary").click();
    await expect
      .poll(() => narrowSkills.evaluate((element) => (element as HTMLDetailsElement).open))
      .toBe(true);
    await placeBelowStickyHeader(narrowSkills, 190);
    await expectHorizontallyContained(settingsPage, narrowSkills);
    await capture(settingsPage, "chat-settings-skills-l03-480x820.png", ROOMY_CHAT_VIEWPORT);

    // External packs are discovered by Pi and remain outside the bundled AFX
    // resource root. Capture the fail-closed workspace trust state separately
    // so release review can verify provenance and disabled actions together.
    await openChat(settingsPage, baseURL);
    await settingsPage.getByRole("button", { name: "Toggle Debug Panel" }).click();
    await settingsPage.getByRole("button", { name: "Trust blocked" }).click();
    await settingsPage.mouse.click(12, 48);
    await expect(settingsPage.getByText("Debug Panel")).toHaveCount(0);
    await openSettings(settingsPage);
    await settingsPage.getByRole("button", { name: "Support", exact: true }).click();
    const externalSkills = settingsPage.getByTestId("settings-skills-disclosure");
    await expect(externalSkills).toHaveAttribute("open", "");
    await expect(
      externalSkills.getByText(
        "Read-only: workspace skill commands are blocked until this workspace is trusted.",
      ),
    ).toBeVisible();
    await expect(
      externalSkills.getByRole("button", { name: /\/afx-qa-methodology/ }),
    ).toBeDisabled();
    await placeBelowStickyHeader(externalSkills.getByText("Project trust"), 190);
    await capture(
      settingsPage,
      "chat-settings-external-skills-trust-l03-480x820.png",
      ROOMY_CHAT_VIEWPORT,
    );
    expect(settingsErrors).toEqual([]);
  } finally {
    await settingsPage.context().close();
  }

  // Preserve the legacy light-host story across Chat, History, and Settings.
  const lightPage = await newPage(browser, SCREENSHOT_VIEWPORT);
  const lightErrors = monitorPageErrors(lightPage);
  try {
    await openChat(lightPage, baseURL);
    await applySimulatedLightHost(lightPage);
    await capture(lightPage, "chat-light.png", SCREENSHOT_VIEWPORT);

    await lightPage.getByRole("tab", { name: "History" }).click();
    await expect(lightPage.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await capture(lightPage, "chat-history-light.png", SCREENSHOT_VIEWPORT);

    await lightPage.getByRole("tab", { name: "Settings" }).click();
    await expect(lightPage.getByText("Thinking level")).toBeVisible();
    await capture(lightPage, "chat-settings-light.png", SCREENSHOT_VIEWPORT);
    expect(lightErrors).toEqual([]);
  } finally {
    await lightPage.context().close();
  }
});

/**
 * Narrated chat flow: a visible cursor glides between targets and clicks slowly,
 * the app's own animations are kept, and each step pauses so a viewer can follow
 * "how it's done" — chat → pick a model → switch to Spec mode → the stepper.
 */
test("records the chat browser-mock walkthrough as video", async ({ baseURL, browser }) => {
  resetDir(VIDEO_TEMP_DIR);
  mkdirSync(VIDEO_DIR, { recursive: true });

  const page = await newRecordedPage(browser, VIDEO_TEMP_DIR, VIDEO_VIEWPORT);
  const pos = { x: 980, y: 560 };
  try {
    // Land in chat — keep natural animations for a lively recording (no reset).
    await page.goto(requiredBaseURL(baseURL));
    await waitForChatReady(page);
    await installCursor(page);
    await page.mouse.move(pos.x, pos.y);
    await page.waitForTimeout(1200);

    // 1. Pick a model.
    await clickAt(page, pos, page.getByRole("button", { name: /Model:/ }));
    await expect(page.getByPlaceholder("Search models...")).toBeVisible();
    await page.waitForTimeout(1200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);

    // 2. Switch the workspace to Spec mode.
    await clickAt(page, pos, page.getByRole("button", { name: "Workspace mode" }));
    await clickAt(page, pos, page.getByRole("menuitemradio", { name: /Spec/ }));
    await page.waitForTimeout(1200);

    // 3. Reveal the spec stepper and dwell on it.
    await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
    await clickAt(page, pos, page.getByRole("button", { name: "Spec actions" }));
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("spec-stepper")).toBeVisible();
    await glide(page, pos, page.getByTestId("spec-stepper"));
    await page.waitForTimeout(1600);
  } finally {
    await saveVideoAndClose(page, resolve(VIDEO_DIR, "chat-extension-flow-1920x1080.webm"));
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

async function openChat(page: Page, baseURL: string | undefined) {
  await page.goto(requiredBaseURL(baseURL));
  await page.addStyleTag({ content: ANIMATION_RESET_CSS });
  await waitForChatReady(page);
}

async function waitForChatReady(page: Page) {
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("form", { name: "Compose message" })).toBeVisible();
}

function monitorPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function openSettings(page: Page) {
  const settingsTab = page.getByRole("tab", { name: "Settings" });
  await settingsTab.focus();
  await page.keyboard.press("Enter");
  await expect(settingsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Thinking level")).toBeVisible();
}

async function openSddGuideScenario(page: Page) {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: "SDD guide" }).click();
  await page.mouse.click(12, 48);
  await expect(
    page.getByText("Created the first SDD files for checkout-redesign.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
  await expect(page.getByText(/Next:1\./)).toHaveCount(0);
}

async function frameCombinedSddState(page: Page) {
  const guide = page.getByTestId("sdd-workflow-guide-card");
  const changedDocs = page.getByTestId("sdd-modified-guide");
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("button", { name: /Plan tasks/i })).toBeVisible();
  await expect(changedDocs).toBeVisible();
  await expect(changedDocs).toContainText("2 changed docs");
  await expect(page.getByRole("button", { name: "Dismiss Modified" })).toBeVisible();

  await guide.scrollIntoViewIfNeeded();
  await expectHorizontallyContained(page, guide);
  await expectHorizontallyContained(page, changedDocs);
}

async function openSpecStepperScenario(page: Page) {
  await selectMode(page, "Spec");
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Spec actions" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("spec-stepper")).toBeVisible();
}

async function selectMode(page: Page, label: "Code" | "Explore" | "Spec"): Promise<void> {
  await page.getByRole("button", { name: "Workspace mode" }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
  await page.keyboard.press("Escape");
  await page.mouse.move(8, 8);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

async function placeBelowStickyHeader(
  locator: ReturnType<Page["locator"]>,
  targetTop = 132,
): Promise<void> {
  await locator.evaluate((element, requestedTop) => {
    element.scrollIntoView({ block: "start" });
    const delta = element.getBoundingClientRect().top - requestedTop;
    let scroller: HTMLElement | null = element.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }
    if (scroller) {
      scroller.scrollTop += delta;
    } else {
      window.scrollBy(0, delta);
    }
  }, targetTop);
}

async function applySimulatedLightHost(page: Page) {
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty("--vscode-sideBar-background", "#f3f3f3");
    root.setProperty("--vscode-editor-foreground", "#1f1f1f");
    root.setProperty("--vscode-editorWidget-background", "#fbfbfb");
    root.setProperty("--vscode-editorGroupHeader-tabsBackground", "#ededed");
    root.setProperty("--vscode-descriptionForeground", "#707070");
    root.setProperty("--vscode-editor-background", "#ffffff");
    root.setProperty("--vscode-list-hoverBackground", "#e7e7e7");
    root.setProperty("--vscode-panel-border", "#d5d5d5");
    root.setProperty("--vscode-input-background", "#ffffff");
    root.setProperty("--vscode-input-border", "#d0d0d0");
    root.setProperty("--vscode-focusBorder", "#b9872a");
    document.body.classList.remove("vscode-dark", "vscode-high-contrast");
    document.body.classList.add("theme-meridian", "style-lyra", "vscode-light");
  });
  await expect(page.locator("body")).toHaveClass(/vscode-light/);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.body.scrollWidth - window.innerWidth,
      document.documentElement.scrollWidth - window.innerWidth,
    ),
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectHorizontallyContained(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Expected a fixed viewport for curated capture assertions.");
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

/** Fixed-size retina capture — asserts the PNG is viewport * deviceScaleFactor. */
async function capture(
  page: Page,
  fileName: string,
  viewport: { readonly width: number; readonly height: number },
) {
  await expectNoPageOverflow(page);
  mkdirSync(CHAT_DIR, { recursive: true });
  // The scenario launcher is a DEV-only MockTransport control, not extension
  // chrome. Keep it available between scenarios but out of release stills.
  const debugToggle = page.getByRole("button", { name: "Toggle Debug Panel" });
  const hideDebugToggle = await debugToggle.isVisible().catch(() => false);
  if (hideDebugToggle) {
    await debugToggle.evaluate((element) => {
      (element as HTMLElement).style.opacity = "0";
      (element as HTMLElement).style.pointerEvents = "none";
    });
  }
  const screenshot = await page
    .screenshot({
      animations: "disabled",
      fullPage: false,
      path: resolve(CHAT_DIR, fileName),
    })
    .finally(async () => {
      if (hideDebugToggle) {
        await debugToggle.evaluate((element) => {
          (element as HTMLElement).style.opacity = "";
          (element as HTMLElement).style.pointerEvents = "";
        });
      }
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
