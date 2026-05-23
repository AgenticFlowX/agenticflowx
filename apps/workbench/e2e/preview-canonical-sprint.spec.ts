/**
 * Canonical AFX sprint preview coverage.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE] [DES-TEST]
 */
import { expect, test } from "@playwright/test";

import {
  attachPreviewScreenshot,
  bootInPreviewMode,
  expectCodeBlocksDoNotWrap,
  expectNoPageOverflow,
  expectNoRawMarkdownLeaks,
  expectRenderedHeadings,
  expectRenderedTableCoverage,
  expectTableHeadersDoNotWrap,
  postPreview,
  previewArticle,
  readRepoMarkdown,
} from "./preview-test-helpers";

const CANONICAL_SPRINT_PATH = "docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md";

test.describe.serial("canonical AFX sprint preview", () => {
  test("renders every section, table, checkbox, and code block without raw markdown leaks", async ({
    page,
  }, testInfo) => {
    const content = readRepoMarkdown(CANONICAL_SPRINT_PATH);

    await bootInPreviewMode(page);

    await postPreview(page, CANONICAL_SPRINT_PATH, content, true);

    const article = previewArticle(page);
    await expect(page.getByText("Quality pulse")).toBeVisible();
    await expect(page.locator('[data-afx-preview-outline="rail"]')).toBeVisible();
    await page.getByRole("button", { name: "Hide outline" }).click();
    await expect(page.locator("[data-afx-preview-outline]")).toHaveCount(0);
    await page.getByRole("button", { name: "Show outline" }).click();
    await expect(page.locator('[data-afx-preview-outline="rail"]')).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Chat UI Theme Foundation — Sprint Brief" }),
    ).toBeVisible();

    for (const section of ["preamble", "spec", "design", "tasks", "sessions"]) {
      await expect(page.locator(`[data-afx-doc-section="${section}"]`).first()).toBeVisible();
    }
    const tasksSection = page.locator('[data-afx-doc-section="tasks"]').first();
    await expect(tasksSection.getByRole("button", { name: "Tasks command menu" })).toBeVisible();
    await tasksSection.getByRole("button", { name: "Tasks command menu" }).click();
    await expect(page.getByRole("menuitem", { name: /Approve tasks/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Code task phase 0:/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Code task 0\.1:/ }).first()).toBeVisible();

    const phaseHeading = page.getByRole("heading", {
      level: 3,
      name: "Phase 0: Design-System Extraction Inventory",
      exact: true,
    });
    await phaseHeading.scrollIntoViewIfNeeded();
    const phaseAnchor = page
      .locator("[data-afx-md-heading-action-anchor]")
      .filter({ has: phaseHeading })
      .first();
    const floatingAction = phaseAnchor.locator('[data-afx-md-heading-action="floating"]').first();
    await expect(floatingAction).toHaveCSS("opacity", "0");
    await phaseAnchor.hover();
    await expect(floatingAction).toHaveCSS("opacity", "1");
    await attachPreviewScreenshot(page, testInfo, "preview-canonical-sprint-floating-toolbar");

    const functionalRequirements = page.getByRole("heading", {
      name: "Functional Requirements",
      exact: true,
    });
    await expect(functionalRequirements).toBeVisible();
    await expect(page.getByRole("cell", { name: "FR-1", exact: true })).toBeVisible();
    await expect(
      page.getByText("Establish a canonical AFX semantic theme contract", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("table", { name: "Requirements table" }).first()).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /Toggle task checkbox/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Toggle human signoff row 1", exact: true }),
    ).toBeVisible();

    await expectRenderedHeadings(page, content);
    await expectRenderedTableCoverage(page, content);
    await expectNoRawMarkdownLeaks(article);
    await expectCodeBlocksDoNotWrap(article);
    await expectTableHeadersDoNotWrap(article);
    await expectNoPageOverflow(page);

    await functionalRequirements.scrollIntoViewIfNeeded();
    await attachPreviewScreenshot(page, testInfo, "preview-canonical-sprint-functional-reqs");
  });
});
