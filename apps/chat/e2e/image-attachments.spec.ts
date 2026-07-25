/**
 * Image attachment lifecycle and capability-gate e2e coverage.
 * Exercises the real React app against the mock transport (packages/transport/src/mock.ts):
 * chat/selectImages -> chat/imagesSelected (requestId-correlated), attach -> send, the
 * text-only model capability gate on Send, and tray clearing on new session.
 *
 * @see docs/specs/900-fleet/17-release-hardening-pi-features/17-release-hardening-pi-features.md [FR-3] [FR-5] [FR-7]
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES]
 */
import { expect, test } from "@playwright/test";

async function selectModelByName(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: /Model:/ }).click();
  await page.getByPlaceholder("Search models...").fill(name);
  await page.locator("[cmdk-list]").getByText(name, { exact: true }).click();
}

test("attach flow stages an image and shows a chip", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Attach image" }).click();

  const tray = page.getByLabel("Selected attachments");
  await expect(tray.getByText("mock-screenshot.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove mock-screenshot.png" })).toBeVisible();
});

test("image-only send clears the attachment tray", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Attach image" }).click();
  await expect(
    page.getByLabel("Selected attachments").getByText("mock-screenshot.png"),
  ).toBeVisible();

  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeEnabled();
  await send.click();

  await expect(page.getByLabel("Selected attachments")).toHaveCount(0);
});

test("capability gate blocks Send on a text-only model and keeps the attachment", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Attach image" }).click();
  const tray = page.getByLabel("Selected attachments");
  await expect(tray.getByText("mock-screenshot.png")).toBeVisible();

  await selectModelByName(page, "Claude Text-Only (E2E)");
  await expect(page.getByRole("button", { name: /Claude Text-Only \(E2E\)/ })).toBeVisible();

  const composer = page.getByRole("textbox", { name: "Chat composer" });
  await composer.fill("describe this screenshot");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText("This model accepts text only — remove the attached images or switch models."),
  ).toBeVisible();
  // Nothing was sent — the composer draft and the staged attachment both survive.
  await expect(composer).toHaveValue("describe this screenshot");
  await expect(tray.getByText("mock-screenshot.png")).toBeVisible();
});

test("an unknown-capability model still allows an image send", async ({ page }) => {
  await page.goto("/");

  // Default mock model has no declared `input` — capability is unknown and the
  // submit gate fails open per the agent contract.
  await page.getByRole("button", { name: "Attach image" }).click();
  await expect(
    page.getByLabel("Selected attachments").getByText("mock-screenshot.png"),
  ).toBeVisible();

  const composer = page.getByRole("textbox", { name: "Chat composer" });
  await composer.fill("describe this screenshot");
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeEnabled();
  await send.click();

  await expect(
    page.getByText("This model accepts text only — remove the attached images or switch models."),
  ).toHaveCount(0);
  await expect(page.getByLabel("Selected attachments")).toHaveCount(0);
});

test("new session clears the attachment tray", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Attach image" }).click();
  await expect(
    page.getByLabel("Selected attachments").getByText("mock-screenshot.png"),
  ).toBeVisible();

  await page.getByRole("button", { name: "New session" }).click();

  await expect(page.getByLabel("Selected attachments")).toHaveCount(0);
  await expect(page.getByText("New session started")).toBeVisible();
});
