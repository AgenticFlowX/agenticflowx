/**
 * spec.md parser — extracts frontmatter, functional requirements, and non-goals.
 *
 * @see docs/specs/120-package-parsers/spec.md [FR-2]
 * @see docs/specs/120-package-parsers/design.md [DES-PARSERS-SPEC]
 */
import { parseFrontmatter } from "./frontmatter";

export interface SpecFrontmatter {
  name: string;
  type: string;
  status: string;
  owner: string;
  version: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  requirements?: string[];
  dependencies?: string[];
}

export interface SpecRequirement {
  id: string;
  text: string;
  type: "FR" | "NFR";
}

export interface SpecParseResult {
  frontmatter: SpecFrontmatter;
  requirements: SpecRequirement[];
  nonGoals: string[];
  rawContent: string;
}

export function parseSpec(raw: string): SpecParseResult {
  const { data, content } = parseFrontmatter<SpecFrontmatter>(raw);

  const reqLineRegex = /^(FR-\d+|NFR-\d+)\s+(.+)$/gm;
  const requirements: SpecRequirement[] = [];
  let match: RegExpExecArray | null;

  while ((match = reqLineRegex.exec(content)) !== null) {
    const id = match[1] ?? "";
    requirements.push({
      id,
      text: match[2] ?? "",
      type: id.startsWith("FR-") ? "FR" : "NFR",
    });
  }

  const nonGoals: string[] = [];
  const nonGoalsSection = content.match(/## Non-Goals\b([\s\S]*?)(?=##|\$|#|$)/i);
  if (nonGoalsSection) {
    const lines = (nonGoalsSection[1] ?? "").split("\n");
    for (const line of lines) {
      const trimmed = line.replace(/^-\s*/, "").trim();
      if (trimmed && !trimmed.startsWith("#")) {
        nonGoals.push(trimmed);
      }
    }
  }

  return {
    frontmatter: {
      name: data.name ?? "",
      type: data.type ?? "",
      status: data.status ?? "",
      owner: data.owner ?? "",
      version: data.version ?? "1.0",
      created_at: data.created_at ?? "",
      updated_at: data.updated_at ?? "",
      tags: data.tags,
      requirements: data.requirements,
      dependencies: data.dependencies,
    },
    requirements,
    nonGoals,
    rawContent: content,
  };
}
