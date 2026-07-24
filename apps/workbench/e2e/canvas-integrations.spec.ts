/**
 * Integration-surface coverage for Canvas: annotations, Chat/Notes handoffs,
 * URL attach validation, Spec Map sync, and dialog-cancel safety.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-45] [FR-46] [FR-47]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PRO] [DES-CANVAS-INTERACTIONS]
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { CanvasDescriptor, CanvasDocumentSnapshot, JSONCanvas } from "@afx/shared";

const ROOT_URI = "file:///workspace";

const PROJECT: CanvasDescriptor = {
  id: "project",
  kind: "project",
  label: "Project Canvas",
  source: { rootUri: ROOT_URI, rootName: "workspace", relativePath: ".afx/project.canvas" },
  exists: true,
};

const ANNOTATED_CANVAS: JSONCanvas = {
  nodes: [
    {
      id: "idea",
      type: "text",
      text: "# Review target\n\nAnnotations point here.",
      x: 0,
      y: 0,
      width: 280,
      height: 150,
    },
    {
      id: "risk",
      type: "text",
      text: "## Risk\n\nSecond card.",
      x: 360,
      y: 0,
      width: 280,
      height: 150,
    },
    {
      id: "a1",
      type: "text",
      text: "Tighten this heading",
      afxNodeKind: "annotation",
      x: 0,
      y: 240,
      width: 200,
      height: 90,
    },
    {
      id: "a2",
      type: "text",
      text: "Second reviewer note",
      afxNodeKind: "annotation",
      x: 360,
      y: 240,
      width: 200,
      height: 90,
    },
  ],
  edges: [{ id: "a1-to-idea", fromNode: "a1", toNode: "idea" }],
};

const SYNCED_CANVAS: JSONCanvas = {
  nodes: [
    ...(ANNOTATED_CANVAS.nodes ?? []),
    {
      id: "spec-a",
      type: "file",
      file: "docs/specs/alpha/spec.md",
      x: 0,
      y: 420,
      width: 260,
      height: 120,
    },
    {
      id: "spec-b",
      type: "file",
      file: "docs/specs/beta/spec.md",
      x: 360,
      y: 420,
      width: 260,
      height: 120,
    },
    // Cast: afxProvenance is an AFX extension field on the generated edge.
  ],
  edges: [
    ...(ANNOTATED_CANVAS.edges ?? []),
    {
      id: "dep-alpha-beta",
      fromNode: "spec-b",
      toNode: "spec-a",
      afxProvenance: { version: 1, kind: "declared-dependency", owner: "docs/specs/beta/spec.md" },
    } as NonNullable<JSONCanvas["edges"]>[number],
  ],
};

function snapshot(
  descriptor: CanvasDescriptor,
  canvas: JSONCanvas,
  revision = "revision-1",
): CanvasDocumentSnapshot {
  return {
    documentId: `${descriptor.source.rootUri}::${descriptor.source.relativePath}`,
    descriptor,
    source: descriptor.source,
    revision: { contentRevision: revision, diskRevision: revision, dirty: false },
    content: JSON.stringify(canvas),
  };
}

type OutboundMessage = Record<string, unknown> & { type?: string };

async function bootCanvas(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1180, height: 620 });
  await page.goto("/");
  await page.evaluate(
    ({ project, projectDocument, syncedDocument }) => {
      const state = window as typeof window & {
        __afxCanvasOutbound?: Array<Record<string, unknown>>;
      };
      state.__afxCanvasOutbound = [];
      let revisionSequence = 1;
      window.addEventListener("message", (event: MessageEvent) => {
        const message = event.data as Record<string, unknown> & { type?: string };
        if (!message?.type) return;
        if (
          [
            "afxCanvasEdit",
            "afxCanvasList",
            "afxCanvasCreate",
            "afxCanvasRename",
            "afxCanvasDuplicate",
            "afxCanvasRefreshDependencies",
            "afxOpenChatCommand",
            "afxAppendNote",
            "afxCanvasPickReferences",
            "afxCanvasUrlPreviewRequest",
            "afxCanvasContentPreviewRequest",
          ].includes(message.type)
        ) {
          state.__afxCanvasOutbound?.push(message);
        }
        if (message.type === "afxCanvasPickReferences") {
          window.postMessage(
            {
              type: "afxCanvasReferencesPicked",
              requestId: String(message.requestId),
              outcome: "success",
              references: [
                {
                  filePath: "assets/diagram.png",
                  source: {
                    rootUri: "file:///workspace",
                    rootName: "workspace",
                    relativePath: "assets/diagram.png",
                  },
                },
              ],
            },
            "*",
          );
        }
        if (message.type === "afxCanvasList") {
          window.postMessage(
            { type: "afxCanvasLibrary", canvases: [project], selectedId: project.id },
            "*",
          );
        }
        if (message.type === "afxCanvasRefreshDependencies") {
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxMutationResult",
                requestId: String(message.requestId),
                outcome: "success",
                message: "Dependencies reconciled.",
              },
              "*",
            );
            window.postMessage({ type: "afxCanvasDocument", document: syncedDocument }, "*");
          }, 25);
        }
        if (message.type === "afxCanvasEdit") {
          revisionSequence += 1;
          const nextRevision = `revision-${revisionSequence}`;
          window.setTimeout(() => {
            window.postMessage(
              {
                type: "afxCanvasEditResult",
                requestId: String(message.requestId),
                sessionId: String(message.sessionId),
                sequence: Number(message.sequence),
                outcome: "success",
                target: message.target,
                revision: {
                  contentRevision: nextRevision,
                  diskRevision: nextRevision,
                  dirty: false,
                },
              },
              "*",
            );
          }, 25);
        }
      });
      window.postMessage(
        {
          type: "afxUpdate",
          canvasEnabled: true,
          canvas: {
            content: projectDocument.content,
            source: projectDocument.source,
            revision: projectDocument.revision,
          },
        },
        "*",
      );
      window.postMessage({ type: "afxCanvasDocument", document: projectDocument }, "*");
    },
    {
      project: PROJECT,
      projectDocument: snapshot(PROJECT, ANNOTATED_CANVAS),
      syncedDocument: snapshot(PROJECT, SYNCED_CANVAS, "revision-2"),
    },
  );
  await page.getByRole("tab", { name: "Canvas" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
}

function outbound(page: Page, type: string): Promise<OutboundMessage[]> {
  return page.evaluate(
    (t) =>
      (
        window as typeof window & { __afxCanvasOutbound?: OutboundMessage[] }
      ).__afxCanvasOutbound?.filter((message) => message.type === t) ?? [],
    type,
  );
}

test("annotations render numbered badges and leader edges, and the toolbar adds one", async ({
  page,
}) => {
  await bootCanvas(page);

  // Badges follow document order, 1-based (FR-46).
  await expect(page.getByTestId("canvas-annotation-badge-a1")).toHaveText("1");
  await expect(page.getByTestId("canvas-annotation-badge-a2")).toHaveText("2");
  // An edge that starts on an annotation renders as a dashed leader.
  await expect(page.locator("path.afx-edge-leader")).toHaveCount(1);

  await page.getByRole("button", { name: "Add annotation" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expect(page.locator('[data-testid^="canvas-annotation-badge-"]')).toHaveCount(3);
});

test("node actions and the selection chip hand selected context to Chat and Notes", async ({
  page,
}) => {
  await bootCanvas(page);

  // Lower node keeps its NodeToolbar clear of the floating flow toolbar.
  await page.getByTestId("canvas-node-body-a2").click();
  await page.getByRole("button", { name: "Send to Chat" }).click();
  await expect
    .poll(async () => (await outbound(page, "afxOpenChatCommand")).length)
    .toBeGreaterThan(0);
  const chat = await outbound(page, "afxOpenChatCommand");
  expect(String(chat[0]?.command)).toContain("Second reviewer note");
  expect(chat[0]?.mode).toBe("send");

  await page.getByRole("button", { name: "Promote to Notes" }).click();
  await expect.poll(async () => (await outbound(page, "afxAppendNote")).length).toBeGreaterThan(0);
  const note = await outbound(page, "afxAppendNote");
  expect(String(note[0]?.text)).toContain("Second reviewer note");

  // The flow toolbar exposes a labeled shortcut for the same handoff.
  await page.getByRole("button", { name: "Send selection to Chat" }).click();
  await expect.poll(async () => (await outbound(page, "afxOpenChatCommand")).length).toBe(2);
});

test("URL attach validates inline and only valid links become cards", async ({ page }) => {
  await bootCanvas(page);

  await page.getByRole("button", { name: "Attach to canvas" }).click();
  await page.getByRole("textbox", { name: "URL to attach" }).fill("not a url");
  await page.getByRole("button", { name: "Add URL" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);

  await page.getByRole("textbox", { name: "URL to attach" }).fill("https://example.com/design");
  await page.getByRole("button", { name: "Add URL" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
});

test("Spec Map explains how to build the map, and Sync reconciles it", async ({ page }) => {
  await bootCanvas(page);

  await page.getByRole("button", { name: "Spec Map" }).click();
  const empty = page.getByTestId("canvas-spec-map-empty");
  await expect(empty).toBeVisible();
  // Guidance points at the Add-spec flow and explains depends_on.
  await expect(empty).toContainText("Add a spec");
  await expect(empty).toContainText("depends_on");

  // Sync (toolbar) reconciles edges among loaded specs; the mock host answers
  // with a reconciled document.
  await page.getByRole("button", { name: "Sync specs", exact: true }).click();
  await expect
    .poll(async () => (await outbound(page, "afxCanvasRefreshDependencies")).length)
    .toBe(1);
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.getByTestId("canvas-spec-map-empty")).toBeHidden();
});

test("New canvas can request a picked folder while defaulting to .afx/canvases", async ({
  page,
}) => {
  await bootCanvas(page);

  await page.getByRole("button", { name: "New canvas" }).click();
  const dialog = page.getByTestId("canvas-input-dialog");
  await expect(dialog).toContainText("Default location: .afx/canvases/");
  await dialog.getByLabel("Canvas name").fill("Placed elsewhere");
  await dialog.getByRole("checkbox", { name: "Choose a folder instead of .afx/canvases/" }).check();
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect.poll(async () => (await outbound(page, "afxCanvasCreate")).length).toBe(1);
  const [create] = await outbound(page, "afxCanvasCreate");
  expect(create?.["pickLocation"]).toBe(true);
  expect(create?.["name"]).toBe("Placed elsewhere");
});

test("URL preview and image attach drive host requests end to end", async ({ page }) => {
  await bootCanvas(page);

  // Attach a URL, then load its preview from the button inside the node body.
  await page.getByRole("button", { name: "Attach to canvas" }).click();
  await page.getByRole("textbox", { name: "URL to attach" }).fill("https://example.com/spec");
  await page.getByRole("button", { name: "Add URL" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.getByRole("button", { name: "Load URL preview" }).click();
  await expect
    .poll(async () => (await outbound(page, "afxCanvasUrlPreviewRequest")).length)
    .toBe(1);

  // Attach an image via the picker; the picked node lands and immediately
  // requests its rendered content from the host.
  await page.getByRole("button", { name: "Attach to canvas" }).click();
  await page.getByRole("button", { name: "Images" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await expect
    .poll(async () => (await outbound(page, "afxCanvasContentPreviewRequest")).length)
    .toBeGreaterThan(0);
});

test("cancelling a dialog sends nothing to the host", async ({ page }) => {
  await bootCanvas(page);

  await page.getByRole("button", { name: "New canvas" }).click();
  const dialog = page.getByTestId("canvas-input-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Canvas name").fill("Abandoned plan");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "New canvas" }).click();
  await expect(page.getByTestId("canvas-input-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("canvas-input-dialog")).toBeHidden();

  expect(await outbound(page, "afxCanvasCreate")).toHaveLength(0);
});
