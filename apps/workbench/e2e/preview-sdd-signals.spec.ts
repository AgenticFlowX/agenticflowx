/**
 * Preview signal and open-question E2E coverage.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-7] [FR-11] [FR-14]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-STUDIO] [DES-DOCS-PREVIEW-STANDALONE] [DES-TEST]
 */
import { expect, test } from "@playwright/test";

import {
  attachPreviewScreenshot,
  bootInPreviewMode,
  expectNoPageOverflow,
  postPreview,
} from "./preview-test-helpers";

const SIGNAL_SPEC = `---
afx: true
type: SPEC
status: Draft
owner: "@rix"
version: "1.0"
created_at: "2026-06-27T00:00:00.000Z"
updated_at: "2026-06-27T00:00:00.000Z"
tags: ["checkout"]
---
# Checkout Redesign

## Problem Statement

Decision: keep the checkout redesign local-first until the approval workflow is stable.

## Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Show clear checkout state before payment. | Must |

## Open Questions

| Question | Owner | Status |
| --- | --- | --- |
| Should approval happen before design? | @rix | Open |
| Should guest checkout require email verification? | @product | Open |

## Acceptance Criteria

- Users can validate the success path before approving tasks.
`;

const BLANK_COLUMN_TABLE = `# Sprint Status

| Section | Status |  | Notes |
| --- | --- | --- | --- |
| Spec | Approved |  | Requirements satisfied by the worktree implementation. |
| Design | Approved |  | PostgreSQL schema built as designed. |
| Tasks | Approved |  | Phases 0-10 complete. |
| Doc | Living |  | Sprint status promoted to Living. |
`;

for (const viewport of [
  { name: "wide", width: 1440, height: 760 },
  { name: "narrow", width: 520, height: 720 },
] as const) {
  test(`Preview signals and open-question actions work in ${viewport.name} layout`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await bootInPreviewMode(page);
    await page.evaluate(() => {
      const original = window.parent.postMessage.bind(window.parent);
      const messages: unknown[] = [];
      Reflect.set(window, "__afxPreviewMessages", messages);
      window.parent.postMessage = (
        message: unknown,
        targetOrigin: string,
        transfer?: Transferable[],
      ) => {
        messages.push(message);
        return original(message, targetOrigin, transfer ?? []);
      };
    });
    await postPreview(page, "docs/specs/checkout-redesign/spec.md", SIGNAL_SPEC, true);

    if (viewport.name === "narrow") {
      await page.getByRole("button", { name: "Open outline" }).click();
    }
    const signals =
      viewport.name === "narrow"
        ? page.getByLabel("Document outline")
        : page.getByLabel("Document quality and outline");
    await expect(signals.getByText("Strategy")).toBeVisible();
    await expect(signals.getByText("Completeness")).toBeVisible();

    const coach = signals.locator('section[aria-label="Refinement coach"]');
    await expect(coach).toBeVisible();
    await expect(coach.getByText("Open Questions", { exact: true })).toBeVisible();
    await expect(coach.getByText("blocker", { exact: true })).toBeVisible();
    await expect(
      coach.getByText("Unresolved questions often block approval or implementation planning."),
    ).toBeVisible();
    await expect(coach.getByText("2 unresolved rows found.")).toBeVisible();
    await expect(coach.locator("p").filter({ hasText: "Suggested fix:" })).toHaveText(
      "Suggested fix: Resolve, intentionally defer, or capture the decision context.",
    );

    await coach.getByRole("button", { name: "Resolve questions" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => Reflect.get(window, "__afxPreviewMessages") as unknown[]),
      )
      .toContainEqual(
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command: "/afx-spec refine checkout-redesign open questions",
          mode: "insert",
        }),
      );

    if (viewport.name === "narrow") {
      await page.keyboard.press("Escape");
    }
    await expect(page.getByText("Open questions").first()).toBeVisible();
    await expect(
      page.locator('[data-afx-md-table-chip="info"]').filter({ hasText: "FR-1" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-afx-md-table-chip="warning"]').filter({ hasText: "Open" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Refine Requirements" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Draft answer for open question/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Resolve open question/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Capture open-question decision in journal/i }),
    ).toBeVisible();

    const questionToolbar = page.getByRole("toolbar", { name: "Question command toolbar" });
    await expect(
      questionToolbar.getByRole("button", { name: "Question command menu" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Draft answer for open question/i }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => Reflect.get(window, "__afxPreviewMessages") as unknown[]),
      )
      .toContainEqual(
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command:
            '/afx-spec refine checkout-redesign answer open question "Should approval happen before design?"',
          mode: "insert",
        }),
      );

    await page.getByRole("button", { name: /Resolve open question/i }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => Reflect.get(window, "__afxPreviewMessages") as unknown[]),
      )
      .toContainEqual(
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command:
            '/afx-spec refine checkout-redesign resolve open question "Should approval happen before design?"',
          mode: "insert",
        }),
      );

    await page.getByRole("button", { name: "Refine Requirements" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => Reflect.get(window, "__afxPreviewMessages") as unknown[]),
      )
      .toContainEqual(
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command: "/afx-spec refine checkout-redesign Requirements",
          mode: "insert",
        }),
      );

    await page.getByRole("button", { name: /Capture open-question decision in journal/i }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => Reflect.get(window, "__afxPreviewMessages") as unknown[]),
      )
      .toContainEqual(
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command: "/afx-session capture --links checkout-redesign open-questions",
          mode: "insert",
        }),
      );

    await questionToolbar.getByRole("button", { name: "Question command menu" }).click();
    const ignoreAction = page.getByRole("menuitem", { name: /Ignore/i });
    await expect(ignoreAction).toBeVisible();
    await ignoreAction.click();
    await expect
      .poll(async () =>
        page.evaluate(() => Reflect.get(window, "__afxPreviewMessages") as unknown[]),
      )
      .toContainEqual(
        expect.objectContaining({
          type: "afxOpenChatCommand",
          command:
            '/afx-session capture --links checkout-redesign ignored open question "Should approval happen before design?"',
          mode: "insert",
        }),
      );
    await expect(ignoreAction).toBeHidden();

    await expectNoPageOverflow(page);
    await attachPreviewScreenshot(page, testInfo, `preview-sdd-signals-${viewport.name}`);
  });
}

