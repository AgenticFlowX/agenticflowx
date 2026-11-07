import { expect, test } from "@playwright/test";

test("Blueprint review and collapsed Stop are operable by keyboard", async ({ page }) => {
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "Chat composer" });
  await composer.fill("/afx-nex");
  await expect(page.getByRole("option", { name: /afx-next/ })).toBeVisible();
  await composer.press("Enter");
  await expect(composer).toHaveValue("/afx-next ");
  await composer.fill("/afx-blueprint");
  await expect(page.getByText('No commands match "/afx-blueprint".')).toBeVisible();
  await composer.press("Enter");
  const rail = page.getByRole("region", { name: "Blueprint workflow" });
  const heading = rail.getByRole("button", { expanded: true });
  await heading.focus();
  await page.keyboard.press("Tab");
  await expect(rail.getByRole("button", { name: "Inspect project", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();
  await expect(rail.getByRole("status")).toHaveText("Blueprint investigation in progress.");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(rail.getByRole("button", { name: "Stop investigation" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rail.getByRole("status")).toHaveText("3 Blueprint findings ready for review.");
  await expect(rail.getByRole("button", { expanded: false })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rail.getByRole("button", { name: "Save Blueprint", exact: true })).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(rail.getByRole("button", { name: "Review 3 findings" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(rail.getByRole("button", { name: "Save Blueprint", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rail.getByRole("button", { name: "Read Blueprint" })).toBeVisible();
});

test("Explore Blueprint rail reviews partial findings, saves, continues, and keeps Stop accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Workspace mode/ }).click();
  await page.getByRole("menuitemradio", { name: /Explore/ }).click();
  const rail = page.getByRole("region", { name: "Blueprint workflow" });
  await expect(rail).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await rail.getByRole("button", { name: "Inspect project", exact: true }).click();
  await expect(rail.getByRole("button", { name: "Stop investigation" })).toBeVisible();
  await rail.getByRole("button", { expanded: true }).click();
  await expect(rail.getByRole("button", { name: "Stop investigation" })).toBeVisible();
  await rail.getByRole("button", { name: "Stop investigation" }).click();
  await rail.getByRole("button", { expanded: false }).click();
  await expect(rail.getByRole("button", { name: "Save Blueprint", exact: true })).toBeDisabled();
  await rail.getByRole("button", { name: "Review 3 findings" }).click();
  await rail.getByRole("button", { name: "Save Blueprint", exact: true }).click();
  await expect(rail.getByRole("button", { name: "Read Blueprint" })).toBeVisible();
  await rail.getByRole("button", { name: "Continue investigation", exact: true }).click();
  await rail.getByRole("button", { name: "Stop investigation" }).click();
  await expect(rail.getByRole("button", { name: "Review 6 findings" })).toBeVisible();
  const width = await rail.evaluate((node) => ({
    scroll: node.scrollWidth,
    client: node.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await page.screenshot({ path: test.info().outputPath("blueprint-rail-narrow.png") });
});

test("reviewed maintenance and Sprint handoff remain explicit in Explore", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Chat composer" }).fill("/afx-blueprint");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const rail = page.getByRole("region", { name: "Blueprint workflow" });
  await expect(rail.getByRole("button", { name: "Inspect project", exact: true })).toBeVisible();
  await rail.getByRole("button", { name: "Inspect project", exact: true }).click();
  await rail.getByRole("button", { name: "Stop investigation" }).click();
  await rail.getByRole("button", { name: "Review 3 findings" }).click();
  await rail.getByRole("button", { name: "Save Blueprint", exact: true }).click();
  await rail.getByRole("button", { name: "Check Changes", exact: true }).click();
  await expect(rail).toContainText("no model call or artifact write");
  await rail.getByRole("button", { name: "Update Blueprint", exact: true }).click();
  await expect(rail.getByRole("button", { name: "Apply reviewed findings" })).toBeDisabled();
  await expect(rail).toContainText("Proposed update");
  await rail.getByRole("button", { name: "Review proposal" }).click();
  await rail.getByRole("button", { name: "Apply reviewed findings" }).click();
  await rail.getByText("More", { exact: true }).click();
  await rail.getByRole("button", { name: "Rebuild Blueprint", exact: true }).click();
  await expect(rail).toContainText("1 retired");
  await rail.getByRole("button", { name: "Discard draft" }).click();
  await rail.getByRole("button", { name: "Start Sprint" }).click();
  const handoff = page.getByRole("form", { name: "Review Blueprint Sprint handoff" });
  await expect(handoff.getByRole("button", { name: "Create Draft Sprint" })).toBeDisabled();
  await handoff.getByRole("button", { name: "Cancel handoff" }).click();
  await expect(handoff).not.toBeVisible();
  await expect(rail.getByRole("button", { expanded: true })).toBeFocused();
  await rail.getByRole("button", { name: "Start Sprint" }).click();
  await handoff.getByLabel("Sprint name").fill("Improve purpose");
  await handoff.getByLabel("Desired outcome").fill("Clarify project behavior");
  await handoff.getByLabel("Project purpose", { exact: true }).check();
  await handoff.getByLabel("Discussion to carry").fill("Selected discussion only");
  await page.setViewportSize({ width: 360, height: 900 });
  await page.screenshot({ path: test.info().outputPath("blueprint-sprint-handoff.png") });
  await handoff.getByRole("button", { name: "Create Draft Sprint" }).click();
  await expect(page.getByRole("button", { name: "Workspace mode: Spec" })).toBeVisible();
  await page.getByRole("button", { name: "Return to Blueprint", exact: true }).click();
  await expect(page.getByRole("button", { name: "Workspace mode: Explore" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Check Changes" })).toBeVisible();
});

test("Blueprint controls remain named and reachable in forced colors at narrow width", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const composer = page.getByRole("textbox", { name: "Chat composer" });
  await composer.fill("/afx-blueprint");
  await composer.press("Enter");
  const rail = page.getByRole("region", { name: "Blueprint workflow" });
  const heading = rail.getByRole("button", { expanded: true });
  await heading.focus();
  await page.keyboard.press("Tab");
  await expect(rail.getByRole("button", { name: "Inspect project", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(rail.getByRole("button", { name: "Stop investigation" })).toBeFocused();
  const width = await rail.evaluate((node) => ({
    scroll: node.scrollWidth,
    client: node.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  const accessibility = await rail.ariaSnapshot();
  expect(accessibility).toContain('button "Stop investigation"');
  expect(accessibility).toContain("Blueprint investigation in progress.");
  await page.screenshot({ path: test.info().outputPath("blueprint-forced-colors.png") });
});
