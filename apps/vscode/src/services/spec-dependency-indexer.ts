/**
 * Explicit, idempotent projection of AFX document relationships
 * (`depends_on`, `supersedes`, `relates_to`) into a portable JSON Canvas.
 *
 * Discovers every `afx: true` document across `docs/**` (all seven SDD kinds),
 * generates one kind-styled node per document, and one typed edge per declared
 * relationship — non-destructively and idempotently. Named
 * `spec-dependency-indexer` for back-compat; generalized per 230.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-26] [FR-27] [NFR-4]
 * @see docs/specs/230-app-workbench-spec-authoring/spec.md [FR-1] [FR-2] [FR-3] [FR-13]
 * @see docs/specs/230-app-workbench-spec-authoring/design.md [DES-ARCH] [DES-DATA]
 */
import { createHash } from "node:crypto";
import * as path from "node:path";

import * as vscode from "vscode";

import {
  normalizeDetachedDependencyEdges,
  parseJSONCanvas,
  serializeJSONCanvas,
  suppressesGeneratedDependency,
} from "@afx/canvas-engine";
import { parseFrontmatter } from "@afx/parsers";
import {
  type CanvasDocIndexEntry,
  type CanvasEdge,
  type CanvasFileNode,
  type CanvasNode,
  type JSONCanvas,
  type SddDocumentKind,
  type WorkbenchSourceIdentity,
  classifySddDocumentPath,
} from "@afx/shared";

import { isSprintFile } from "./sprint";
import type { WorkbenchFileState } from "./workbench-file-state";

/** The three authored relationship keys, source → target. */
export type DocRelationship = "depends_on" | "supersedes" | "relates_to";

export const DOC_RELATIONSHIPS: readonly DocRelationship[] = [
  "depends_on",
  "supersedes",
  "relates_to",
];

const RELATIONSHIP_LABEL: Record<DocRelationship, string> = {
  depends_on: "depends on",
  supersedes: "supersedes",
  relates_to: "relates to",
};

export interface SpecDependencyRecord {
  key: string;
  title: string;
  source: WorkbenchSourceIdentity;
  /** `depends_on` targets. Retained field name for back-compat. */
  dependsOn: string[];
  /** All declared relationships by kind (superset of `dependsOn`). */
  relationships?: Partial<Record<DocRelationship, string[]>>;
  /** `spec`/`sprint` retained for back-compat; `kind` carries the full SDD kind. */
  documentKind?: "spec" | "sprint";
  kind?: SddDocumentKind;
  status?: string;
}

interface GeneratedMetadata {
  version: 1;
  kind: "spec-node" | "unresolved-dependency";
  key: string;
}

export interface SpecDependencyRefresh {
  content: string;
  diagnostics: {
    unresolved: string[];
    ambiguous: string[];
    cycles: string[][];
  };
}

export interface SpecDependencyIndexer {
  refresh(content: string, canvasSource: WorkbenchSourceIdentity): Promise<SpecDependencyRefresh>;
  /** Compact index of all AFX docs for the "Add spec" picker and badges (230). */
  index(): Promise<CanvasDocIndexEntry[]>;
  /**
   * Resolve a canvas-internal target id to the only token that may cross the
   * frontmatter write boundary. Unknown ids and path-like caller input fail.
   */
  resolveAuthorToken(
    targetId: string,
    source: WorkbenchSourceIdentity,
    declaredToken?: string,
  ): Promise<string | undefined>;
}

