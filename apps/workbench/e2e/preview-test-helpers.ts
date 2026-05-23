/**
 * Shared Playwright helpers for markdown preview coverage.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE] [DES-TEST]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";

import { type Locator, type Page, type TestInfo, expect } from "@playwright/test";

import { type MarkdownFence, nextMarkdownFence } from "../src/lib/markdown-fence";

export const REPO_ROOT = resolve(process.cwd(), "../..");
export const SCREENSHOT_DIR = resolve(REPO_ROOT, "artifacts/workbench/screenshots");
export const CORPUS_SCREENSHOT_DIR = resolve(REPO_ROOT, "artifacts/workbench/corpus-screenshots");

export interface MarkdownHeading {
  level: number;
  text: string;
}

export interface MarkdownSample {
  filePath: string;
  content: string;
}

const FRONTMATTER_KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]*\s*:/;
const TRACE_TOKEN_RE =
  /\s*\[(?:FR|NFR|DES|ADR|AC|REQ|TASK|QA|TRACE|DESIGN|SPEC)-[A-Za-z0-9_.:-]+\]/g;
const MARKDOWN_ESCAPABLE_CHARS = new Set([
  "\\",
  "`",
  "*",
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  "#",
  "+",
  "-",
  ".",
  "!",
  "_",
  "|",
  "<",
  ">",
  "~",
]);
const LOREM_WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "eiusmod",
  "tempor",
  "incididunt",
  "labore",
  "magna",
  "aliqua",
];
const PRESERVED_HEADING_RE =
  /^(?:\d+\.\s*)?(?:references|problem statement|user stories|primary users|stories|requirements|functional requirements|non-functional requirements|acceptance criteria|non-goals(?:\s+\(.+\))?|open questions|dependencies|spec|design|plan|overview|architecture|tasks?|work sessions?|sessions)$/i;
const PRESERVED_TABLE_CELL_RE =
  /^(?:id|requirement|priority|status|date|task|action|files modified|agent|human|owner|type|route|users|purpose|decision|rationale|risk|mitigation|source|target|file|notes?)$/i;

/** Boot the workbench bundle in standalone preview mode. */
export async function bootInPreviewMode(page: Page) {
  await page.goto("/?afx-view=preview");
  await expect(page.locator("#root")).toBeVisible();
}

export async function postPreview(
  page: Page,
  filePath: string,
  content: string,
  isAfxHint: boolean,
) {
  await page.evaluate(
    ({ filePath, content, isAfxHint }) => {
      window.postMessage({ type: "afxPreviewShow", filePath, content, isAfxHint }, "*");
    },
    { filePath, content, isAfxHint },
  );
}

export function previewArticle(page: Page): Locator {
  return page.locator("article").first();
}

export async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.body.scrollWidth - window.innerWidth,
      document.documentElement.scrollWidth - window.innerWidth,
    ),
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function attachPreviewScreenshot(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = resolve(SCREENSHOT_DIR, `${name}.png`);
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach(`${name}.png`, { body: buf, contentType: "image/png" });
  expect(buf.length).toBeGreaterThan(10_000);
}

export async function attachCorpusScreenshot(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(CORPUS_SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = resolve(CORPUS_SCREENSHOT_DIR, `${name}.png`);
  const buf = await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach(`${name}.png`, { body: buf, contentType: "image/png" });
  expect(buf.length).toBeGreaterThan(10_000);
}

export function markdownFilesUnder(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.endsWith(".md")) files.push(relative(REPO_ROOT, fullPath));
    }
  };
  walk(resolve(REPO_ROOT, root));
  return files.sort((a, b) => a.localeCompare(b));
}

export function markdownSamplesUnder(root: string): MarkdownSample[] {
  const absoluteRoot = isAbsolute(root) ? root : resolve(REPO_ROOT, root);
  if (!existsSync(absoluteRoot)) return [];

  const samples: MarkdownSample[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.endsWith(".md")) continue;

      const repoRelative = relative(REPO_ROOT, fullPath);
      const filePath =
        repoRelative && !repoRelative.startsWith("..") && !isAbsolute(repoRelative)
          ? repoRelative
          : fullPath;
      samples.push({ filePath, content: readFileSync(fullPath, "utf8") });
    }
  };
  walk(absoluteRoot);

  return samples.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

