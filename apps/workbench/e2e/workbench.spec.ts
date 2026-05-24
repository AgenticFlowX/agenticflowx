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
const REAL_SPEC_PATH = "docs/specs/410-warranty-claims/spec.md";
const REAL_SPEC_CONTENT = `---
afx: true
type: SPEC
status: Living
owner: "@rix"
---

<!-- AFX managed comment that should not appear in the reader -->
# Warranty Claims - Product Specification

## Target Applications

This feature spans **two applications** with organization-based access:

| App | Route | Users | Purpose |
| --- | --- | --- | --- |
| \`webapp-marketplace\` | \`/dashboard/warranty-claims\` | Contractor orgs, Supplier orgs | Submit and track organization claims |
| \`webapp-marketplace-dashboard\` | \`/warranty-claims\` | Admin | Manage and oversee ALL claims |

### Data Visibility Rules [DES-DATA]

| User Type | Can See | Can Create | Can Update |
| --- | --- | --- | --- |
| **Contractor Org Member** | Claims where \`contractor_org_id\` = their org | Yes | Own org's claims |
| **Supplier Org Member** | Claims where \`supplier_org_id\` = their org | No | Assigned claims |
| **Admin** | All claims | Yes | All claims |

## Problem Statement

Organizations need to streamline warranty management for their assets and products.

## Requirements

@see docs/specs/410-warranty-claims/spec.md [FR-1]

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Create warranty claims with photos and asset details | Must Have |
| FR-2 | View list of claims with filtering by status, urgency, date | Must Have |
`;

async function postEmptyWorkbenchUpdate(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "afxUpdate",
        pipeline: [],
        featureTasks: [],
        documents: [],
        journal: [],
        kanban: { dirPath: ".afx/kanban", boards: [] },
        notes: [],
        notesRaw: "",
        notesFilePath: "",
        ghostTasks: { count: 0, items: [] },
      },
      "*",
    );
  });
}

async function postRealSpecWorkbenchUpdate(page: import("@playwright/test").Page) {
  await page.evaluate((filePath) => {
    window.postMessage(
      {
        type: "afxUpdate",
        pipeline: [],
        featureTasks: [],
        documents: [
          {
            type: "SPEC",
            name: "Warranty Claims PRD",
            status: "Living",
            owner: "@rix",
            filePath,
            isAfx: true,
            updatedAt: "2026-05-20T10:00:00.000Z",
            excerpt:
              "Organization-scoped warranty claims for contractor, supplier, and admin flows.",
          },
        ],
        journal: [],
        kanban: { dirPath: ".afx/kanban", boards: [] },
        notes: [],
        notesRaw: "",
        notesFilePath: "",
        ghostTasks: { count: 0, items: [] },
      },
      "*",
    );
  }, REAL_SPEC_PATH);
}

async function postDocContent(
  page: import("@playwright/test").Page,
  filePath: string,
  content: string,
) {
  await page.evaluate(
    ({ filePath, content }) => {
      window.postMessage({ type: "afxDocContent", filePath, content }, "*");
    },
    { filePath, content },
  );
}

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

test("feature thinking desk keeps readable columns in compact bottom panels", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 760, height: 360 });
  await page.goto("/");

  await expect(page.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Refine spec" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in AFX Preview" }).first()).toBeVisible();

  await expect(page.getByTestId("workbench-column-toggles")).toContainText("Show/hide docs");
  await expect(page.getByRole("button", { name: "Hide SPEC document column" })).toBeVisible();
  await page.getByRole("button", { name: "Hide SPEC document column" }).click();
  await expect(page.getByRole("button", { name: "Show SPEC document column" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Show SPEC document column" }).click();

  const region = page.getByTestId("workbench-column-region");
  await expect(region).toBeVisible();
  await expect
    .poll(async () => region.evaluate((node) => Math.max(0, node.scrollWidth - node.clientWidth)))
    .toBeGreaterThan(180);
  await expect
    .poll(async () =>
      page
        .locator(".afx-workbench-column-card")
        .evaluateAll((cards) =>
          Math.max(...cards.map((card) => Math.max(0, card.scrollWidth - card.clientWidth))),
        ),
    )
    .toBeLessThanOrEqual(16);

  const pageOverflow = await page.evaluate(() =>
    Math.max(
      0,
      document.body.scrollWidth - window.innerWidth,
      document.documentElement.scrollWidth - window.innerWidth,
    ),
  );
  expect(pageOverflow).toBeLessThanOrEqual(1);

  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-thinking-desk-compact.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-thinking-desk-compact.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("feature thinking desk expands into a zen reading layout", async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto("/");

  await expect(page.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Refine spec" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in AFX Preview" }).first()).toBeVisible();
  await expect(page.getByText("Open tasks")).toBeVisible();
  await expect(page.getByRole("button", { name: "Code Phase 1: Setup" })).toBeVisible();

  const region = page.getByTestId("workbench-column-region");
  const overflow = await region.evaluate((node) =>
    Math.max(0, node.scrollWidth - node.clientWidth),
  );
  expect(overflow).toBeLessThanOrEqual(24);

  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-thinking-desk-zen.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-thinking-desk-zen.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("task phase code action drafts a scoped command", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const w = window as typeof window & {
      __afxOutboundMessages?: Array<{ command?: string; type?: string }>;
    };
    w.__afxOutboundMessages = [];
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data as { command?: string; type?: string } | undefined;
      if (msg?.type === "afxOpenChatCommand") {
        w.__afxOutboundMessages?.push(msg);
      }
    });
  });

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /16-marketplace-asset-recovery/ }).click();
  await page.getByRole("button", { name: "Code Phase 2: Implementation" }).click();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const w = window as typeof window & {
          __afxOutboundMessages?: Array<{ command?: string }>;
        };
        const last = w.__afxOutboundMessages?.[w.__afxOutboundMessages.length - 1];
        return last?.command ?? "";
      }),
    )
    .toBe("/afx-task code 16-marketplace-asset-recovery#2.6 phase 2 Implementation");
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

