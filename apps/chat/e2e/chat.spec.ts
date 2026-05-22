/**
 * Chat webview smoke test.
 * Verifies the React app mounts and renders the root element.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-TEST]
 */
import { type Locator, expect, test } from "@playwright/test";

async function switchGeometry(toggle: Locator): Promise<{
  trackX: number;
  trackWidth: number;
  thumbX: number;
  thumbWidth: number;
}> {
  const track = toggle.locator('[data-slot="switch"]');
  const thumb = toggle.locator('[data-slot="switch-thumb"]');
  const [trackBox, thumbBox] = await Promise.all([track.boundingBox(), thumb.boundingBox()]);
  expect(trackBox, "switch track box").not.toBeNull();
  expect(thumbBox, "switch thumb box").not.toBeNull();
  return {
    trackX: trackBox!.x,
    trackWidth: trackBox!.width,
    thumbX: thumbBox!.x,
    thumbWidth: thumbBox!.width,
  };
}

test("chat root mounts", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
});

test("chat has no console errors on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toHaveLength(0);
});

test("renders all three primary tabs", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Chat", "History", "Settings"]) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }
  await expect(page.getByRole("tab", { name: "Explorer" })).toHaveCount(0);
});

test("Chat tab is selected by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
});

test("componentized chat shell exposes composer and top-bar actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("form", { name: "Compose message" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Chat composer" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Chat composer" })).toHaveAttribute(
    "aria-describedby",
    "afx-chat-composer-hint",
  );
  await expect(page.getByRole("button", { name: "Mention file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach file or image" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New session" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compact session" })).toBeVisible();
  await expect(page.getByRole("log")).toHaveCount(0);
});

test("active-file context switch moves the thumb when toggled", async ({ page }) => {
  await page.goto("/");

  const toggle = page.getByRole("switch", { name: "No active file" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  const checked = await switchGeometry(toggle);
  expect(checked.thumbX).toBeGreaterThan(checked.trackX + checked.trackWidth / 2 - 1);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await expect
    .poll(async () => {
      const unchecked = await switchGeometry(toggle);
      return checked.thumbX - unchecked.thumbX;
    })
    .toBeGreaterThan(2);

  const unchecked = await switchGeometry(toggle);
  expect(unchecked.thumbX).toBeLessThan(unchecked.trackX + unchecked.trackWidth / 2);
});

test("restart during streaming recovers the composer for the next send", async ({ page }) => {
  await page.goto("/");

  const composer = page.getByRole("textbox", { name: "Chat composer" });
  const conversation = page.getByLabel("Conversation");
  await composer.fill("start a long response");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(conversation.getByText("start a long response")).toBeVisible();
  const restart = page.getByRole("button", { name: "Restart agent" });
  await restart.click();
  await expect(composer).toBeEnabled({ timeout: 3_000 });

  await composer.fill("message after restart");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(conversation.getByText("message after restart")).toBeVisible();
  await expect(page.getByText("Agent runtime error")).toHaveCount(0);
  await expect(page.getByText(/Already streaming/i)).toHaveCount(0);
});

test("Composer Intent strip exposes slots and prompt preview", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("intent-strip")).toBeVisible();
  await expect(page.getByRole("button", { name: "Default Intent" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Ask Intent" }).click();
  await expect(page.getByRole("button", { name: "Ask Intent" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("intent-tagline")).toContainText("Ask");

  await page.getByRole("button", { name: "Preview injected prompt for Ask" }).click();
  await expect(page.getByText(/Mode: Ask/)).toBeVisible();
  await expect(
    page.getByText("Short intent guidance - about 26 tokens", { exact: true }),
  ).toBeVisible();
});

test("doc-actions force the Intent panel into compact header-only mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("intent-strip")).toBeVisible();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: "Sprint actions" }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });

  await expect(page.getByRole("region", { name: /Intent/i })).toBeVisible();
  await expect(page.getByTestId("intent-strip")).toBeHidden();
  await expect(page.getByTestId("spec-stepper")).toBeVisible();
  await expect(page.getByText(/Sprint file detected|AFX file detected/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch to Spec" })).toBeVisible();
  await page.getByRole("button", { name: /Switch Intent\. Current:/ }).click();
  await page.getByRole("menuitemradio", { name: /Architect/ }).click();
  await expect(
    page.getByRole("button", { name: "Switch Intent. Current: Architect" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Expand Intent|Minimize Intent/ })).toHaveCount(0);
});

test("componentized chat shell remains usable at narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("form", { name: "Compose message" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Chat composer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach file or image" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Chat: Ask/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Workflow: Open/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Spec: Plan/i })).toBeVisible();
});

test("can switch to Settings tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("Settings exposes runtime instance cards and RPC toggle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();

  // Navigate to the Runtimes group
  await page.getByRole("button", { name: "Runtimes", exact: true }).click();

  // SDK instance card is always rendered
  await expect(page.getByText("API Providers (bundled SDK)").first()).toBeVisible();
  // RPC card is always rendered with a toggle to enable it
  await expect(page.getByRole("switch", { name: "Enable Pi RPC" })).toBeVisible();
  // Behaviour card is always visible below the instance cards
  await expect(page.getByText("Thinking level")).toBeVisible();
  await expect(page.getByText("Model warm-up timeout")).toBeVisible();
  await expect(page.getByText("60s", { exact: true })).toBeVisible();
});

test("Settings exposes Composer Intent defaults and scope controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();

  await expect(page.getByText("Composer Intent")).toBeVisible();
  await expect(page.getByText(/Default thinking style for the next turn/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Ask/ })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Minimize Intent strip" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Global default/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /This workspace/ })).toBeVisible();
});

