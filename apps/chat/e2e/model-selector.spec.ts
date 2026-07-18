/**
 * Provider Settings and model selector screenshot checks.
 *
 * @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-4] [FR-6] [NFR-1] [NFR-2]
 * @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] [FR-2] [FR-4] [FR-5]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/chat/screenshots");

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const body = await page.screenshot({
    path: resolve(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
  await testInfo.attach(`${name}.png`, { body, contentType: "image/png" });
  expect(body.length).toBeGreaterThan(10_000);
}

test("captures provider settings and model selector surfaces", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("form", { name: "Compose message" })).toBeVisible();

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Runtimes", exact: true }).click();
  const rpcSwitch = page.getByRole("switch", { name: "Enable Pi RPC" });
  if ((await rpcSwitch.getAttribute("aria-checked")) !== "true") {
    await rpcSwitch.click();
  }
  const externalGuidance = page.getByText(/External Pi uses its own credentials/);
  await expect(externalGuidance).toBeVisible();
  await externalGuidance.scrollIntoViewIfNeeded();
  await page.waitForTimeout(4_200);
  await capture(page, testInfo, "provider-settings-runtimes-pi-login");

  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page.getByText("Anthropic").first()).toBeVisible();
  await page.getByRole("button", { name: "Anthropic — Manage" }).click();
  const methodChooser = page.getByText("Connect with").first();
  await expect(methodChooser).toBeVisible();
  await expect(page.getByText("Sign out of subscription").first()).toBeVisible();
  await methodChooser.scrollIntoViewIfNeeded();
  await capture(page, testInfo, "provider-settings-models-oauth");

  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Both" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });

  await page.getByRole("tab", { name: "Chat" }).click();
  await page.getByRole("button", { name: /Model:/ }).click();
  await expect(page.getByPlaceholder("Search models...")).toBeVisible();
  const modelList = page.locator("[cmdk-list]");
  await expect(modelList).toBeVisible();
  await expect(modelList.getByText("Subscription").first()).toBeVisible();
  await expect(modelList.getByText("API key").first()).toBeVisible();
  await expect(modelList.getByText("External Agents")).toBeVisible();
  await page.waitForTimeout(250);
  await capture(page, testInfo, "model-selector-segmented");

  await page.getByPlaceholder("Search models...").fill("sub");
  await expect(page.getByText("No matching models.")).toHaveCount(0);
  await expect(modelList.getByText("Subscription").first()).toBeVisible();
  await capture(page, testInfo, "model-selector-search-sub");
});