test("first-run launchpad is visible for an empty workspace", async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await postEmptyWorkbenchUpdate(page);

  await expect(page.getByTestId("workbench-launchpad")).toBeVisible();
  await expect(page.getByText("Workflow map")).toBeVisible();
  await expect(page.getByText("First 10 minutes")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Sample SDD set/i })).toBeVisible();
  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-empty-launchpad.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-empty-launchpad.png", { body: buf, contentType: "image/png" });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("first-run launchpad survives the constrained bottom-panel viewport", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 760, height: 260 });
  await page.goto("/");
  await postEmptyWorkbenchUpdate(page);

  await expect(page.getByTestId("workbench-launchpad")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Full spec/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sample SDD set/i })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    root: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);

  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-empty-launchpad-compact.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-empty-launchpad-compact.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("empty child tabs provide actionable guides and screenshots", async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await postEmptyWorkbenchUpdate(page);

  const tabs = [
    {
      tab: "Analytics",
      text: "Your project heartbeat will land here",
      file: "workbench-empty-analytics-guide.png",
    },
    {
      tab: "Journal",
      text: "Keep the work understandable after the tab closes",
      file: "workbench-empty-journal-guide.png",
    },
    {
      tab: "Board",
      text: "Make as many markdown boards as the work needs",
      file: "workbench-empty-board-guide.png",
    },
    {
      tab: "Notes",
      text: "Catch the thought before it becomes a task",
      file: "workbench-empty-notes-guide.png",
    },
  ];

  for (const entry of tabs) {
    await page.getByRole("tab", { name: entry.tab }).click();
    await expect(page.getByText(entry.text)).toBeVisible();
    const screenshotPath = resolve(SCREENSHOT_DIR, entry.file);
    const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
    await testInfo.attach(entry.file, { body: buf, contentType: "image/png" });
    expect(buf.length).toBeGreaterThan(10_000);
  }
});

test("empty child tabs stay usable in the constrained bottom-panel viewport", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 760, height: 260 });
  await page.goto("/");
  await postEmptyWorkbenchUpdate(page);

  const tabs = [
    {
      tab: "Analytics",
      text: "Your project heartbeat will land here",
      file: "workbench-empty-analytics-compact.png",
    },
    {
      tab: "Journal",
      text: "Keep the work understandable after the tab closes",
      file: "workbench-empty-journal-compact.png",
    },
    {
      tab: "Board",
      text: "Make as many markdown boards as the work needs",
      file: "workbench-empty-board-compact.png",
    },
    {
      tab: "Notes",
      text: "Catch the thought before it becomes a task",
      file: "workbench-empty-notes-compact.png",
    },
  ];

  for (const entry of tabs) {
    await page.getByRole("tab", { name: entry.tab }).click();
    await expect(page.getByText(entry.text)).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - window.innerWidth,
      root: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);
    const screenshotPath = resolve(SCREENSHOT_DIR, entry.file);
    const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
    await testInfo.attach(entry.file, { body: buf, contentType: "image/png" });
    expect(buf.length).toBeGreaterThan(10_000);
  }
});