// E2E-13 v1 safety boundary: exact source-row mutation remains deliberately
// deferred. The current release must fail closed to a visible draft command and
// must not emit an implicit write/edit message. This is fallback proof, not a
// claim that the matrix's future exact-edit + stale-source contract is complete.
test("open-question resolve safely drafts a command instead of mutating markdown", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 820, height: 720 });
  await bootInPreviewMode(page);
  await page.evaluate(() => {
    const original = window.parent.postMessage.bind(window.parent);
    const messages: unknown[] = [];
    Reflect.set(window, "__afxPreviewMessages", messages);
    window.parent.postMessage = (
      message: unknown,
      targetOrigin: string,
      transfer?: Transferable[],
    ) => {
      messages.push(message);
      return original(message, targetOrigin, transfer ?? []);
    };
  });
  await postPreview(page, "docs/specs/checkout-redesign/spec.md", SIGNAL_SPEC, true);

  await page.getByRole("button", { name: /Resolve open question/i }).click();
  const messages = await page.evaluate(
    () => Reflect.get(window, "__afxPreviewMessages") as Array<Record<string, unknown>>,
  );
  expect(messages).toContainEqual(
    expect.objectContaining({
      type: "afxOpenChatCommand",
      command:
        '/afx-spec refine checkout-redesign resolve open question "Should approval happen before design?"',
      mode: "insert",
    }),
  );
  const interactionMessages = messages.filter((message) => message.type !== "afxPreviewShow");
  expect(interactionMessages).toEqual([
    expect.objectContaining({
      type: "afxOpenChatCommand",
      command:
        '/afx-spec refine checkout-redesign resolve open question "Should approval happen before design?"',
      mode: "insert",
    }),
  ]);

  await expectNoPageOverflow(page);
  await attachPreviewScreenshot(page, testInfo, "e2e-13-structured-edit-safe-fallback");
});

test("Preview collapses accidental fully blank markdown table columns", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 820, height: 720 });
  await bootInPreviewMode(page);
  await postPreview(page, "docs/specs/sprint-status.md", BLANK_COLUMN_TABLE, false);

  const table = page.getByRole("table", { name: "Markdown table" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader")).toHaveText(["Section", "Status", "Notes"]);
  await expect(table.getByRole("cell")).toHaveCount(12);
  await expect(
    table.getByRole("cell", { name: /Requirements satisfied by the worktree implementation/i }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await attachPreviewScreenshot(page, testInfo, "preview-blank-column-table");
});
