/**
 * Bounded Chromium rasterization for the already-sanitized deterministic SVG
 * Canvas projection. No HTML parsing, object URLs, file reads, or network
 * dereferences cross this boundary.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42] [NFR-9] [NFR-11]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EXPORT]
 */

const DEFAULT_MAX_DIMENSION = 8_192;
const DEFAULT_MAX_PIXELS = 16 * 1024 * 1024;
const DEFAULT_MAX_SVG_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const SVG_ROOT =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="([-+.0-9eE]+)" height="([-+.0-9eE]+)" viewBox="[-+.0-9eE ]+" role="img"(?: aria-labelledby="[a-zA-Z0-9_-]+")?>/;
const UNSAFE_SVG_CONTENT =
  /<(?:script|foreignObject|image|use|style|iframe|object|embed)\b|(?:href|xlink:href)\s*=|url\s*\(|@import|<!DOCTYPE|<!ENTITY/i;

/**
 * The SVG projection and output dimensions are deterministic. Chromium/Skia
 * font rasterization, antialiasing, compression, and therefore PNG bytes can
 * vary between browser and operating-system versions.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-11]
 */
export const CANVAS_PNG_PLATFORM_BOUNDARY =
  "PNG pixels can vary across Chromium and platform versions, as can compressed bytes; the safe SVG geometry and bounded output dimensions remain deterministic.";

/**
 * Optional lower safety ceilings for constrained webviews and tests.
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-9]
 */
export interface CanvasPngRasterizeOptions {
  maxDimension?: number;
  maxPixels?: number;
  maxSvgBytes?: number;
  maxOutputBytes?: number;
}

/**
 * Explicitly encoded PNG result safe for the typed host bridge.
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EXPORT] [DES-API]
 */
export interface CanvasPngRasterization {
  content: string;
  encoding: "base64";
  width: number;
  height: number;
  byteLength: number;
}

/**
 * Stable rasterization failure for accessible UI reporting.
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EXPORT]
 */
export class CanvasPngExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasPngExportError";
  }
}

/**
 * Rasterize one safe SVG projection and return an explicitly base64-encoded
 * PNG payload. Oversized geometry is proportionally reduced before decode.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42] [NFR-9] [NFR-11]
 */
export async function rasterizeCanvasExportSvg(
  svg: string,
  options: CanvasPngRasterizeOptions = {},
): Promise<CanvasPngRasterization> {
  const limits = {
    maxDimension: boundedLimit(
      options.maxDimension,
      DEFAULT_MAX_DIMENSION,
      DEFAULT_MAX_DIMENSION,
      "PNG maximum dimension",
    ),
    maxPixels: boundedLimit(
      options.maxPixels,
      DEFAULT_MAX_PIXELS,
      DEFAULT_MAX_PIXELS,
      "PNG maximum pixels",
    ),
    maxSvgBytes: boundedLimit(
      options.maxSvgBytes,
      DEFAULT_MAX_SVG_BYTES,
      DEFAULT_MAX_SVG_BYTES,
      "PNG source SVG bytes",
    ),
    maxOutputBytes: boundedLimit(
      options.maxOutputBytes,
      DEFAULT_MAX_OUTPUT_BYTES,
      DEFAULT_MAX_OUTPUT_BYTES,
      "PNG output bytes",
    ),
  };
  if (typeof svg !== "string" || !svg.endsWith("</svg>\n")) {
    throw new CanvasPngExportError("PNG export requires the safe Canvas SVG projection.");
  }
  const sourceBytes = new TextEncoder().encode(svg).byteLength;
  if (sourceBytes === 0 || sourceBytes > limits.maxSvgBytes) {
    throw new CanvasPngExportError(
      `PNG source SVG is ${sourceBytes} bytes; the limit is ${limits.maxSvgBytes} bytes.`,
    );
  }
  if (UNSAFE_SVG_CONTENT.test(svg)) {
    throw new CanvasPngExportError(
      "PNG export rejected SVG content that could dereference active or external resources.",
    );
  }
  const root = SVG_ROOT.exec(svg);
  const sourceWidth = Number(root?.[1]);
  const sourceHeight = Number(root?.[2]);
  if (!root || !validDimension(sourceWidth) || !validDimension(sourceHeight)) {
    throw new CanvasPngExportError("PNG export requires finite positive SVG dimensions.");
  }
  if (typeof globalThis.createImageBitmap !== "function") {
    throw new CanvasPngExportError("PNG export is unavailable in this Chromium webview.");
  }

  const dimensions = boundedDimensions(
    sourceWidth,
    sourceHeight,
    limits.maxDimension,
    limits.maxPixels,
  );
  const boundedRoot = root[0]
    .replace(/ width="[-+.0-9eE]+"/, ` width="${dimensions.width}"`)
    .replace(/ height="[-+.0-9eE]+"/, ` height="${dimensions.height}"`);
  const boundedSvg = `${boundedRoot}${svg.slice(root[0].length)}`;
  const source = new Blob([boundedSvg], { type: "image/svg+xml;charset=utf-8" });
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await globalThis.createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new CanvasPngExportError("PNG export could not create a 2D canvas.");
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    return await encodePngCanvas(canvas, limits.maxOutputBytes, dimensions);
  } catch (cause) {
    if (cause instanceof CanvasPngExportError) throw cause;
    try {
      const image = await svgBlobToImage(source);
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new CanvasPngExportError("PNG export could not create a 2D canvas.");
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      return await encodePngCanvas(canvas, limits.maxOutputBytes, dimensions);
    } catch (fallbackCause) {
      if (fallbackCause instanceof CanvasPngExportError) throw fallbackCause;
      throw new CanvasPngExportError(
        fallbackCause instanceof Error
          ? fallbackCause.message
          : cause instanceof Error
            ? cause.message
            : "Chromium could not rasterize the Canvas SVG.",
      );
    }
  } finally {
    bitmap?.close();
  }
}

