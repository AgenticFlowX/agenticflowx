/**
 * Modified Files strip — Playwright e2e against the browser dev harness.
 *
 * The base suite uses the DebugPanel's "tool-edit-file" scenario to drive a
 * single edit tool call into the transcript and asserts the strip's
 * expand/collapse/dismiss behaviour. The compact-mode suite fires
 * "tool-edit-many-files" (8 distinct edits in one turn) to cross the
 * `THRESHOLD = 6` boundary in `files-panel.tsx` and exercise the
 * `+N more` / `Show less` toggle and per-turn remount-reset.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { type Page, type TestInfo, expect, test } from "@playwright/test";

/**
 * Snapshot helper — writes a screenshot to `test-results/<name>.png` (Playwright
 * creates parent dirs automatically) AND attaches it to the HTML report so the
 * artifact survives outside the volatile per-run trace directory.
 */
async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = `test-results/${name}`;
  const body = await page.screenshot({ fullPage: false, path });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

async function fireScenario(page: Page, label: string): Promise<void> {
  // Open the floating Debug Panel popover
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  // Click the scenario tile by its visible label (case-sensitive — buttons
  // render the label string directly, e.g. "edit").
  await page.getByRole("button", { name: label, exact: true }).click();
  // Close the popover so it doesn't cover the composer
  await page.keyboard.press("Escape");
}

function modifiedPanelHeader(page: Page) {
  return page.locator("#composer-panel-modified-files");
}

function modifiedFilePills(page: Page) {
  return page.getByTestId("files-panel-pill");
}

function modifiedToggle(page: Page) {
  return page.getByTestId("files-panel-toggle");
}

const COMPACT_THRESHOLD = 4;
const MANY_FILES_COUNT = 8;

