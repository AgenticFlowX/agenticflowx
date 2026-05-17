/**
 * Host-owned next-action rail coverage.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, expect, test } from "@playwright/test";

const LONG_SPEC = "dapi-394-warm-container-app-poc-with-approval-gates-and-long-name";
const TASK_COMMAND = `/afx-sprint task ${LONG_SPEC} convert Refs lines to canonical @see comments`;
const DESIGN_COMMAND = `/afx-sprint design ${LONG_SPEC} add explicit Key Decisions table or N/A note`;
const SPEC_COMMAND = `/afx-sprint spec ${LONG_SPEC} --approve`;
const SCREENSHOT_DIR = resolve(process.cwd(), "../../artifacts/chat/screenshots");

async function fireLongNextScenario(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: "Long next" }).click();
  await page.mouse.click(12, 48);
  await expect(page.getByText("Debug Panel")).toHaveCount(0);
  await expect(page.getByTestId("result-actions-row")).toBeVisible();
}

async function assertLongNextRail(page: Page) {
  const conversation = page.getByLabel("Conversation");
  await expect(conversation.getByText("Review complete for")).toBeVisible();
  await expect(conversation.getByText("Next (ranked):")).toHaveCount(0);
  await expect(conversation.getByText(/^Next:/)).toHaveCount(0);
  await expect(conversation.getByText(/Re-orient/)).toHaveCount(0);
  await expect(conversation.getByTestId("result-actions-row")).toHaveCount(1);
  await expect(conversation.getByTestId("result-action-button")).toHaveCount(3);
  await expect(
    conversation.getByRole("button", {
      name: `Insert Refine Tasks: ${TASK_COMMAND}`,
    }),
  ).toBeVisible();
  await expect(
    conversation.getByRole("button", {
      name: `Insert Refine Design: ${DESIGN_COMMAND}`,
    }),
  ).toBeVisible();
  await expect(
    conversation.getByRole("button", {
      name: `Insert Refine Spec: ${SPEC_COMMAND}`,
    }),
  ).toBeVisible();
}

test("desktop next-action rail handles long commands", async ({ page }) => {
  await fireLongNextScenario(page);
  await assertLongNextRail(page);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "next-actions-desktop.png"),
    fullPage: true,
  });
});

test("narrow next-action rail handles long commands", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fireLongNextScenario(page);
  await assertLongNextRail(page);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "next-actions-narrow.png"),
    fullPage: true,
  });
});
