/**
 * Per-message copy affordance e2e coverage.
 * Hovers a message row in the conversation timeline, clicks the copy button,
 * and verifies the message's raw content lands on the clipboard.
 *
 * @see docs/specs/900-fleet/17-release-hardening-pi-features/17-release-hardening-pi-features.md [FR-24]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
 */
import { expect, test } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("copying a message row places its content on the clipboard", async ({ page }) => {
  await page.goto("/");

  const composer = page.getByRole("textbox", { name: "Chat composer" });
  await composer.fill("Hello copy test");
  await page.getByRole("button", { name: "Send" }).click();

  const conversation = page.getByLabel("Conversation");
  await conversation.getByText("Hello copy test").hover();

  const copyButton = page.getByRole("button", { name: "Copy message" }).first();
  await copyButton.click();

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Hello copy test");
});
