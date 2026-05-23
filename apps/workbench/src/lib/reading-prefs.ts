/**
 * Reading preferences for the AFX document preview — width, text size, paper
 * tone, and body font. Persisted globally (guarded localStorage) so the choice
 * carries across previews and reloads. Focus/Zen mode is tracked alongside.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-14]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
export type ReadingWidth = "comfortable" | "wide";
export type ReadingSize = "s" | "m" | "l" | "xl";
export type ReadingTone = "default" | "warm";
export type ReadingFont = "sans" | "serif";

export interface ReadingPrefs {
  width: ReadingWidth;
  size: ReadingSize;
  tone: ReadingTone;
  font: ReadingFont;
  focus: boolean;
}

export const DEFAULT_READING_PREFS: ReadingPrefs = {
  width: "comfortable",
  size: "m",
  tone: "default",
  font: "sans",
  focus: false,
};

export const READING_SIZE_STEPS: readonly ReadingSize[] = ["s", "m", "l", "xl"];

const STORAGE_KEY = "afx.workbench.preview.reading";

const WIDTHS: readonly ReadingWidth[] = ["comfortable", "wide"];
const TONES: readonly ReadingTone[] = ["default", "warm"];
const FONTS: readonly ReadingFont[] = ["sans", "serif"];

/**
 * Read persisted reading prefs, falling back to defaults for any missing or
 * malformed field. Guards localStorage (private mode / restricted host).
 */
export function readReadingPrefs(): ReadingPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READING_PREFS };
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>;
    return {
      width: WIDTHS.includes(parsed.width as ReadingWidth)
        ? (parsed.width as ReadingWidth)
        : DEFAULT_READING_PREFS.width,
      size: READING_SIZE_STEPS.includes(parsed.size as ReadingSize)
        ? (parsed.size as ReadingSize)
        : DEFAULT_READING_PREFS.size,
      tone: TONES.includes(parsed.tone as ReadingTone)
        ? (parsed.tone as ReadingTone)
        : DEFAULT_READING_PREFS.tone,
      font: FONTS.includes(parsed.font as ReadingFont)
        ? (parsed.font as ReadingFont)
        : DEFAULT_READING_PREFS.font,
      focus: typeof parsed.focus === "boolean" ? parsed.focus : DEFAULT_READING_PREFS.focus,
    };
  } catch {
    return { ...DEFAULT_READING_PREFS };
  }
}

/** Persist reading prefs, swallowing storage failures (stays in-memory). */
export function writeReadingPrefs(prefs: ReadingPrefs): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable — state stays in-memory only.
  }
}

/** Sheet reading-measure class for the document body. */
export function readingWidthClass(width: ReadingWidth): string {
  return width === "wide" ? "max-w-none" : "max-w-[70ch]";
}

/** Title (DocumentStudio h1) size class per text-size step. */
export function readingTitleSizeClass(size: ReadingSize): string {
  switch (size) {
    case "s":
      return "text-xl";
    case "m":
      return "text-2xl";
    case "l":
      return "text-[28px]";
    case "xl":
      return "text-[32px]";
  }
}

/**
 * Body prose size class for `MinimalMarkdown` (base size + proportional heading
 * overrides via descendant selectors). Applied only in the reading preview.
 */
export function readingBodyScaleClass(size: ReadingSize): string {
  switch (size) {
    case "s":
      return "text-[13px] [&_h2]:text-sm [&_h3]:text-[13px] [&_h4]:text-[10px]";
    case "m":
      return "text-[15px]";
    case "l":
      return "text-[17px] [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-xs";
    case "xl":
      return "text-[19px] [&_h2]:text-xl [&_h3]:text-lg [&_h4]:text-sm";
  }
}
