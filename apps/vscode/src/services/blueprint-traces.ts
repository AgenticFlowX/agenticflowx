/**
 * External Blueprint trace storage and source-reference resolution.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-11] [FR-12] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TRACE] [DES-DATA] [DES-API]
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

import {
  type BlueprintBinding,
  type BlueprintManifest,
  blueprintArtifactInternals,
  isPortableRelativePath,
  openBlueprint,
  resolveInside,
  updateBlueprint,
} from "./blueprint-artifacts";
import { validatePortableBlueprint } from "./blueprint-validation";
import { ensureArtifactParent, withBlueprintLock } from "./blueprint-writer";
import type { SymbolObservation } from "./repository-blueprint";

export interface TracePosition {
  line: number;
  character: number;
}

export interface TraceRange {
  start: TracePosition;
  end: TracePosition;
}

export interface BlueprintTraceLink {
  id: string;
  source: {
    repositoryId: string;
    path: string;
    languageId?: string;
    range?: TraceRange;
    symbol?: { name: string; kind: number; range: TraceRange; selectionRange: TraceRange };
    containerPath?: string[];
    contentHash?: string;
    scope: "file" | "symbol" | "range";
  };
  target: {
    documentRootId?: string;
    path: string;
    anchor?: { kind: "requirement" | "design" | "task" | "section"; id: string };
  };
  relation: "relates-to" | "implements" | "tests";
  createdAt: string;
  createdBy: "human" | "agent";
  lastKnownResolution?: "resolved" | "stale" | "unresolved" | "ambiguous";
  description?: string;
}

export interface BlueprintTraceStore {
  kind: "afx-blueprint-traces";
  schemaVersion: 1 | 2 | 3;
  blueprintId: string;
  revision: number;
  updatedAt: string;
  positionEncoding: "utf-16";
  links: BlueprintTraceLink[];
}

export interface ResolvedBlueprintReference {
  linkId: string;
  range: vscode.Range;
  targetPath: string;
  targetAnchor?: string;
  relation: BlueprintTraceLink["relation"];
  origin: "blueprint";
  resolution: "resolved" | "stale" | "unresolved" | "ambiguous";
  description?: string;
}

export interface TraceRelinkCandidate {
  repositoryId: string;
  path: string;
  symbolNames: readonly string[];
}

/**
 * Returns a moved symbol target only when repository and symbol evidence identify one candidate.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-12]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TRACE]
 */
export function findTraceRelinkCandidate(
  link: BlueprintTraceLink,
  candidates: readonly TraceRelinkCandidate[],
): { resolution: "resolved"; path: string } | { resolution: "unresolved" | "ambiguous" } {
  const symbolName = link.source.symbol?.name;
  if (!symbolName) return { resolution: "unresolved" };
  const matches = candidates.filter(
    (candidate) =>
      candidate.repositoryId === link.source.repositoryId &&
      candidate.symbolNames.includes(symbolName),
  );
  if (matches.length === 1) return { resolution: "resolved", path: matches[0]!.path };
  return { resolution: matches.length > 1 ? "ambiguous" : "unresolved" };
}

function validPosition(value: TracePosition): boolean {
  return (
    Number.isInteger(value.line) &&
    value.line >= 0 &&
    Number.isInteger(value.character) &&
    value.character >= 0
  );
}

function validateRange(value: TraceRange): boolean {
  if (!validPosition(value.start) || !validPosition(value.end)) return false;
  return (
    value.end.line > value.start.line ||
    (value.end.line === value.start.line && value.end.character >= value.start.character)
  );
}

/**
 * Validates trace shape and cross-file Blueprint/repository identities.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-11] [FR-15]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-FORMAT]
 */
