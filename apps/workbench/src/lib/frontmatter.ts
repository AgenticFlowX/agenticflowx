/**
 * Frontmatter helpers for Documents reader pane — extracts metadata chips.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-8]
 * @see docs/specs/220-app-workbench/design.md [DES-DOCS]
 */
export interface MetaChip {
  label: string;
  value: string;
  kind: "status" | "version" | "owner" | "tag" | "updated" | "type" | "info";
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;

export function parseSimpleFrontmatter(source: string): Record<string, unknown> {
  const m = FRONTMATTER_RE.exec(source);
  if (!m) return {};
  const out: Record<string, unknown> = {};
  const body = m[1] ?? "";
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value: string = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      out[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function extractMetaChips(frontmatter: Record<string, unknown>): MetaChip[] {
  const out: MetaChip[] = [];
  if (typeof frontmatter.type === "string") {
    out.push({ label: "Type", value: frontmatter.type, kind: "type" });
  }
  if (typeof frontmatter.status === "string") {
    out.push({ label: "Status", value: frontmatter.status, kind: "status" });
  }
  if (typeof frontmatter.version === "string") {
    out.push({ label: "v", value: frontmatter.version, kind: "version" });
  }
  if (typeof frontmatter.owner === "string") {
    out.push({ label: "Owner", value: frontmatter.owner, kind: "owner" });
  }
  if (typeof frontmatter.updated_at === "string") {
    out.push({ label: "Updated", value: frontmatter.updated_at, kind: "updated" });
  }
  if (Array.isArray(frontmatter.tags)) {
    for (const t of frontmatter.tags) {
      if (typeof t === "string") out.push({ label: "tag", value: t, kind: "tag" });
    }
  }
  return out;
}
