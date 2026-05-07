/**
 * AFX editor actions — verify selected editor text is routed into the chat prompt path.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-1] [FR-2]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-TEST]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { createMockAgentManager } from "../__fixtures__/mock-agent-manager";
import { createMockLogger } from "../__fixtures__/mock-logger";
import { createAfxCodeActionProvider } from "./afx-code-actions";

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
});
