/**
 * Modified Files strip — Playwright e2e against the browser dev harness.
 * Uses the DebugPanel's "tool-edit-file" scenario to drive edit/write tool calls
 * into the chat transcript, then asserts the strip behavior end-to-end.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { type Page, expect, test } from "@playwright/test";

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
  return page.locator("#composer-panel-modified");
}

function modifiedFilePills(page: Page) {
  return page.getByTestId("files-panel-pill");
}

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