export function createSpecDependencyIndexer(options: {
  fileState: WorkbenchFileState;
}): SpecDependencyIndexer {
  return {
    async refresh(content, canvasSource) {
      const canvas = parseJSONCanvas(content);
      const records = await discoverWithinBudget(options.fileState);
      return projectDependencies(canvas, records, canvasSource);
    },
    async index() {
      const records = await discoverWithinBudget(options.fileState);
      const byKey = buildAliasIndex(records);
      // Resolve each raw relationship token to the target record's stable id so
      // the webview can look targets up directly (unresolved/ambiguous dropped).
      return records.map((record) => {
        const raw = recordRelationships(record);
        const resolved: Partial<Record<DocRelationship, string[]>> = {};
        for (const relationship of DOC_RELATIONSHIPS) {
          const ids = (raw[relationship] ?? [])
            .map((token) => resolveRecord(token, byKey, record.source)?.key)
            .filter((id): id is string => Boolean(id));
          if (ids.length > 0) resolved[relationship] = [...new Set(ids)];
        }
        return {
          id: record.key,
          token: authorToken(record),
          title: record.title,
          kind: record.kind ?? (record.documentKind === "sprint" ? "sprint" : "spec"),
          source: record.source,
          ...(record.status ? { status: record.status } : {}),
          relationships: resolved,
        };
      });
    },
    async resolveAuthorToken(targetId, source, declaredToken) {
      const records = await discoverWithinBudget(options.fileState);
      const byKey = buildAliasIndex(records);
      const exact = records.find((record) => record.key === targetId);
      const target =
        exact ??
        (!targetId.includes("://") && !path.posix.isAbsolute(targetId)
          ? resolveRecord(targetId, byKey, source)
          : undefined);
      if (!target) return undefined;
      if (declaredToken && resolveRecord(declaredToken, byKey, source)?.key === target.key) {
        return declaredToken;
      }
      return authorToken(target, source);
    },
  };
}

function buildAliasIndex(
  records: readonly SpecDependencyRecord[],
): Map<string, SpecDependencyRecord[]> {
  const byKey = new Map<string, SpecDependencyRecord[]>();
  for (const record of records) {
    for (const alias of aliases(record)) {
      const normalized = normalizeDependency(alias);
      byKey.set(normalized, [...(byKey.get(normalized) ?? []), record]);
    }
  }
  return byKey;
}

function recordRelationships(
  record: SpecDependencyRecord,
): Partial<Record<DocRelationship, string[]>> {
  if (record.relationships) return record.relationships;
  // Legacy records (back-compat) only carry `dependsOn`.
  return { depends_on: record.dependsOn };
}