test.describe("Modified files strip (FR-10)", () => {
  test("is hidden on a fresh chat with no tool calls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Modified/i)).toHaveCount(0);
  });

  test("appears expanded with a clickable pill after an edit tool call lands", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit");

    // Wait for the toolStart to land (~60ms) and the strip to render expanded.
    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    // Default-expanded: aria-expanded=true, pill is visible.
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(header).toContainText("· 1");

    // The "tool-edit-file" mock scenario edits apps/chat/src/views/chat.tsx.
    const pill = modifiedFilePills(page);
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveText(/chat\.tsx/);
    await expect(pill).toHaveAttribute("aria-label", /Open .*chat\.tsx/);
  });

  test("collapses when the chevron is clicked and re-expands when clicked again", async ({
    page,
  }) => {
    await page.goto("/");
    await fireScenario(page, "edit");
    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toHaveAttribute("aria-expanded", "true");

    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(modifiedFilePills(page).first()).toBeHidden();

    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(modifiedFilePills(page)).toHaveCount(1);
  });

  test("renders the firstChangedLine forwarded by the tool result", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit");
    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    // Pill is visible immediately (default-expanded). Wait for toolEnd to add the
    // firstChangedLine to the tool view — only toolEnd carries it.
    const pill = modifiedFilePills(page);
    await expect(pill).toBeVisible({ timeout: 5_000 });
    // Mock scenario emits firstChangedLine: 142 for the tool-edit-file edit.
    await expect(pill).toHaveAttribute("aria-label", /at line 142/i, { timeout: 5_000 });
    await expect(pill).toContainText(":142");
  });

  test("dismiss (✕) hides the strip until the next assistant turn produces an edit", async ({
    page,
  }) => {
    await page.goto("/");
    await fireScenario(page, "edit");
    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Done\. I added a scroll-to-bottom button/).first()).toBeVisible({
      timeout: 10_000,
    });

    // Dismiss after the first turn settles. The next assistant turn should
    // clear this dismissal as soon as a fresh edit tool starts.
    // Scope the close button by walking up from the visible toggle to its
    // sibling close button inside the same header.
    const closeBtn = header.locator(
      "xpath=ancestor::section//button[@aria-label='Dismiss Modified']",
    );
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
    await closeBtn.click();
    await expect(modifiedPanelHeader(page)).toHaveCount(0);

    // Fire another edit turn — strip should reappear (same path → count stays 1).
    await fireScenario(page, "edit");
    await expect(modifiedPanelHeader(page)).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("Modified files strip (FR-10) compact mode", () => {
  test("compact mode shows only THRESHOLD pills + toggle when count > THRESHOLD", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await fireScenario(page, "edit ×8");

    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toContainText(`· ${MANY_FILES_COUNT}`);

    // Compact mode: only the first THRESHOLD pills render in the DOM.
    await expect(modifiedFilePills(page)).toHaveCount(COMPACT_THRESHOLD, { timeout: 5_000 });
    const toggle = modifiedToggle(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText(`+${MANY_FILES_COUNT - COMPACT_THRESHOLD} more`);
    await expect(toggle).toHaveAttribute("data-expanded", "false");
    await attachScreenshot(page, testInfo, "files-strip-compact.png");
  });

  test("clicking +N more reveals all pills and changes toggle to 'Show less'", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await fireScenario(page, "edit ×8");

    const toggle = modifiedToggle(page);
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await toggle.click();

    await expect(modifiedFilePills(page)).toHaveCount(MANY_FILES_COUNT);
    await expect(toggle).toHaveText("Show less");
    await expect(toggle).toHaveAttribute("data-expanded", "true");
    await attachScreenshot(page, testInfo, "files-strip-expanded.png");
  });

  test("clicking Show less returns to compact (THRESHOLD pills + +N more)", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit ×8");

    const toggle = modifiedToggle(page);
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await toggle.click();
    await toggle.click();

    await expect(modifiedFilePills(page)).toHaveCount(COMPACT_THRESHOLD);
    await expect(toggle).toHaveText(/^\+\d+ more$/);
    await expect(toggle).toHaveAttribute("data-expanded", "false");
  });

  test("chrome chevron still hides the entire body, expanded or compact", async ({ page }) => {
    await page.goto("/");
    await fireScenario(page, "edit ×8");

    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toHaveAttribute("aria-expanded", "true");

    // Compact body visible; chevron-collapse hides it; un-collapse keeps compact.
    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(modifiedFilePills(page).first()).toBeHidden();
    await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(modifiedFilePills(page)).toHaveCount(COMPACT_THRESHOLD);
    await expect(modifiedToggle(page)).toHaveAttribute("data-expanded", "false");

    // Expand via the +N more toggle, then chrome-collapse and re-show — state preserved.
    await modifiedToggle(page).click();
    await expect(modifiedToggle(page)).toHaveAttribute("data-expanded", "true");
    await header.click();
    await expect(modifiedFilePills(page).first()).toBeHidden();
    await header.click();
    await expect(modifiedFilePills(page)).toHaveCount(MANY_FILES_COUNT);
    await expect(modifiedToggle(page)).toHaveAttribute("data-expanded", "true");
  });

  // Stress matrix: confirm the body stays at exactly THRESHOLD pills + toggle
  // regardless of how many files arrive, and capture screenshots at each volume
  // so a reviewer can verify the height budget visually with long realistic
  // monorepo paths (e.g. `apps/workbench/src/lib/document-studio.tsx`).
  for (const count of [10, 20, 50] as const) {
    test(`compact body stays at THRESHOLD pills with long realistic paths × ${count}`, async ({
      page,
    }, testInfo) => {
      await page.goto("/");
      await fireScenario(page, `edit ×${count}`);

      const header = modifiedPanelHeader(page);
      await expect(header).toBeVisible({ timeout: 5_000 });
      await expect(header).toContainText(`· ${count}`);

      // The whole point of the change — body cap is constant regardless of count.
      await expect(modifiedFilePills(page)).toHaveCount(COMPACT_THRESHOLD, { timeout: 5_000 });
      const toggle = modifiedToggle(page);
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveText(`+${count - COMPACT_THRESHOLD} more`);

      await attachScreenshot(page, testInfo, `files-strip-compact-${count}.png`);

      // Expand and confirm all N pills render, then snapshot the expanded view.
      await toggle.click();
      await expect(modifiedFilePills(page)).toHaveCount(count);
      await expect(toggle).toHaveText("Show less");
      await attachScreenshot(page, testInfo, `files-strip-expanded-${count}.png`);
    });
  }

  // Narrow-viewport stress matrix — mirrors the constrained VSCode sidebar
  // (~360 px wide) which is the geometry that motivated the compact-mode work
  // in the first place. Capture screenshots so a reviewer can see how the panel
  // behaves under the actual production width with realistic long names.
  for (const count of [10, 20, 50] as const) {
    test(`narrow sidebar (360×800) — compact body holds at THRESHOLD with ${count} files`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto("/");
      await fireScenario(page, `edit ×${count}`);

      const header = modifiedPanelHeader(page);
      await expect(header).toBeVisible({ timeout: 5_000 });
      await expect(header).toContainText(`· ${count}`);

      // Still capped at THRESHOLD even when wrap behaviour is much harsher.
      await expect(modifiedFilePills(page)).toHaveCount(COMPACT_THRESHOLD, { timeout: 5_000 });
      const toggle = modifiedToggle(page);
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveText(`+${count - COMPACT_THRESHOLD} more`);

      await attachScreenshot(page, testInfo, `files-strip-narrow-compact-${count}.png`);

      // Snapshot the expanded view at narrow width too — this is the "before"
      // state of the bug; with the compact mode it's a deliberate user choice.
      await toggle.click();
      await expect(modifiedFilePills(page)).toHaveCount(count);
      await attachScreenshot(page, testInfo, `files-strip-narrow-expanded-${count}.png`);
    });
  }

  test("chrome close (✕) dismisses the panel and the next edit turn re-shows it in compact", async ({
    page,
  }) => {
    await page.goto("/");
    await fireScenario(page, "edit ×8");

    const header = modifiedPanelHeader(page);
    await expect(header).toBeVisible({ timeout: 5_000 });

    // Expand first, then dismiss — confirms the dismiss path doesn't depend on compact mode.
    await modifiedToggle(page).click();
    await expect(modifiedToggle(page)).toHaveAttribute("data-expanded", "true");

    // Wait for the assistant turn to settle before dismissing (mirrors the FR-10 dismiss test).
    await expect(page.getByText(/Touched 8 files in this turn/).first()).toBeVisible({
      timeout: 10_000,
    });
    const closeBtn = header.locator(
      "xpath=ancestor::section//button[@aria-label='Dismiss Modified']",
    );
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
    await closeBtn.click();
    await expect(modifiedPanelHeader(page)).toHaveCount(0);

    // Next turn re-shows the panel; remount must reset the body to compact (not expanded).
    await fireScenario(page, "edit ×8");
    await expect(modifiedPanelHeader(page)).toBeVisible({ timeout: 5_000 });
    await expect(modifiedFilePills(page)).toHaveCount(COMPACT_THRESHOLD);
    await expect(modifiedToggle(page)).toHaveAttribute("data-expanded", "false");
  });
});
