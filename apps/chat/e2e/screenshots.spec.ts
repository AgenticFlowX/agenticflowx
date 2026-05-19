/**
 * Chat webview screenshot smoke tests for the full verification gate.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../../artifacts/chat/screenshots");

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

test("captures primary chat surfaces", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("form", { name: "Compose message" })).toBeVisible();
  await capture(page, testInfo, "chat-desktop");

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  await capture(page, testInfo, "history-desktop");

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Thinking level")).toBeVisible();
  await capture(page, testInfo, "settings-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Chat" }).click();
  await expect(page.getByRole("textbox", { name: "Chat composer" })).toBeVisible();
  await capture(page, testInfo, "chat-mobile");

  expect(consoleErrors).toEqual([]);
});
