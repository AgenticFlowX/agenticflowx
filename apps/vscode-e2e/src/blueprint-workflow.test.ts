import * as assert from "node:assert";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

import { scriptedInvestigator } from "./helpers/blueprint-investigator";

suite("AFX Blueprint — Explore workflow", () => {
  test("cancel → recover local draft → review → save → reopen → continue → apply preserves notes and rejects changed source", async () => {
    const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(extension);
    const api = (await extension.activate()) as {
      runBlueprintInspectionForTest(
        root: string,
        manager: unknown,
        continuing?: boolean,
      ): Promise<void>;
      getBlueprintWorkflow(): {
        phase: string;
        findingCount: number;
        canContinue: boolean;
        reviewed?: boolean;
      };
      blueprintAction(action: string): Promise<void>;
      saveBlueprintDraftForTest(root: string): Promise<void>;
      restoreBlueprintDraftForTest(): Promise<void>;
    };
    const parent = await mkdtemp(path.join(tmpdir(), "afx-workflow-host-"));
    const source = path.join(parent, "source");
    const artifact = path.join(parent, "blueprint");
    await mkdir(source);
    const original = "A small project for the lifecycle fixture.\n";
    await writeFile(path.join(source, "README.md"), original);
    try {
      const running = api.runBlueprintInspectionForTest(source, scriptedInvestigator(false, true));
      const deadline = Date.now() + 5000;
      while (api.getBlueprintWorkflow().findingCount < 1 && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(api.getBlueprintWorkflow().phase, "inspecting");
      await api.blueprintAction("stop");
      await running;
      assert.equal(api.getBlueprintWorkflow().phase, "review");
      await api.restoreBlueprintDraftForTest();
      await assert.rejects(api.saveBlueprintDraftForTest(artifact), /Review/);
      await api.blueprintAction("review");
      await api.saveBlueprintDraftForTest(artifact);
      assert.deepEqual((await readdir(artifact)).sort(), ["blueprint.json", "blueprint.md"]);
      const first = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
      const notes = "User notes: preserve exactly\r\n";
      await writeFile(
        path.join(artifact, "blueprint.md"),
        notes + (await readFile(path.join(artifact, "blueprint.md"), "utf8")),
      );
      await vscode.commands.executeCommand("afx.openBlueprint", vscode.Uri.file(artifact));
      await api.restoreBlueprintDraftForTest();
      const resumed = scriptedInvestigator(true);
      await api.runBlueprintInspectionForTest(source, resumed, true);
      assert.equal(resumed.prompts.length, 1);
      await api.blueprintAction("review");
      await api.blueprintAction("save");
      const next = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
      assert.equal(
        next.model.investigation.findings[0].id,
        first.model.investigation.findings[0].id,
      );
      assert.ok((await readFile(path.join(artifact, "blueprint.md"), "utf8")).startsWith(notes));
      assert.ok(
        (await readFile(path.join(artifact, "blueprint.md"), "utf8")).includes(
          "Continued project understanding",
        ),
      );
      assert.deepEqual(await readdir(source), ["README.md"]);
      await writeFile(path.join(source, "README.md"), "Changed source\n");
      const blocked = scriptedInvestigator(true);
      await assert.rejects(
        api.runBlueprintInspectionForTest(source, blocked, true),
        /source evidence changed/,
      );
      assert.equal(blocked.prompts.length, 0);
      assert.equal(await readFile(path.join(source, "README.md"), "utf8"), "Changed source\n");
      await writeFile(path.join(source, "README.md"), original);
    } finally {
      await vscode.commands.executeCommand("afx.detachBlueprint");
      await api.blueprintAction("discard");
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await rm(parent, { recursive: true, force: true });
      await vscode.commands.executeCommand("afx.setMode", "code");
    }
  });
});
