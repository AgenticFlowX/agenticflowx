/**
 * Shared SDD document helpers for chat and workbench surfaces.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-LOC]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10] [FR-15]
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-1] [FR-7]
 */

export type SddDocumentKind =
  "spec" | "design" | "tasks" | "journal" | "sprint" | "adr" | "research";

export interface SddDocumentInfo {
  path: string;
  kind: SddDocumentKind;
  feature: string | null;
  commandTarget: string;
  label: string;
}

export interface SddDocumentAction {
  label: string;
  command: string;
  mode: "insert" | "send";
}

const MARKDOWN_PATH_RE = /\.(?:md|markdown)$/i;
const DOCS_SPECS_RE = /(?:^|\/)docs\/specs\/(.+)$/i;
const DOCS_RESEARCH_RE = /(?:^|\/)docs\/research\//i;
const DOCS_ADR_RE = /(?:^|\/)docs\/(?:adr|adrs)\//i;

export function normalizeSddPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/");
}

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_PATH_RE.test(normalizeSddPath(path));
}

export function classifySddDocumentPath(path: string): SddDocumentInfo | null {
  const normalized = normalizeSddPath(path);
  if (!isMarkdownPath(normalized)) return null;

  const parts = normalized.split("/");
  const basename = parts[parts.length - 1]?.toLowerCase() ?? "";
  const kind = kindFromBasename(basename) ?? kindFromPath(normalized);
  if (!kind) return null;

  const feature = featureFromSddPath(normalized, kind);
  const commandTarget = feature ?? normalized;
  return {
    path: normalized,
    kind,
    feature,
    commandTarget,
    label: labelForSddKind(kind),
  };
}

export function isSddDocumentPath(path: string): boolean {
  return classifySddDocumentPath(path) !== null;
}

export function sddPrimaryActionForPath(path: string): SddDocumentAction | null {
  const info = classifySddDocumentPath(path);
  if (!info) return null;
  const target = info.commandTarget;

  switch (info.kind) {
    case "spec":
      return { label: "Refine spec", command: `/afx-spec refine ${target}`, mode: "insert" };
    case "design":
      return { label: "Refine design", command: `/afx-design refine ${target}`, mode: "insert" };
    case "tasks":
      return { label: "Task status", command: `/afx-task status ${target}`, mode: "send" };
    case "journal":
      return { label: "Capture note", command: `/afx-session note ${target}`, mode: "insert" };
    case "sprint":
      return { label: "Refine sprint", command: `/afx-sprint verify ${target}`, mode: "send" };
    case "adr":
      return { label: "Review ADR", command: `/afx-adr review ${target}`, mode: "insert" };
    case "research":
      return {
        label: "Summarize research",
        command: `/afx-research summarize ${target}`,
        mode: "insert",
      };
  }
}

export function sddJournalActionForPath(path: string): SddDocumentAction | null {
  const info = classifySddDocumentPath(path);
  if (!info) return null;
  return {
    label: "Journal",
    command: `/afx-session capture --links ${info.commandTarget}`,
    mode: "insert",
  };
}

function kindFromBasename(basename: string): SddDocumentKind | null {
  switch (basename) {
    case "spec.md":
    case "spec.markdown":
      return "spec";
    case "design.md":
    case "design.markdown":
      return "design";
    case "tasks.md":
    case "tasks.markdown":
      return "tasks";
    case "journal.md":
    case "journal.markdown":
      return "journal";
    default:
      return null;
  }
}

function kindFromPath(path: string): SddDocumentKind | null {
  const parts = path.split("/");
  const basename = parts[parts.length - 1]?.toLowerCase() ?? "";
  if (DOCS_ADR_RE.test(path) || basename.startsWith("adr-")) return "adr";
  if (DOCS_RESEARCH_RE.test(path)) return "research";
  if (DOCS_SPECS_RE.test(path)) return "sprint";
  return null;
}

function featureFromSddPath(path: string, kind: SddDocumentKind): string | null {
  const specs = DOCS_SPECS_RE.exec(path)?.[1];
  if (specs) {
    const parts = specs.split("/").filter(Boolean);
    if (parts.length <= 1) return parts[0] ?? null;
    return parts.slice(0, -1).join("/");
  }

  if (kind === "adr" || kind === "research") {
    const parts = path.split("/");
    const basename = parts[parts.length - 1];
    return basename ? basename.replace(MARKDOWN_PATH_RE, "") : null;
  }

  return null;
}

function labelForSddKind(kind: SddDocumentKind): string {
  switch (kind) {
    case "spec":
      return "Spec";
    case "design":
      return "Design";
    case "tasks":
      return "Tasks";
    case "journal":
      return "Journal";
    case "sprint":
      return "Sprint";
    case "adr":
      return "ADR";
    case "research":
      return "Research";
  }
}
