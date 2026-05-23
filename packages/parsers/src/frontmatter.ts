/**
 * Generic frontmatter parser using gray-matter.
 *
 * @see docs/specs/120-package-parsers/spec.md [FR-1]
 * @see docs/specs/120-package-parsers/design.md [DES-PARSERS-FRONTMATTER]
 */
import matter from "gray-matter";

export interface FrontmatterResult<T = Record<string, unknown>> {
  data: T;
  content: string;
}

export function parseFrontmatter<T = Record<string, unknown>>(raw: string): FrontmatterResult<T> {
  try {
    const { data, content } = matter(raw);
    return { data: data as T, content };
  } catch {
    const fallback = parseFallbackFrontmatter(raw);
    return { data: fallback.data as T, content: fallback.content };
  }
}

function parseFallbackFrontmatter(raw: string): FrontmatterResult {
  const parsed = readOpeningFrontmatter(raw);
  if (!parsed) return { data: {}, content: raw };

  const data: Record<string, unknown> = {};
  for (const rawLine of parsed.frontmatter.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;

    const key = match[1] ?? "";
    data[key] = parseFallbackValue(match[2] ?? "");
  }

  return { data, content: parsed.content };
}

function parseFallbackValue(rawValue: string): unknown {
  const value = rawValue.trim();
  if (value === "") return "";
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => parseFallbackValue(item))
      .filter((item) => item !== "");
  }
  return value;
}

function readOpeningFrontmatter(raw: string): { frontmatter: string; content: string } | null {
  const source = raw.replace(/^\uFEFF/, "");
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closeIndex === -1) return null;

  return {
    frontmatter: lines.slice(1, closeIndex).join("\n"),
    content: lines
      .slice(closeIndex + 1)
      .join("\n")
      .replace(/^\s*\n/, ""),
  };
}
