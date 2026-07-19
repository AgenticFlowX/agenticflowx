/**
 * SDD timeline guide screenshot checks.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/chat/screenshots");

async function fireSddGuideScenario(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: "SDD guide" }).click();
  await page.mouse.click(12, 48);
  await expect(page.getByText("Debug Panel")).toHaveCount(0);
  await expect(page.getByTestId("sdd-workflow-guide-card")).toBeVisible();
}

async function assertSddGuide(page: Page) {
  const guide = page.getByTestId("sdd-workflow-guide-card");
  await expect(guide).toContainText("SDD guide");
  await expect(guide).toContainText("checkout-redesign");
  await expect(guide).toContainText("spec.md");
  // The fixture modifies both spec.md and design.md, so the next lifecycle step is tasks.
  await expect(guide.getByRole("button", { name: /Plan tasks/i })).toBeVisible();
  await expect(guide.getByRole("button", { name: /Preview/i })).toBeVisible();
  await expect(guide.getByRole("button", { name: /Studio/i })).toBeVisible();
  await expect(page.getByTestId("result-actions-row")).toHaveCount(0);
  const moreActions = guide.getByRole("button", { name: "More SDD actions" });
  await moreActions.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: /Review.*Run/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Verify.*Run/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: /Review.*Run/i })).toHaveCount(0);
}

async function assertGuideLayout(page: Page, width: number) {
  const guide = page.getByTestId("sdd-workflow-guide-card");
  const toolCard = page.locator('[data-timeline-event="tool"] .afx-surface-card').last();
  const [box, toolBox] = await Promise.all([guide.boundingBox(), toolCard.boundingBox()]);
  expect(box).not.toBeNull();
  expect(toolBox).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 1);
  expect(Math.abs((box?.x ?? 0) - (toolBox?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(
    Math.abs((box?.x ?? 0) + (box?.width ?? 0) - ((toolBox?.x ?? 0) + (toolBox?.width ?? 0))),
  ).toBeLessThanOrEqual(1);
  expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(110);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await expect(guide.getByRole("button", { name: /Plan tasks/i })).toBeVisible();
  await expect(guide.getByRole("button", { name: "More SDD actions" })).toBeVisible();
  if (width >= 480) {
    await expect(guide.getByRole("button", { name: /Preview/i })).toBeVisible();
  }
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshot = await page.screenshot({
    path: resolve(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
  await testInfo.attach(`${name}.png`, {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.length).toBeGreaterThan(10_000);
}

async function openDebugLog(page: Page) {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("tab", { name: "Log" }).click();
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  // Exact sprint layout rows L-01 through L-03.
  { name: "l01-320x720", width: 320, height: 720 },
  { name: "l02-400x760", width: 400, height: 760 },
  { name: "l03-480x820", width: 480, height: 820 },
  { name: "narrow", width: 390, height: 844 },
  { name: "sidebar-656x1104", width: 656, height: 1104 },
] as const) {
  test(`SDD guide card is visible and actionable in ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await fireSddGuideScenario(page);
    await assertSddGuide(page);
    await assertGuideLayout(page, viewport.width);
    await capture(page, testInfo, `sdd-guide-${viewport.name}`);
  });
}

// E2E-20: one assistant turn writes two lifecycle documents. The browser-level
// contract is one consolidated timeline guide and one host Preview request for
// the newest successful SDD document, even though both write_file calls update
// the transcript independently.
test("multiple generated SDD docs produce one guide and one automatic Preview open", async ({
  page,
}) => {
  await fireSddGuideScenario(page);

  const guides = page.getByTestId("sdd-workflow-guide-card");
  await expect(guides).toHaveCount(1);
  const guide = guides.first();
  await expect(
    guide.getByTitle("docs/specs/checkout-redesign/spec.md", { exact: true }),
  ).toBeVisible();
  await expect(
    guide.getByTitle("docs/specs/checkout-redesign/design.md", { exact: true }),
  ).toBeVisible();

  await openDebugLog(page);
  const previewEntries = page.getByRole("button", {
    name: "Toggle entry chat/openFile",
  });
  await expect(previewEntries).toHaveCount(1);
  await previewEntries.first().click();

  const payload = previewEntries.first().locator("..").locator("pre");
  await expect(payload).toContainText('"path": "docs/specs/checkout-redesign/design.md"');
  await expect(payload).toContainText('"mode": "afxPreview"');
});

// E2E-21: a guide dismissal is local to that generated assistant turn. A
// later SDD generation receives a new guide id and recreates the card.
test("dismissed SDD guide stays dismissed until a new generation recreates it", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("afx.chat.dismissedSddGuides.v1"));

  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: "SDD guide" }).click();
  await page.mouse.click(12, 48);
  await expect(page.getByText("Debug Panel")).toHaveCount(0);
  const firstGuide = page.getByTestId("sdd-workflow-guide-card");
  await expect(firstGuide).toBeVisible();
  const firstGuideId = await firstGuide.getAttribute("data-guide-id");
  expect(firstGuideId).toBeTruthy();

  await firstGuide.getByRole("button", { name: "Dismiss SDD guide" }).click();
  await expect(firstGuide).toHaveCount(0);
  const dismissedIds = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("afx.chat.dismissedSddGuides.v1") ?? "[]"),
  );
  expect(dismissedIds).toContain(firstGuideId);

  // The debug scenario sends a new assistant message, so the regenerated card
  // must have a different id and become visible again.
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: "SDD guide" }).click();
  await page.mouse.click(12, 48);
  const regeneratedGuide = page.getByTestId("sdd-workflow-guide-card");
  await expect(regeneratedGuide).toBeVisible();
  await expect(regeneratedGuide).not.toHaveAttribute("data-guide-id", firstGuideId ?? "");
  await capture(page, testInfo, "e2e-21-sdd-guide-recreated");
});