test("documents tab renders the PRD studio reader", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByRole("button", { name: /^Infrastructure\b.*SPEC/i }).click();

  await expect(page.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();
  await expect(page.getByText("Quality pulse")).toBeVisible();
  await expect(page.locator('[data-afx-preview-outline="rail"]')).toBeVisible();
  const buf = await page.screenshot({ fullPage: false });
  await testInfo.attach("workbench-document-studio-prd.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("documents tab renders a real-spec-style PRD with clean tables", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await postRealSpecWorkbenchUpdate(page);
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByRole("button", { name: /Warranty Claims PRD.*SPEC/i }).click();
  await postDocContent(page, REAL_SPEC_PATH, REAL_SPEC_CONTENT);

  await expect(page.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Warranty Claims - Product Specification" }),
  ).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByText("Contractor Org Member")).toBeVisible();
  await expect(page.getByText("AFX managed comment")).toHaveCount(0);
  await expect(page.getByText("@see docs/specs")).toHaveCount(0);
  await expect(page.getByText("[DES-DATA]")).toHaveCount(0);

  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-document-studio-real-prd.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-document-studio-real-prd.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("journal tab surfaces summary and key decisions before raw notes", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await page.getByRole("tab", { name: "Journal" }).click();

  await expect(page.getByText("What mattered")).toBeVisible();
  await expect(page.getByText("Key decisions")).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText("Cursor-based pagination (not offset)"),
  ).toBeVisible();
  await expect(page.getByText("Captured session")).toBeVisible();
  await expect(page.locator('[data-afx-reader-preset="journal"]').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open reader outline" })).toBeVisible();

  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-journal-decision-preview.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-journal-decision-preview.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("notes tab renders markdown through the shared reader and toggles checkboxes", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await page.getByRole("tab", { name: "Notes" }).click();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "afxUpdate",
        pipeline: [],
        featureTasks: [],
        documents: [],
        journal: [],
        kanban: { dirPath: ".afx/kanban", boards: [] },
        notes: [
          {
            timestamp: "2026-05-23T08:15:30.000Z",
            time: "8:15:30 AM",
            displayTime: "8:15:30 AM",
            date: "2026-05-23",
            text: "- [ ] Confirm reader preset\n- [x] Keep note source markdown",
          },
        ],
        notesRaw: "",
        notesFilePath: ".afx/notes.md",
        ghostTasks: { count: 0, items: [] },
      },
      "*",
    );
  });

  await expect(page.locator('[data-afx-reader-preset="note"]').first()).toBeVisible();
  await expect(page.getByText("Confirm reader preset")).toBeVisible();
  const checkbox = page.getByRole("checkbox", { name: /Toggle task checkbox/ }).first();
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  const screenshotPath = resolve(SCREENSHOT_DIR, "workbench-notes-reader-checkbox.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("workbench-notes-reader-checkbox.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("workbench column reading-options popover has Width + tooltips fire on toolbar buttons", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/");
  await expect(page.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();

  // 1. Open the SPEC column's reading options and verify Width row is present
  //    with both Comfortable/Wide toggles (regression: was missing per user bug).
  const readingOptionsBtn = page.getByRole("button", { name: "SPEC reading options" }).first();
  await readingOptionsBtn.click();
  const popover = page.locator('[role="dialog"]', { hasText: "Width" });
  await expect(popover).toBeVisible();
  await expect(popover.getByText("Width", { exact: true })).toBeVisible();
  await expect(popover.getByRole("radio", { name: "Comfortable" })).toBeVisible();
  await expect(popover.getByRole("radio", { name: "Wide" })).toBeVisible();
  // Confirm the other rows are still present.
  await expect(popover.getByText("Text size", { exact: true })).toBeVisible();
  await expect(popover.getByText("Paper tone", { exact: true })).toBeVisible();
  await expect(popover.getByText("Font", { exact: true })).toBeVisible();

  const popoverPath = resolve(SCREENSHOT_DIR, "workbench-reading-options-popover-with-width.png");
  const popoverBuf = await page.screenshot({ fullPage: false, path: popoverPath });
  await testInfo.attach("workbench-reading-options-popover-with-width.png", {
    body: popoverBuf,
    contentType: "image/png",
  });

  // Toggling Width must actually change the article's max-w class on the
  // column body — confirms `reading.width` is wired into `readingWidthClass`,
  // not just stored in localStorage. Class assertion is robust to viewport
  // (column rail may be narrower than 70ch so both modes render the same px).
  const studio = page.locator('[data-afx-doc-surface="document-studio"]').first();
  await popover.getByRole("radio", { name: "Comfortable" }).click();
  await expect(popover.getByRole("radio", { name: "Comfortable" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Column variant uses a looser cap (~88ch ≈ VSCode's natural markdown
  // preview width) so Comfortable doesn't visibly pinch normal-width columns.
  await expect(studio).toHaveClass(/max-w-\[88ch\]/);
  await popover.getByRole("radio", { name: "Wide" }).click();
  await expect(popover.getByRole("radio", { name: "Wide" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(studio).toHaveClass(/max-w-none/);
  await page.keyboard.press("Escape");

  // 2. Hover the SPEC column's "Open in editor" toolbar button and confirm
  //    a shadcn Tooltip appears (regression: native title-only previously).
  const editBtn = page.getByRole("button", { name: "Open in editor" }).first();
  await editBtn.hover();
  const tooltip = page.getByRole("tooltip", { name: "Open in editor" }).first();
  await expect(tooltip).toBeVisible({ timeout: 5_000 });

  const tooltipPath = resolve(SCREENSHOT_DIR, "workbench-tooltip-open-in-editor.png");
  const tooltipBuf = await page.screenshot({ fullPage: false, path: tooltipPath });
  await testInfo.attach("workbench-tooltip-open-in-editor.png", {
    body: tooltipBuf,
    contentType: "image/png",
  });
});

test("board column move controls reorder columns", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Board" }).click();

  await page.getByRole("button", { name: "Move Backlog column right" }).click();
  await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText("Todo");
  const buf = await page.screenshot({ fullPage: false });
  await testInfo.attach("workbench-board-reorder.png", { body: buf, contentType: "image/png" });
  expect(buf.length).toBeGreaterThan(10_000);
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
