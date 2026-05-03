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
  const { data, content } = matter(raw);
  return { data: data as T, content };
}