test("Settings guides hosted-key and custom-endpoint setup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();

  await expect(page.getByTestId("settings-connect-panel")).toBeVisible();
  await page.getByRole("button", { name: /Hosted API key/ }).click();
  const apiKey = page.getByLabel("API key").first();
  await expect(apiKey).toBeVisible();
  await expect(apiKey).toBeFocused();
  await expect(page.getByRole("button", { name: "Save key" })).toBeDisabled();

  await page.getByRole("button", { name: "Add custom endpoint" }).first().click();
  await expect(page.getByText("Endpoint", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Provider id *")).toHaveValue("custom");
  await expect(page.getByLabel("Base URL *")).toBeVisible();
  await expect(page.getByLabel("API key").last()).toBeVisible();
});

test("Settings keeps skills collapsed until requested", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Support", exact: true }).click();

  const skills = page.getByTestId("settings-skills-disclosure");
  await expect(skills.getByText("Skills & commands")).toBeVisible();
  await expect(skills).not.toHaveAttribute("open", "");
  await expect(skills.getByRole("button", { name: "/afx-task" })).toHaveCount(0);

  await skills.getByText("Skills & commands").click();
  await expect(skills).toHaveAttribute("open", "");
  await expect(skills.getByRole("button", { name: "/afx-task" })).toBeVisible();
  await expect(skills.getByRole("button", { name: "/afx-release" })).toBeVisible();
});

test("active tab has visible ::after strip indicator", async ({ page }) => {
  await page.goto("/");

  // Wait for ::after opacity to settle (transition-opacity is on the base element).
  async function waitForStripOpacity(tabName: string, expected: "visible" | "hidden") {
    const tab = page.getByRole("tab", { name: tabName });
    await page.waitForFunction(
      ([name, exp]: [string, string]) => {
        const el = [...document.querySelectorAll('[role="tab"]')].find(
          (t) => t.textContent?.trim() === name,
        );
        if (!el) return false;
        const opacity = parseFloat(window.getComputedStyle(el, "::after").opacity);
        return exp === "visible" ? opacity > 0.99 : opacity < 0.01;
      },
      [tabName, expected] as [string, string],
      { timeout: 2000 },
    );
    return tab.evaluate((el) => {
      const styles = window.getComputedStyle(el, "::after");
      return { opacity: styles.opacity, background: styles.backgroundColor };
    });
  }

  // Chat active by default — strip should be visible (non-transparent background)
  const chatAfter = await waitForStripOpacity("Chat", "visible");
  expect(chatAfter.background, `Chat (active) ::after background`).not.toBe("rgba(0, 0, 0, 0)");

  // History inactive — strip hidden
  await waitForStripOpacity("History", "hidden");

  // Switch to Settings and wait for transition to finish
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Settings now active — strip should be visible
  const settingsAfter = await waitForStripOpacity("Settings", "visible");
  expect(settingsAfter.background, `Settings (active) ::after background`).not.toBe(
    "rgba(0, 0, 0, 0)",
  );

  // Chat now inactive — strip hidden
  await waitForStripOpacity("Chat", "hidden");
});

test("context recovery scenario renders compaction then resumed answer", async ({ page }) => {
  await page.goto("/");

  const composer = page.locator("#afx-chat-composer");
  await composer.fill("/afx-session recap");
  await expect(composer).toHaveValue("/afx-session recap");
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeEnabled();
  await send.click();

  const compacted = page.getByRole("button", { name: /compacted/i }).first();
  await expect(compacted).toBeVisible({ timeout: 10_000 });
  await compacted.click();
  await expect(
    page.getByText(/Mock compaction kept the latest implementation context/).first(),
  ).toBeVisible();
  await expect(page.getByText(/Recovered after automatic compaction/).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/exceeds the context window/i)).toHaveCount(0);
});
