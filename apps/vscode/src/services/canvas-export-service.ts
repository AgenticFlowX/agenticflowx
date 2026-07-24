/**
 * User-mediated Canvas export boundary for extension-host callers.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-33] [NFR-5]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-FILES] [DES-API]
 */
import * as path from "node:path";

import * as vscode from "vscode";

import type { CanvasExportEncoding, CanvasExportFormat } from "@afx/shared";

export type { CanvasExportEncoding, CanvasExportFormat } from "@afx/shared";

/**
 * Fully rendered export payload. The service never dereferences file or HTTP inputs.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-FILES]
 */
export interface CanvasExportRequest {
  content: string;
  encoding: CanvasExportEncoding;
  format: CanvasExportFormat;
  suggestedName: string;
}

/**
 * Stable failure classification for UI messaging without parsing prose.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-API]
 */
export type CanvasExportErrorCode =
  | "invalid-request"
  | "too-large"
  | "dialog-failed"
  | "unsupported-target"
  | "invalid-target"
  | "write-failed";

/**
 * Truthful terminal result from one explicit export attempt.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-33]
 */
export type CanvasExportResult =
  | { outcome: "success"; target: vscode.Uri; byteLength: number }
  | { outcome: "cancelled" }
  | { outcome: "error"; code: CanvasExportErrorCode; message: string };

/**
 * Host safety limits. Callers may lower the byte ceiling for constrained surfaces.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-5]
 */
export interface CanvasExportServiceOptions {
  maxBytes?: number;
}

/**
 * Isolated export service that delegates target choice and overwrite confirmation
 * to VS Code's save dialog, then performs one workspace filesystem write.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-FILES] [DES-API]
 */
export interface CanvasExportService {
  export(request: CanvasExportRequest): Promise<CanvasExportResult>;
}

const DEFAULT_MAX_EXPORT_BYTES = 16 * 1024 * 1024;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RESERVED_WINDOWS_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const UNSAFE_BASENAME_PUNCTUATION = '<>:"/\\|?*';

const FORMAT_DETAILS = {
  canvas: { extension: "canvas", filterLabel: "JSON Canvas" },
  svg: { extension: "svg", filterLabel: "SVG" },
  png: { extension: "png", filterLabel: "PNG" },
} as const satisfies Record<CanvasExportFormat, { extension: string; filterLabel: string }>;

/**
 * Creates a bounded export service without registering protocol or UI handlers.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-FILES]
 */
