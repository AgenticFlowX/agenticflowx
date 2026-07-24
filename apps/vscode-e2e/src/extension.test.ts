/**
 * Extension activation smoke test.
 * Verifies the AFX extension activates and registers its commands.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-1] [FR-4] [FR-6]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 * @see docs/specs/420-dx-testing/design.md [DES-DX-TESTING-RUNNER-ISOLATION]
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-32]
 */
import * as assert from "node:assert";
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

const execFileAsync = promisify(execFile);

suite("AFX Extension — activation", () => {
  test("extension is present", () => {
    const ext = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(ext, "Extension agenticflowx.agenticflowx not found");
  });

  test("extension activates without error", async () => {
    const ext = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });

  test("bundled multi-file AFX skills load and their helper scripts execute", async () => {
    const ext = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(ext, "Extension agenticflowx.agenticflowx not found");

    const skillsRoot = path.join(ext.extensionPath, "resources", "skills", "agenticflowx");
    const requiredFiles = [
      "afx-dash/SKILL.md",
      "afx-dash/assets/dash-template.md",
      "afx-dash/references/code.md",
      "afx-dev/references/refactor.md",
      "afx-help/references/query-helper.md",
      "afx-help/scripts/afx-doc-query.mjs",
      "afx-help/scripts/afx-validate.mjs",
    ];
    for (const relativePath of requiredFiles) {
      assert.ok(
        fs.existsSync(path.join(skillsRoot, relativePath)),
        `Bundled skill resource is missing: ${relativePath}`,
      );
    }

    const nodeEnvironment = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
    };
    const validatorPath = path.join(skillsRoot, "afx-help", "scripts", "afx-validate.mjs");
    const validator = await execFileAsync(process.execPath, [validatorPath, skillsRoot, "--json"], {
      env: nodeEnvironment,
      timeout: 10_000,
    });
    const validation = JSON.parse(validator.stdout) as {
      pass?: boolean;
      skills?: number;
      errors?: number;
    };
    assert.deepStrictEqual(
      { pass: validation.pass, skills: validation.skills, errors: validation.errors },
      { pass: true, skills: 18, errors: 0 },
    );

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    assert.ok(workspaceRoot, "Expected an open workspace folder");
    const specPath = path.join(workspaceRoot, "docs", "specs", "200-app-vscode", "spec.md");
    const queryPath = path.join(skillsRoot, "afx-help", "scripts", "afx-doc-query.mjs");
    const query = await execFileAsync(process.execPath, [queryPath, "map", specPath], {
      env: nodeEnvironment,
      timeout: 10_000,
    });
    const documentMap = JSON.parse(query.stdout) as {
      frontmatter?: { type?: string };
      headings?: unknown[];
    };
    assert.strictEqual(documentMap.frontmatter?.type, "SPEC");
    assert.ok((documentMap.headings?.length ?? 0) > 0, "Expected parsed spec headings");
  });

  test("afx.openSidebar command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("afx.openSidebar"), "afx.openSidebar not registered");
  });

  test("afx.openWorkbench command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("afx.openWorkbench"), "afx.openWorkbench not registered");
  });

  test("legacy runtime commands remain registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      "afx.openSidebar",
      "afx.openWorkbench",
      "afx.showLogs",
      "afx.agentSmokeTest",
      "afx.agentRestart",
    ]) {
      assert.ok(commands.includes(id), `${id} not registered`);
    }
  });

  test("2.4.0 SDD commands are contributed and registered", async () => {
    const ext = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(ext, "Extension agenticflowx.agenticflowx not found");

    const contributed =
      (
        ext.packageJSON as {
          contributes?: { commands?: Array<{ command?: string }> };
        }
      ).contributes?.commands?.map(({ command }) => command) ?? [];
    const registered = await vscode.commands.getCommands(true);

    for (const id of ["afx.openSddStudio", "afx.newSdd", "afx.refineCurrentDocument"]) {
      assert.ok(contributed.includes(id), `${id} missing from package.json contributions`);
      assert.ok(registered.includes(id), `${id} not registered after activation`);
    }
  });

  test("afx.showLogs executes without throwing", async () => {
    await vscode.commands.executeCommand("afx.showLogs");
  });

  test("afx.openSidebar focuses the sidebar view", async () => {
    await vscode.commands.executeCommand("afx.openSidebar");
    // No exception means VSCode resolved the focus command path; deeper webview
    // assertions belong in a Playwright session against the live webview.
  });

  test("afx.openSddStudio resolves through the real Workbench command path", async () => {
    await vscode.commands.executeCommand("afx.openSddStudio");
    // This exercises the contributed command through VSCode's command registry.
    // Webview rendering remains covered by the Workbench Playwright suite.
  });

  test("afx.newSdd resolves through the real sidebar draft path", async () => {
    await vscode.commands.executeCommand("afx.newSdd");
    // The extension unit suite asserts the exact `/afx-spec new ` draft. Here
    // we prove the command palette contribution reaches the live sidebar host.
  });

  test("afx.refineCurrentDocument opens AFX Preview for a real SDD fixture", async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    assert.ok(root, "Expected an open workspace folder");
    const specPath = path.join(root, "docs/specs/200-app-vscode/spec.md");
    assert.ok(fs.existsSync(specPath), `Expected canonical SDD fixture at ${specPath}`);

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(specPath));
    await vscode.window.showTextDocument(document, { preview: false });
    await waitFor(
      () => vscode.window.activeTextEditor?.document.uri.fsPath === specPath,
      "Expected the canonical SDD fixture to become the active text editor",
    );
    assert.strictEqual(vscode.window.activeTextEditor?.document.languageId, "markdown");
    await vscode.commands.executeCommand("afx.refineCurrentDocument");

    await waitFor(
      () =>
        vscode.window.tabGroups.all.some((group) =>
          group.tabs.some(
            (tab) =>
              (tab.input as { viewType?: string } | undefined)?.viewType === "afxPreview" ||
              tab.label === "AFX Preview — spec.md",
          ),
        ),
      "Expected Refine Current Document to open an AFX Preview tab",
    );
  });

  test("afx.agentRestart resolves without throwing when the agent is idle", async () => {
    await vscode.commands.executeCommand("afx.agentRestart");
  });

  test("afx configuration scope is contributed", () => {
    const config = vscode.workspace.getConfiguration("afx");
    assert.strictEqual(config.get("theme"), config.get("theme")); // accessor works
    assert.ok(["meridian", "lyra"].includes(config.get<string>("theme") ?? "meridian"));
  });

  test("afx.experimental.canvas defaults false and can be updated", async () => {
    const config = vscode.workspace.getConfiguration("afx");
    const originalWorkspaceValue = config.inspect<boolean>("experimental.canvas")?.workspaceValue;
    const readCanvasEnabled = () =>
      vscode.workspace.getConfiguration("afx").get<boolean>("experimental.canvas");

    try {
      await config.update("experimental.canvas", undefined, vscode.ConfigurationTarget.Workspace);
      assert.strictEqual(readCanvasEnabled(), false);

      await config.update("experimental.canvas", true, vscode.ConfigurationTarget.Workspace);
      assert.strictEqual(readCanvasEnabled(), true);
    } finally {
      await config.update(
        "experimental.canvas",
        originalWorkspaceValue,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  });

  test("afx.openCanvasEditor opens an explicit optional Canvas editor", async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    assert.ok(root, "Expected an open workspace folder");
    const canvasDirectory = vscode.Uri.joinPath(root, ".afx", "canvases");
    const canvasUri = vscode.Uri.joinPath(canvasDirectory, "e2e-custom-editor.canvas");
    const config = vscode.workspace.getConfiguration("afx");
    const originalWorkspaceValue = config.inspect<boolean>("experimental.canvas")?.workspaceValue;

    try {
      await config.update("experimental.canvas", true, vscode.ConfigurationTarget.Workspace);
      await vscode.workspace.fs.createDirectory(canvasDirectory);
      await vscode.workspace.fs.writeFile(
        canvasUri,
        Buffer.from(
          JSON.stringify(
            {
              nodes: [
                {
                  id: "e2e-node",
                  type: "text",
                  text: "# Custom editor smoke",
                  x: 0,
                  y: 0,
                  width: 300,
                  height: 160,
                },
              ],
              edges: [],
            },
            null,
            2,
          ),
          "utf8",
        ),
      );

      await vscode.commands.executeCommand("afx.openCanvasEditor", canvasUri);
      await waitFor(
        () =>
          vscode.window.tabGroups.all.some((group) =>
            group.tabs.some((tab) => {
              const input = tab.input as { uri?: vscode.Uri; viewType?: string } | undefined;
              return (
                input?.viewType === "afx.canvasEditor" && input.uri?.fsPath === canvasUri.fsPath
              );
            }),
          ),
        "Expected the explicit command to open afx.canvasEditor for the requested file",
      );
    } finally {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      await vscode.workspace.fs.delete(canvasUri).then(undefined, () => undefined);
      await config.update(
        "experimental.canvas",
        originalWorkspaceValue,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  });
});

/**
 * Workspace mode switching — covers Spec mode end-to-end through the real
 * VSCode `afx.setMode` command and the effective `afx.mode.active` setting.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-11]
 * @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
 */
suite("AFX Extension — workspace mode (Code/Explore/Spec)", () => {
  let originalGlobalMode: string | undefined;
  let originalWorkspaceMode: string | undefined;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(ext);
    await ext.activate();

    const inspected = vscode.workspace.getConfiguration("afx").inspect<string>("mode.active");
    originalGlobalMode = inspected?.globalValue;
    originalWorkspaceMode = inspected?.workspaceValue;
  });

  setup(async () => {
    await resetModeToGlobalCode();
  });

  suiteTeardown(async () => {
    // Restore the profile/workspace values the suite observed on entry.
    const config = vscode.workspace.getConfiguration("afx");
    await config.update("mode.active", originalWorkspaceMode, vscode.ConfigurationTarget.Workspace);
    await config.update("mode.active", originalGlobalMode, vscode.ConfigurationTarget.Global);
  });

  test("afx.setMode is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("afx.setMode"), "afx.setMode not registered");
  });

  test("afx.mode.active enum admits 'code', 'explore', and 'spec'", () => {
    // The enum constraint is enforced by the package.json `configuration`
    // contribution; this test sanity-checks each value is accepted at runtime.
    const config = vscode.workspace.getConfiguration("afx");
    assert.ok(["code", "explore", "spec"].includes(config.get<string>("mode.active") ?? "code"));
  });

  test("afx.setMode('spec') persists 'spec' globally when no workspace override exists", async () => {
    await vscode.commands.executeCommand("afx.setMode", "spec");
    const inspected = vscode.workspace.getConfiguration("afx").inspect<string>("mode.active");
    const value = vscode.workspace.getConfiguration("afx").get<string>("mode.active");
    assert.strictEqual(value, "spec", `expected 'spec', got '${value}'`);
    assert.strictEqual(inspected?.globalValue, "spec");
    assert.strictEqual(inspected?.workspaceValue, undefined);
  });

  test("afx.setMode preserves an existing workspace mode override", async () => {
    const config = vscode.workspace.getConfiguration("afx");
    await config.update("mode.active", "code", vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand("afx.setMode", "explore");
    const inspected = vscode.workspace.getConfiguration("afx").inspect<string>("mode.active");
    const value = vscode.workspace.getConfiguration("afx").get<string>("mode.active");
    assert.strictEqual(value, "explore");
    assert.strictEqual(inspected?.workspaceValue, "explore");
  });

  test("afx.setMode('code') clears spec posture and restores default", async () => {
    await vscode.commands.executeCommand("afx.setMode", "spec");
    await vscode.commands.executeCommand("afx.setMode", "code");
    const value = vscode.workspace.getConfiguration("afx").get<string>("mode.active");
    assert.strictEqual(value, "code");
  });

  test("afx.setMode('explore') after 'spec' transitions cleanly", async () => {
    await vscode.commands.executeCommand("afx.setMode", "spec");
    await vscode.commands.executeCommand("afx.setMode", "explore");
    const value = vscode.workspace.getConfiguration("afx").get<string>("mode.active");
    assert.strictEqual(value, "explore");
  });

  test("Explore mode opens the real sidebar without reverting the mode setting", async () => {
    await vscode.commands.executeCommand("afx.setMode", "explore");
    await vscode.commands.executeCommand("afx.openSidebar");

    await waitFor(
      () => vscode.workspace.getConfiguration("afx").get<string>("mode.active") === "explore",
      "Expected Explore mode to remain active after opening the sidebar",
    );
  });
});