export function externalMarkdownSamplesFromRootsFile(filePath: string): MarkdownSample[] {
  if (!existsSync(filePath)) return [];

  return readFileSync(filePath, "utf8")
    .split(/[\r\n,]+/)
    .map((root) => root.trim())
    .filter(Boolean)
    .flatMap((root) => markdownSamplesUnder(root));
}

export function corpusScreenshotName(sample: MarkdownSample, index: number): string {
  return `${String(index + 1).padStart(4, "0")}-${sampleHash(sample)}`;
}

export function sanitizeExternalMarkdownSample(sample: MarkdownSample): MarkdownSample {
  const id = sampleHash(sample);
  return {
    filePath: `sanitized/external-${id}-${sanitizeFileExtension(sample.filePath)}`,
    content: sanitizeMarkdownContent(sample.content),
  };
}

export function readRepoMarkdown(filePath: string): string {
  return readFileSync(resolve(REPO_ROOT, filePath), "utf8");
}

export function isAfxMarkdown(content: string): boolean {
  return /^---[\s\S]*?\n---/.test(content) && /^afx:\s*true\b/im.test(content);
}

function sanitizeMarkdownContent(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const frontmatter = openingFrontmatter(normalized);
  const body = frontmatter ? normalized.slice(frontmatter.endIndex) : normalized;
  const sanitizedBody = sanitizeMarkdownBody(body);

  if (!frontmatter) return sanitizedBody;

  return `${sanitizeFrontmatter(frontmatter.raw, isAfxMarkdown(normalized))}\n${sanitizedBody}`;
}

function openingFrontmatter(content: string): { raw: string; endIndex: number } | null {
  const match = /^---\n[\s\S]*?\n---\n?/.exec(content);
  if (!match) return null;
  const raw = match[0].replace(/\n?$/, "");
  const hasYamlKeys = raw
    .split("\n")
    .slice(1, -1)
    .some((line) => FRONTMATTER_KEY_RE.test(line.trim()));
  if (!hasYamlKeys) return null;
  return { raw, endIndex: match[0].length };
}

function sanitizeFrontmatter(raw: string, isAfx: boolean): string {
  const type = /^type:\s*([A-Z_ -]+)/im.exec(raw)?.[1]?.trim() || (isAfx ? "SPEC" : undefined);
  const status = /^status:\s*([A-Za-z_ -]+)/im.exec(raw)?.[1]?.trim() || "Living";
  const lines = [
    "---",
    ...(isAfx ? ["afx: true"] : []),
    ...(type ? [`type: ${type}`] : []),
    `status: ${status}`,
    'owner: "@fixture"',
    'version: "1.0"',
    'created_at: "2026-01-01T00:00:00.000Z"',
    'updated_at: "2026-01-01T00:00:00.000Z"',
    "tags: [sanitized, preview, corpus]",
    "---",
  ];
  return lines.join("\n");
}

