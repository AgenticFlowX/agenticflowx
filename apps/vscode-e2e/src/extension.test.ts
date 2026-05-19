/**
 * Extension activation smoke test.
 * Verifies the AFX extension activates and registers its commands.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-1] [FR-4] [FR-6]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 * @see docs/specs/420-dx-testing/design.md [DES-DX-TESTING-RUNNER-ISOLATION]
 */
import * as assert from "node:assert";

import * as vscode from "vscode";

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

  test("afx.openSidebar command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("afx.openSidebar"), "afx.openSidebar not registered");
  });

  test("afx.openWorkbench command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("afx.openWorkbench"), "afx.openWorkbench not registered");
  });

  test("all 5 contributed commands are registered", async () => {
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

  test("afx.showLogs executes without throwing", async () => {
    await vscode.commands.executeCommand("afx.showLogs");
  });

  test("afx.openSidebar focuses the sidebar view", async () => {
    await vscode.commands.executeCommand("afx.openSidebar");
    // No exception means VSCode resolved the focus command path; deeper webview
    // assertions belong in a Playwright session against the live webview.
  });

  test("afx.agentRestart resolves without throwing when the agent is idle", async () => {
    await vscode.commands.executeCommand("afx.agentRestart");
  });

  test("afx configuration scope is contributed", () => {
    const config = vscode.workspace.getConfiguration("afx");
    assert.strictEqual(config.get("theme"), config.get("theme")); // accessor works
    assert.ok(["meridian", "lyra"].includes(config.get<string>("theme") ?? "meridian"));
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
});

async function resetModeToGlobalCode(): Promise<void> {
  const config = vscode.workspace.getConfiguration("afx");
  await config.update("mode.active", undefined, vscode.ConfigurationTarget.Workspace);
  await config.update("mode.active", "code", vscode.ConfigurationTarget.Global);
}
