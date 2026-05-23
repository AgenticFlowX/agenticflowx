/**
 * Standalone AFX Preview boot-mode webview smoke + screenshot tests.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-15]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-PREVIEW-MODE]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  AFX_PREVIEW_FIXTURES,
  GENERIC_PREVIEW_FIXTURES,
  type PreviewFixture,
} from "../src/lib/preview-fixtures.test-data";

const SCREENSHOT_DIR = resolve(process.cwd(), "../../artifacts/workbench/screenshots");

const AFX_SPEC_PATH = "docs/specs/user-auth/spec.md";
const AFX_SPEC_CONTENT = `---
afx: true
type: SPEC
status: Draft
owner: "@rix"
---
# User Authentication
## Overview
Body text rendered through the standalone AFX preview engine.
## Goals
- Reuse the DocumentStudio engine in the editor area.
`;

const GENERIC_PATH = "README.md";
const GENERIC_CONTENT = `# My Project
Some intro text rendered nicely in the generic preview.
`;

async function bootInPreviewMode(page: import("@playwright/test").Page) {
  await page.goto("/?afx-view=preview");
  await expect(page.locator("#root")).toBeVisible();
}

async function postPreview(
  page: import("@playwright/test").Page,
  filePath: string,
  content: string,
  isAfxHint: boolean,
) {
  await page.evaluate(
    ({ filePath, content, isAfxHint }) => {
      window.postMessage({ type: "afxPreviewShow", filePath, content, isAfxHint }, "*");
    },
    { filePath, content, isAfxHint },
  );
}

async function expectRequiredText(page: import("@playwright/test").Page, fixture: PreviewFixture) {
  for (const text of fixture.requiredText) {
    expect(await page.getByText(text, { exact: false }).count()).toBeGreaterThan(0);
  }
}

async function expectNoPageOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.body.scrollWidth - window.innerWidth,
      document.documentElement.scrollWidth - window.innerWidth,
    ),
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function scrollMainPreviewToBottom(page: import("@playwright/test").Page) {
  const viewport = page.locator(
    '[data-afx-preview-scroll="content"] [data-slot="scroll-area-viewport"]',
  );
  await viewport.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
}

async function attachFixtureScreenshot(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  name: string,
) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = resolve(SCREENSHOT_DIR, `${name}.png`);
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach(`${name}.png`, { body: buf, contentType: "image/png" });
  expect(buf.length).toBeGreaterThan(10_000);
}

// Serialized so fixture screenshots and localStorage-backed reading prefs stay
// deterministic within this preview-focused file.
test.describe.serial("standalone AFX preview boot mode", () => {
  test("renders the full AFX DocumentStudio", async ({ page }, testInfo) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await bootInPreviewMode(page);

    await postPreview(page, AFX_SPEC_PATH, AFX_SPEC_CONTENT, true);

    await expect(page.getByText("Quality pulse")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "User Authentication" }),
    ).toBeVisible();

    const screenshotPath = resolve(SCREENSHOT_DIR, "preview-full-afx.png");
    const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
    await testInfo.attach("preview-full-afx.png", { body: buf, contentType: "image/png" });
    expect(buf.length).toBeGreaterThan(10_000);
  });

  test("degrades to MinimalMarkdown for generic markdown", async ({ page }, testInfo) => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await bootInPreviewMode(page);

    await postPreview(page, GENERIC_PATH, GENERIC_CONTENT, false);

    await expect(page.getByRole("heading", { level: 1, name: "My Project" })).toBeVisible();
    await expect(page.getByText("Quality pulse")).toHaveCount(0);

    const screenshotPath = resolve(SCREENSHOT_DIR, "preview-generic-markdown.png");
    const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
    await testInfo.attach("preview-generic-markdown.png", { body: buf, contentType: "image/png" });
    expect(buf.length).toBeGreaterThan(10_000);
  });

  for (const fixture of AFX_PREVIEW_FIXTURES) {
    test(`renders sanitized full AFX fixture: ${fixture.id}`, async ({ page }, testInfo) => {
      await bootInPreviewMode(page);

      await postPreview(page, fixture.filePath, fixture.content, fixture.isAfxHint);

      await expect(page.getByText("Quality pulse")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: fixture.title })).toBeVisible();
      await expectRequiredText(page, fixture);
      if (fixture.tableCell) {
        await expect(page.getByRole("cell", { name: fixture.tableCell }).first()).toBeVisible();
      }
      if (fixture.rawTextAbsent) {
        await expect(page.getByText(fixture.rawTextAbsent)).toHaveCount(0);
      }
      await expectNoPageOverflow(page);

      await scrollMainPreviewToBottom(page);
      await expect(page.getByText(fixture.finalText, { exact: false }).first()).toBeVisible();
      if (fixture.checkboxLabel) {
        await expect(page.getByRole("checkbox", { name: fixture.checkboxLabel })).toBeInViewport();
      }
      await expectNoPageOverflow(page);
      await attachFixtureScreenshot(page, testInfo, `preview-afx-${fixture.id}`);
    });
  }

  for (const fixture of GENERIC_PREVIEW_FIXTURES) {
    test(`renders sanitized generic markdown fixture: ${fixture.id}`, async ({
      page,
    }, testInfo) => {
      await bootInPreviewMode(page);

      await postPreview(page, fixture.filePath, fixture.content, fixture.isAfxHint);

      await expect(page.getByRole("heading", { level: 1, name: fixture.title })).toBeVisible();
      await expect(page.getByText("Quality pulse")).toHaveCount(0);
      await expectRequiredText(page, fixture);
      if (fixture.tableCell) {
        await expect(page.getByRole("cell", { name: fixture.tableCell }).first()).toBeVisible();
      }
      await expectNoPageOverflow(page);

      await scrollMainPreviewToBottom(page);
      await expect(page.getByText(fixture.finalText, { exact: false }).first()).toBeVisible();
      await expectNoPageOverflow(page);
      await attachFixtureScreenshot(page, testInfo, `preview-generic-${fixture.id}`);
    });
  }

  test("keeps the large sprint preview contained in compact bottom-panel dimensions", async ({
    page,
  }, testInfo) => {
    const sprint = AFX_PREVIEW_FIXTURES.find((fixture) => fixture.id === "sprint");
    if (!sprint) throw new Error("Expected sprint preview fixture.");

    await page.setViewportSize({ width: 760, height: 420 });
    await bootInPreviewMode(page);

    await postPreview(page, sprint.filePath, sprint.content, sprint.isAfxHint);

    await expect(page.getByRole("heading", { level: 1, name: sprint.title })).toBeVisible();
    await expect(page.locator('[data-afx-preview-outline="rail"]')).toBeHidden();
    await expect(page.locator('[data-afx-preview-outline="popover"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Open outline" }).click();
    await expect(page.locator('[data-afx-preview-outline="popover"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-afx-preview-outline="popover"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Code 2.1: Exercise full sprint preview" }),
    ).toBeVisible();
    await expectNoPageOverflow(page);

    await scrollMainPreviewToBottom(page);
    await expect(page.getByText(sprint.finalText, { exact: false }).first()).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Toggle human signoff row 1" }),
    ).toBeInViewport();
    await expectNoPageOverflow(page);
    await attachFixtureScreenshot(page, testInfo, "preview-afx-sprint-compact");
  });

  test("keeps the minimized outline popover scrollable for long documents", async ({ page }) => {
    const longOutline = Array.from(
      { length: 48 },
      (_, index) => `## ${index + 1}. Generated Outline Section\n\nReadable body ${index + 1}.`,
    ).join("\n\n");
    const content = `---
afx: true
type: SPEC
status: Draft
owner: "@fixture"
---

# Long Outline Fixture

${longOutline}
`;

    await page.setViewportSize({ width: 640, height: 520 });
    await bootInPreviewMode(page);

    await postPreview(page, "docs/specs/999-long-outline/spec.md", content, true);

    await page.getByRole("button", { name: "Open outline" }).click();
    await expect(page.locator('[data-afx-preview-outline="popover"]')).toBeVisible();

    const outlineViewport = page.locator('[data-afx-preview-outline-scroll="popover"]');
    await expect(outlineViewport).toBeVisible();

    const before = await outlineViewport.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    }));
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await outlineViewport.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    const after = await outlineViewport.evaluate((node) => node.scrollTop);
    expect(after).toBeGreaterThan(before.scrollTop);
  });

  test("collapses crowded phase and task commands into overflow menus", async ({ page }) => {
    const content = `---
afx: true
type: TASKS
status: Living
owner: "@fixture"
---

# Crowded Command Tasks

## Phase 0: Foundation

### 0.1 Prepare command model

- [ ] Map command affordances to the preview toolbar.

### 0.2 Render overflow affordance

- [ ] Keep compact rows inside the preview pane.

## Phase 1: Interaction

### 1.1 Wire menu actions

- [ ] Route hidden commands through the same chat bridge.

### 1.2 Verify compact controls

- [ ] Confirm that task buttons do not spill outside the toolbar.

## Phase 2: Rollout

### 2.1 Validate preview parity

- [ ] Compare preview commands with spec mode.
`;

    await page.setViewportSize({ width: 760, height: 420 });
    await bootInPreviewMode(page);

    await postPreview(page, "docs/specs/999-command-overflow/tasks.md", content, true);

    await expect(
      page.getByRole("heading", { level: 1, name: "Crowded Command Tasks" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Phase command menu" })).toBeVisible();
    await page.getByRole("button", { name: "Phase command menu" }).click();
    await expect(page.getByRole("menuitem", { name: /Code Phase 2/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("button", { name: "Task command menu" })).toBeVisible();
    await page.getByRole("button", { name: "Task command menu" }).click();
    await expect(page.getByRole("menuitem", { name: /Code 1\.1/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Code 2\.1/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expectNoPageOverflow(page);
  });
});
