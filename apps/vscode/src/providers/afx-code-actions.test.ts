/**
 * AFX editor actions — verify selected editor text is routed into the chat prompt path.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-1] [FR-2]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-TEST]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createMockAgentManager } from "../__fixtures__/mock-agent-manager";
import { createMockLogger } from "../__fixtures__/mock-logger";
import { createAfxCodeActionProvider } from "./afx-code-actions";

type CommandContribution = {
  category?: string;
  command: string;
  icon?: string | { dark: string; light: string };
  title: string;
};

type MenuEntry = {
  command?: string;
  group?: string;
  submenu?: string;
  when?: string;
};

type ExtensionManifest = {
  contributes: {
    commands: CommandContribution[];
    menus: {
      "afx.editorContext": MenuEntry[];
      "editor/title": MenuEntry[];
    };
    submenus: Array<{ icon?: string; id: string; label: string }>;
  };
};

function readExtensionManifest(): ExtensionManifest {
  return JSON.parse(
    readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
  ) as ExtensionManifest;
}

describe("createAfxCodeActionProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: null,
    });
  });

  it("routes Add to Context into the composer draft via injected dispatch", async () => {
    const registered = new Map<string, () => Promise<void>>();
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((command, callback) => {
      registered.set(command, callback as () => Promise<void>);
      return { dispose: vi.fn() };
    });

    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: {
        selection: new vscode.Selection(new vscode.Position(4, 2), new vscode.Position(6, 9)),
        document: {
          uri: vscode.Uri.file("/workspace/src/demo.ts"),
          languageId: "typescript",
          getText: vi.fn(() => "const demo = true;"),
        },
      },
    });

    const sendPrompt = vi.fn(async () => {});
    const appendDraft = vi.fn(async () => {});
    const saveNote = vi.fn(async () => {});
    createAfxCodeActionProvider(createMockLogger().logger, createMockAgentManager(), {
      sendPrompt,
      appendDraft,
      saveNote,
    });

    await registered.get("afx.action.addToContext")?.();

    expect(appendDraft).toHaveBeenCalledWith(expect.stringContaining("/workspace/src/demo.ts"));
    expect(appendDraft).toHaveBeenCalledWith(expect.stringContaining(":5-7"));
    expect(appendDraft).toHaveBeenCalledWith(expect.stringContaining("const demo = true;"));
  });

  /**
   * Spec/design/task deterministic verbs auto-send via the host's sendPrompt
   * dispatch. This mirrors the chat composer strip's auto-send path (sendNow
   * → chat/send), so the right-click menu and the in-chat strip share the
   * same UX contract — click once, message goes out.
   *
   * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   */
  it.each([
    ["afx.action.specValidate", "/afx-spec validate"],
    ["afx.action.specReview", "/afx-spec review"],
    ["afx.action.specApprove", "/afx-spec approve"],
    ["afx.action.designValidate", "/afx-design validate"],
    ["afx.action.designReview", "/afx-design review"],
    ["afx.action.designApprove", "/afx-design approve"],
    ["afx.action.taskVerify", "/afx-task verify"],
    ["afx.action.taskPick", "/afx-task pick"],
    ["afx.action.taskStatus", "/afx-task status"],
    ["afx.action.journalRecap", "/afx-session recap"],
    ["afx.action.adrReview", "/afx-adr review"],
    ["afx.action.adrList", "/afx-adr list"],
  ])("auto-sends %s via sendPrompt (deterministic verb)", async (commandId, expectedPrefix) => {
    const registered = new Map<string, () => Promise<void>>();
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation((command, callback) => {
      registered.set(command, callback as () => Promise<void>);
      return { dispose: vi.fn() };
    });

    Object.defineProperty(vscode.window, "activeTextEditor", {
      configurable: true,
      value: {
        selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        document: {
          uri: vscode.Uri.file("/workspace/docs/specs/auth/spec.md"),
          languageId: "markdown",
          getText: vi.fn(() => "---\nafx: true\ntype: SPEC\n---\n# Auth"),
        },
      },
    });

    const sendPrompt = vi.fn(async () => {});
    const appendDraft = vi.fn(async () => {});
    const saveNote = vi.fn(async () => {});
    createAfxCodeActionProvider(createMockLogger().logger, createMockAgentManager(), {
      sendPrompt,
      appendDraft,
      saveNote,
    });

    await registered.get(commandId)?.();

    expect(sendPrompt, `${commandId} should auto-send`).toHaveBeenCalledWith(
      expect.stringContaining(expectedPrefix),
    );
    expect(appendDraft, `${commandId} should not draft`).not.toHaveBeenCalled();
  });

  it.each([
    ["afx.action.specRefine", "/afx-spec refine /workspace/docs/specs/auth/spec.md"],
    ["afx.action.designRefine", "/afx-design refine /workspace/docs/specs/auth/spec.md"],
    ["afx.action.taskBrief", "/afx-task brief 7.2", "Implement task 7.2"],
    ["afx.action.journalPromote", "/afx-session promote UA-D001", "UA-D001"],
    ["afx.action.adrSupersede", "/afx-adr supersede ADR-0004-cache ", ""],
    ["afx.action.adrAccept", "/afx-adr accept ADR-0004-cache", ""],
    [
      "afx.action.researchFinalize",
      "/afx-research finalize /workspace/docs/research/cache.md --to ",
      "",
    ],
  ])(
    "drafts %s for user confirmation or missing arguments",
    async (commandId, expectedPrompt, selectedText = "") => {
      const registered = new Map<string, () => Promise<void>>();
      vi.spyOn(vscode.commands, "registerCommand").mockImplementation((command, callback) => {
        registered.set(command, callback as () => Promise<void>);
        return { dispose: vi.fn() };
      });

      const filePath =
        commandId === "afx.action.adrSupersede" || commandId === "afx.action.adrAccept"
          ? "/workspace/docs/adr/ADR-0004-cache.md"
          : commandId === "afx.action.researchFinalize"
            ? "/workspace/docs/research/cache.md"
            : "/workspace/docs/specs/auth/spec.md";

      Object.defineProperty(vscode.window, "activeTextEditor", {
        configurable: true,
        value: {
          selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
          document: {
            uri: vscode.Uri.file(filePath),
            languageId: "markdown",
            getText: vi.fn(() => selectedText),
          },
        },
      });

      const sendPrompt = vi.fn(async () => {});
      const appendDraft = vi.fn(async () => {});
      const saveNote = vi.fn(async () => {});
      createAfxCodeActionProvider(createMockLogger().logger, createMockAgentManager(), {
        sendPrompt,
        appendDraft,
        saveNote,
      });

      await registered.get(commandId)?.();

      expect(appendDraft, `${commandId} should draft`).toHaveBeenCalledWith(expectedPrompt);
      expect(sendPrompt, `${commandId} should not auto-send`).not.toHaveBeenCalled();
    },
  );

  it("surfaces right-click parity actions only for matching AFX document kinds", () => {
    let provider: vscode.CodeActionProvider | undefined;
    vi.spyOn(vscode.commands, "registerCommand").mockImplementation(() => ({ dispose: vi.fn() }));
    vi.spyOn(vscode.languages, "registerCodeActionsProvider").mockImplementation((_selector, p) => {
      provider = p;
      return { dispose: vi.fn() };
    });

    createAfxCodeActionProvider(createMockLogger().logger, createMockAgentManager());

    function actionCommands(filePath: string, text: string): string[] {
      const doc = {
        uri: vscode.Uri.file(filePath),
        languageId: "markdown",
        getText: vi.fn(() => text),
      } as unknown as vscode.TextDocument;
      const actions = provider?.provideCodeActions?.(
        doc,
        new vscode.Range(0, 0, 0, 0),
        {} as vscode.CodeActionContext,
        {} as vscode.CancellationToken,
      ) as vscode.CodeAction[] | undefined;
      return actions?.map((action) => action.command?.command ?? "") ?? [];
    }

    expect(actionCommands("/workspace/docs/specs/auth/spec.md", "# Auth")).toEqual(
      expect.arrayContaining(["afx.action.specRefine", "afx.action.specValidate"]),
    );
    expect(actionCommands("/workspace/docs/specs/auth/tasks.md", "# Tasks")).toEqual(
      expect.arrayContaining(["afx.action.taskStatus", "afx.action.taskBrief"]),
    );
    expect(actionCommands("/workspace/docs/specs/auth/journal.md", "# Journal")).toEqual(
      expect.arrayContaining(["afx.action.journalRecap", "afx.action.journalPromote"]),
    );
    expect(actionCommands("/workspace/docs/adr/ADR-0004-cache.md", "---\ntype: ADR\n---")).toEqual(
      expect.arrayContaining([
        "afx.action.adrReview",
        "afx.action.adrList",
        "afx.action.adrSupersede",
        "afx.action.adrAccept",
      ]),
    );
    expect(actionCommands("/workspace/docs/research/cache.md", "---\ntype: RESEARCH\n---")).toEqual(
      expect.arrayContaining(["afx.action.researchFinalize"]),
    );
    expect(actionCommands("/workspace/docs/specs/auth/spec.md", "# Auth")).not.toContain(
      "afx.action.researchFinalize",
    );
  });

  it("surfaces a single Open Preview title action with the AFX activity icon", () => {
    const packageJson = readExtensionManifest();
    const iconSvg = readFileSync(resolve(__dirname, "../../resources/activity-icon.svg"), "utf8");
    const previewCommand = packageJson.contributes.commands.find(
      (entry) => entry.command === "afx.openAfxPreview",
    );
    const workbenchCommand = packageJson.contributes.commands.find(
      (entry) => entry.command === "afx.openWorkbench",
    );
    const submenu = packageJson.contributes.submenus.find(
      (entry) => entry.id === "afx.editorContext",
    );
    const editorTitle = packageJson.contributes.menus["editor/title"];
    const editorContext = packageJson.contributes.menus["afx.editorContext"];

    expect(previewCommand).toMatchObject({
      category: "AgenticFlowX",
      command: "afx.openAfxPreview",
      icon: {
        dark: "resources/activity-icon.svg",
        light: "resources/activity-icon.svg",
      },
      title: "Open Preview",
    });
    expect(workbenchCommand).toMatchObject({
      category: "AgenticFlowX",
      command: "afx.openWorkbench",
      title: "Open Workbench",
    });
    expect(submenu).toMatchObject({
      icon: "resources/activity-icon.svg",
      id: "afx.editorContext",
      label: "AgenticFlowX",
    });
    expect(editorTitle[0]).toMatchObject({
      command: "afx.openAfxPreview",
      group: "navigation@0",
      when: "editorLangId == markdown",
    });
    expect(editorTitle).toHaveLength(1);
    expect(editorTitle.some((entry) => entry.submenu === "afx.editorContext")).toBe(false);
    expect(editorContext[0]).toMatchObject({
      command: "afx.openAfxPreview",
      group: "0_preview@0",
      when: "editorLangId == markdown",
    });
    expect(editorContext[1]).toMatchObject({
      command: "afx.openWorkbench",
      group: "0_preview@1",
    });
    expect(editorContext[2]).toMatchObject({
      command: "afx.action.saveToNotes",
      group: "1_notes@1",
    });
    expect(iconSvg).toContain(">AF<");
    expect(iconSvg).toContain(">x<");
    expect(iconSvg).toContain("#111111");
    expect(iconSvg).not.toContain("#F59E0B");
    expect(iconSvg).not.toContain("#C5C5C5");
  });

  it("contributes command and menu entries for every supported right-click parity action", () => {
    const packageJson = readExtensionManifest();
    const commands = new Set(packageJson.contributes.commands.map((entry) => entry.command));
    const menuEntries = new Map(
      packageJson.contributes.menus["afx.editorContext"]
        .filter((entry) => entry.command)
        .map((entry) => [entry.command, entry.group]),
    );

    const expected = [
      "afx.action.specRefine",
      "afx.action.designRefine",
      "afx.action.taskStatus",
      "afx.action.taskBrief",
      "afx.action.journalRecap",
      "afx.action.journalPromote",
      "afx.action.adrReview",
      "afx.action.adrList",
      "afx.action.adrSupersede",
      "afx.action.adrAccept",
      "afx.action.researchFinalize",
    ];

    for (const command of expected) {
      expect(commands.has(command), `${command} contributes.commands`).toBe(true);
      expect(menuEntries.has(command), `${command} contributes.menus`).toBe(true);
    }
    expect(menuEntries.get("afx.action.specRefine")).toBe("3_spec@1");
    expect(menuEntries.get("afx.action.journalRecap")).toBe("6_journal@1");
    expect(menuEntries.get("afx.action.adrAccept")).toBe("7_adr@4");
    expect(menuEntries.get("afx.action.researchFinalize")).toBe("8_research@1");
  });

  it("keeps every AgenticFlowX context-menu command registered once", () => {
    const packageJson = readExtensionManifest();
    const commands = new Set(packageJson.contributes.commands.map((entry) => entry.command));
    const menuCommands = packageJson.contributes.menus["afx.editorContext"]
      .map((entry) => entry.command)
      .filter((command): command is string => Boolean(command));

    expect(new Set(menuCommands).size).toBe(menuCommands.length);
    for (const command of menuCommands) {
      expect(commands.has(command), `${command} contributes.commands`).toBe(true);
    }
  });
});
