/**
 * Spec mode UX — Playwright e2e against the browser dev harness.
 *
 * Drives `chat/setMode` through the ModeToggle dropdown and asserts the
 * end-to-end behavior: SpecModeWelcome card replaces the default empty state,
 * the composer InputGroup picks up `data-workspace-mode="spec"`, and the
 * footer hint flips to the planning copy. Mode switching is round-tripped
 * through the host bridge (mock transport replays a fresh settings snapshot).
 *
 * @see docs/specs/100-package-shared/spec.md [FR-11]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-14] [FR-15] [FR-17] [FR-18]
 * @see docs/specs/212-app-chat-messages/spec.md [FR-8]
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 */
import { type Page, expect, test } from "@playwright/test";

async function selectMode(page: Page, label: "Code" | "Explore" | "Spec"): Promise<void> {
  await page.getByRole("button", { name: "Workspace mode" }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
}

test.describe("Spec mode UX (FR-11 / FR-14 / FR-8)", () => {
  test("Spec entry is offered in the workspace-mode dropdown", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Workspace mode" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Spec/ })).toBeVisible();
    // SDD framing — the dropdown menuitemradio description references Spec-Driven Development.
    await expect(
      page.getByRole("menuitemradio", { name: /Spec-Driven Development/i }),
    ).toBeVisible();
  });

  test("switching to Spec mode renders the SDD welcome card", async ({ page }) => {
    await page.goto("/");
    await selectMode(page, "Spec");

    // Heading reads "Spec-driven workflow".
    await expect(page.getByRole("heading", { name: /Spec-driven workflow/i })).toBeVisible();
    // The SDD onboarding tagline.
    await expect(page.getByText(/Spec -> design -> tasks/i)).toBeVisible();
    // Onboarding starter buttons.
    await expect(page.getByRole("button", { name: /Create first spec/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Explore an idea/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start lean/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Resume workflow/i })).toBeVisible();
  });

  test("Spec mode applies data-workspace-mode='spec' to the InputGroup wrapper", async ({
    page,
  }) => {
    await page.goto("/");
    await selectMode(page, "Spec");

    // The InputGroup carries .afx-surface-composer; the data attribute drives
    // the violet border accent CSS.
    const composer = page.locator(".afx-surface-composer").first();
    await expect(composer).toHaveAttribute("data-workspace-mode", "spec");
  });

  test("Spec mode footer hint reads 'Planning / Docs only · ⌘⇧M to switch'", async ({ page }) => {
    await page.goto("/");
    await selectMode(page, "Spec");
    await expect(page.getByText(/Planning \/ Docs only/)).toBeVisible();
  });

  test("clicking 'Resume workflow' inserts /afx-next into the composer draft", async ({ page }) => {
    await page.goto("/");
    await selectMode(page, "Spec");
    await page.getByRole("button", { name: /Resume workflow/i }).click();
    const composer = page.locator("#afx-chat-composer");
    await expect(composer).toHaveValue(/\/afx-next/);
  });

  test("switching back to Code mode restores the default welcome", async ({ page }) => {
    await page.goto("/");
    await selectMode(page, "Spec");
    await expect(page.getByRole("heading", { name: /Spec-driven workflow/i })).toBeVisible();

    await selectMode(page, "Code");
    // Code-mode landing intro replaces the Spec welcome.
    await expect(page.getByText(/Chat-first by default/i)).toBeVisible({ timeout: 5_000 });
    // Composer accent should clear.
    const composer = page.locator(".afx-surface-composer").first();
    await expect(composer).toHaveAttribute("data-workspace-mode", "code");
  });

  test("doc-action More/focus menu drafts refinements while result-action chips run directly", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
    await page.getByRole("button", { name: /Spec actions/i }).click();
    await page.getByRole("button", { name: "Toggle Debug Panel" }).click();

    await expect(page.getByText(/spec\.md/i).first()).toBeVisible();
    await page.getByRole("button", { name: "More document actions" }).click();
    await expect(page.getByRole("menuitem", { name: /Performance/i })).toBeVisible();
    await page.getByRole("menuitem", { name: /Performance/i }).click();

    const composer = page.locator("#afx-chat-composer");
    await expect(composer).toHaveValue(/\/afx-spec refine auth performance/);

    await expect(page.getByTestId("result-action-button")).toContainText("/afx-task code 2.3");
    await page.getByTestId("result-action-button").click();
    await expect(composer).toHaveValue(/\/afx-spec refine auth performance/);
    await expect(
      page.locator("div.whitespace-pre-wrap").filter({ hasText: /^\/afx-task code 2\.3$/ }),
    ).toBeVisible({ timeout: 5_000 });
  });

  // @see docs/specs/211-app-chat-composer/spec.md [FR-17] [FR-18]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
  test("spec stepper renders three pills with the active doc highlighted + Related tier-2 label", async ({
    page,
  }) => {
    await page.goto("/");

    // Trigger the spec doc-actions scenario — populates activeDocContext with
    // siblingPaths, sibling statuses, and tasksCompleted/tasksTotal so the
    // stepper has data to render.
    await page.getByRole("button", { name: "Toggle Debug Panel" }).click();
    await page.getByRole("button", { name: /Spec actions/i }).click();
    await page.getByRole("button", { name: "Toggle Debug Panel" }).click();

    // Stepper appears inside the doc-actions strip.
    const stepper = page.getByTestId("spec-stepper");
    await expect(stepper).toBeVisible();

    // Three numbered segments — Spec is the active one (docKind=spec).
    await expect(page.getByTestId("spec-stepper-segment-spec")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(page.getByTestId("spec-stepper-segment-design")).toBeVisible();
    await expect(page.getByTestId("spec-stepper-segment-tasks")).toBeVisible();
    // Code pill + resume button were dropped in the round-2 polish.
    await expect(page.getByTestId("spec-stepper-segment-code")).toHaveCount(0);
    await expect(page.getByTestId("spec-stepper-resume")).toHaveCount(0);

    // Tier-2 carries the explicit "Related" label so the chips read as
    // sibling artifacts, not stranded UI.
    await expect(stepper.getByText("Related")).toBeVisible();
  });

  // @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
  test("Memory triggers (top-right + composer toolbar) open the shared catalog", async ({
    page,
  }) => {
    await page.goto("/");

    // Both the header and composer toolbar anchor the same MEMORY_CATALOG —
    // single-source content per
    //   @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
    // (rendered via the shared MemoryDropdown component).
    const memoryTriggers = page.getByRole("button", { name: "Open memory menu" });
    await expect(memoryTriggers).toHaveCount(2);

    await memoryTriggers.last().click();
    await expect(page.getByText("SESSION MEMORY")).toBeVisible();
    await expect(page.getByText("DISCUSSION")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Save: \/afx-context save/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Recap: \/afx-session recap/i })).toBeVisible();

    // Mutating Memory commands stay draft-first, never auto-send.
    //   @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
    //   @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
    await page.getByRole("menuitem", { name: /Save: \/afx-context save/i }).click();
    const composer = page.locator("#afx-chat-composer");
    await expect(composer).toHaveValue(/\/afx-context save/);
  });
});
