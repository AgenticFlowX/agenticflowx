/**
 * Session-level top-bar actions and usage-warning e2e coverage.
 * Exercises the real React app against the mock transport (packages/transport/src/mock.ts):
 * chat/exportSession -> chat/sessionExported, chat/renameSession round-tripped via
 * agent/runtimeSettings.sessionName, compact-with-focus, the cancelable-retry toast
 * action, and the local-only usage-warning threshold.
 *
 * @see docs/specs/900-fleet/17-release-hardening-pi-features/17-release-hardening-pi-features.md [FR-20] [FR-21] [FR-22] [FR-23] [FR-25]
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES]
 */
import { expect, test } from "@playwright/test";

test("export transcript surfaces a success toast", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Export transcript" }).click();

  await expect(page.getByText("Transcript exported")).toBeVisible();
});

test("rename session round-trips the new name via runtime settings", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Rename session" }).click();
  const input = page.getByLabel("Session name");
  await input.fill("Renamed E2E Session");
  await page.getByRole("button", { name: "Rename", exact: true }).click();

  // The popover closes optimistically; agent/runtimeSettings.sessionName is the
  // source of truth, so reopening the popover must show the host-confirmed name.
  await page.getByRole("button", { name: "Rename session" }).click();
  await expect(page.getByLabel("Session name")).toHaveValue("Renamed E2E Session");
});

test("compact with focus sends custom instructions and compacts the session", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Compact with focus" }).click();
  const input = page.getByLabel("What should the summary keep?");
  await input.fill("decisions about the parser rewrite");
  await page.getByRole("button", { name: "Compact", exact: true }).click();

  // chat/compact doesn't inject a timeline card (only the /afx-session recap
  // scenario does, to simulate a host-initiated recovery); the observable
  // result of a plain compact-with-focus is the completion toast.
  await expect(page.getByText("Session compacted")).toBeVisible({ timeout: 5_000 });
});

test("a cancelable-retry toast exposes a Cancel retry action", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Retry recovery" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });

  const cancelButton = page.getByRole("button", { name: "Cancel retry" });
  await expect(cancelButton).toBeVisible({ timeout: 5_000 });
  await cancelButton.click();
  await expect(cancelButton).toHaveCount(0);
});

test("usage warning emphasizes the composer footer and toasts once a threshold is crossed", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Runtimes", exact: true }).click();
  await page.getByRole("switch", { name: "Usage warning" }).click();
  await page.getByLabel("Session cost (USD)").fill("1");

  await page.getByRole("tab", { name: "Chat" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Ctx near full" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });

  await expect(page.getByRole("status").getByText("Usage warning").first()).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator('[data-usage-warning="true"]')).toBeVisible();
});
