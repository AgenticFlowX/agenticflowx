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

async function selectMode(page: Page, label: "Code" | "Explore" | "Spec"): Promise<void> {
  await page.getByRole("button", { name: "Workspace mode" }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
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

test("captures primary chat surfaces", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("form", { name: "Compose message" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Workflow: Open" })).toBeVisible();
  await capture(page, testInfo, "chat-desktop");
  await capture(page, testInfo, "chat-code-action-tiles");

  await page.getByRole("button", { name: "Ask Intent" }).click();
  await page.getByRole("button", { name: "Preview injected prompt for Ask" }).click();
  await expect(page.getByText(/Mode: Ask/)).toBeVisible();
  await page.waitForTimeout(150);
  await capture(page, testInfo, "intent-code-ask-preview");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Architect Intent" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Short intent guidance - about 30 tokens");
  await capture(page, testInfo, "intent-code-tooltip");
  await page.mouse.move(10, 10);

  await page.getByRole("button", { name: "Code Intent" }).click();
  await selectMode(page, "Explore");
  await expect(page.getByRole("button", { name: "PRD Intent" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  await capture(page, testInfo, "intent-explore-prd");
  await selectMode(page, "Code");
  await page.getByRole("button", { name: "Default Intent" }).click();

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
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(page.getByRole("textbox", { name: "Chat composer" })).toBeVisible();
  await capture(page, testInfo, "chat-mobile");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Sprint actions" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/Sprint file detected|AFX file detected/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch to Spec" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Switch Intent\. Current:/ })).toBeVisible();
  await page.getByRole("button", { name: /Switch Intent\. Current:/ }).click();
  await expect(page.getByRole("menuitemradio", { name: /Architect/ })).toBeVisible();
  await capture(page, testInfo, "intent-doc-actions-switcher-menu");
  await page.getByRole("menuitemradio", { name: /Architect/ }).click();
  await expect(
    page.getByRole("button", { name: "Switch Intent. Current: Architect" }),
  ).toBeVisible();
  await capture(page, testInfo, "intent-doc-actions-compact-switcher");

  await page.goto("/");
  await selectMode(page, "Spec");
  await expect(page.getByTestId("intent-strip")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Workbench/i })).toBeVisible();
  await capture(page, testInfo, "chat-workbench-promo");
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Spec actions" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Debug Panel")).toHaveCount(0);
  await expect(page.getByTestId("spec-stepper")).toBeVisible();
  await capture(page, testInfo, "spec-doc-actions-stepper");
  await capture(page, testInfo, "spec-stepper-active-doc");

  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Clear doc" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await expect(page.getByTestId("spec-stepper")).toHaveCount(0);
  await capture(page, testInfo, "spec-stepper-cleared-context");

  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Preview doc" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await expect(page.getByTestId("spec-stepper")).toBeVisible();
  await capture(page, testInfo, "spec-stepper-preview-preserved");

  expect(consoleErrors).toEqual([]);
});