export function validateTraceStore(
  value: unknown,
  manifest: BlueprintManifest,
): BlueprintTraceStore {
  if (!value || typeof value !== "object") throw new Error("Trace store must be an object.");
  const store = value as BlueprintTraceStore;
  if (store.kind !== "afx-blueprint-traces" || store.schemaVersion !== manifest.schemaVersion)
    throw new Error("Unsupported Blueprint trace store.");
  if (store.blueprintId !== manifest.id)
    throw new Error("Trace store belongs to another Blueprint.");
  if (
    store.positionEncoding !== "utf-16" ||
    !Number.isInteger(store.revision) ||
    !Array.isArray(store.links)
  )
    throw new Error("Invalid Blueprint trace metadata.");
  const repositories = new Set(manifest.repositories.map((repository) => repository.id));
  const ids = new Set<string>();
  for (const link of store.links) {
    if (ids.has(link.id)) throw new Error("Trace link ids must be unique.");
    ids.add(link.id);
    if (!repositories.has(link.source.repositoryId))
      throw new Error("Trace source repository is undeclared.");
    if (!isPortableRelativePath(link.source.path) || !isPortableRelativePath(link.target.path))
      throw new Error("Trace paths must be portable and root-relative.");
    if (link.source.scope === "range" && (!link.source.range || !validateRange(link.source.range)))
      throw new Error("Range trace requires an ordered UTF-16 range.");
    if (link.source.scope === "symbol" && !link.source.symbol)
      throw new Error("Symbol trace requires symbol evidence.");
  }
  if (store.schemaVersion < 3) validatePortableBlueprint(store);
  return store;
}

export async function loadTraceStore(
  artifactRoot: string,
  manifest: BlueprintManifest,
): Promise<BlueprintTraceStore> {
  if (manifest.schemaVersion === 3) {
    const current = await openBlueprint(artifactRoot);
    return validateTraceStore(
      {
        kind: "afx-blueprint-traces",
        schemaVersion: 3,
        blueprintId: current.id,
        revision: current.revision,
        updatedAt: current.updatedAt,
        positionEncoding: "utf-16",
        links: current.links ?? [],
      },
      current,
    );
  }
  const location = resolveInside(artifactRoot, manifest.artifacts.traces);
  return validateTraceStore(JSON.parse(await readFile(location, "utf8")) as unknown, manifest);
}

export interface AddTraceInput {
  repositoryId: string;
  sourcePath: string;
  languageId?: string;
  range?: TraceRange;
  symbol?: BlueprintTraceLink["source"]["symbol"];
  scope: "file" | "symbol" | "range";
  targetPath: string;
  documentRootId?: string;
  documentRoot?: string;
  targetAnchor?: BlueprintTraceLink["target"]["anchor"];
  relation?: BlueprintTraceLink["relation"];
  description?: string;
  createdBy?: "human" | "agent";
  content?: string;
}

export async function addTraceLink(
  artifactRoot: string,
  manifest: BlueprintManifest,
  expectedRevision: number,
  input: AddTraceInput,
): Promise<BlueprintTraceStore> {
  if (manifest.schemaVersion === 3) {
    const store = await loadTraceStore(artifactRoot, manifest);
    if (store.revision !== expectedRevision) throw new Error("Blueprint trace revision conflict.");
    if (!input.documentRootId || !input.documentRoot)
      throw new Error("Choose a bound document root for this Blueprint link.");
    const targetContent = await readFile(
      resolveInside(input.documentRoot, input.targetPath),
      "utf8",
    ).catch(() => {
      throw new Error("Blueprint trace target does not exist or cannot be read.");
    });
    if (input.targetAnchor && !targetContent.includes(`[${input.targetAnchor.id}]`))
      throw new Error(`Blueprint trace target anchor [${input.targetAnchor.id}] was not found.`);
    const now = new Date().toISOString();
    const link = createTraceLink(input, now);
    const next = {
      ...store,
      revision: store.revision + 1,
      updatedAt: now,
      links: [...store.links, link],
    };
    validateTraceStore(next, manifest);
    await updateBlueprint(artifactRoot, manifest.revision, (current) => ({
      ...current,
      links: next.links,
    }));
    return next;
  }
  return withBlueprintLock(artifactRoot, async () => {
    const store = await loadTraceStore(artifactRoot, manifest);
    if (store.revision !== expectedRevision) throw new Error("Blueprint trace revision conflict.");
    const targetLocation = resolveInside(artifactRoot, input.targetPath);
    const targetContent = await readFile(targetLocation, "utf8").catch(() => {
      throw new Error("Blueprint trace target does not exist or cannot be read.");
    });
    if (input.targetAnchor && !targetContent.includes(`[${input.targetAnchor.id}]`))
      throw new Error(`Blueprint trace target anchor [${input.targetAnchor.id}] was not found.`);
    const now = new Date().toISOString();
    const link = createTraceLink(input, now);
    const next: BlueprintTraceStore = {
      ...store,
      revision: store.revision + 1,
      updatedAt: now,
      links: [...store.links, link],
    };
    validateTraceStore(next, manifest);
    await ensureArtifactParent(artifactRoot, manifest.artifacts.traces);
    await blueprintArtifactInternals.atomicWrite(
      resolveInside(artifactRoot, manifest.artifacts.traces),
      blueprintArtifactInternals.stableJson(next),
    );
    return next;
  });
}

