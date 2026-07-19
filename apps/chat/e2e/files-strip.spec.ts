/**
 * Modified Files panel regression coverage against the browser dev harness.
 *
 * The high-volume fixture mirrors the release report: 34 files, including 21
 * SDD documents. The complete inventory is a portal, so opening it must not
 * resize or push the composer.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-7]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import { type Locator, type Page, type TestInfo, expect, test } from "@playwright/test";

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(name);
  const body = await page.screenshot({ fullPage: false, path });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

async function fireScenario(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
}

async function clearDebugLog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("tab", { name: "Log" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("No messages yet")).toBeVisible();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
}

async function openDebugLog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("tab", { name: "Log" }).click();
}

function modifiedPanelHeader(page: Page): Locator {
  return page.locator("#composer-panel-modified-files");
}

function compactFileButtons(page: Page): Locator {
  return page.getByTestId("files-panel-pill");
}

function allFilesTrigger(page: Page): Locator {
  return page.getByTestId("files-panel-all-trigger");
}

async function expectComposerGeometryUnchanged(page: Page, action: () => Promise<void>) {
  const composer = page.locator("#afx-chat-composer");
  const before = await composer.boundingBox();
  expect(before).not.toBeNull();
  await action();
  const after = await composer.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
}

test.describe("Modified files panel (FR-10)", () => {
  test("is hidden on a fresh chat with no edit tools", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Modified/i)).toHaveCount(0);
  });

  test("opens a changed file at its first changed line", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit");

    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toContainText("· 1");
    const file = page.getByRole("button", {
      name: /Open apps\/chat\/src\/views\/chat\.tsx at line 142/i,
    });
    await expect(file).toBeVisible({ timeout: 5_000 });
    await file.click();

    await openDebugLog(page);
    const openFile = page.getByRole("button", { name: "Toggle entry chat/openFile" });
    await expect(openFile).toHaveCount(1);
    await openFile.click();
    await expect(openFile.locator("..").locator("pre")).toContainText('"line": 142');
  });

  test("chrome collapse hides the whole body and re-expands it", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit");
    const header = modifiedPanelHeader(page);
    await expect(header).toHaveAttribute("aria-expanded", "true", { timeout: 5_000 });

    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(compactFileButtons(page)).toBeHidden();
    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(compactFileButtons(page)).toHaveCount(1);
  });

  test("dismiss remains scoped until a newer editing response", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit");
    const header = modifiedPanelHeader(page);
    await expect(page.getByText(/Done\. I added a scroll-to-bottom button/).first()).toBeVisible({
      timeout: 10_000,
    });
    const close = header.locator("xpath=ancestor::section//button[@aria-label='Dismiss Modified']");
    await close.click();
    await expect(modifiedPanelHeader(page)).toHaveCount(0);

    await fireScenario(page, "edit");
    await expect(modifiedPanelHeader(page)).toBeVisible({ timeout: 5_000 });
  });

  test("SDD files appear once, retain workflow actions, and preview the newest success", async ({
    page,
  }) => {
    await page.goto("/");
    await fireScenario(page, "SDD guide");
    await expect(page.getByTestId("sdd-workflow-guide-card")).toBeVisible({ timeout: 10_000 });

    const guide = page.getByTestId("sdd-modified-guide");
    await expect(guide).toContainText("SDD · 2 docs");
    await expect(guide).toHaveAttribute("data-status", "ok");
    await expect(compactFileButtons(page)).toHaveCount(0);
    await expect(guide.getByRole("button", { name: "Show all 2 modified files" })).toBeVisible();
    const guideBox = await guide.boundingBox();
    expect(guideBox?.height).toBeLessThanOrEqual(28);

    await clearDebugLog(page);
    await guide.getByRole("button", { name: "Show all 2 modified files" }).click();
    const inventory = page.getByRole("dialog", { name: "All 2 modified files" });
    await inventory
      .getByRole("button", { name: "Open docs/specs/checkout-redesign/spec.md at line 1" })
      .click();
    await guide
      .getByRole("button", { name: "Preview docs/specs/checkout-redesign/design.md" })
      .click();

    const composer = page.locator("#afx-chat-composer");
    const more = guide.getByRole("button", { name: "More SDD document actions" });
    await more.click();
    await expect(page.getByText("SDD actions · 1 spec")).toBeVisible();
    await expect(
      page.getByRole("group", {
        name: "SDD actions for docs/specs/checkout-redesign",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", {
        name: "Refine spec for docs/specs/checkout-redesign",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", {
        name: "Refine design for docs/specs/checkout-redesign",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Journal for docs/specs/checkout-redesign" }),
    ).toHaveCount(1);
    await page
      .getByRole("menuitem", { name: "Refine spec for docs/specs/checkout-redesign" })
      .click();
    await expect(composer).toHaveValue("/afx-spec refine checkout-redesign ");

    await openDebugLog(page);
    const entries = page.getByRole("button", { name: "Toggle entry chat/openFile" });
    await expect(entries).toHaveCount(2);
    await entries.nth(1).click();
    await expect(entries.nth(1).locator("..").locator("pre")).toContainText('"mode": "afxPreview"');
    await expect(entries.nth(1).locator("..").locator("pre")).toContainText(
      '"path": "docs/specs/checkout-redesign/design.md"',
    );
  });
});

test.describe("Modified files inspection actions", () => {
  test("hover exposes Markdown source, AFX Preview, and Git changes", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await fireScenario(page, "edit markdown");
    await expect(modifiedPanelHeader(page)).toBeVisible({ timeout: 5_000 });
    // Wait for transcript streaming to settle before asserting pointer
    // stability. While a response is still growing the popper legitimately
    // tracks composer geometry, which is a different running-state concern.
    await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0, {
      timeout: 10_000,
    });

    const source = page.getByRole("button", { name: "Open README.md at line 24" });
    await source.hover();
    let actions = page.getByRole("dialog", { name: "Actions for README.md" });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Open source" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "AFX Preview" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Git changes" })).toBeVisible();
    await attachScreenshot(page, testInfo, "chat-modified-file-actions-markdown.png");

    await actions.getByRole("button", { name: "AFX Preview" }).click();
    await source.hover();
    actions = page.getByRole("dialog", { name: "Actions for README.md" });
    await actions.getByRole("button", { name: "Git changes" }).click();

    await openDebugLog(page);
    const entries = page.getByRole("button", { name: "Toggle entry chat/openFile" });
    await expect(entries).toHaveCount(2);
    await entries.nth(0).click();
    await expect(entries.nth(0).locator("..").locator("pre")).toContainText('"mode": "afxPreview"');
    await entries.nth(1).click();
    await expect(entries.nth(1).locator("..").locator("pre")).toContainText('"mode": "gitChanges"');
  });

  test("keyboard activation enters actions and Escape restores the trigger", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit");
    const trigger = page.getByRole("button", {
      name: "Actions for apps/chat/src/views/chat.tsx",
    });
    await trigger.focus();
    await trigger.press("Enter");

    const actions = page.getByRole("dialog", {
      name: "Actions for apps/chat/src/views/chat.tsx",
    });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Open source" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(actions).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe("Modified files 34/21 release regression", () => {
  test("keeps two standard files plus one SDD summary and a grouped All inventory", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await fireScenario(page, "edit 34/21");
    const header = modifiedPanelHeader(page);
    await expect(header).toContainText("· 34", { timeout: 10_000 });
    await expect(compactFileButtons(page)).toHaveCount(2);
    await expect(page.getByTestId("sdd-modified-guide")).toContainText("SDD · 21 docs");
    await expect(allFilesTrigger(page)).toHaveAccessibleName("Show all 34 modified files");
    await attachScreenshot(page, testInfo, "chat-modified-mixed-34-21.png");

    await expectComposerGeometryUnchanged(page, async () => allFilesTrigger(page).click());
    const inventory = page.getByRole("dialog", { name: "All 34 modified files" });
    await expect(inventory.getByRole("heading", { name: "Files · 13" })).toBeVisible();
    await expect(inventory.getByRole("heading", { name: "SDD · 21" })).toBeVisible();
    await expect(inventory.getByTestId("files-panel-all-row")).toHaveCount(34);
    await expect(inventory.getByText("modified-regression-01/spec.md")).toBeVisible();
    await expect(inventory.getByText("modified-regression-04/spec.md")).toBeVisible();
    const box = await inventory.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(321);
  });

  test("keeps every file reachable in a 50-file batch without resizing the composer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await fireScenario(page, "edit ×50");
    await expect(modifiedPanelHeader(page)).toContainText("· 50", { timeout: 10_000 });
    await expect(compactFileButtons(page)).toHaveCount(2);

    await expectComposerGeometryUnchanged(page, async () => allFilesTrigger(page).click());
    const inventory = page.getByRole("dialog", { name: "All 50 modified files" });
    const rows = inventory.getByTestId("files-panel-all-row");
    await expect(rows).toHaveCount(50);
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows.last()).toBeVisible();
    expect((await inventory.boundingBox())?.height).toBeLessThanOrEqual(321);
  });

  test("keeps seven changed SDD specs identified in one keyboard-accessible narrow menu", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await fireScenario(page, "edit 34/21");
    await expect(modifiedPanelHeader(page)).toContainText("· 34", { timeout: 10_000 });

    const trigger = page
      .getByTestId("sdd-modified-guide")
      .getByRole("button", { name: "More SDD document actions" });
    await trigger.focus();
    await expectComposerGeometryUnchanged(page, async () => trigger.press("Enter"));

    let menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("SDD actions · 7 specs")).toBeVisible();
    await expect(menu.getByTestId("sdd-action-group")).toHaveCount(7);
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(menu.getByRole("menuitem").first()).toBeFocused();

    const menuBox = await menu.boundingBox();
    expect(menuBox?.height).toBeLessThanOrEqual(321);
    expect(menuBox?.width).toBeLessThanOrEqual(344);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    await attachScreenshot(page, testInfo, "chat-modified-sdd-actions-grouped-narrow.png");

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    menu = page.getByRole("menu");
    const firstGroup = menu.getByTestId("sdd-action-group").first();
    const lastGroup = menu.getByTestId("sdd-action-group").last();
    await firstGroup.scrollIntoViewIfNeeded();
    await expect(firstGroup).toBeVisible();
    await lastGroup.scrollIntoViewIfNeeded();
    await expect(lastGroup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    menu = page.getByRole("menu");
    const ownerAction = menu.getByRole("menuitem", {
      name: "Refine design for docs/specs/modified-regression-06",
    });
    const keyboardPath = [
      "Refine spec for docs/specs/modified-regression-07",
      "Refine design for docs/specs/modified-regression-07",
      "Task status for docs/specs/modified-regression-07",
      "Refine spec for docs/specs/modified-regression-06",
      "Refine design for docs/specs/modified-regression-06",
    ];
    await expect(menu.getByRole("menuitem", { name: keyboardPath[0] })).toBeFocused();
    for (const actionName of keyboardPath.slice(1)) {
      await page.keyboard.press("ArrowDown");
      await expect(menu.getByRole("menuitem", { name: actionName })).toBeFocused();
    }
    await expect(ownerAction).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.locator("#afx-chat-composer")).toHaveValue(
      "/afx-design refine modified-regression-06 ",
    );
  });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 480, height: 820 },
    { width: 656, height: 1104 },
  ] as const) {
    test(`${viewport.width}×${viewport.height} stays bounded with All open`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await fireScenario(page, "edit 34/21");
      await expect(modifiedPanelHeader(page)).toContainText("· 34", { timeout: 10_000 });
      await expect(compactFileButtons(page)).toHaveCount(2);

      const compactRow = page.getByTestId("files-panel-compact-list");
      const compactBox = await compactRow.boundingBox();
      expect(compactBox?.height).toBeLessThanOrEqual(24);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );

      await expectComposerGeometryUnchanged(page, async () => allFilesTrigger(page).click());
      const inventory = page.getByRole("dialog", { name: "All 34 modified files" });
      await expect(inventory.getByTestId("files-panel-all-row")).toHaveCount(34);
      const inventoryBox = await inventory.boundingBox();
      expect(inventoryBox?.height).toBeLessThanOrEqual(Math.min(viewport.height * 0.45, 320) + 1);
      const composerBox = await page.locator("#afx-chat-composer").boundingBox();
      expect((composerBox?.y ?? 0) + (composerBox?.height ?? 0)).toBeLessThanOrEqual(
        viewport.height,
      );

      if (viewport.width === 360) {
        await attachScreenshot(page, testInfo, "chat-modified-all-files-narrow.png");
        await allFilesTrigger(page).press("Escape");
        await attachScreenshot(page, testInfo, "chat-modified-mixed-34-21-narrow.png");
      }
    });
  }
});
