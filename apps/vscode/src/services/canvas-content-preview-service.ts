/**
 * Host-only rich-content previews for portable Canvas source references.
 *
 * Local sources are resolved from their canonical `afxSource` identity and
 * prefer live editor buffers. Remote metadata is opt-in, bounded, sanitized,
 * and guarded against SSRF before the initial request and every redirect.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-20] [FR-35] [FR-36] [FR-37] [NFR-9] [NFR-13]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-HOST] [DES-SEC] [DES-ERR]
 */
import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import * as path from "node:path";
import { Readable } from "node:stream";

import * as vscode from "vscode";

import type {
  CanvasContentPreviewPayload,
  CanvasUrlPreviewPayload,
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
} from "@afx/shared";

import { parseKanbanMarkdown } from "./kanban-markdown";
import { NotesMarkdownDocument } from "./notes-markdown";
import type { WorkbenchFileState, WorkbenchTextSnapshot } from "./workbench-file-state";

export type CanvasContentPreviewState = "ready" | "missing" | "blocked" | "error" | "offline";

export type CanvasContentPreviewCode =
  | "outside-workspace"
  | "not-found"
  | "read-failed"
  | "file-too-large"
  | "image-too-large"
  | "invalid-image"
  | "unsafe-image-type"
  | "invalid-notes"
  | "invalid-board"
  | "network-disabled"
  | "unsupported-url"
  | "credentialed-url"
  | "private-address"
  | "dns-failed"
  | "network-error"
  | "timeout"
  | "redirect-without-location"
  | "redirect-loop"
  | "too-many-redirects"
  | "response-too-large"
  | "unsupported-content-type"
  | "http-status";

export interface CanvasNotesPreviewSummary {
  totalNotes: number;
  items: Array<{ timestamp: string; text: string }>;
}

export interface CanvasBoardPreviewSummary {
  totalColumns: number;
  totalCards: number;
  columns: Array<{ title: string; cardCount: number; items: string[] }>;
}

export interface CanvasSourcePreview {
  kind: "markdown" | "file" | "image" | "notes" | "board";
  state: CanvasContentPreviewState;
  source: WorkbenchSourceIdentity;
  uri?: vscode.Uri;
  code?: CanvasContentPreviewCode;
  message?: string;
  revision?: WorkbenchSourceRevision;
  content?: string;
  excerpt?: string;
  truncated?: boolean;
  mediaType?: string;
  byteLength?: number;
  summary?: CanvasNotesPreviewSummary | CanvasBoardPreviewSummary;
}

export interface CanvasUrlPreviewRequest {
  url: string;
  allowNetwork: boolean;
}

export interface CanvasUrlMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
}

export interface CanvasUrlPreview {
  kind: "url";
  state: CanvasContentPreviewState;
  url: string;
  finalUrl?: string;
  code?: CanvasContentPreviewCode;
  message?: string;
  httpStatus?: number;
  metadata?: CanvasUrlMetadata;
}

export interface CanvasPreviewFetchResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(reason?: unknown): void | Promise<void>;
    };
  } | null;
}

export interface CanvasPreviewFetchInit {
  method: "GET";
  redirect: "manual";
  signal: AbortSignal;
  headers: Readonly<Record<string, string>>;
  /** Validated addresses the transport must connect to without resolving again. */
  addresses: readonly CanvasPreviewDnsAddress[];
}

export type CanvasPreviewFetch = (
  url: string,
  init: CanvasPreviewFetchInit,
) => Promise<CanvasPreviewFetchResponse>;

export interface CanvasPreviewDnsAddress {
  address: string;
  family: 4 | 6;
}

export type CanvasPreviewDnsLookup = (
  hostname: string,
) => Promise<readonly CanvasPreviewDnsAddress[]>;

export interface CanvasContentPreviewService {
  previewSource(source: WorkbenchSourceIdentity): Promise<CanvasSourcePreview>;
  previewUrl(request: CanvasUrlPreviewRequest): Promise<CanvasUrlPreview>;
}

export interface CanvasContentPreviewServiceOptions {
  fileState: Pick<WorkbenchFileState, "resolve" | "readText">;
  readFile?: (uri: vscode.Uri) => Promise<Uint8Array>;
  stat?: (uri: vscode.Uri) => Promise<vscode.FileStat>;
  getOpenTextDocuments?: () => readonly vscode.TextDocument[];
  fetch?: CanvasPreviewFetch;
  lookup?: CanvasPreviewDnsLookup;
  maxImageBytes?: number;
  maxLocalBytes?: number;
  maxTextChars?: number;
  maxRemoteBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
}

