/**
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-10] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-STORAGE] [DES-TEST]
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createBlueprint, openBlueprint } from "./blueprint-artifacts";
import { inventoryRepository } from "./blueprint-investigation";
import { chooseBlueprintSaveLocation } from "./blueprint-save-dialog";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-save-"));
  roots.push(root);
  await writeFile(path.join(root, "source.ts"), "export const value = 1;\n");
  await mkdir(path.join(root, ".afx"));
  await writeFile(path.join(root, ".afx", "settings.json"), '{"preserve":true}\n');
  return { name: "Sample App", rootUri: vscode.Uri.file(root) };
}
function choose(location: number, attach = true) {
  vi.spyOn(vscode.window, "showInputBox").mockResolvedValue("Sample App");
  return vi
    .spyOn(vscode.window, "showQuickPick")
    .mockImplementationOnce(async (items) => (await items)[location])
    .mockImplementationOnce(async (items) => (await items)[attach ? 0 : 1]);
}
describe("Blueprint save destination", () => {
  it("saves inside an occupied project's .afx folder without overwriting source or existing settings", async () => {
    const project = await fixture();
    const before = await inventoryRepository(project.rootUri.fsPath);
    const picker = choose(0);
    const folderPicker = vi.spyOn(vscode.window, "showOpenDialog");
    const selected = await chooseBlueprintSaveLocation(project);
    expect(selected).toEqual({
      name: "Sample App",
      artifactRoot: path.join(project.rootUri.fsPath, ".afx/blueprints/sample-app"),
      attach: true,
    });
    expect(folderPicker).not.toHaveBeenCalled();
    expect(picker.mock.calls[1]?.[1]).toMatchObject({ placeHolder: selected!.artifactRoot });
    const manifest = await createBlueprint({
      ...selected!,
      schemaVersion: 2,
      repository: { name: project.name, kind: "folder" },
      researchMarkdown: "# Research\n",
    });
    expect(await openBlueprint(selected!.artifactRoot)).toEqual(manifest);
    expect(await readFile(path.join(project.rootUri.fsPath, "source.ts"), "utf8")).toBe(
      "export const value = 1;\n",
    );
    expect(await readFile(path.join(project.rootUri.fsPath, ".afx/settings.json"), "utf8")).toBe(
      '{"preserve":true}\n',
    );
    expect(await inventoryRepository(project.rootUri.fsPath)).toEqual(before);
    await expect(
      createBlueprint({
        ...selected!,
        repository: { name: project.name, kind: "folder" },
        researchMarkdown: "replacement",
      }),
    ).rejects.toThrow(/Open the existing Blueprint/);
    expect(await openBlueprint(selected!.artifactRoot)).toEqual(manifest);
  });
  it("uses another occupied parent for private .afx storage", async () => {
    const project = await fixture();
    const privateParent = await fixture();
    choose(1, false);
    vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue([privateParent.rootUri]);
    const selected = await chooseBlueprintSaveLocation(project);
    expect(selected?.artifactRoot).toBe(
      path.join(privateParent.rootUri.fsPath, ".afx/blueprints/sample-app"),
    );
    expect(selected?.attach).toBe(false);
    expect(await readdir(path.join(project.rootUri.fsPath, ".afx"))).toEqual(["settings.json"]);
  });
  it("preserves exact custom locations without adding .afx", async () => {
    const project = await fixture();
    choose(2);
    const exact = path.join(project.rootUri.fsPath, "private-research");
    vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue([vscode.Uri.file(exact)]);
    expect((await chooseBlueprintSaveLocation(project))?.artifactRoot).toBe(exact);
  });
  it.each(["name", "location", "folder", "save"])(
    "cancelling at %s creates no folders",
    async (stage) => {
      const project = await fixture();
      vi.spyOn(vscode.window, "showInputBox").mockResolvedValue(
        stage === "name" ? undefined : "Sample App",
      );
      vi.spyOn(vscode.window, "showQuickPick")
        .mockImplementationOnce(async (items) =>
          stage === "location" ? undefined : (await items)[1],
        )
        .mockResolvedValueOnce(undefined);
      vi.spyOn(vscode.window, "showOpenDialog").mockResolvedValue(
        stage === "folder" ? undefined : [project.rootUri],
      );
      expect(await chooseBlueprintSaveLocation(project)).toBeUndefined();
      expect(await readdir(path.join(project.rootUri.fsPath, ".afx"))).toEqual(["settings.json"]);
    },
  );
});