function createTraceLink(input: AddTraceInput, now: string): BlueprintTraceLink {
  return {
    id: randomUUID(),
    source: {
      repositoryId: input.repositoryId,
      path: input.sourcePath,
      ...(input.languageId ? { languageId: input.languageId } : {}),
      ...(input.range ? { range: input.range } : {}),
      ...(input.symbol ? { symbol: input.symbol } : {}),
      ...(input.content !== undefined
        ? { contentHash: `sha256:${createHash("sha256").update(input.content).digest("hex")}` }
        : {}),
      scope: input.scope,
    },
    target: {
      ...(input.documentRootId ? { documentRootId: input.documentRootId } : {}),
      path: input.targetPath,
      ...(input.targetAnchor ? { anchor: input.targetAnchor } : {}),
    },
    relation: input.relation ?? "relates-to",
    createdAt: now,
    createdBy: input.createdBy ?? "human",
    lastKnownResolution: "resolved",
    ...(input.description ? { description: input.description } : {}),
  };
}

function uriPathForBinding(uri: vscode.Uri, checkoutRoot: string): string | undefined {
  if (uri.scheme !== "file") return undefined;
  const relative = path.relative(path.resolve(checkoutRoot), path.resolve(uri.fsPath));
  if (!relative || relative === ".") return "";
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    return undefined;
  return relative.split(path.sep).join("/");
}

/**
 * Resolves links only through explicit local checkout bindings; identical relative paths in other repos do not match.
 *
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-11] [FR-12] [NFR-4]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-TRACE] [DES-API]
 */
export function resolveBlueprintReferences(
  document: vscode.TextDocument,
  artifactRoot: string,
  binding: BlueprintBinding,
  store: BlueprintTraceStore,
): ResolvedBlueprintReference[] {
  const matches: ResolvedBlueprintReference[] = [];
  for (const link of store.links) {
    const checkout = binding.checkouts[link.source.repositoryId];
    if (!checkout || uriPathForBinding(document.uri, checkout) !== link.source.path) continue;
    const sourceRange = link.source.symbol?.selectionRange ?? link.source.range;
    const range = sourceRange
      ? new vscode.Range(
          new vscode.Position(sourceRange.start.line, sourceRange.start.character),
          new vscode.Position(sourceRange.end.line, sourceRange.end.character),
        )
      : new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));
    const targetRoot = link.target.documentRootId
      ? binding.documentRoots?.[link.target.documentRootId]
      : artifactRoot;
    if (!targetRoot) continue;
    const targetPath = resolveInside(targetRoot, link.target.path);
    const targetMissing =
      !isCanonicalChild(targetRoot, targetPath) ||
      !existsSync(targetPath) ||
      Boolean(link.target.anchor && !resolveTargetAnchor(targetPath, link.target.anchor.id));
    const contentChanged = Boolean(
      link.source.contentHash &&
      link.source.contentHash !==
        `sha256:${createHash("sha256").update(document.getText()).digest("hex")}`,
    );
    matches.push({
      linkId: link.id,
      range,
      targetPath,
      ...(link.target.anchor ? { targetAnchor: link.target.anchor.id } : {}),
      relation: link.relation,
      origin: "blueprint",
      resolution: targetMissing
        ? "unresolved"
        : contentChanged
          ? "stale"
          : (link.lastKnownResolution ?? "unresolved"),
      ...(link.description ? { description: link.description } : {}),
    });
  }
  return matches;
}

function resolveTargetAnchor(targetPath: string, anchorId: string): boolean {
  try {
    return readFileSync(targetPath, "utf8").includes(`[${anchorId}]`);
  } catch {
    return false;
  }
}