export interface SerializedCanvasSourcePreview {
  owner: WorkbenchSourceIdentity;
  revision?: WorkbenchSourceRevision;
  preview: CanvasContentPreviewPayload;
}

/** Strip host-only fields and optionally map one validated raster to a webview URL. */
export function serializeCanvasSourcePreview(
  result: CanvasSourcePreview,
  toWebviewResource?: (uri: vscode.Uri) => string,
): SerializedCanvasSourcePreview {
  const { source: owner, revision, uri, ...previewFields } = result;
  const preview: CanvasContentPreviewPayload = { ...previewFields };
  if (result.kind === "image" && result.state === "ready" && uri && toWebviewResource) {
    preview.resourceUri = toWebviewResource(uri);
  }
  return { owner, ...(revision ? { revision } : {}), preview };
}

/** Remove request/transport identity from already-sanitized URL metadata. */
export function serializeCanvasUrlPreview(result: CanvasUrlPreview): CanvasUrlPreviewPayload {
  const { kind: _kind, url: _url, ...preview } = result;
  return preview;
}

const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_LOCAL_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_TEXT_CHARS = 20_000;
const DEFAULT_MAX_REMOTE_BYTES = 256 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 5_000;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NOTES_PATH = /(^|\/)\.afx\/notes\.md$/i;
const BOARD_PATH = /(^|\/)\.afx\/kanban\/.*\.md$/i;

class PreviewTimeoutError extends Error {}

interface ResolvedText {
  content: string;
  revision: WorkbenchSourceRevision;
  byteLength: number;
}

type ResolvedTextResult =
  | { ok: true; text: ResolvedText }
  | {
      ok: false;
      reason: "missing" | "too-large" | "read-failed";
      byteLength?: number;
    };

interface NetworkValidationSuccess {
  ok: true;
  url: URL;
  addresses: readonly CanvasPreviewDnsAddress[];
}

interface NetworkValidationFailure {
  ok: false;
  preview: CanvasUrlPreview;
}

type NetworkValidation = NetworkValidationSuccess | NetworkValidationFailure;