async function encodePngCanvas(
  canvas: HTMLCanvasElement,
  maxOutputBytes: number,
  dimensions: { width: number; height: number },
): Promise<CanvasPngRasterization> {
  const png = await canvasToPngBlob(canvas);
  if (png.size === 0 || png.size > maxOutputBytes) {
    throw new CanvasPngExportError(
      `PNG export is ${png.size} bytes; the limit is ${maxOutputBytes} bytes.`,
    );
  }
  return {
    content: await blobToBase64(png),
    encoding: "base64",
    width: dimensions.width,
    height: dimensions.height,
    byteLength: png.size,
  };
}

function boundedDimensions(
  width: number,
  height: number,
  maxDimension: number,
  maxPixels: number,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxDimension / width,
    maxDimension / height,
    Math.sqrt(maxPixels / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/png") {
        reject(new CanvasPngExportError("Chromium did not produce a PNG image."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function svgBlobToImage(blob: Blob): Promise<HTMLImageElement> {
  if (typeof FileReader !== "function" || typeof Image !== "function") {
    throw new CanvasPngExportError("PNG SVG fallback decoding is unavailable in this webview.");
  }
  const dataUrl = await blobToDataUrl(blob, "data:image/svg+xml");
  const image = new Image();
  image.decoding = "sync";
  image.src = dataUrl;
  try {
    await image.decode();
  } catch (cause) {
    throw new CanvasPngExportError(
      cause instanceof Error ? cause.message : "The source image could not be decoded.",
    );
  }
  return image;
}

function blobToDataUrl(blob: Blob, expectedPrefix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new CanvasPngExportError("Blob data URL encoding failed."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.startsWith(expectedPrefix)) {
        reject(new CanvasPngExportError("Blob data URL encoding returned an invalid payload."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== "function") {
    throw new CanvasPngExportError("PNG base64 encoding is unavailable in this webview.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new CanvasPngExportError("PNG base64 encoding failed."));
    reader.onload = () => {
      const result = reader.result;
      const prefix = "data:image/png;base64,";
      if (typeof result !== "string" || !result.startsWith(prefix)) {
        reject(new CanvasPngExportError("PNG base64 encoding returned an invalid payload."));
        return;
      }
      resolve(result.slice(prefix.length));
    };
    reader.readAsDataURL(blob);
  });
}

function boundedLimit(
  value: number | undefined,
  fallback: number,
  ceiling: number,
  label: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0 || value > ceiling) {
    throw new CanvasPngExportError(`${label} must be an integer between 1 and ${ceiling}.`);
  }
  return value;
}

function validDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
