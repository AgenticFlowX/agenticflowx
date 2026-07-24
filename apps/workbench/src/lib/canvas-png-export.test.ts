/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42] [NFR-9] [NFR-11]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CANVAS_PNG_PLATFORM_BOUNDARY,
  CanvasPngExportError,
  rasterizeCanvasExportSvg,
} from "./canvas-png-export";

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const SAFE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100" role="img"><rect x="0" y="0" width="200" height="100" fill="#fff"/></svg>\n';

describe("rasterizeCanvasExportSvg", () => {
  const drawImage = vi.fn();
  const close = vi.fn();
  const createImageBitmap = vi.fn(async (_source: Blob) => ({ width: 200, height: 100, close }));
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob: vi.fn((callback: BlobCallback) => {
      callback(new Blob([PNG_BYTES], { type: "image/png" }));
    }),
  };
  let createElement: typeof document.createElement;

  beforeEach(() => {
    createElement = document.createElement.bind(document);
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: createImageBitmap,
    });
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) =>
      tagName === "canvas" ? canvas : createElement(tagName)) as typeof document.createElement);
    drawImage.mockClear();
    close.mockClear();
    createImageBitmap.mockClear();
    canvas.width = 0;
    canvas.height = 0;
    canvas.getContext.mockClear();
    canvas.toBlob.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "createImageBitmap");
  });

  it("returns exact base64 PNG bytes without UTF-8 conversion", async () => {
    const result = await rasterizeCanvasExportSvg(SAFE_SVG);

    expect(result).toEqual({
      content: "iVBORw0KGgoBAgM=",
      encoding: "base64",
      width: 200,
      height: 100,
      byteLength: PNG_BYTES.byteLength,
    });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("downscales oversized SVG geometry before Chromium decodes it", async () => {
    const large = SAFE_SVG.replace('width="200" height="100"', 'width="100000" height="50000"');

    const result = await rasterizeCanvasExportSvg(large, {
      maxDimension: 1_024,
      maxPixels: 524_288,
    });

    expect(result).toMatchObject({ width: 1_024, height: 512 });
    expect(canvas).toMatchObject({ width: 1_024, height: 512 });
    const source = createImageBitmap.mock.calls[0]?.[0];
    expect(source).toBeInstanceOf(Blob);
    await expect(blobText(source)).resolves.toContain('width="1024" height="512"');
  });

  it("rejects active or externally dereferenced SVG before bitmap decoding", async () => {
    const unsafe = SAFE_SVG.replace(
      "</svg>",
      '<image href="https://example.com/tracker.png"/></svg>',
    );

    await expect(rasterizeCanvasExportSvg(unsafe)).rejects.toBeInstanceOf(CanvasPngExportError);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("rejects PNG bytes above the exact output limit and releases the bitmap", async () => {
    await expect(
      rasterizeCanvasExportSvg(SAFE_SVG, { maxOutputBytes: PNG_BYTES.byteLength - 1 }),
    ).rejects.toThrow(/11 bytes/);
    expect(close).toHaveBeenCalledOnce();
  });

  it("states the cross-platform byte-determinism boundary", () => {
    expect(CANVAS_PNG_PLATFORM_BOUNDARY).toMatch(/Chromium|platform/i);
  });
});

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Blob read failed."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Blob read returned non-text content."));
    };
    reader.readAsText(blob);
  });
}
