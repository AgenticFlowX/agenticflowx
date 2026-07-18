/**
 * Persistent History (session browser) webview visual + interaction checks.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-18] [FR-19] [FR-22]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-HISTORY-MOCKUPS] [DES-PERSISTENT-TEST]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { type Page, type TestInfo, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "../vscode-e2e/artifacts/chat/screenshots");

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const body = await page.screenshot({
    path: resolve(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
  await testInfo.attach(`${name}.png`, { body, contentType: "image/png" });
  expect(body.length).toBeGreaterThan(10_000);
}

test("history: lists sessions, searches, opens a transcript, and reopens", async ({
  page,
}, testInfo) => {
  // This visual journey writes three full-page screenshots and exercises the
  // clipboard. Give it Playwright's standard slow-test budget under the full
  // coverage -> browser-suite release chain; state assertions still gate each
  // transition, so a stalled session load cannot pass silently.
  test.slow();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("tab", { name: "History" }).click();

  // The persistent list renders the mock sessions.
  // @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14]
  await expect(page.getByText("Segment model picker")).toBeVisible();
  await expect(page.getByText("Wire OAuth refresh logging")).toBeVisible();
  await expect(page.getByText("Fix cloudflare provider")).toBeVisible();

  // Aggregate stats bar over all sessions.
  // @see docs/specs/213-app-chat-history/spec.md [FR-20]
  // @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-HISTORY-MOCKUPS]
  await expect(page.getByText("3 sessions")).toBeVisible();
  await expect(page.getByText("67 messages")).toBeVisible();
  await expect(page.getByText("2 projects")).toBeVisible();

  // Per-row project chip reveals the workspace folder in the OS file manager.
  // @see docs/specs/213-app-chat-history/spec.md [FR-20]
  // @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-BRIDGE]
  const pickerRow = page.getByTestId("session-row-sess-picker");
  const folderChip = pickerRow.getByRole("button", {
    name: "Reveal afx-vscode-v2 in file manager",
  });
  await expect(folderChip).toBeVisible();
  await folderChip.click(); // host-only side effect; the mock no-ops, must not error
  await capture(page, testInfo, "history-session-list");

  // Search filters the list.
  // @see docs/specs/213-app-chat-history/spec.md [FR-18]
  const search = page.getByRole("textbox", { name: "Search sessions" });
  await search.fill("cloudflare");
  await expect(page.getByText("Fix cloudflare provider")).toBeVisible();
  await expect(page.getByText("Segment model picker")).toHaveCount(0);
  await capture(page, testInfo, "history-search");
  await search.fill("");

  // Open a session for read-only display.
  // @see docs/specs/213-app-chat-history/spec.md [FR-15]
  await page
    .getByRole("button", { name: /Segment model picker/ })
    .first()
    .click();
  const transcript = page.getByLabel("Session transcript");
  await expect(transcript.getByText("Read-only")).toBeVisible();
  await expect(
    transcript.getByText("Make the model picker segment API vs subscription"),
  ).toBeVisible();
  await expect(transcript.getByText("Added a filter input above the groups.")).toBeVisible();
  await expect(transcript.getByText("pnpm verify")).toBeVisible();

  // Copy Session Recap produces marketing/release-friendly Markdown without
  // leaking local session handles or full cwd paths.
  // @see docs/specs/213-app-chat-history/spec.md [FR-22] [NFR-2]
  await transcript.getByRole("button", { name: "Copy session recap" }).click();
  const recap = await page.evaluate(() => navigator.clipboard.readText());
  expect(recap).toContain("# Segment model picker");
  expect(recap).toContain("- Project: afx-vscode-v2");
  expect(recap).toContain("- Messages: 42");
  expect(recap).toContain("- First prompt: Make the model picker segment API vs subscription");
  expect(recap).toContain("- Assistant: Added a filter input above the groups.");
  expect(recap).toContain("- Bash: pnpm verify (exit 0)");
  expect(recap).not.toContain("/sessions/");
  expect(recap).not.toContain("/workspace/");
  await capture(page, testInfo, "history-transcript");

  // Reopen & continue jumps to the Chat tab and rehydrates the conversation.
  // @see docs/specs/213-app-chat-history/spec.md [FR-16]
  await transcript.getByRole("button", { name: "Reopen & continue" }).click();
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByLabel("Conversation").getByText("Added a filter input above the groups."),
  ).toBeVisible();
  await capture(page, testInfo, "history-after-reopen");

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("history: delete removes rows and shows the empty state", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/");
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Fix cloudflare provider")).toBeVisible();

  // The delete affordance is revealed on row hover (collapsed otherwise).
  const deleteRow = async (testId: string, name: string) => {
    const row = page.getByTestId(testId);
    await row.hover();
    await row.getByRole("button", { name }).click();
  };

  // Delete one session row.
  // @see docs/specs/213-app-chat-history/spec.md [FR-19]
  await deleteRow("session-row-sess-cloudflare", "Delete Fix cloudflare provider");
  await expect(page.getByText("Fix cloudflare provider")).toHaveCount(0);
  await expect(page.getByText("Segment model picker")).toBeVisible();

  // Delete the rest → empty state.
  await deleteRow("session-row-sess-picker", "Delete Segment model picker");
  await deleteRow("session-row-sess-oauth", "Delete Wire OAuth refresh logging");
  await expect(page.getByText("No past conversations yet")).toBeVisible();
  await capture(page, testInfo, "history-empty");
});
