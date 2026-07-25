/**
 * Discovery and lossless source mutation for Board-linked AFX work items.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-12] [FR-13] [FR-14]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-LINK-WORK] [DES-BOARD-DATA]
 */
import { createHash } from "node:crypto";

import { parseFrontmatter } from "@afx/parsers";
import type {
  LinkedWorkItemCandidate,
  LinkedWorkItemRef,
  LinkedWorkItemSnapshot,
  WorkbenchSourceIdentity,
} from "@afx/shared";

export interface LinkedWorkSource {
  source: WorkbenchSourceIdentity;
  content: string;
  revision: string;
}

export interface LinkedWorkCatalog {
  candidates: LinkedWorkItemCandidate[];
  resolve(ref: LinkedWorkItemRef): LinkedWorkItemSnapshot;
}

interface ParsedChecklistItem {
  fingerprint: string;
  text: string;
  completed: boolean;
  line: number;
}

interface ParsedWorkSection {
  wbsId: string;
  title: string;
  items: ParsedChecklistItem[];
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function canonicalKey(ref: LinkedWorkItemRef): string {
  return [
    ref.kind,
    ref.source.rootUri,
    ref.source.relativePath,
    ref.kind === "task" ? ref.wbsId : "",
  ].join(":");
}

function pathFeatureName(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  const file = parts.at(-1)?.replace(/\.md$/i, "") ?? relativePath;
  const parent = parts.at(-2);
  return parent && !/^specs?$/i.test(parent) ? parent : file;
}

function documentTitle(content: string, fallback: string): string {
  const { data, content: body } = parseFrontmatter(content);
  if (typeof data["title"] === "string" && data["title"].trim()) return data["title"].trim();
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  return heading || fallback;
}

function documentStatus(content: string): string | undefined {
  const { data } = parseFrontmatter(content);
  return typeof data["status"] === "string" ? data["status"] : undefined;
}

function isSpecSource(source: LinkedWorkSource): boolean {
  const { data } = parseFrontmatter(source.content);
  const type = typeof data["type"] === "string" ? data["type"].toUpperCase() : "";
  return type === "SPEC" || /(?:^|\/)spec\.md$/i.test(source.source.relativePath);
}

function parseTaskSections(content: string): ParsedWorkSection[] {
  const lines = content.split(/\r?\n/);
  const sections: ParsedWorkSection[] = [];
  let current: ParsedWorkSection | null = null;
  const duplicateCounts = new Map<string, number>();

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const heading = /^###\s+(\d+(?:\.\d+)+)\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      current = { wbsId: heading[1] ?? "", title: heading[2]?.trim() ?? "", items: [] };
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      if (current) sections.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const checkbox = /^\s*-\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (!checkbox) continue;
    const text = checkbox[2]?.trim() ?? "";
    const duplicateKey = `${current.wbsId}:${text}`;
    const occurrence = duplicateCounts.get(duplicateKey) ?? 0;
    duplicateCounts.set(duplicateKey, occurrence + 1);
    current.items.push({
      fingerprint: hash(`${duplicateKey}:${occurrence}`),
      text,
      completed: /x/i.test(checkbox[1] ?? ""),
      line: index,
    });
  }
  if (current) sections.push(current);
  return sections;
}

function sourceMatches(a: WorkbenchSourceIdentity, b: WorkbenchSourceIdentity): boolean {
  return a.rootUri === b.rootUri && a.relativePath === b.relativePath;
}

/**
 * Build picker candidates and live resolved snapshots from canonical file
 * identities. Resolution never guesses a replacement path.
 *
 * @see docs/specs/221-app-workbench-board/tasks.md [4.1]
 */