/** Create one isolated preview service; no network request occurs without per-request consent. */
export function createCanvasContentPreviewService(
  options: CanvasContentPreviewServiceOptions,
): CanvasContentPreviewService {
  const readFile = options.readFile ?? ((uri) => vscode.workspace.fs.readFile(uri));
  const stat = options.stat ?? ((uri) => vscode.workspace.fs.stat(uri));
  const getOpenTextDocuments =
    options.getOpenTextDocuments ?? (() => vscode.workspace.textDocuments);
  const fetchPreview = options.fetch ?? defaultFetch;
  const lookup = options.lookup ?? defaultLookup;
  const maxImageBytes = positiveLimit(options.maxImageBytes, DEFAULT_MAX_IMAGE_BYTES);
  const maxLocalBytes = positiveLimit(options.maxLocalBytes, DEFAULT_MAX_LOCAL_BYTES);
  const maxTextChars = positiveLimit(options.maxTextChars, DEFAULT_MAX_TEXT_CHARS);
  const maxRemoteBytes = positiveLimit(options.maxRemoteBytes, DEFAULT_MAX_REMOTE_BYTES);
  const maxRedirects = nonNegativeLimit(options.maxRedirects, DEFAULT_MAX_REDIRECTS);
  const timeoutMs = positiveLimit(options.timeoutMs, DEFAULT_TIMEOUT_MS);

  const missing = (
    kind: CanvasSourcePreview["kind"],
    source: WorkbenchSourceIdentity,
    uri: vscode.Uri,
  ): CanvasSourcePreview => ({
    kind,
    state: "missing",
    source,
    uri,
    code: "not-found",
    message: `Canvas source \`${source.relativePath}\` was not found.`,
  });

  const readResolvedText = async (uri: vscode.Uri): Promise<ResolvedTextResult> => {
    const managed = await options.fileState.readText(uri);
    if (managed) {
      const text = textFromManagedSnapshot(managed);
      return text.byteLength > maxLocalBytes
        ? { ok: false, reason: "too-large", byteLength: text.byteLength }
        : { ok: true, text };
    }

    const openDocument = getOpenTextDocuments().find((document) => sameUri(document.uri, uri));
    if (openDocument) {
      const content = openDocument.getText();
      const byteLength = Buffer.byteLength(content);
      if (byteLength > maxLocalBytes) {
        return { ok: false, reason: "too-large", byteLength };
      }
      const revision = digest(content);
      const diskRevision = await readFile(uri).then(
        (bytes) => digest(bytes),
        () => undefined,
      );
      return {
        ok: true,
        text: {
          content,
          byteLength,
          revision: {
            contentRevision: revision,
            diskRevision,
            documentVersion: openDocument.version,
            dirty: openDocument.isDirty,
          },
        },
      };
    }

    let fileStat: vscode.FileStat;
    try {
      fileStat = await stat(uri);
    } catch {
      return { ok: false, reason: "missing" };
    }
    if (fileStat.type !== vscode.FileType.File) return { ok: false, reason: "missing" };
    if (fileStat.size > maxLocalBytes) {
      return { ok: false, reason: "too-large", byteLength: fileStat.size };
    }

    let bytes: Uint8Array;
    try {
      bytes = await readFile(uri);
    } catch {
      return { ok: false, reason: "read-failed" };
    }
    if (bytes.byteLength > maxLocalBytes) {
      return { ok: false, reason: "too-large", byteLength: bytes.byteLength };
    }
    const content = decodeUtf8(bytes);
    if (content === undefined) return { ok: false, reason: "read-failed" };
    const revision = digest(bytes);
    return {
      ok: true,
      text: {
        content,
        byteLength: bytes.byteLength,
        revision: { contentRevision: revision, diskRevision: revision, dirty: false },
      },
    };
  };

  const previewTextSource = async (
    kind: "markdown" | "notes" | "board",
    source: WorkbenchSourceIdentity,
    uri: vscode.Uri,
  ): Promise<CanvasSourcePreview> => {
    let result: ResolvedTextResult;
    try {
      result = await readResolvedText(uri);
    } catch {
      return {
        kind,
        state: "error",
        source,
        uri,
        code: "read-failed",
        message: `Canvas could not read \`${source.relativePath}\`.`,
      };
    }
    if (!result.ok) {
      if (result.reason === "missing") return missing(kind, source, uri);
      if (result.reason === "too-large") {
        return {
          kind,
          state: "blocked",
          source,
          uri,
          code: "file-too-large",
          message: `File exceeds the ${maxLocalBytes}-byte preview limit.`,
          byteLength: result.byteLength,
        };
      }
      return {
        kind,
        state: "error",
        source,
        uri,
        code: "read-failed",
        message: `Canvas could not read \`${source.relativePath}\`.`,
      };
    }
    const { text } = result;

    if (kind === "notes") {
      const document = NotesMarkdownDocument.parse(text.content);
      if (!document.valid) {
        return {
          kind,
          state: "error",
          source,
          uri,
          code: "invalid-notes",
          message: document.diagnostics[0] ?? "The Notes document is malformed.",
          revision: text.revision,
        };
      }
      return {
        kind,
        state: "ready",
        source,
        uri,
        revision: text.revision,
        byteLength: text.byteLength,
        summary: {
          totalNotes: document.notes.length,
          items: document.notes.slice(0, 3).map((note) => ({
            timestamp: note.timestamp,
            text: compactText(note.text, 180),
          })),
        },
      };
    }

    if (kind === "board") {
      const board = parseKanbanMarkdown(text.content);
      if (board.error) {
        return {
          kind,
          state: "error",
          source,
          uri,
          code: "invalid-board",
          message: board.error,
          revision: text.revision,
        };
      }
      return {
        kind,
        state: "ready",
        source,
        uri,
        revision: text.revision,
        byteLength: text.byteLength,
        summary: {
          totalColumns: board.columns.length,
          totalCards: board.columns.reduce((total, column) => total + column.cards.length, 0),
          columns: board.columns.slice(0, 6).map((column) => ({
            title: compactText(column.title, 100),
            cardCount: column.cards.length,
            items: column.cards.slice(0, 3).map((card) => compactText(card.text, 140)),
          })),
        },
      };
    }

    return {
      kind,
      state: "ready",
      source,
      uri,
      revision: text.revision,
      byteLength: text.byteLength,
      content: text.content.slice(0, maxTextChars),
      truncated: text.content.length > maxTextChars,
      mediaType: "text/markdown",
    };
  };

  const previewImage = async (
    source: WorkbenchSourceIdentity,
    uri: vscode.Uri,
    extension: string,
  ): Promise<CanvasSourcePreview> => {
    if (extension === ".svg") {
      return {
        kind: "image",
        state: "blocked",
        source,
        uri,
        code: "unsafe-image-type",
        message: "SVG previews are blocked because SVG can contain executable content.",
      };
    }

    let fileStat: vscode.FileStat;
    try {
      fileStat = await stat(uri);
    } catch {
      return missing("image", source, uri);
    }
    if (fileStat.type !== vscode.FileType.File) return missing("image", source, uri);
    if (fileStat.size > maxImageBytes) {
      return {
        kind: "image",
        state: "blocked",
        source,
        uri,
        code: "image-too-large",
        message: `Image exceeds the ${maxImageBytes}-byte preview limit.`,
        byteLength: fileStat.size,
      };
    }

    let bytes: Uint8Array;
    try {
      bytes = await readFile(uri);
    } catch {
      return {
        kind: "image",
        state: "error",
        source,
        uri,
        code: "read-failed",
        message: `Canvas could not read \`${source.relativePath}\`.`,
      };
    }
    if (bytes.byteLength > maxImageBytes) {
      return {
        kind: "image",
        state: "blocked",
        source,
        uri,
        code: "image-too-large",
        message: `Image exceeds the ${maxImageBytes}-byte preview limit.`,
        byteLength: bytes.byteLength,
      };
    }

    const mediaType = detectImageMediaType(bytes);
    if (!mediaType || !extensionMatchesImageType(extension, mediaType)) {
      return {
        kind: "image",
        state: "blocked",
        source,
        uri,
        code: "invalid-image",
        message: "Image bytes do not match the supported file type.",
        byteLength: bytes.byteLength,
      };
    }
    const revision = digest(bytes);
    return {
      kind: "image",
      state: "ready",
      source,
      uri,
      mediaType,
      byteLength: bytes.byteLength,
      revision: { contentRevision: revision, diskRevision: revision, dirty: false },
    };
  };

  const previewGeneralFile = async (
    source: WorkbenchSourceIdentity,
    uri: vscode.Uri,
  ): Promise<CanvasSourcePreview> => {
    const openDocument = getOpenTextDocuments().find((document) => sameUri(document.uri, uri));
    if (openDocument) {
      const content = openDocument.getText();
      const contentRevision = digest(content);
      const diskRevision = await readFile(uri).then(
        (bytes) => digest(bytes),
        () => undefined,
      );
      return {
        kind: "file",
        state: "ready",
        source,
        uri,
        excerpt: content.slice(0, maxTextChars),
        truncated: content.length > maxTextChars,
        mediaType: generalTextMediaType(source.relativePath),
        byteLength: Buffer.byteLength(content),
        revision: {
          contentRevision,
          diskRevision,
          documentVersion: openDocument.version,
          dirty: openDocument.isDirty,
        },
      };
    }

    let fileStat: vscode.FileStat;
    try {
      fileStat = await stat(uri);
    } catch {
      return missing("file", source, uri);
    }
    if (fileStat.type !== vscode.FileType.File) return missing("file", source, uri);
    if (fileStat.size > maxLocalBytes) {
      return {
        kind: "file",
        state: "blocked",
        source,
        uri,
        code: "file-too-large",
        message: `File exceeds the ${maxLocalBytes}-byte preview limit.`,
        byteLength: fileStat.size,
      };
    }

    let bytes: Uint8Array;
    try {
      bytes = await readFile(uri);
    } catch {
      return {
        kind: "file",
        state: "error",
        source,
        uri,
        code: "read-failed",
        message: `Canvas could not read \`${source.relativePath}\`.`,
      };
    }
    const contentRevision = digest(bytes);
    const content = decodeUtf8(bytes);
    return {
      kind: "file",
      state: "ready",
      source,
      uri,
      excerpt: content?.slice(0, maxTextChars),
      truncated: content === undefined ? false : content.length > maxTextChars,
      mediaType:
        content === undefined
          ? "application/octet-stream"
          : generalTextMediaType(source.relativePath),
      byteLength: bytes.byteLength,
      revision: { contentRevision, diskRevision: contentRevision, dirty: false },
    };
  };

  return {
    async previewSource(source) {
      let uri: vscode.Uri | undefined;
      try {
        uri = options.fileState.resolve(source);
      } catch {
        uri = undefined;
      }
      const normalizedPath = source.relativePath.replaceAll("\\", "/");
      const extension = path.posix.extname(normalizedPath).toLocaleLowerCase();
      const kind: CanvasSourcePreview["kind"] = NOTES_PATH.test(normalizedPath)
        ? "notes"
        : BOARD_PATH.test(normalizedPath)
          ? "board"
          : extension === ".md" || extension === ".markdown"
            ? "markdown"
            : extension === ".svg" || IMAGE_EXTENSIONS.has(extension)
              ? "image"
              : "file";
      if (!uri) {
        return {
          kind,
          state: "blocked",
          source,
          code: "outside-workspace",
          message: "Canvas source is not inside its canonical open workspace root.",
        };
      }
      if (kind === "image") return previewImage(source, uri, extension);
      if (kind === "file") return previewGeneralFile(source, uri);
      return previewTextSource(kind, source, uri);
    },

    async previewUrl(request) {
      const normalizedOriginal = normalizeUrlForResult(request.url);
      if (!request.allowNetwork) {
        return urlFailure(
          normalizedOriginal,
          "blocked",
          "network-disabled",
          "URL preview requires explicit network permission.",
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let currentRaw = request.url;
      let originalUrl = normalizedOriginal;
      let redirects = 0;
      const visited = new Set<string>();

      try {
        while (true) {
          const validation = await validateNetworkUrl(
            currentRaw,
            originalUrl,
            lookup,
            controller.signal,
          );
          if (!validation.ok) return validation.preview;
          const current = validation.url;
          if (!originalUrl) originalUrl = current.toString();
          const currentUrl = current.toString();
          if (visited.has(currentUrl)) {
            return urlFailure(
              originalUrl,
              "error",
              "redirect-loop",
              "URL preview redirect loop detected.",
              currentUrl,
            );
          }
          visited.add(currentUrl);

          let response: CanvasPreviewFetchResponse;
          try {
            response = await fetchPreview(currentUrl, {
              method: "GET",
              redirect: "manual",
              signal: controller.signal,
              addresses: validation.addresses,
              headers: {
                accept: "text/html, application/xhtml+xml;q=0.9",
                "user-agent": "AgenticFlowX-Canvas-Preview/1",
              },
            });
          } catch {
            if (controller.signal.aborted) {
              return urlFailure(
                originalUrl,
                "offline",
                "timeout",
                "URL preview timed out.",
                currentUrl,
              );
            }
            return urlFailure(
              originalUrl,
              "offline",
              "network-error",
              "URL preview is unavailable while the network is offline.",
              currentUrl,
            );
          }

          if (REDIRECT_STATUSES.has(response.status)) {
            await cancelBody(response);
            const location = response.headers.get("location");
            if (!location) {
              return urlFailure(
                originalUrl,
                "error",
                "redirect-without-location",
                "URL preview received a redirect without a destination.",
                currentUrl,
              );
            }
            if (redirects >= maxRedirects) {
              return urlFailure(
                originalUrl,
                "error",
                "too-many-redirects",
                `URL preview exceeded ${maxRedirects} redirects.`,
                currentUrl,
              );
            }
            try {
              currentRaw = new URL(location, current).toString();
            } catch {
              return urlFailure(
                originalUrl,
                "blocked",
                "unsupported-url",
                "URL preview received an invalid redirect destination.",
                currentUrl,
              );
            }
            redirects++;
            continue;
          }

          if (response.status < 200 || response.status >= 300) {
            await cancelBody(response);
            return {
              ...urlFailure(
                originalUrl,
                "error",
                "http-status",
                `URL preview returned HTTP ${response.status}.`,
                currentUrl,
              ),
              httpStatus: response.status,
            };
          }

          const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
          if (
            !/^text\/html\b/.test(contentType) &&
            !/^application\/xhtml\+xml\b/.test(contentType)
          ) {
            await cancelBody(response);
            return urlFailure(
              originalUrl,
              "blocked",
              "unsupported-content-type",
              "URL preview accepts HTML metadata only.",
              currentUrl,
            );
          }

          const declaredLength = Number(response.headers.get("content-length"));
          if (Number.isFinite(declaredLength) && declaredLength > maxRemoteBytes) {
            await cancelBody(response);
            return urlFailure(
              originalUrl,
              "blocked",
              "response-too-large",
              `URL preview exceeds the ${maxRemoteBytes}-byte limit.`,
              currentUrl,
            );
          }

          const body = await readBoundedBody(response, maxRemoteBytes, controller.signal);
          if (body.tooLarge) {
            return urlFailure(
              originalUrl,
              "blocked",
              "response-too-large",
              `URL preview exceeds the ${maxRemoteBytes}-byte limit.`,
              currentUrl,
            );
          }
          const html = Buffer.concat(body.chunks.map((chunk) => Buffer.from(chunk))).toString(
            "utf8",
          );
          const metadata = extractMetadata(html);
          if (metadata.imageUrl) {
            const candidate = safeResolveUrl(metadata.imageUrl, current);
            if (candidate) {
              const imageValidation = await validateNetworkUrl(
                candidate.toString(),
                originalUrl,
                lookup,
                controller.signal,
              );
              metadata.imageUrl = imageValidation.ok ? imageValidation.url.toString() : undefined;
            } else {
              metadata.imageUrl = undefined;
            }
          }
          removeUndefined(metadata);
          return {
            kind: "url",
            state: "ready",
            url: originalUrl,
            finalUrl: currentUrl,
            metadata,
          };
        }
      } catch (error) {
        if (error instanceof PreviewTimeoutError || controller.signal.aborted) {
          return urlFailure(originalUrl, "offline", "timeout", "URL preview timed out.");
        }
        return urlFailure(
          originalUrl,
          "offline",
          "network-error",
          "URL preview is unavailable while the network is offline.",
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function textFromManagedSnapshot(snapshot: WorkbenchTextSnapshot): ResolvedText {
  return {
    content: snapshot.content,
    byteLength: Buffer.byteLength(snapshot.content),
    revision: snapshot.sourceRevision,
  };
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return a.scheme === b.scheme && a.authority === b.authority && a.path === b.path;
}

function positiveLimit(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function nonNegativeLimit(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  if (bytes.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function compactText(value: string, maxLength: number): string {
  const compact = Array.from(value, (character) =>
    isUnsafeTextControl(character.codePointAt(0) ?? 0) ? " " : character,
  )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > maxLength
    ? `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
    : compact;
}

function isUnsafeTextControl(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x061c ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

function generalTextMediaType(filePath: string): string {
  const extension = path.posix.extname(filePath).toLocaleLowerCase();
  if (extension === ".json" || extension === ".jsonc") return "application/json";
  if (extension === ".yaml" || extension === ".yml") return "application/yaml";
  if (extension === ".html" || extension === ".htm") return "text/plain";
  return "text/plain";
}

function detectImageMediaType(bytes: Uint8Array): string | undefined {
  if (hasPrefix(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (hasPrefix(bytes, [255, 216, 255])) return "image/jpeg";
  const ascii = Buffer.from(bytes.subarray(0, 16)).toString("ascii");
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return "image/gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.startsWith("BM")) return "image/bmp";
  if (ascii.slice(4, 8) === "ftyp" && /^(avif|avis)/.test(ascii.slice(8, 12))) return "image/avif";
  return undefined;
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function extensionMatchesImageType(extension: string, mediaType: string): boolean {
  if (mediaType === "image/jpeg") return extension === ".jpg" || extension === ".jpeg";
  return (
    (mediaType === "image/png" && extension === ".png") ||
    (mediaType === "image/gif" && extension === ".gif") ||
    (mediaType === "image/webp" && extension === ".webp") ||
    (mediaType === "image/avif" && extension === ".avif") ||
    (mediaType === "image/bmp" && extension === ".bmp")
  );
}

async function defaultFetch(
  url: string,
  init: CanvasPreviewFetchInit,
): Promise<CanvasPreviewFetchResponse> {
  const target = new URL(url);
  const pinned = init.addresses[0];
  if (!pinned) throw new Error("No validated remote address is available.");
  const request = target.protocol === "https:" ? httpsRequest : httpRequest;
  return await new Promise<CanvasPreviewFetchResponse>((resolve, reject) => {
    const operation = request(
      {
        protocol: target.protocol,
        hostname: pinned.address,
        family: pinned.family,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method: init.method,
        headers: { ...init.headers, host: target.host },
        signal: init.signal,
        ...(target.protocol === "https:" ? { servername: target.hostname } : {}),
      },
      (response) => {
        const body = Readable.toWeb(response) as ReadableStream<Uint8Array>;
        resolve({
          status: response.statusCode ?? 0,
          headers: {
            get(name) {
              const value = response.headers[name.toLocaleLowerCase()];
              return Array.isArray(value) ? value.join(", ") : (value ?? null);
            },
          },
          body: { getReader: () => body.getReader() },
        });
      },
    );
    operation.once("error", reject);
    operation.end();
  });
}

async function defaultLookup(hostname: string): Promise<readonly CanvasPreviewDnsAddress[]> {
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  return addresses
    .filter(
      (entry): entry is { address: string; family: 4 | 6 } =>
        entry.family === 4 || entry.family === 6,
    )
    .map(({ address, family }) => ({ address, family }));
}

async function validateNetworkUrl(
  raw: string,
  originalUrl: string,
  lookup: CanvasPreviewDnsLookup,
  signal: AbortSignal,
): Promise<NetworkValidation> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      ok: false,
      preview: urlFailure(originalUrl || raw, "blocked", "unsupported-url", "URL is invalid."),
    };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      preview: urlFailure(
        originalUrl || url.toString(),
        "blocked",
        "unsupported-url",
        "URL preview supports HTTP and HTTPS only.",
      ),
    };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      preview: urlFailure(
        originalUrl || url.toString(),
        "blocked",
        "credentialed-url",
        "Credential-bearing URLs cannot be previewed.",
      ),
    };
  }

  const hostname = stripIpv6Brackets(url.hostname).replace(/\.$/, "").toLocaleLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return {
      ok: false,
      preview: urlFailure(
        originalUrl || url.toString(),
        "blocked",
        "private-address",
        "Local and private network URLs cannot be previewed.",
        url.toString(),
      ),
    };
  }

  const literalFamily = isIP(hostname);
  if (literalFamily > 0) {
    if (!isPublicNetworkAddress(hostname)) {
      return {
        ok: false,
        preview: urlFailure(
          originalUrl || url.toString(),
          "blocked",
          "private-address",
          "Local, private, reserved, and documentation network addresses cannot be previewed.",
          url.toString(),
        ),
      };
    }
    return {
      ok: true,
      url,
      addresses: [{ address: hostname, family: literalFamily as 4 | 6 }],
    };
  }

  let addresses: readonly CanvasPreviewDnsAddress[];
  try {
    addresses = await raceWithAbort(lookup(hostname), signal);
  } catch (error) {
    if (error instanceof PreviewTimeoutError) throw error;
    return {
      ok: false,
      preview: urlFailure(
        originalUrl || url.toString(),
        "offline",
        "dns-failed",
        "URL preview could not resolve the remote host.",
        url.toString(),
      ),
    };
  }
  if (addresses.length === 0) {
    return {
      ok: false,
      preview: urlFailure(
        originalUrl || url.toString(),
        "offline",
        "dns-failed",
        "URL preview could not resolve the remote host.",
        url.toString(),
      ),
    };
  }
  if (addresses.some(({ address }) => !isPublicNetworkAddress(address))) {
    return {
      ok: false,
      preview: urlFailure(
        originalUrl || url.toString(),
        "blocked",
        "private-address",
        "Remote host resolves to a local, private, reserved, or documentation address.",
        url.toString(),
      ),
    };
  }
  return { ok: true, url, addresses };
}

/** True only for globally routable addresses accepted by the URL-preview boundary. */
export function isPublicNetworkAddress(rawAddress: string): boolean {
  const address = stripIpv6Brackets(rawAddress.split("%")[0] ?? "").toLocaleLowerCase();
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const bytes = parseIpv6(address);
  if (!bytes) return false;

  const isMapped =
    bytes.slice(0, 10).every((value) => value === 0) && bytes[10] === 255 && bytes[11] === 255;
  if (isMapped) return isPublicIpv4(Array.from(bytes.slice(12)).join("."));

  // Permit ordinary global unicast (2000::/3), then remove special-purpose
  // transition/documentation ranges that also sit inside that prefix.
  if ((bytes[0]! & 0xe0) !== 0x20) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01) {
    if (bytes[2] === 0x0d && bytes[3] === 0xb8) return false; // documentation
    if (bytes[2] === 0x00 && (bytes[3]! & 0xf0) === 0x10) return false; // ORCHID
    if (bytes[2] === 0x00 && (bytes[3]! & 0xf0) === 0x20) return false; // ORCHIDv2
    if (bytes[2] === 0x00 && bytes[3] === 0x00) return false; // Teredo
  }
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false; // 6to4 transition
  if (bytes[0] === 0x3f && bytes[1] === 0xfe) return false; // former 6bone
  return true;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }
  const [a, b, c] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function parseIpv6(address: string): Uint8Array | undefined {
  let input = address;
  let ipv4Tail: number[] | undefined;
  const lastColon = input.lastIndexOf(":");
  const possibleIpv4 = input.slice(lastColon + 1);
  if (possibleIpv4.includes(".")) {
    const octets = possibleIpv4.split(".").map(Number);
    if (
      octets.length !== 4 ||
      octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
    ) {
      return undefined;
    }
    ipv4Tail = octets;
    input = `${input.slice(0, lastColon)}:${((octets[0]! << 8) | octets[1]!).toString(16)}:${(
      (octets[2]! << 8) |
      octets[3]!
    ).toString(16)}`;
  }

  const halves = input.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return undefined;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8) return undefined;
  const bytes = new Uint8Array(16);
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index] ?? "";
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return undefined;
    const value = Number.parseInt(group, 16);
    bytes[index * 2] = value >> 8;
    bytes[index * 2 + 1] = value & 255;
  }
  void ipv4Tail;
  return bytes;
}

function stripIpv6Brackets(value: string): string {
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

async function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new PreviewTimeoutError();
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(new PreviewTimeoutError());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function cancelBody(response: CanvasPreviewFetchResponse): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.getReader().cancel();
  } catch {
    // Cancellation is a best-effort resource cleanup; the response is discarded.
  }
}

async function readBoundedBody(
  response: CanvasPreviewFetchResponse,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{ chunks: Uint8Array[]; tooLarge: boolean }> {
  if (!response.body) return { chunks: [], tooLarge: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    let readResult: { done: boolean; value?: Uint8Array };
    try {
      readResult = await raceWithAbort(reader.read(), signal);
    } catch (error) {
      try {
        await reader.cancel(error);
      } catch {
        // The timeout/error is authoritative; cancellation is best effort.
      }
      throw error;
    }
    const { done, value } = readResult;
    if (done) return { chunks, tooLarge: false };
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { chunks: [], tooLarge: true };
    }
    chunks.push(value);
  }
}

function extractMetadata(html: string): CanvasUrlMetadata {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const attributes = parseHtmlAttributes(tag);
    const key = (attributes.get("property") ?? attributes.get("name"))?.toLocaleLowerCase();
    const content = attributes.get("content");
    if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
  }
  const titleMatch = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  const title = sanitizeMetadataText(
    meta.get("og:title") ?? meta.get("twitter:title") ?? titleMatch,
    200,
  );
  const description = sanitizeMetadataText(
    meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"),
    500,
  );
  const imageUrl = sanitizeMetadataText(
    meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image"),
    2_048,
  );
  return { title, description, imageUrl };
}

function parseHtmlAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    const name = match[1]?.toLocaleLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined && !attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

function sanitizeMetadataText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const decoded = decodeHtmlEntities(value);
  const withoutMarkup = decoded.replace(/<[^>]*>/g, " ");
  const compact = compactText(withoutMarkup, maxLength);
  return compact || undefined;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (match, entity: string) => {
      const normalized = entity.toLocaleLowerCase();
      if (normalized.startsWith("#x")) {
        return safeCodePoint(Number.parseInt(normalized.slice(2), 16), match);
      }
      if (normalized.startsWith("#")) {
        return safeCodePoint(Number.parseInt(normalized.slice(1), 10), match);
      }
      return (
        {
          amp: "&",
          lt: "<",
          gt: ">",
          quot: '"',
          apos: "'",
          nbsp: " ",
        }[normalized] ?? match
      );
    },
  );
}

function safeCodePoint(value: number, fallback: string): string {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  ) {
    return fallback;
  }
  return String.fromCodePoint(value);
}

function safeResolveUrl(value: string, base: URL): URL | undefined {
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function removeUndefined(value: object): void {
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key];
  }
}

function normalizeUrlForResult(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return value;
  }
}

function urlFailure(
  url: string,
  state: Exclude<CanvasContentPreviewState, "ready" | "missing">,
  code: CanvasContentPreviewCode,
  message: string,
  finalUrl?: string,
): CanvasUrlPreview {
  return { kind: "url", state, url, finalUrl, code, message };
}
