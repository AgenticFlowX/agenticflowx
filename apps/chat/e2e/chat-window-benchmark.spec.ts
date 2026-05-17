/**
 * Componentized chat window benchmark baseline.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF] [DES-TEST]
 */
import { type Page, expect, test } from "@playwright/test";

const BUDGETS = {
  hydrateMs: 3_000,
  // Measured through Playwright key dispatch while the e2e suite runs in
  // parallel, so this includes runner contention as well as React input work.
  composerTypingMs: 12_000,
  maxTimelineRows: 90,
  maxDomNodes: 30_000,
  maxHeapDeltaMb: 128,
};

interface BrowserMetrics {
  jsHeapUsedMb?: number;
  nodeCount?: number;
}

async function fireScenario(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
}

async function collectBrowserMetrics(page: Page, browserName: string): Promise<BrowserMetrics> {
  if (browserName !== "chromium") return {};

  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Performance.enable");
    await cdp.send("HeapProfiler.enable").catch(() => undefined);
    await cdp.send("HeapProfiler.collectGarbage").catch(() => undefined);
    const response = await cdp.send("Performance.getMetrics");
    const metric = (name: string) => response.metrics.find((item) => item.name === name)?.value;
    const jsHeapUsed = metric("JSHeapUsedSize");
    const nodes = metric("Nodes");
    return {
      jsHeapUsedMb:
        typeof jsHeapUsed === "number" ? Number((jsHeapUsed / 1024 / 1024).toFixed(2)) : undefined,
      nodeCount: typeof nodes === "number" ? Math.round(nodes) : undefined,
    };
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

test("long AI coding chat remains responsive and memory-bounded", async ({
  page,
  browserName,
}, testInfo) => {
  test.slow();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  const before = await collectBrowserMetrics(page, browserName);

  const hydrateStart = Date.now();
  await fireScenario(page, "Coding bench");
  const timeline = page.locator('ol[role="log"]');
  await expect(timeline).toContainText("Benchmark refactor slice 24", { timeout: 5_000 });
  const hydrateMs = Date.now() - hydrateStart;
  const timelineRows = await timeline.locator("[data-timeline-event]").count();

  const composer = page.locator("#afx-chat-composer");
  const prompt = [
    "Refactor the chat window benchmark harness with a realistic coding request:",
    "keep timeline rendering stable, preserve panel-local state, and report memory deltas.",
    "Add tests for keyboard, attachments, and top-bar focus recovery.",
  ].join(" ");
  const typingStart = Date.now();
  await composer.fill("");
  await composer.pressSequentially(prompt, { delay: 0 });
  const composerTypingMs = Date.now() - typingStart;
  await expect(composer).toHaveValue(prompt);

  const after = await collectBrowserMetrics(page, browserName);

  await page.getByRole("button", { name: "New session" }).click();
  await expect(composer).toBeFocused({ timeout: 2_000 });

  const heapDeltaMb =
    before.jsHeapUsedMb == null || after.jsHeapUsedMb == null
      ? undefined
      : Number(Math.max(0, after.jsHeapUsedMb - before.jsHeapUsedMb).toFixed(2));
  const metrics = {
    schema: "afx-chat-window-e2e-benchmark-v1",
    scenario: "coding-benchmark",
    budgets: BUDGETS,
    measurements: {
      hydrateMs,
      composerTypingMs,
      timelineRows,
      heapBeforeMb: before.jsHeapUsedMb,
      heapAfterMb: after.jsHeapUsedMb,
      heapDeltaMb,
      domNodes: after.nodeCount,
    },
  };
  await testInfo.attach("chat-window-benchmark.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });

  expect(consoleErrors).toEqual([]);
  expect(hydrateMs).toBeLessThanOrEqual(BUDGETS.hydrateMs);
  expect(composerTypingMs).toBeLessThanOrEqual(BUDGETS.composerTypingMs);
  expect(timelineRows).toBeGreaterThanOrEqual(40);
  expect(timelineRows).toBeLessThanOrEqual(BUDGETS.maxTimelineRows);
  if (after.nodeCount != null) {
    expect(after.nodeCount).toBeLessThanOrEqual(BUDGETS.maxDomNodes);
  }
  if (heapDeltaMb != null) {
    expect(heapDeltaMb).toBeLessThanOrEqual(BUDGETS.maxHeapDeltaMb);
  }
});

test("floating turn context appears only after the prompt scrolls out of view", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 920, height: 720 });
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();

  await fireScenario(page, "Coding bench");
  const pane = page.getByRole("region", { name: "Conversation" });
  const timeline = page.locator('ol[role="log"]');
  await expect(timeline).toContainText("Benchmark refactor slice 24", { timeout: 5_000 });

  await pane.evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(page.getByTestId("timeline-turn-context")).toHaveCount(0);
  const atTopScreenshot = testInfo.outputPath("timeline-context-at-turn-top.png");
  await page.screenshot({ path: atTopScreenshot });
  await testInfo.attach("timeline-context-at-turn-top.png", {
    path: atTopScreenshot,
    contentType: "image/png",
  });

  const context = page.getByTestId("timeline-turn-context").first();
  let foundContext = false;
  for (const scrollTop of [120, 180, 240, 320, 420, 560, 720]) {
    await pane.evaluate((node, nextScrollTop) => {
      node.scrollTop = nextScrollTop;
    }, scrollTop);
    await page.waitForTimeout(50);
    if ((await context.count()) > 0 && (await context.isVisible())) {
      foundContext = true;
      break;
    }
  }

  expect(foundContext).toBe(true);
  await expect(context).toBeVisible();
  await expect(context).toContainText("You");
  await expect(context).toContainText(/Benchmark refactor slice/);

  const floatingMetrics = await context.evaluate((node) => {
    const prompt = node.querySelector<HTMLElement>('[data-testid="timeline-turn-context-prompt"]');
    const time = node.querySelector<HTMLElement>('[data-testid="timeline-turn-context-time"]');
    if (!prompt || !time) {
      throw new Error("Floating turn context parts were not rendered");
    }

    const promptStyle = window.getComputedStyle(prompt);
    const timeStyle = window.getComputedStyle(time);
    const lineHeight = Number.parseFloat(promptStyle.lineHeight);
    const promptLineCount = Number.isFinite(lineHeight)
      ? prompt.getBoundingClientRect().height / lineHeight
      : 0;

    return {
      promptLineCount,
      promptLineClamp: promptStyle.webkitLineClamp,
      timeWhiteSpace: timeStyle.whiteSpace,
    };
  });

  expect(floatingMetrics.promptLineClamp).toBe("3");
  expect(floatingMetrics.promptLineCount).toBeLessThanOrEqual(3.25);
  expect(floatingMetrics.timeWhiteSpace).toBe("nowrap");

  const afterScrollScreenshot = testInfo.outputPath("timeline-context-after-scroll.png");
  await page.screenshot({ path: afterScrollScreenshot });
  await testInfo.attach("timeline-context-after-scroll.png", {
    path: afterScrollScreenshot,
    contentType: "image/png",
  });
});

