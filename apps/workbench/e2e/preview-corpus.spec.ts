/**
 * Markdown preview corpus coverage for repo AFX and generic docs.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE] [DES-TEST]
 */
import { type Page, type TestInfo, expect, test } from "@playwright/test";

import {
  type MarkdownSample,
  REPO_ROOT,
  attachCorpusScreenshot,
  bootInPreviewMode,
  corpusScreenshotName,
  expectCodeBlocksDoNotWrap,
  expectNoPageOverflow,
  expectNoRawMarkdownLeaks,
  expectRenderedHeadings,
  expectRenderedTableCoverage,
  expectTableHeadersDoNotWrap,
  externalMarkdownSamplesFromRootsFile,
  isAfxMarkdown,
  markdownFilesUnder,
  postPreview,
  previewArticle,
  readRepoMarkdown,
  sanitizeExternalMarkdownSample,
} from "./preview-test-helpers";

const DOC_FILES = markdownFilesUnder("docs");
const EXTRA_DOC_ROOTS_FILE = `${REPO_ROOT}/.afx/preview-extra-doc-roots.txt`;
const AFX_FILES = DOC_FILES.filter((filePath) => isAfxMarkdown(readRepoMarkdown(filePath)));
const GENERIC_FILES = DOC_FILES.filter((filePath) => !isAfxMarkdown(readRepoMarkdown(filePath)));
const AFX_CONTEXT_FILES = AFX_FILES.filter(
  (filePath) => filePath.startsWith("docs/adr/") || filePath.startsWith("docs/research/"),
);
const AFX_SPEC_FILES = AFX_FILES.filter(
  (filePath) =>
    /\/(?:spec|design)\.md$/.test(filePath) || /\/\d{3}-.+\/\d{3}-.+\.md$/.test(filePath),
);
const AFX_TASK_AND_LOG_FILES = AFX_FILES.filter(
  (filePath) => !AFX_CONTEXT_FILES.includes(filePath) && !AFX_SPEC_FILES.includes(filePath),
);
const EXTRA_DOC_SAMPLES = externalMarkdownSamplesFromRootsFile(EXTRA_DOC_ROOTS_FILE);

async function boot(page: Page) {
  await bootInPreviewMode(page);
}

async function validatePreviewFile(page: Page, filePath: string, isAfxHint: boolean) {
  const content = readRepoMarkdown(filePath);
  await validatePreviewSample(page, { filePath, content }, isAfxHint);
}

async function validatePreviewSample(
  page: Page,
  sample: MarkdownSample,
  isAfxHint: boolean,
  options?: {
    ignoredHeadings?: string[];
    skipHeadingAndTableCoverage?: boolean;
    screenshot?: { name: string; testInfo: TestInfo };
  },
) {
  const { content, filePath } = sample;
  await postPreview(page, filePath, content, isAfxHint);
  await page.waitForFunction(
    (expectedPath) => document.body.textContent?.includes(expectedPath),
    filePath,
  );

  const article = previewArticle(page);
  await expect(article).toBeVisible();
  if (!options?.skipHeadingAndTableCoverage) {
    await expectRenderedHeadings(page, content, options?.ignoredHeadings);
    await expectRenderedTableCoverage(page, content);
  }
  await expectNoRawMarkdownLeaks(article);
  await expectCodeBlocksDoNotWrap(article);
  await expectTableHeadersDoNotWrap(article);
  await expectNoPageOverflow(page);

  if (options?.screenshot) {
    await attachCorpusScreenshot(page, options.screenshot.testInfo, options.screenshot.name);
  }
}

async function validateCorpus(page: Page, files: string[], isAfxHint: boolean) {
  await boot(page);
  expect(files.length).toBeGreaterThan(0);
  for (const filePath of files) {
    await test.step(filePath, async () => {
      await validatePreviewFile(page, filePath, isAfxHint);
    });
  }
}

test.describe.serial("markdown preview corpus", () => {
  test("renders ADR and research AFX documents", async ({ page }) => {
    test.setTimeout(180_000);
    await validateCorpus(page, AFX_CONTEXT_FILES, true);
  });

  test("renders spec and design AFX documents", async ({ page }) => {
    test.setTimeout(300_000);
    await validateCorpus(page, AFX_SPEC_FILES, true);
  });

  test("renders tasks, journals, plans, and sprint AFX documents", async ({ page }) => {
    test.setTimeout(300_000);
    await validateCorpus(page, AFX_TASK_AND_LOG_FILES, true);
  });

  test("renders current repo non-AFX markdown with the generic renderer", async ({ page }) => {
    test.setTimeout(180_000);
    await validateCorpus(page, GENERIC_FILES, false);
    await expect(page.getByText("Quality pulse")).toHaveCount(0);
  });

  test("renders optional local external markdown corpus", async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    test.skip(
      EXTRA_DOC_SAMPLES.length === 0,
      `Add newline-separated local docs folders to ${EXTRA_DOC_ROOTS_FILE}.`,
    );

    await boot(page);
    for (const [index, sample] of EXTRA_DOC_SAMPLES.entries()) {
      await test.step(sample.filePath, async () => {
        await validatePreviewSample(page, sample, isAfxMarkdown(sample.content));

        const sanitized = sanitizeExternalMarkdownSample(sample);
        await validatePreviewSample(page, sanitized, isAfxMarkdown(sanitized.content), {
          ignoredHeadings: ["References"],
          skipHeadingAndTableCoverage: true,
          screenshot: { name: corpusScreenshotName(sanitized, index), testInfo },
        });
      });
    }
  });
});