function sanitizeMarkdownBody(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let fence: { indent: string; marker: string; length: number; lang: string; line: number } | null =
    null;
  let headingIndex = 0;
  let textIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    const fenceMatch = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch && !fence) {
      const marker = fenceMatch[2] ?? "```";
      const lang = (fenceMatch[3] ?? "").trim().split(/\s+/)[0] ?? "";
      fence = {
        indent: fenceMatch[1] ?? "",
        marker,
        length: marker.length,
        lang: /^[A-Za-z0-9_-]+$/.test(lang) ? lang : "",
        line: 0,
      };
      out.push(`${fence.indent}${fence.marker}${fence.lang ? fence.lang : ""}`);
      continue;
    }
    if (fence) {
      if (fenceMatch && (fenceMatch[2] ?? "")[0] === fence.marker[0]) {
        out.push(`${fence.indent}${fence.marker[0]?.repeat(fence.length) ?? fence.marker}`);
        fence = null;
        continue;
      }
      out.push(line.trim() ? sanitizedCodeLine(fence.lang, fence.line++) : "");
      continue;
    }

    if (!line.trim()) {
      out.push("");
      continue;
    }

    const sprintMarker =
      /^(\s*)<!--\s*SPRINT-SECTION-(START|END)\s*:\s*(SPEC|DESIGN|TASKS|SESSIONS)\b[\s\S]*?-->\s*$/.exec(
        line,
      );
    if (sprintMarker) {
      out.push(
        `${sprintMarker[1] ?? ""}<!-- SPRINT-SECTION-${sprintMarker[2]}: ${sprintMarker[3]} -->`,
      );
      continue;
    }
    if (/^\s*<!--/.test(line)) {
      out.push("");
      continue;
    }

    const heading = /^(\s*#{1,6}\s+)(.+?)(\s*#*\s*)$/.exec(line);
    if (heading) {
      headingIndex += 1;
      out.push(`${heading[1]}${sanitizeHeading(heading[2] ?? "", headingIndex)}${heading[3]}`);
      continue;
    }

    if (/^\s*-{3,}\s*$/.test(line)) {
      out.push(line);
      continue;
    }
    if (isMarkdownTableSeparator(line.trim())) {
      out.push(line);
      continue;
    }
    if (isMarkdownTableRow(line.trim()) && hasMarkdownTableContext(lines, lineIndex)) {
      out.push(sanitizeTableRow(line, textIndex++));
      continue;
    }

    const checkbox = /^(\s*[-*+]\s+\[[ xX]?\]\s+)(.*)$/.exec(line);
    if (checkbox) {
      out.push(`${checkbox[1]}${loremSentence(textIndex++)}`);
      continue;
    }

    const bullet = /^(\s*[-*+]\s+)(.*)$/.exec(line);
    if (bullet) {
      out.push(`${bullet[1]}${sanitizeInlineShape(bullet[2] ?? "", textIndex++)}`);
      continue;
    }

    const numbered = /^(\s*\d+[.)]\s+)(.*)$/.exec(line);
    if (numbered) {
      out.push(`${numbered[1]}${sanitizeInlineShape(numbered[2] ?? "", textIndex++)}`);
      continue;
    }

    const quote = /^(\s*>+\s?)(.*)$/.exec(line);
    if (quote) {
      out.push(`${quote[1]}${sanitizeInlineShape(quote[2] ?? "", textIndex++)}`);
      continue;
    }

    out.push(`${line.match(/^\s*/)?.[0] ?? ""}${sanitizeInlineShape(line.trim(), textIndex++)}`);
  }

  return out.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

function hasMarkdownTableContext(lines: string[], index: number): boolean {
  const previous = lines[index - 1]?.trim() ?? "";
  const previousPrevious = lines[index - 2]?.trim() ?? "";
  const next = lines[index + 1]?.trim() ?? "";
  const nextNext = lines[index + 2]?.trim() ?? "";
  return (
    isMarkdownTableSeparator(previous) ||
    isMarkdownTableSeparator(next) ||
    (isMarkdownTableRow(previous) && isMarkdownTableSeparator(previousPrevious)) ||
    (isMarkdownTableRow(next) && isMarkdownTableSeparator(nextNext))
  );
}

function sanitizeHeading(text: string, index: number): string {
  const clean = cleanHeadingText(text);
  if (PRESERVED_HEADING_RE.test(clean)) return clean;
  const phase = /^Phase\s+(\d+)\s*:/i.exec(clean);
  if (phase) return `Phase ${phase[1]}: ${titleLorem(index)}`;
  const task = /^(\d+(?:\.\d+)+)\s+/.exec(clean);
  if (task) return `${task[1]} ${titleLorem(index)}`;
  const numbered = /^(\d+\.\s+)/.exec(clean);
  if (numbered) return `${numbered[1]}${titleLorem(index)}`;
  return titleLorem(index);
}

function sanitizeTableRow(line: string, seed: number): string {
  const cells = splitMarkdownTableCells(line);
  const sanitized = cells.map((cell, index) => sanitizeTableCell(cell, seed + index));
  return `| ${sanitized.join(" | ")} |`;
}

