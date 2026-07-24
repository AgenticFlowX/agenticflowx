/**
 * Host-only Canvas rich-content preview contract and SSRF boundary.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-20] [FR-35] [FR-36] [FR-37] [NFR-9] [NFR-13]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-HOST] [DES-SEC] [DES-TEST]
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import type { WorkbenchSourceIdentity } from "@afx/shared";

import {
  type CanvasPreviewDnsLookup,
  type CanvasPreviewFetch,
  type CanvasPreviewFetchResponse,
  createCanvasContentPreviewService,
  serializeCanvasSourcePreview,
  serializeCanvasUrlPreview,
} from "./canvas-content-preview-service";

const ROOT_URI = "file:///workspace/project";

function source(relativePath: string): WorkbenchSourceIdentity {
  return { rootUri: ROOT_URI, rootName: "project", relativePath };
}

function uriFor(value: WorkbenchSourceIdentity): vscode.Uri {
  return vscode.Uri.file(`/workspace/project/${value.relativePath}`);
}

function fetchResponse(
  status: number,
  body = "",
  headers: Record<string, string> = {},
  chunkSize = Number.POSITIVE_INFINITY,
): CanvasPreviewFetchResponse & { cancel: ReturnType<typeof vi.fn> } {
  const encoded = Buffer.from(body);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < encoded.length; offset += chunkSize) {
    chunks.push(encoded.subarray(offset, Math.min(encoded.length, offset + chunkSize)));
  }
  let index = 0;
  const cancel = vi.fn(async () => {});
  const normalized = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLocaleLowerCase(), value]),
  );
  return {
    status,
    headers: { get: (name) => normalized.get(name.toLocaleLowerCase()) ?? null },
    body: {
      getReader: () => ({
        read: async () => {
          const value = chunks[index++];
          return value ? { done: false, value } : { done: true };
        },
        cancel,
      }),
    },
    cancel,
  };
}

function localHarness(options: {
  snapshot?: {
    content: string;
    dirty?: boolean;
    diskRevision?: string;
    documentVersion?: number;
  };
  bytes?: Uint8Array;
  size?: number;
  resolve?: boolean;
  maxImageBytes?: number;
  maxLocalBytes?: number;
  maxTextChars?: number;
}) {
  const resolve = vi.fn((value: WorkbenchSourceIdentity) =>
    options.resolve === false ? undefined : uriFor(value),
  );
  const readText = vi.fn(async (uri: vscode.Uri) => {
    if (!options.snapshot) return null;
    return {
      uri,
      content: options.snapshot.content,
      revision: "content-revision",
      dirty: options.snapshot.dirty ?? false,
      kind: "docs" as const,
      source: source(uri.path.split("/workspace/project/")[1] ?? ""),
      sourceRevision: {
        contentRevision: "content-revision",
        diskRevision: options.snapshot.diskRevision ?? "disk-revision",
        documentVersion: options.snapshot.documentVersion,
        dirty: options.snapshot.dirty ?? false,
      },
    };
  });
  const readFile = vi.fn(async () => options.bytes ?? Buffer.from("plain file"));
  const stat = vi.fn(async () => ({
    type: vscode.FileType.File,
    ctime: 0,
    mtime: 10,
    size: options.size ?? options.bytes?.byteLength ?? Buffer.byteLength("plain file"),
  }));
  return {
    resolve,
    readText,
    readFile,
    stat,
    service: createCanvasContentPreviewService({
      fileState: { resolve, readText },
      readFile,
      stat,
      getOpenTextDocuments: () => [],
      maxImageBytes: options.maxImageBytes,
      maxLocalBytes: options.maxLocalBytes,
      maxTextChars: options.maxTextChars,
    }),
  };
}

function networkHarness(options: {
  response?: CanvasPreviewFetchResponse;
  fetch?: ReturnType<typeof vi.fn>;
  lookup?: ReturnType<typeof vi.fn>;
  maxRemoteBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
}) {
  const fetch =
    options.fetch ??
    vi.fn(async () =>
      fetchResponse(
        200,
        "<html><head><title>Architecture map</title></head><body>ignored</body></html>",
        { "content-type": "text/html; charset=utf-8" },
      ),
    );
  const lookup =
    options.lookup ?? vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
  return {
    fetch,
    lookup,
    service: createCanvasContentPreviewService({
      fileState: { resolve: () => undefined, readText: async () => null },
      fetch: fetch as CanvasPreviewFetch,
      lookup: lookup as CanvasPreviewDnsLookup,
      maxRemoteBytes: options.maxRemoteBytes,
      maxRedirects: options.maxRedirects,
      timeoutMs: options.timeoutMs,
    }),
  };
}

describe("Canvas local rich-content previews", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses canonical afxSource identity and a dirty live Markdown revision", async () => {
    const target = source("docs/specs/demo/spec.md");
    const harness = localHarness({
      snapshot: {
        content: "# Unsaved architecture\n",
        dirty: true,
        diskRevision: "disk-base",
        documentVersion: 7,
      },
    });

    const result = await harness.service.previewSource(target);

    expect({ result, resolvedWith: harness.resolve.mock.calls[0]?.[0] }).toMatchObject({
      resolvedWith: target,
      result: {
        state: "ready",
        kind: "markdown",
        content: "# Unsaved architecture\n",
        revision: {
          contentRevision: "content-revision",
          diskRevision: "disk-base",
          documentVersion: 7,
          dirty: true,
        },
      },
    });
  });

  it("classifies .markdown as Markdown", async () => {
    const harness = localHarness({ snapshot: { content: "# Long extension" } });

    await expect(
      harness.service.previewSource(source("docs/guide.markdown")),
    ).resolves.toMatchObject({ state: "ready", kind: "markdown", content: "# Long extension" });
  });

  it("returns a bounded textual excerpt for a general workspace file", async () => {
    const harness = localHarness({
      bytes: Buffer.from("export const architecture = true;"),
      maxTextChars: 12,
    });

    await expect(
      harness.service.previewSource(source("src/architecture.ts")),
    ).resolves.toMatchObject({
      state: "ready",
      kind: "file",
      excerpt: "export const",
      truncated: true,
    });
  });

  it("prefers a dirty open buffer for a general workspace file", async () => {
    const target = source("src/architecture.ts");
    const uri = uriFor(target);
    const service = createCanvasContentPreviewService({
      fileState: { resolve: () => uri, readText: async () => null },
      readFile: async () => Buffer.from("saved source"),
      getOpenTextDocuments: () => [
        {
          uri,
          version: 9,
          isDirty: true,
          getText: () => "unsaved source",
        } as vscode.TextDocument,
      ],
    });

    await expect(service.previewSource(target)).resolves.toMatchObject({
      state: "ready",
      kind: "file",
      excerpt: "unsaved source",
      revision: { documentVersion: 9, dirty: true },
    });
  });

  it("does not decode binary general files into unsafe text", async () => {
    const harness = localHarness({ bytes: Uint8Array.from([0, 1, 2, 3]) });

    await expect(harness.service.previewSource(source("assets/data.bin"))).resolves.toMatchObject({
      state: "ready",
      kind: "file",
      mediaType: "application/octet-stream",
      excerpt: undefined,
    });
  });

  it("blocks a source whose canonical root cannot be resolved", async () => {
    const harness = localHarness({ resolve: false });

    await expect(harness.service.previewSource(source("docs/spec.md"))).resolves.toMatchObject({
      state: "blocked",
      code: "outside-workspace",
    });
  });

  it("returns a precise missing state", async () => {
    const harness = localHarness({});
    harness.stat.mockRejectedValueOnce(new Error("ENOENT"));

    await expect(harness.service.previewSource(source("docs/missing.txt"))).resolves.toMatchObject({
      state: "missing",
      code: "not-found",
    });
  });

  it("distinguishes an existing file read failure from a missing file", async () => {
    const harness = localHarness({});
    harness.readFile.mockRejectedValueOnce(new Error("EACCES"));

    await expect(harness.service.previewSource(source("src/protected.ts"))).resolves.toMatchObject({
      state: "error",
      code: "read-failed",
    });
  });

  it("blocks an oversized Markdown source before reading its bytes", async () => {
    const harness = localHarness({ size: 11, maxLocalBytes: 10 });

    const result = await harness.service.previewSource(source("README.md"));

    expect({ result, reads: harness.readFile.mock.calls.length }).toMatchObject({
      result: { state: "blocked", kind: "markdown", code: "file-too-large", byteLength: 11 },
      reads: 0,
    });
  });

  it("reports a Markdown read failure after a successful stat", async () => {
    const harness = localHarness({});
    harness.readFile.mockRejectedValueOnce(new Error("EACCES"));

    await expect(harness.service.previewSource(source("README.md"))).resolves.toMatchObject({
      state: "error",
      kind: "markdown",
      code: "read-failed",
    });
  });

  it("builds a compact Notes summary without duplicating the document", async () => {
    const harness = localHarness({
      snapshot: {
        content:
          "# Notes\n\n## 2026-07-19\n\n### 09:00:00.000\nNewest idea\n\n### 08:00:00.000\nOlder idea\n",
      },
    });

    await expect(harness.service.previewSource(source(".afx/notes.md"))).resolves.toMatchObject({
      state: "ready",
      kind: "notes",
      summary: { totalNotes: 2, items: [{ text: "Newest idea" }, { text: "Older idea" }] },
    });
  });

  it("reports malformed Notes rather than returning partial content", async () => {
    const harness = localHarness({ snapshot: { content: "---\ntitle: Broken\n# Notes\n" } });

    await expect(harness.service.previewSource(source(".afx/notes.md"))).resolves.toMatchObject({
      state: "error",
      kind: "notes",
      code: "invalid-notes",
    });
  });

  it("builds a compact Board summary", async () => {
    const harness = localHarness({
      snapshot: {
        content: "# Board\n\n## Todo\n\n- Map API\n- Verify auth\n\n## Done\n\n- Define scope\n",
      },
    });

    await expect(
      harness.service.previewSource(source(".afx/kanban/roadmap.md")),
    ).resolves.toMatchObject({
      state: "ready",
      kind: "board",
      summary: {
        totalColumns: 2,
        totalCards: 3,
        columns: [
          { title: "Todo", cardCount: 2 },
          { title: "Done", cardCount: 1 },
        ],
      },
    });
  });

  it("reports ambiguous Board metadata rather than returning a misleading summary", async () => {
    const harness = localHarness({
      snapshot: {
        content:
          '# Board\n\n## Todo\n\n- Map API\n  <!-- afx:card {"v":1} -->\n  <!-- afx:card {"v":1} -->\n',
      },
    });

    await expect(
      harness.service.previewSource(source(".afx/kanban/roadmap.md")),
    ).resolves.toMatchObject({ state: "error", kind: "board", code: "invalid-board" });
  });

  it("validates a PNG signature and reports MIME, size, and clean revision", async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const harness = localHarness({ bytes: png });

    await expect(harness.service.previewSource(source("assets/map.png"))).resolves.toMatchObject({
      state: "ready",
      kind: "image",
      mediaType: "image/png",
      byteLength: png.byteLength,
      revision: { contentRevision: expect.any(String), dirty: false },
    });
  });

  it("serializes a validated image without exposing its host URI", async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const result = await localHarness({ bytes: png }).service.previewSource(
      source("assets/map.png"),
    );

    const serialized = serializeCanvasSourcePreview(
      result,
      (uri) => `vscode-webview://canvas${uri.path}`,
    );

    expect(serialized).toEqual({
      owner: source("assets/map.png"),
      revision: result.revision,
      preview: {
        kind: "image",
        state: "ready",
        mediaType: "image/png",
        byteLength: png.byteLength,
        resourceUri: "vscode-webview://canvas/workspace/project/assets/map.png",
      },
    });
    expect(JSON.stringify(serialized)).not.toContain('"uri"');
  });

  it("blocks oversized images before reading their bytes", async () => {
    const harness = localHarness({ size: 11, maxImageBytes: 10 });

    const result = await harness.service.previewSource(source("assets/map.png"));

    expect({ result, reads: harness.readFile.mock.calls.length }).toMatchObject({
      result: { state: "blocked", code: "image-too-large", byteLength: 11 },
      reads: 0,
    });
  });

  it("blocks image extensions whose bytes do not match the claimed MIME", async () => {
    const harness = localHarness({ bytes: Buffer.from("<script>alert(1)</script>") });

    await expect(harness.service.previewSource(source("assets/map.png"))).resolves.toMatchObject({
      state: "blocked",
      code: "invalid-image",
    });
  });

  it("distinguishes an existing image read failure from a missing image", async () => {
    const harness = localHarness({ size: 8 });
    harness.readFile.mockRejectedValueOnce(new Error("EACCES"));

    await expect(
      harness.service.previewSource(source("assets/protected.png")),
    ).resolves.toMatchObject({
      state: "error",
      code: "read-failed",
    });
  });

  it("blocks SVG instead of returning potentially executable markup", async () => {
    const harness = localHarness({ bytes: Buffer.from('<svg onload="alert(1)"></svg>') });

    await expect(harness.service.previewSource(source("assets/map.svg"))).resolves.toMatchObject({
      state: "blocked",
      code: "unsafe-image-type",
    });
  });
});

describe("Canvas URL metadata security", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not resolve or fetch until allowNetwork is explicit", async () => {
    const harness = networkHarness({});

    const result = await harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: false,
    });

    expect({
      result,
      lookups: harness.lookup.mock.calls.length,
      fetches: harness.fetch.mock.calls.length,
    }).toEqual({
      result: expect.objectContaining({ state: "blocked", code: "network-disabled" }),
      lookups: 0,
      fetches: 0,
    });
  });

  it.each(["ftp://example.com", "file:///etc/passwd", "javascript:alert(1)"])(
    "blocks unsupported URL scheme %s",
    async (url) => {
      const harness = networkHarness({});

      await expect(harness.service.previewUrl({ url, allowNetwork: true })).resolves.toMatchObject({
        state: "blocked",
        code: "unsupported-url",
      });
    },
  );

  it("blocks credential-bearing URLs", async () => {
    const harness = networkHarness({});

    await expect(
      harness.service.previewUrl({ url: "https://user:secret@example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "blocked", code: "credentialed-url" });
  });

  it.each([
    "http://localhost",
    "http://localhost.",
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://100.64.0.1",
    "http://169.254.1.1",
    "http://172.16.0.1",
    "http://192.168.0.1",
    "http://192.0.2.1",
    "http://198.18.0.1",
    "http://198.51.100.1",
    "http://203.0.113.1",
    "http://224.0.0.1",
    "http://240.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://[::]",
    "http://[::1]",
    "http://[fc00::1]",
    "http://[fe80::1]",
    "http://[ff02::1]",
    "http://[2001::1]",
    "http://[2001:db8::1]",
    "http://[2002:c000:0204::1]",
    "http://[3ffe::1]",
    "http://[::ffff:127.0.0.1]",
  ])("blocks local, private, documentation, multicast, or reserved target %s", async (url) => {
    const harness = networkHarness({});

    const result = await harness.service.previewUrl({ url, allowNetwork: true });

    expect({ result, fetches: harness.fetch.mock.calls.length }).toMatchObject({
      result: { state: "blocked", code: "private-address" },
      fetches: 0,
    });
  });

  it.each(["http://8.8.8.8/", "https://[2606:4700:4700::1111]/"])(
    "allows public literal target %s without a redundant DNS lookup",
    async (url) => {
      const harness = networkHarness({});

      const result = await harness.service.previewUrl({ url, allowNetwork: true });

      expect({ result, lookups: harness.lookup.mock.calls.length }).toMatchObject({
        result: { state: "ready", finalUrl: url },
        lookups: 0,
      });
    },
  );

  it("blocks a public hostname when DNS returns a private address", async () => {
    const harness = networkHarness({
      lookup: vi.fn(async () => [{ address: "10.0.0.8", family: 4 as const }]),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "blocked", code: "private-address" });
  });

  it("blocks mixed public/private DNS answers", async () => {
    const harness = networkHarness({
      lookup: vi.fn(async () => [
        { address: "93.184.216.34", family: 4 as const },
        { address: "192.168.1.2", family: 4 as const },
      ]),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "blocked", code: "private-address" });
  });

  it("pins the fetch to the public addresses that passed DNS validation", async () => {
    const fetch = vi.fn(async () =>
      fetchResponse(200, "<title>Pinned</title>", { "content-type": "text/html" }),
    );
    const harness = networkHarness({
      lookup: vi.fn(async () => [
        { address: "93.184.216.34", family: 4 as const },
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 as const },
      ]),
      fetch,
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "ready" });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        addresses: [
          { address: "93.184.216.34", family: 4 },
          { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        ],
      }),
    );
  });

  it("returns offline when DNS resolution fails", async () => {
    const harness = networkHarness({
      lookup: vi.fn(async () => Promise.reject(new Error("ENOTFOUND"))),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "offline", code: "dns-failed" });
  });

  it("returns offline when DNS has no usable answers", async () => {
    const harness = networkHarness({ lookup: vi.fn(async () => []) });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "offline", code: "dns-failed" });
  });

  it("extracts and sanitizes bounded metadata without returning remote HTML", async () => {
    const html = `<html><head>
      <meta property="og:title" content="&lt;b&gt;Architecture &amp; roadmap&#x202e;cod&lt;/b&gt;">
      <meta name="description" content="  Plan\u0000 the   next release  ">
      <meta property="og:image" content="/cover.png">
      <script>globalThis.pwned = true</script>
      </head><body>secret body</body></html>`;
    const harness = networkHarness({
      fetch: vi.fn(async () =>
        fetchResponse(200, html, { "content-type": "text/html; charset=utf-8" }),
      ),
    });

    const result = await harness.service.previewUrl({
      url: "https://example.com/start",
      allowNetwork: true,
    });

    expect(result).toEqual({
      kind: "url",
      state: "ready",
      url: "https://example.com/start",
      finalUrl: "https://example.com/start",
      metadata: {
        title: "Architecture & roadmap cod",
        description: "Plan the next release",
        imageUrl: "https://example.com/cover.png",
      },
    });
    expect(serializeCanvasUrlPreview(result)).toEqual({
      state: "ready",
      finalUrl: "https://example.com/start",
      metadata: {
        title: "Architecture & roadmap cod",
        description: "Plan the next release",
        imageUrl: "https://example.com/cover.png",
      },
    });
  });

  it("omits an image metadata URL that resolves to a private host", async () => {
    const lookup = vi.fn(async (hostname: string) =>
      hostname === "images.example.com"
        ? [{ address: "10.0.0.9", family: 4 as const }]
        : [{ address: "93.184.216.34", family: 4 as const }],
    );
    const harness = networkHarness({
      lookup,
      fetch: vi.fn(async () =>
        fetchResponse(
          200,
          '<meta property="og:title" content="Safe"><meta property="og:image" content="https://images.example.com/private.png">',
          { "content-type": "text/html" },
        ),
      ),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toEqual({
      kind: "url",
      state: "ready",
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      metadata: { title: "Safe" },
    });
  });

  it("revalidates every redirect and blocks a private destination before fetching it", async () => {
    const fetch = vi.fn(async () => fetchResponse(302, "", { location: "http://127.0.0.1/admin" }));
    const harness = networkHarness({ fetch });

    const result = await harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: true,
    });

    expect({ result, fetches: fetch.mock.calls.length }).toMatchObject({
      result: { state: "blocked", code: "private-address" },
      fetches: 1,
    });
  });

  it("follows bounded public relative redirects", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(fetchResponse(302, "", { location: "/final" }))
      .mockResolvedValueOnce(
        fetchResponse(200, "<title>Final map</title>", { "content-type": "text/html" }),
      );
    const harness = networkHarness({ fetch });

    await expect(
      harness.service.previewUrl({ url: "https://example.com/start", allowNetwork: true }),
    ).resolves.toMatchObject({
      state: "ready",
      finalUrl: "https://example.com/final",
      metadata: { title: "Final map" },
    });
  });

  it("reports a redirect without a Location header", async () => {
    const harness = networkHarness({ fetch: vi.fn(async () => fetchResponse(302)) });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "error", code: "redirect-without-location" });
  });

  it("reports an invalid redirect destination precisely", async () => {
    const harness = networkHarness({
      fetch: vi.fn(async () => fetchResponse(302, "", { location: "http://[invalid" })),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "blocked", code: "unsupported-url" });
  });

  it("detects a redirect loop before requesting the same URL twice", async () => {
    const fetch = vi.fn(async () => fetchResponse(302, "", { location: "/" }));
    const harness = networkHarness({ fetch });

    const result = await harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: true,
    });

    expect({ result, fetches: fetch.mock.calls.length }).toMatchObject({
      result: { state: "error", code: "redirect-loop" },
      fetches: 1,
    });
  });

  it("errors after the redirect bound", async () => {
    const harness = networkHarness({
      maxRedirects: 1,
      fetch: vi.fn(async () => fetchResponse(302, "", { location: "/again" })),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "error", code: "too-many-redirects" });
  });

  it("blocks a response whose declared length exceeds the byte bound", async () => {
    const response = fetchResponse(200, "not read", {
      "content-type": "text/html",
      "content-length": "101",
    });
    const harness = networkHarness({ maxRemoteBytes: 100, fetch: vi.fn(async () => response) });

    const result = await harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: true,
    });

    expect({ result, cancelled: response.cancel.mock.calls.length }).toMatchObject({
      result: { state: "blocked", code: "response-too-large" },
      cancelled: 1,
    });
  });

  it("cancels a streamed response as soon as it crosses the byte bound", async () => {
    const response = fetchResponse(200, "123456789", { "content-type": "text/html" }, 3);
    const harness = networkHarness({ maxRemoteBytes: 5, fetch: vi.fn(async () => response) });

    const result = await harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: true,
    });

    expect({ result, cancelled: response.cancel.mock.calls.length }).toMatchObject({
      result: { state: "blocked", code: "response-too-large" },
      cancelled: 1,
    });
  });

  it("returns offline on a bounded timeout", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      async (_url: string, init: { signal: AbortSignal }) =>
        await new Promise<CanvasPreviewFetchResponse>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        }),
    );
    const harness = networkHarness({ fetch, timeoutMs: 25 });

    const resultPromise = harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: true,
    });
    await vi.advanceTimersByTimeAsync(26);

    await expect(resultPromise).resolves.toMatchObject({ state: "offline", code: "timeout" });
  });

  it("applies the timeout while DNS resolution stalls", async () => {
    vi.useFakeTimers();
    const harness = networkHarness({
      lookup: vi.fn(async () => await new Promise(() => {})),
      timeoutMs: 25,
    });
    const resultPromise = harness.service.previewUrl({
      url: "https://example.com",
      allowNetwork: true,
    });

    await vi.advanceTimersByTimeAsync(26);

    await expect(resultPromise).resolves.toMatchObject({ state: "offline", code: "timeout" });
  });

  it("applies the timeout while a response body stalls", async () => {
    vi.useFakeTimers();
    const response: CanvasPreviewFetchResponse = {
      status: 200,
      headers: {
        get: (name) => (name.toLocaleLowerCase() === "content-type" ? "text/html" : null),
      },
      body: {
        getReader: () => ({
          read: async () => await new Promise(() => {}),
          cancel: vi.fn(),
        }),
      },
    };
    const harness = networkHarness({ fetch: vi.fn(async () => response), timeoutMs: 25 });
    let observed: Awaited<ReturnType<typeof harness.service.previewUrl>> | undefined;
    void harness.service
      .previewUrl({ url: "https://example.com", allowNetwork: true })
      .then((value) => (observed = value));

    await vi.advanceTimersByTimeAsync(26);
    await Promise.resolve();

    expect(observed).toMatchObject({ state: "offline", code: "timeout" });
  });

  it("returns offline on a network transport failure", async () => {
    const harness = networkHarness({
      fetch: vi.fn(async () => Promise.reject(new Error("ECONNRESET"))),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "offline", code: "network-error" });
  });

  it("returns an HTTP error without parsing the response body", async () => {
    const response = fetchResponse(503, "<title>Do not parse</title>", {
      "content-type": "text/html",
    });
    const harness = networkHarness({ fetch: vi.fn(async () => response) });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "error", code: "http-status", httpStatus: 503 });
  });

  it("blocks non-HTML remote content", async () => {
    const harness = networkHarness({
      fetch: vi.fn(async () =>
        fetchResponse(200, '{"secret":true}', { "content-type": "application/json" }),
      ),
    });

    await expect(
      harness.service.previewUrl({ url: "https://example.com", allowNetwork: true }),
    ).resolves.toMatchObject({ state: "blocked", code: "unsupported-content-type" });
  });
});
