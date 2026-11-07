import * as assert from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

import { maintenanceInvestigator } from "./helpers/blueprint-investigator";

suite("AFX Blueprint — maintenance and Sprint handoff", () => {
  test("check is read-only; proposals require review; commands create a pinned external Draft Sprint and return to inquiry", async () => {
    const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(extension);
    const api = (await extension.activate()) as {
      runBlueprintInspectionForTest(root: string, manager: unknown): Promise<void>;
      runBlueprintMaintenanceForTest(kind: string, manager: unknown): Promise<void>;
      blueprintAction(action: string): Promise<void>;
      saveBlueprintDraftForTest(root: string): Promise<void>;
      restoreBlueprintDraftForTest(): Promise<void>;
      submitBlueprintCommandForTest(content: string): Promise<void>;
      createBlueprintHandoffForTest(
        input: { name: string; goal: string; discussion: string; findingIds: string[] },
        root: string,
      ): Promise<void>;
      getBlueprintWorkflow(): {
        phase: string;
        proposal?: { modified: number; retired: number };
        changes?: { changed: number };
        handoff?: { revision: number };
        planning?: boolean;
      };
      getBlueprintState(): { executionContextActive: boolean };
    };
    const parent = await mkdtemp(path.join(tmpdir(), "afx-maintenance-host-"));
    const source = path.join(parent, "source");
    const artifact = path.join(parent, "blueprint");
    const documents = path.join(parent, "documents");
    await mkdir(source);
    await mkdir(documents);
    await writeFile(path.join(source, "README.md"), "Initial purpose\n");
    await writeFile(path.join(source, "engine.ts"), "export const engine = true;\n");
    const snapshot = () =>
      Promise.all(
        ["blueprint.json", "blueprint.md"].map((file) =>
          readFile(path.join(artifact, file), "utf8"),
        ),
      );
    try {
      await api.runBlueprintInspectionForTest(source, maintenanceInvestigator("initial"));
      await api.blueprintAction("review");
      await api.saveBlueprintDraftForTest(artifact);
      const first = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
      const purposeId = first.model.investigation.findings.find(
        (finding: { category: string }) => finding.category === "purpose",
      ).id;
      const componentId = first.model.investigation.findings.find(
        (finding: { category: string }) => finding.category === "component",
      ).id;
      await writeFile(
        path.join(artifact, "blueprint.md"),
        "Authored notes\r\n" + (await readFile(path.join(artifact, "blueprint.md"), "utf8")),
      );
      await writeFile(path.join(source, "README.md"), "Updated purpose\n");
      const before = await snapshot();
      await api.submitBlueprintCommandForTest("/afx-blueprint check");
      assert.equal(api.getBlueprintWorkflow().changes?.changed, 1);
      assert.deepEqual(await snapshot(), before);
      await api.runBlueprintMaintenanceForTest(
        "update",
        maintenanceInvestigator("update", purposeId),
      );
      assert.equal(api.getBlueprintWorkflow().proposal?.modified, 1);
      await api.restoreBlueprintDraftForTest();
      assert.equal(api.getBlueprintWorkflow().proposal?.modified, 1);
      await assert.rejects(api.blueprintAction("save"), /Review/);
      await api.submitBlueprintCommandForTest("/afx-blueprint review");
      await writeFile(path.join(source, "README.md"), "Changed after proposal\n");
      await assert.rejects(api.blueprintAction("save"), /source evidence changed/);
      assert.deepEqual(await snapshot(), before);
      await writeFile(path.join(source, "README.md"), "Updated purpose\n");
      await api.submitBlueprintCommandForTest("/afx-blueprint apply");
      const updated = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
      assert.ok(
        updated.model.investigation.findings.some(
          (finding: { id: string }) => finding.id === componentId,
        ),
      );
      assert.ok(
        (await readFile(path.join(artifact, "blueprint.md"), "utf8")).startsWith(
          "Authored notes\r\n",
        ),
      );
      await api.runBlueprintMaintenanceForTest(
        "rebuild",
        maintenanceInvestigator("rebuild", purposeId),
      );
      assert.equal(api.getBlueprintWorkflow().proposal?.retired, 1);
      await api.submitBlueprintCommandForTest("/afx-blueprint reject");
      assert.equal(
        JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8")).model
          .modelRevisionId,
        updated.model.modelRevisionId,
      );
      await api.runBlueprintMaintenanceForTest(
        "rebuild",
        maintenanceInvestigator("rebuild", purposeId),
      );
      await api.blueprintAction("review");
      await api.blueprintAction("save");
      assert.equal(
        JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8")).model
          .investigation.findings.length,
        1,
      );
      await api.submitBlueprintCommandForTest("/afx-blueprint sprint");
      assert.ok(api.getBlueprintWorkflow().handoff);
      await api.blueprintAction("discard");
      assert.deepEqual(await readdir(documents), []);
      await api.submitBlueprintCommandForTest("/afx-blueprint sprint");
      const pinned = JSON.parse(await readFile(path.join(artifact, "blueprint.json"), "utf8"));
      await writeFile(
        path.join(artifact, "blueprint.json"),
        JSON.stringify({ ...pinned, revision: pinned.revision + 1 }),
      );
      await assert.rejects(
        api.createBlueprintHandoffForTest(
          {
            name: "Improve",
            goal: "Improve purpose",
            discussion: "Reviewed excerpt",
            findingIds: [purposeId],
          },
          documents,
        ),
        /changed after handoff review/,
      );
      assert.deepEqual(await readdir(documents), []);
      await writeFile(
        path.join(artifact, "blueprint.json"),
        `${JSON.stringify(pinned, null, 2)}\n`,
      );
      await writeFile(
        path.join(artifact, "blueprint.json"),
        JSON.stringify({ ...pinned, model: { ...pinned.model, modelRevisionId: randomUUID() } }),
      );
      await assert.rejects(
        api.createBlueprintHandoffForTest(
          {
            name: "Improve",
            goal: "Improve purpose",
            discussion: "Reviewed excerpt",
            findingIds: [purposeId],
          },
          documents,
        ),
        /model changed after handoff review/,
      );
      assert.deepEqual(await readdir(documents), []);
      await writeFile(
        path.join(artifact, "blueprint.json"),
        `${JSON.stringify(pinned, null, 2)}\n`,
      );

      await api.createBlueprintHandoffForTest(
        {
          name: "Improve",
          goal: "Improve purpose",
          discussion: "Reviewed excerpt",
          findingIds: [purposeId],
        },
        documents,
      );
      assert.equal(api.getBlueprintState().executionContextActive, true);
      const sprint = await readFile(path.join(documents, "docs/specs/improve/improve.md"), "utf8");
      assert.ok(sprint.includes("status: Draft"));
      assert.ok(sprint.includes(pinned.model.modelRevisionId));
      assert.ok(sprint.includes(purposeId));
      assert.ok(sprint.includes("Reviewed excerpt"));
      await api.submitBlueprintCommandForTest("/afx-blueprint end");
      assert.equal(api.getBlueprintState().executionContextActive, false);
      assert.deepEqual((await readdir(source)).sort(), ["README.md", "engine.ts"]);
      assert.deepEqual((await readdir(artifact)).sort(), ["blueprint.json", "blueprint.md"]);
    } finally {
      await vscode.commands.executeCommand("afx.endBlueprintSession");
      await vscode.commands.executeCommand("afx.detachBlueprint");
      await api.blueprintAction("discard");
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await rm(parent, { recursive: true, force: true });
    }
  });
});
