import * as assert from "node:assert";
import { readFile, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { maintenanceInvestigator, scriptedInvestigator } from "./helpers/blueprint-investigator";

const phase = process.env["AFX_BLUEPRINT_RESTART_PHASE"];
const maintenance = process.env["AFX_BLUEPRINT_RESTART_SCENARIO"] === "maintenance";
if (phase)
  suite("AFX Blueprint — two-process restart", () => {
    test(`restores a durable draft across an actual host restart (${maintenance ? "maintenance" : "inspect"}/${phase})`, async () => {
      const source = process.env["AFX_BLUEPRINT_RESTART_SOURCE"]!;
      const artifact = path.join(source, "..", "blueprint");
      const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
      assert.ok(extension);
      const api = (await extension.activate()) as {
        getBlueprintRestartDiagnostics(): unknown;
        getBlueprintWorkflow(): {
          phase: string;
          findingCount: number;
          canContinue: boolean;
          proposal?: { modified: number };
        };
        runBlueprintMaintenanceForTest(kind: string, manager: unknown): Promise<void>;
        runBlueprintInspectionForTest(
          root: string,
          manager: unknown,
          continuing?: boolean,
        ): Promise<void>;
        blueprintAction(action: string): Promise<void>;
        saveBlueprintDraftForTest(root: string): Promise<void>;
      };
      console.log("Blueprint restart diagnostics", phase, api.getBlueprintRestartDiagnostics());
      if (maintenance && phase === "write") {
        await api.runBlueprintInspectionForTest(source, maintenanceInvestigator("initial"));
        await api.blueprintAction("review");
        await api.saveBlueprintDraftForTest(artifact);
        const initial = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
        const purposeId = initial.model.investigation.findings.find(
          (finding: { category: string }) => finding.category === "purpose",
        ).id;
        await writeFile(path.join(source, "README.md"), "Updated purpose\n");
        await api.runBlueprintMaintenanceForTest(
          "update",
          maintenanceInvestigator("update", purposeId),
        );
        assert.equal(api.getBlueprintWorkflow().proposal?.modified, 1);
      } else if (maintenance) {
        await vscode.commands.executeCommand("afx.openBlueprint", vscode.Uri.file(artifact));
        await vscode.commands.executeCommand("afx.attachBlueprint", vscode.Uri.file(source));
        assert.equal(api.getBlueprintWorkflow().proposal?.modified, 1);
        assert.equal(api.getBlueprintWorkflow().findingCount, 2);
        await assert.rejects(api.blueprintAction("save"), /Review/);
        await api.blueprintAction("review");
        await api.blueprintAction("save");
        const applied = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
        assert.equal(applied.model.investigation.findings.length, 2);
        assert.ok(
          applied.model.investigation.findings.some(
            (finding: { description: string }) => finding.description === "Unaffected component",
          ),
        );
        await vscode.commands.executeCommand("afx.detachBlueprint");
        await api.blueprintAction("discard");
      } else if (phase === "write") {
        const operation = api.runBlueprintInspectionForTest(
          source,
          scriptedInvestigator(false, true),
        );
        const deadline = Date.now() + 5000;
        while (api.getBlueprintWorkflow().findingCount < 1 && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 20));
        await api.blueprintAction("stop");
        await operation;
        assert.equal(api.getBlueprintWorkflow().findingCount, 1);
        assert.equal(api.getBlueprintWorkflow().phase, "review");
      } else {
        // No inspection or artificial store reload in this process: activation must restore it.
        assert.equal(api.getBlueprintWorkflow().phase, "review");
        assert.equal(api.getBlueprintWorkflow().findingCount, 1);
        assert.equal(api.getBlueprintWorkflow().canContinue, true);
        const manager = scriptedInvestigator(true);
        await api.runBlueprintInspectionForTest(source, manager, true);
        assert.equal(manager.prompts.length, 1);
        await api.blueprintAction("review");
        await api.saveBlueprintDraftForTest(artifact);
        assert.deepEqual((await readdir(artifact)).sort(), ["blueprint.json", "blueprint.md"]);
        assert.ok(
          (await readFile(path.join(artifact, "blueprint.md"), "utf8")).includes(
            "Continued project understanding",
          ),
        );
        await vscode.commands.executeCommand("afx.detachBlueprint");
        await api.blueprintAction("discard");
      }
    });
  });