export function buildLinkedWorkCatalog(sources: readonly LinkedWorkSource[]): LinkedWorkCatalog {
  const candidates: LinkedWorkItemCandidate[] = [];
  const taskSections = new Map<string, ParsedWorkSection[]>();

  for (const source of sources) {
    const group = `${source.source.rootName} · ${pathFeatureName(source.source.relativePath)}`;
    if (isSpecSource(source)) {
      const ref: LinkedWorkItemRef = { version: 1, kind: "spec", source: source.source };
      candidates.push({
        key: canonicalKey(ref),
        ref,
        label: documentTitle(source.content, pathFeatureName(source.source.relativePath)),
        group,
        status: documentStatus(source.content),
        completed: 0,
        total: 0,
      });
    }
    if (!/(?:^|\/)tasks\.md$/i.test(source.source.relativePath)) continue;
    const sections = parseTaskSections(source.content);
    taskSections.set(`${source.source.rootUri}:${source.source.relativePath}`, sections);
    for (const section of sections) {
      const ref: LinkedWorkItemRef = {
        version: 1,
        kind: "task",
        source: source.source,
        wbsId: section.wbsId,
      };
      candidates.push({
        key: canonicalKey(ref),
        ref,
        label: `${section.wbsId} · ${section.title}`,
        group,
        status:
          section.items.every((item) => item.completed) && section.items.length
            ? "Complete"
            : "Open",
        completed: section.items.filter((item) => item.completed).length,
        total: section.items.length,
      });
    }
  }

  candidates.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  return {
    candidates,
    resolve(ref): LinkedWorkItemSnapshot {
      const matches = sources.filter((source) => sourceMatches(source.source, ref.source));
      if (matches.length === 0) {
        const sameRootName = sources.some(
          (source) =>
            source.source.rootName === ref.source.rootName &&
            source.source.relativePath === ref.source.relativePath,
        );
        return {
          state: "unresolved",
          reason: sameRootName ? "cross-root" : "missing",
          message: sameRootName
            ? "The linked file belongs to another workspace root. Relink it explicitly."
            : "The linked source no longer exists. Open the board card to relink it.",
        };
      }
      if (matches.length > 1) {
        return {
          state: "unresolved",
          reason: "ambiguous",
          message: "More than one source matches this linked card. Relink it explicitly.",
        };
      }
      const source = matches[0];
      if (!source) {
        return { state: "unresolved", reason: "missing", message: "Linked source not found." };
      }
      if (ref.kind === "spec") {
        if (!isSpecSource(source)) {
          return {
            state: "unresolved",
            reason: "malformed",
            message: "The linked file is no longer an AFX specification.",
          };
        }
        return {
          state: "resolved",
          sourceRevision: source.revision,
          title: documentTitle(source.content, pathFeatureName(source.source.relativePath)),
          lifecycle: documentStatus(source.content),
          completed: 0,
          total: 0,
        };
      }
      const sections =
        taskSections.get(`${source.source.rootUri}:${source.source.relativePath}`) ??
        parseTaskSections(source.content);
      const matchesByWbs = sections.filter((section) => section.wbsId === ref.wbsId);
      if (matchesByWbs.length !== 1) {
        return {
          state: "unresolved",
          reason: matchesByWbs.length ? "ambiguous" : "moved",
          message: matchesByWbs.length
            ? `Task ${ref.wbsId} is duplicated in its source.`
            : `Task ${ref.wbsId} was moved or removed. Relink it explicitly.`,
        };
      }
      const section = matchesByWbs[0];
      if (!section) {
        return { state: "unresolved", reason: "missing", message: "Task section not found." };
      }
      return {
        state: "resolved",
        sourceRevision: source.revision,
        title: `${section.wbsId} · ${section.title}`,
        lifecycle:
          section.items.every((item) => item.completed) && section.items.length
            ? "Complete"
            : "Open",
        completed: section.items.filter((item) => item.completed).length,
        total: section.items.length,
        checklist: section.items.map(({ fingerprint, text, completed }) => ({
          fingerprint,
          text,
          completed,
        })),
      };
    },
  };
}

export type LinkedTaskToggleOutcome =
  { ok: true; content: string } | { ok: false; reason: "missing" | "ambiguous"; message: string };

/**
 * Toggle one source-owned checklist item without regenerating its task file.
 *
 * @see docs/specs/221-app-workbench-board/tasks.md [4.3]
 */
export function toggleLinkedTaskItem(
  content: string,
  wbsId: string,
  itemFingerprint: string,
  completed: boolean,
): LinkedTaskToggleOutcome {
  const sections = parseTaskSections(content).filter((section) => section.wbsId === wbsId);
  if (sections.length !== 1) {
    return {
      ok: false,
      reason: sections.length ? "ambiguous" : "missing",
      message: sections.length ? `Task ${wbsId} is duplicated.` : `Task ${wbsId} no longer exists.`,
    };
  }
  const items = sections[0]?.items.filter((item) => item.fingerprint === itemFingerprint) ?? [];
  if (items.length !== 1) {
    return {
      ok: false,
      reason: items.length ? "ambiguous" : "missing",
      message: items.length ? "Checklist item is ambiguous." : "Checklist item no longer exists.",
    };
  }
  const target = items[0];
  if (!target) return { ok: false, reason: "missing", message: "Checklist item not found." };
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const current = lines[target.line] ?? "";
  lines[target.line] = current.replace(/^(\s*-\s+)\[[ xX]\]/, `$1[${completed ? "x" : " "}]`);
  return { ok: true, content: lines.join(newline) };
}
