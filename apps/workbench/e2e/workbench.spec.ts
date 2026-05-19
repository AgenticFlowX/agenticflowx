/**
 * Workbench webview smoke + screenshot tests.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const TAB_LABELS = ["Workbench", "Pipeline", "Documents", "Analytics", "Journal", "Board", "Notes"];
const SCREENSHOT_DIR = resolve(process.cwd(), "../../artifacts/workbench/screenshots");

test("workbench root mounts", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
});

test("renders all 7 tabs", async ({ page }) => {
  await page.goto("/");
  for (const label of TAB_LABELS) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }
});

test("Workbench tab is selected by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Workbench" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("can switch tabs and capture screenshot of each view", async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  for (const label of TAB_LABELS) {
    await page.getByRole("tab", { name: label }).click();
    await expect(page.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(200);
    const screenshotPath = resolve(SCREENSHOT_DIR, `workbench-${label.toLowerCase()}.png`);
    const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
    expect(buf.length).toBeGreaterThan(10_000);
    await testInfo.attach(`workbench-${label.toLowerCase()}.png`, {
      body: buf,
      contentType: "image/png",
    });
  }
});

test("notes tab can capture a draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Notes" }).click();
  const textarea = page.getByLabel("New note");
  await expect(textarea).toBeVisible();
  await textarea.fill("hello world");
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("notes splitter remains draggable in compact viewport", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 360 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Notes" }).click();

  const notesPanel = page.getByRole("tabpanel", { name: "Notes" });
  const capturePane = notesPanel.locator("aside").first();
  const separator = notesPanel.getByRole("separator").first();
  const textarea = notesPanel.getByLabel("New note");

  await expect(separator).toBeVisible();
  await expect(textarea).toBeVisible();

  const before = await capturePane.evaluate((el) => el.getBoundingClientRect().width);
  const handleBox = await separator.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2);
  await page.mouse.up();

  const expanded = await capturePane.evaluate((el) => el.getBoundingClientRect().width);
  expect(expanded).toBeGreaterThan(before + 40);

  await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2);
  await page.mouse.up();

  const shrunk = await capturePane.evaluate((el) => el.getBoundingClientRect().width);
  expect(shrunk).toBeLessThan(expanded - 30);
});

test("workbench keeps a default feature selected after refresh updates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Workbench" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("15-infrastructure").first()).toBeVisible();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "afxUpdate",
        pipeline: [
          {
            name: "replacement-feature",
            specStatus: "Draft",
            designStatus: "Draft",
            tasksStatus: "Not Started",
            completed: 0,
            total: 1,
            featureStatus: "Draft",
            specPath: "docs/replacement/spec.md",
          },
        ],
        featureTasks: [],
      },
      "*",
    );
  });
  await expect(page.getByText("replacement-feature").first()).toBeVisible();
  await expect(page.getByText("No columns visible")).toHaveCount(0);
});

test("board supports horizontal overflow for wide boards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Board" }).click();
  const container = page.getByTestId("board-scroll-container");
  await expect(container).toBeVisible();
  await expect
    .poll(async () =>
      container.evaluate((node) => Math.max(0, node.scrollWidth - node.clientWidth)),
    )
    .toBeGreaterThan(0);
});

for (const mode of ["light", "dark"] as const) {
  test(`mock workbench visual smoke in ${mode} theme`, async ({ page }, testInfo) => {
    await page.goto("/");
    await page.evaluate((themeMode) => {
      document.body.classList.remove("vscode-light", "vscode-dark");
      document.body.classList.add(themeMode === "dark" ? "vscode-dark" : "vscode-light");
      document.body.classList.add("theme-meridian", "style-mira");
    }, mode);

    for (const label of ["Workbench", "Pipeline", "Board", "Documents"]) {
      await page.getByRole("tab", { name: label }).click();
      await page.waitForTimeout(150);
      const buf = await page.screenshot({ fullPage: false });
      await testInfo.attach(`${mode}-${label.toLowerCase()}.png`, {
        body: buf,
        contentType: "image/png",
      });
    }

    await page.getByRole("tab", { name: "Pipeline" }).click();
    const card = page.locator("[data-slot='card']").first();
    await expect(card).toBeVisible();
    const contrastProbe = await card.evaluate((node) => {
      const cardStyle = getComputedStyle(node);
      const bodyStyle = getComputedStyle(document.body);
      return {
        cardBg: cardStyle.backgroundColor,
        bodyBg: bodyStyle.backgroundColor,
        boxShadow: cardStyle.boxShadow,
      };
    });
    expect(contrastProbe.cardBg).not.toBe(contrastProbe.bodyBg);
    expect(contrastProbe.boxShadow).not.toBe("none");
  });
}
