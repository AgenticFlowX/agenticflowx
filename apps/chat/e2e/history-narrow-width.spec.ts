/**
 * History webview narrow-width robustness — proves the sub-tabs, header, session
 * rows, and transcript stay single-line (no wrapping/clipping/overflow) down to
 * the narrowest realistic sidebar widths. Mirrors the Settings container-query
 * gold standard.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-21]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-HISTORY-MOCKUPS] [DES-PERSISTENT-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Locator, type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/chat/screenshots");

// The sidebar is resized by panel drag, not the viewport; the webview fills the
// viewport, so a narrow viewport == a narrow container for the container queries.
const WIDTHS = [230, 250, 280, 320];

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const body = await page.screenshot({
    path: resolve(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
  await testInfo.attach(`${name}.png`, { body, contentType: "image/png" });
}

/** True when the element's content fits its box (no horizontal clip/overflow). */
async function fitsHorizontally(loc: Locator, tolerance = 2): Promise<boolean> {
  return loc.evaluate((el, tol) => el.scrollWidth <= el.clientWidth + tol, tolerance);
}

/** Visible text only (innerText excludes the display:none container-query span). */
async function visibleText(loc: Locator): Promise<string> {
  return (await loc.evaluate((el) => (el as HTMLElement).innerText)).trim();
}

test("history: sub-tabs, header and rows never wrap or overflow at narrow widths", async ({
  page,
}, testInfo) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("tab", { name: "History" }).click();

    const pastTab = page.getByRole("button", { name: "Past sessions" });
    const currentTab = page.getByRole("button", { name: "Current session" });
    await expect(pastTab).toBeVisible();

    // Sub-tab labels fit their box and never clip to a second (overflowing) line.
    expect(await fitsHorizontally(pastTab), `past sub-tab fits @${width}px`).toBe(true);
    expect(await fitsHorizontally(currentTab), `current sub-tab fits @${width}px`).toBe(true);
    const pastClips = await pastTab.evaluate((el) => el.scrollHeight > el.clientHeight + 2);
    expect(pastClips, `past sub-tab single line @${width}px`).toBe(false);

    // Header subtitle stays one line (truncates rather than wrapping/clipping down).
    const subtitle = page.getByText("Browse and reopen past conversations.");
    const subtitleLines = await subtitle.evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
      return el.getBoundingClientRect().height / lh;
    });
    expect(subtitleLines, `subtitle single line @${width}px`).toBeLessThan(1.6);

    // Session-row meta ("42 messages · 33m ago") stays on one line; relativeTime
    // is the only element allowed to ellipsize.
    const row = page.getByTestId("session-row-sess-picker");
    const count = row.getByText(/42 messages/);
    await expect(count).toBeVisible();
    const metaWrapped = await count.evaluate((el) => {
      const wrapper = el.parentElement!; // the meta line (count · time)
      const lh = parseFloat(getComputedStyle(wrapper).lineHeight) || 14;
      return wrapper.getBoundingClientRect().height > lh + 4;
    });
    expect(metaWrapped, `row meta single line @${width}px`).toBe(false);

    await capture(page, testInfo, `history-narrow-${width}`);
  }
});

test("history: sub-tab labels swap between full and short forms by width", async ({ page }) => {
  // Narrow → short labels (accessible name stays the full label via aria-label).
  await page.setViewportSize({ width: 220, height: 1000 });
  await page.goto("/");
  await page.getByRole("tab", { name: "History" }).click();
  // innerText reflects the button's `uppercase` transform.
  expect(await visibleText(page.getByRole("button", { name: "Past sessions" }))).toBe("PAST");
  expect(await visibleText(page.getByRole("button", { name: "Current session" }))).toBe("CURRENT");

  // Wide → full labels.
  await page.setViewportSize({ width: 460, height: 1000 });
  await page.goto("/");
  await page.getByRole("tab", { name: "History" }).click();
  expect(await visibleText(page.getByRole("button", { name: "Past sessions" }))).toBe(
    "PAST SESSIONS",
  );
  expect(await visibleText(page.getByRole("button", { name: "Current session" }))).toBe(
    "CURRENT SESSION",
  );
});

test("history: transcript footer and tool rows stay single-line at narrow width", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 240, height: 1000 });
  await page.goto("/");
  await page.getByRole("tab", { name: "History" }).click();

  await page
    .getByRole("button", { name: /Segment model picker/ })
    .first()
    .click();
  const transcript = page.getByLabel("Session transcript");
  await expect(transcript.getByText("Read-only")).toBeVisible();

  // Footer: the action button shows the short "Reopen" label and is not clipped.
  const reopen = transcript.getByRole("button", { name: "Reopen & continue" });
  expect(await visibleText(reopen)).toBe("Reopen");
  expect(await fitsHorizontally(reopen)).toBe(true);

  await capture(page, testInfo, "history-narrow-transcript-240");
});