export function projectDependencies(
  canvas: JSONCanvas,
  records: readonly SpecDependencyRecord[],
  canvasSource: WorkbenchSourceIdentity,
): SpecDependencyRefresh {
  const byKey = buildAliasIndex(records);

  // Only `depends_on` participates in cycle detection (the dependency axis).
  const resolvedDepends = new Map<string, string[]>();
  const diagnostics: SpecDependencyRefresh["diagnostics"] = {
    unresolved: [],
    ambiguous: [],
    cycles: [],
  };
  for (const record of records) {
    const dependencies: string[] = [];
    for (const dependency of recordRelationships(record).depends_on ?? []) {
      const matches = uniqueRecords(byKey.get(normalizeDependency(dependency)) ?? []);
      const resolved = resolveRecord(dependency, byKey, record.source);
      if (resolved) dependencies.push(resolved.key);
      else if (matches.length === 0) diagnostics.unresolved.push(`${record.key} -> ${dependency}`);
      else diagnostics.ambiguous.push(`${record.key} -> ${dependency}`);
    }
    resolvedDepends.set(record.key, dependencies);
  }
  diagnostics.cycles = findCycles(resolvedDepends);
  const cyclicPairs = new Set<string>();
  for (const cycle of diagnostics.cycles) {
    for (let index = 0; index < cycle.length; index++) {
      cyclicPairs.add(`${cycle[index]}->${cycle[(index + 1) % cycle.length]}`);
    }
  }

  const originalNodes = canvas.nodes ?? [];
  // Old auto-generated spec/unresolved nodes (from the pre-expansion dump) are
  // dropped on reconcile; the map now holds only user-added/expanded nodes.
  const manualNodes = originalNodes.filter((node) => !generatedMetadata(node));
  const manualFileNodes = new Map<string, CanvasFileNode>();
  for (const node of manualNodes) {
    if (node.type === "file") manualFileNodes.set(normalizeFile(node.file), node);
  }

  const presentNodeFor = (record: SpecDependencyRecord): CanvasFileNode | undefined =>
    manualFileNodes.get(normalizeFile(canvasFilePath(record.source, canvasSource)));

  // Expansion model (230): the map holds only the spec nodes the user added or
  // expanded. Sync never auto-generates a node per discovered doc; it draws a
  // generated edge only when BOTH endpoints are already present. Un-loaded
  // dependencies are surfaced by a node's dependency badge, not by dumping the
  // whole repository onto the canvas.
  const nextGeneratedEdges: CanvasEdge[] = [];
  for (const owner of records) {
    const ownerNode = presentNodeFor(owner);
    if (!ownerNode) continue;
    const ownerRelations = recordRelationships(owner);
    for (const relationship of DOC_RELATIONSHIPS) {
      for (const declared of ownerRelations[relationship] ?? []) {
        const target = resolveRecord(declared, byKey, owner.source);
        if (!target) continue; // unresolved/ambiguous: no edge (diagnostics track it)
        const targetNode = presentNodeFor(target);
        if (!targetNode) continue; // exists but not loaded → the badge offers it
        const isDependency = relationship === "depends_on";
        let edgeLabel = RELATIONSHIP_LABEL[relationship];
        let color: string | undefined;
        if (isDependency && cyclicPairs.has(`${owner.key}->${target.key}`)) {
          edgeLabel = "depends on · cycle";
          color = "1";
        }
        const edgeId = stableId(
          "dependency",
          isDependency ? `${owner.key}:${declared}` : `${owner.key}:${relationship}:${declared}`,
        );
        // A detached manual edge retains the stable generated identity only as a
        // suppression key; its own ID is fresh and can never collide on refresh.
        if ((canvas.edges ?? []).some((edge) => suppressesGeneratedDependency(edge, edgeId)))
          continue;
        const existing = (canvas.edges ?? []).find((edge) => edge.id === edgeId);
        nextGeneratedEdges.push({
          ...(existing ?? {}),
          id: edgeId,
          fromNode: ownerNode.id,
          toNode: targetNode.id,
          toEnd: "arrow",
          label: edgeLabel,
          ...(color ? { color } : {}),
          afxStyle: existing?.afxStyle ?? { version: 1, route: "bezier", stroke: "solid" },
          afxProvenance: {
            version: 1,
            ...(isDependency
              ? { kind: "declared-dependency" as const }
              : { kind: "declared-relationship" as const, relationship }),
            owner: owner.key,
            detached: false,
            declaredToken: declared,
          },
        });
      }
    }
  }

  const manualEdges = normalizeDetachedDependencyEdges(canvas).filter(
    (edge) => !edge.afxProvenance || edge.afxProvenance.detached === true,
  );
  const next: JSONCanvas = {
    ...canvas,
    nodes: manualNodes,
    edges: [...manualEdges, ...nextGeneratedEdges],
  };
  return { content: serializeJSONCanvas(next), diagnostics };
}

// Anchored to each workspace root's own `docs/` — NOT `**/docs/**`, which also
// swept vendored copies and git worktrees (each a full repo with its own docs/),
// scanning hundreds of duplicate files and hanging Sync.
const DOC_DISCOVERY_GLOB = "docs/**/*.md";
const DOC_DISCOVERY_EXCLUDE =
  "**/{.git,node_modules,_archive,worktree,worktrees,dist,out,.vscode-test,coverage,tmp}/**";
/** Hard cap on discovered docs so a pathological tree can never stall the map. */
const DOC_DISCOVERY_MAX = 4000;

/** Bounded parallelism so a large repo never floods the FS API or hangs Sync. */
const DISCOVERY_CONCURRENCY = 24;

/** Hard wall-clock budget so discovery can never reach the webview watchdog. */
const DISCOVERY_BUDGET_MS = 10_000;

/**
 * Runs discovery under a wall-clock budget: a hung file read or a pathological
 * tree rejects the refresh instead of replacing the existing generated graph
 * with an empty discovery result.
 */
