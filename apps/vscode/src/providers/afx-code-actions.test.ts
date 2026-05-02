/**
 * AFX editor actions — verify selected editor text is routed into the chat prompt path.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
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
});