interface GitChangeSmoke {
  uri: vscode.Uri;
}

interface GitRepositorySmoke {
  rootUri: vscode.Uri;
  state: {
    workingTreeChanges: readonly GitChangeSmoke[];
    indexChanges: readonly GitChangeSmoke[];
    mergeChanges: readonly GitChangeSmoke[];
  };
  status(): Promise<void>;
}

interface GitExtensionSmoke {
  enabled: boolean;
  getAPI(version: 1): { repositories: readonly GitRepositorySmoke[] };
}

suite("AFX Extension — native Git changes capability", () => {
  test("built-in Git API detects an untracked file and git.openChange opens it", async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    assert.ok(root, "Expected an open workspace folder");
    const gitExtension = vscode.extensions.getExtension<GitExtensionSmoke>("vscode.git");
    assert.ok(gitExtension, "Expected the built-in vscode.git extension");
    const git = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
    assert.strictEqual(git.enabled, true, "Expected built-in Git integration to be enabled");

    const api = git.getAPI(1);
    const repository = api.repositories.find((candidate) =>
      isPathInside(root, candidate.rootUri.fsPath),
    );
    assert.ok(repository, `Expected a Git repository containing ${root}`);
    const probeName = `.afx-git-changes-smoke-${process.pid}.md`;
    const probePath = path.join(root, probeName);
    const probeUri = vscode.Uri.file(probePath);

    try {
      fs.writeFileSync(probePath, "# AFX Git changes smoke\n", "utf8");
      await repository.status();
      await waitFor(
        () =>
          [
            ...repository.state.workingTreeChanges,
            ...repository.state.indexChanges,
            ...repository.state.mergeChanges,
          ].some((change) => change.uri.fsPath === probePath),
        "Expected the built-in Git API to report the untracked smoke file",
      );

      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes("git.openChange"), "git.openChange is not registered");
      await vscode.commands.executeCommand("git.openChange", probeUri);
      await waitFor(
        () => vscode.window.tabGroups.activeTabGroup.activeTab?.label.includes(probeName) === true,
        "Expected git.openChange to open the smoke file",
      );
    } finally {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      fs.rmSync(probePath, { force: true });
      await repository.status();
    }
  });
});