async function discoverWithinBudget(
  fileState: WorkbenchFileState,
): Promise<SpecDependencyRecord[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<SpecDependencyRecord[]>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Document discovery timed out after ${DISCOVERY_BUDGET_MS} ms.`)),
      DISCOVERY_BUDGET_MS,
    );
  });
  try {
    return await Promise.race([discoverDocs(fileState), budget]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function discoverDocs(fileState: WorkbenchFileState): Promise<SpecDependencyRecord[]> {
  const uris = await vscode.workspace.findFiles(
    DOC_DISCOVERY_GLOB,
    DOC_DISCOVERY_EXCLUDE,
    DOC_DISCOVERY_MAX,
  );
  // Open/unsaved buffers win over disk (in-memory lookup, no extra read).
  const openByKey = new Map(
    vscode.workspace.textDocuments.map((document) => [documentUriKey(document.uri), document]),
  );
  const records: SpecDependencyRecord[] = [];

  // Discovery only needs frontmatter — read bytes directly (no revision hashing
  // via fileState.readText) and in bounded-parallel batches, so hundreds of
  // docs resolve in well under the webview watchdog window.
  for (let start = 0; start < uris.length; start += DISCOVERY_CONCURRENCY) {
    const batch = uris.slice(start, start + DISCOVERY_CONCURRENCY);
    const parsed = await Promise.all(
      batch.map(async (uri) => {
        const source = fileState.identify(uri);
        if (!source) return undefined;
        const open = openByKey.get(documentUriKey(uri));
        const content = open
          ? open.getText()
          : await vscode.workspace.fs.readFile(uri).then(
              (bytes) => Buffer.from(bytes).toString("utf8"),
              () => undefined,
            );
        return content === undefined ? undefined : { source, content };
      }),
    );
    for (const entry of parsed) {
      if (!entry) continue;
      const { source, content } = entry;
      const frontmatter = parseFrontmatter(content);
      // A document qualifies only with the `afx: true` marker (230 FR-1).
      if (frontmatter.data["afx"] !== true) continue;
      const kind = resolveKind(source.relativePath, content, frontmatter.data["type"]);
      if (!kind) continue;
      const parent = path.posix.basename(path.posix.dirname(source.relativePath));
      const title =
        (typeof frontmatter.data["title"] === "string" && frontmatter.data["title"].trim()) ||
        /^#\s+(.+)$/m.exec(frontmatter.content)?.[1]?.trim() ||
        parent;
      const relationships: Partial<Record<DocRelationship, string[]>> = {};
      for (const relationship of DOC_RELATIONSHIPS) {
        const list = readStringList(frontmatter.data[relationship]);
        if (list.length > 0) relationships[relationship] = list;
      }
      records.push({
        key: recordKey(source, kind),
        title,
        source,
        dependsOn: relationships.depends_on ?? [],
        relationships,
        kind,
        ...(kind === "spec" || kind === "sprint" ? { documentKind: kind } : {}),
        ...(typeof frontmatter.data["status"] === "string" && frontmatter.data["status"].trim()
          ? { status: frontmatter.data["status"].trim() }
          : {}),
      });
    }
  }
  return records;
}

function documentUriKey(uri: vscode.Uri): string {
  return `${uri.scheme} ${uri.authority} ${uri.path}`;
}

function resolveKind(
  relativePath: string,
  content: string,
  frontmatterType: unknown,
): SddDocumentKind | undefined {
  const byPath = classifySddDocumentPath(relativePath)?.kind;
  if (byPath) return byPath;
  if (isSprintFile(content)) return "sprint";
  if (typeof frontmatterType === "string") {
    const normalized = frontmatterType.trim().toLowerCase();
    const mapped: Record<string, SddDocumentKind> = {
      spec: "spec",
      design: "design",
      tasks: "tasks",
      journal: "journal",
      sprint: "sprint",
      adr: "adr",
      res: "research",
      research: "research",
    };
    return mapped[normalized];
  }
  return undefined;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === "string");
  return typeof value === "string" ? [value] : [];
}

/**
 * Unique record identity. Specs keep their feature-folder key for back-compat
 * (`rootUri:220-checkout`); other kinds key off the document path so the four
 * files of one feature folder never collide.
 */
function recordKey(source: WorkbenchSourceIdentity, kind: SddDocumentKind): string {
  const parent = path.posix.basename(path.posix.dirname(source.relativePath));
  if (kind === "spec" || kind === "sprint") return `${source.rootUri}:${parent}`;
  return `${source.rootUri}:${source.relativePath}`;
}

/**
 * The bare token draw-to-author writes into a document's frontmatter list. A
 * spec/sprint is referenced by its feature-folder id (`120-package-db-core`, the
 * repo convention); every other kind by its file stem. Never the root-qualified
 * `recordKey` — that is a canvas-internal identity and must not reach YAML. The
 * value round-trips: `normalizeDependency` + `aliases` resolve it back to this
 * same record on the next Sync.
 */
function authorToken(record: SpecDependencyRecord, source?: WorkbenchSourceIdentity): string {
  const kind = record.kind ?? (record.documentKind === "sprint" ? "sprint" : "spec");
  const token =
    kind === "spec" || kind === "sprint"
      ? path.posix.basename(path.posix.dirname(record.source.relativePath))
      : record.source.relativePath.replace(/\.(?:md|markdown)$/i, "");
  return source && source.rootUri !== record.source.rootUri
    ? `${record.source.rootName}/${token}`
    : token;
}

function aliases(record: SpecDependencyRecord): string[] {
  const folder = path.posix.basename(path.posix.dirname(record.source.relativePath));
  const stem = path.posix.basename(record.source.relativePath).replace(/\.(?:md|markdown)$/i, "");
  const kind = record.kind ?? (record.documentKind === "sprint" ? "sprint" : "spec");
  const base = [
    record.key,
    stem,
    record.source.relativePath,
    record.source.relativePath.replace(/\.(?:md|markdown)$/i, ""),
  ];
  // Only the feature's spec/sprint claims the bare folder id, so `depends_on:
  // [220-checkout]` resolves to the spec and never ambiguously to its sibling
  // design/tasks/journal files in the same folder.
  if (kind === "spec" || kind === "sprint") {
    base.push(folder, record.source.relativePath.replace(/\/[^/]+\.(?:md|markdown)$/i, ""));
  }
  return [...base, ...base.map((alias) => `${record.source.rootName}/${alias}`)];
}

