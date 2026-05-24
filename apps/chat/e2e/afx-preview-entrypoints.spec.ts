/**
 * AFX Preview entry-point e2e coverage for the chat composer panel headers.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-ENTRYPOINTS]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../../artifacts/chat/screenshots");

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<string> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = resolve(SCREENSHOT_DIR, `${name}.png`);
  const screenshot = await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`${name}.png`, { body: screenshot, contentType: "image/png" });
  expect(screenshot.length).toBeGreaterThan(10_000);
  return path;
}

async function fireScenario(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await expect(page.getByText("Debug Panel")).toHaveCount(0);
}

async function openLatestOpenFilePayload(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("tab", { name: "Log" }).click();
  await page.getByRole("button", { name: "Toggle entry chat/openFile" }).last().click();
}

async function selectMode(page: Page, label: "Code" | "Explore" | "Spec"): Promise<void> {
  await page.getByRole("button", { name: "Workspace mode" }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
}

test.describe("AFX Preview composer entry points", () => {
  test("Intent header shows a flat Preview action for markdown active files", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 760, height: 720 });
    await page.goto("/");
    await fireScenario(page, "Markdown file");

    const preview = page.getByRole("button", { name: "Open AFX Preview" });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Preview");
    const intentRegion = page.getByRole("region", { name: /Intent/i });
    await intentRegion.getByRole("button", { name: "Minimize panel" }).click();
    const intentSwitcher = page.getByRole("button", { name: "Switch Intent. Current: Default" });
    await expect(intentSwitcher).toBeVisible();
    const previewBox = await preview.boundingBox();
    const switcherBox = await intentSwitcher.boundingBox();
    expect(previewBox).not.toBeNull();
    expect(switcherBox).not.toBeNull();
    expect(previewBox!.x).toBeLessThan(switcherBox!.x);
    await capture(page, testInfo, "afx-preview-intent-header");

    await preview.click();
    await openLatestOpenFilePayload(page);
    const payload = page.locator("pre").last();
    await expect(payload).toContainText('"path": "/workspace/docs/specs/auth/design.md"');
    await expect(payload).toContainText('"mode": "afxPreview"');
  });

  test("Doc-actions header shows Preview before Switch to Spec", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 760, height: 720 });
    await page.goto("/");
    await selectMode(page, "Spec");
    await fireScenario(page, "Spec actions");

    const docActions = page.locator("#composer-panel-doc-actions").locator("..");
    await expect(docActions.getByRole("button", { name: "Open AFX Preview" })).toBeVisible();
    await capture(page, testInfo, "afx-preview-doc-actions-header");

    await docActions.getByRole("button", { name: "Open AFX Preview" }).click();
    await openLatestOpenFilePayload(page);
    const payload = page.locator("pre").last();
    await expect(payload).toContainText('"path": "/workspace/docs/specs/auth/spec.md"');
    await expect(payload).toContainText('"mode": "afxPreview"');
  });

  test("Doc-actions header keeps flat Preview and Switch to Spec actions", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 760, height: 720 });
    await page.goto("/");
    await fireScenario(page, "Sprint actions");

    const docActions = page.locator("#composer-panel-doc-actions").locator("..");
    await expect(page.getByRole("button", { name: /Switch Intent\. Current:/ })).toBeVisible();
    await expect(docActions.getByRole("button", { name: "Open AFX Preview" })).toBeVisible();
    await expect(docActions.getByRole("button", { name: "Switch to Spec" })).toBeVisible();
    await capture(page, testInfo, "afx-preview-doc-actions-switch");
  });
});
