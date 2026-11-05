/**
 * Real extension-host external/hybrid navigation and migration lifecycle.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-11] [FR-12] [FR-19]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TEST]
 */
import * as assert from "node:assert";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

suite("AFX Blueprint — real host lifecycle", () => {
  test("open is passive, attach provides external CodeLens, migration retains intent, detach removes it", async () => {
    const extension = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(extension);
    const api = (await extension.activate()) as {
      getBlueprintState(): {
        attached: boolean;
        executionContextActive: boolean;
        schemaVersion?: number;
      };
    };
    assert.deepEqual(api.getBlueprintState(), {
      attached: false,
      executionContextActive: false,
      documentRootIds: [],
    });
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    assert.ok(workspace);
    const root = await mkdtemp(path.join(tmpdir(), "afx-blueprint-host-"));
    const sourceName = `.afx-blueprint-host-${process.pid}.ts`;
    const source = path.join(workspace, sourceName);
    const bytes = "export function externalFeature() { return 42; }\n";
    const blueprintId = randomUUID();
    const repositoryId = randomUUID();
    const now = new Date().toISOString();
    const manifest = {
      kind: "afx-blueprint",
      schemaVersion: 1,
      id: blueprintId,
      name: "Host fixture",
      revision: 1,
      createdAt: now,
      updatedAt: now,
      repositories: [{ id: repositoryId, name: "host", kind: "git" }],
      artifacts: {
        overview: "blueprint.md",
        research: "research",
        sprints: "docs/specs",
        decisions: "decisions",
        traces: "traces/links.json",
        evidence: "evidence",
        specs: "docs/specs",
      },
      traceability: { mode: "external", policyVersion: 1 },
    };
    await mkdir(path.join(root, "traces"));
    await mkdir(path.join(root, "docs/specs"), { recursive: true });
    await writeFile(source, bytes);
    await writeFile(path.join(root, "blueprint.json"), JSON.stringify(manifest));
    await writeFile(path.join(root, "blueprint.md"), "# Private Blueprint\n");
    await writeFile(
      path.join(root, "docs/specs/feature.md"),
      "# Feature\n\n## [FR-1] External trace\n",
    );
    const links = {
      kind: "afx-blueprint-traces",
      schemaVersion: 1,
      blueprintId,
      revision: 1,
      updatedAt: now,
      positionEncoding: "utf-16",
      links: [
        {
          id: randomUUID(),
          source: {
            repositoryId,
            path: sourceName,
            scope: "symbol",
            symbol: {
              name: "externalFeature",
              kind: 12,
              range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
              selectionRange: {
                start: { line: 0, character: 16 },
                end: { line: 0, character: 31 },
              },
            },
            contentHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
          },
          target: { path: "docs/specs/feature.md", anchor: { kind: "requirement", id: "FR-1" } },
          relation: "implements",
          createdAt: now,
          createdBy: "human",
          lastKnownResolution: "resolved",
        },
      ],
    };
    await writeFile(path.join(root, "traces/links.json"), JSON.stringify(links));
    const sourceUri = vscode.Uri.file(source);
    const lenses = async () =>
      (await vscode.commands.executeCommand<vscode.CodeLens[]>(
        "vscode.executeCodeLensProvider",
        sourceUri,
      )) ?? [];
    const waitForLenses = async (predicate: (current: vscode.CodeLens[]) => boolean) => {
      const deadline = Date.now() + 6000;
      let current = await lenses();
      while (!predicate(current) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        current = await lenses();
      }
      return current;
    };
    try {
      await vscode.commands.executeCommand("afx.openBlueprint", vscode.Uri.file(root));
      await vscode.window.showTextDocument(sourceUri);
      assert.ok(
        !(await lenses()).some((lens) => lens.command?.title.includes("FR-1")),
        "Opening research must not attach it",
      );
      await vscode.commands.executeCommand("afx.attachBlueprint", sourceUri);
      assert.deepEqual(api.getBlueprintState(), {
        attached: true,
        executionContextActive: false,
        schemaVersion: 1,
        documentRootIds: [],
      });
      assert.ok(
        (
          await waitForLenses((current) =>
            current.some((lens) => lens.command?.title.includes("FR-1")),
          )
        ).some((lens) => lens.command?.title.includes("FR-1")),
        "Attached external link should appear without @see",
      );
      const edit = new vscode.WorkspaceEdit();
      edit.insert(sourceUri, new vscode.Position(0, 0), "\n\n");
      await vscode.workspace.applyEdit(edit);
      const moved = (
        await waitForLenses((current) =>
          current.some(
            (lens) => lens.command?.title.includes("FR-1") && lens.range.start.line === 2,
          ),
        )
      ).find((lens) => lens.command?.title.includes("FR-1"));
      assert.equal(
        moved?.range.start.line,
        2,
        "External CodeLens should follow the current language symbol in a dirty buffer",
      );
      assert.ok(
        moved?.command?.title.includes("stale"),
        "Repositioning must not certify unchanged semantics",
      );
      await vscode.commands.executeCommand("workbench.action.files.revert");
      await vscode.commands.executeCommand("afx.migrateBlueprint");
      const migrated = JSON.parse(await readFile(path.join(root, "blueprint.json"), "utf8"));
      assert.equal(migrated.schemaVersion, 2);
      assert.equal(migrated.id, blueprintId);
      const updatedLinks = JSON.parse(await readFile(path.join(root, "traces/links.json"), "utf8"));
      assert.deepEqual(updatedLinks.links, links.links);
      assert.equal(await readFile(source, "utf8"), bytes);
      await writeFile(
        path.join(root, "traces/links.json"),
        JSON.stringify({ ...updatedLinks, revision: updatedLinks.revision + 1, links: [] }),
      );
      assert.ok(
        !(
          await waitForLenses(
            (current) => !current.some((lens) => lens.command?.title.includes("FR-1")),
          )
        ).some((lens) => lens.command?.title.includes("FR-1")),
        "Agent/CLI trace updates must be read from the external artifact store",
      );
      await vscode.commands.executeCommand("afx.detachBlueprint");
      assert.ok(!(await lenses()).some((lens) => lens.command?.title.includes("FR-1")));
    } finally {
      await vscode.commands.executeCommand("afx.detachBlueprint");
      await rm(source, { force: true });
      await rm(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
    }
  });
});
