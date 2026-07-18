/**
 * Workbench webview smoke + screenshot tests.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

const TAB_LABELS = [
  "SDD Studio",
  "Pipeline",
  "Documents",
  "Analytics",
  "Journal",
  "Board",
  "Notes",
];
const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/workbench/screenshots");
const REAL_SPEC_PATH = "docs/specs/410-warranty-claims/spec.md";
const SDD_STUDIO_VIEWPORTS = [
  { name: "bottom-panel", width: 760, height: 360 },
  { name: "wide-bottom-panel", width: 1024, height: 360 },
  { name: "short-editor", width: 1024, height: 500 },
  { name: "standard-editor", width: 1400, height: 600 },
  { name: "wide-editor", width: 1440, height: 760 },
] as const;
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

async function postEmptyWorkbenchUpdate(page: Page) {
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

async function postRealSpecWorkbenchUpdate(page: Page) {
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

async function postDocContent(page: Page, filePath: string, content: string) {
  await page.evaluate(
    ({ filePath, content }) => {
      window.postMessage({ type: "afxDocContent", filePath, content }, "*");
    },
    { filePath, content },
  );
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    root: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(Math.max(overflow.body, overflow.root)).toBeLessThanOrEqual(1);
}

async function captureWorkbenchScreenshot(page: Page, testInfo: TestInfo, fileName: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = resolve(SCREENSHOT_DIR, fileName);
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach(fileName, { body: buf, contentType: "image/png" });
  expect(buf.length).toBeGreaterThan(10_000);
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

test("SDD Studio tab is selected by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "SDD Studio" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("SDD Studio feature picker opens and switches feature", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto("/");

  const picker = page.getByRole("button", { name: "Select SDD feature" });
  await expect(picker).toContainText("Infrastructure");
  await picker.click();

  const listbox = page.getByRole("listbox", { name: "Select SDD feature" });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByText("Recent specs")).toBeVisible();
  await expect(listbox.getByRole("option", { name: /Infrastructure/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await captureWorkbenchScreenshot(page, testInfo, "sdd-studio-feature-picker-open.png");

  await listbox.getByRole("option", { name: /Marketplace Asset Recovery/i }).click();
  await expect(listbox).toBeHidden();
  await expect(picker).toContainText("Marketplace Asset Recovery");
  await captureWorkbenchScreenshot(page, testInfo, "sdd-studio-feature-picker-selected.png");

  await page.reload();
  await expect(page.getByRole("button", { name: "Select SDD feature" })).toContainText(
    "Marketplace Asset Recovery",
  );
});

test("feature thinking desk keeps readable columns in compact bottom panels", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 760, height: 360 });
  await page.goto("/");
  await page
    .getByLabel("SDD Studio view mode")
    .getByRole("button", { name: "Compare docs" })
    .click();

  await expect(page.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();
  await expect(
    page.getByTestId("workbench-column-spec").getByRole("button", { name: "Refine spec" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in AFX Preview" }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: "Hide Spec document column" })).toBeVisible();
  await page.getByRole("button", { name: "Hide Spec document column" }).click();
  await expect(page.getByRole("button", { name: "Show Spec document column" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Show Spec document column" }).click();

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

  const screenshotPath = resolve(SCREENSHOT_DIR, "sdd-studio-compare-compact-columns.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("sdd-studio-compare-compact-columns.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

test("SDD Studio focus view expands into a guided reading layout", async ({ page }, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto("/");
  await page.getByLabel("SDD Studio view mode").getByRole("button", { name: "Focus doc" }).click();

  const focus = page.getByTestId("sdd-studio-focus");
  await expect(focus).toBeVisible();
  await expect(focus.getByText("Workflow")).toBeVisible();
  await expect(focus.getByText("Needs attention")).toBeVisible();
  await expect(focus.locator('[data-afx-doc-surface="document-studio"]').first()).toBeVisible();
  await expect(focus.getByRole("button", { name: /^Spec\b/i }).first()).toBeVisible();
  await focus
    .getByRole("button", { name: /^Tasks\b/i })
    .first()
    .click();
  await expect(focus.getByText("docs/specs/15-infrastructure/tasks.md")).toBeVisible();
  await expect(focus.getByRole("button", { name: "Code Phase 1: Setup" })).toBeVisible();

  await expectNoPageOverflow(page);

  const screenshotPath = resolve(SCREENSHOT_DIR, "sdd-studio-focus-zen.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("sdd-studio-focus-zen.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);

  await page.reload();
  const restoredFocus = page.getByTestId("sdd-studio-focus");
  await expect(restoredFocus).toBeVisible();
  await expect(page.getByTestId("sdd-studio-focus-tasks")).toBeVisible();
  await expect(restoredFocus.getByText("docs/specs/15-infrastructure/tasks.md")).toBeVisible();
});

test("task phase code action drafts a scoped command", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "afxUpdate",
        pipeline: [
          {
            name: "16-marketplace-asset-recovery",
            specStatus: "Approved",
            designStatus: "Draft",
            tasksStatus: "In Progress",
            completed: 8,
            total: 15,
            featureStatus: "In Progress",
            specPath: "docs/specs/16-marketplace-asset-recovery/spec.md",
            designPath: "docs/specs/16-marketplace-asset-recovery/design.md",
            tasksPath: "docs/specs/16-marketplace-asset-recovery/tasks.md",
          },
        ],
        featureTasks: [
          {
            name: "16-marketplace-asset-recovery",
            tasksPath: "docs/specs/16-marketplace-asset-recovery/tasks.md",
            completed: 8,
            total: 15,
            phases: [],
            workSessions: [],
          },
        ],
      },
      "*",
    );
  });
  await expect(page.getByText("Marketplace Asset Recovery").first()).toBeVisible();

  await page
    .getByLabel("SDD Studio view mode")
    .getByRole("button", { name: "Compare docs" })
    .click();
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
    const slug = label.toLowerCase().replace(/\s+/g, "-");
    const screenshotPath = resolve(SCREENSHOT_DIR, `workbench-${slug}.png`);
    const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
    expect(buf.length).toBeGreaterThan(10_000);
    await testInfo.attach(`workbench-${slug}.png`, {
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
  await expect(page.getByRole("tab", { name: "SDD Studio" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Infrastructure").first()).toBeVisible();
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
  await expect(page.getByText("Replacement Feature").first()).toBeVisible();
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
  await expect(page.getByRole("button", { name: /^Import notes/i })).toBeVisible();

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

for (const viewport of SDD_STUDIO_VIEWPORTS) {
  test(`SDD Studio launchpad stays actionable in ${viewport.name} layout`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await postEmptyWorkbenchUpdate(page);

    const studio = page.locator('[data-afx-sdd-studio="home"]');
    await expect(studio).toBeVisible();
    await expect(studio.getByRole("button", { name: /^Full spec/i })).toBeVisible();
    await expect(studio.getByRole("button", { name: /^Fast sprint/i })).toBeVisible();
    await expect(studio.getByRole("button", { name: /^Bugfix/i })).toBeVisible();
    await expect(studio.getByRole("button", { name: /^Research/i })).toBeVisible();
    await expect(studio.getByRole("button", { name: /^Import notes/i })).toBeVisible();
    await expect(studio.getByRole("button", { name: /^Refine existing/i })).toBeVisible();
    await expect(studio.getByText("Active refinement")).toBeVisible();
    await expect(studio.getByText("Changed docs")).toBeVisible();
    await expectNoPageOverflow(page);

    await captureWorkbenchScreenshot(page, testInfo, `sdd-studio-launchpad-${viewport.name}.png`);

    await studio.getByRole("button", { name: /^Full spec/i }).click();
    const drawer = page.getByTestId("sdd-guided-start-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Describe the SDD outcome").fill("Checkout redesign");
    await expect(drawer.getByText("/afx-spec new checkout-redesign")).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Draft command" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Start now" })).toBeVisible();
    await expectNoPageOverflow(page);

    await captureWorkbenchScreenshot(
      page,
      testInfo,
      `sdd-studio-guided-start-${viewport.name}.png`,
    );
  });
}

for (const viewport of [
  { name: "compact", width: 760, height: 360 },
  { name: "wide", width: 1440, height: 760 },
] as const) {
  test(`SDD Studio modes stay clear and actionable in ${viewport.name} layout`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await page.evaluate(() => {
      const w = window as typeof window & {
        __afxOutboundMessages?: Array<{
          command?: string;
          mode?: string;
          path?: string;
          type?: string;
        }>;
      };
      w.__afxOutboundMessages = [];
      window.addEventListener("message", (event: MessageEvent) => {
        const msg = event.data as
          | { command?: string; mode?: string; path?: string; type?: string }
          | undefined;
        if (msg?.type === "afxOpenChatCommand" || msg?.type === "afxOpenFile") {
          w.__afxOutboundMessages?.push(msg);
        }
      });
    });

    const header = page.locator('[data-afx-sdd-studio="header"]');
    await expect(header).toBeVisible();
    await expect(header.getByRole("button", { name: "Select SDD feature" })).toBeVisible();
    await expect(page.getByText("View mode")).toBeVisible();
    await expect(page.getByTestId("sdd-feature-summary")).toContainText("Status");
    await expect(page.getByTestId("sdd-feature-summary")).toContainText("Tasks");
    await expect(header.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(header.getByRole("button", { name: "Focus doc" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Compare docs" })).toBeVisible();
    if (viewport.name === "compact") {
      await expect
        .poll(async () => {
          const box = await header.boundingBox();
          return Math.round(box?.height ?? 999);
        })
        .toBeLessThanOrEqual(72);
    }

    const cockpit = page.getByTestId("sdd-studio-cockpit");
    await expect(cockpit).toBeVisible();
    await expect(cockpit.getByText("Next work")).toBeVisible();
    await expect(cockpit.getByText("Needs attention")).toBeVisible();
    await expect(cockpit.getByText("Role modes")).toBeVisible();
    await expect(cockpit.getByText("Active docs")).toBeVisible();
    await expect(cockpit.getByRole("button", { name: /^Coach\b/i })).toBeVisible();
    await expect(cockpit.getByRole("button", { name: /^Architect\b/i })).toBeVisible();
    await expect(cockpit.getByRole("button", { name: /^Dev\b/i })).toBeVisible();
    await expect(cockpit.getByRole("button", { name: /^Ship\b/i })).toBeVisible();
    await expectNoPageOverflow(page);
    await captureWorkbenchScreenshot(page, testInfo, `sdd-studio-cockpit-${viewport.name}.png`);

    await header.getByRole("button", { name: "Focus doc" }).click();
    const focus = page.getByTestId("sdd-studio-focus");
    await expect(focus).toBeVisible();
    await expect(focus.getByText("Workflow")).toBeVisible();
    await expect(focus.getByText("Needs attention")).toBeVisible();
    await focus
      .getByRole("button", { name: /^Design\b/i })
      .first()
      .click();
    await expect(page.getByTestId("sdd-studio-focus-design")).toBeVisible();
    await expect(focus.getByText("docs/specs/15-infrastructure/design.md")).toBeVisible();
    await expectNoPageOverflow(page);
    await captureWorkbenchScreenshot(page, testInfo, `sdd-studio-focus-${viewport.name}.png`);

    await header.getByRole("button", { name: "Compare docs" }).click();
    const compare = page.locator('[data-afx-sdd-studio="compare"]');
    await expect(compare).toBeVisible();
    await expect(page.getByTestId("workbench-column-toggles")).toHaveAccessibleName(
      "Show or hide SDD Studio compare documents",
    );
    await expect(page.getByRole("button", { name: "Hide Spec document column" })).toBeVisible();
    await page.getByRole("button", { name: "Hide Spec document column" }).click();
    await expect(page.getByRole("button", { name: "Show Spec document column" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.getByRole("button", { name: "Show Spec document column" }).click();

    await page
      .getByTestId("workbench-column-spec")
      .getByRole("button", { name: /^Refine spec$/i })
      .click();
    await page
      .getByRole("button", { name: /^Open in AFX Preview$/i })
      .first()
      .click();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const w = window as typeof window & {
            __afxOutboundMessages?: Array<{ mode?: string; type?: string }>;
          };
          return (w.__afxOutboundMessages ?? []).some(
            (msg) => msg.type === "afxOpenFile" && msg.mode === "afxPreview",
          );
        }),
      )
      .toBe(true);

    const messages = await page.evaluate(() => {
      const w = window as typeof window & {
        __afxOutboundMessages?: Array<{
          command?: string;
          mode?: string;
          path?: string;
          type?: string;
        }>;
      };
      return w.__afxOutboundMessages ?? [];
    });

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command: expect.stringMatching(/^\/afx-spec refine /),
          mode: "insert",
        }),
        expect.objectContaining({
          type: "afxOpenFile",
          mode: "afxPreview",
        }),
      ]),
    );
    await expectNoPageOverflow(page);

    await captureWorkbenchScreenshot(page, testInfo, `sdd-studio-compare-${viewport.name}.png`);
  });
}

test("SDD Studio remains clean in light compact theme", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 760, height: 360 });
  await page.goto("/");
  await page.evaluate(() => {
    document.body.classList.remove("vscode-dark");
    document.body.classList.add("vscode-light", "theme-meridian", "style-mira");
  });

  const header = page.locator('[data-afx-sdd-studio="header"]');
  await expect(header).toBeVisible();
  await expect(header.getByRole("button", { name: "Select SDD feature" })).toBeVisible();
  await expect(page.getByTestId("sdd-studio-cockpit")).toBeVisible();
  await expect
    .poll(async () => {
      const box = await header.boundingBox();
      return Math.round(box?.height ?? 999);
    })
    .toBeLessThanOrEqual(72);
  await expectNoPageOverflow(page);

  await captureWorkbenchScreenshot(page, testInfo, "sdd-studio-light-compact.png");
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
  await page.getByRole("button", { name: "Read Infrastructure SPEC" }).click();

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

// E2E-17: a library row has an explicit refinement launch that targets the
// selected AFX document in the standalone Preview cockpit.
test("documents library Refine opens the correct AFX Preview cockpit", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await page.evaluate(() => {
    const w = window as typeof window & {
      __afxOutboundMessages?: Array<{ mode?: string; path?: string; type?: string }>;
    };
    w.__afxOutboundMessages = [];
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data as { mode?: string; path?: string; type?: string } | undefined;
      if (msg?.type === "afxOpenFile") w.__afxOutboundMessages?.push(msg);
    });
  });
  await page.getByRole("tab", { name: "Documents" }).click();

  const refine = page.getByRole("button", { name: "Refine Asset Recovery" });
  await expect(refine).toBeVisible();
  await refine.click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as typeof window & {
          __afxOutboundMessages?: Array<{ mode?: string; path?: string; type?: string }>;
        };
        return w.__afxOutboundMessages?.at(-1) ?? null;
      }),
    )
    .toEqual({
      type: "afxOpenFile",
      path: "docs/specs/16-marketplace-asset-recovery/spec.md",
      mode: "afxPreview",
    });

  await expectNoPageOverflow(page);
  const screenshotPath = resolve(SCREENSHOT_DIR, "e2e-17-documents-refine.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("e2e-17-documents-refine.png", {
    body: buf,
    contentType: "image/png",
  });
  expect(buf.length).toBeGreaterThan(10_000);
});

// E2E-16: blocked work has an explicit action that opens the relevant task
// document in the refinement Preview instead of a generic markdown preview.
test("pipeline Refine blockers opens the blocked feature in AFX Preview", async ({
  page,
}, testInfo) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.goto("/");
  await page.evaluate(() => {
    const w = window as typeof window & {
      __afxOutboundMessages?: Array<{ mode?: string; path?: string; type?: string }>;
    };
    w.__afxOutboundMessages = [];
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data as { mode?: string; path?: string; type?: string } | undefined;
      if (msg?.type === "afxOpenFile") w.__afxOutboundMessages?.push(msg);
    });
    window.postMessage(
      {
        type: "afxUpdate",
        pipeline: [
          {
            name: "2.4.0-release-readiness",
            specStatus: "Approved",
            designStatus: "Approved",
            tasksStatus: "In Progress",
            completed: 9,
            total: 12,
            featureStatus: "blocked",
            specPath: "docs/specs/2.4.0-release-readiness/spec.md",
            designPath: "docs/specs/2.4.0-release-readiness/design.md",
            tasksPath: "docs/specs/2.4.0-release-readiness/tasks.md",
          },
        ],
      },
      "*",
    );
  });
  await page.getByRole("tab", { name: "Pipeline" }).click();

  const refineBlockers = page.getByRole("button", {
    name: /2\.4\.0-release-readiness.*Refine blockers/i,
  });
  await expect(refineBlockers).toBeVisible();
  await refineBlockers.click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const w = window as typeof window & {
          __afxOutboundMessages?: Array<{ mode?: string; path?: string; type?: string }>;
        };
        return w.__afxOutboundMessages?.at(-1) ?? null;
      }),
    )
    .toEqual({
      type: "afxOpenFile",
      path: "docs/specs/2.4.0-release-readiness/tasks.md",
      mode: "afxPreview",
    });

  await expectNoPageOverflow(page);
  const screenshotPath = resolve(SCREENSHOT_DIR, "e2e-16-pipeline-blocker-launch.png");
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach("e2e-16-pipeline-blocker-launch.png", {
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
  await page
    .getByLabel("SDD Studio view mode")
    .getByRole("button", { name: "Compare docs" })
    .click();
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

    for (const label of ["SDD Studio", "Pipeline", "Board", "Documents"]) {
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