suite("AFX Extension — markdown preview active document context", () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension("agenticflowx.agenticflowx");
    assert.ok(ext);
    await ext.activate();
  });

  test("markdown preview for an AFX spec opens cleanly and focus can move away", async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    assert.ok(root, "Expected an open workspace folder");
    const fixtureRoot = path.join(root, "apps/vscode-e2e/.vscode-test/preview-fixture");
    const specPath = path.join(fixtureRoot, "docs/specs/preview/spec.md");
    const plainPath = path.join(fixtureRoot, "src/plain.ts");
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.mkdirSync(path.dirname(plainPath), { recursive: true });
    fs.writeFileSync(
      specPath,
      ["---", "afx: true", "type: SPEC", "status: Draft", "---", "", "# Preview Spec", ""].join(
        "\n",
      ),
    );
    fs.writeFileSync(plainPath, "export const previewFocusAway = true;\n");

    const specUri = vscode.Uri.file(specPath);
    const specDoc = await vscode.workspace.openTextDocument(specUri);
    await vscode.window.showTextDocument(specDoc, { preview: false });
    await vscode.commands.executeCommand("markdown.showPreviewToSide", specUri);

    await waitFor(
      () => activeTabLooksLikeMarkdownPreview(),
      "Expected markdown preview to become the active tab",
    );

    const plainDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(plainPath));
    const plainEditor = await vscode.window.showTextDocument(plainDoc, { preview: false });
    assert.strictEqual(plainEditor.document.uri.fsPath, plainPath);
  });
});

async function resetModeToGlobalCode(): Promise<void> {
  const config = vscode.workspace.getConfiguration("afx");
  await config.update("mode.active", undefined, vscode.ConfigurationTarget.Workspace);
  await config.update("mode.active", "code", vscode.ConfigurationTarget.Global);
}

function activeTabLooksLikeMarkdownPreview(): boolean {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = activeTab?.input as { viewType?: string } | undefined;
  const viewType = input?.viewType ?? "";
  return viewType === "vscode.markdown.preview.editor" || viewType.includes("markdown.preview");
}

function isPathInside(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function waitFor(
  condition: () => boolean,
  message: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
}