export function createCanvasExportService(
  options: CanvasExportServiceOptions = {},
): CanvasExportService {
  const maxBytes = positiveByteLimit(options.maxBytes);

  return {
    async export(request) {
      if (!isCanvasExportFormat(request.format) || typeof request.content !== "string") {
        return error(
          "invalid-request",
          "Canvas export requires rendered Canvas, SVG, or PNG content.",
        );
      }
      if (
        (request.format === "png" && request.encoding !== "base64") ||
        (request.format !== "png" && request.encoding !== "utf8")
      ) {
        return error(
          "invalid-request",
          request.format === "png"
            ? "PNG export requires canonical base64 content."
            : "Canvas and SVG export require UTF-8 content.",
        );
      }
      const details = FORMAT_DETAILS[request.format];
      let bytes: Uint8Array;
      if (request.encoding === "base64") {
        const decodedByteLength = canonicalBase64DecodedLength(request.content);
        if (decodedByteLength === undefined) {
          return error("invalid-request", "PNG export contains invalid base64 content.");
        }
        if (decodedByteLength > maxBytes) {
          return error(
            "too-large",
            `Canvas export is ${decodedByteLength} bytes; the limit is ${maxBytes} bytes.`,
          );
        }
        const decoded = Buffer.from(request.content, "base64");
        if (decoded.toString("base64") !== request.content) {
          return error("invalid-request", "PNG export contains non-canonical base64 content.");
        }
        if (!hasPngSignature(decoded)) {
          return error("invalid-request", "PNG export does not contain a valid PNG signature.");
        }
        bytes = decoded;
      } else {
        bytes = Buffer.from(request.content, "utf8");
      }
      if (bytes.byteLength > maxBytes) {
        return error(
          "too-large",
          `Canvas export is ${bytes.byteLength} bytes; the limit is ${maxBytes} bytes.`,
        );
      }

      const suggestedName = safeSuggestedName(request.suggestedName, request.format);
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
      const defaultUri = workspaceRoot
        ? vscode.Uri.joinPath(workspaceRoot, suggestedName)
        : vscode.Uri.file(suggestedName);
      let target: vscode.Uri | undefined;
      try {
        target = await vscode.window.showSaveDialog({
          title: `Export Canvas as .${details.extension}`,
          saveLabel: "Export",
          defaultUri,
          filters: { [details.filterLabel]: [details.extension] },
        });
      } catch (cause) {
        return error(
          "dialog-failed",
          cause instanceof Error ? cause.message : "The export save dialog failed.",
        );
      }
      if (!target) return { outcome: "cancelled" };
      if (target.scheme === "http" || target.scheme === "https") {
        return error("unsupported-target", "Canvas exports cannot be written to HTTP targets.");
      }
      if (!validTargetBasename(target, details.extension)) {
        return error("invalid-target", `Choose a safe filename ending in .${details.extension}.`);
      }

      try {
        await vscode.workspace.fs.writeFile(target, bytes);
      } catch (cause) {
        return error(
          "write-failed",
          cause instanceof Error ? cause.message : "The Canvas export could not be written.",
        );
      }
      return { outcome: "success", target, byteLength: bytes.byteLength };
    },
  };
}

function positiveByteLimit(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_MAX_EXPORT_BYTES;
}

function isCanvasExportFormat(value: unknown): value is CanvasExportFormat {
  return value === "canvas" || value === "svg" || value === "png";
}

function canonicalBase64DecodedLength(value: string): number | undefined {
  if (value.length === 0 || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    return undefined;
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= PNG_SIGNATURE.byteLength &&
    PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  );
}

function safeSuggestedName(suggestedName: string, format: CanvasExportFormat): string {
  const extension = FORMAT_DETAILS[format].extension;
  const normalized = typeof suggestedName === "string" ? suggestedName.replaceAll("\\", "/") : "";
  const basename = path.posix.basename(normalized.trim());
  const withoutKnownExtension = basename.replace(/\.(?:canvas|svg|png)$/i, "");
  let stem = replaceUnsafeBasenameCharacters(withoutKnownExtension)
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .trim();
  if (!stem) stem = "canvas-export";
  if (RESERVED_WINDOWS_BASENAME.test(stem)) stem = `_${stem}`;
  const maxStemLength = 120 - extension.length - 1;
  stem = stem.slice(0, maxStemLength).replace(/[. ]+$/, "") || "canvas-export";
  return `${stem}.${extension}`;
}

function validTargetBasename(target: vscode.Uri, extension: string): boolean {
  const basename = path.posix.basename(target.path.replaceAll("\\", "/"));
  if (!basename || basename === "." || basename === ".." || basename.length > 255) return false;
  if ([...basename].some(isUnsafeBasenameCharacter)) return false;
  return basename.toLowerCase().endsWith(`.${extension}`);
}

function replaceUnsafeBasenameCharacters(value: string): string {
  return [...value]
    .map((character) => (isUnsafeBasenameCharacter(character) ? "-" : character))
    .join("");
}

function isUnsafeBasenameCharacter(character: string): boolean {
  return character.charCodeAt(0) <= 0x1f || UNSAFE_BASENAME_PUNCTUATION.includes(character);
}

function error(code: CanvasExportErrorCode, message: string): CanvasExportResult {
  return { outcome: "error", code, message };
}
