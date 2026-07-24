/**
 * Safe, user-mediated Canvas export host boundary.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-33] [NFR-5]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-FILES] [DES-API]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { type CanvasExportRequest, createCanvasExportService } from "./canvas-export-service";

const PNG_SIGNATURE_BASE64 = "iVBORw0KGgo=";

describe("createCanvasExportService", () => {
  const showSaveDialog = vi.fn<() => Promise<vscode.Uri | undefined>>();

  beforeEach(() => {
    Object.assign(vscode.window, { showSaveDialog });
    showSaveDialog.mockReset();
    (
      vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] }
    ).workspaceFolders = [{ uri: vscode.Uri.file("/workspace"), name: "workspace", index: 0 }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitizes the suggested basename and writes the exact dialog-selected Canvas target", async () => {
    const selected = vscode.Uri.file("/workspace/architecture.canvas");
    showSaveDialog.mockResolvedValue(selected);
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile").mockResolvedValue(undefined);
    const service = createCanvasExportService();

    const result = await service.export({
      content: '{"nodes":[],"edges":[]}',
      encoding: "utf8",
      format: "canvas",
      suggestedName: "../../architecture.svg",
    });

    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultUri: expect.objectContaining({ fsPath: "/workspace/architecture.canvas" }),
        filters: { "JSON Canvas": ["canvas"] },
        saveLabel: "Export",
      }),
    );
    expect(writeFile).toHaveBeenCalledWith(
      selected,
      Buffer.from('{"nodes":[],"edges":[]}', "utf8"),
    );
    expect(result).toEqual({
      outcome: "success",
      target: selected,
      byteLength: Buffer.byteLength('{"nodes":[],"edges":[]}'),
    });
  });

  it("allows a user-selected SVG target outside the workspace", async () => {
    const selected = vscode.Uri.file("/Users/rix/Desktop/architecture.svg");
    showSaveDialog.mockResolvedValue(selected);
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile").mockResolvedValue(undefined);

    const result = await createCanvasExportService().export({
      content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      encoding: "utf8",
      format: "svg",
      suggestedName: "architecture",
    });

    expect(writeFile).toHaveBeenCalledWith(selected, expect.any(Uint8Array));
    expect(result).toMatchObject({ outcome: "success", target: selected });
  });

  it("rejects content above the byte limit before opening a save dialog", async () => {
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");
    const service = createCanvasExportService({ maxBytes: 4 });

    const result = await service.export({
      content: "12345",
      encoding: "utf8",
      format: "svg",
      suggestedName: "x",
    });

    expect(result).toMatchObject({ outcome: "error", code: "too-large" });
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("accepts content exactly at the configured byte limit", async () => {
    const selected = vscode.Uri.file("/workspace/x.svg");
    showSaveDialog.mockResolvedValue(selected);
    vi.spyOn(vscode.workspace.fs, "writeFile").mockResolvedValue(undefined);

    const result = await createCanvasExportService({ maxBytes: 4 }).export({
      content: "1234",
      encoding: "utf8",
      format: "svg",
      suggestedName: "x",
    });

    expect(result).toMatchObject({ outcome: "success", byteLength: 4 });
  });

  it("decodes a canonical PNG payload and applies the limit to exact decoded bytes", async () => {
    const selected = vscode.Uri.file("/workspace/architecture.png");
    showSaveDialog.mockResolvedValue(selected);
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile").mockResolvedValue(undefined);

    const result = await createCanvasExportService({ maxBytes: 8 }).export({
      content: PNG_SIGNATURE_BASE64,
      encoding: "base64",
      format: "png",
      suggestedName: "../architecture.svg",
    });

    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultUri: expect.objectContaining({ fsPath: "/workspace/architecture.png" }),
        filters: { PNG: ["png"] },
        title: "Export Canvas as .png",
      }),
    );
    expect(writeFile).toHaveBeenCalledWith(selected, Buffer.from(PNG_SIGNATURE_BASE64, "base64"));
    expect(result).toEqual({ outcome: "success", target: selected, byteLength: 8 });
  });

  it("rejects a PNG one decoded byte above the limit before decoding or opening a dialog", async () => {
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");

    const result = await createCanvasExportService({ maxBytes: 8 }).export({
      content: "iVBORw0KGgoA",
      encoding: "base64",
      format: "png",
      suggestedName: "architecture.png",
    });

    expect(result).toMatchObject({ outcome: "error", code: "too-large" });
    expect(result).toMatchObject({ message: "Canvas export is 9 bytes; the limit is 8 bytes." });
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ["unpadded", "iVBORw0KGgo"],
    ["whitespace", "iVBORw0KGgo=\n"],
    ["non-canonical pad bits", "iVBORw0KGgp="],
    ["wrong signature", "bm90LWEtcG5n"],
  ])("rejects %s PNG base64 before opening a dialog", async (_label, content) => {
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");

    const result = await createCanvasExportService().export({
      content,
      encoding: "base64",
      format: "png",
      suggestedName: "architecture.png",
    });

    expect(result).toMatchObject({ outcome: "error", code: "invalid-request" });
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ["png", "utf8"],
    ["svg", "base64"],
    ["canvas", "base64"],
  ] as const)("rejects the %s/%s encoding mismatch", async (format, encoding) => {
    const result = await createCanvasExportService().export({
      content: PNG_SIGNATURE_BASE64,
      encoding,
      format,
      suggestedName: "architecture",
    });

    expect(result).toMatchObject({ outcome: "error", code: "invalid-request" });
    expect(showSaveDialog).not.toHaveBeenCalled();
  });

  it("reports cancellation without writing", async () => {
    showSaveDialog.mockResolvedValue(undefined);
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");

    const result = await createCanvasExportService().export({
      content: "{}",
      encoding: "utf8",
      format: "canvas",
      suggestedName: "plan.canvas",
    });

    expect(result).toEqual({ outcome: "cancelled" });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects unsupported runtime formats before opening the dialog", async () => {
    const request = {
      content: "https://example.com/diagram.svg",
      encoding: "utf8",
      format: "http",
      suggestedName: "diagram",
    } as unknown as CanvasExportRequest;

    const result = await createCanvasExportService().export(request);

    expect(result).toMatchObject({ outcome: "error", code: "invalid-request" });
    expect(showSaveDialog).not.toHaveBeenCalled();
  });

  it("rejects HTTP save targets returned by a foreign dialog provider", async () => {
    const selected = {
      scheme: "https",
      authority: "example.com",
      path: "/architecture.svg",
      fsPath: "https://example.com/architecture.svg",
    } as vscode.Uri;
    showSaveDialog.mockResolvedValue(selected);
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");

    const result = await createCanvasExportService().export({
      content: "<svg />",
      encoding: "utf8",
      format: "svg",
      suggestedName: "architecture",
    });

    expect(result).toMatchObject({ outcome: "error", code: "unsupported-target" });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("does not silently change a dialog-selected target with the wrong extension", async () => {
    showSaveDialog.mockResolvedValue(vscode.Uri.file("/workspace/architecture.txt"));
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile");

    const result = await createCanvasExportService().export({
      content: "<svg />",
      encoding: "utf8",
      format: "svg",
      suggestedName: "architecture",
    });

    expect(result).toMatchObject({ outcome: "error", code: "invalid-target" });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("uses the save dialog as the only collision/overwrite authority", async () => {
    const selected = vscode.Uri.file("/workspace/existing.canvas");
    showSaveDialog.mockResolvedValue(selected);
    const stat = vi.spyOn(vscode.workspace.fs, "stat");
    const writeFile = vi.spyOn(vscode.workspace.fs, "writeFile").mockResolvedValue(undefined);

    const result = await createCanvasExportService().export({
      content: "{}",
      encoding: "utf8",
      format: "canvas",
      suggestedName: "existing.canvas",
    });

    expect(stat).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ outcome: "success", target: selected });
  });

  it("reports dialog and write failures truthfully", async () => {
    showSaveDialog.mockRejectedValueOnce(new Error("dialog unavailable"));
    const service = createCanvasExportService();
    await expect(
      service.export({
        content: "{}",
        encoding: "utf8",
        format: "canvas",
        suggestedName: "plan",
      }),
    ).resolves.toMatchObject({ outcome: "error", code: "dialog-failed" });

    showSaveDialog.mockResolvedValueOnce(vscode.Uri.file("/workspace/plan.canvas"));
    vi.spyOn(vscode.workspace.fs, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    await expect(
      service.export({
        content: "{}",
        encoding: "utf8",
        format: "canvas",
        suggestedName: "plan",
      }),
    ).resolves.toMatchObject({ outcome: "error", code: "write-failed", message: "disk full" });
  });
});
