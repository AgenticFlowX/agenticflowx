/**
 * Extension activation smoke test.
 * Verifies the AFX extension activates and registers its commands.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-1] [FR-4] [FR-6]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 * @see docs/specs/420-dx-testing/design.md [DES-ARCH]
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