test("sticky day header masks rail markers while transcript scrolls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 920, height: 720 });
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();

  await fireScenario(page, "Coding bench");
  const pane = page.getByRole("region", { name: "Conversation" });
  const timeline = page.locator('ol[role="log"]');
  await expect(timeline).toContainText("Benchmark refactor slice 24", { timeout: 5_000 });

  await pane.evaluate((node) => {
    node.scrollTop = 240;
  });
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-testid="timeline-day-header"]');
    const assistantMarker = document.querySelector<HTMLElement>(
      '[data-timeline-marker="assistant"]',
    );
    if (!header || !assistantMarker) {
      throw new Error("Timeline header or assistant marker was not rendered");
    }

    const alpha = (color: string) => {
      const rgba = color.match(/rgba?\(([^)]+)\)/);
      if (!rgba) return 1;
      const parts = rgba[1]?.split(",").map((part) => part.trim()) ?? [];
      return parts.length === 4 ? Number(parts[3]) : 1;
    };
    const headerStyle = window.getComputedStyle(header);
    const markerStyle = window.getComputedStyle(assistantMarker);

    return {
      headerAlpha: alpha(headerStyle.backgroundColor),
      headerZIndex: Number(headerStyle.zIndex),
      markerAlpha: alpha(markerStyle.backgroundColor),
      markerBoxShadow: markerStyle.boxShadow,
    };
  });

  expect(metrics.headerAlpha).toBe(1);
  expect(metrics.headerZIndex).toBeGreaterThanOrEqual(20);
  expect(metrics.markerAlpha).toBe(1);
  expect(metrics.markerBoxShadow).toContain("rgb");

  const screenshot = testInfo.outputPath("timeline-header-marker-mask.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("timeline-header-marker-mask.png", {
    path: screenshot,
    contentType: "image/png",
  });
});
