/**
 * SDD timeline guide screenshot checks.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../../artifacts/chat/screenshots");

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
  // Recommended action advances the lifecycle (spec → design); refine moves to overflow.
  await expect(guide.getByRole("button", { name: /Author design/i })).toBeVisible();
  await expect(guide.getByRole("button", { name: /Preview/i })).toBeVisible();
  await expect(guide.getByRole("button", { name: /Studio/i })).toBeVisible();
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

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "narrow", width: 390, height: 844 },
] as const) {
  test(`SDD guide card is visible and actionable in ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await fireSddGuideScenario(page);
    await assertSddGuide(page);
    await capture(page, testInfo, `sdd-guide-${viewport.name}`);
  });
}