export async function relinkTraceSource(
  artifactRoot: string,
  manifest: BlueprintManifest,
  expectedRevision: number,
  linkId: string,
  source: Pick<BlueprintTraceLink["source"], "repositoryId" | "path" | "scope"> &
    Partial<Pick<BlueprintTraceLink["source"], "languageId" | "range" | "symbol">> & {
      content?: string;
    },
): Promise<BlueprintTraceStore> {
  if (manifest.schemaVersion === 3) {
    const current = await openBlueprint(artifactRoot);
    const store = await loadTraceStore(artifactRoot, current);
    if (store.revision !== expectedRevision) throw new Error("Blueprint trace revision conflict.");
    const index = store.links.findIndex((link) => link.id === linkId);
    if (index < 0) throw new Error("Blueprint trace link was not found.");
    const previous = store.links[index]!;
    const now = new Date().toISOString();
    const updated: BlueprintTraceLink = {
      ...previous,
      source: {
        repositoryId: source.repositoryId,
        path: source.path,
        scope: source.scope,
        ...(source.languageId ? { languageId: source.languageId } : {}),
        ...(source.range ? { range: source.range } : {}),
        ...(source.symbol ? { symbol: source.symbol } : {}),
        ...(source.content !== undefined
          ? { contentHash: `sha256:${createHash("sha256").update(source.content).digest("hex")}` }
          : {}),
      },
      lastKnownResolution: "resolved",
    };
    const links = [...store.links];
    links[index] = updated;
    const next = { ...store, revision: store.revision + 1, updatedAt: now, links };
    validateTraceStore(next, current);
    await updateBlueprint(artifactRoot, current.revision, (value) => ({ ...value, links }));
    return next;
  }
  return withBlueprintLock(artifactRoot, async () => {
    const store = await loadTraceStore(artifactRoot, manifest);
    if (store.revision !== expectedRevision) throw new Error("Blueprint trace revision conflict.");
    const index = store.links.findIndex((link) => link.id === linkId);
    if (index < 0) throw new Error("Blueprint trace link was not found.");
    const previous = store.links[index]!;
    const now = new Date().toISOString();
    const updated: BlueprintTraceLink = {
      ...previous,
      source: {
        repositoryId: source.repositoryId,
        path: source.path,
        scope: source.scope,
        ...(source.languageId ? { languageId: source.languageId } : {}),
        ...(source.range ? { range: source.range } : {}),
        ...(source.symbol ? { symbol: source.symbol } : {}),
        ...(source.content !== undefined
          ? { contentHash: `sha256:${createHash("sha256").update(source.content).digest("hex")}` }
          : {}),
      },
      lastKnownResolution: "resolved",
    };
    const links = [...store.links];
    links[index] = updated;
    const next: BlueprintTraceStore = {
      ...store,
      revision: store.revision + 1,
      updatedAt: now,
      links,
    };
    validateTraceStore(next, manifest);
    await ensureArtifactParent(artifactRoot, manifest.artifacts.traces);
    await blueprintArtifactInternals.atomicWrite(
      resolveInside(artifactRoot, manifest.artifacts.traces),
      blueprintArtifactInternals.stableJson(next),
    );
    return next;
  });
}

function isCanonicalChild(root: string, file: string): boolean {
  try {
    const relative = path.relative(realpathSync(root), realpathSync(file));
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

/** Repositions navigation with current LSP symbols while retaining stale semantic evidence. */
export function repositionBlueprintReferences(
  references: ResolvedBlueprintReference[],
  store: BlueprintTraceStore,
  symbols: readonly SymbolObservation[],
): ResolvedBlueprintReference[] {
  const candidates: Array<{ symbol: SymbolObservation; containers: string[] }> = [];
  const visit = (items: readonly SymbolObservation[], containers: string[]): void => {
    for (const symbol of items) {
      candidates.push({ symbol, containers });
      visit(symbol.children ?? [], [...containers, symbol.name]);
    }
  };
  visit(symbols, []);
  return references.map((reference) => {
    const link = store.links.find((item) => item.id === reference.linkId);
    if (!link?.source.symbol || reference.resolution === "resolved") return reference;
    const matches = candidates.filter(
      ({ symbol, containers }) =>
        symbol.name === link.source.symbol!.name &&
        symbol.kind === link.source.symbol!.kind &&
        (!link.source.containerPath ||
          link.source.containerPath.join("/") === containers.join("/")),
    );
    if (matches.length !== 1)
      return {
        ...reference,
        resolution: matches.length ? "ambiguous" : "unresolved",
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
      };
    const range = matches[0]!.symbol.selectionRange;
    return {
      ...reference,
      range: new vscode.Range(
        new vscode.Position(range.start.line, range.start.character),
        new vscode.Position(range.end.line, range.end.character),
      ),
    };
  });
}
