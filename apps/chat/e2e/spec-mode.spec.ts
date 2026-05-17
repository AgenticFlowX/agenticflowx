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

async function openDocActionsScenario(
  page: Page,
  label:
    | "Spec actions"
    | "Sprint actions"
    | "Journal actions"
    | "Global journal"
    | "Sign Off ready",
): Promise<void> {
  await page.goto("/");
  await selectMode(page, "Spec");
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
}

async function openSpecDocActionsScenario(page: Page): Promise<void> {
  await openDocActionsScenario(page, "Spec actions");
}

test.describe("Spec mode UX (FR-11 / FR-14 / FR-8)", () => {
  test("Spec entry is offered in the workspace-mode dropdown", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Workspace mode" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Spec/ })).toBeVisible();
    // SDD framing — the dropdown explains that Spec mode is for planning first.
    await expect(page.getByText(/Plan before you code/i)).toBeVisible();
  });

  test("switching to Spec mode renders the SDD welcome card", async ({ page }) => {
    await page.goto("/");
    await selectMode(page, "Spec");

    await expect(page.getByRole("heading", { name: /Plan before you code/i })).toBeVisible();
    await expect(page.getByText(/Describe what you're building/i)).toBeVisible();
    await expect(page.getByLabel("What are you building?")).toBeVisible();
    await expect(page.getByRole("button", { name: /Plan a new feature/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Improve an existing spec/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Try a sample/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Explore an idea/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start lean/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /\/afx-context load/i })).toBeVisible();
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

  test("clicking 'Resume workflow' opens a command receipt that can insert /afx-next", async ({
    page,
  }) => {
    await page.goto("/");
    await selectMode(page, "Spec");
    await page
      .getByRole("button", { name: /Resume workflow/i })
      .filter({ hasText: "Ask AFX to inspect" })
      .click();
    await expect(
      page.getByRole("region", { name: /Find next best move command receipt/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Insert" }).click();
    const composer = page.locator("#afx-chat-composer");
    await expect(composer).toHaveValue(/\/afx-next/);
  });

  test("switching back to Code mode restores the default welcome", async ({ page }) => {
    await page.goto("/");
    await selectMode(page, "Spec");
    await expect(page.getByRole("heading", { name: /Plan before you code/i })).toBeVisible();

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
    await openSpecDocActionsScenario(page);

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
  test("spec stepper renders quiet nav pills and non-wrapping related chips", async ({ page }) => {
    await openSpecDocActionsScenario(page);

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
    await expect(page.getByTestId("spec-stepper-segment-spec")).toContainText(/1\s*Spec/);
    await expect(page.getByTestId("spec-stepper-segment-design")).toContainText(/2\s*Design/);
    await expect(page.getByTestId("spec-stepper-segment-tasks")).toContainText(/3\s*Tasks/);
    await expect(page.getByTestId("spec-stepper-segment-spec")).not.toContainText(
      /Draft|Approved|\.\.\./,
    );
    await expect(page.getByTestId("spec-stepper-segment-design")).not.toContainText(
      /Draft|Approved|\.\.\./,
    );
    await expect(page.getByTestId("spec-stepper-segment-tasks")).not.toContainText(
      /Draft|Approved|\.\.\./,
    );
    // Spec stepper only shows the active workflow documents.
    await expect(page.getByTestId("spec-stepper-segment-code")).toHaveCount(0);
    await expect(page.getByTestId("spec-stepper-resume")).toHaveCount(0);

    const related = page.getByTestId("spec-stepper-related-row");
    await expect(related).toBeVisible();
    await expect(related).toHaveCSS("flex-wrap", "nowrap");
    await expect(related).not.toContainText("Related");
    await expect(related.getByRole("button", { name: "Journal" })).toBeVisible();
    await expect(page.getByTestId("spec-stepper-sessions")).toContainText("Work Sessions");
  });

  // @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
  test("doc-action row keeps compact mono buttons and visible More at narrow widths", async ({
    page,
  }) => {
    await openSpecDocActionsScenario(page);
    await page.setViewportSize({ width: 430, height: 720 });

    const primaryRow = page.getByTestId("doc-actions-primary-row");
    await expect(primaryRow).toBeVisible();
    await expect(primaryRow).toHaveCSS("flex-wrap", "nowrap");

    const refine = page.getByRole("button", { name: "Refine options" });
    await expect(refine).toBeVisible();
    await expect(refine).toHaveCSS("height", "20px");
    await expect(refine).toHaveCSS("font-size", "10px");
    await expect(refine).toHaveClass(/font-mono/);

    const more = page.getByRole("button", { name: "More document actions" });
    await expect(more).toBeVisible();

    const metrics = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('[data-testid="doc-actions-row"]');
      const primary = document.querySelector<HTMLElement>(
        '[data-testid="doc-actions-primary-row"]',
      );
      const moreButton = document.querySelector<HTMLElement>(
        'button[aria-label="More document actions"]',
      );
      const related = document.querySelector<HTMLElement>(
        '[data-testid="spec-stepper-related-row"]',
      );
      if (!row || !primary || !moreButton || !related) {
        throw new Error("Expected doc-actions regression elements to be mounted");
      }

      const rowBox = row.getBoundingClientRect();
      const primaryBox = primary.getBoundingClientRect();
      const moreBox = moreButton.getBoundingClientRect();
      const relatedBox = related.getBoundingClientRect();
      const relatedStyle = window.getComputedStyle(related);
      const visibleRelatedChildren = Array.from(related.children).filter((child) => {
        const element = child as HTMLElement;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && box.width > 0 && box.height > 0;
      });

      return {
        rowRight: rowBox.right,
        rowWidth: rowBox.width,
        primaryRight: primaryBox.right,
        moreLeft: moreBox.left,
        moreRight: moreBox.right,
        moreWidth: moreBox.width,
        relatedDisplay: relatedStyle.display,
        relatedHeight: relatedBox.height,
        relatedChildLines: [
          ...new Set(
            visibleRelatedChildren.map((child) => Math.round(child.getBoundingClientRect().top)),
          ),
        ].length,
        viewportWidth: window.innerWidth,
      };
    });

    expect(metrics.rowWidth).toBeGreaterThan(300);
    expect(metrics.moreWidth).toBeGreaterThan(10);
    expect(metrics.moreLeft).toBeGreaterThanOrEqual(metrics.primaryRight - 1);
    expect(metrics.moreRight).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.rowRight - metrics.moreRight).toBeLessThanOrEqual(6);
    if (metrics.relatedDisplay !== "none") {
      expect(metrics.relatedHeight).toBeLessThanOrEqual(32);
      expect(metrics.relatedChildLines).toBeLessThanOrEqual(1);
    }
  });

  test("tasks Sign Off shares the compact mono action-button chrome", async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 720 });
    await openDocActionsScenario(page, "Sign Off ready");

    const primaryRow = page.getByTestId("doc-actions-primary-row");
    await expect(primaryRow).toBeVisible();

    for (const name of ["Code", "Review", "Verify", "Pick"]) {
      const button = primaryRow.getByRole("button", { name: new RegExp(`^${name}`) });
      await expect(button).toBeVisible();
      await expect(button).toHaveCSS("height", "20px");
      await expect(button).toHaveCSS("font-size", "10px");
      await expect(button).toHaveClass(/font-mono/);
    }

    const signOff = page.getByTestId("doc-actions-sign-off-button");
    await expect(signOff).toBeVisible();
    await expect(signOff).toHaveCSS("height", "20px");
    await expect(signOff).toHaveCSS("font-size", "10px");
    await expect(signOff).toHaveClass(/font-mono/);

    const metrics = await primaryRow.evaluate((row) =>
      Array.from(row.querySelectorAll("button")).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.getAttribute("aria-label") ?? button.textContent ?? "",
          height: Math.round(rect.height),
          fontSize: window.getComputedStyle(button).fontSize,
        };
      }),
    );

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("Sign Off"), height: 20 }),
      ]),
    );
    expect(metrics.every((button) => button.height <= 20 && button.fontSize === "10px")).toBe(true);
  });

  test("sprint doc-actions stepper jumps within the active single file", async ({ page }) => {
    await openDocActionsScenario(page, "Sprint actions");

    await page.getByRole("button", { name: /Design step/i }).click();

    await page.getByRole("button", { name: "Toggle Debug Panel" }).click({ force: true });
    await page.getByRole("tab", { name: "Log" }).click();
    await page.getByRole("button", { name: "Toggle entry chat/openFile" }).last().click();

    const payload = page.locator("pre").last();
    await expect(payload).toContainText(
      '"path": "/workspace/docs/specs/999-fleet/postgresql-marketplace-backend-rewrite.md"',
    );
    await expect(payload).toContainText('"line": 84');
  });

  test("journal doc-actions spend wide space on buttons and keep tight rows sane", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 760, height: 720 });
    await openDocActionsScenario(page, "Journal actions");

    const primaryRow = page.getByTestId("doc-actions-primary-row");
    await expect(primaryRow).toBeVisible();
    await expect(primaryRow).toHaveCSS("flex-wrap", "nowrap");
    await expect(primaryRow).toContainText("Note");
    await expect(primaryRow).toContainText("Log");
    await expect(primaryRow).toContainText("Recap");
    await expect(primaryRow).toContainText("Promote");
    await expect(primaryRow).toContainText("Capture");

    const more = page.getByRole("button", { name: "More document actions" });
    await expect(more).toBeVisible();
    await expect(page.getByTestId("spec-stepper-related-row")).not.toContainText("Related");

    const wideMetrics = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('[data-testid="doc-actions-row"]');
      const primary = document.querySelector<HTMLElement>(
        '[data-testid="doc-actions-primary-row"]',
      );
      const moreButton = document.querySelector<HTMLElement>(
        'button[aria-label="More document actions"]',
      );
      const related = document.querySelector<HTMLElement>(
        '[data-testid="spec-stepper-related-row"]',
      );
      if (!row || !primary || !moreButton || !related) {
        throw new Error("Expected journal doc-actions regression elements to be mounted");
      }

      const rowBox = row.getBoundingClientRect();
      const moreBox = moreButton.getBoundingClientRect();
      const relatedBox = related.getBoundingClientRect();
      const visibleRelatedChildren = Array.from(related.children).filter((child) => {
        const element = child as HTMLElement;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && box.width > 0 && box.height > 0;
      });

      return {
        moreRightGap: rowBox.right - moreBox.right,
        primaryText: primary.textContent ?? "",
        relatedChildLines: [
          ...new Set(
            visibleRelatedChildren.map((child) => Math.round(child.getBoundingClientRect().top)),
          ),
        ].length,
        relatedHeight: relatedBox.height,
      };
    });

    expect(wideMetrics.primaryText).toMatch(/Note.*Log.*Promote.*Capture.*Recap/);
    expect(wideMetrics.moreRightGap).toBeLessThanOrEqual(6);
    expect(wideMetrics.relatedHeight).toBeLessThanOrEqual(32);
    expect(wideMetrics.relatedChildLines).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 360, height: 720 });
    await expect(primaryRow).toContainText("Note");

    const tightMetrics = await page.evaluate(() => {
      const primary = document.querySelector<HTMLElement>(
        '[data-testid="doc-actions-primary-row"]',
      );
      const related = document.querySelector<HTMLElement>(
        '[data-testid="spec-stepper-related-row"]',
      );
      if (!primary || !related) {
        throw new Error("Expected journal doc-actions regression elements to be mounted");
      }

      const relatedBox = related.getBoundingClientRect();
      const visibleRelatedChildren = Array.from(related.children).filter((child) => {
        const element = child as HTMLElement;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && box.width > 0 && box.height > 0;
      });

      return {
        primaryText: primary.textContent ?? "",
        clippedPrimaryButtons: Array.from(primary.querySelectorAll("button")).filter(
          (button) =>
            button.getBoundingClientRect().right > primary.getBoundingClientRect().right + 1,
        ).length,
        relatedHeight: relatedBox.height,
        relatedChildLines: [
          ...new Set(
            visibleRelatedChildren.map((child) => Math.round(child.getBoundingClientRect().top)),
          ),
        ].length,
      };
    });

    expect(tightMetrics.primaryText.trim()).not.toBe("...");
    expect(tightMetrics.clippedPrimaryButtons).toBe(0);
    expect(tightMetrics.relatedHeight).toBeLessThanOrEqual(32);
    expect(tightMetrics.relatedChildLines).toBeLessThanOrEqual(1);
  });

  test("global journal doc-actions stay session-only when no feature is selected", async ({
    page,
  }) => {
    await openDocActionsScenario(page, "Global journal");

    await expect(page.getByTestId("spec-stepper")).toHaveCount(0);
    await expect(page.getByTestId("doc-actions-primary-row")).toContainText("Note");
    await page.getByRole("button", { name: "Note: Draft first" }).click();
    await expect(page.locator("#afx-chat-composer")).toHaveValue(/^\/afx-session note$/);
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