function sanitizeTableCell(cell: string, seed: number): string {
  const value = cell.trim();
  if (!value) return "";
  if (/^\[[ xX]?\]$/.test(value)) return value;
  if (PRESERVED_TABLE_CELL_RE.test(value)) return value;
  if (/^(?:FR|NFR|DES|ADR|AC|REQ|TASK|QA)-[A-Za-z0-9_.:-]+$/i.test(value)) return value;
  if (/^\d+(?:\.\d+)*$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return "2026-01-01";
  if (/^`[^`]+`$/.test(value)) return "`lorem.ts`";
  return loremPhrase(seed, 3, 7);
}

function sanitizeInlineShape(text: string, seed: number): string {
  if (!text.trim()) return "";
  if (/^\*\*[^*]+:\*\*/.test(text)) return `**${titleLorem(seed)}:** ${loremSentence(seed + 1)}`;
  if (/^`[^`]+`$/.test(text.trim())) return "`lorem`";
  return loremSentence(seed);
}

function sanitizedCodeLine(lang: string, line: number): string {
  if (/mermaid/i.test(lang)) {
    return line === 0 ? "graph TD" : "  A[Lorem ipsum] --> B[Dolor sit amet]";
  }
  if (/json/i.test(lang)) {
    return line % 2 === 0 ? '{ "lorem": "ipsum", "dolor": true }' : '{ "sit": "amet" }';
  }
  if (/ya?ml/i.test(lang)) {
    return line % 2 === 0 ? "lorem: ipsum" : "dolor: sit-amet";
  }
  return `lorem_ipsum_${line} = "dolor sit amet consectetur adipiscing elit sed eiusmod tempor";`;
}

function titleLorem(seed: number): string {
  return loremPhrase(seed, 2, 4)
    .split(" ")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function loremSentence(seed: number): string {
  const phrase = loremPhrase(seed, 8, 14);
  return `${phrase[0]?.toUpperCase() ?? ""}${phrase.slice(1)}.`;
}

function loremPhrase(seed: number, min: number, max: number): string {
  const count = min + (Math.abs(seed) % Math.max(1, max - min + 1));
  return Array.from(
    { length: count },
    (_, index) => LOREM_WORDS[(seed + index) % LOREM_WORDS.length],
  )
    .filter((word): word is string => Boolean(word))
    .join(" ");
}

function sampleHash(sample: MarkdownSample): string {
  return createHash("sha1").update(sample.filePath).digest("hex").slice(0, 10);
}

function sanitizeFileExtension(filePath: string): string {
  const name = basename(filePath).toLowerCase();
  return name.endsWith(".md") ? "fixture.md" : "fixture";
}

function stripOpeningFrontmatter(content: string): string {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return lines.join("\n");
  const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closeIndex === -1) return lines.join("\n");
  const hasYamlKeys = lines
    .slice(1, closeIndex)
    .some((line) => FRONTMATTER_KEY_RE.test(line.trim()));
  return hasYamlKeys ? lines.slice(closeIndex + 1).join("\n") : lines.join("\n");
}

function removeHtmlComments(
  line: string,
  inComment: boolean,
): { line: string; inComment: boolean } {
  let visible = line;
  let commentOpen = inComment;
  if (commentOpen) {
    const close = visible.indexOf("-->");
    if (close === -1) return { line: "", inComment: true };
    visible = visible.slice(close + 3);
    commentOpen = false;
  }

  while (visible.includes("<!--")) {
    const open = visible.indexOf("<!--");
    const close = visible.indexOf("-->", open + 4);
    if (close === -1) {
      visible = visible.slice(0, open);
      commentOpen = true;
      break;
    }
    visible = visible.slice(0, open) + visible.slice(close + 3);
  }

  return { line: visible, inComment: commentOpen };
}

export function cleanHeadingText(text: string): string {
  const codeSpans: string[] = [];
  const protectedText = text.replace(/`([^`]+)`/g, (_, code: string) => {
    const marker = `@@AFXHEADINGCODE${codeSpans.length}@@`;
    codeSpans.push(code);
    return marker;
  });

  return protectedText
    .replace(TRACE_TOKEN_RE, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^\w])\*([^*\n]+)\*($|[^\w])/g, "$1$2$3")
    .replace(/(^|[^\w])_([^_\n]+)_($|[^\w])/g, "$1$2$3")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\\(.)/g, (match: string, char: string) =>
      MARKDOWN_ESCAPABLE_CHARS.has(char) ? char : match,
    )
    .replace(/@@AFXHEADINGCODE(\d+)@@/g, (_, index: string) => codeSpans[Number(index)] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const lines = stripOpeningFrontmatter(content).split(/\r?\n/);
  let fence: MarkdownFence | null = null;
  let inComment = false;

  for (const rawLine of lines) {
    const nextFence = nextMarkdownFence(rawLine, fence);
    if (nextFence !== fence) {
      fence = nextFence;
      continue;
    }
    if (fence) continue;

    const visible = removeHtmlComments(rawLine, inComment);
    inComment = visible.inComment;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(visible.line.trim());
    if (!match) continue;

    const level = match[1]?.length ?? 1;
    const text = cleanHeadingText(match[2] ?? "");
    if (text) headings.push({ level, text });
  }

  return headings;
}

export function countMarkdownTables(content: string): number {
  const lines = stripOpeningFrontmatter(content).split(/\r?\n/);
  let count = 0;
  let fence: MarkdownFence | null = null;
  let inComment = false;

  for (let index = 0; index < lines.length - 1; index++) {
    const rawLine = lines[index] ?? "";
    const nextFence = nextMarkdownFence(rawLine, fence);
    if (nextFence !== fence) {
      fence = nextFence;
      continue;
    }
    if (fence) continue;

    const current = removeHtmlComments(rawLine, inComment);
    inComment = current.inComment;
    if (inComment) continue;

    const next = removeHtmlComments(lines[index + 1] ?? "", false).line.trim();
    if (isMarkdownTableRow(current.line.trim()) && isMarkdownTableSeparator(next)) {
      count++;
    }
  }

  return count;
}

function splitMarkdownTableCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let codeFence = "";

  for (let index = 0; index < line.length; index++) {
    const char = line[index] ?? "";
    const next = line[index + 1] ?? "";
    if (char === "\\" && next) {
      current += char + next;
      index++;
      continue;
    }
    if (char === "`") {
      let cursor = index;
      while (line[cursor] === "`") cursor++;
      const ticks = line.slice(index, cursor);
      if (!codeFence) codeFence = ticks;
      else if (ticks === codeFence) codeFence = "";
      current += ticks;
      index = cursor - 1;
      continue;
    }
    if (char === "|" && !codeFence) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  if (line.trimStart().startsWith("|") && cells[0] === "") cells.shift();
  if (line.trimEnd().endsWith("|") && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function isMarkdownTableRow(line: string): boolean {
  return line.includes("|") && splitMarkdownTableCells(line).length >= 2;
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

export async function expectRenderedHeadings(
  page: Page,
  content: string,
  ignoredHeadings: string[] = [],
) {
  const expected = extractMarkdownHeadings(content);
  const ignored = new Set(ignoredHeadings);
  const rendered = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("article h1, article [data-afx-md-section='heading']"),
    ).map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
  const missing = expected
    .map((heading) => heading.text)
    .filter((heading) => !ignored.has(heading))
    .filter((heading) => !rendered.includes(heading));

  expect(missing, `missing rendered headings: ${missing.join(", ")}`).toEqual([]);
}

export async function expectRenderedTableCoverage(page: Page, content: string) {
  const expectedTables = countMarkdownTables(content);
  const renderedTables = await page.evaluate(
    () => document.querySelectorAll("article table").length,
  );
  expect(renderedTables).toBeGreaterThanOrEqual(expectedTables);
}

export async function expectNoRawMarkdownLeaks(surface: Locator) {
  const leaks = await surface.evaluate((root) =>
    Array.from(root.querySelectorAll("p, li, td, th"))
      .filter((node) => !node.closest("blockquote"))
      .filter((node) => !node.querySelector("pre, [data-afx-md-section='code-block']"))
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((text) => {
        const pipeCount = text.match(/\|/g)?.length ?? 0;
        return Boolean(
          text &&
          ((pipeCount >= 2 && /^\|.*\|/.test(text)) ||
            /^-{2,}\s*\|/.test(text) ||
            /\|\s*:?-{2,}:?\s*\|/.test(text) ||
            /SPRINT-SECTION-(?:START|END)/.test(text)),
        );
      }),
  );

  expect(leaks, `raw markdown leaks: ${leaks.join(" | ")}`).toEqual([]);
}

export async function expectCodeBlocksDoNotWrap(surface: Locator) {
  const codeWhitespace = await surface.evaluate((root) =>
    Array.from(root.querySelectorAll("[data-afx-md-section='code-block'] code")).map(
      (node) => window.getComputedStyle(node).whiteSpace,
    ),
  );
  for (const value of codeWhitespace) {
    expect(value).toBe("pre");
  }
}

export async function expectTableHeadersDoNotWrap(surface: Locator) {
  const wrappedHeaders = await surface.evaluate((root) =>
    Array.from(root.querySelectorAll("th"))
      .map((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
          height: rect.height,
          whiteSpace: style.whiteSpace,
        };
      })
      .filter((header) => header.text && (header.whiteSpace !== "nowrap" || header.height > 44)),
  );

  expect(
    wrappedHeaders,
    `wrapped table headers: ${wrappedHeaders
      .map((header) => `${header.text} (${header.height}px, ${header.whiteSpace})`)
      .join(" | ")}`,
  ).toEqual([]);
}