function resolveRecord(
  token: string,
  byKey: ReadonlyMap<string, SpecDependencyRecord[]>,
  source?: Pick<WorkbenchSourceIdentity, "rootUri">,
): SpecDependencyRecord | undefined {
  const matches = uniqueRecords(byKey.get(normalizeDependency(token)) ?? []);
  if (source) {
    const sameRoot = matches.filter((record) => record.source.rootUri === source.rootUri);
    if (sameRoot.length === 1) return sameRoot[0];
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function normalizeDependency(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\/g, "/")
    .replace(/\/(?:spec|design|tasks|journal)\.md$/i, "")
    .toLowerCase();
}

function uniqueRecords(records: readonly SpecDependencyRecord[]): SpecDependencyRecord[] {
  return [...new Map(records.map((record) => [record.key, record])).values()];
}

function generatedMetadata(node: CanvasNode): GeneratedMetadata | undefined {
  const value = node["afxGenerated"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return record["version"] === 1 &&
    (record["kind"] === "spec-node" || record["kind"] === "unresolved-dependency") &&
    typeof record["key"] === "string"
    ? (record as unknown as GeneratedMetadata)
    : undefined;
}

function canvasFilePath(
  source: WorkbenchSourceIdentity,
  canvasSource: WorkbenchSourceIdentity,
): string {
  return source.rootUri === canvasSource.rootUri
    ? source.relativePath
    : `${source.rootName}/${source.relativePath}`;
}

function normalizeFile(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function stableId(prefix: string, value: string): string {
  return `afx-${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles = new Map<string, string[]>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const active = new Set<string>();

  const visit = (node: string): void => {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      const cycle = stack.slice(start);
      const canonical = canonicalCycle(cycle);
      cycles.set(canonical.join("->"), canonical);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    active.delete(node);
  };

  for (const node of graph.keys()) visit(node);
  return [...cycles.values()];
}

function canonicalCycle(cycle: string[]): string[] {
  if (cycle.length < 2) return cycle;
  const rotations = cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)]);
  rotations.sort((a, b) => a.join(" ").localeCompare(b.join(" ")));
  return rotations[0] ?? cycle;
}
